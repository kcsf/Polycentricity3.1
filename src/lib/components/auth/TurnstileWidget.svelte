<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  
  // Define props
  let { sitekey } = $props<{ sitekey: string }>();
  
  let turnstileRef;
  let token = $state('');
  let errorMessage = $state('');
  
  const dispatch = createEventDispatcher<{
    verified: string;
    error: string;
  }>();
  
  // Since we need to access the window object and define global functions
  // It's safer to do this in onMount
  onMount(() => {
    // Define global callback functions for Turnstile
    if (typeof window !== 'undefined') {
      // Add type declarations to window object
      (window as any).onTurnstileVerify = (token: string) => {
        dispatch('verified', token);
      };
      
      (window as any).onTurnstileError = (error: any) => {
        const errorMsg = typeof error === 'string' ? error : 
                       error?.message || 'Verification failed';
        errorMessage = errorMsg;
        dispatch('error', errorMsg);
      };
      
      (window as any).onTurnstileExpired = () => {
        errorMessage = 'Verification expired, please try again';
        dispatch('error', 'Verification expired, please try again');
      };
      
      // Load Turnstile script if not already loaded
      if (!document.getElementById('cloudflare-turnstile-script')) {
        const script = document.createElement('script');
        script.id = 'cloudflare-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }
    
    return () => {
      // Clean up when component is destroyed
      if (typeof window !== 'undefined') {
        delete (window as any).onTurnstileVerify;
        delete (window as any).onTurnstileError;
        delete (window as any).onTurnstileExpired;
      }
    };
  });
</script>

<div 
  class="cf-turnstile relative my-4" 
  data-sitekey={sitekey} 
  data-callback="onTurnstileVerify" 
  data-error-callback="onTurnstileError"
  data-expired-callback="onTurnstileExpired"
  bind:this={turnstileRef}
></div>

{#if errorMessage}
<p class="text-error-400-500 text-sm" role="alert">{errorMessage}</p>
{/if}