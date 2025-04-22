<script lang="ts">
        import { goto } from '$app/navigation';
        import { onMount } from 'svelte';
        import { registerUser, userExistsByEmail } from '$lib/services/authService';
        import { userStore } from '$lib/stores/userStore';
        import { clearUserFromGun, resetGunAuth } from '$lib/services/gunResetService';
      
        let name = $state('');
        let email = $state('');
        let password = $state('');
        let isRegistering = $state(false);
        let isClearing = $state(false);
        let error = $state('');
        let showResetControls = $state(false);
      
        onMount(() => {
          if ($userStore.user) {
            console.log('User already authenticated, redirecting to dashboard');
            goto('/dashboard');
          }
          
          // Allow developer mode via query parameter
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('debug') === 'true') {
            showResetControls = true;
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
        
        async function handleClearUser() {
          if (!email.trim()) {
            error = 'Please enter an email to clear';
            return;
          }
          
          isClearing = true;
          try {
            await clearUserFromGun(email);
            error = `Cleared user ${email} from Gun's authentication system. Try registering again.`;
          } catch (err) {
            console.error('Error clearing user:', err);
            error = 'Failed to clear user. See console for details.';
          } finally {
            isClearing = false;
          }
        }
        
        async function handleResetGun() {
          if (confirm('This will clear all Gun authentication data. Continue?')) {
            resetGunAuth();
          }
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
      
          isRegistering = true;
          
          try {
            // First check if the user already exists
            const userExists = await userExistsByEmail(email);
            if (userExists) {
              error = 'This email is already registered. Try using a different email or accessing debug mode to clear it.';
              showResetControls = true;
              isRegistering = false;
              return;
            }
            
            // If we get here, the user doesn't exist, so try to register
            console.log(`User doesn't exist, proceeding with registration for: ${email}`);
            const user = await registerUser(name, email, password);
            
            if (user) {
              console.log(`Successfully registered user: ${user.user_id}`);
              try {
                await goto('/dashboard');
              } catch (navError) {
                console.error('Navigation error:', navError);
                window.location.href = '/dashboard';
              }
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
              error = 'This email is already registered in Gun but we couldn\'t detect it beforehand. Try using the debug mode to clear it.';
              showResetControls = true;
            }
          } finally {
            isRegistering = false;
          }
        }
      </script>
      
      <div class="container h-full mx-auto flex justify-center items-center py-8">
        <div class="card p-4 w-full max-w-md">
          <header class="card-header text-center">
            <h1 class="h2">Create Account</h1>
            <p class="opacity-70">Join Polycentricity3 and start building eco-villages</p>
          </header>
      
          <section class="p-4">
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
            
            {#if showResetControls}
              <hr class="my-4" />
              <div class="space-y-4">
                <h3 class="h4 text-center">Debug Tools</h3>
                <p class="text-xs text-center opacity-60">Warning: These actions affect Gun.js user data</p>
                
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class="btn variant-ghost-error"
                    onclick={handleClearUser}
                    disabled={isClearing}
                  >
                    {isClearing ? 'Clearing...' : 'Clear User Data'}
                  </button>
                  
                  <button
                    type="button"
                    class="btn variant-ghost-error"
                    onclick={handleResetGun}
                  >
                    Reset Gun Auth
                  </button>
                </div>
              </div>
            {/if}
          </section>
        </div>
      </div>