import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'

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

// Paperland version (root package.json) and the checked-out commit, shown in the AppPage footer.
const repoRoot = resolve(__dirname, '../..')
function loadAppVersion(): string {
  try {
    return JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8')).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
function loadGitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(loadAppVersion()),
    __GIT_HASH__: JSON.stringify(loadGitHash()),
  },
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Monaco's editor worker (lib/monaco.ts) is imported with `?worker`; emit workers
  // as ES modules so they bundle cleanly. Markdown needs only the base editor worker.
  worker: {
    format: 'es',
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
      // Trailing slash is required: a bare '/image' prefix would also capture the
      // '/images' SPA page route and proxy it to the backend (404). '/image/' only
      // matches actual image files (/image/YYYY/MM/DD/{hash}.{ext}).
      '/image/': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
