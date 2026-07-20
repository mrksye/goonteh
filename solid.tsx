import { createContext, createSignal, onCleanup, onMount, useContext, type Accessor, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import { createGoontehCore, type GoontehConfig, type GoontehCore, type Point } from './core'

/**
 * goonteh — SolidJS adapter.
 *
 * Thin Solid bindings over the framework-agnostic core (`./core`): a provider that owns one
 * engine, `<Grab>` for draggable sources, and `<Drop>` for targets. The core handles all pointer
 * mechanics and the ghost; this file only wires refs and reflects state into Solid reactivity.
 */
type Ctx = { core: GoontehCore; version: Accessor<number> }
const GoontehContext = createContext<Ctx>()

/** Root provider. Create it once, above every `<Grab>`/`<Drop>`. */
export function GoontehProvider(props: { children: JSX.Element; config?: GoontehConfig }): JSX.Element {
  const core = createGoontehCore(props.config)
  const [version, setVersion] = createSignal(0)
  const unsub = core.onChange(() => setVersion((v) => v + 1))
  onCleanup(() => {
    unsub()
    core.destroy()
  })
  return <GoontehContext.Provider value={{ core, version }}>{props.children}</GoontehContext.Provider>
}

function useCtx(): Ctx {
  const c = useContext(GoontehContext)
  if (!c) throw new Error('goonteh: <GoontehProvider> is required higher in the tree')
  return c
}

/** The live drag state (kind + payload) while dragging, else undefined. */
export type ActiveDrag = { kind: string; payload: unknown } | undefined

/**
 * Reactive read-side of the engine. Each accessor touches `version` (bumped on every drag change)
 * then reads the core, so it re-runs inside any Solid tracking scope. Use it to react to what is
 * being dragged (`active`) and where (`point`) — e.g. to show a reorder-vs-combine affordance.
 */
export function useGoonteh(): {
  dragging: Accessor<boolean>
  active: Accessor<ActiveDrag>
  point: Accessor<Point | undefined>
  overEl: Accessor<HTMLElement | undefined>
} {
  const { core, version } = useCtx()
  const tracked = <T,>(read: () => T): Accessor<T> => () => (version(), read())
  return { dragging: tracked(core.dragging), active: tracked(core.active), point: tracked(core.point), overEl: tracked(core.overEl) }
}

/**
 * A draggable source. `ghost` is rendered to a detached element at grab time and handed to the
 * core (which mounts/positions/removes it); the Solid root is disposed when the drag ends.
 */
export function Grab(props: {
  payload: unknown
  kind: string
  ghost: () => JSX.Element
  disabled?: boolean
  /** How the source looks while dragged: 'hole' (blank gap, no reflow) or 'collapse' (siblings close
   *  up). Omit to leave it in place (copy-style drag). See DraggableOptions.lift. */
  lift?: 'hole' | 'collapse'
  /** Touch: a still hold has crouched at this point (show a context menu here). Move → drag; release → menu stays. */
  onCrouch?: (point: Point) => void
  /** The drag actually began (mouse move, or a move after a touch crouch) — dismiss the menu here. */
  onLift?: () => void
  class?: string
  children: JSX.Element
}): JSX.Element {
  const { core } = useCtx()
  let el!: HTMLDivElement
  onMount(() => {
    let dispose: (() => void) | undefined
    const cleanup = core.draggable(el, {
      payload: () => props.payload,
      kind: props.kind,
      disabled: () => !!props.disabled,
      lift: props.lift,
      onCrouch: props.onCrouch ? (point) => props.onCrouch!(point) : undefined,
      onLift: props.onLift ? () => props.onLift!() : undefined,
      ghost: () => {
        const container = document.createElement('div')
        dispose = render(() => props.ghost(), container)
        return container
      },
      onEnd: () => {
        dispose?.()
        dispose = undefined
      },
    })
    onCleanup(() => {
      cleanup()
      dispose?.()
    })
  })
  return (
    <div ref={el} class={props.class}>
      {props.children}
    </div>
  )
}

/** A drop target. `activeClass` is applied while a compatible drag hovers over it. */
export function Drop(props: {
  accepts: (kind: string, payload: unknown) => boolean
  onDrop: (payload: unknown, kind: string, point: Point) => void
  class?: string
  activeClass?: string
  style?: JSX.CSSProperties
  children: JSX.Element
}): JSX.Element {
  const { core, version } = useCtx()
  let el!: HTMLDivElement
  const [zone, setZone] = createSignal<{ isOver: () => boolean } | undefined>()
  onMount(() => {
    const handle = core.dropzone(el, {
      accepts: (k, p) => props.accepts(k, p),
      onDrop: (p, k, pt) => props.onDrop(p, k, pt),
    })
    setZone(handle)
    onCleanup(() => handle.destroy())
  })
  const over = () => {
    version()
    return zone()?.isOver() ?? false
  }
  return (
    <div ref={el} class={`${props.class ?? ''} ${over() ? (props.activeClass ?? '') : ''}`} style={props.style}>
      {props.children}
    </div>
  )
}
