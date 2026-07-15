/** @jsxImportSource react */
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createGoontehCore, type GoontehConfig, type GoontehCore, type Point } from './core'

/**
 * goonteh — React adapter.
 *
 * Thin React bindings over the framework-agnostic core (`./core`): a provider that owns one
 * engine, `<Grab>` for draggable sources, and `<Drop>` for targets. Latest props are read through
 * refs so the stable core closures always see current values. Drag state reaches components through
 * `useSyncExternalStore` subscriptions, so a pointer-move only re-renders what actually reads it (the
 * context itself is stable). `react` / `react-dom` are optional peer dependencies.
 */
type Ctx = { core: GoontehCore }
const GoontehContext = createContext<Ctx | null>(null)

/** Root provider. Create it once, above every `<Grab>`/`<Drop>`. */
export function GoontehProvider({ children, config }: { children: ReactNode; config?: GoontehConfig }) {
  const coreRef = useRef<GoontehCore>()
  if (!coreRef.current) coreRef.current = createGoontehCore(config)
  const core = coreRef.current
  useEffect(() => () => core.destroy(), [core])
  const ctx = useMemo(() => ({ core }), [core]) // stable — never changes per drag, so consumers don't re-render on move
  return <GoontehContext.Provider value={ctx}>{children}</GoontehContext.Provider>
}

function useCtx(): Ctx {
  const c = useContext(GoontehContext)
  if (!c) throw new Error('goonteh: <GoontehProvider> is required higher in the tree')
  return c
}

export type ActiveDrag = { kind: string; payload: unknown } | undefined

/**
 * Live drag state. Subscribes to the engine, so only components that call this re-render as the drag
 * moves. Read `active` to know what is being dragged and `point` for where (reorder-vs-combine, etc.).
 */
export function useGoonteh(): { dragging: boolean; active: ActiveDrag; point: Point | undefined } {
  const { core } = useCtx()
  const cache = useRef<{ dragging: boolean; active: ActiveDrag; point: Point | undefined }>({ dragging: false, active: undefined, point: undefined })
  // getSnapshot must return a stable reference while unchanged (else useSyncExternalStore loops).
  const snapshot = () => {
    const prev = cache.current
    const dragging = core.dragging()
    const active = core.active()
    const point = core.point()
    if (prev.dragging === dragging && prev.active?.kind === active?.kind && prev.active?.payload === active?.payload && prev.point?.x === point?.x && prev.point?.y === point?.y) return prev
    return (cache.current = { dragging, active, point })
  }
  return useSyncExternalStore(core.onChange, snapshot, snapshot)
}

/** A draggable source. `ghost` is rendered into a detached element at grab time via a React root. */
export function Grab({
  payload,
  kind,
  ghost,
  disabled,
  lift,
  className,
  children,
}: {
  payload: unknown
  kind: string
  ghost: () => ReactNode
  disabled?: boolean
  /** 'hole' (blank gap, no reflow) or 'collapse' (siblings close up); omit to leave in place. */
  lift?: 'hole' | 'collapse'
  className?: string
  children: ReactNode
}) {
  const { core } = useCtx()
  const ref = useRef<HTMLDivElement>(null)
  const latest = useRef({ payload, ghost, disabled, lift })
  latest.current = { payload, ghost, disabled, lift }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let root: Root | undefined
    const cleanup = core.draggable(el, {
      payload: () => latest.current.payload,
      kind,
      disabled: () => !!latest.current.disabled,
      lift: latest.current.lift,
      ghost: () => {
        const container = document.createElement('div')
        root = createRoot(container)
        root.render(latest.current.ghost())
        return container
      },
      onEnd: () => {
        root?.unmount()
        root = undefined
      },
    })
    return () => {
      cleanup()
      root?.unmount()
    }
  }, [core, kind])
  return (
    <div ref={ref} className={className} style={{ touchAction: 'none' }}>
      {children}
    </div>
  )
}

/** A drop target. `activeClass` is applied while a compatible drag hovers over it. */
export function Drop({
  accepts,
  onDrop,
  className,
  activeClass,
  children,
}: {
  accepts: (kind: string, payload: unknown) => boolean
  onDrop: (payload: unknown, kind: string, point: Point) => void
  className?: string
  activeClass?: string
  children: ReactNode
}) {
  const { core } = useCtx()
  const ref = useRef<HTMLDivElement>(null)
  const handle = useRef<{ isOver: () => boolean } | undefined>(undefined)
  const latest = useRef({ accepts, onDrop })
  latest.current = { accepts, onDrop }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = core.dropzone(el, {
      accepts: (k, p) => latest.current.accepts(k, p),
      onDrop: (p, k, pt) => latest.current.onDrop(p, k, pt),
    })
    handle.current = h
    return () => h.destroy()
  }, [core])
  // Subscribe just for this zone's hover flag — a boolean, so it only re-renders when it flips.
  const over = useSyncExternalStore(
    core.onChange,
    () => handle.current?.isOver() ?? false,
    () => false,
  )
  return (
    <div ref={ref} className={`${className ?? ''} ${over ? (activeClass ?? '') : ''}`}>
      {children}
    </div>
  )
}
