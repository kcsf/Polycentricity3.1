<script lang="ts">
        import { get } from 'svelte/store';
        import { userStore, setUser } from '$lib/stores/userStore';
        import { getGun, getUser, put } from '$lib/services/gunService';
        import { nodes } from '$lib/services/gunService';
        import type { User } from '$lib/types';
        import { toastStore } from '$lib/utils/toast';
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
                        toastStore.success('Profile updated successfully!');
                        
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
                        toastStore.error(message);
                }
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
<div class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
                <!-- Header -->
                <header class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <div>
                                <h3 class="text-xl font-bold">Update Profile</h3>
                                <p class="text-sm text-gray-600 dark:text-gray-400">Update your account details below</p>
                        </div>
                        <button 
                                class="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                                onclick={handleClose}
                                aria-label="Close modal"
                        >
                                <X class="w-5 h-5" />
                        </button>
                </header>

                <div class="p-4">
                        <form onsubmit={handleSubmit} class="space-y-4">
                                <!-- Name Field -->
                                <div>
                                        <label for="name-input" class="block text-sm font-medium mb-1">Name</label>
                                        <input 
                                                id="name-input"
                                                class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                                                type="text" 
                                                placeholder="Your name"
                                                value={formUser.name}
                                                oninput={(e) => formUser.name = e.currentTarget.value}
                                                required
                                        />
                                </div>
                                
                                <!-- Email Field -->
                                <div>
                                        <label for="email-input" class="block text-sm font-medium mb-1">Email Address</label>
                                        <input 
                                                id="email-input"
                                                class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                                                type="email" 
                                                placeholder="your.email@example.com"
                                                value={formUser.email}
                                                oninput={(e) => formUser.email = e.currentTarget.value}
                                                required
                                        />
                                </div>
                                
                                <!-- Role Field (only if user is an admin) -->
                                {#if formUser.role === 'Admin'}
                                <div>
                                        <label for="role-select" class="block text-sm font-medium mb-1">Role</label>
                                        <select 
                                                id="role-select"
                                                class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                                                value={formUser.role}
                                                onchange={(e) => formUser.role = e.currentTarget.value as 'Guest' | 'Member' | 'Admin'}
                                        >
                                                <option value="Guest">Guest</option>
                                                <option value="Member">Member</option>
                                                <option value="Admin">Admin</option>
                                        </select>
                                </div>
                                {/if}
                                
                                <!-- Error Message -->
                                {#if errorMessage}
                                <div class="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg">
                                        <span>{errorMessage}</span>
                                </div>
                                {/if}
                                
                                <!-- Form Actions -->
                                <div class="flex justify-end gap-4 pt-4">
                                        <button 
                                                type="button" 
                                                class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                onclick={handleClose}
                                                disabled={isSubmitting}
                                        >
                                                Cancel
                                        </button>
                                        <button 
                                                type="submit" 
                                                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                                                disabled={isSubmitting}
                                        >
                                                {#if isSubmitting}
                                                        <span class="inline-block animate-spin mr-2">⟳</span>
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
{/if}