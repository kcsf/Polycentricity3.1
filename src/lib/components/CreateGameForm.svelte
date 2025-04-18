<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createGame } from '$lib/services/gameService';
  import type { Game } from '$lib/types';

  const dispatch = createEventDispatcher<{
    created: { gameId: string };
    statusUpdate: { status: string; message?: string };
  }>();

  let gameName: string = $state('');
  let deckOption: 'predefined' | 'custom' = $state('predefined');
  let deckType: 'eco-village' | 'community-garden' = $state('eco-village');
  let roleAssignment: 'random' | 'player-choice' = $state('random');
  let isCreating: boolean = $state(false);
  let error: string = $state('');
  let statusMessage: string = $state('');

  const isDev = import.meta.env.DEV;
  const log = (...args: any[]) => isDev && console.log('[CreateGameForm]', ...args);
  const logError = (...args: any[]) => isDev && console.error('[CreateGameForm]', ...args);

  const predefinedDeckTypes = [
    { value: 'eco-village', label: 'Eco-Village' },
    { value: 'community-garden', label: 'Community Garden' }
  ];

  async function handleSubmit() {
    if (!gameName.trim()) {
      error = 'Please enter a game name';
      return;
    }

    isCreating = true;
    error = '';
    statusMessage = 'Creating game...';
    dispatch('statusUpdate', { status: 'creating', message: statusMessage });

    try {
      const selectedDeckType = deckOption === 'custom' ? 'eco-village' : deckType;
      log(`Creating game: ${gameName}, ${selectedDeckType}, ${roleAssignment}`);

      // Timeout for debugging slow operations
      const start = performance.now();
      const game = await createGame(gameName, selectedDeckType, roleAssignment);
      log(`createGame took ${performance.now() - start}ms`);

      if (game) {
        log(`Game created: ${game.game_id}`);
        statusMessage = 'Game created successfully!';
        dispatch('statusUpdate', { status: 'success', message: statusMessage });
        dispatch('created', { gameId: game.game_id });
      } else {
        error = 'Failed to create game';
        dispatch('statusUpdate', { status: 'error', message: error });
      }
    } catch (err) {
      logError('Error creating game:', err);
      error = 'An error occurred while creating the game';
      dispatch('statusUpdate', { status: 'error', message: error });
    } finally {
      isCreating = false;
      statusMessage = '';
    }
  }
</script>

<div class="card p-4 shadow bg-surface-900/80 backdrop-blur-sm">
  <header class="card-header">
    <h3 class="h3">Create New Game</h3>
  </header>
  <div class="p-4">
    <form onsubmit={e => { e.preventDefault(); handleSubmit(); }}>
      {#if error}
        <div class="alert variant-ghost-secondary mb-4">
          <p class="text-secondary-200 text-sm">{error}</p>
        </div>
      {/if}
      {#if statusMessage}
        <div class="alert variant-ghost-primary mb-4">
          <p class="text-primary-200 text-sm">{statusMessage}</p>
        </div>
      {/if}
      <label class="label mb-4">
        <span>Game Name</span>
        <input
          type="text"
          class="input"
          bind:value={gameName}
          placeholder="Enter a game name"
          required
        />
      </label>
      <div class="space-y-4 mb-4">
        <span class="font-semibold">Deck Type</span>
        <div class="flex gap-4">
          <label class="flex items-center space-x-2">
            <input
              type="radio"
              bind:group={deckOption}
              name="deckOption"
              value="predefined"
              class="radio"
            />
            <span>Predefined Deck</span>
          </label>
          <label class="flex items-center space-x-2 opacity-50 cursor-not-allowed">
            <input
              type="radio"
              name="deckOption"
              value="custom"
              class="radio"
              disabled
            />
            <span>Custom Deck (Coming Soon)</span>
          </label>
        </div>
        {#if deckOption === 'predefined'}
          <label class="label mt-2">
            <span class="text-sm opacity-75">Select Deck</span>
            <select class="select" bind:value={deckType}>
              {#each predefinedDeckTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </label>
        {:else}
          <div class="alert variant-filled-warning mt-2">
            <p>Custom deck creation is coming soon! Please select a predefined deck.</p>
          </div>
        {/if}
      </div>
      <div class="space-y-4 mb-6">
        <span class="font-semibold">Role Assignment</span>
        <div class="flex gap-4">
          <label class="flex items-center space-x-2">
            <input
              type="radio"
              bind:group={roleAssignment}
              name="roleAssignment"
              value="random"
              class="radio"
            />
            <span>Random Assignment</span>
          </label>
          <label class="flex items-center space-x-2">
            <input
              type="radio"
              bind:group={roleAssignment}
              name="roleAssignment"
              value="player-choice"
              class="radio"
            />
            <span>Player's Choice</span>
          </label>
        </div>
      </div>
      <div class="flex justify-end">
        <button
          type="submit"
          class="btn variant-filled-primary"
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Game'}
        </button>
      </div>
    </form>
  </div>
</div>
