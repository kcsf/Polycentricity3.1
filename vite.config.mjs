import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit()
  ],
  optimizeDeps: {
    include: [
      'gun',
      'gun/sea',
      'gun/lib/radix',
      'gun/lib/radisk',
      'gun/lib/store',
      'gun/lib/rindexed',
      '@skeletonlabs/skeleton-svelte'
    ]
  },
  ssr: {
    noExternal: [
      'gun',
      'gun/sea',
      'gun/lib/radix',
      'gun/lib/radisk',
      'gun/lib/store',
      'gun/lib/rindexed',
      '@skeletonlabs/skeleton-svelte'
    ]
  },
  build: {
    commonjsOptions: {
      include: [/gun/, /node_modules/]
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    hmr: process.env.REPLIT
      ? {
          clientPort: 443 // Replit uses 443 for WebSocket proxy
        }
      : {
          protocol: 'ws',
          host: 'localhost',
          port: 5000 // Local development
        },
    watch: {
      usePolling: true
    },
    cors: true,
    fs: {
      allow: ['.']
    },
    allowedHosts: process.env.REPLIT
      ? [
          'localhost',
          '308c3cd4-629d-4842-a74f-714ffd4b8ba2-00-nmcqb5x4k5f0.spock.replit.dev',
          '.replit.dev',
          '.repl.co'
        ]
      : undefined
  }
});