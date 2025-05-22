<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { userStore } from "$lib/stores/userStore";
  import { loginUser } from "$lib/services/authService";
  import TurnstileWidget from "$lib/components/auth/TurnstileWidget.svelte";
  import { PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY } from "$env/static/public";

  // ─── State (Svelte 5 Runes) ──────────────────────────────────────────────
  let email = $state('');
  let password = $state('');
  let rememberMe = $state(true);
  let turnstileToken = $state<string | null>(null);
  let isLoggingIn = $state(false);
  let error = $state<string | null>(null);

  // Derived client-side validation
  const getValidationError = $derived(() => {
    if (!email.trim() || !password) return "Email and password are required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Invalid email format";
    if (password.length < 6) return "Password must be at least 6 characters";
    return null;
  });

  // Mirror validation into a displayable var
  let displayValidationError = $state<string | null>(null);
  $effect(() => {
    displayValidationError = getValidationError();
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────
  onMount(() => {
    if ($userStore.isAuthenticated && $userStore.user) {
      goto("/dashboard");
    }
    const saved = localStorage.getItem("polycentricity_email");
    if (saved) email = saved;
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

  async function handleSubmit() {
    // reset
    error = null;
    const validation = getValidationError();
    if (validation) {
      error = validation;
      return;
    }
    if (!turnstileToken) {
      error = "Please complete the Turnstile verification";
      return;
    }

    isLoggingIn = true;
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

      // 2️⃣ proceed with login
      const user = await loginUser(email, password);
      if (user) {
        if (rememberMe) {
          localStorage.setItem("polycentricity_email", email);
        } else {
          localStorage.removeItem("polycentricity_email");
        }
        await goto("/dashboard");
      } else {
        error = "Invalid email or password";
      }
    } catch (err: any) {
      console.error("Login error:", err);
      error =
        typeof err === "string"
          ? err
          : (err.message ?? "An error occurred during login");
    } finally {
      isLoggingIn = false;
    }
  }
</script>

<div class="container h-full mx-auto flex justify-center items-center py-8">
  <div class="card p-4 w-full max-w-md shadow-lg bg-surface-50-950-50/90">
    <header class="card-header text-center">
      <h1 class="h2 text-primary-500-400">Welcome Back</h1>
      <p class="opacity-70 text-sm">
        Login to continue building your eco-village
      </p>
    </header>

    <section class="p-4">
      {#if error}
        <div
          class="alert bg-error-500-400/20 border border-error-500-400 text-error-500-400"
          role="alert"
        >
          <div class="alert-message">
            <p class="text-sm" id="error-message">{error}</p>
          </div>
        </div>
      {/if}

      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        class="space-y-4"
        id="login-form"
        name="login-form"
      >
        <label class="label">
          <span>Email</span>
          <input
            id="email"
            name="email"
            type="email"
            class="input bg-surface-200-700-token border border-surface-300-600"
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
            class="input bg-surface-200-700-token border border-surface-300-600"
            bind:value={password}
            placeholder="Enter your password"
            autocomplete="current-password"
            required
            aria-describedby="error-message"
          />
        </label>

        <TurnstileWidget
          onVerified={handleTurnstileVerified}
          onError={handleTurnstileError}
        />

        <label class="flex items-center space-x-2 mb-4">
          <input
            type="checkbox"
            bind:checked={rememberMe}
            class="checkbox bg-primary-500-400/40 border border-primary-500-400"
          />
          <span class="text-sm">Remember my email</span>
        </label>

        <button
          type="submit"
          class="btn bg-primary-500 text-white w-full"
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
          Don't have an account? <a
            href="/register"
            class="anchor text-primary-500-400">Register</a
          >
        </p>
      </div>
    </section>
  </div>
</div>
