// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
        namespace App {
                // interface Error {}
                // interface Locals {}
                // interface PageData {}
                // interface Platform {}
        }

        // Environment variable type declarations
        namespace NodeJS {
                interface ProcessEnv {
                        SENDGRID_API_KEY: string;
                        CLOUDFLARE_TURNSTILE_SECRET: string;
                        PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY: string;
                }
        }
}

// Add this to make it a module
export {};