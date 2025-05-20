import vercel from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
        preprocess: [vitePreprocess({})],
        compilerOptions: { runes: true },
        kit: {
                adapter: vercel({
                        // Serverless function runtime
                        runtime: 'nodejs18.x',
                        
                        // For external API services like Turnstile and SendGrid
                        external: ['@sendgrid/mail'],
                        
                        // Enables handling of dynamic routes
                        split: false
                }),
                alias: {
                        $lib: "./src/lib",
                        $app: "./node_modules/@sveltejs/kit/src/runtime/app",
                },
        },
};

export default config;
