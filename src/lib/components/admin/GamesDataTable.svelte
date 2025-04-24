<script lang="ts">
  import { onMount } from 'svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import { getAllGames, getGame } from '$lib/services/gameService';
  import GameEditModal from './GameEditModal.svelte';
  import type { Game } from '$lib/types';
  import { tick } from 'svelte';
  
  const { refreshTrigger = 0 } = $props(); // Increment this to trigger a refresh
  
  let isLoading = $state(true);
  let games = $state<{id: string, data: Game}[]>([]);
  let error = $state<string | null>(null);
  
  // Modal state
  let isModalOpen = $state(false);
  let selectedGame = $state<Game | null>(null);
  
  onMount(() => {
    loadGames();
  });
  
  $effect(() => {
    if (refreshTrigger) {
      loadGames();
    }
  });
  
  async function loadGames() {
    // In Svelte 5 Runes, state variables are updated by direct assignment
    isLoading = true;
    error = null;
    games = [];
    
    try {
      const gun = getGun();
      
      if (!gun) {
        error = 'Gun not initialized';
        isLoading = false;
        return;
      }
      
      const loadedGames: {id: string, data: Game}[] = [];
      
      // Use the getAllGames method from gameService
      const allGames = await getAllGames();
      
      // Format the games data for display
      for (const game of allGames) {
        loadedGames.push({
          id: game.game_id,
          data: game
        });
      }
      
      games = loadedGames;
      console.log(`Loaded ${games.length} games`);
      
    } catch (err) {
      console.error('Error loading games:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }
  
  function openEditModal(game: Game) {
    // In Svelte 5 Runes, update state with direct assignment
    console.log('Opening edit modal for game:', game);
    selectedGame = game;
    isModalOpen = true;
  }
  
  function handleModalClose() {
    // In Svelte 5 Runes, update state with direct assignment
    isModalOpen = false;
    selectedGame = null;
  }
  
  function handleGameUpdated(event: CustomEvent) {
    console.log('Game updated:', event.detail?.gameId);
    // Refresh the game list
    loadGames();
  }
  
  function formatDate(timestamp?: number): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  }
  
  async function deleteGame(gameId: string) {
    try {
      const gun = getGun();
      
      if (!gun) {
        error = 'Gun not initialized';
        return;
      }
      
      // Get the game to check if it exists
      const game = await getGame(gameId);
      
      if (!game) {
        error = `Game with ID ${gameId} not found`;
        return;
      }
      
      // Set the game node to null to delete it
      gun.get(nodes.games).get(gameId).put(null, async (ack) => {
        if (ack.err) {
          console.error('Error deleting game:', ack.err);
          error = `Failed to delete game: ${ack.err}`;
        } else {
          console.log(`Deleted game: ${gameId}`);
          // Wait a moment then refresh the games list
          await tick();
          loadGames();
        }
      });
    } catch (err) {
      console.error('Delete game error:', err);
      error = err instanceof Error ? err.message : String(err);
    }
  }
  
  // Function to get badge color based on game status
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-green-600';
      case 'pending':
        return 'bg-blue-600';
      case 'completed':
        return 'bg-gray-600';
      case 'cancelled':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  }
</script>

<div class="game-data-container">
  <div class="flex justify-between items-center mb-4">
    <h3 class="h3">Games</h3>
    <button class="btn btn-sm variant-filled-primary" onclick={loadGames} disabled={isLoading}>
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
        <h4 class="h5">Error Loading Games</h4>
        <p>{error}</p>
      </div>
    </div>
  {/if}
  
  {#if isLoading && games.length === 0}
    <div class="flex justify-center items-center p-10">
      <div class="spinner-third w-8 h-8"></div>
      <span class="ml-3">Loading games...</span>
    </div>
  {:else if games.length === 0}
    <div class="card p-6 variant-ghost-surface text-center">
      <span class="text-5xl mb-4 block">🎮</span>
      <h4 class="h4 mb-2">No Games Found</h4>
      <p class="text-sm max-w-lg mx-auto">
        There are no games in the database yet. Create a game to get started.
      </p>
    </div>
  {:else}
    <div class="table-container">
      <table class="table table-compact table-hover">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Deck</th>
            <th>Players</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each games as game}
            <tr>
              <td class="font-mono text-xs">{game.id}</td>
              <td>
                {game.data.name || 'Unnamed'} 
                {#if game.data.password}
                  <span class="badge bg-yellow-600 text-white text-xs ml-2 px-1">🔒 Private</span>
                {/if}
              </td>
              <td>
                <span class="badge {getStatusBadgeClass(game.data.status)} text-white text-xs px-2 py-1">
                  {game.data.status}
                </span>
              </td>
              <td class="font-mono text-xs">
                {game.data.deck_ref || 'None'} 
                <div class="text-xs opacity-70">{game.data.deck_type || ''}</div>
              </td>
              <td>
                {#if game.data.players}
                  {Object.keys(game.data.players).filter(k => k !== '_').length}
                  {#if game.data.max_players !== undefined && game.data.max_players > 0}
                    / {Number(game.data.max_players)}
                  {/if}
                {:else}
                  0
                {/if}
              </td>
              <td class="text-xs">
                {formatDate(game.data.created_at)}
              </td>
              <td>
                <div class="flex space-x-2">
                  <button 
                    class="action-button edit-button"
                    onclick={() => openEditModal(game.data)}
                    title="Edit Game Info"
                  >
                    <span class="icon">✏️</span> Edit
                  </button>
                  <button 
                    onclick={() => {
                      window.location.href = `/admin?tab=overview&gameId=${game.id}`;
                    }}
                    class="action-button view-button"
                    title="View Game Details"
                  >
                    <span class="icon">👁️</span> View
                  </button>
                  <button 
                    onclick={() => {
                      if (confirm(`Are you sure you want to delete game "${game.data.name || game.id}"? This cannot be undone.`)) {
                        deleteGame(game.id);
                      }
                    }}
                    class="action-button delete-button"
                    title="Delete Game"
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
  <GameEditModal 
    bind:isOpen={isModalOpen} 
    game={selectedGame}
    on:close={handleModalClose}
    on:update={handleGameUpdated}
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
  
  .view-button {
    background-color: #8b5cf6;
  }
  
  .view-button:hover {
    background-color: #7c3aed;
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
  
  .bg-blue-600 {
    background-color: #3b82f6;
  }
  
  .bg-red-600 {
    background-color: #ef4444;
  }
  
  .bg-yellow-600 {
    background-color: #f59e0b;
  }
  
  .bg-gray-600 {
    background-color: #6b7280;
  }
  
  .text-white {
    color: white;
  }
</style>