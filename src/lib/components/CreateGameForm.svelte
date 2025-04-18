<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createGame } from '$lib/services/gameService';
  import { goto } from '$app/navigation';
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
  let createdGameId: string = $state('');
  let currentAttempt: number = $state(0);
  let maxRetries: number = 3;
  let retryDelays: number[] = [500, 1000, 2000]; // Exponential backoff

  const isDev = import.meta.env.DEV;
  const log = (...args: any[]) => isDev && console.log('[CreateGameForm]', ...args);
  const logError = (...args: any[]) => isDev && console.error('[CreateGameForm]', ...args);

  const predefinedDeckTypes = [
    { value: 'eco-village', label: 'Eco-Village' },
    { value: 'community-garden', label: 'Community Garden' }
  ];

  function createGameWithRetry(
    name: string, 
    deckType: string, 
    roleAssignment: string, 
    attempt: number = 0
  ): Promise<Game | null> {
    if (attempt >= maxRetries) {
      logError(`Max retries (${maxRetries}) reached for game creation`);
      return Promise.resolve(null);
    }

    currentAttempt = attempt + 1;
    dispatch('statusUpdate', { 
      status: attempt > 0 ? 'retrying' : 'creating', 
      message: attempt > 0 ? `Retry ${attempt}/${maxRetries}...` : 'Creating game...' 
    });

    return new Promise((resolve) => {
      log(`Attempt ${attempt + 1}/${maxRetries + 1} to create game`);
      const start = performance.now();
      
      // Set a reasonable timeout for the entire operation
      const operationTimeout = setTimeout(() => {
        log(`Attempt ${attempt + 1} timed out after 10s`);
        const nextDelay = retryDelays[attempt];
        
        setTimeout(() => {
          // Retry with incremented attempt count
          createGameWithRetry(name, deckType, roleAssignment, attempt + 1)
            .then(resolve);
        }, nextDelay);
      }, 10000);

      // Attempt to create game
      createGame(name, deckType, roleAssignment)
        .then(game => {
          clearTimeout(operationTimeout);
          const duration = performance.now() - start;
          log(`createGame attempt ${attempt + 1} took ${duration}ms`);
          
          if (game) {
            // Success - return game data
            resolve(game);
          } else if (attempt < maxRetries) {
            // Retry after delay
            const nextDelay = retryDelays[attempt];
            log(`Retrying in ${nextDelay}ms...`);
            
            setTimeout(() => {
              createGameWithRetry(name, deckType, roleAssignment, attempt + 1)
                .then(resolve);
            }, nextDelay);
          } else {
            // All retries failed
            resolve(null);
          }
        })
        .catch(err => {
          clearTimeout(operationTimeout);
          logError(`Error in attempt ${attempt + 1}:`, err);
          
          if (attempt < maxRetries) {
            // Retry after delay
            const nextDelay = retryDelays[attempt];
            log(`Error occurred, retrying in ${nextDelay}ms...`);
            
            setTimeout(() => {
              createGameWithRetry(name, deckType, roleAssignment, attempt + 1)
                .then(resolve);
            }, nextDelay);
          } else {
            // All retries failed
            resolve(null);
          }
        });
    });
  }

  async function handleSubmit() {
    if (!gameName.trim()) {
      error = 'Please enter a game name';
      return;
    }

    isCreating = true;
    error = '';
    createdGameId = '';
    currentAttempt = 0;
    dispatch('statusUpdate', { status: 'creating', message: 'Creating game...' });

    try {
      const selectedDeckType = deckOption === 'custom' ? 'eco-village' : deckType;
      log(`Creating game: ${gameName}, ${selectedDeckType}, ${roleAssignment}`);

      // Important: FIRE AND FORGET approach
      // We dispatch a background task to create the game and immediately
      // notify the user that the game is being created

      // Start the retry process
      const game = await createGameWithRetry(gameName, selectedDeckType, roleAssignment);

      if (game) {
        // Success! Update UI immediately and trigger navigation
        log(`Game created: ${game.game_id}`);
        createdGameId = game.game_id;
        dispatch('statusUpdate', { status: 'success', message: 'Game created successfully!' });
        dispatch('created', { gameId: game.game_id });
        
        // Navigation will be handled by the parent component
      } else {
        // All retries failed
        error = 'Failed to create game after multiple attempts';
        dispatch('statusUpdate', { status: 'error', message: error });
      }
    } catch (err) {
      logError('Unhandled error in game creation:', err);
      error = 'An unexpected error occurred';
      dispatch('statusUpdate', { status: 'error', message: error });
    } finally {
      isCreating = false;
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
        <div class="alert variant-filled-error mb-4">
          <p class="text-sm">{error}</p>
        </div>
      {/if}
      
      {#if isCreating}
        <div class="alert variant-filled-primary mb-4">
          <div class="flex items-center">
            <div class="spinner-third w-4 h-4 mr-2"></div>
            <div>
              <p class="font-semibold">
                {currentAttempt > 1 ? `Retrying... (${currentAttempt}/${maxRetries + 1})` : 'Creating game...'}
              </p>
              <p class="text-sm">This may take a moment.</p>
            </div>
          </div>
        </div>
      {:else if createdGameId}
        <div class="alert variant-filled-success mb-4">
          <div class="flex items-center">
            <div class="mr-2">✓</div>
            <div>
              <p class="font-semibold">Game created successfully!</p>
              <p class="text-sm">Redirecting to your game...</p>
            </div>
          </div>
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
          disabled={isCreating}
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
              disabled={isCreating}
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
            <select class="select" bind:value={deckType} disabled={isCreating}>
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
              disabled={isCreating}
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
              disabled={isCreating}
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
