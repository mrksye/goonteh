import { computed, defineComponent, h, inject, onBeforeUnmount, onMounted, provide, ref, render, type ComputedRef, type PropType, type VNode } from 'vue'
import { createGoontehCore, type DropzoneHandle, type GoontehConfig, type GoontehCore, type Point } from './core'

/**
 * goonteh — Vue 3 adapter.
 *
 * Thin Vue bindings over the framework-agnostic core (`./core`): a provider that owns one engine,
 * `Grab` for draggable sources, and `Drop` for targets. `vue` is an optional peer dependency.
 */
type Ctx = { core: GoontehCore; version: { value: number } }
const KEY = Symbol('goonteh')

/** Root provider. Create it once, above every `Grab`/`Drop`. */
export const GoontehProvider = defineComponent({
  name: 'GoontehProvider',
  props: { config: { type: Object as PropType<GoontehConfig>, default: undefined } },
  setup(props, { slots }) {
    const core = createGoontehCore(props.config)
    const version = ref(0)
    const unsub = core.onChange(() => {
      version.value++
    })
    provide<Ctx>(KEY, { core, version })
    onBeforeUnmount(() => {
      unsub()
      core.destroy()
    })
    return () => slots.default?.()
  },
})

function useCtx(): Ctx {
  const c = inject<Ctx>(KEY)
  if (!c) throw new Error('goonteh: <GoontehProvider> is required higher in the tree')
  return c
}

export type ActiveDrag = { kind: string; payload: unknown } | undefined

/**
 * Live drag state as computed refs (recompute when the provider bumps `version`). Read `active` for
 * what is being dragged and `point` for where — e.g. to show a reorder-vs-combine affordance.
 */
export function useGoonteh(): {
  dragging: ComputedRef<boolean>
  active: ComputedRef<ActiveDrag>
  point: ComputedRef<Point | undefined>
} {
  const { core, version } = useCtx()
  const track = <T>(read: () => T): ComputedRef<T> =>
    computed(() => {
      void version.value
      return read()
    })
  return { dragging: track(core.dragging), active: track(core.active), point: track(core.point) }
}

/** A draggable source. `ghost` returns a VNode, rendered into a detached element at grab time. */
export const Grab = defineComponent({
  name: 'GoontehGrab',
  props: {
    payload: { type: null as unknown as PropType<unknown>, default: undefined },
    kind: { type: String, required: true },
    ghost: { type: Function as PropType<() => VNode>, required: true },
    disabled: { type: Boolean, default: false },
    /** 'hole' (blank gap, no reflow) or 'collapse' (siblings close up); omit to leave in place. */
    lift: { type: String as PropType<'hole' | 'collapse'>, default: undefined },
    /** Touch: a still hold has crouched at this point (pop a context menu here). Move → drag; release → menu stays. */
    onCrouch: { type: Function as PropType<(point: Point) => void>, default: undefined },
    /** The drag began (mouse move, or a move after a touch crouch) — dismiss the menu here. */
    onLift: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props, { slots }) {
    const { core } = useCtx()
    const el = ref<HTMLElement>()
    let cleanup: (() => void) | undefined
    onMounted(() => {
      if (!el.value) return
      let ghostEl: HTMLElement | undefined
      cleanup = core.draggable(el.value, {
        payload: () => props.payload,
        kind: props.kind,
        disabled: () => props.disabled,
        lift: props.lift,
        onCrouch: props.onCrouch ? (point) => props.onCrouch!(point) : undefined,
        onLift: () => props.onLift?.(),
        ghost: () => {
          const container = document.createElement('div')
          render(props.ghost(), container)
          ghostEl = container
          return container
        },
        onEnd: () => {
          if (ghostEl) {
            render(null, ghostEl)
            ghostEl = undefined
          }
        },
      })
    })
    onBeforeUnmount(() => cleanup?.())
    return () => h('div', { ref: el }, slots.default?.())
  },
})

/** A drop target. `activeClass` is applied while a compatible drag hovers over it. */
export const Drop = defineComponent({
  name: 'GoontehDrop',
  props: {
    accepts: { type: Function as PropType<(kind: string, payload: unknown) => boolean>, required: true },
    onDrop: { type: Function as PropType<(payload: unknown, kind: string, point: Point) => void>, required: true },
    activeClass: { type: String, default: '' },
  },
  setup(props, { slots }) {
    const { core, version } = useCtx()
    const el = ref<HTMLElement>()
    const handle = ref<DropzoneHandle>()
    onMounted(() => {
      if (!el.value) return
      handle.value = core.dropzone(el.value, {
        accepts: (k, p) => props.accepts(k, p),
        onDrop: (p, k, pt) => props.onDrop(p, k, pt),
      })
    })
    onBeforeUnmount(() => handle.value?.destroy())
    return () => {
      void version.value
      const over = handle.value?.isOver() ?? false
      return h('div', { ref: el, class: over ? props.activeClass : '' }, slots.default?.())
    }
  },
})
