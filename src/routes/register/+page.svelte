<script lang="ts">
        import { goto } from '$app/navigation';
        import { onMount } from 'svelte';
        import { registerUser } from '$lib/services/authService';
        import { userStore } from '$lib/stores/userStore';
        
        // Using Svelte 5.25.9 Runes mode for reactive state
        let name = $state('');
        let email = $state('');
        let password = $state('');
        let isRegistering = $state(false);
        let error = $state('');
        
        // Check authentication status using $effect instead of onMount for better reactivity
        $effect(() => {
                if ($userStore.user) {
                        console.log('User already authenticated, redirecting to dashboard');
                        goto('/dashboard');
                }
        });
        
        // Monitor form values for validation using $effect
        $effect(() => {
                if (name && email && password) {
                        // Perform lightweight validation as user types
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (email && !emailRegex.test(email)) {
                                // Only show validation error if they've entered something
                                if (email.length > 3) {
                                        error = 'Please enter a valid email address';
                                }
                        } else {
                                // Clear error when valid
                                if (error === 'Please enter a valid email address') {
                                        error = '';
                                }
                        }
                }
        });
        
        // Watch registration status with $effect
        $effect(() => {
                if (isRegistering) {
                        console.log('Registration in progress...');
                }
        });
        
        /**
         * Handle form submission with robust error handling
         * Using async/await with structured error management
         */
        async function handleSubmit() {
                // Reset error state
                error = '';
                
                // Validate form - more comprehensive validation here
                if (!name.trim() || !email.trim() || !password) {
                        error = 'All fields are required';
                        return;
                }
                
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                        error = 'Please enter a valid email address';
                        return;
                }
                
                // Password strength validation
                if (password.length < 6) {
                        error = 'Password must be at least 6 characters long';
                        return;
                }
                
                // Set loading state
                isRegistering = true;
                
                try {
                        const user = await registerUser(name, email, password);
                        
                        if (user) {
                                console.log(`Registered user: ${user.user_id}`);
                                
                                // Navigate with error handling
                                try {
                                        await goto('/dashboard');
                                } catch (navError) {
                                        console.error('Navigation error:', navError);
                                        // Fallback if navigation fails
                                        window.location.href = '/dashboard';
                                }
                        } else {
                                error = 'Registration failed. Please try again.';
                        }
                } catch (err: any) {
                        console.error('Registration error:', err);
                        // Show the actual error message from Gun.js
                        error = typeof err === 'string' ? err : 
                               (err.message || 'An error occurred during registration');
                        
                        // Add more specific error message for common cases
                        if (err?.includes && err.includes('User already created')) {
                                error = 'This email is already registered. Please log in or use a different email.';
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
                        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
                                {#if error}
                                        <div class="alert variant-ghost-warning">
                                                <div class="alert-message">
                                                        <p class="text-sm">{error}</p>
                                                </div>
                                        </div>
                                {/if}
                                
                                <label class="label">
                                        <span>Name</span>
                                        <input 
                                                type="text" 
                                                class="input" 
                                                bind:value={name} 
                                                placeholder="Enter your name"
                                                required
                                        />
                                </label>
                                
                                <label class="label">
                                        <span>Email</span>
                                        <input 
                                                type="email" 
                                                class="input" 
                                                bind:value={email} 
                                                placeholder="Enter your email"
                                                required
                                        />
                                </label>
                                
                                <label class="label">
                                        <span>Password</span>
                                        <input 
                                                type="password" 
                                                class="input" 
                                                bind:value={password} 
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
                </section>
        </div>
</div>
