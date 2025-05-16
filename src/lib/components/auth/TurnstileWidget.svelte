<script lang="ts">
  import { onMount } from 'svelte';
  import { PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY } from '$env/static/public';

  // Props via Runes
  let { sitekey = PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY, onVerified, onError } = $props<{
    sitekey?: string;
    onVerified?: (token: string) => void;
    onError?: (msg: string) => void;
  }>();

  // Local reactive state
  let turnstileContainer: HTMLDivElement;
  let widgetId = $state<string | null>(null);
  let errorMessage = $state<string>('');
  let scriptLoaded = $state(false);
  const isDev = import.meta.env.DEV;

  // Renders or resets the Turnstile widget
  function renderTurnstile(): void {
    if (
      typeof window === 'undefined' ||
      !scriptLoaded ||
      !turnstileContainer ||
      !window.turnstile
    ) {
      return;
    }

    if (widgetId) {
      window.turnstile.reset(widgetId);
    }

    try {
      widgetId = window.turnstile.render(turnstileContainer, {
        sitekey,
        callback: (token: string) => {
          onVerified?.(token);
        },
        'error-callback': (err: any) => {
          const msg = typeof err === 'string' ? err : 'Verification failed';
          errorMessage = msg;
          onError?.(msg);
        },
        'expired-callback': () => {
          const msg = 'Verification expired, please try again';
          errorMessage = msg;
          onError?.(msg);
        },
        theme: 'auto'
      });
    } catch {
      const msg = 'Error initializing verification widget';
      errorMessage = msg;
      onError?.(msg);
    }
  }

  onMount(() => {
    if (typeof window === 'undefined') return;

    const scriptId = 'cloudflare-turnstile-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        scriptLoaded = true;
        renderTurnstile();
      };
      document.head.append(script);
    } else {
      scriptLoaded = true;
      renderTurnstile();
    }

    return () => {
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  });
</script>

<div class="flex flex-col items-center py-2 relative" aria-live="polite">
  {#if isDev}
    <div class="mb-2 text-center">
      <button
        type="button"
        class="btn bg-primary-500-400 text-white"
        onclick={() =>
          onVerified?.('dev-mock-' + Math.random().toString(36).slice(2, 10))}
      >
        Verify (Dev)
      </button>
      <p class="text-xs mt-1 opacity-70">
        Development mode: click to mock verification
      </p>
    </div>
  {/if}

  <div class="turnstile-container" bind:this={turnstileContainer}></div>
</div>

{#if errorMessage}
  <p class="text-error-400-500 text-sm text-center mt-2" role="alert">
    {errorMessage}
  </p>
{/if}