import { createGoontehCore, type DropzoneHandle, type DropzoneOptions, type GoontehConfig, type Point } from './core'

/**
 * goonteh — native (vanilla DOM) adapter.
 *
 * A friendly, framework-free wrapper over the core for plain HTML/JS: `grab(el, ...)` and
 * `drop(el, ...)` bound to one engine, plus ghost sugar (a factory, an HTML string, or a clone of
 * the source). Needs no dependencies at all.
 */
export type NativeGhost = (() => HTMLElement) | string | 'clone'

export type NativeGrabOptions = {
  payload?: unknown
  kind: string
  /** Ghost: a factory, an HTML string, or 'clone' to clone the dragged element. Default 'clone'. */
  ghost?: NativeGhost
  disabled?: () => boolean
  /** 'hole' (blank gap, no reflow) or 'collapse' (siblings close up); omit to leave in place. */
  lift?: 'hole' | 'collapse'
  /** Touch: a still hold has crouched at this point (pop a context menu here). Move → drag; release → menu stays. */
  onCrouch?: (point: Point) => void
  /** The drag began (mouse move, or a move after a touch crouch) — dismiss the menu here. */
  onLift?: () => void
}

export type Goonteh = {
  grab(el: HTMLElement, opts: NativeGrabOptions): () => void
  drop(el: HTMLElement, opts: DropzoneOptions): DropzoneHandle
  dragging(): boolean
  /** The active drag (kind + payload) while dragging, else undefined. */
  active(): { kind: string; payload: unknown } | undefined
  /** The live pointer position while dragging, else undefined. */
  point(): Point | undefined
  onChange(fn: () => void): () => void
  destroy(): void
}

/** Create a DOM-native goonteh instance (no framework). */
export function goonteh(config?: GoontehConfig): Goonteh {
  const core = createGoontehCore(config)
  return {
    grab(el, opts) {
      return core.draggable(el, {
        payload: () => opts.payload,
        kind: opts.kind,
        disabled: opts.disabled,
        lift: opts.lift,
        onCrouch: opts.onCrouch,
        onLift: opts.onLift,
        ghost: () => makeGhost(el, opts.ghost),
      })
    },
    drop: (el, opts) => core.dropzone(el, opts),
    dragging: () => core.dragging(),
    active: () => core.active(),
    point: () => core.point(),
    onChange: (fn) => core.onChange(fn),
    destroy: () => core.destroy(),
  }
}

/** Build a ghost element from the requested strategy. */
function makeGhost(source: HTMLElement, ghost: NativeGhost = 'clone'): HTMLElement {
  if (typeof ghost === 'function') return ghost()
  if (ghost === 'clone') {
    const clone = source.cloneNode(true) as HTMLElement
    const rect = source.getBoundingClientRect()
    clone.style.width = `${rect.width}px`
    clone.style.height = `${rect.height}px`
    clone.style.opacity = '0.85'
    return clone
  }
  const wrap = document.createElement('div')
  wrap.innerHTML = ghost
  return wrap
}
