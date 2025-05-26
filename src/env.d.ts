/// <reference types="vite/client" />

declare module '$env/static/private' {
  export const SENDGRID_API_KEY: string;
  export const CLOUDFLARE_TURNSTILE_SECRET: string;
  export const ADMIN_EMAIL: string;
}

declare module '$env/static/public' {
  export const PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY: string;
}