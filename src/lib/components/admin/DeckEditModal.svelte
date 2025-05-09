<script lang="ts">
  import * as icons from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { updateDeck } from '$lib/services/deckService';
  import type { Deck } from '$lib/types';
  
  const dispatch = createEventDispatcher();
  
  const { isOpen = $bindable(false), deck = null } = $props<{
    isOpen?: boolean;
    deck?: Deck | null;
  }>();
  
  let isLoading = $state(false);
  // Define formData with all Deck properties
  let formData = $state({
    name: '',
    description: '',
    creator_ref: '',
    is_public: true,
    image_url: '',
    created_at: 0,
    updated_at: 0
  });
  
  // Update formData when deck changes or modal opens
  $effect(() => {
    if (deck && isOpen) {
      console.log('[DeckEditModal] Opening edit modal for deck:', deck);
      
      formData.name = deck.name || '';
      formData.description = deck.description || '';
      formData.creator_ref = deck.creator_ref || ''; 
      
      // Handle is_public as a boolean properly
      formData.is_public = deck.is_public !== undefined ? !!deck.is_public : true;
      
      formData.image_url = deck.image_url || '';
      formData.created_at = deck.created_at || 0;
      formData.updated_at = Date.now(); // Always update the timestamp when editing
    }
  });
  
  function closeModal() {
    // Can't directly modify props in Svelte 5
    const event = new CustomEvent('close');
    dispatch('close', event);
  }
  
  /** Handle form submission  */
  async function handleSubmit() {
    if (!deck) return;
    isLoading = true;

    const deckId = deck.deck_id;
    const updates: Partial<Deck> = {
      name: formData.name,
      description: formData.description,
      creator_ref: formData.creator_ref,
      is_public: formData.is_public,
      image_url: formData.image_url,
      created_at: formData.created_at, // preserve original
      updated_at: Date.now(),          // bump timestamp
    };

    console.log('[DeckEditModal] Submitting updates:', updates);

    try {
      const success = await updateDeck(deckId, updates);
      if (success) {
        console.log(`[DeckEditModal] Updated deck ${deckId}`);
        // fire update event with deckId
        dispatch('update', { deckId });
        closeModal();
      } else {
        console.error('[DeckEditModal] Failed to update deck');
      }
    } catch (err) {
      console.error('[DeckEditModal] Error updating deck:', err);
    } finally {
      isLoading = false;
    }
  }
</script>

<!-- Modal Backdrop -->
{#if isOpen}
<div class="modal-backdrop" 
     onclick={(e) => e.target === e.currentTarget && closeModal()} 
     onkeydown={(e) => e.key === 'Escape' && closeModal()} 
     role="dialog" 
     tabindex="-1">
  <!-- Modal Container -->
  <div class="modal-container card custom-modal p-4 w-full max-w-md" aria-modal="true">
    <header class="modal-header">
      <h3 class="h3">✏️ Edit Deck</h3>
      <button class="close-button" onclick={closeModal}>
        ❌
      </button>
    </header>
    
    <div class="p-4">
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        <label class="label">
          <span>Deck Name</span>
          <input type="text" bind:value={formData.name} class="input" required />
        </label>
        
        <label class="label">
          <span>Description</span>
          <textarea bind:value={formData.description} class="input h-24" placeholder="Describe the purpose and content of this deck"></textarea>
        </label>
        
        <label class="label">
          <span>Creator Reference ID</span>
          <input type="text" bind:value={formData.creator_ref} class="input" required />
        </label>
        
        <label class="label flex items-center gap-2 cursor-pointer">
          <span>Public Deck</span>
          <input type="checkbox" bind:checked={formData.is_public} class="checkbox" />
          <span class="ml-1 text-sm opacity-70">{formData.is_public ? 'Available to all users' : 'Private deck'}</span>
        </label>
        
        <label class="label">
          <span>Deck Image URL (optional)</span>
          <input type="url" bind:value={formData.image_url} class="input" placeholder="https://example.com/image.jpg" />
          {#if formData.image_url}
            <div class="mt-2 image-preview rounded overflow-hidden w-24 h-24">
              <img src={formData.image_url} alt="Deck preview" class="w-full h-full object-cover" />
            </div>
          {/if}
        </label>
        
        {#if formData.created_at}
          <div class="text-sm opacity-70">
            <div>Created: {new Date(formData.created_at).toLocaleString()}</div>
            {#if formData.updated_at && formData.updated_at !== formData.created_at}
              <div>Last Updated: {new Date(formData.updated_at).toLocaleString()}</div>
            {/if}
          </div>
        {/if}
        
        <div class="flex justify-end space-x-2 mt-6">
          <button type="button" class="cancel-button" onclick={closeModal}>Cancel</button>
          <button type="submit" class="save-button" disabled={isLoading}>
            {#if isLoading}
              <span class="loading-icon">⏳</span>
              Saving...
            {:else}
              💾 Save Changes
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
  
  .custom-modal {
    background-color: #1e293b;
    color: white;
    border: 2px solid #3b82f6;
  }
  
  .custom-modal input,
  .custom-modal textarea {
    background-color: #334155;
    color: white;
    border: 1px solid #475569;
    width: 100%;
    padding: 0.5rem;
    border-radius: 0.25rem;
  }
  
  .custom-modal textarea {
    resize: vertical;
    min-height: 100px;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  .custom-modal input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    width: 1.25rem;
    height: 1.25rem;
    border: 1.5px solid #3b82f6;
    border-radius: 0.25rem;
    position: relative;
    cursor: pointer;
    outline: none;
  }
  
  .custom-modal input[type="checkbox"]:checked {
    background-color: #3b82f6;
  }
  
  .custom-modal input[type="checkbox"]:checked:after {
    content: "✓";
    color: white;
    position: absolute;
    font-size: 0.9rem;
    top: -0.05rem;
    left: 0.2rem;
  }
  
  .custom-modal .modal-header {
    border-bottom: 2px solid #3b82f6;
  }
  
  .close-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0.25rem;
    transition: transform 0.2s ease;
  }
  
  .close-button:hover {
    transform: scale(1.2);
  }
  
  .save-button, .cancel-button {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
  }
  
  .save-button {
    background-color: #3b82f6;
    color: white;
    border: none;
  }
  
  .save-button:hover:not([disabled]) {
    background-color: #2563eb;
    transform: translateY(-2px);
  }
  
  .save-button[disabled] {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .cancel-button {
    background-color: transparent;
    color: #f87171;
    border: 1px solid #f87171;
  }
  
  .cancel-button:hover {
    background-color: rgba(248, 113, 113, 0.1);
    transform: translateY(-2px);
  }
  
  .loading-icon {
    display: inline-block;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .image-preview {
    border: 2px solid #3b82f6;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
  }
  
  .image-preview:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  }
</style>