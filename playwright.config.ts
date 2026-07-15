import { defineConfig } from '@playwright/test'

// goonteh is a browser-behaviour library, so it's tested in a real Chromium (Linux). Vite serves the
// repo root so the fixture can import the TypeScript source directly; specs open /test/fixture.html.
export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  reporter: [['list']],
  webServer: {
    command: 'vite --port 5199 --strictPort',
    port: 5199,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: { baseURL: 'http://localhost:5199' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
