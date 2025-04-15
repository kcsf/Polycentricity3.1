<script lang="ts">
    import { getGun, nodes } from '$lib/services/gunService';
    import { modal, getModalStore } from '@skeletonlabs/skeleton';
    import { userStore } from '$lib/stores/userStore';
    import * as icons from 'svelte-lucide';
    import type { Actor } from '$lib/types';
    
    export let open = false;
    export let actor: Actor | null = null;
    
    // Form data
    let formData = {
        custom_name: '',
        actor_type: '',
        description: ''
    };
    
    // Form state
    let isSubmitting = false;
    let errorMessage = '';
    let successMessage = '';
    
    // Initialize form data when actor changes
    $: if (actor) {
        formData = {
            custom_name: actor.custom_name || '',
            actor_type: actor.actor_type || '',
            description: actor.description || ''
        };
    }
    
    // Reset form when modal closes
    $: if (!open) {
        isSubmitting = false;
        errorMessage = '';
        successMessage = '';
    }
    
    // Submit handler
    async function handleSubmit() {
        if (!actor || !actor.actor_id) {
            errorMessage = 'Invalid actor data';
            return;
        }
        
        isSubmitting = true;
        errorMessage = '';
        successMessage = '';
        
        try {
            const gun = getGun();
            if (!gun) {
                throw new Error('Database not available');
            }
            
            // Update actor data
            await new Promise((resolve, reject) => {
                gun.get(nodes.actors).get(actor.actor_id).put({
                    custom_name: formData.custom_name,
                    actor_type: formData.actor_type,
                    description: formData.description,
                    // Preserve existing fields that we don't want to overwrite
                    actor_id: actor.actor_id,
                    game_id: actor.game_id,
                    user_id: actor.user_id,
                    card_id: actor.card_id,
                    status: actor.status,
                    created_at: actor.created_at,
                }, (ack) => {
                    if (ack.err) {
                        reject(new Error(ack.err));
                    } else {
                        resolve(true);
                    }
                });
            });
            
            successMessage = 'Actor updated successfully';
            setTimeout(() => {
                if (open) {
                    open = false;
                }
            }, 1500);
            
        } catch (error) {
            console.error('Error updating actor:', error);
            errorMessage = error.message || 'Failed to update actor';
        } finally {
            isSubmitting = false;
        }
    }
</script>

<!-- Modal Background Overlay -->
{#if open}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => open = false}>
    <!-- Modal Content -->
    <div 
        class="bg-surface-50 dark:bg-surface-900 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onclick={(e) => e.stopPropagation()}
    >
        <!-- Modal Header -->
        <div class="bg-tertiary-500/10 dark:bg-tertiary-500/20 p-4">
            <h2 class="text-2xl font-bold text-tertiary-800 dark:text-tertiary-200">
                {actor ? 'Edit Actor' : 'Create Actor'}
            </h2>
            <p class="text-sm text-surface-600-300-token mt-1">
                {actor ? 'Update actor details and settings' : 'Create a new actor'}
            </p>
        </div>
        
        <!-- Modal Body -->
        <div class="p-4">
            <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
                <!-- Actor Name -->
                <label class="label">
                    <span>Actor Name</span>
                    <input 
                        type="text" 
                        class="input" 
                        bind:value={formData.custom_name} 
                        placeholder="Enter actor name"
                        required
                    />
                </label>
                
                <!-- Actor Type -->
                <label class="label">
                    <span>Actor Type</span>
                    <input 
                        type="text" 
                        class="input" 
                        bind:value={formData.actor_type} 
                        placeholder="E.g., Farmer, Investor, Builder"
                    />
                </label>
                
                <!-- Description -->
                <label class="label">
                    <span>Description</span>
                    <textarea 
                        class="textarea" 
                        bind:value={formData.description} 
                        placeholder="Optional description of this actor's role"
                        rows="3"
                    ></textarea>
                </label>
                
                <!-- Error/Success Messages -->
                {#if errorMessage}
                    <div class="alert variant-filled-error">{errorMessage}</div>
                {/if}
                
                {#if successMessage}
                    <div class="alert variant-filled-success">{successMessage}</div>
                {/if}
                
                <!-- Form Actions -->
                <div class="flex justify-end space-x-2 pt-2">
                    <button 
                        type="button" 
                        class="btn variant-soft" 
                        onclick={() => open = false}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        class="btn variant-filled-tertiary" 
                        disabled={isSubmitting}
                    >
                        {#if isSubmitting}
                            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
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