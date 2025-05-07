<script lang="ts">
        import { getGun, getUser } from '$lib/services/gunService';
        import { userStore } from '$lib/stores/userStore';
        import type { User, UserSession } from '$lib/types';
        import { X } from '@lucide/svelte';
        import { createEventDispatcher } from 'svelte';

        // Define props using proper Svelte 5 Runes mode syntax
        const { open = false } = $props<{ open: boolean }>();
        
        // Create event dispatcher
        const dispatch = createEventDispatcher();
        
        // Form state
        let name = $state('');
        let email = $state('');
        let role = $state('Member');
        let isSubmitting = $state(false);
        let errorMessage = $state('');
        let successMessage = $state('');
        
        // Always update form with current user data when userStore changes
        $effect(() => {
                const user = userStore?.user;
                if (user) {
                        name = user.name || '';
                        email = user.email || '';
                        role = user.role || 'Member';
                        console.log('Updated form with user data:', { name, email, role });
                }
        });
        
        // Reset error messages and log when modal opens
        $effect(() => {
                if (open) {
                        console.log('Modal opened with current fields:', { name, email, role });
                        errorMessage = '';
                        successMessage = '';
                }
        });

        // Handle form submission
        async function handleSubmit(e: Event) {
                e.preventDefault();
                
                const currentUser = userStore?.user;
                if (!currentUser) {
                        errorMessage = 'No user is currently logged in';
                        return;
                }

                isSubmitting = true;
                errorMessage = '';
                successMessage = '';

                try {
                        const gun = getGun();
                        const user = getUser();
                        
                        if (!gun || !user) {
                                throw new Error('Gun or user not initialized');
                        }

                        const userData = {
                                ...currentUser,
                                name,
                                email,
                                role,
                                updated_at: Date.now()
                        };

                        // Update private SEA-encrypted profile
                        await new Promise<void>((resolve, reject) => {
                                user.get('profile').put(userData, (ack: any) => {
                                        if (ack.err) {
                                                reject(new Error(ack.err));
                                        } else {
                                                resolve();
                                        }
                                });
                        });

                        // Update public user record
                        gun.get('users').get(currentUser.user_id).put(userData);

                        // Update store
                        userStore.update((state: UserSession) => ({
                                ...state,
                                user: userData,
                        }));

                        successMessage = 'Profile updated successfully!';
                        
                        // Close after 1.5 seconds
                        setTimeout(() => {
                                dispatch('update:open', false);
                        }, 1500);
                } catch (error) {
                        console.error('Failed to update profile:', error);
                        errorMessage = `Failed to update profile: ${error instanceof Error ? error.message : 'Unknown error'}`;
                } finally {
                        isSubmitting = false;
                }
        }

        // Handle cancel
        function handleCancel() {
                dispatch('update:open', false);
        }
</script>

{#if open}
<div class="fixed inset-0 bg-surface-950-50/90 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
        <div class="card bg-surface-50-950/90 p-6 shadow-xl max-w-lg w-full m-4">
                <header class="flex justify-between items-start mb-4">
                        <div>
                                <h3 class="h3 text-primary-500">Update Profile</h3>
                                <p class="text-sm opacity-80">Update your account details below</p>
                        </div>
                        <button 
                                type="button" 
                                class="btn-icon preset-tonal-surface"
                                onclick={handleCancel}
                                aria-label="Close"
                        >
                                <X size={18} />
                        </button>
                </header>

                <form onsubmit={handleSubmit} class="space-y-5">
                        <!-- Name -->
                        <div class="space-y-2">
                                <label for="name-input" class="label font-medium">
                                        Name
                                </label>
                                <input
                                        id="name-input"
                                        type="text"
                                        class="input rounded-md border-primary-500/30"
                                        placeholder="Your name"
                                        value={name}
                                        oninput={(e) => (name = e.currentTarget.value)}
                                        required
                                />
                        </div>

                        <!-- Email Address -->
                        <div class="space-y-2">
                                <label for="email-input" class="label font-medium">
                                        Email Address
                                </label>
                                <input
                                        id="email-input"
                                        type="email"
                                        class="input rounded-md border-primary-500/30"
                                        placeholder="your.email@example.com"
                                        value={email}
                                        oninput={(e) => (email = e.currentTarget.value)}
                                        required
                                />
                        </div>

                        <!-- Role -->
                        <div class="space-y-2">
                                <label for="role-select" class="label font-medium">
                                        Role
                                </label>
                                <select 
                                        id="role-select"
                                        value={role}
                                        onchange={(e) => (role = e.currentTarget.value as 'Guest' | 'Member' | 'Admin')}
                                        class="select rounded-md border-primary-500/30"
                                >
                                        <option value="Guest">Guest</option>
                                        <option value="Member">Member</option>
                                        <option value="Admin">Admin</option>
                                </select>
                        </div>

                        <!-- Messages -->
                        {#if errorMessage}
                                <div class="alert preset-filled-error">
                                        <span>{errorMessage}</span>
                                </div>
                        {/if}
                        
                        {#if successMessage}
                                <div class="alert preset-filled-success">
                                        <span>{successMessage}</span>
                                </div>
                        {/if}

                        <!-- Form Actions -->
                        <div class="flex justify-end gap-4 pt-4">
                                <button
                                        type="button"
                                        class="btn preset-tonal-surface"
                                        onclick={handleCancel}
                                        disabled={isSubmitting}
                                >
                                        Cancel
                                </button>
                                <button 
                                        type="submit" 
                                        class="btn preset-filled-primary"
                                        disabled={isSubmitting}
                                >
                                        {#if isSubmitting}
                                                <span class="animate-pulse">Saving...</span>
                                        {:else}
                                                Save Changes
                                        {/if}
                                </button>
                        </div>
                </form>
        </div>
</div>
{/if}