<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { getGun, getCollection, nodes } from '$lib/services/gunService';
  import { getDeck, updateDeck } from '$lib/services/deckService';
  import DeckEditModal from './DeckEditModal.svelte';
  import type { Deck } from '$lib/types';
  import { tick } from 'svelte';
  
  const { refreshTrigger = 0 } = $props(); // Increment this to trigger a refresh
  
  let isLoading = $state(true);
  let decks = $state<{id:string,data:Deck}[]>([]);
  // New: cardCounts map
  let cardCounts = $state<Record<string,number>>({});
  let error = $state<string | null>(null);
  
  // Modal state
  let isModalOpen = $state(false);
  let selectedDeck = $state<Deck | null>(null);
  
  onMount(() => {
    loadDecks();
  });
  
  $effect(() => {
    if (refreshTrigger) {
      loadDecks();
    }
  });

  // Whenever `decks` changes, re-compute cardCounts
  $effect(async () => {
    cardCounts = {};
    for (const { id } of decks) {
      try {
        const items = await getCollection(`${nodes.decks}/${id}/cards_ref`);
        cardCounts[id] = items.length;
      } catch {
        cardCounts[id] = 0;
      }
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
    console.log('Opening edit modal for deck:', deck);
    
    // If the loaded deck is using old schema format, convert to new schema
    // This handles the transition period where both schema formats might exist
    if (deck.creator && !deck.creator_ref) {
      console.log('Converting deck from old schema to new schema format');
      selectedDeck = {
        ...deck,
        creator_ref: deck.creator || '',
        is_public: deck.is_public ?? true,
        description: deck.description || '',
        // Any cards or additional fields should be preserved
      };
    } else {
      // Just use the deck as-is
      selectedDeck = deck;
    }
    
    isModalOpen = true;
  }
  
  function handleModalClose() {
    // In Svelte 5 Runes, update state with direct assignment
    isModalOpen = false;
    selectedDeck = null;
  }
  
  function handleDeckUpdated(event: CustomEvent) {
    console.log('Deck updated:', event.detail?.deckId);
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
        <span class="mr-2">🔄</span>
        Refresh
      {/if}
    </button>
  </div>
  
  {#if error}
    <div class="alert variant-filled-error mb-4">
      <span class="text-xl">⚠️</span>
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
      <span class="text-5xl mb-4 block">📦</span>
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
              <td>
                {deck.data.name || 'Unnamed'} 
                {#if deck.data.is_public}
                  <span class="badge bg-green-600 text-white text-xs ml-2 px-1">Public</span>
                {:else}
                  <span class="badge bg-red-600 text-white text-xs ml-2 px-1">Private</span>
                {/if}
              </td>
              <td class="font-mono text-xs">
                {deck.data.creator_ref || deck.data.creator || 'None'}
              </td>
              <!-- UPDATED: show pre-computed count -->
              <td class="text-center">{cardCounts[deck.id] ?? 0}</td>
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
    on:close={handleModalClose}
    on:update={handleDeckUpdated}
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
  
  .badge {
    display: inline-block;
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
  }
  
  .bg-green-600 {
    background-color: #10b981;
  }
  
  .bg-red-600 {
    background-color: #ef4444;
  }
  
  .text-white {
    color: white;
  }
</style>