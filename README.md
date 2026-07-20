# goonteh 🧤

**Drag-and-drop work gloves.** Pointer-based, touch-native, and small enough to paste into a `<script>` tag — the grip that native HTML5 drag-and-drop never had. The no-drop (🚫) cursor is never shown; the cursor and the drop highlight are yours in CSS.

*Pronounced "goon-teh" — the name respells 軍手, Japanese for work gloves.*

goonteh was born on a construction-site scheduling app, where dragging heavy machinery had to work on Linux and on a foreman's tablet. Native HTML5 drag-and-drop couldn't: `dragstart` never fires on touch, and on some platforms (Chromium on Linux) the no-drop cursor sticks even over a valid target, un-overridable by CSS. Bare hands slip. So put a glove on — goonteh reimplements drag-and-drop on **pointer events** (mouse, touch, and pen alike), with the cursor and drop highlight fully yours.

## A primitive, not a framework

If [dnd-kit](https://dndkit.com) is the general contractor for the whole site — sortable models, collision detection, keyboard sensors, an accessibility layer — goonteh is the **work gloves** you're handed on it: the thing you reach for when all you want is *pick it up and put it down*. No sortable model, no collision strategy, no reorder baked in — you keep those. goonteh just does the gripping.

## The moves

The whole vocabulary is the hand-moves you already know from the yard, each keeping its exact technical meaning:

- **`GoontehProvider`** — the gloves are handed out (one drag context)
- **`Grab`** — you grip a thing (a drag source)
- **`Crouch`** — *(touch)* you take the weight and the menu pops — nothing lifted yet; a move lifts, a release keeps the menu
- **`Lift`** — you pick it up (the source leaves a blank hole, or the gap collapses)
- **`Drop`** — you set it down (a drop target)

`Grab`, `Lift`, `Drop` are the three you always make. `Crouch` is the fourth, for touch — on a real load you crouch to take the weight before you lift, so it slots between `Grab` and `Lift`. And like `Lift`, it isn't a component but a move a `Grab` makes: the `lift` / `onCrouch` props.

## How the gloves grip

The whole point of gloves is that the grip feels right on every surface:

- **A mouse grabs on movement.** A drag begins once the pointer crosses a ~5px threshold, so a plain click still reaches the child underneath.
- **Touch and pen are hold-to-drag.** Press and hold still for `holdDelay` (default 250 ms) before it picks up, so a quick swipe stays a **scroll** and only a deliberate hold lifts. `touch-action` is left alone at rest and set to `none` only during an active drag; pass `holdDelay: 0` to grab on movement everywhere.
- **Crouch keeps the long-press menu.** Hold-to-drag would swallow the platform's own long-press menu — so when a `Grab` has a menu to show, the hold first *crouches* (the Android-launcher move): at `holdDelay` the weight is taken but nothing is lifted. `onCrouch(point)` is your cue to pop the menu; from there a **move** lifts and `onLift` fires (dismiss it), while a **release** keeps the menu up. The same long-press means *open the menu* or *pick it up*, decided by whether you then move — omit `onCrouch` and the hold simply lifts.
- **The lift leaves a hole.** `lift="hole"` hides the source in place (the box keeps its space, so nothing reflows); `lift="collapse"` closes the gap instead. goonteh never reflows mid-drag — you reorder on **drop**.
- **Nothing you didn't ask for.** A pointerdown inside a `data-goonteh-nodrag` element never starts a drag (resize handles, inline buttons), and nested grabs resolve **innermost-wins**.

## Runs where a framework can't — Google Apps Script, plain HTML, CDN

No build step, no `npm install`, no bundler. The framework-free core ships as a single self-contained IIFE that puts a `goonteh` global on `window` — one `<script>` and you're gripping:

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

The standout: this runs inside a **Google Apps Script `HtmlService`** page — a sandboxed iframe with no bundler and no `npm install`, where heavier drag-and-drop frameworks can't go. Serve it from `unpkg` / `jsdelivr`, or paste `dist/goonteh.global.js` straight into your HTML. Work gloves fit anywhere.

## Frameworks

```sh
npm i goonteh
```

Thin adapters wrap the same core — install only the framework you use (each an optional peer dependency); the core itself needs nothing.

| Import | Framework |
| --- | --- |
| `goonteh` / `goonteh/core` | Framework-agnostic engine (vanilla TS + DOM) |
| `goonteh/native` | Vanilla DOM sugar (`grab` / `drop`, ghost-from-clone) |
| `goonteh/solid` | SolidJS — `<GoontehProvider>`, `<Grab>`, `<Drop>`, `useGoonteh` |
| `goonteh/react` | React ≥ 18 |
| `goonteh/vue` | Vue ≥ 3.2 |
| `goonteh/svelte` | Svelte ≥ 4 (`grab` / `drop` actions + a `drag` store) |
| `goonteh/react-native` | React Native (**experimental** — its own PanResponder engine, not covered by the web-core guarantees) |

Solid, for example:

```tsx
import { GoontehProvider, Grab, Drop } from 'goonteh/solid'

<GoontehProvider>
  <Grab payload={{ color: 'red' }} kind="swatch" ghost={() => <div class="ghost">red</div>}>
    <button>red</button>
  </Grab>
  <Drop accepts={(k) => k === 'swatch'} onDrop={(p) => console.log(p)} activeClass="ring">
    drop here
  </Drop>
</GoontehProvider>
```

> 📖 **[EXAMPLES.md](./EXAMPLES.md)** — copy-paste recipes for every adapter (React / Vue / Svelte / native / React Native), the crouch long-press menu, reorder-vs-combine, drag handles, opt-out zones, and typed payloads.

## API (core)

`createGoontehCore(config?)` → engine. `config`: `{ threshold?, holdDelay?, cursor?, ghostOffset? }`.

- `draggable(el, { payload, kind, ghost?, disabled?, lift?, onCrouch?, onLift?, onEnd? })` → cleanup `() => void`
- `dropzone(el, { accepts, onDrop })` → `{ isOver(), destroy() }`; `onDrop(payload, kind, point)`; the innermost **accepting** zone wins
- `dragging()` · `active()` · `point()` · `onChange(fn)` → unsubscribe · `destroy()`

The DOM adapters mirror all of it — the `lift` / `onCrouch` moves on a `Grab`, and a `useGoonteh` for the live drag.

## Live drag & typed payloads

- **Read the live drag** — `useGoonteh()` (or the core's `active()` / `point()`) tells you *what* is being dragged and *where* the pointer is, so you can preview reorder-vs-combine yourself before the drop lands.
- **Typed payloads** — `payload` is `unknown` on purpose; goonteh picks no error model. **Decode** it at the drop boundary (Effect `Schema`, `neverthrow`, a plain guard) rather than asserting.

## Status

The web core is stable and pinned by real-browser (Playwright, Chromium/Linux) tests: the pickup model (mouse-move, touch hold-to-drag, crouch), pointer-id tracking, cancel, exception-safe teardown, and a clean `destroy()`. It ships a prebuilt `dist` (ESM + `.d.ts` + a `<script>` IIFE) alongside TS source for the framework adapters. The React Native adapter is **experimental** and outside the web-core guarantees.

## Contributing · License

Found a bug? Please **open an issue first** — see [CONTRIBUTING.md](./CONTRIBUTING.md). MIT © mrksye.
