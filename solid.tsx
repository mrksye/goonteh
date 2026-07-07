/** @jsxImportSource solid-js */
import { createContext, createSignal, onCleanup, onMount, useContext, type Accessor, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import { createGoontehCore, type GoontehConfig, type GoontehCore } from './core'

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

/**
 * A draggable source. `ghost` is rendered to a detached element at grab time and handed to the
 * core (which mounts/positions/removes it); the Solid root is disposed when the drag ends.
 */
export function Grab(props: {
  payload: unknown
  kind: string
  ghost: () => JSX.Element
  disabled?: boolean
  class?: string
  children: JSX.Element
}): JSX.Element {
  const { core } = useCtx()
  let el!: HTMLDivElement
  onMount(() => {
    let dispose: (() => void) | null = null
    const cleanup = core.draggable(el, {
      payload: () => props.payload,
      kind: props.kind,
      disabled: () => !!props.disabled,
      ghost: () => {
        const container = document.createElement('div')
        dispose = render(() => props.ghost(), container)
        return container
      },
      onEnd: () => {
        dispose?.()
        dispose = null
      },
    })
    onCleanup(() => {
      cleanup()
      dispose?.()
    })
  })
  return (
    <div ref={el} class={props.class} style={{ 'touch-action': 'none' }}>
      {props.children}
    </div>
  )
}

/** A drop target. `activeClass` is applied while a compatible drag hovers over it. */
export function Drop(props: {
  accepts: (kind: string, payload: unknown) => boolean
  onDrop: (payload: unknown, kind: string) => void
  class?: string
  activeClass?: string
  children: JSX.Element
}): JSX.Element {
  const { core, version } = useCtx()
  let el!: HTMLDivElement
  const [zone, setZone] = createSignal<{ isOver: () => boolean } | null>(null)
  onMount(() => {
    const handle = core.dropzone(el, {
      accepts: (k, p) => props.accepts(k, p),
      onDrop: (p, k) => props.onDrop(p, k),
    })
    setZone(handle)
    onCleanup(() => handle.destroy())
  })
  const over = () => {
    version()
    return zone()?.isOver() ?? false
  }
  return (
    <div ref={el} class={`${props.class ?? ''} ${over() ? (props.activeClass ?? '') : ''}`}>
      {props.children}
    </div>
  )
}
