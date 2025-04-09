<script lang="ts">
        import { goto } from '$app/navigation';
        import { onMount } from 'svelte';
        import { registerUser } from '$lib/services/authService';
        import { userStore } from '$lib/stores/userStore';
        
        let name = '';
        let email = '';
        let password = '';
        let confirmPassword = '';
        let isRegistering = false;
        let error = '';
        
        onMount(() => {
                // Check if user is already logged in, redirect to dashboard if true
                if ($userStore.user) {
                        goto('/dashboard');
                }
        });
        
        async function handleSubmit() {
                // Reset error
                error = '';
                
                // Validate form
                if (!name.trim() || !email.trim() || !password || !confirmPassword) {
                        error = 'All fields are required';
                        return;
                }
                
                if (password !== confirmPassword) {
                        error = 'Passwords do not match';
                        return;
                }
                
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                        error = 'Please enter a valid email address';
                        return;
                }
                
                // Set loading state
                isRegistering = true;
                
                try {
                        const user = await registerUser(name, email, password);
                        
                        if (user) {
                                console.log(`Registered user: ${user.user_id}`);
                                goto('/dashboard');
                        } else {
                                error = 'Registration failed. Please try again.';
                        }
                } catch (err: any) {
                        console.error('Registration error:', err);
                        // Show the actual error message from Gun.js
                        error = typeof err === 'string' ? err : 
                               (err.message || 'An error occurred during registration');
                        
                        // Add more specific error message for common cases
                        if (err.includes && err.includes('User already created')) {
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
                        <form on:submit|preventDefault={handleSubmit} class="space-y-4">
                                {#if error}
                                        <div class="alert variant-filled-error">
                                                <p>{error}</p>
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
                                
                                <label class="label">
                                        <span>Confirm Password</span>
                                        <input 
                                                type="password" 
                                                class="input" 
                                                bind:value={confirmPassword} 
                                                placeholder="Confirm your password"
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
