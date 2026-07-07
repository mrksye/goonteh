# goonteh 🧤

Tiny **pointer-based** drag-and-drop that works on **touch** and never shows the **no-drop (🚫) cursor**.

`goonteh` (軍手, Japanese for *work gloves*) exists because the native HTML5 Drag and Drop API has two dealbreakers:

1. **It doesn't work on touch.** `draggable` / `dragstart` never fire on phones and tablets.
2. **Its cursor is not yours.** On some platforms (notably Chromium on Linux) the "no-drop" cursor sticks even over a valid drop target, and CSS can't override it.

Bare hands slip. Put a glove on. `goonteh` reimplements drag-and-drop on **pointer events**, so it works with mouse, touch, and pen alike, and the cursor and drop highlight are **fully controlled with CSS** — no forbidden cursor, ever.

- 🖐️ Mouse, touch, and pen (pointer events)
- 🚫 No native no-drop cursor — you own the look
- 📦 Payloads are plain JS values tagged by a `kind` string (no `dataTransfer` / MIME)
- 👻 Custom drag ghost that follows the pointer
- 🧩 **Framework-agnostic core** + thin adapters — zero deps beyond your framework

## Packages / entry points

| Import | What |
| --- | --- |
| `goonteh` / `goonteh/core` | The framework-agnostic engine (vanilla TS + DOM). Use directly or to write an adapter. |
| `goonteh/native` | Vanilla DOM sugar: `gunte().grab(el, …)` / `.drop(el, …)`, with ghost-from-clone. |
| `goonteh/solid` | SolidJS adapter: `<GunteProvider>`, `<Grab>`, `<Drop>`. |
| `goonteh/react` | React adapter: `<GunteProvider>`, `<Grab>`, `<Drop>`. |
| `goonteh/react-native` | React Native adapter (experimental): its own PanResponder engine. |
| `goonteh/vue` | Vue 3 adapter: `GunteProvider`, `Grab`, `Drop`. |

Every framework is an **optional** peer dependency — the core needs nothing. Adapters are ~50 lines each; the drag mechanics live entirely in the core.

## Install

```sh
npm i goonteh
```

## SolidJS

Wrap your app once with `<GunteProvider>`, then use `<Grab>` for sources and `<Drop>` for targets.

```tsx
import { GunteProvider, Grab, Drop } from 'goonteh/solid'

function App() {
  return (
    <GunteProvider>
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
    </GunteProvider>
  )
}
```

A drag starts only after the pointer moves past a ~5px threshold, so a plain click still reaches the child (e.g. to select it).

## React

```tsx
import { GunteProvider, Grab, Drop } from 'goonteh/react'

<GunteProvider>
  <Grab payload={{ color: 'red' }} kind="swatch" ghost={() => <div className="ghost">red</div>}>
    <button>red</button>
  </Grab>
  <Drop accepts={(k) => k === 'swatch'} onDrop={(p) => console.log(p)} activeClass="ring">
    drop here
  </Drop>
</GunteProvider>
```

## Vue

```vue
<script setup lang="ts">
import { h } from 'vue'
import { GunteProvider, Grab, Drop } from 'goonteh/vue'
</script>

<template>
  <GunteProvider>
    <Grab :payload="{ color: 'red' }" kind="swatch" :ghost="() => h('div', { class: 'ghost' }, 'red')">
      <button>red</button>
    </Grab>
    <Drop :accepts="(k) => k === 'swatch'" :onDrop="(p) => console.log(p)" active-class="ring">
      drop here
    </Drop>
  </GunteProvider>
</template>
```

## React Native (experimental)

React Native has no DOM, so this adapter ships its own PanResponder-based engine (not the web core). It works with rect hit-testing and a full-screen ghost overlay.

```tsx
import { Text, View } from 'react-native'
import { GunteProvider, Grab, Drop } from 'goonteh/react-native'

<GunteProvider>
  <Grab payload={{ color: 'red' }} kind="swatch" ghost={() => <Text>red</Text>}>
    <View style={styles.chip}><Text>red</Text></View>
  </Grab>
  <Drop accepts={(k) => k === 'swatch'} onDrop={(p) => console.log(p)} activeStyle={styles.over}>
    <View style={styles.zone}><Text>drop here</Text></View>
  </Drop>
</GunteProvider>
```

## Native (vanilla DOM)

```ts
import { gunte } from 'goonteh/native'

const g = gunte()
g.grab(sourceEl, { payload: { color: 'red' }, kind: 'swatch' }) // ghost defaults to a clone
g.drop(targetEl, { accepts: (k) => k === 'swatch', onDrop: (p) => console.log(p) })
```

## Core (write your own adapter)

The core is imperative and framework-free. Wire it to your own elements.

```ts
import { createGunteCore } from 'goonteh'

const gunte = createGunteCore()

// a draggable
gunte.draggable(sourceEl, {
  payload: () => ({ color: 'red' }),
  kind: 'swatch',
  ghost: () => {
    const g = document.createElement('div')
    g.textContent = 'red'
    return g // core mounts, positions, and removes it
  },
})

// a drop target
const zone = gunte.dropzone(targetEl, {
  accepts: (kind) => kind === 'swatch',
  onDrop: (payload) => console.log('dropped', payload),
})

// reflect state however you like
const off = gunte.onChange(() => targetEl.classList.toggle('ring', zone.isOver()))
```

## API (core)

`createGunteCore(config?)` → engine.

- `draggable(el, { payload, kind, ghost?, disabled?, onEnd? })` → `() => void` (cleanup)
- `dropzone(el, { accepts, onDrop })` → `{ isOver(): boolean, destroy(): void }`
- `dragging(): boolean`
- `onChange(fn): () => void` — fires on drag start / move / zone change / end
- `destroy(): void`

`config`: `{ threshold?: number; cursor?: string; ghostOffset?: { x: number; y: number } }`.

Zones may nest; the innermost matching zone under the pointer wins. The ghost is `pointer-events: none`, so it never interferes with hit testing.

## API (SolidJS adapter)

- `<GunteProvider config?>` — owns one engine; place above every `<Grab>`/`<Drop>`.
- `<Grab payload kind ghost disabled? class?>` — `ghost` is a `() => JSX.Element` snapshot taken at grab time.
- `<Drop accepts onDrop class? activeClass?>` — `activeClass` is applied while a compatible drag hovers.

## Notes

- **Touch scrolling.** `<Grab>` sets `touch-action: none` on its wrapper so a touch drag doesn't scroll the page. If a draggable fills a scrollable area, consider a dedicated drag handle.
- **Cancel.** `Escape` (or a `pointercancel`) aborts the drag with no drop.

## Status

Early (0.1.x) and lightly tested — expect rough edges. Ships TypeScript/TSX source; the core is plain TS and the framework adapters are compiled by your framework-aware bundler. A prebuilt `dist` is planned before a stable release. The React Native adapter is **experimental**.

## Contributing

Found a bug? Please **open an issue first** — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT © mrksye
