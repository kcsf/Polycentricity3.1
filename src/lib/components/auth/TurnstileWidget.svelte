<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  $props({ sitekey: String });
  
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
        };
        
        window.onError = (error) => {
          errorMessage = error.message || 'Verification failed';
        };
      }
    }
  });
  
  $effect(() => {
    if (token) {
      dispatch('verified', token);
    }
  });
  
  $effect(() => {
    if (errorMessage) {
      dispatch('error', errorMessage);
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
<p class="text-error-400-500 text-sm">{errorMessage}</p>
{/if}