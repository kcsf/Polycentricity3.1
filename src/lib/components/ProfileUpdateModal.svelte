<script lang="ts">
    import { userStore } from '$lib/stores/userStore';
    
    // Make component visible/invisible
    export let open = false;
    
    // Local form state
    let name = $userStore.user?.name || '';
    let email = $userStore.user?.email || '';
    let role = $userStore.user?.role || 'Member';
    let bio = $userStore.user?.bio || '';
    let isSubmitting = false;
    let errorMessage = '';
    
    // Handle form submission
    async function handleSubmit() {
        isSubmitting = true;
        errorMessage = '';
        
        try {
            // For now, just mock the update - we'll add real implementation later
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update user in store
            userStore.update(state => ({
                ...state,
                user: {
                    ...state.user!,
                    name,
                    email,
                    role,
                    bio
                }
            }));
            
            // Close modal
            open = false;
        } catch (error) {
            console.error('Failed to update profile:', error);
            errorMessage = 'Failed to update profile. Please try again.';
        } finally {
            isSubmitting = false;
        }
    }
    
    // Handle cancel
    function handleCancel() {
        open = false;
    }
</script>

{#if open}
<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div class="bg-surface-50 dark:bg-surface-900 p-6 rounded-lg shadow-xl max-w-lg w-full">
        <header class="mb-4">
            <h3 class="text-xl font-bold text-primary-700 dark:text-primary-300">Update Profile</h3>
            <p class="text-sm text-surface-600 dark:text-surface-400">Update your account details below</p>
        </header>
        
        <form on:submit|preventDefault={handleSubmit} class="space-y-4">
            <!-- Name -->
            <div class="space-y-1">
                <label class="text-sm font-medium">
                    Name
                </label>
                <input
                    type="text"
                    class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded"
                    placeholder="Your name"
                    bind:value={name}
                    required
                />
            </div>
            
            <!-- Email Address -->
            <div class="space-y-1">
                <label class="text-sm font-medium">
                    Email Address
                </label>
                <input
                    type="email"
                    class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded"
                    placeholder="your.email@example.com"
                    bind:value={email}
                    required
                />
            </div>
            
            <!-- Role -->
            <div class="space-y-1">
                <label class="text-sm font-medium">
                    Role
                </label>
                <select 
                    bind:value={role} 
                    class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded"
                >
                    <option value="Guest">Guest</option>
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                </select>
            </div>
            
            <!-- Bio -->
            <div class="space-y-1">
                <label class="text-sm font-medium">
                    Bio
                </label>
                <textarea
                    class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded"
                    placeholder="Tell us about yourself..."
                    bind:value={bio}
                    rows="3"
                ></textarea>
            </div>
            
            <!-- Error message -->
            {#if errorMessage}
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <span>{errorMessage}</span>
                </div>
            {/if}
            
            <!-- Form Actions -->
            <div class="flex justify-end gap-4 pt-2">
                <button
                    type="button"
                    class="px-4 py-2 border border-surface-300 dark:border-surface-600 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
                    onclick={handleCancel}
                    disabled={isSubmitting}
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded"
                    disabled={isSubmitting}
                >
                    {#if isSubmitting}
                        Saving...
                    {:else}
                        Save Changes
                    {/if}
                </button>
            </div>
        </form>
    </div>
</div>
{/if}