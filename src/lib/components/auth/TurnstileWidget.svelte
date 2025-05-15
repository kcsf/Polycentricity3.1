<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  // Define props
  let { sitekey } = $props<{ sitekey: string }>();
  
  let turnstileRef;
  let token = $state('');
  let errorMessage = $state('');
  
  const dispatch = createEventDispatcher<{
    verified: string;
    error: string;
  }>();
  
  $effect(() => {
    if (typeof window !== 'undefined') {
      // Load Turnstile script if not already loaded
      if (!document.getElementById('cloudflare-turnstile-script')) {
        const script = document.createElement('script');
        script.id = 'cloudflare-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
        
        // Define global callback functions
        window.onVerify = (response) => {
          token = response;
          dispatch('verified', response);
        };
        
        window.onError = (error) => {
          const errorMsg = error.message || 'Verification failed';
          errorMessage = errorMsg;
          dispatch('error', errorMsg);
        };
      }
    }
  });
</script>

<div 
  class="cf-turnstile relative my-4" 
  data-sitekey={sitekey} 
  data-callback="onVerify" 
  data-error-callback="onError" 
  bind:this={turnstileRef}
></div>

{#if errorMessage}
<p class="text-error-400-500 text-sm" role="alert">{errorMessage}</p>
{/if}