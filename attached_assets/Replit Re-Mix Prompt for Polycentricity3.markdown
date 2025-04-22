# Replit Re-Mix Prompt for EcoVillageSim to Polycentricity3

## Overview

Re-Mix the "EcoVillageSim" project into a new project named "Polycentricity3" to implement an updated Gun.js database schema, enable Svelte 5 Runes mode project-wide, and optimize for Replit’s error-prone environment. The existing Gun.js database will be reset, using new schema paths without data migration. Do not auto-repair errors during the Re-Mix, as component rewrites for Runes mode may trigger expected errors that require manual conversion. We will provide full schema documentation and an example `src/lib/types/index.ts` types file.

## Re-Mix Parameters

1. **Project Setup**:

   - **Name**: Polycentricity3
   - **Language**: SvelteKit (Node.js, Svelte 5.28.1)
   - **Framework**: SvelteKit with TypeScript 5.8.3
   - **Svelte Configuration**: Update `svelte.config.js` to enable Runes mode project-wide:

     ```javascript
     import adapter from '@sveltejs/adapter-static';
     import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
     export default {
       preprocess: [vitePreprocess({})],
       compilerOptions: { runes: true },
       kit: {
         adapter: adapter({
           pages: 'build',
           assets: 'build',
           fallback: 'index.html',
           precompress: false,
           strict: true
         }),
         alias: { $lib: './src/lib' }
       }
     };
     ```
     - **Why**: Enforces Runes syntax (`$state`, `$props`, `$effect`, `$derived`) across all `.svelte` files, preventing Replit’s Svelte 4 mix-ups (e.g., `export let`, `$:`) and aligning with Svelte 6’s Runes-only future.
   - **TypeScript Configuration**: Update `tsconfig.json` to exclude `gun-db.js` for faster compilation:

     ```json
     {
       "extends": "./.svelte-kit/tsconfig.json",
       "compilerOptions": {
         "target": "ES2022",
         "module": "ESNext",
         "moduleResolution": "node",
         "strict": true,
         "esModuleInterop": true,
         "skipLibCheck": true,
         "forceConsistentCasingInFileNames": true,
         "resolveJsonModule": true,
         "sourceMap": true,
         "types": ["svelte", "@types/node"],
         "allowJs": true,
         "checkJs": true,
         "useDefineForClassFields": true,
         "verbatimModuleSyntax": true,
         "isolatedModules": true
       },
       "include": ["src/**/*", "src/**/*.svelte"],
       "exclude": ["node_modules", "build", "src/lib/gun-db.js"]
     }
     ```
     - **Why**: Reduces type-checking overhead (\~10-20% faster compilation) for `gun-db.js` while catching errors in other `.js` files, critical for Replit’s reliability.

2. **File Structure**:

   - **Files to Remove**:
     - `src/lib/services/gunRadiskAdapter.ts`: Redundant with `gun-db.js`, both initialize Gun.js with Radisk, wasting \~50-100KB memory.
     - `src/lib/stores/enhancedGameStore.ts`: Redundant with `gameStore.ts`, misaligned with the new schema (`obligations`/`benefits` vs. `parties`), and contains inefficient Replit fixes (e.g., 500ms timeouts, multiple `map().on()` subscriptions wasting \~100-500KB).
     - **Why**: Removes Replit’s legacy errors, streamlines initialization, and ensures schema compatibility.
   - **Files to Update**:
     - `src/lib/types/index.ts`: Replace with the provided TypeScript types file with schema-aligned types (`User`, `Game`, `Actor`, `Agreement`, `Pager`, `GameChatRoom`, `PrivateChatRoom`).
     - `src/lib/services/gameService.ts`: Update with pure, async functions using `index.ts` types, centralizing Gun.js logic.
     - `src/lib/services/gunService.ts`: Update to align with schema paths and types.
     - `src/lib/services/authService.ts`: Update to remove `devices` and admin bypass.
     - `src/lib/stores/gameStore.ts`: Update to retain `writable` for existing stores and add `$state` for D3 state.
     - `src/lib/stores/userStore.ts`: Update to retain `writable` and add `lastError`.
     - **Why**: Implements the new schema, Runes mode, and optimized logic, replacing Replit’s outdated code.
   - **Component Rewrite**:
     - Rewrite all `.svelte` files (e.g., `+page.svelte`, `D3CardBoard.svelte`) to use Runes syntax:
       - Replace `export let` with `$props()` (e.g., `let { gameId } = $props()`).
       - Replace reactive `let` with `$state` (e.g., `let game = $state<Game | null>(null)`).
       - Replace `$:` with `$derived` for computed values or `$effect` for side effects (e.g., `$effect(() => { game = await getGame(gameId); })`).
     - **Why**: Project-wide `runes: true` disables Svelte 4 syntax, requiring Runes to prevent Replit errors and align with Svelte 6.

3. **Replit Instructions**:

   - **Disable Auto-Repair**: Do not attempt to auto-repair errors during the Re-Mix, as Runes mode (`runes: true`) will trigger expected errors in `.svelte` files using Svelte 4 syntax (e.g., `export let`, `$:`). These require manual conversion to Runes.

Please Re-Mix EcoVillageSim into Polycentricity3, following these parameters exactly. Do not auto-repair errors, as Runes mode will require manual component rewrites. Use the provided schema documentation and `index.ts` to ensure alignment with the new Gun.js schema.

```