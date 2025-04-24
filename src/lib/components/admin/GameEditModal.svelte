<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { updateGame } from '$lib/services/gameService';
  import type { Game, GameStatus } from '$lib/types';
  
  const dispatch = createEventDispatcher();
  
  const { isOpen = false, game = null } = $props<{ isOpen?: boolean, game?: Game | null }>();
  
  // Available game status options
  const statusOptions: GameStatus[] = ['active', 'pending', 'completed', 'cancelled'];
  
  let isLoading = $state(false);
  // Define formData with all Game properties
  let formData = $state({
    name: '',
    description: '',
    creator_ref: '',
    deck_ref: '',
    deck_type: '',
    status: 'active' as GameStatus,
    max_players: 0,
    password: '',
    created_at: 0,
    updated_at: 0
  });
  
  // Update formData when game changes or modal opens
  $effect(() => {
    if (game && isOpen) {
      formData.name = game.name || '';
      formData.description = game.description || '';
      formData.creator_ref = game.creator_ref || '';
      formData.deck_ref = game.deck_ref || '';
      formData.deck_type = game.deck_type || '';
      formData.status = game.status || 'active';
      
      // Handle max_players properly - convert to a valid number or default to 0
      if (game.max_players !== undefined && game.max_players !== null) {
        const maxPlayerValue = typeof game.max_players === 'string' 
          ? parseInt(game.max_players, 10) 
          : game.max_players;
        formData.max_players = !isNaN(maxPlayerValue) ? maxPlayerValue : 0;
      } else {
        formData.max_players = 0;
      }
      
      formData.password = game.password || '';
      formData.created_at = game.created_at || 0;
      formData.updated_at = Date.now(); // Always update the timestamp when editing
    }
  });
  
  function closeModal() {
    // Can't directly modify props in Svelte 5
    const event = new CustomEvent('close');
    dispatch('close', event);
  }
  
  /**
   * Handle form submission - update the game with all form fields
   */
  async function handleSubmit() {
    if (!game) return;
    
    isLoading = true;
    const gameId = game.game_id; // Store game_id before any state changes
    // Properly handle max_players conversion
    let maxPlayers = undefined;
    if (formData.max_players !== undefined && formData.max_players !== null) {
      const parsedValue = parseInt(formData.max_players.toString(), 10);
      maxPlayers = !isNaN(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
    }
    console.log('[GameEditModal] Submitting with max_players value:', maxPlayers);
    
    try {
      // Update with all form fields using the new schema fields
      const success = await updateGame(gameId, {
        name: formData.name,
        description: formData.description,
        creator_ref: formData.creator_ref,
        deck_ref: formData.deck_ref,
        deck_type: formData.deck_type,
        status: formData.status,
        max_players: maxPlayers,
        password: formData.password || undefined,
        // Pass along created_at from the original game
        created_at: formData.created_at,
        // Always update the updated_at timestamp
        updated_at: Date.now()
      });
      
      if (success) {
        console.log(`Updated game ${gameId} successfully`);
        // Create event with gameId before closing modal
        const updateEvent = new CustomEvent('update', { detail: { gameId } });
        // Close modal first
        closeModal();
        // Then dispatch event
        dispatch('update', updateEvent);
      } else {
        // Handle error
        console.error('Failed to update game');
      }
    } catch (error) {
      console.error('Error updating game:', error);
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
  <div class="modal-container card custom-modal p-4 w-full max-w-xl" aria-modal="true">
    <header class="modal-header">
      <h3 class="h3">✏️ Edit Game</h3>
      <button class="close-button" onclick={closeModal}>
        ❌
      </button>
    </header>
    
    <div class="p-4">
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-4">
            <label class="label">
              <span>Game Name</span>
              <input type="text" bind:value={formData.name} class="input" required />
            </label>
            
            <label class="label">
              <span>Description</span>
              <textarea bind:value={formData.description} class="input h-24" placeholder="Describe the purpose and rules of this game"></textarea>
            </label>
            
            <label class="label">
              <span>Creator Reference ID</span>
              <input type="text" bind:value={formData.creator_ref} class="input" required />
            </label>
          </div>
          
          <div class="space-y-4">
            <label class="label">
              <span>Deck Reference ID</span>
              <input type="text" bind:value={formData.deck_ref} class="input" required />
            </label>
            
            <label class="label">
              <span>Deck Type</span>
              <input type="text" bind:value={formData.deck_type} class="input" required />
            </label>
            
            <label class="label">
              <span>Game Status</span>
              <select bind:value={formData.status} class="input">
                {#each statusOptions as status}
                  <option value={status}>{status}</option>
                {/each}
              </select>
            </label>
            
            <label class="label">
              <span>Max Players (0 for unlimited)</span>
              <input type="number" bind:value={formData.max_players} min="0" class="input" />
            </label>
            
            <label class="label">
              <span>Password (optional)</span>
              <input type="text" bind:value={formData.password} class="input" placeholder="Leave empty for open games" />
            </label>
          </div>
        </div>
        
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
  .custom-modal textarea,
  .custom-modal select {
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
  
  .custom-modal select {
    appearance: auto;
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
</style>