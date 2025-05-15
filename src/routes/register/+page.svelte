<script lang="ts">
        import { goto } from '$app/navigation';
        import { onMount } from 'svelte';
        import { registerUser, userExistsByEmail } from '$lib/services/authService';
        import { userStore } from '$lib/stores/userStore';
        import { sendVerificationEmail } from '$lib/services/emailService';
        import TurnstileWidget from '$lib/components/auth/TurnstileWidget.svelte';
      
        let name = $state('');
        let email = $state('');
        let password = $state('');
        let isRegistering = $state(false);
        let error = $state('');
        let turnstileToken = $state('');
        let isRegistrationComplete = $state(false);
      
        const TURNSTILE_SITE_KEY = '<CLOUDFLARE_TURNSTILE_SITEKEY>';
      
        onMount(() => {
          if ($userStore.user) {
            console.log('User already authenticated, redirecting to dashboard');
            goto('/dashboard');
          }
        });
      
        const validationError = $derived(
          name && email && password
            ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
              ? 'Please enter a valid email address'
              : password.length < 6
              ? 'Password must be at least 6 characters long'
              : ''
            : ''
        );
      
        $effect(() => {
          if (validationError) {
            error = validationError;
          }
        });
      
        $effect(() => {
          if (isRegistering) {
            console.log('Registration in progress...');
          }
        });
        
        async function verifyTurnstile(token: string) {
          try {
            const response = await fetch('/api/turnstile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            return data.success;
          } catch (err) {
            console.error('Turnstile verification error:', err);
            return false;
          }
        }
        
        function handleTurnstileVerified(event: CustomEvent<string>) {
          turnstileToken = event.detail;
        }
        
        function handleTurnstileError(event: CustomEvent<string>) {
          error = `Turnstile error: ${event.detail}`;
        }
      
        async function handleSubmit(e: Event) {
          e.preventDefault();
          error = '';
      
          if (!name.trim() || !email.trim() || !password) {
            error = 'All fields are required';
            return;
          }
      
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            error = 'Please enter a valid email address';
            return;
          }
      
          if (password.length < 6) {
            error = 'Password must be at least 6 characters long';
            return;
          }
          
          if (!turnstileToken) {
            error = 'Please complete the Turnstile verification';
            return;
          }
      
          isRegistering = true;
          
          try {
            // First verify Turnstile token
            const isTurnstileValid = await verifyTurnstile(turnstileToken);
            
            if (!isTurnstileValid) {
              error = 'Turnstile verification failed. Please try again.';
              isRegistering = false;
              return;
            }
          
            // Next check if the user already exists
            const userExists = await userExistsByEmail(email);
            if (userExists) {
              error = 'This email is already registered. Please try using a different email.';
              isRegistering = false;
              return;
            }
            
            // If we get here, the user doesn't exist, so try to register
            console.log(`User doesn't exist, proceeding with registration for: ${email}`);
            const user = await registerUser(name, email, password);
            
            if (user) {
              console.log(`Successfully registered user: ${user.user_id}`);
              
              // Send verification email
              await sendVerificationEmail(email, user.user_id, user.magic_key || '');
              
              // Show registration complete message
              isRegistrationComplete = true;
            } else {
              error = 'Registration failed. Please try again.';
            }
          } catch (err: any) {
            console.error('Registration error:', err);
            error =
              typeof err === 'string'
                ? err
                : err.message || 'An error occurred during registration';
            
            // Check for the common "User already created" error
            if (err?.includes && err.includes('User already created')) {
              error = 'This email is already registered in the database. Please try using a different email.';
            }
          } finally {
            isRegistering = false;
          }
        }
      </script>
      
      <div class="container h-full mx-auto flex justify-center items-center py-8">
        <div class="card p-4 w-full max-w-md bg-surface-100-800">
          <header class="card-header text-center">
            <h1 class="h2">Create Account</h1>
            <p class="opacity-70">Join Polycentricity3 and start building eco-villages</p>
          </header>
      
          <section class="p-4">
            {#if isRegistrationComplete}
              <div class="alert variant-filled-success">
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
                <div class="alert variant-ghost-warning">
                  <div class="alert-message">
                    <p class="text-sm">{error}</p>
                  </div>
                </div>
              {/if}
        
              <form onsubmit={handleSubmit} class="space-y-4">
                <label class="label">
                  <span>Name</span>
                  <input
                    type="text"
                    class="input"
                    value={name}
                    oninput={(e) => (name = e.currentTarget.value)}
                    placeholder="Enter your name"
                    required
                  />
                </label>
        
                <label class="label">
                  <span>Email</span>
                  <input
                    type="email"
                    class="input"
                    value={email}
                    oninput={(e) => (email = e.currentTarget.value)}
                    placeholder="Enter your email"
                    required
                  />
                </label>
        
                <label class="label">
                  <span>Password</span>
                  <input
                    type="password"
                    class="input"
                    value={password}
                    oninput={(e) => (password = e.currentTarget.value)}
                    placeholder="Create a password"
                    required
                  />
                </label>
                
                <TurnstileWidget 
                  sitekey={TURNSTILE_SITE_KEY} 
                  on:verified={handleTurnstileVerified}
                  on:error={handleTurnstileError}
                />
        
                <button
                  type="submit"
                  class="btn variant-filled-primary w-full"
                  disabled={isRegistering}
                >
                  {isRegistering ? 'Creating Account...' : 'Register'}
                </button>
              </form>
        
              <div class="mt-4 text-center">
                <p>Already have an account? <a href="/login" class="anchor">Login</a></p>
              </div>
            {/if}
          </section>
        </div>
      </div>