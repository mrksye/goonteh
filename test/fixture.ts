// Test fixture: wire the native adapter to a couple of elements and expose enough state on `window`
// for Playwright to assert against. Browser behaviour is goonteh's real surface, so the specs drive
// synthetic PointerEvents (with controlled pointerId / isPrimary) at this page and read the results.
import { goonteh } from '../native'

type Win = typeof window & {
  __g: ReturnType<typeof goonteh>
  __drops: { payload: unknown; kind: string }[]
  __throwNext: boolean
  __unmountSrc: () => void
  __activeKind: () => string | undefined
}
const w = window as Win

// holdDelay: 0 keeps these mechanics specs move-to-drag on touch (pointer tracking, cancel, teardown,
// nesting are independent of the hold gate); touch hold-to-drag + crouch is pinned in hold.spec.ts.
const g = goonteh({ holdDelay: 0 })
w.__g = g
w.__drops = []
w.__throwNext = false

const el = (id: string) => document.getElementById(id) as HTMLElement

g.grab(el('src'), { kind: 'card', payload: { id: 'a1' } })

g.drop(el('zone'), {
  accepts: (k) => k === 'card',
  onDrop: (payload, kind) => {
    if (w.__throwNext) {
      w.__throwNext = false
      throw new Error('boom') // the engine must still tear down cleanly
    }
    w.__drops.push({ payload, kind })
  },
})

// Nested grabs: pressing on the inner one should win over the outer one.
g.grab(el('outer'), { kind: 'outer', payload: { which: 'outer' } })
g.grab(el('inner'), { kind: 'inner', payload: { which: 'inner' } })

w.__activeKind = () => g.active()?.kind
w.__unmountSrc = () => el('src').remove()
