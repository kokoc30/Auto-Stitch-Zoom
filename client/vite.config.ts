import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function parseAllowedHosts(value: string | undefined): string[] {
  if (!value) return []

  return Array.from(
    new Set(
      value
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean)
    )
  )
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = parseAllowedHosts(env.VITE_DEV_ALLOWED_HOSTS)

  return {
    plugins: [react()],
    server: {
      // Keep tunnel testing explicit instead of allowing every host in dev.
      allowedHosts,
      // Required for SharedArrayBuffer (ffmpeg.wasm) — enables cross-origin isolation.
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
