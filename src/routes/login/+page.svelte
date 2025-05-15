<script lang="ts">
        import { goto } from '$app/navigation';
        import { onMount } from 'svelte';
        import { loginUser, getGun, getUser } from '$lib/services/authService';
        import { userStore } from '$lib/stores/userStore';
        import TurnstileWidget from '$lib/components/auth/TurnstileWidget.svelte';
      
        let email = $state('bjorn@endogon.com');
        let password = $state('admin123');
        let isLoggingIn = $state(false);
        let error = $state('');
        let rememberMe = $state(true);
        let turnstileToken = $state('');
      
        const TURNSTILE_SITE_KEY = '<CLOUDFLARE_TURNSTILE_SITEKEY>';
      
        onMount(() => {
          if ($userStore.user) {
            goto('/dashboard');
          }
      
          const storedEmail = localStorage.getItem('polycentricity_email');
          if (storedEmail) {
            email = storedEmail;
          }
        });
      
        $effect(() => {
          if (isLoggingIn) {
            console.log('Login attempt in progress...');
          }
        });
      
        $effect(() => {
          if (error) {
            console.warn('Login error detected:', error);
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
      
          if (!email.trim() || !password) {
            error = 'Email and password are required';
            return;
          }
          
          if (!turnstileToken) {
            error = 'Please complete the Turnstile verification';
            return;
          }
      
          isLoggingIn = true;
          try {
            // First verify Turnstile token
            const isTurnstileValid = await verifyTurnstile(turnstileToken);
            
            if (!isTurnstileValid) {
              error = 'Turnstile verification failed. Please try again.';
              isLoggingIn = false;
              return;
            }
            
            const user = await loginUser(email, password);
            if (user) {
              console.log(`Login successful: ${user.user_id}`);
              
              // Update last_login timestamp
              const gun = getGun();
              const gunUser = getUser();
              
              if (gun && gunUser) {
                const timestamp = Date.now();
                gunUser.get("profile").get('last_login').putSigned(timestamp, (ack) => {
                  if (ack.err) console.error("Error updating last_login:", ack.err);
                });
                
                // Update in public users as well
                gun.get("users").get(user.user_id).get('last_login').put(timestamp);
              }
              
              if (rememberMe) {
                localStorage.setItem('polycentricity_email', email);
              } else {
                localStorage.removeItem('polycentricity_email');
              }
              try {
                await goto('/dashboard');
              } catch (navError) {
                console.error('Navigation error:', navError);
                window.location.href = '/dashboard';
              }
            } else {
              error = 'Invalid email or password';
            }
          } catch (err: any) {
            console.error('Login error:', err);
            error = err.message || 'An error occurred during login';
          } finally {
            isLoggingIn = false;
          }
        }
      </script>
      
      <div class="container h-full mx-auto flex justify-center items-center py-8">
        <div class="card p-4 w-full max-w-md bg-surface-100-800">
          <header class="card-header text-center">
            <h1 class="h2">Welcome Back</h1>
            <p class="opacity-70">Login to continue building your eco-village</p>
          </header>
      
          <section class="p-4">
            {#if error}
              <div class="alert variant-ghost-warning">
                <div class="alert-message">
                  <p class="text-sm">{error}</p>
                </div>
              </div>
            {/if}
      
            <form onsubmit={handleSubmit} class="space-y-4" id="login-form" name="login-form">
              <label class="label" for="email">
                <span>Email</span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  class="input"
                  value={email}
                  oninput={(e) => (email = e.currentTarget.value)}
                  placeholder="Enter your email"
                  autocomplete="email"
                  required
                />
              </label>
      
              <label class="label" for="password">
                <span>Password</span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  class="input"
                  value={password}
                  oninput={(e) => (password = e.currentTarget.value)}
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  required
                />
              </label>
              
              <TurnstileWidget 
                sitekey={TURNSTILE_SITE_KEY} 
                on:verified={handleTurnstileVerified}
                on:error={handleTurnstileError}
              />
      
              <label class="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  oninput={(e) => (rememberMe = e.currentTarget.checked)}
                  class="checkbox"
                />
                <span class="text-sm">Remember my email</span>
              </label>
      
              <button
                type="submit"
                class="btn variant-filled-primary w-full"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'Logging in...' : 'Login'}
              </button>
            </form>
      
            <div class="mt-4 text-center">
              <p>Don't have an account? <a href="/register" class="anchor">Register</a></p>
            </div>
          </section>
        </div>
      </div>