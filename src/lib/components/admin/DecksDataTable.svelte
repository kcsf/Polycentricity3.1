<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import { getDeck, updateDeck } from '$lib/services/deckService';
  import DeckEditModal from './DeckEditModal.svelte';
  import type { Deck } from '$lib/types';
  import { tick } from 'svelte';
  
  const { refreshTrigger = 0 } = $props(); // Increment this to trigger a refresh
  
  const isLoading = $state(true);
  const decks = $state<{id: string, data: Deck}[]>([]);
  const error = $state<string | null>(null);
  
  // Modal state
  const isModalOpen = $state(false);
  const selectedDeck = $state<Deck | null>(null);
  
  onMount(() => {
    loadDecks();
  });
  
  $effect(() => {
    if (refreshTrigger) {
      loadDecks();
    }
  });
  
  async function loadDecks() {
    // In Svelte 5 Runes, state variables are updated by direct assignment
    isLoading = true;
    error = null;
    decks = [];
    
    try {
      const gun = getGun();
      
      if (!gun) {
        error = 'Gun not initialized';
        isLoading = false;
        return;
      }
      
      const loadedDecks: {id: string, data: Deck}[] = [];
      
      await new Promise<void>(resolve => {
        gun.get(nodes.decks).map().once((deckData: Deck, deckId: string) => {
          if (deckData) {
            loadedDecks.push({
              id: deckId,
              data: deckData
            });
          }
        });
        
        // Wait for Gun to load data
        setTimeout(() => {
          console.log(`Loaded ${loadedDecks.length} decks`);
          decks = loadedDecks;
          resolve();
        }, 500);
      });
    } catch (err) {
      console.error('Error loading decks:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }
  
  function openEditModal(deck: Deck) {
    // In Svelte 5 Runes, update state with direct assignment
    selectedDeck = deck;
    isModalOpen = true;
  }
  
  function handleModalClose() {
    // In Svelte 5 Runes, update state with direct assignment
    isModalOpen = false;
    selectedDeck = null;
  }
  
  function handleDeckUpdated() {
    // Refresh the deck list
    loadDecks();
  }
  
  function formatDate(timestamp?: number): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  }
  
  async function deleteDeck(deckId: string) {
    try {
      const gun = getGun();
      
      if (!gun) {
        error = 'Gun not initialized';
        return;
      }
      
      // Get the deck to check if it exists
      const deck = await getDeck(deckId);
      
      if (!deck) {
        error = `Deck with ID ${deckId} not found`;
        return;
      }
      
      // Set the deck node to null to delete it
      gun.get(nodes.decks).get(deckId).put(null, async (ack) => {
        if (ack.err) {
          console.error('Error deleting deck:', ack.err);
          error = `Failed to delete deck: ${ack.err}`;
        } else {
          console.log(`Deleted deck: ${deckId}`);
          // Wait a moment then refresh the decks list
          await tick();
          loadDecks();
        }
      });
    } catch (err) {
      console.error('Delete deck error:', err);
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<div class="deck-data-container">
  <div class="flex justify-between items-center mb-4">
    <h3 class="h3">Decks</h3>
    <button class="btn btn-sm variant-filled-primary" onclick={loadDecks} disabled={isLoading}>
      {#if isLoading}
        <div class="spinner-third w-4 h-4 mr-2"></div>
        Loading...
      {:else}
        {icons.RefreshCw && icons.RefreshCw({ class: "w-4 h-4 mr-2" })}
        Refresh
      {/if}
    </button>
  </div>
  
  {#if error}
    <div class="alert variant-filled-error mb-4">
      {icons.AlertTriangle && icons.AlertTriangle()}
      <div class="alert-message">
        <h4 class="h5">Error Loading Decks</h4>
        <p>{error}</p>
      </div>
    </div>
  {/if}
  
  {#if isLoading && decks.length === 0}
    <div class="flex justify-center items-center p-10">
      <div class="spinner-third w-8 h-8"></div>
      <span class="ml-3">Loading decks...</span>
    </div>
  {:else if decks.length === 0}
    <div class="card p-6 variant-ghost-surface text-center">
      {icons.Package && icons.Package({ class: "w-12 h-12 mx-auto mb-4 text-surface-500" })}
      <h4 class="h4 mb-2">No Decks Found</h4>
      <p class="text-sm max-w-lg mx-auto">
        There are no decks in the database yet. Create a deck to get started.
      </p>
    </div>
  {:else}
    <div class="table-container">
      <table class="table table-compact table-hover">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Creator</th>
            <th>Cards</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each decks as deck}
            <tr>
              <td class="font-mono text-xs">{deck.id}</td>
              <td>{deck.data.name || 'Unnamed'}</td>
              <td class="font-mono text-xs">{deck.data.creator || 'None'}</td>
              <td>
                {#if deck.data.cards}
                  {Array.isArray(deck.data.cards) ? deck.data.cards.length : Object.keys(deck.data.cards).length}
                {:else}
                  0
                {/if}
              </td>
              <td>
                <div class="flex space-x-2">
                  <button 
                    class="action-button edit-button"
                    onclick={() => openEditModal(deck.data)}
                    title="Edit Deck Info"
                  >
                    <span class="icon">✏️</span> Edit
                  </button>
                  <button 
                    onclick={() => {
                      window.location.href = `/admin?tab=overview&deckId=${deck.id}`;
                    }}
                    class="action-button import-button"
                    title="Import Cards to Deck"
                  >
                    <span class="icon">📤</span> Import
                  </button>
                  <button 
                    onclick={() => {
                      if (confirm(`Are you sure you want to delete deck "${deck.data.name || deck.id}"? This cannot be undone.`)) {
                        deleteDeck(deck.id);
                      }
                    }}
                    class="action-button delete-button"
                    title="Delete Deck"
                  >
                    <span class="icon">❌</span> Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  
  <!-- Edit Modal -->
  <DeckEditModal 
    bind:isOpen={isModalOpen} 
    deck={selectedDeck} 
    onclose={handleModalClose}
    onupdate={handleDeckUpdated}
  />
</div>

<style>
  .table-container {
    overflow-x: auto;
  }
  
  .table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .table th, .table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--color-surface-300-600-token);
  }
  
  .table th {
    background-color: var(--color-surface-200-700-token);
    font-weight: 600;
  }
  
  .table-hover tr:hover td {
    background-color: var(--color-surface-100-800-token);
  }
  
  .table-compact th, .table-compact td {
    padding: 0.5rem 0.75rem;
  }
  
  .action-button {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    font-weight: 600;
    transition: all 0.2s ease;
    cursor: pointer;
    text-decoration: none;
    color: white;
  }
  
  .edit-button {
    background-color: #3b82f6;
    border: none;
  }
  
  .edit-button:hover {
    background-color: #2563eb;
  }
  
  .import-button {
    background-color: #10b981;
  }
  
  .import-button:hover {
    background-color: #059669;
  }
  
  .delete-button {
    background-color: #ef4444;
  }
  
  .delete-button:hover {
    background-color: #dc2626;
  }
  
  .icon {
    margin-right: 0.5rem;
    font-size: 1rem;
  }
</style>