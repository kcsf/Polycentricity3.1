<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY } from '$env/static/public';
  
  // Define props properly using Svelte 5 Runes syntax
  // Allow optional override of the sitekey, but default to environment variable
  const props = $props<{ sitekey?: string }>();
  const sitekey = props.sitekey || PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY;
  
  // UI state
  let turnstileContainer: HTMLDivElement;
  let widgetId = $state<string | null>(null);
  let errorMessage = $state<string>('');
  let scriptLoaded = $state<boolean>(false);
  
  // Event dispatcher for component communication
  const dispatch = createEventDispatcher<{
    verified: string;
    error: string;
  }>();
  
  /**
   * Renders the Turnstile widget using the explicit render method
   */
  function renderTurnstile(): void {
    // Guard clauses to prevent errors
    if (!turnstileContainer || !scriptLoaded || typeof window === 'undefined' || !window.turnstile) {
      return;
    }
    
    // Reset widget if it already exists
    if (widgetId) {
      window.turnstile.reset(widgetId);
    }
    
    try {
      // Render widget with proper Turnstile options
      widgetId = window.turnstile.render(turnstileContainer, {
        sitekey: sitekey,
        callback: (token: string) => {
          dispatch('verified', token);
        },
        'error-callback': (error: any) => {
          const errorMsg = typeof error === 'string' ? error : 'Verification failed';
          errorMessage = errorMsg;
          dispatch('error', errorMsg);
        },
        'expired-callback': () => {
          errorMessage = 'Verification expired, please try again';
          dispatch('error', 'Verification expired, please try again');
        },
        theme: 'auto' // Automatically adapt to light/dark mode
      });
    } catch (err: any) {
      errorMessage = 'Error initializing verification widget';
      dispatch('error', errorMessage);
    }
  }
  
  onMount(() => {
    // Load Turnstile script if not already loaded
    if (typeof window !== 'undefined') {
      const existingScript = document.getElementById('cloudflare-turnstile-script');
      
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'cloudflare-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          scriptLoaded = true;
          renderTurnstile();
        };
        document.head.appendChild(script);
      } else {
        scriptLoaded = true;
        renderTurnstile();
      }
    }
    
    // Cleanup function that properly removes the widget
    return () => {
      if (typeof window !== 'undefined' && window.turnstile && widgetId) {
        window.turnstile.remove(widgetId);
      }
    };
  });
</script>

<!-- Use proper TailwindCSS classes for styling -->
<div class="flex justify-center py-2 relative" aria-live="polite">
  <div class="turnstile-container" bind:this={turnstileContainer}></div>
</div>

{#if errorMessage}
<p class="text-error-400-500 text-sm text-center" role="alert">{errorMessage}</p>
{/if}