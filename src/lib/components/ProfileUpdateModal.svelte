<script lang="ts">
        import { getGun, getUser } from '$lib/services/gunService';
        import { userStore } from '$lib/stores/userStore';
        import type { User, UserSession } from '$lib/types';
        import { X } from '@lucide/svelte';

        // Define props with bindable properties
        let open = $props.open ?? false;
        let { open: bindableOpen } = $props.bindable();

        // Get current user from store
        const currentUser = $derived(userStore?.user || null);

        // Local form state
        let name = $state(currentUser?.name || '');
        let email = $state(currentUser?.email || '');
        let role = $state(currentUser?.role || 'Member');
        let isSubmitting = $state(false);
        let errorMessage = $state('');
        let successMessage = $state('');

        // Reset form when opened
        $effect(() => {
                if (open && currentUser) {
                        name = currentUser.name || '';
                        email = currentUser.email || '';
                        role = currentUser.role || 'Member';
                        errorMessage = '';
                        successMessage = '';
                }
        });

        // Handle form submission
        async function handleSubmit(e: Event) {
                e.preventDefault();
                
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
                                bindableOpen = false; // Use bindable prop for two-way binding
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
                bindableOpen = false; // Use bindable prop for two-way binding
        }
</script>

{#if open}
<div class="fixed inset-0 bg-surface-900-50/90 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
        <div class="card p-6 shadow-xl max-w-lg w-full m-4">
                <header class="flex justify-between items-start mb-4">
                        <div>
                                <h3 class="h3 text-primary-600-300">Update Profile</h3>
                                <p class="text-sm text-surface-600-300">Update your account details below</p>
                        </div>
                        <button 
                                type="button" 
                                class="btn-icon variant-soft-surface"
                                onclick={handleCancel}
                                aria-label="Close"
                        >
                                <X size={18} />
                        </button>
                </header>

                <form onsubmit={handleSubmit} class="space-y-4">
                        <!-- Name -->
                        <div class="space-y-1">
                                <label for="name-input" class="label">
                                        Name
                                </label>
                                <input
                                        id="name-input"
                                        type="text"
                                        class="input"
                                        placeholder="Your name"
                                        value={name}
                                        oninput={(e) => (name = e.currentTarget.value)}
                                        required
                                />
                        </div>

                        <!-- Email Address -->
                        <div class="space-y-1">
                                <label for="email-input" class="label">
                                        Email Address
                                </label>
                                <input
                                        id="email-input"
                                        type="email"
                                        class="input"
                                        placeholder="your.email@example.com"
                                        value={email}
                                        oninput={(e) => (email = e.currentTarget.value)}
                                        required
                                />
                        </div>

                        <!-- Role -->
                        <div class="space-y-1">
                                <label for="role-select" class="label">
                                        Role
                                </label>
                                <select 
                                        id="role-select"
                                        value={role}
                                        onchange={(e) => (role = e.currentTarget.value as 'Guest' | 'Member' | 'Admin')}
                                        class="select"
                                >
                                        <option value="Guest">Guest</option>
                                        <option value="Member">Member</option>
                                        <option value="Admin">Admin</option>
                                </select>
                        </div>

                        <!-- Messages -->
                        {#if errorMessage}
                                <div class="alert variant-filled-error">
                                        <span>{errorMessage}</span>
                                </div>
                        {/if}
                        
                        {#if successMessage}
                                <div class="alert variant-filled-success">
                                        <span>{successMessage}</span>
                                </div>
                        {/if}

                        <!-- Form Actions -->
                        <div class="flex justify-end gap-4 pt-2">
                                <button
                                        type="button"
                                        class="btn variant-soft-surface"
                                        onclick={handleCancel}
                                        disabled={isSubmitting}
                                >
                                        Cancel
                                </button>
                                <button 
                                        type="submit" 
                                        class="btn variant-filled-primary"
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