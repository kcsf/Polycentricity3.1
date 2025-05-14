<script lang="ts">
  import * as icons from '@lucide/svelte';
  import { createDeck } from '$lib/services/gameService';
  import { getToastStore } from '@skeletonlabs/skeleton';

  // Props
  let { isOpen = false, onevent } = $props<{
    isOpen?: boolean;
    onevent?: {
      close?: () => void;
      created?: (event: { detail: { deckId: string; name: string } }) => void;
    };
  }>();

  // Local state
  let name = $state('');
  let description = $state('');
  let isPublic = $state(false);
  let isSubmitting = $state(false);
  let error = $state('');

  // Toast store for notifications
  const toastStore = getToastStore();

  // Reset form fields
  function resetForm(): void {
    name = '';
    description = '';
    isPublic = false;
    error = '';
  }

  // Close modal and reset form
  function handleClose(): void {
    resetForm();
    onevent?.close?.();
  }

  // Handle form submission
  async function handleSubmit(): Promise<void> {
    try {
      if (!name.trim()) {
        error = 'Please enter a deck name';
        return;
      }

      isSubmitting = true;
      error = '';

      // Call the createDeck function from gameService
      const newDeck = await createDeck(name, description, isPublic);

      if (!newDeck) {
        throw new Error('Failed to create deck. Please ensure you are logged in with admin privileges.');
      }

      // Success notification
      toastStore.trigger({
        message: `Deck "${newDeck.name}" created successfully!`,
        background: 'preset-filled-success'
      });

      // Call the created event with deck info
      if (onevent?.created) {
        onevent.created({
          detail: {
            deckId: newDeck.deck_id,
            name: newDeck.name
          }
        });
      }
      
      // Close modal
      handleClose();
    } catch (err) {
      console.error('[CreateDeckModal] Error creating deck:', err);
      error = err instanceof Error ? err.message : 'An unexpected error occurred';
      
      // Error notification
      toastStore.trigger({
        message: `Error: ${error}`,
        background: 'preset-filled-error'
      });
    } finally {
      isSubmitting = false;
    }
  }
</script>

<!-- Modal Backdrop -->
{#if isOpen}
  <div 
    class="modal-backdrop fixed inset-0 bg-surface-950/50 backdrop-blur-sm z-40" 
    role="dialog"
    aria-modal="true"
    onclick={(e) => e.target === e.currentTarget && handleClose()}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
    tabindex="-1"
  >
    <!-- Modal Content -->
    <div class="modal fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-lg w-full mx-auto z-50">
      <div class="card bg-surface-50-800 p-0 rounded-lg shadow-xl border border-surface-300-600 overflow-hidden">
        <!-- Modal Header -->
        <header class="bg-primary-500 text-white p-4 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <icons.FolderPlus size={20} />
            <div class="h2">Create New Deck</div>
          </div>
          <button class="btn btn-sm preset-tonal text-white" onclick={handleClose}>
            <icons.X size={18} />
          </button>
        </header>

        <!-- Modal Body -->
        <div class="p-6 space-y-4">
          <!-- Error Alert -->
          {#if error}
            <div class="alert preset-filled-error flex gap-2 items-center">
              <icons.AlertCircle size={16} />
              <span>{error}</span>
            </div>
          {/if}

          <!-- Form -->
          <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <!-- Deck Name -->
            <label class="label">
              <span class="font-semibold">Deck Name<span class="text-error-500">*</span></span>
              <input 
                type="text" 
                class="input w-full" 
                bind:value={name}
                placeholder="Enter deck name"
                disabled={isSubmitting}
              />
            </label>

            <!-- Deck Description -->
            <label class="label">
              <span class="font-semibold">Description</span>
              <textarea 
                class="textarea w-full h-24" 
                bind:value={description}
                placeholder="Enter deck description"
                disabled={isSubmitting}
              ></textarea>
            </label>

            <!-- Public/Private Toggle -->
            <label class="label flex items-center gap-2 cursor-pointer">
              <input type="checkbox" class="checkbox" bind:checked={isPublic} disabled={isSubmitting} />
              <span>Make deck public</span>
            </label>

            <!-- Footer with Actions -->
            <div class="flex justify-end gap-2 mt-6">
              <button 
                type="button" 
                class="btn preset-tonal" 
                onclick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                class="btn preset-filled-primary flex items-center gap-2" 
                disabled={isSubmitting}
              >
                {#if isSubmitting}
                  <span class="spinner-third"></span>
                  Creating...
                {:else}
                  <icons.Save size={16} />
                  Create Deck
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
{/if}