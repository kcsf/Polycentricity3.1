<script lang="ts">
    import type { Actor } from '$lib/types';
    import * as icons from 'lucide-svelte';
    
    // Make component visible/invisible
    export let open = false;
    export let actor: Actor | null = null;
    
    // Local form state
    let customName = actor?.custom_name || '';
    let actorType = actor?.actor_type || '';
    let isSubmitting = false;
    let errorMessage = '';
    
    // Update local state when actor changes
    $: if (actor) {
        customName = actor.custom_name || '';
        actorType = actor.actor_type || '';
    }
    
    // Handle form submission
    async function handleSubmit() {
        if (!actor) return;
        
        isSubmitting = true;
        errorMessage = '';
        
        try {
            // For now, just mock the update - we'll add real implementation later
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update actor data
            // This will be replaced with actual API call
            console.log('Updating actor:', {
                actor_id: actor.actor_id,
                custom_name: customName,
                actor_type: actorType
            });
            
            // Close modal
            open = false;
        } catch (error) {
            console.error('Failed to update actor:', error);
            errorMessage = 'Failed to update actor. Please try again.';
        } finally {
            isSubmitting = false;
        }
    }
    
    // Handle cancel
    function handleCancel() {
        open = false;
    }
</script>

{#if open && actor}
<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div class="bg-surface-50 dark:bg-surface-900 p-6 rounded-lg shadow-xl max-w-lg w-full">
        <header class="mb-4">
            <h3 class="text-xl font-bold text-tertiary-700 dark:text-tertiary-300">Edit Actor</h3>
            <p class="text-sm text-surface-600 dark:text-surface-400">Update actor details below</p>
        </header>
        
        <form on:submit|preventDefault={handleSubmit} class="space-y-4">
            <!-- Custom Name -->
            <div class="space-y-1">
                <label for="actor-name" class="text-sm font-medium">
                    Custom Name
                </label>
                <input
                    id="actor-name"
                    type="text"
                    class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded"
                    placeholder="Custom actor name"
                    bind:value={customName}
                />
            </div>
            
            <!-- Actor Type -->
            <div class="space-y-1">
                <label for="actor-type" class="text-sm font-medium">
                    Actor Type
                </label>
                <input
                    id="actor-type"
                    type="text"
                    class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded"
                    placeholder="Farmer, Funder, etc."
                    bind:value={actorType}
                />
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
                    on:click={() => handleCancel()}
                    disabled={isSubmitting}
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    class="px-4 py-2 bg-tertiary-500 hover:bg-tertiary-600 text-white rounded"
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