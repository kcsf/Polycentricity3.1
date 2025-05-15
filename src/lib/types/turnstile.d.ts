/**
 * Type definitions for Cloudflare Turnstile
 */

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback': (error: any) => void;
  'expired-callback': () => void;
  theme?: 'light' | 'dark' | 'auto';
}

interface TurnstileInstance {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}