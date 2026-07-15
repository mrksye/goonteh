import { test, expect, type Page } from '@playwright/test'

// goonteh's real surface is browser behaviour, so we drive synthetic PointerEvents with controlled
// pointerId / isPrimary at the fixture and assert on the results. pointerdown lands on the element
// under the point; move/up/cancel go to window (that's where a live drag listens).
const SRC = { x: 100, y: 70 }
const ZONE = { x: 400, y: 110 }
const INNER = { x: 285, y: 315 }

async function pe(page: Page, type: string, x: number, y: number, o: { id?: number; primary?: boolean; onElement?: boolean } = {}) {
  await page.evaluate(
    ({ type, x, y, id, primary, onElement }) => {
      const init: PointerEventInit = { pointerId: id, isPrimary: primary, clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, pointerType: 'touch' }
      const target: EventTarget = onElement ? (document.elementFromPoint(x, y) ?? window) : window
      target.dispatchEvent(new PointerEvent(type, init))
    },
    { type, x, y, id: o.id ?? 1, primary: o.primary ?? true, onElement: o.onElement ?? false },
  )
}
const down = (page: Page, p: { x: number; y: number }, o = {}) => pe(page, 'pointerdown', p.x, p.y, { onElement: true, ...o })
const move = (page: Page, p: { x: number; y: number }, o = {}) => pe(page, 'pointermove', p.x, p.y, o)
const up = (page: Page, p: { x: number; y: number }, o = {}) => pe(page, 'pointerup', p.x, p.y, o)
const cancel = (page: Page, o = {}) => pe(page, 'pointercancel', 0, 0, o)
const drops = (page: Page) => page.evaluate(() => (window as unknown as { __drops: unknown[] }).__drops)
const dragging = (page: Page) => page.evaluate(() => (window as unknown as { __g: { dragging(): boolean } }).__g.dragging())

test.beforeEach(async ({ page }) => {
  await page.goto('/test/fixture.html')
  await page.waitForSelector('#src')
})

// grab → past the threshold → over the zone → release.
async function fullDrag(page: Page, o = {}) {
  await down(page, SRC, o)
  await move(page, { x: SRC.x + 10, y: SRC.y }, o) // > 5px threshold → begin
  await move(page, ZONE, o)
  await up(page, ZONE, o)
}

test('basic drag drops the payload on the zone', async ({ page }) => {
  await fullDrag(page)
  expect(await drops(page)).toEqual([{ payload: { id: 'a1' }, kind: 'card' }])
  expect(await dragging(page)).toBe(false)
})

test('Escape cancels — no drop, drag ends', async ({ page }) => {
  await down(page, SRC)
  await move(page, { x: SRC.x + 10, y: SRC.y })
  expect(await dragging(page)).toBe(true)
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  expect(await dragging(page)).toBe(false)
  await up(page, ZONE) // released over the zone, but the drag is already over
  expect(await drops(page)).toEqual([])
})

test('pointercancel during a live drag ends it with no drop', async ({ page }) => {
  await down(page, SRC)
  await move(page, { x: SRC.x + 10, y: SRC.y })
  expect(await dragging(page)).toBe(true)
  await cancel(page)
  expect(await dragging(page)).toBe(false)
  await up(page, ZONE)
  expect(await drops(page)).toEqual([])
})

test('pointercancel while still armed (before the threshold) prevents the drag', async ({ page }) => {
  await down(page, SRC)
  await cancel(page) // cancelled before crossing the threshold
  await move(page, { x: SRC.x + 40, y: SRC.y }) // would have begun, but we disarmed
  expect(await dragging(page)).toBe(false)
  await up(page, ZONE)
  expect(await drops(page)).toEqual([])
})

test('a throwing drop callback still tears down cleanly, and dragging recovers', async ({ page }) => {
  await page.evaluate(() => ((window as unknown as { __throwNext: boolean }).__throwNext = true))
  await fullDrag(page) // onDrop throws
  expect(await dragging(page)).toBe(false) // end() still ran (the try/finally)
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('*')].filter((e) => e.style.zIndex === '9999').length)).toBe(0) // no leaked ghost
  expect(await page.evaluate(() => document.body.style.cursor)).toBe('') // styles restored
  await fullDrag(page) // the very next drag works → listeners weren't leaked
  expect(await drops(page)).toEqual([{ payload: { id: 'a1' }, kind: 'card' }])
})

test('secondary pointers are ignored during a primary drag', async ({ page }) => {
  await down(page, SRC, { id: 1, primary: true })
  await move(page, { x: SRC.x + 10, y: SRC.y }, { id: 2, primary: false }) // other finger — ignored
  expect(await dragging(page)).toBe(false)
  await move(page, { x: SRC.x + 10, y: SRC.y }, { id: 1 }) // our finger → begin
  expect(await dragging(page)).toBe(true)
  await move(page, ZONE, { id: 1 })
  await up(page, ZONE, { id: 2 }) // other finger's release — ignored
  expect(await dragging(page)).toBe(true)
  await up(page, ZONE, { id: 1 }) // our finger → drop
  expect(await drops(page)).toEqual([{ payload: { id: 'a1' }, kind: 'card' }])
})

test('a secondary (non-primary) pointerdown does not start a drag', async ({ page }) => {
  await down(page, SRC, { id: 3, primary: false })
  await move(page, { x: SRC.x + 20, y: SRC.y }, { id: 3 })
  expect(await dragging(page)).toBe(false)
})

test('destroy() removes the pointerdown listeners — no drag afterwards', async ({ page }) => {
  await page.evaluate(() => (window as unknown as { __g: { destroy(): void } }).__g.destroy())
  await down(page, SRC)
  await move(page, { x: SRC.x + 20, y: SRC.y })
  expect(await dragging(page)).toBe(false)
  await up(page, ZONE)
  expect(await drops(page)).toEqual([])
})

test('the drag survives the source unmounting mid-flight', async ({ page }) => {
  await down(page, SRC)
  await move(page, { x: SRC.x + 10, y: SRC.y })
  await page.evaluate(() => (window as unknown as { __unmountSrc: () => void }).__unmountSrc())
  await move(page, ZONE)
  await up(page, ZONE)
  expect(await drops(page)).toEqual([{ payload: { id: 'a1' }, kind: 'card' }])
  expect(await dragging(page)).toBe(false)
})

test('teardown restores the body cursor to its prior value', async ({ page }) => {
  await page.evaluate(() => (document.body.style.cursor = 'crosshair'))
  await fullDrag(page)
  expect(await page.evaluate(() => document.body.style.cursor)).toBe('crosshair')
})

test('nested grabs: the innermost wins', async ({ page }) => {
  await down(page, INNER)
  await move(page, { x: INNER.x + 10, y: INNER.y })
  expect(await page.evaluate(() => (window as unknown as { __activeKind: () => string | undefined }).__activeKind())).toBe('inner')
  await up(page, INNER)
})

// The dist IIFE loaded via a plain <script> — the bundler-less / CDN / Google Apps Script path.
// (Requires `npm run build` first; the fixture loads /dist/goonteh.global.js.)
test('the IIFE global build drags and drops (paste/CDN/GAS path)', async ({ page }) => {
  await page.goto('/test/global.html')
  await page.waitForSelector('#src')
  expect(await page.evaluate(() => typeof (window as unknown as { goonteh: unknown }).goonteh)).toBe('function')
  await fullDrag(page)
  expect(await drops(page)).toEqual([{ payload: { id: 'a1' }, kind: 'card' }])
  expect(await dragging(page)).toBe(false)
})
