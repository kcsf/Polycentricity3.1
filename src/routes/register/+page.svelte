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

  // Use a state variable to hold the current validation error
  let displayValidationError = $state<
    'All fields are required' | 'Please enter a valid email address' | 'Password must be at least 6 characters long' | null
  >(null);

  $effect(() => {
    displayValidationError = validationError(); // Call the function to get the value
  });

  onMount(() => {
    // Check if user is already authenticated
    if ($userStore.isAuthenticated && $userStore.user) {
      goto('/dashboard');
    }
  });

  // ─── Handlers ──────────────────────────────────────────────────────────
  function handleTurnstileVerified(token: string) {
    turnstileToken = token;
    error = null;
  }
  
  function handleTurnstileError(msg: string) {
    error = msg;
    turnstileToken = null;
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(): Promise<void> {
    // Clear previous errors
    error = null;

    // Check for validation errors
    if (displayValidationError !== null) {
      error = displayValidationError;
      return;
    }

    // Ensure turnstile verification has been completed
    if (!turnstileToken) {
      error = 'Please complete the Turnstile verification';
      return;
    }

    isRegistering = true;

    try {
      // 1️⃣ verify token on your server
      const resp = await fetch("/api/turnstile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const data = await resp.json();
      if (!data.success) {
        error = "Turnstile verification failed. Please try again.";
        turnstileToken = null;
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
  <div class="card p-4 w-full max-w-md shadow-lg bg-surface-50-950-50/90">
    <header class="card-header text-center">
      <h1 class="h2 text-primary-500-400">Create Account</h1>
      <p class="opacity-70 text-sm">Join Polycentricity3 and start building eco-villages</p>
    </header>

    <section class="p-4">
      {#if isRegistrationComplete}
        <div class="card p-6 bg-surface-100-800 border border-success-500-400 shadow-lg" role="alert">
          <h2 class="h3 text-center text-success-600-300 mb-4">Registration Successful!</h2>
          <p class="text-center mb-4">
            A verification email has been sent to <span class="font-semibold">{email}</span>. 
            Please check your inbox and click the verification link to activate your account.
          </p>
          
          <div class="flex justify-center mt-6">
            <a href="/login" class="btn bg-primary-500 text-white hover:bg-primary-600-300 transition-colors">
              Proceed to Login
            </a>
          </div>
        </div>
      {:else}
        {#if error}
          <div class="alert bg-error-500-400/20 border border-error-500-400 text-error-500-400" role="alert">
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
              class="input bg-surface-200-700-token border border-surface-300-600"
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
              class="input bg-surface-200-700-token border border-surface-300-600"
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
              class="input bg-surface-200-700-token border border-surface-300-600"
              bind:value={password}
              placeholder="Create a password"
              required
              aria-describedby="error-message"
            />
          </label>

          <TurnstileWidget
            onVerified={(token: string) => {
              console.log('Turnstile verification received');
              turnstileToken = token;
            }}
            onError={(msg: string) => {
              error = msg;
            }}
          />

          <button
            type="submit"
            class="btn bg-primary-500 text-white w-full"
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