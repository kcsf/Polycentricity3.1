// src/turnstile.d.ts
export {};

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  "error-callback"?: (error: any) => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
}

declare global {
  interface Window {
    /**
     * Cloudflare Turnstile API
     */
    turnstile?: {
      /**
       * Render the widget into a container (element or its id).
       * Returns a widgetId string.
       */
      render(
        container: HTMLElement | string,
        options: TurnstileRenderOptions,
      ): string;

      /**
       * Reset the given widget instance (or all if widgetId omitted).
       */
      reset(widgetId?: string): void;

      /**
       * Remove the given widget instance.
       */
      remove(widgetId: string): void;
    };
  }
}
