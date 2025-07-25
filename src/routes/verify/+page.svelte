<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { verifyUser } from '$lib/services/authService';
  import { Check, X } from '@lucide/svelte';
  
  let isVerifying = $state(true);
  let isSuccess = $state(false);
  let isError = $state(false);
  let errorMessage = $state('');
  
  onMount(async () => {
    const url = new URL(window.location.href);
    
    // Get and properly decode URL parameters
    let userId = url.searchParams.get('userId');
    let magicKey = url.searchParams.get('magicKey');
    
    // Log parameters for debugging
    console.log('Verification attempt with userId:', userId, 'magicKey:', magicKey);
    
    if (!userId || !magicKey) {
      isVerifying = false;
      isError = true;
      errorMessage = 'Invalid verification link. Missing required parameters.';
      return;
    }
    
    try {
      // Ensure parameters are properly decoded
      userId = decodeURIComponent(userId);
      magicKey = decodeURIComponent(magicKey);
      
      // Attempt to verify the user
      console.log('Attempting to verify user with ID:', userId);
      const success = await verifyUser(userId, magicKey);
      
      isVerifying = false;
      isSuccess = success;
      isError = !success;
      
      if (!success) {
        errorMessage = 'Verification failed. The link may be expired or invalid.';
      } else {
        // Redirect to login after short delay
        setTimeout(() => {
          goto('/login');
        }, 3000);
      }
    } catch (error: any) {
      console.error('Verification error details:', error);
      isVerifying = false;
      isError = true;
      errorMessage = typeof error === 'string' ? error : error.message || 'An unexpected error occurred during verification.';
    }
  });
</script>

<div class="container h-full mx-auto flex justify-center items-center py-8">
  <div class="card p-4 w-full max-w-md bg-surface-100-800 shadow-lg">
    <header class="card-header text-center">
      <h1 class="h2">Email Verification</h1>
    </header>
    
    <section class="p-4 text-center">
      {#if isVerifying}
        <div class="flex flex-col items-center justify-center gap-4">
          <div class="spinner-border h-10 w-10" role="status" aria-hidden="true"></div>
          <p>Verifying your email address...</p>
        </div>
      {:else if isSuccess}
        <div class="flex flex-col items-center justify-center gap-4">
          <div class="bg-success-100-700 text-success-500-300 rounded-full p-3">
            <Check size={24} />
          </div>
          <p class="text-lg font-semibold">Your email has been verified!</p>
          <p>Your account has been upgraded to Member status.</p>
          <p class="text-sm">Redirecting to login page...</p>
        </div>
      {:else if isError}
        <div class="flex flex-col items-center justify-center gap-4">
          <div class="bg-error-100-700 text-error-500-300 rounded-full p-3">
            <X size={24} />
          </div>
          <p class="text-lg font-semibold">Verification Failed</p>
          <p>{errorMessage}</p>
          <a href="/register" class="btn bg-primary-500 text-white">Register Again</a>
        </div>
      {/if}
    </section>
  </div>
</div>