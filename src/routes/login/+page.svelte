<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  import { loginUser } from '$lib/services/authService';
  import { PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY } from '$env/static/public';
  import TurnstileWidget from '$lib/components/auth/TurnstileWidget.svelte';

  let email = $state('bjorn@endogon.com');
  let password = $state('admin123');
  let rememberMe = $state(true);
  let turnstileToken = $state<string | null>(null);
  let isLoggingIn = $state(false);
  let error = $state<string | null>(null);

  // Client-side validation with proper Svelte 5 Runes syntax
  const validationError = $derived(() => {
    if (!email.trim() || !password) return 'Email and password are required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return null;
  });

  onMount(() => {
    // Check if user is already authenticated
    if ($userStore.isAuthenticated && $userStore.user) {
      goto('/dashboard');
    }
    
    // Load saved email if available
    const storedEmail = localStorage.getItem('polycentricity_email');
    if (storedEmail) {
      email = storedEmail;
    }
  });

  async function handleSubmit() {
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

    isLoggingIn = true;
    
    try {
      // Verify Turnstile token server-side
      const isTurnstileValid = await verifyTurnstile(turnstileToken);
      
      if (!isTurnstileValid) {
        error = 'Turnstile verification failed. Please try again.';
        return;
      }
      
      // Call the loginUser service function (properly using the auth service)
      const user = await loginUser(email, password);
      
      if (user) {
        // Save email preference if 'remember me' is checked
        if (rememberMe) {
          localStorage.setItem('polycentricity_email', email);
        } else {
          localStorage.removeItem('polycentricity_email');
        }
        await goto('/dashboard');
      } else {
        error = 'Invalid email or password';
      }
    } catch (err: any) {
      console.error('Login error:', err);
      error = typeof err === 'string' ? err : err.message || 'An error occurred during login';
    } finally {
      isLoggingIn = false;
    }
  }

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

  function handleTurnstileVerified(event: CustomEvent<string>): void {
    turnstileToken = event.detail;
  }
</script>

<div class="container h-full mx-auto flex justify-center items-center py-8">
  <div class="card p-4 w-full max-w-md shadow-lg bg-surface-50-950/90">
    <header class="card-header text-center">
      <h1 class="h2 text-primary-500-400">Welcome Back</h1>
      <p class="opacity-70 text-sm">Login to continue building your eco-village</p>
    </header>

    <section class="p-4">
      {#if error}
        <div class="alert variant-ghost-error" role="alert">
          <div class="alert-message">
            <p class="text-sm" id="error-message">{error}</p>
          </div>
        </div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4" id="login-form" name="login-form">
        <label class="label">
          <span>Email</span>
          <input
            id="email"
            name="email"
            type="email"
            class="input variant-filled"
            bind:value={email}
            placeholder="Enter your email"
            autocomplete="email"
            required
            aria-describedby="error-message"
          />
        </label>

        <label class="label">
          <span>Password</span>
          <input
            id="password"
            name="password"
            type="password"
            class="input variant-filled"
            bind:value={password}
            placeholder="Enter your password"
            autocomplete="current-password"
            required
            aria-describedby="error-message"
          />
        </label>

        <TurnstileWidget
          sitekey={PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY}
          on:verified={handleTurnstileVerified}
        />

        <label class="flex items-center space-x-2 mb-4">
          <input
            type="checkbox"
            bind:checked={rememberMe}
            class="checkbox variant-filled"
          />
          <span class="text-sm">Remember my email</span>
        </label>

        <button
          type="submit"
          class="btn variant-filled-primary w-full"
          disabled={isLoggingIn}
        >
          {#if isLoggingIn}
            Logging in...
          {:else}
            Login
          {/if}
        </button>
      </form>

      <div class="mt-4 text-center">
        <p class="text-sm">
          Don't have an account? <a href="/register" class="anchor text-primary-500-400">Register</a>
        </p>
      </div>
    </section>
  </div>
</div>