// Build the framework-free surface (core + native) to dist: ESM modules for npm/bundlers, and a
// single self-contained IIFE for <script> tags, CDNs, and Google Apps Script HtmlService pages —
// where there's no bundler, you just paste it and get a `goonteh` global. The framework adapters
// (solid/react/vue/svelte) stay as source; their bundlers transpile them. Types come from tsc.
import * as esbuild from 'esbuild'

const shared = { bundle: true, target: 'es2020', logLevel: 'info' }

// ESM, self-contained (core inlined into native so each entry stands alone).
await esbuild.build({ ...shared, entryPoints: ['core.ts'], format: 'esm', outfile: 'dist/core.js' })
await esbuild.build({ ...shared, entryPoints: ['native.ts'], format: 'esm', outfile: 'dist/native.js' })

// Paste-anywhere IIFE: exposes the `goonteh` factory directly as a global (window.goonteh()).
await esbuild.build({
  ...shared,
  entryPoints: ['native.ts'],
  format: 'iife',
  globalName: '__goonteh',
  footer: { js: 'window.goonteh=__goonteh.goonteh;' },
  outfile: 'dist/goonteh.global.js',
  minify: true,
})
