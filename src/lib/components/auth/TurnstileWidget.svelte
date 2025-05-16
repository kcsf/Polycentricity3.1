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
  let forceMockVerification = $state(false);
  
  // Check for development mode or Replit environment (both need mock verification)
  const isDev = typeof import.meta !== 'undefined' && 
                import.meta.env && 
                (import.meta.env.DEV || 
                 import.meta.env.REPLIT_CLUSTER || 
                 window.location.hostname.includes('replit.app'));

  // Generate a mock verification token for development environments
  function generateMockToken(): string {
    return `dev-mock-${Math.random().toString(36).substring(2, 10)}`;
  }
  
  // Handle verification directly for development environments
  function handleDevVerification(): void {
    const mockToken = generateMockToken();
    console.log('Development mode: Using mock verification token:', mockToken);
    onVerified?.(mockToken);
  }
  
  // Renders or resets the Turnstile widget
  function renderTurnstile(): void {
    // In development mode, we won't actually load the Turnstile widget
    if (isDev) {
      if (forceMockVerification) {
        handleDevVerification();
        forceMockVerification = false;
      }
      return;
    }
    
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
          console.warn('Turnstile error:', msg);
          
          // Auto-fall back to mock verification in development environments
          if (isDev) {
            console.log('Falling back to mock verification in development mode');
            handleDevVerification();
          } else {
            onError?.(msg);
          }
        },
        'expired-callback': () => {
          const msg = 'Verification expired, please try again';
          errorMessage = msg;
          onError?.(msg);
        },
        theme: 'auto'
      });
    } catch (e) {
      const msg = 'Error initializing verification widget';
      console.error('Turnstile initialization error:', e);
      errorMessage = msg;
      
      // Auto-fall back to mock verification in development environments
      if (isDev) {
        console.log('Falling back to mock verification in development mode');
        handleDevVerification();
      } else {
        onError?.(msg);
      }
    }
  }

  onMount(() => {
    if (typeof window === 'undefined') return;

    // In development mode, we don't need to load the actual Turnstile script
    if (isDev) {
      console.log('Development mode: Skipping Turnstile script loading');
      scriptLoaded = true;
      // We don't automatically verify here - user must click the button
      return;
    }

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
      script.onerror = () => {
        console.error('Failed to load Turnstile script');
        errorMessage = 'Failed to load verification service';
        // If we're in a Replit environment, fall back to mock verification
        if (isDev) {
          console.log('Falling back to mock verification in development mode');
          scriptLoaded = true;
        }
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
        onclick={() => handleDevVerification()}
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