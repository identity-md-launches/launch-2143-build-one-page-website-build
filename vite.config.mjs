import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Optional external dependency directory keeps the contributor workspace free of
// installed dependencies. A normal npm ci needs no environment setting.
const dependencyDirectory = process.env.IMD_FRONTEND_DEPENDENCIES
const packages = [
  'react',
  'react-dom',
  'wagmi',
  'viem',
  '@tanstack/react-query',
]

export default {
  base: './',
  resolve: {
    alias: dependencyDirectory
      ? packages.map((name) => ({
          find: new RegExp(
            `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=/|$)`,
          ),
          replacement: resolve(dependencyDirectory, 'node_modules', name),
        }))
      : [],
    dedupe: packages,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // This export runs entirely in the browser; React server-boundary
        // directives from dependencies have no semantics to preserve here.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
        defaultHandler(warning)
      },
      output: {
        manualChunks(id) {
          if (id.includes('@coinbase/wallet-sdk')) return 'coinbase-wallet'
          if (/\/(react|react-dom|scheduler)\//.test(id)) return 'react'
        },
      },
    },
  },
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        ...(dependencyDirectory ? [dependencyDirectory] : []),
      ],
    },
  },
}
