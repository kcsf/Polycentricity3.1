import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
        plugins: [
                tailwindcss(),
                sveltekit(),
        ],
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