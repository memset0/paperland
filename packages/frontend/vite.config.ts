import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

function loadAllowedHosts(): string[] {
  // Traverse upward to find config.yml
  let dir = process.cwd()
  while (true) {
    const candidate = resolve(dir, 'config.yml')
    if (existsSync(candidate)) {
      const content = readFileSync(candidate, 'utf-8')
      // Simple YAML parse for allowed_hosts list (avoid js-yaml dependency)
      const match = content.match(/^allowed_hosts:\s*\n((?:\s+-\s+.+\n?)*)/m)
      if (!match) return []
      return match[1]
        .split('\n')
        .map(line => line.replace(/^\s*-\s*/, '').trim())
        .filter(Boolean)
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return []
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: loadAllowedHosts(),
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
      },
      '/external-api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
