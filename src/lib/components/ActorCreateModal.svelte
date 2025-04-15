<script lang="ts">
    import { getGun, nodes, generateId } from '$lib/services/gunService';
    import { userStore } from '$lib/stores/userStore';
    import * as icons from 'svelte-lucide';
    import { goto } from '$app/navigation';
    
    export let open = false;
    
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
    
    // Reset form when modal closes
    $: if (!open) {
        formData = {
            custom_name: '',
            actor_type: '',
            description: ''
        };
        isSubmitting = false;
        errorMessage = '';
        successMessage = '';
    }
    
    // Submit handler
    async function handleSubmit() {
        if (!formData.custom_name) {
            errorMessage = 'Actor name is required';
            return;
        }
        
        if (!$userStore.user || !$userStore.user.user_id) {
            errorMessage = 'You must be logged in to create an actor';
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
            
            const actor_id = generateId();
            
            // Create new actor
            await new Promise((resolve, reject) => {
                gun.get(nodes.actors).get(actor_id).put({
                    actor_id,
                    custom_name: formData.custom_name,
                    actor_type: formData.actor_type || 'Standard Actor',
                    description: formData.description || '',
                    user_id: $userStore.user.user_id,
                    status: 'active',
                    created_at: Date.now()
                }, (ack) => {
                    if (ack.err) {
                        reject(new Error(ack.err));
                    } else {
                        resolve(true);
                    }
                });
            });
            
            // Link to user
            await new Promise((resolve, reject) => {
                gun.get(nodes.users).get($userStore.user.user_id).get('actors').set(actor_id, (ack) => {
                    if (ack.err) {
                        reject(new Error(ack.err));
                    } else {
                        resolve(true);
                    }
                });
            });
            
            successMessage = 'Actor created successfully';
            setTimeout(() => {
                if (open) {
                    open = false;
                    // Refresh the page to show the new actor
                    window.location.reload();
                }
            }, 1500);
            
        } catch (error) {
            console.error('Error creating actor:', error);
            errorMessage = error.message || 'Failed to create actor';
        } finally {
            isSubmitting = false;
        }
    }
</script>

<!-- Modal Background Overlay -->
{#if open}
<div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
    onclick={() => open = false}
    onkeydown={(e) => e.key === 'Escape' && (open = false)}
    role="dialog"
    aria-modal="true"
>
    <!-- Modal Content -->
    <div 
        class="bg-surface-50 dark:bg-surface-900 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="document"
    >
        <!-- Modal Header -->
        <div class="bg-primary-500/10 dark:bg-primary-500/20 p-4">
            <h2 class="text-2xl font-bold text-primary-800 dark:text-primary-200">
                Create New Actor
            </h2>
            <p class="text-sm text-surface-600-300-token mt-1">
                Create a new character to participate in games
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
                        class="btn variant-filled-primary" 
                        disabled={isSubmitting}
                    >
                        {#if isSubmitting}
                            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                            Creating...
                        {:else}
                            <icons.Plus size={16} class="mr-2" />
                            Create Actor
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
{/if}