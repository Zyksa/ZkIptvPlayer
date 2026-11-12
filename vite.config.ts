import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { handleApi } from './server/web-server.mjs'

// Mounts the web-mode API (catalog relay + "open in VLC") on the Vite dev
// server, so `npm run dev` in a plain browser behaves like `npm run web`.
const webModeApi = (): Plugin => ({
  name: 'zkplayer-web-mode-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      handleApi(req, res)
        .then((handled: boolean) => { if (!handled) next() })
        .catch(next)
    })
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), webModeApi()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: true,
    watch: {
      // Ignore src-tauri so Vite watcher doesn't lock target build files on Windows
      ignored: ['**/src-tauri/**'],
    },
  },
})
