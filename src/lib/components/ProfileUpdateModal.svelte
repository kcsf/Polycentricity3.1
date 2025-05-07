<script lang="ts">
        import { get } from 'svelte/store';
        import { userStore, setUser } from '$lib/stores/userStore';
        import { getGun, getUser, put } from '$lib/services/gunService';
        import { nodes } from '$lib/services/gunService';
        import type { User } from '$lib/types';
        import { toastStore, type ToastSettings } from '@skeletonlabs/skeleton';
        import { X } from '@lucide/svelte';

        // Define props using $props()
        const { open = false, onClose = null } = $props<{
                open: boolean;
                onClose?: (() => void) | null;
        }>();

        // Local reactive state
        let formUser = $state<User>({
                user_id: '',
                name: '',
                email: '',
                role: 'Member',
                created_at: 0,
        });
        let isSubmitting = $state(false);
        let errorMessage = $state('');

        // When the modal opens, populate the form with current user data
        $effect(() => {
                if (open && get(userStore).user) {
                        const currentUser = get(userStore).user!;
                        formUser = { ...currentUser };
                }
        });

        // Handle form submission to update the user profile
        async function handleSubmit(event: Event) {
                event.preventDefault();
                
                if (!formUser || !formUser.user_id) {
                        setError('No user data available');
                        return;
                }
                
                isSubmitting = true;
                errorMessage = '';

                try {
                        const gun = getGun();
                        const user = getUser();
                        
                        if (!gun || !user) {
                                throw new Error('Database not ready');
                        }

                        // First update the user's own private profile
                        await new Promise<void>((resolve, reject) => {
                                user.get('profile').put(formUser, (ack: any) => {
                                        if (ack.err) {
                                                reject(new Error(ack.err));
                                        } else {
                                                resolve();
                                        }
                                });
                        });

                        // Then update the public users record
                        const result = await put(`${nodes.users}/${formUser.user_id}`, formUser);
                        
                        if (result.err) {
                                throw new Error(result.err);
                        }

                        // Update the store
                        setUser(formUser);
                        
                        // Show success message
                        showToast('Profile updated successfully!', 'success');
                        
                        // Close the modal
                        handleClose();
                } catch (error: any) {
                        console.error('Failed to update profile:', error);
                        setError(error.message || 'Failed to update profile. Please try again.');
                } finally {
                        isSubmitting = false;
                }
        }

        // Set error message and optionally show toast
        function setError(message: string, showToastMessage = true) {
                errorMessage = message;
                if (showToastMessage) {
                        showToast(message, 'error');
                }
        }

        // Show toast notification
        function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
                const toast: ToastSettings = {
                        message,
                        background: type === 'success' ? 'variant-filled-success' :
                                  type === 'error' ? 'variant-filled-error' :
                                  type === 'warning' ? 'variant-filled-warning' :
                                  'variant-filled-primary',
                        timeout: 3000,
                };
                toastStore.trigger(toast);
        }

        // Handle modal close
        function handleClose() {
                if (onClose) {
                        onClose();
                } else {
                        dispatchEvent(new CustomEvent('updateOpen', { detail: { open: false } }));
                }
        }
</script>

<!-- Modal wrapper -->
{#if open}
<div class="modal-backdrop">
        <div class="modal-container">
                <div class="modal card p-0 w-modal shadow-xl">
                        <!-- Header -->
                        <header class="card-header p-4 flex justify-between items-center">
                                <div>
                                        <h3 class="h3">Update Profile</h3>
                                        <p class="opacity-75">Update your account details below</p>
                                </div>
                                <button 
                                        class="btn-icon btn-icon-sm variant-ghost-surface"
                                        onclick={handleClose}
                                        aria-label="Close modal"
                                >
                                        <X class="w-5 h-5" />
                                </button>
                        </header>

                        <div class="p-4">
                                <form onsubmit={handleSubmit} class="space-y-4">
                                        <!-- Name Field -->
                                        <label class="label">
                                                <span>Name</span>
                                                <input 
                                                        class="input"
                                                        type="text" 
                                                        placeholder="Your name"
                                                        value={formUser.name}
                                                        oninput={(e) => formUser.name = e.currentTarget.value}
                                                        required
                                                />
                                        </label>
                                        
                                        <!-- Email Field -->
                                        <label class="label">
                                                <span>Email Address</span>
                                                <input 
                                                        class="input"
                                                        type="email" 
                                                        placeholder="your.email@example.com"
                                                        value={formUser.email}
                                                        oninput={(e) => formUser.email = e.currentTarget.value}
                                                        required
                                                />
                                        </label>
                                        
                                        <!-- Role Field (only if user is an admin) -->
                                        {#if formUser.role === 'Admin'}
                                        <label class="label">
                                                <span>Role</span>
                                                <select 
                                                        class="select"
                                                        value={formUser.role}
                                                        onchange={(e) => formUser.role = e.currentTarget.value as 'Guest' | 'Member' | 'Admin'}
                                                >
                                                        <option value="Guest">Guest</option>
                                                        <option value="Member">Member</option>
                                                        <option value="Admin">Admin</option>
                                                </select>
                                        </label>
                                        {/if}
                                        
                                        <!-- Error Message -->
                                        {#if errorMessage}
                                        <div class="alert variant-filled-error">
                                                <span>{errorMessage}</span>
                                        </div>
                                        {/if}
                                        
                                        <!-- Form Actions -->
                                        <div class="flex justify-end gap-4 pt-4">
                                                <button 
                                                        type="button" 
                                                        class="btn variant-ghost-surface"
                                                        onclick={handleClose}
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
                                                                <span class="animate-spin mr-2">⟳</span>
                                                                Saving...
                                                        {:else}
                                                                Save Changes
                                                        {/if}
                                                </button>
                                        </div>
                                </form>
                        </div>
                </div>
        </div>
</div>
{/if}