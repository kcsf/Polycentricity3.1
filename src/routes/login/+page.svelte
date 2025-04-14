<script lang="ts">
        import { goto } from '$app/navigation';
        import { onMount } from 'svelte';
        import { loginUser } from '$lib/services/authService';
        import { userStore } from '$lib/stores/userStore';
        
        // Pre-populate with Bjorn's credentials for easy testing
        let email = 'bjorn@endogon.com';
        let password = 'admin123';
        let isLoggingIn = false;
        let error = '';
        let rememberMe = true;
        
        onMount(() => {
                // Check if user is already logged in, redirect to dashboard if true
                if ($userStore.user) {
                        goto('/dashboard');
                }
                
                // Attempt to get stored credentials from localStorage
                const storedEmail = localStorage.getItem('polycentricity_email');
                if (storedEmail) {
                        email = storedEmail;
                }
        });
        
        async function handleSubmit() {
                // Reset error
                error = '';
                
                // Validate form
                if (!email.trim() || !password) {
                        error = 'Email and password are required';
                        return;
                }
                
                // Set loading state
                isLoggingIn = true;
                
                try {
                        const user = await loginUser(email, password);
                        
                        if (user) {
                                console.log(`Login successful: ${user.user_id}`);
                                
                                // Save email to localStorage if remember me is checked
                                if (rememberMe) {
                                        localStorage.setItem('polycentricity_email', email);
                                } else {
                                        localStorage.removeItem('polycentricity_email');
                                }
                                
                                goto('/dashboard');
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
        <div class="card p-4 w-full max-w-md">
                <header class="card-header text-center">
                        <h1 class="h2">Welcome Back</h1>
                        <p class="opacity-70">Login to continue building your eco-village</p>
                </header>
                
                <section class="p-4">
                        <form method="post" on:submit|preventDefault={handleSubmit} class="space-y-4" id="login-form" name="login-form">
                                {#if error}
                                        <div class="alert variant-ghost-warning">
                                                <div class="alert-message">
                                                        <p class="text-sm">{error}</p>
                                                </div>
                                        </div>
                                {/if}
                                
                                <label class="label" for="email">
                                        <span>Email</span>
                                        <input 
                                                id="email"
                                                name="email"
                                                type="email" 
                                                class="input" 
                                                bind:value={email} 
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
                                                bind:value={password} 
                                                placeholder="Enter your password"
                                                autocomplete="current-password"
                                                required
                                        />
                                </label>
                                
                                <label class="flex items-center space-x-2 mb-4">
                                        <input 
                                                type="checkbox" 
                                                bind:checked={rememberMe}
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
