<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { registerUser, userExistsByEmail } from '$lib/services/authService';
  import { userStore } from '$lib/stores/userStore';
  import { sendVerificationEmail } from '$lib/services/emailService';
  import TurnstileWidget from '$lib/components/auth/TurnstileWidget.svelte';
  import { PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY } from '$env/static/public';

  // Form state with Svelte 5 Runes syntax
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let isRegistering = $state(false);
  let error = $state<string | null>(null);
  let turnstileToken = $state<string | null>(null);
  let isRegistrationComplete = $state(false);

  // Client-side validation with proper Svelte 5 Runes syntax
  const validationError = $derived(() => {
    if (!name.trim() || !email.trim() || !password) return 'All fields are required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
    if (password.length < 6) return 'Password must be at least 6 characters long';
    return null;
  });

  onMount(() => {
    // Check if user is already authenticated
    if ($userStore.isAuthenticated && $userStore.user) {
      goto('/dashboard');
    }
  });

  /**
   * Verify Turnstile token with the server
   * @param token The Turnstile token to verify
   * @returns Promise<boolean> indicating if verification succeeded
   */
  async function verifyTurnstile(token: string): Promise<boolean> {
    try {
      const response = await fetch('/api/turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      
      const data = await response.json();
      return !!data.success;
    } catch (err) {
      console.error('Turnstile verification error:', err);
      return false;
    }
  }
  
  /**
   * Handle Turnstile verification event
   * @param event CustomEvent with token as detail
   */
  function handleTurnstileVerified(event: CustomEvent<string>): void {
    turnstileToken = event.detail;
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(): Promise<void> {
    // Clear previous errors
    error = null;
    
    // Check for validation errors
    if (validationError) {
      error = validationError as string;
      return;
    }
    
    // Ensure turnstile verification has been completed
    if (!turnstileToken) {
      error = 'Please complete the Turnstile verification';
      return;
    }

    isRegistering = true;
    
    try {
      // First verify Turnstile token server-side
      const isTurnstileValid = await verifyTurnstile(turnstileToken);
      
      if (!isTurnstileValid) {
        error = 'Turnstile verification failed. Please try again.';
        return;
      }
    
      // Next check if the user already exists
      const userExists = await userExistsByEmail(email);
      if (userExists) {
        error = 'This email is already registered. Please try using a different email.';
        return;
      }
      
      // Register the user through the auth service
      const user = await registerUser(name, email, password);
      
      if (user) {
        // Send verification email
        await sendVerificationEmail(email, user.user_id, user.magic_key || '');
        
        // Show registration complete message
        isRegistrationComplete = true;
      } else {
        error = 'Registration failed. Please try again.';
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      
      // Handle special case for duplicate users
      if (typeof err === 'string' && err.includes('User already created')) {
        error = 'This email is already registered in the database. Please try using a different email.';
      } else {
        error = typeof err === 'string' ? err : err.message || 'An error occurred during registration';
      }
    } finally {
      isRegistering = false;
    }
  }
</script>

<div class="container h-full mx-auto flex justify-center items-center py-8">
  <div class="card p-4 w-full max-w-md shadow-lg bg-surface-50-950/90">
    <header class="card-header text-center">
      <h1 class="h2 text-primary-500-400">Create Account</h1>
      <p class="opacity-70 text-sm">Join Polycentricity3 and start building eco-villages</p>
    </header>

    <section class="p-4">
      {#if isRegistrationComplete}
        <div class="alert variant-filled-success" role="alert">
          <div class="alert-message">
            <h3 class="h4">Registration Successful!</h3>
            <p>A verification email has been sent to {email}. Please check your inbox and click the verification link to activate your account.</p>
          </div>
        </div>
        
        <div class="mt-4 text-center">
          <a href="/login" class="btn variant-filled-primary">Proceed to Login</a>
        </div>
      {:else}
        {#if error}
          <div class="alert variant-ghost-error" role="alert">
            <div class="alert-message">
              <p class="text-sm" id="error-message">{error}</p>
            </div>
          </div>
        {/if}
  
        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
          <label class="label">
            <span>Name</span>
            <input
              type="text"
              class="input variant-filled"
              bind:value={name}
              placeholder="Enter your name"
              required
              aria-describedby="error-message"
            />
          </label>
  
          <label class="label">
            <span>Email</span>
            <input
              type="email"
              class="input variant-filled"
              bind:value={email}
              placeholder="Enter your email"
              required
              aria-describedby="error-message"
            />
          </label>
  
          <label class="label">
            <span>Password</span>
            <input
              type="password"
              class="input variant-filled"
              bind:value={password}
              placeholder="Create a password"
              required
              aria-describedby="error-message"
            />
          </label>
          
          <TurnstileWidget 
            sitekey={PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY} 
            on:verified={handleTurnstileVerified}
          />
  
          <button
            type="submit"
            class="btn variant-filled-primary w-full"
            disabled={isRegistering}
          >
            {#if isRegistering}
              Creating Account...
            {:else}
              Register
            {/if}
          </button>
        </form>
  
        <div class="mt-4 text-center">
          <p class="text-sm">
            Already have an account? <a href="/login" class="anchor text-primary-500-400">Login</a>
          </p>
        </div>
      {/if}
    </section>
  </div>
</div>