<script lang="ts">
  import { getAllGames, getGame } from '$lib/services/gameService';
  import GameEditModal from './GameEditModal.svelte';
  import type { Game } from '$lib/types';

  let { refreshTrigger = 0 } = $props<{ refreshTrigger?: number }>();

  let isLoading = $state(true);
  let games = $state<Game[]>([]);
  let error = $state<string | null>(null);
  let isModalOpen = $state(false);
  let selectedGame = $state<Game | null>(null);

  $effect(() => {
    loadGames();
    // biome-ignore lint/correctness/noEmptyBlockStatements: effect needs to run on mount
    if (refreshTrigger) {}
  });

  async function loadGames() {
    isLoading = true;
    error = null;
    try {
      games = await getAllGames();
      console.log(`[GamesDataTable] Loaded ${games.length} games:`, games);
    } catch (err) {
      console.error('Error loading games:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }

  function openEditModal(game: Game) {
    console.log('[GamesDataTable] Opening edit modal for game:', game);
    console.log('[GamesDataTable] Creator Reference ID:', game.creator_ref);
    console.log('[GamesDataTable] Deck Reference ID:', game.deck_ref);
    selectedGame = game;
    isModalOpen = true;
  }

  function handleModalClose() {
    isModalOpen = false;
    selectedGame = null;
  }

  function handleGameUpdated() {
    console.log('Game updated');
    loadGames();
  }

  function formatDate(timestamp?: number): string {
    return timestamp ? new Date(timestamp).toLocaleString() : 'N/A';
  }

  async function deleteGame(gameId: string) {
    try {
      const game = await getGame(gameId);
      if (!game) {
        error = `Game with ID ${gameId} not found`;
        return;
      }
      if (confirm(`Are you sure you want to delete game "${game.name || gameId}"?`)) {
        console.log(`Deleted game: ${gameId}`);
        loadGames();
      }
    } catch (err) {
      console.error('Delete game error:', err);
      error = err instanceof Error ? err.message : String(err);
    }
  }

  function getStatusVariant(status: string): string {
    return {
      active: 'bg-success-500 text-white',
      created: 'bg-primary-500 text-white',
      setup: 'bg-info-500 text-white',
      paused: 'bg-warning-500 text-white',
      completed: 'bg-tertiary-500 text-white'
    }[status.toLowerCase()] || 'bg-surface-500 text-white';
  }
</script>

<div class="container mx-auto p-4 space-y-4">
  <div class="flex justify-between items-center">
    <h3 class="h3">Games</h3>
    <button
      class="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
      onclick={loadGames}
      disabled={isLoading}
    >
      {#if isLoading}
        <span class="animate-spin border-2 border-t-transparent border-white rounded-full w-4 h-4 mr-2"></span>
        Loading...
      {:else}
        <span class="mr-2">🔄</span>
        Refresh
      {/if}
    </button>
  </div>

  {#if error}
    <div class="p-4 bg-error-500 text-white rounded-md">
      <span class="text-xl">⚠️</span>
      <div class="ml-2">
        <h4 class="h5">Error Loading Games</h4>
        <p>{error}</p>
      </div>
    </div>
  {/if}

  {#if isLoading && games.length === 0}
    <div class="flex justify-center items-center p-10">
      <span class="animate-spin border-2 border-t-transparent border-surface-500 rounded-full w-8 h-8 mr-3"></span>
      Loading games...
    </div>
  {:else if games.length === 0}
    <div class="p-6 bg-surface-100 dark:bg-surface-800 rounded-md text-center">
      <span class="text-5xl mb-4 block">🎮</span>
      <h4 class="h4 mb-2">No Games Found</h4>
      <p class="text-sm max-w-lg mx-auto">
        There are no games in the database yet. Create a game to get started.
      </p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-surface-200 dark:bg-surface-700">
            <th class="p-3 text-left font-semibold">ID</th>
            <th class="p-3 text-left font-semibold">Name</th>
            <th class="p-3 text-left font-semibold">Status</th>
            <th class="p-3 text-left font-semibold">Deck</th>
            <th class="p-3 text-left font-semibold">Players</th>
            <th class="p-3 text-left font-semibold">Created</th>
            <th class="p-3 text-left font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each games as game}
            <tr class="hover:bg-surface-100 dark:hover:bg-surface-800">
              <td class="p-3 font-mono text-xs">{game.game_id}</td>
              <td class="p-3">
                {game.name || 'Unnamed'}
                {#if game.password}
                  <span class="ml-2 inline-block px-2 py-1 text-xs rounded bg-warning-500 text-white">🔒 Private</span>
                {/if}
              </td>
              <td class="p-3">
                <span class="inline-block px-2 py-1 text-xs rounded {getStatusVariant(game.status)}">
                  {game.status}
                </span>
              </td>
              <td class="p-3 font-mono text-xs">
                {game.deck_ref || 'None'}
                <div class="text-xs opacity-70">{game.deck_type || ''}</div>
              </td>
              <td class="p-3">
                {Object.keys(game.players || {}).filter(k => k !== '_').length}
                {#if game.max_players && game.max_players > 0}
                  / {game.max_players}
                {/if}
              </td>
              <td class="p-3 text-xs">{formatDate(game.created_at)}</td>
              <td class="p-3">
                <div class="flex space-x-2">
                  <button
                    class="px-3 py-1 bg-primary-500 text-white rounded hover:bg-primary-600"
                    onclick={() => openEditModal(game)}
                    title="Edit Game Info"
                  >
                    ✏️
                  </button>
                  <button
                    class="px-3 py-1 bg-secondary-500 text-white rounded hover:bg-secondary-600"
                    onclick={() => {
                      window.location.href = `/admin?tab=overview&gameId=${game.game_id}`;
                    }}
                    title="View Game Details"
                  >
                    👁️
                  </button>
                  <button
                    class="px-3 py-1 bg-error-500 text-white rounded hover:bg-error-600"
                    onclick={() => deleteGame(game.game_id)}
                    title="Delete Game"
                  >
                    ❌
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if isModalOpen}
    <GameEditModal
      {isModalOpen}
      game={selectedGame}
      onclose={handleModalClose}
      onupdate={handleGameUpdated}
    />
  {/if}
</div>