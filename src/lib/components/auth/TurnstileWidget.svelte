<script lang="ts">
  import { onMount } from "svelte";
  import { PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY } from "$env/static/public";

  // Props via RUNES
  let {
    sitekey = PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY,
    onVerified,
    onError,
  } = $props<{
    sitekey?: string;
    onVerified?: (token: string) => void;
    onError?: (msg: string) => void;
  }>();

  // Local reactive state
  let turnstileContainer: HTMLDivElement;
  let widgetId = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  let scriptLoaded = $state(false);

  // Render or reset the Turnstile widget
  async function renderTurnstile(): Promise<void> {
    if (
      typeof window === "undefined" ||
      !scriptLoaded ||
      !turnstileContainer ||
      !(window as any).turnstile
    )
      return;

    const cf = (window as any).turnstile;

    if (widgetId) {
      cf.reset(widgetId);
    }

    try {
      widgetId = cf.render(turnstileContainer, {
        sitekey,
        callback: (token: string) => {
          // emit raw token; parent will verify
          onVerified?.(token);
        },
        "error-callback": (err: any) => {
          const msg = typeof err === "string" ? err : "Verification error";
          errorMessage = msg;
          onError?.(msg);
        },
        "expired-callback": () => {
          const msg = "Verification expired, please try again";
          errorMessage = msg;
          onError?.(msg);
        },
        theme: "auto",
      });
    } catch (e) {
      const msg = "Error initializing Turnstile widget";
      console.error(e);
      errorMessage = msg;
      onError?.(msg);
    }
  }

  onMount(() => {
    if (typeof window === "undefined") return;

    const scriptId = "cf-turnstile-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      // explicit rendering mode
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        scriptLoaded = true;
        renderTurnstile();
      };
      script.onerror = () => {
        const msg = "Failed to load Turnstile script";
        errorMessage = msg;
        onError?.(msg);
      };
      document.head.append(script);
    } else {
      scriptLoaded = true;
      renderTurnstile();
    }

    return () => {
      if (widgetId && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetId);
      }
    };
  });
</script>

<div class="turnstile-container" bind:this={turnstileContainer}></div>

{#if errorMessage}
  <p class="text-error-400-500 text-sm text-center mt-2" role="alert">
    {errorMessage}
  </p>
{/if}
