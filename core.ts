/**
 * goonteh core — a framework-agnostic pointer drag-and-drop engine.
 *
 * Pure TypeScript + DOM, no framework. For a single primary pointer it tracks a drag from
 * pointer-down (past a small threshold) through pointer-up, hit-tests registered drop zones by
 * geometry (rect containment + DOM nesting, not paint order), manages an optional ghost element
 * that follows the pointer, and drives the body cursor. Secondary touches are ignored, pointer
 * capture keeps events flowing off-element, and teardown restores the body's prior inline styles.
 * Framework adapters (see `./solid`) wrap this; you can also use it directly with vanilla JS.
 *
 * The name respells 軍手 (gunte), Japanese for "work gloves": native HTML5 DnD slips (no
 * touch, and a stuck no-drop cursor on some platforms) — put a glove on to actually grip.
 */

export type Point = { x: number; y: number }
export type Accepts = (kind: string, payload: unknown) => boolean
export type OnDrop = (payload: unknown, kind: string, point: Point) => void

export type DraggableOptions = {
  /** Read at drag start; the value handed to the drop target. */
  payload: () => unknown
  /** Tag drop zones filter on. */
  kind: string
  /** Builds the drag preview element, once, at drag start. Mounted/positioned/removed by core. */
  ghost?: () => HTMLElement
  /** When it returns true, pointer-down does not start a drag. */
  disabled?: () => boolean
  /** How the source element behaves while it is being dragged. Restored when the drag ends.
   *  - `'hole'`: hidden in place (visibility:hidden) — the box keeps its space, so a blank hole is
   *    left and siblings do NOT reflow. The item looks genuinely picked up. Recommended default.
   *  - `'collapse'`: removed from layout (display:none) — siblings close the gap ("normal" reflow).
   *  Omit to leave the source fully visible in place (a copy-style drag, e.g. a palette/tray). */
  lift?: 'hole' | 'collapse'
  /**
   * Touch/pen only: fired at the pointer with the weight taken but nothing lifted yet — you've **crouched**
   * (a still hold reached `holdDelay`). Show a context menu here (the Android launcher move: long-press pops
   * the menu). From the crouch, a move lifts (the drag begins, {@link onLift}); a release keeps the menu.
   * Crouching is only to make room for that menu — omit this and a hold lifts straight away (no crouch),
   * the plain hold-to-drag. Either way a quick swipe before the hold stays a scroll.
   */
  onCrouch?: (point: Point) => void
  /** Fired when the drag actually begins (a mouse move past threshold, or a move after a touch crouch). Dismiss the menu here. */
  onLift?: () => void
  /** Called after the drag ends (dropped or cancelled); use it to dispose a rendered ghost. */
  onEnd?: () => void
}

export type DropzoneOptions = {
  accepts: Accepts
  onDrop: OnDrop
}

export type DropzoneHandle = {
  /** True while a compatible drag hovers over this zone. */
  isOver: () => boolean
  destroy: () => void
}

export type GoontehConfig = {
  /** Pixels the pointer must travel before a MOUSE drag starts. Default 5. */
  threshold?: number
  /**
   * Touch/pen: press-and-hold this long (ms) without moving before a drag begins — so a quick swipe stays
   * a scroll and only a deliberate hold picks the item up. Set 0 to drag immediately on the `threshold` move
   * (the old behaviour; note that also means the element can't be scroll-started by touch). Default 250.
   */
  holdDelay?: number
  /** Body cursor while dragging. Default 'grabbing'. */
  cursor?: string
  /** Ghost translate offset in percent of its own size. Default { x: -40, y: -60 }. */
  ghostOffset?: { x: number; y: number }
}

export type GoontehCore = {
  draggable(el: HTMLElement, opts: DraggableOptions): () => void
  dropzone(el: HTMLElement, opts: DropzoneOptions): DropzoneHandle
  dragging: () => boolean
  /** The active drag's descriptor (kind + payload) while dragging, else undefined. */
  active: () => { kind: string; payload: unknown } | undefined
  /** The live pointer position while dragging, else undefined. Lets zones compute sub-position (e.g. a
   *  card's centre vs edge) to show reorder-vs-combine affordances during hover. */
  point: () => Point | undefined
  /** The element of the innermost accepting drop target under the pointer, else undefined. Lets a consumer
   *  that renders its own preview know whether a nested zone is capturing (and step aside for it). */
  overEl: () => HTMLElement | undefined
  /** Subscribe to state changes (drag start/move/zone change/end). Returns an unsubscribe. */
  onChange(fn: () => void): () => void
  destroy(): void
}

type Active = { payload: unknown; kind: string; ghost: HTMLElement | undefined; unlift?: () => void; onEnd?: () => void }

/** The style override each lift mode applies to the source while it is dragged (data, not branches). */
const LIFT_STYLE: Record<NonNullable<DraggableOptions['lift']>, { prop: 'visibility' | 'display'; value: string }> = {
  hole: { prop: 'visibility', value: 'hidden' },
  collapse: { prop: 'display', value: 'none' },
}

/** Apply a lift to the source, returning a thunk that restores the prior style (or undefined = no lift). */
const applyLift = (el: HTMLElement, mode: DraggableOptions['lift']): (() => void) | undefined => {
  if (!mode) return undefined
  const { prop, value } = LIFT_STYLE[mode]
  const prev = el.style[prop]
  el.style[prop] = value
  return () => {
    el.style[prop] = prev
  }
}

/** Create an engine instance. One per drag context (e.g. one per app). */
export function createGoontehCore(config: GoontehConfig = {}): GoontehCore {
  const threshold = config.threshold ?? 5
  const holdDelay = config.holdDelay ?? 250
  const cursor = config.cursor ?? 'grabbing'
  const offset = config.ghostOffset ?? { x: -40, y: -60 }

  let active: Active | undefined
  let activePointerId: number | undefined
  let captureEl: HTMLElement | undefined
  let taEl: HTMLElement | undefined
  let taPrev = ''
  let prevCursor = ''
  let prevUserSelect = ''
  let armedCleanup: (() => void) | undefined
  let px = 0
  let py = 0
  let overId: number | undefined
  const zones = new Map<number, { el: HTMLElement } & DropzoneOptions>()
  const draggableCleanups = new Set<() => void>()
  let nextId = 1
  const subs = new Set<() => void>()
  const notify = () => subs.forEach((f) => f())

  const rectHit = (el: HTMLElement, x: number, y: number): boolean => {
    const r = el.getBoundingClientRect()
    return x >= r.left && x < r.right && y >= r.top && y < r.bottom
  }

  /**
   * The innermost registered zone that ACCEPTS the active drag and whose rect contains the pointer.
   * Resolved by geometry + DOM nesting rather than paint order (elementFromPoint), so a zone stays
   * reachable even when a decorative overlay or a sibling is painted on top of it, and accept-aware so
   * a rejecting child yields to an accepting ancestor.
   */
  const zoneAt = (x: number, y: number): { id: number; zone: DropzoneOptions } | undefined => {
    if (!active) return undefined
    const hits: { id: number; zone: { el: HTMLElement } & DropzoneOptions }[] = []
    for (const [id, z] of zones) if (z.accepts(active.kind, active.payload) && rectHit(z.el, x, y)) hits.push({ id, zone: z })
    return hits.find((h) => !hits.some((o) => o !== h && h.zone.el.contains(o.zone.el))) ?? hits[hits.length - 1]
  }

  const positionGhost = () => {
    if (!active?.ghost) return
    active.ghost.style.left = `${px}px`
    active.ghost.style.top = `${py}px`
  }

  const onMove = (e: PointerEvent) => {
    if (!active || e.pointerId !== activePointerId) return // only the finger that started this drag
    e.preventDefault()
    px = e.clientX
    py = e.clientY
    positionGhost()
    overId = zoneAt(px, py)?.id
    notify()
  }
  const onUp = (e: PointerEvent) => {
    if (!active || e.pointerId !== activePointerId) return
    const hit = zoneAt(e.clientX, e.clientY)
    // Always tear down, even if the drop callback throws — no leaked ghost / listeners / cursor / lift.
    try {
      if (hit) hit.zone.onDrop(active.payload, active.kind, { x: e.clientX, y: e.clientY })
    } finally {
      end()
    }
  }
  const onCancel = (e: PointerEvent) => {
    if (active && e.pointerId === activePointerId) end()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') end()
  }

  const listen = () => {
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
  }
  const unlisten = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey)
  }

  function end() {
    if (!active) return
    const a = active
    const id = activePointerId
    const capEl = captureEl
    active = undefined
    activePointerId = undefined
    captureEl = undefined
    overId = undefined
    unlisten()
    if (capEl && id !== undefined) {
      try {
        capEl.releasePointerCapture(id)
      } catch {
        // already auto-released on pointerup/cancel, or the source was detached — fine
      }
    }
    // Restore the body's prior inline styles rather than blanking them (don't clobber the app's).
    document.body.style.cursor = prevCursor
    document.body.style.userSelect = prevUserSelect
    if (taEl) taEl.style.touchAction = taPrev
    taEl = undefined
    if (a.ghost) a.ghost.remove()
    a.unlift?.()
    a.onEnd?.()
    notify()
  }

  const begin = (el: HTMLElement, opts: DraggableOptions, pointerId: number, x: number, y: number) => {
    opts.onLift?.() // the drag is starting — dismiss any crouch-shown menu
    px = x
    py = y
    overId = undefined
    activePointerId = pointerId
    const ghost = opts.ghost?.()
    active = { payload: opts.payload(), kind: opts.kind, ghost, unlift: applyLift(el, opts.lift), onEnd: opts.onEnd }
    if (ghost) {
      ghost.style.position = 'fixed'
      ghost.style.pointerEvents = 'none'
      ghost.style.zIndex = '9999'
      ghost.style.transform = `translate(${offset.x}%, ${offset.y}%)`
      positionGhost()
      document.body.appendChild(ghost)
    }
    prevCursor = document.body.style.cursor
    prevUserSelect = document.body.style.userSelect
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'
    // Block the browser's own touch scroll/pan for the duration of THIS drag only (not at rest), so a plain
    // touch on the element can still scroll until a drag actually begins.
    taEl = el
    taPrev = el.style.touchAction
    el.style.touchAction = 'none'
    // Capture keeps pointer events flowing even if the finger leaves the element / viewport / an iframe.
    try {
      el.setPointerCapture(pointerId)
      captureEl = el
    } catch {
      captureEl = undefined
    }
    listen()
    notify()
  }

  return {
    draggable(el, opts) {
      el.setAttribute('data-goonteh-grab', '')
      const down = (e: PointerEvent) => {
        if (opts.disabled?.()) return
        if (!e.isPrimary) return // ignore secondary touches of a multi-touch gesture
        if (e.pointerType === 'mouse' && e.button !== 0) return
        if (active) return // a drag is already in flight
        const target = e.target as Element | null
        if (target && target.closest('[data-goonteh-nodrag]')) return // opt-out zones (e.g. resize handles) never start a drag
        if (target && target.closest('[data-goonteh-grab]') !== el) return // nested grabs: innermost wins
        const id = e.pointerId
        const sx = e.clientX
        const sy = e.clientY
        // Mouse drags on movement (fast). Touch/pen hold-to-drag: press still for `holdDelay`, so a quick
        // swipe scrolls and only a deliberate hold engages (holdDelay 0 falls back to move-to-drag).
        const holdToDrag = e.pointerType !== 'mouse' && holdDelay > 0
        // While holding, allow this much jitter without cancelling (a finger is never perfectly still).
        const holdTolerance = Math.max(threshold, 10)
        let holdTimer: ReturnType<typeof setTimeout> | undefined
        let crouched = false // touch: held long enough that onCrouch fired; the next move lifts (drags)
        const disarm = () => {
          if (holdTimer) clearTimeout(holdTimer)
          holdTimer = undefined
          armedCleanup = undefined
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', stop)
          window.removeEventListener('pointercancel', stop)
        }
        // We never preventDefault while arming, so touch scrolling is free until a drag actually begins.
        const move = (ev: PointerEvent) => {
          if (ev.pointerId !== id) return // only the finger that pressed down here
          const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy)
          if (crouched) {
            if (dist < threshold) return // a still crouch — waiting for a real move (or a release)
            ev.preventDefault() // from the crouch a move drags, never scrolls — hold this first frame before onMove takes over
            disarm()
            begin(el, opts, id, ev.clientX, ev.clientY) // crouched, then moved → lift
            return
          }
          if (holdToDrag) {
            if (dist >= holdTolerance) disarm() // moved before the hold engaged → it's a scroll; let it go
            return
          }
          if (dist < threshold) return
          disarm()
          begin(el, opts, id, ev.clientX, ev.clientY)
        }
        const stop = (ev: PointerEvent) => {
          if (ev.pointerId === id) disarm() // released or cancelled before the drag began (a crouch's menu stays)
        }
        armedCleanup = disarm
        if (holdToDrag) {
          holdTimer = setTimeout(() => {
            holdTimer = undefined
            if (opts.onCrouch) {
              // Crouch: the weight is taken but nothing is lifted, making room for the menu. A move from
              // here lifts (drags), a release keeps the menu. Only when there's a menu to show.
              crouched = true
              opts.onCrouch({ x: sx, y: sy })
            } else {
              // Nothing to make room for → the hold lifts straight away (it pops up in your hand).
              disarm()
              begin(el, opts, id, sx, sy)
            }
          }, holdDelay)
        }
        window.addEventListener('pointermove', move, { passive: false })
        window.addEventListener('pointerup', stop)
        window.addEventListener('pointercancel', stop)
      }
      el.addEventListener('pointerdown', down)
      const cleanup = () => {
        el.removeEventListener('pointerdown', down)
        el.removeAttribute('data-goonteh-grab')
        draggableCleanups.delete(cleanup)
      }
      draggableCleanups.add(cleanup)
      return cleanup
    },
    dropzone(el, opts) {
      const id = nextId++
      zones.set(id, { el, accepts: opts.accepts, onDrop: opts.onDrop })
      return {
        isOver: () => overId === id,
        destroy: () => {
          zones.delete(id)
        },
      }
    },
    dragging: () => active !== undefined,
    active: () => (active ? { kind: active.kind, payload: active.payload } : undefined),
    point: () => (active ? { x: px, y: py } : undefined),
    overEl: () => (overId === undefined ? undefined : zones.get(overId)?.el),
    onChange: (fn) => {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
    destroy: () => {
      armedCleanup?.() // a drag that was arming but not yet begun
      end()
      ;[...draggableCleanups].forEach((c) => c()) // remove every registered pointerdown listener
      subs.clear()
      zones.clear()
    },
  }
}
