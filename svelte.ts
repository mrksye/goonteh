import { getContext, onDestroy, setContext } from 'svelte'
import { readable, type Readable } from 'svelte/store'
import { createGoontehCore, type GoontehConfig, type GoontehCore, type Point } from './core'

/**
 * goonteh — Svelte adapter.
 *
 * Idiomatic Svelte: the engine lives in context, and `grab` / `drop` are use-directive **actions**
 * (`use:grab={...}`) that attach behaviour to an element. Live drag state is a `drag` **store**
 * (`$drag`). Built on the framework-agnostic core (`./core`); `svelte` is an optional peer dependency.
 *
 * ```svelte
 * <script>
 *   import { createGoonteh } from 'goonteh/svelte'
 *   const { grab, drop, drag } = createGoonteh()
 * </script>
 * <div use:grab={{ payload: id, kind: 'card', ghost: makeGhost, lift: 'hole' }}>…</div>
 * <div use:drop={{ accepts, onDrop, activeClass: 'ring-2' }}>…</div>
 * {#if $drag.dragging}dragging {$drag.active?.kind}{/if}
 * ```
 */

export type ActiveDrag = { kind: string; payload: unknown } | undefined
export type DragState = { dragging: boolean; active: ActiveDrag; point: Point | undefined }

export type GrabParams = {
  payload: unknown
  kind: string
  ghost: () => HTMLElement
  disabled?: boolean
  /** 'hole' (blank gap, no reflow) or 'collapse' (siblings close up); omit to leave in place. */
  lift?: 'hole' | 'collapse'
  /** Touch: a still hold has crouched at this point (pop a context menu here). Move → drag; release → menu stays. */
  onCrouch?: (point: Point) => void
  /** The drag began (mouse move, or a move after a touch crouch) — dismiss the menu here. */
  onLift?: () => void
}
export type DropParams = {
  accepts: (kind: string, payload: unknown) => boolean
  onDrop: (payload: unknown, kind: string, point: Point) => void
  /** Space-separated classes toggled on the element while a compatible drag hovers it. */
  activeClass?: string
}

type Action<P> = (el: HTMLElement, params: P) => { update(p: P): void; destroy(): void }
export type Goonteh = { grab: Action<GrabParams>; drop: Action<DropParams>; drag: Readable<DragState>; core: GoontehCore }

const KEY = Symbol('goonteh')

const grabAction = (core: GoontehCore): Action<GrabParams> => (el, params) => {
  let p = params
  const cleanup = core.draggable(el, {
    payload: () => p.payload,
    kind: p.kind,
    disabled: () => !!p.disabled,
    lift: p.lift,
    onCrouch: p.onCrouch ? (point) => p.onCrouch!(point) : undefined,
    onLift: () => p.onLift?.(),
    ghost: () => p.ghost(),
  })
  return {
    update: (next) => {
      p = next
    },
    destroy: cleanup,
  }
}

const dropAction = (core: GoontehCore): Action<DropParams> => (el, params) => {
  let p = params
  const classes = () => (p.activeClass ?? '').split(' ').filter(Boolean)
  const handle = core.dropzone(el, {
    accepts: (k, payload) => p.accepts(k, payload),
    onDrop: (payload, k, pt) => p.onDrop(payload, k, pt),
  })
  let on = false
  const reflect = () => {
    const over = handle.isOver()
    if (over === on) return
    on = over
    const cs = classes()
    if (cs.length) el.classList[over ? 'add' : 'remove'](...cs)
  }
  const unsub = core.onChange(reflect)
  return {
    update: (next) => {
      p = next
    },
    destroy: () => {
      unsub()
      handle.destroy()
    },
  }
}

/**
 * Create an engine and put it in context; call once in a root component. Returns the `grab`/`drop`
 * actions and the `drag` store. Descendants can reach the same engine via {@link getGoonteh}.
 */
export function createGoonteh(config?: GoontehConfig): Goonteh {
  const core = createGoontehCore(config)
  onDestroy(() => core.destroy())
  const drag = readable<DragState>({ dragging: false, active: undefined, point: undefined }, (set) => {
    const read = () => set({ dragging: core.dragging(), active: core.active(), point: core.point() })
    read()
    return core.onChange(read)
  })
  const api: Goonteh = { grab: grabAction(core), drop: dropAction(core), drag, core }
  setContext(KEY, api)
  return api
}

/** Read the engine created by an ancestor's {@link createGoonteh}. */
export function getGoonteh(): Goonteh {
  const api = getContext<Goonteh>(KEY)
  if (!api) throw new Error('goonteh: call createGoonteh() in an ancestor component')
  return api
}
