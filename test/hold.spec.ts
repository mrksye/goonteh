import { test, expect, type Page } from '@playwright/test'

// The touch pickup model (default holdDelay): a mouse drags on movement (fast); touch/pen is hold-to-drag
// with an intermediate crouch — a still hold fires onCrouch, a move from there lifts, a release keeps the
// menu. Synthetic PointerEvents are driven at /test/hold.html; window.__log records crouch/lift/end.
const SRC = { x: 50, y: 50 }
const FAR = { x: 300, y: 300 }
const HOLD = 250 // core default holdDelay

async function pe(page: Page, type: string, x: number, y: number, pointerType: 'mouse' | 'touch', onElement = false) {
  await page.evaluate(
    ({ type, x, y, pointerType, onElement }) => {
      const init: PointerEventInit = { pointerId: 7, isPrimary: true, clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, pointerType }
      const target: EventTarget = onElement ? (document.elementFromPoint(x, y) ?? window) : window
      target.dispatchEvent(new PointerEvent(type, init))
    },
    { type, x, y, pointerType, onElement },
  )
}
const down = (page: Page, pt: 'mouse' | 'touch', p = SRC) => pe(page, 'pointerdown', p.x, p.y, pt, true)
const move = (page: Page, pt: 'mouse' | 'touch', p: { x: number; y: number }) => pe(page, 'pointermove', p.x, p.y, pt)
const up = (page: Page, pt: 'mouse' | 'touch', p: { x: number; y: number }) => pe(page, 'pointerup', p.x, p.y, pt)

const bind = (page: Page, withCrouch: boolean, config?: Record<string, unknown>) =>
  page.evaluate(({ withCrouch, config }) => (window as unknown as { __bind: (c: boolean, cfg?: unknown) => void }).__bind(withCrouch, config), { withCrouch, config })
const events = (page: Page) => page.evaluate(() => (window as unknown as { __log: { e: string }[] }).__log.map((l) => l.e))
const log = (page: Page) => page.evaluate(() => (window as unknown as { __log: { e: string; x?: number; y?: number }[] }).__log)
const dragging = (page: Page) => page.evaluate(() => (window as unknown as { __dragging: () => boolean }).__dragging())
// A full-viewport zone drops on every release; the pickup sequence itself cares only about crouch/lift/end.
const flow = async (page: Page) => (await events(page)).filter((e) => e !== 'drop')

test.beforeEach(async ({ page }) => {
  await page.goto('/test/hold.html')
  await page.waitForFunction(() => typeof (window as unknown as { __bind?: unknown }).__bind === 'function')
})

test('mouse: a move past the threshold lifts immediately', async ({ page }) => {
  await bind(page, false)
  await down(page, 'mouse')
  await move(page, 'mouse', FAR)
  await up(page, 'mouse', FAR)
  expect(await flow(page)).toEqual(['lift', 'end'])
})

test('mouse: a still hold never crouches or lifts', async ({ page }) => {
  await bind(page, true)
  await down(page, 'mouse')
  await page.waitForTimeout(HOLD + 120)
  await up(page, 'mouse', SRC)
  expect(await events(page)).toEqual([])
})

test('touch: a quick swipe stays a scroll (no crouch, no lift)', async ({ page }) => {
  await bind(page, true)
  await down(page, 'touch')
  await move(page, 'touch', { x: 220, y: 50 }) // moved before the hold → scroll
  await up(page, 'touch', { x: 220, y: 50 })
  expect(await events(page)).toEqual([])
})

test('touch: a still hold crouches (menu point), nothing lifted yet', async ({ page }) => {
  await bind(page, true)
  await down(page, 'touch')
  await page.waitForTimeout(HOLD + 100)
  expect(await events(page)).toEqual(['crouch'])
  expect((await log(page))[0]).toMatchObject({ e: 'crouch', x: SRC.x, y: SRC.y })
  expect(await dragging(page)).toBe(false)
})

test('touch: a move from the crouch lifts (drag begins), then ends', async ({ page }) => {
  await bind(page, true)
  await down(page, 'touch')
  await page.waitForTimeout(HOLD + 100)
  await move(page, 'touch', FAR)
  await up(page, 'touch', FAR)
  expect(await flow(page)).toEqual(['crouch', 'lift', 'end'])
})

test('touch: a release from the crouch keeps the menu (no lift, no drag)', async ({ page }) => {
  await bind(page, true)
  await down(page, 'touch')
  await page.waitForTimeout(HOLD + 100)
  await up(page, 'touch', SRC)
  expect(await events(page)).toEqual(['crouch'])
  expect(await dragging(page)).toBe(false)
})

test('touch: no onCrouch → the hold lifts straight away (no crouch)', async ({ page }) => {
  await bind(page, false)
  await down(page, 'touch')
  await page.waitForTimeout(HOLD + 100)
  expect(await events(page)).toEqual(['lift'])
  expect(await dragging(page)).toBe(true)
  await move(page, 'touch', FAR)
  await up(page, 'touch', FAR)
  expect(await flow(page)).toEqual(['lift', 'end'])
})

test('touch: holdDelay 0 → move-to-drag, no crouch', async ({ page }) => {
  await bind(page, true, { holdDelay: 0 })
  await down(page, 'touch')
  await move(page, 'touch', FAR)
  await up(page, 'touch', FAR)
  expect(await flow(page)).toEqual(['lift', 'end'])
})
