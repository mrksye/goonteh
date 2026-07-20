# goonteh examples 🧤

Copy-paste recipes. Everything is the same four moves: **`Grab`** a thing, **`Lift`** it (leave a hole or
collapse the gap), **`Drop`** it — the engine owns the pointer, the ghost, and the cursor; you own the model
(reorder, combine, decode). Nothing reflows mid-drag; you rearrange on drop.

- [Grab & Drop — the basics](#basics)
- [Lift — pick it up for real](#lift)
- [Crouch — long-press a menu, then drag](#crouch)
- [Hold-to-drag & scroll on touch](#touch)
- [Live drag — reorder vs combine](#live)
- [Drag handles & opt-out zones](#opt-out)
- [Typed payloads — decode at the drop](#payloads)
- [Adapters](#adapters) — core / native · Solid · React · Vue · Svelte · React Native
- [CDN / plain HTML](#cdn)

---

## Basics

One engine, a source, a target. The target's `accepts(kind)` filters what it takes; the innermost accepting
zone wins.

```ts
import { goonteh } from 'goonteh/native'

const gloves = goonteh()
gloves.grab(card, { kind: 'card', payload: { id: 'a1' }, ghost: 'clone' })
gloves.drop(lane, {
  accepts: (kind) => kind === 'card',
  onDrop: (payload, kind, point) => console.log('dropped', payload, 'at', point),
})
```

## Lift

`lift` makes the source look genuinely picked up while you drag:

- `'hole'` — hidden in place (`visibility:hidden`); the box keeps its space, so **no reflow**. Recommended.
- `'collapse'` — removed from layout (`display:none`); siblings **close the gap**.
- omit — the source stays fully visible (a copy-style drag, e.g. dragging out of a palette).

```tsx
<Grab kind="card" payload={id} lift="hole" ghost={() => <Preview id={id} />}>
  <Card />
</Grab>
```

## Crouch

A touch hold-to-drag would swallow the platform's own long-press menu. So when a `Grab` has a menu to show,
a hold first **crouches** — at `holdDelay` the weight is taken but nothing is lifted. That's your cue to pop a
context menu (exactly like long-pressing an app icon). From there a **move** lifts (drag begins, `onLift`
fires — dismiss the menu); a **release** keeps the menu up.

```ts
gloves.grab(clip, {
  kind: 'clip',
  payload: id,
  lift: 'hole',
  ghost: 'clone',
  onCrouch: (point) => openMenu(point.x, point.y), // long-press → menu
  onLift: () => closeMenu(),                        // then a move drags → dismiss it
})
```

The same long-press means *open the menu* or *pick it up*, decided by whether you then move. Crouching exists
**only** to make room for that menu — omit `onCrouch` and there's no crouch: the hold lifts straight away (it
pops up in your hand), the plain hold-to-drag. You don't pause for a menu that isn't there.

A generic "reveal whatever context menu wraps me" `onCrouch` is just a synthetic `contextmenu`:

```ts
onCrouch: (p) => document.elementFromPoint(p.x, p.y)?.dispatchEvent(
  new MouseEvent('contextmenu', { bubbles: true, clientX: p.x, clientY: p.y }),
),
onLift: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
```

## Touch

A **mouse** drag begins as soon as the pointer crosses a ~5px threshold, so a plain click still reaches the
child. On **touch/pen** it's hold-to-drag: press and hold still for `holdDelay` (default 250 ms) — a quick
swipe stays a **scroll**, only a deliberate hold picks up. `touch-action` is left alone at rest and set to
`none` only during an active drag, so the element scrolls normally until then.

```ts
goonteh({ threshold: 8, holdDelay: 300 }) // px to start a mouse drag · ms to hold on touch
goonteh({ holdDelay: 0 })                 // opt out: move-to-drag immediately on touch too
```

## Live

Read the live drag to preview reorder-vs-combine yourself — goonteh never reorders for you:

```ts
const gloves = goonteh()
gloves.onChange(() => {
  const a = gloves.active() // { kind, payload } | undefined
  const p = gloves.point()  // { x, y } | undefined
  if (a && p) previewDropAt(a, p)
})
```

In a framework, the same state is a hook: `useGoonteh()` (Solid/React/Vue) or the `drag` store (Svelte).

## Opt-out

A pointerdown inside a `data-goonteh-nodrag` element never starts a drag — use it for resize handles, inline
buttons, or a link inside a draggable card:

```html
<div> <!-- draggable card -->
  <button data-goonteh-nodrag>⋯</button> <!-- clicking this never drags the card -->
</div>
```

For a **drag handle** (only one grip starts the drag), put the `Grab` on the handle and the content outside it,
or mark everything but the handle `data-goonteh-nodrag`. Nested grabs resolve innermost-wins.

## Payloads

`payload` is `unknown` on purpose — goonteh picks no error model. **Decode at the drop boundary** instead of
asserting:

```ts
gloves.drop(lane, {
  accepts: (kind) => kind === 'card',
  onDrop: (payload) => {
    const parsed = CardId.safeParse(payload) // zod / valibot / a plain guard / Effect Schema
    if (parsed.success) moveCard(parsed.data)
  },
})
```

## Adapters

### core / native

```ts
import { goonteh } from 'goonteh/native'
const gloves = goonteh()
const ungrab = gloves.grab(el, { kind: 'card', payload: id, ghost: 'clone' })
const zone = gloves.drop(lane, { accepts: (k) => k === 'card', onDrop: (p) => move(p) })
// later: ungrab(); zone.destroy(); gloves.destroy()
```

`ghost` takes a factory, an HTML string, or `'clone'` (clone the dragged element).

### Solid

```tsx
import { GoontehProvider, Grab, Drop, useGoonteh } from 'goonteh/solid'

<GoontehProvider>
  <Grab kind="card" payload={id} lift="hole" ghost={() => <Preview id={id} />}>
    <Card />
  </Grab>
  <Drop accepts={(k) => k === 'card'} onDrop={(p) => move(p)} activeClass="ring-2">
    drop here
  </Drop>
</GoontehProvider>
```

### React

```tsx
import { GoontehProvider, Grab, Drop, useGoonteh } from 'goonteh/react'

<GoontehProvider>
  <Grab kind="card" payload={id} lift="hole" ghost={() => <Preview id={id} />}>
    <Card />
  </Grab>
  <Drop accepts={(k) => k === 'card'} onDrop={(p) => move(p)} activeClass="ring-2">
    drop here
  </Drop>
</GoontehProvider>
```

### Vue

```vue
<script setup>
import { GoontehProvider, Grab, Drop } from 'goonteh/vue'
</script>
<template>
  <GoontehProvider>
    <Grab kind="card" :payload="id" lift="hole" :ghost="() => h(Preview, { id })">
      <Card />
    </Grab>
    <Drop :accepts="(k) => k === 'card'" :on-drop="(p) => move(p)" active-class="ring-2">drop here</Drop>
  </GoontehProvider>
</template>
```

### Svelte

The engine is created once and handed out as `grab` / `drop` **actions** plus a `drag` **store**:

```svelte
<script>
  import { createGoonteh } from 'goonteh/svelte'
  const { grab, drop, drag } = createGoonteh()
</script>

<div use:grab={{ kind: 'card', payload: id, ghost: makeGhost, lift: 'hole', onCrouch: openMenu, onLift: closeMenu }}>…</div>
<div use:drop={{ accepts: (k) => k === 'card', onDrop: move, activeClass: 'ring-2' }}>drop here</div>
{#if $drag.dragging}dragging {$drag.active?.kind}{/if}
```

### React Native (experimental)

No DOM, so its own `PanResponder` engine — touch only, and outside the web-core guarantees (no crouch). Same
`<GoontehProvider>` / `<Grab>` / `<Drop>` shape; the provider also renders the ghost overlay.

```tsx
import { GoontehProvider, Grab, Drop } from 'goonteh/react-native'

<GoontehProvider>
  <Grab kind="card" payload={id} ghost={() => <Preview id={id} />}><Card /></Grab>
  <Drop accepts={(k) => k === 'card'} onDrop={(p) => move(p)}><Lane /></Drop>
</GoontehProvider>
```

## CDN

Zero-dep and framework-free, so one `<script>` grips anywhere — even a Google Apps Script `HtmlService`
iframe with no bundler:

```html
<script src="https://unpkg.com/goonteh@1.0.3"></script>
<script>
  const gloves = goonteh()
  gloves.grab(document.getElementById('card'), { kind: 'card', payload: { id: 'a1' } })
  gloves.drop(document.getElementById('lane'), {
    accepts: (kind) => kind === 'card',
    onDrop: (payload) => console.log('dropped', payload),
  })
</script>
```
