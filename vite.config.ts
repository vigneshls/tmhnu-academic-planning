import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:standalone` → dist-standalone/index.html: one file, opens by double-click (file://)
// base './' + HashRouter => also works on GitHub Pages under any repo name.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), ...(mode === 'standalone' ? [viteSingleFile()] : [])],
  build: mode === 'standalone' ? { outDir: 'dist-standalone', assetsInlineLimit: 100_000_000 } : {},
  test: { environment: 'node' },
} as any))
