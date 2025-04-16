import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
        plugins: [
                tailwindcss(),
                sveltekit(),
        ],
        // Special config for Gun.js to work properly with Vite
        // Source: https://github.com/amark/gun/wiki/Vite
        optimizeDeps: {
                include: ['gun', 'svelte-lucide'],
                exclude: ['gun/sea', 'gun/lib/radix', 'gun/lib/radisk', 'gun/lib/store', 'gun/lib/rindexed'],
        },
        build: {
                commonjsOptions: {
                        include: [/gun/, /node_modules/],
                },
        },
        server: {
                host: '0.0.0.0',
                port: 5000,
                strictPort: true,
                hmr: {
                        clientPort: 443
                },
                watch: {
                        usePolling: true
                },
                // Allow access from all Replit domains
                cors: true,
                fs: {
                        allow: ['.']
                },
                allowedHosts: [
                        'localhost',
                        '308c3cd4-629d-4842-a74f-714ffd4b8ba2-00-nmcqb5x4k5f0.spock.replit.dev',
                        '.replit.dev',
                        '.repl.co'
                ]
        }
});