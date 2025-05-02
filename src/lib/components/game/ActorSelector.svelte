<script lang="ts">
  import { goto } from '$app/navigation';
  import * as icons from '@lucide/svelte';
  import { 
    createActor, 
    joinGame, 
    updateGame 
  } from '$lib/services/gameService';
  import { currentGameStore } from '$lib/stores/gameStore';
  import { userStore } from '$lib/stores/userStore';
  import type { Game, CardWithPosition } from '$lib/types';

  // Props
  const {
    gameId,
    game,
    availableCardsForActors = [],
    onGameEnter = () => goto(`/games/${gameId}`)
  } = $props<{
    gameId: string;
    game: Game;
    availableCardsForActors?: CardWithPosition[];
    onGameEnter?: () => void;
  }>();

  // State
  let selectedCardId = $state<string>('');
  let actorType = $state<'National Identity' | 'Sovereign Identity'>('National Identity');
  let customName = $state<string>('');
  let isJoining = $state<boolean>(false);
  let errorMessage = $state<string>('');

  // Ensure we pick a default card as soon as the list arrives
  $effect(() => {
    if (!selectedCardId && availableCardsForActors.length > 0) {
      selectedCardId = availableCardsForActors[0].card_id;
    }
  });

  // Main “join” handler
  async function handleJoin() {
    if (! $userStore.user) {
      errorMessage = 'You must be logged in to join';
      return;
    }
    if (!selectedCardId) {
      errorMessage = 'Please select a card';
      return;
    }

    isJoining = true;
    errorMessage = '';

    try {
      // 1) Create the actor
      const actor = await createActor(
        gameId,
        selectedCardId,
        actorType,
        customName || undefined
      );
      if (!actor) throw new Error('Actor creation failed');

      // 2) Add you to the game
      const joined = await joinGame(gameId);
      if (!joined) throw new Error('Game join failed');

      // 3) Mark game ACTIVE (if necessary)
      await updateGame(gameId, { status: game.status });

      // 4) Keep your store in sync
      currentGameStore.set(game);

      // 5) Hand off to parent / navigate in
      onGameEnter();
    } catch (err) {
      console.error(err);
      errorMessage = err instanceof Error ? err.message : 'Unable to join game';
    } finally {
      isJoining = false;
    }
  }
</script>

<div class="space-y-4">
  {#if errorMessage}
    <div class="alert variant-filled-error p-4">
      <icons.AlertCircle class="mr-2" />
      <span>{errorMessage}</span>
    </div>
  {/if}

  <label class="label">
    <span class="font-semibold">Identity Type</span>
    <select class="select w-full mt-1" bind:value={actorType}>
      <option value="National Identity">National Identity</option>
      <option value="Sovereign Identity">Sovereign Identity</option>
    </select>
  </label>

  <label class="label">
    <span class="font-semibold">Custom Name (optional)</span>
    <input
      class="input w-full mt-1"
      type="text"
      bind:value={customName}
      placeholder="Enter a name for your actor"
    />
  </label>

  <label class="label">
    <span class="font-semibold">Choose Your Card</span>
    <select class="select w-full mt-1" bind:value={selectedCardId}>
      {#each availableCardsForActors as card}
        <option value={card.card_id}>
          {card.role_title || 'Unnamed'} {card.card_category ? `(${card.card_category})` : ''}
        </option>
      {/each}
    </select>
  </label>

  <button
    class="btn variant-filled-primary w-full flex justify-center items-center"
    on:click={handleJoin}
    disabled={isJoining}
  >
    {#if isJoining}
      <span class="spinner-third w-4 h-4 mr-2"></span> Joining…
    {:else}
      <icons.UserPlus class="mr-2" /> Join Game
    {/if}
  </button>

  <button
    class="btn variant-ghost-surface w-full"
    on:click={() => goto(`/games/${gameId}`)}
  >
    <icons.Eye class="mr-2" /> View Game Without Joining
  </button>
</div>
