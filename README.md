# goonteh 🧤

Tiny **pointer-based** drag-and-drop that works on **touch** and never shows the **no-drop (🚫) cursor**.

Pronounced "goon-teh" — the name respells 軍手, Japanese for *work gloves*.

`goonteh` exists because the native HTML5 Drag and Drop API has two dealbreakers:

1. **It doesn't work on touch.** `draggable` / `dragstart` never fire on phones and tablets.
2. **Its cursor is not yours.** On some platforms (notably Chromium on Linux) the "no-drop" cursor sticks even over a valid drop target, and CSS can't override it.

Bare hands slip. Put a glove on. `goonteh` reimplements drag-and-drop on **pointer events**, so it works with mouse, touch, and pen alike, and the cursor and drop highlight are **fully controlled with CSS** — no forbidden cursor, ever.

goonteh was born while building a construction-site scheduling app, where dragging heavy machinery and resources needed to work reliably on Linux and touch devices.

- 🖐️ Mouse, touch & pen — one pointer-events path
- 🚫 No native no-drop (🚫) cursor — you own the look in CSS
- 📄 **No bundler needed** — one `<script>` tag, even inside a Google Apps Script `HtmlService` page
- 🕳️ **Lift** the source as you drag (leave a blank hole or collapse the gap) with a ghost that follows the pointer
- 🔎 **Read the live drag** (`active` / `point`) to build your own affordances — reorder vs. combine
- 🧩 **Framework-agnostic core** + thin adapters — zero deps beyond your framework

## A primitive, not a framework

goonteh isn't a drag-and-drop framework — it's a thin primitive for safely **gripping** things through Pointer Events, and nothing more.

If [dnd-kit](https://dndkit.com) is the general contractor that takes on the whole site — sortable models, collision detection, keyboard sensors, a full accessibility layer — goonteh is the pair of **work gloves** you're handed on that site: it protects your hands and lets you grip reliably. Tiny, and the one you reach for when all you want is *pick it up and put it down*. No sortable model, no collision strategy, no reorder baked in — you keep those; goonteh just does the gripping.

The four words are the whole surface. Each keeps its exact technical meaning, and each is a move you already know from the yard:

- **`GoontehProvider`** — the gloves are handed out (one drag context for your app)
- **`Grab`** — you grip a thing (a drag source)
- **`Lift`** — you pick it up (the source leaves a blank hole, or the gap collapses, as you carry it)
- **`Drop`** — you set it down (a drop target)

Gloves handed out, grab, lift, drop. That's all it does.

## Runs where a framework can't — Google Apps Script, plain HTML, CDN

Because it's tiny and framework-free, the core also ships as a single self-contained IIFE that puts a `goonteh` global on `window` — **no build step, no npm, no bundler**. One `<script>` and you're gripping:

```html
<script src="https://unpkg.com/goonteh"></script>
<script>
  const g = goonteh()
  g.grab(document.getElementById('card'), { kind: 'card', payload: { id: 'a1' } })
  g.drop(document.getElementById('lane'), {
    accepts: (kind) => kind === 'card',
    onDrop: (payload) => console.log('dropped', payload),
  })
</script>
```

The standout: this works inside a **Google Apps Script `HtmlService`** page — a sandboxed iframe with no bundler and no npm, where heavier drag-and-drop frameworks can't go. Serve it from `unpkg` / `jsdelivr`, or paste `dist/goonteh.global.js` straight into your HTML. A pair of work gloves fits anywhere.

## Packages / entry points

| Import | What | Requires |
| --- | --- | --- |
| `goonteh` / `goonteh/core` | The framework-agnostic engine (vanilla TS + DOM). Use directly or to write an adapter. | a DOM |
| `goonteh/native` | Vanilla DOM sugar: `goonteh().grab(el, …)` / `.drop(el, …)`, with ghost-from-clone. | a DOM |
| `goonteh/solid` | SolidJS adapter: `<GoontehProvider>`, `<Grab>`, `<Drop>`, `useGoonteh`. | **solid-js ≥ 1.6** |
| `goonteh/react` | React adapter: `<GoontehProvider>`, `<Grab>`, `<Drop>`, `useGoonteh`. | **react ≥ 18** (uses `createRoot`) |
| `goonteh/vue` | Vue 3 adapter: `GoontehProvider`, `Grab`, `Drop`, `useGoonteh`. | **vue ≥ 3.2** |
| `goonteh/svelte` | Svelte adapter: `createGoonteh()` → `grab` / `drop` actions + a `drag` store. | **svelte ≥ 4** |
| `goonteh/react-native` | React Native adapter (experimental): its own PanResponder engine. | **react-native ≥ 0.70** |

Each framework is an **optional** peer dependency (the version above is enforced in `peerDependencies`) — install only the one you use; the core needs nothing. Adapters are thin; the drag mechanics live entirely in the core.

> **React Native adapter is experimental and not covered by the web-core compatibility guarantees.** It ships its own PanResponder engine (not the shared web core); the web adapters (native/solid/react/vue/svelte) are the stable surface.

## Install

```sh
npm i goonteh
```

> 📖 Copy-paste recipes for every adapter live in **[EXAMPLES.md](./EXAMPLES.md)** — reorder-and-combine, drag handles, opt-out zones (resize handles), typed payloads, and more.

## SolidJS

Wrap your app once with `<GoontehProvider>`, then use `<Grab>` for sources and `<Drop>` for targets.

```tsx
import { GoontehProvider, Grab, Drop } from 'goonteh/solid'

function App() {
  return (
    <GoontehProvider>
      <Grab payload={{ color: 'red' }} kind="swatch" ghost={() => <div class="ghost">red</div>}>
        <button>red</button>
      </Grab>

      <Drop
        accepts={(kind) => kind === 'swatch'}
        onDrop={(payload) => console.log('dropped', payload)}
        class="canvas"
        activeClass="ring"
      >
        drop here
      </Drop>
    </GoontehProvider>
  )
}
```

A drag starts only after the pointer moves past a ~5px threshold, so a plain click still reaches the child (e.g. to select it).

## React

```tsx
import { GoontehProvider, Grab, Drop } from 'goonteh/react'

<GoontehProvider>
  <Grab payload={{ color: 'red' }} kind="swatch" ghost={() => <div className="ghost">red</div>}>
    <button>red</button>
  </Grab>
  <Drop accepts={(k) => k === 'swatch'} onDrop={(p) => console.log(p)} activeClass="ring">
    drop here
  </Drop>
</GoontehProvider>
```

## Vue

```vue
<script setup lang="ts">
import { h } from 'vue'
import { GoontehProvider, Grab, Drop } from 'goonteh/vue'
</script>

<template>
  <GoontehProvider>
    <Grab :payload="{ color: 'red' }" kind="swatch" :ghost="() => h('div', { class: 'ghost' }, 'red')">
      <button>red</button>
    </Grab>
    <Drop :accepts="(k) => k === 'swatch'" :onDrop="(p) => console.log(p)" active-class="ring">
      drop here
    </Drop>
  </GoontehProvider>
</template>
```

## Svelte

Idiomatic Svelte: `grab` / `drop` are use-directive **actions**, and the live drag is a **store**. Call `createGoonteh()` once in a root component; descendants can reach the same engine with `getGoonteh()`.

```svelte
<script lang="ts">
  import { createGoonteh } from 'goonteh/svelte'
  const { grab, drop, drag } = createGoonteh()
  const ghost = () => { const el = document.createElement('div'); el.textContent = 'red'; return el }
</script>

<div use:grab={{ payload: { color: 'red' }, kind: 'swatch', ghost, lift: 'hole' }}>red</div>
<div use:drop={{ accepts: (k) => k === 'swatch', onDrop: (p) => console.log(p), activeClass: 'ring' }}>drop here</div>
{#if $drag.dragging}dragging {$drag.active?.kind}{/if}
```

## React Native (experimental)

React Native has no DOM, so this adapter ships its own PanResponder-based engine (not the web core). It works with rect hit-testing and a full-screen ghost overlay.

```tsx
import { Text, View } from 'react-native'
import { GoontehProvider, Grab, Drop } from 'goonteh/react-native'

<GoontehProvider>
  <Grab payload={{ color: 'red' }} kind="swatch" ghost={() => <Text>red</Text>}>
    <View style={styles.chip}><Text>red</Text></View>
  </Grab>
  <Drop accepts={(k) => k === 'swatch'} onDrop={(p) => console.log(p)} activeStyle={styles.over}>
    <View style={styles.zone}><Text>drop here</Text></View>
  </Drop>
</GoontehProvider>
```

## Native (vanilla DOM)

```ts
import { goonteh } from 'goonteh/native'

const g = goonteh()
g.grab(sourceEl, { payload: { color: 'red' }, kind: 'swatch' }) // ghost defaults to a clone
g.drop(targetEl, { accepts: (k) => k === 'swatch', onDrop: (p) => console.log(p) })
```

## Lift — pick up, leave a hole

By default the source stays put and only the ghost moves. Pass `lift` on a `Grab` to make the element look genuinely picked up:

- **`lift="hole"`** — the source is hidden in place (`visibility: hidden`). Its box keeps its space, so a **blank hole** is left and siblings don't move. Best for grid / canvas reordering.
- **`lift="collapse"`** — the source is removed from layout (`display: none`), so siblings **close the gap**. Best for lists that should reflow.

```tsx
<Grab payload={id} kind="card" lift="hole" ghost={() => <CardGhost />}>…</Grab>
```

goonteh does **not** reflow siblings mid-drag — the hole stays exactly where you picked up. Reordering/insertion happens on **drop** (you update your data and re-render). (React Native approximates lift with opacity/`display`.)

## Reading the drag

To drive your own hover affordances you often need to know *what* is being dragged and *where* the pointer is. The core exposes both; the DOM adapters surface them reactively via `useGoonteh`.

- Core: `engine.active()` → `{ kind, payload } | undefined`; `engine.point()` → `{ x, y } | undefined`.
- Solid: `const g = useGoonteh()` → `g.active()`, `g.point()` (accessors).
- React: `const { active, point } = useGoonteh()`.
- Vue: `const { active, point } = useGoonteh()` (computed refs).
- Svelte: `$drag.active`, `$drag.point`.
- React Native: `useGoonteh()` → `{ dragging, active }` (no reactive `point`).

## Recipe: reorder **and** combine (Android-style)

One drag, two outcomes decided by *where* you drop — like an Android home screen: drop between icons to reorder, drop **onto** one to make a folder. Make each card both a `Grab` and a `Drop`, then split on the drop point relative to the target's rect:

```ts
const CENTRE = 0.55 // inner fraction that counts as "combine"
const inCentre = (p: Point, r: DOMRect) =>
  Math.abs(p.x - (r.left + r.width / 2)) <= (r.width * CENTRE) / 2 &&
  Math.abs(p.y - (r.top + r.height / 2)) <= (r.height * CENTRE) / 2

// inside the target card's onDrop(payload, kind, point):
const r = el.getBoundingClientRect()
if (canCombine(payload) && inCentre(point, r)) combine(payload) // onto centre → group
else reorder(payload)                                           // near edge → move
```

Read `point()` during hover (via `useGoonteh`) to **preview** the outcome — a ring in the centre zone, an insertion hint near the edge — and use `lift="hole"` so the picked-up slot stays empty while the user aims.

## Typed payloads — decode at the boundary

`payload` is `unknown` on purpose. goonteh never picks an error model for you, so it composes with whatever you bring — [Effect](https://effect.website) `Schema`, `neverthrow`, or a plain type guard. The library stays bare; the typing glove goes on *your* hand, not the tool.

So don't assert (`payload as Part`) — **decode** at the drop boundary and handle the "not my shape" case explicitly. The Effect way, with `Schema`:

```ts
import { Schema as S } from '@effect/schema'
import { Option } from 'effect'

const Part = S.Struct({ label: S.String, type: S.String, data: S.Record(S.String, S.Unknown) })
const asPart = S.decodeUnknownOption(Part) // (u: unknown) => Option<Part>

// inside onDrop(payload, kind, point):
Option.match(asPart(payload), {
  onSome: (part) => attach(part), // decoded → a real Part
  onNone: () => {},               // foreign shape → ignore; nothing downstream corrupts
})
```

No Effect in the tree? A one-line guard has the same shape — the unsafe cast lives *inside* the decoder, guarded, never at the call site:

```ts
const asPart = (u: unknown): Part | undefined =>
  typeof u === 'object' && u !== null && 'type' in u ? (u as Part) : undefined
```

`active().payload` is `unknown` for the same reason; decode it the same way. This keeps goonteh error-model-neutral and your domain fully typed on your side of the line.

## Core (write your own adapter)

The core is imperative and framework-free. Wire it to your own elements.

```ts
import { createGoontehCore } from 'goonteh'

const engine = createGoontehCore()

// a draggable
engine.draggable(sourceEl, {
  payload: () => ({ color: 'red' }),
  kind: 'swatch',
  ghost: () => {
    const g = document.createElement('div')
    g.textContent = 'red'
    return g // core mounts, positions, and removes it
  },
})

// a drop target
const zone = engine.dropzone(targetEl, {
  accepts: (kind) => kind === 'swatch',
  onDrop: (payload) => console.log('dropped', payload),
})

// reflect state however you like
const off = engine.onChange(() => targetEl.classList.toggle('ring', zone.isOver()))
```

## API (core)

`createGoontehCore(config?)` → engine.

- `draggable(el, { payload, kind, ghost?, disabled?, lift?, onEnd? })` → `() => void` (cleanup). `lift`: `'hole'` (blank gap, no reflow) or `'collapse'` (siblings close up); omit to leave the source in place.
- `dropzone(el, { accepts, onDrop })` → `{ isOver(): boolean, destroy(): void }` — `onDrop(payload, kind, point)` where `point` is the drop pointer position in client coordinates `{ x, y }`. Zones are accept-aware: the innermost zone whose `accepts` returns true wins, so nested zones with different `kind`s coexist.
- `dragging(): boolean`
- `active(): { kind, payload } | undefined` — the live drag while dragging, else `undefined`
- `point(): { x, y } | undefined` — the live pointer position while dragging, else `undefined`
- `onChange(fn): () => void` — fires on drag start / move / zone change / end
- `destroy(): void`

Nested `Grab`s resolve **innermost-wins** (e.g. a drag handle inside a draggable card): only the deepest grab under the pointer starts.

**Opt-out zones (`data-goonteh-nodrag`).** A pointerdown inside any element carrying `data-goonteh-nodrag` never starts a drag. Use it for interactive sub-regions that live *inside* a draggable but should act on their own — resize handles, inline buttons, sliders. (Contrast with a *drag handle*, which you get by making the handle itself the `Grab`.)

```html
<div data-goonteh-grab>            <!-- draggable card -->
  …content…
  <span data-goonteh-nodrag        <!-- resize handle: acts on its own, never drags the card -->
        onpointerdown="startResize(event)"></span>
</div>
```

`config`: `{ threshold?: number; cursor?: string; ghostOffset?: { x: number; y: number } }`.

Zones may nest; the innermost matching zone under the pointer wins. The ghost is `pointer-events: none`, so it never interferes with hit testing.

## API (SolidJS adapter)

- `<GoontehProvider config?>` — owns one engine; place above every `<Grab>`/`<Drop>`.
- `<Grab payload kind ghost disabled? lift? class?>` — `ghost` is a `() => JSX.Element` snapshot taken at grab time; `lift` is `'hole'` | `'collapse'`.
- `<Drop accepts onDrop class? activeClass?>` — `activeClass` is applied while a compatible drag hovers.
- `useGoonteh()` → `{ dragging, active, point }` accessors — the live drag, to drive your own affordances.

Every DOM adapter (React / Vue / Svelte / native) mirrors these: a `lift` option on the grab and a `useGoonteh` (or the `drag` store / `active()` + `point()` on native) for the live drag.

## Notes

- **Touch scrolling.** `<Grab>` sets `touch-action: none` on its wrapper so a touch drag doesn't scroll the page. If a draggable fills a scrollable area, consider a dedicated drag handle.
- **Opt-out zones (`data-goonteh-nodrag`).** Mark interactive sub-regions inside a draggable (resize handles, inline buttons) so their pointerdown acts on them instead of starting a drag.
- **Cancel.** `Escape` (or a `pointercancel`) aborts the drag with no drop.
- **`null` vs `undefined`.** `undefined` is absence; `null` only appears at DOM/framework boundaries. If you read the source, see [CONTRIBUTING.md → `null` vs `undefined`](./CONTRIBUTING.md#null-vs-undefined).

## Status

Early (0.1.x) and lightly tested — expect rough edges. Ships TypeScript/TSX source; the core is plain TS and the framework adapters are compiled by your framework-aware bundler. A prebuilt `dist` is planned before a stable release. The React Native adapter is **experimental**.

## Contributing

Found a bug? Please **open an issue first** — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT © mrksye
