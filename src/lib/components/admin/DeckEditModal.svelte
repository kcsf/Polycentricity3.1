<script lang="ts">
  import * as icons from 'svelte-lucide';
  import { createEventDispatcher } from 'svelte';
  import { updateDeck } from '$lib/services/deckService';
  import type { Deck } from '$lib/types';
  
  export let isOpen = false;
  export let deck: Deck | null = null;
  
  const dispatch = createEventDispatcher();
  
  let isLoading = false;
  let formData = {
    name: '',
    creator: ''
  };
  
  $: if (deck && isOpen) {
    formData.name = deck.name || '';
    formData.creator = deck.creator || '';
  }
  
  function closeModal() {
    isOpen = false;
    dispatch('close');
  }
  
  async function handleSubmit() {
    if (!deck) return;
    
    isLoading = true;
    
    try {
      const success = await updateDeck(deck.deck_id, {
        name: formData.name,
        creator: formData.creator
      });
      
      if (success) {
        // Close modal and dispatch success event
        closeModal();
        dispatch('update', { deckId: deck.deck_id });
      } else {
        // Handle error
        console.error('Failed to update deck');
      }
    } catch (error) {
      console.error('Error updating deck:', error);
    } finally {
      isLoading = false;
    }
  }
</script>

<!-- Modal Backdrop -->
{#if isOpen}
<div class="modal-backdrop" on:click|self={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" tabindex="-1">
  <!-- Modal Container -->
  <div class="modal-container card variant-filled-surface p-4 w-full max-w-md" aria-modal="true">
    <header class="modal-header">
      <h3 class="h3">Edit Deck</h3>
      <button class="btn btn-sm variant-ghost-surface" on:click={closeModal}>
        <svelte:component this={icons.X} />
      </button>
    </header>
    
    <div class="p-4">
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <label class="label">
          <span>Deck Name</span>
          <input type="text" bind:value={formData.name} class="input" required />
        </label>
        
        <label class="label">
          <span>Creator ID</span>
          <input type="text" bind:value={formData.creator} class="input" required />
        </label>
        
        <div class="flex justify-end space-x-2">
          <button type="button" class="btn variant-ghost" on:click={closeModal}>Cancel</button>
          <button type="submit" class="btn variant-filled-primary" disabled={isLoading}>
            {#if isLoading}
              <div class="spinner-third w-4 h-4 mr-2"></div>
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

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 1rem;
    backdrop-filter: blur(4px);
  }
  
  .modal-container {
    border-radius: 0.5rem;
    box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.3);
    transform: scale(1);
    animation: modal-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-surface-300-600-token);
  }
  
  @keyframes modal-pop {
    0% { transform: scale(0.95); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
</style>