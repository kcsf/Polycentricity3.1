<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  
  // Define props
  let { sitekey } = $props<{ sitekey: string }>();
  
  let turnstileContainer;
  let widgetId = $state<string | null>(null);
  let token = $state('');
  let errorMessage = $state('');
  let scriptLoaded = $state(false);
  
  const dispatch = createEventDispatcher<{
    verified: string;
    error: string;
  }>();
  
  function renderTurnstile() {
    if (!turnstileContainer || !scriptLoaded || typeof window === 'undefined' || !(window as any).turnstile) {
      return;
    }
    
    if (widgetId) {
      // Reset if needed
      (window as any).turnstile?.reset(widgetId);
    }
    
    try {
      console.log('Rendering Turnstile with sitekey:', sitekey);
      widgetId = (window as any).turnstile.render(turnstileContainer, {
        sitekey: sitekey,
        callback: function(token: string) {
          console.log('Turnstile verification successful');
          dispatch('verified', token);
        },
        'error-callback': function(error: any) {
          console.error('Turnstile error:', error);
          errorMessage = typeof error === 'string' ? error : 'Verification failed';
          dispatch('error', errorMessage);
        },
        'expired-callback': function() {
          console.warn('Turnstile verification expired');
          errorMessage = 'Verification expired, please try again';
          dispatch('error', errorMessage);
        }
      });
    } catch (err) {
      console.error('Error rendering Turnstile:', err);
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
    
    return () => {
      // Clean up when component is destroyed
      if (typeof window !== 'undefined' && (window as any).turnstile && widgetId) {
        (window as any).turnstile.remove(widgetId);
      }
    };
  });
</script>

<div class="turnstile-container relative my-4" bind:this={turnstileContainer}></div>

{#if errorMessage}
<p class="text-error-400-500 text-sm" role="alert">{errorMessage}</p>
{/if}