// Fixture for the touch pickup model (default holdDelay): hold-to-drag with an intermediate crouch.
// __bind(withCrouch, config?) (re)wires a grab on #src recording crouch/lift/end + a full-viewport drop;
// the spec drives synthetic pointer sequences and reads window.__log.
import { createGoontehCore, type GoontehConfig, type Point } from '../core'

type Rec = { e: string; x?: number; y?: number }
type Win = typeof window & {
  __log: Rec[]
  __bind: (withCrouch: boolean, config?: GoontehConfig) => void
  __dragging: () => boolean
  __destroy: () => void
}
const w = window as Win
const src = document.getElementById('src') as HTMLElement
const zone = document.getElementById('zone') as HTMLElement

let core: ReturnType<typeof createGoontehCore> | undefined
w.__log = []
w.__bind = (withCrouch, config) => {
  core?.destroy()
  core = createGoontehCore(config ?? {})
  w.__log = []
  core.draggable(src, {
    payload: () => 'x',
    kind: 'card',
    onCrouch: withCrouch ? (p: Point) => w.__log.push({ e: 'crouch', x: p.x, y: p.y }) : undefined,
    onLift: () => w.__log.push({ e: 'lift' }),
    onEnd: () => w.__log.push({ e: 'end' }),
  })
  core.dropzone(zone, { accepts: (k) => k === 'card', onDrop: () => w.__log.push({ e: 'drop' }) })
}
w.__dragging = () => !!core?.dragging()
w.__destroy = () => core?.destroy()
w.__bind(true)
