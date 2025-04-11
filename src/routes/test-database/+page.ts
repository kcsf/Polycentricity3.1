// Disable SSR for this route since we need client-side Gun.js
export const ssr = false;
export const prerender = false;

// Load the page
export function load() {
    return {};
}