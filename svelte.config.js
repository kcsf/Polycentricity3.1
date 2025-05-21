import vercel from '@sveltejs/adapter-vercel';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// on Vercel, VERCEL=1 or CI=true comes from the platform
const isVercel = process.env.VERCEL === '1' || process.env.CI === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [vitePreprocess()],
  compilerOptions: { runes: true },
  kit: {
    adapter: isVercel
      ? vercel({
          runtime: 'nodejs20.x',
          // split: true, // default behavior: one function per page/endpoint
        })
      : staticAdapter({
          pages: 'build',
          assets: 'build',
          fallback: null,
          precompress: false,
          strict: true
        }),
          // no need to add alias here—SvelteKit already manages $lib and $app
        alias: {
        $lib: "./src/lib",
        $app: "./node_modules/@sveltejs/kit/src/runtime/app",
        },
  }
};

export default config;
