import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  optimizeDeps: {
    include: ['gun', 'gun/sea', 'gun/lib/radix', 'gun/lib/radisk', 'gun/lib/store', 'gun/lib/rindexed', '@skeletonlabs/skeleton-svelte']
  },
  ssr: {
    noExternal: ['gun', 'gun/sea', 'gun/lib/radix', 'gun/lib/radisk', 'gun/lib/store', 'gun/lib/rindexed', '@skeletonlabs/skeleton-svelte']
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
      ? { clientPort: parseInt(process.env.HMR_CLIENT_PORT || '443') }
      : { protocol: 'ws', host: 'localhost', port: 5000 },
    watch: { usePolling: true },
    cors: true,
    fs: { allow: ['.'] },
    allowedHosts: process.env.ALLOWED_HOSTS
      ? process.env.ALLOWED_HOSTS.split(',')
      : undefined
  }
});