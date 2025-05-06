<script lang="ts">
  import { goto } from '$app/navigation';
  import * as icons from '@lucide/svelte';
  import {
    createActor,
    joinWithActor,
    updateGame
  } from '$lib/services/gameService';
  import { currentGameStore } from '$lib/stores/gameStore';
  import { userStore } from '$lib/stores/userStore';
  import type {
    Game,
    ActorWithCard,
    CardWithPosition
  } from '$lib/types';

  // ─── Props ──────────────────────────────────────────────────────────────────
  const {
    gameId,
    game,
    actors = [] as ActorWithCard[],
    availableCardsForActors = [] as CardWithPosition[],
    onGameEnter = () => goto(`/games/${gameId}`)
  } = $props<{
    gameId: string;
    game: Game;
    actors?: ActorWithCard[];
    availableCardsForActors?: CardWithPosition[];
    onGameEnter?: () => void;
  }>();

  console.log('ActorSelector props:', { gameId, game, actors, availableCardsForActors });

  // ─── Local state ────────────────────────────────────────────────────────────
  let joinMode        = $state<'existing'|'new'>('existing');
  let selectedActorId = $state<string>('');
  let selectedCardId  = $state<string>('');
  let actorType       = $state<'National Identity'|'Sovereign Identity'>('National Identity');
  let customName      = $state<string>('');
  let isJoining       = $state<boolean>(false);
  let errorMessage    = $state<string>('');

  // ─── Derived: this user’s existing actors ───────────────────────────────────
  const existingActors = $derived(() => {
    const uid = $userStore.user?.user_id;
    const list = actors.filter((a) => a.user_ref === uid);
    console.log('Derived existingActors for', uid, list);
    return list;
  });

  // ─── Defaults & Debug ────────────────────────────────────────────────────────
  $effect(() => {
    console.log('availableCardsForActors →', availableCardsForActors);
    if (availableCardsForActors.length && !selectedCardId) {
      selectedCardId = availableCardsForActors[0].card_id;
      console.log('Default selectedCardId →', selectedCardId);
    }
  });

  $effect(() => {
    console.log('existingActors →', existingActors);
    if (existingActors.length && !selectedActorId) {
      selectedActorId = existingActors[0].actor_id;
      console.log('Default selectedActorId →', selectedActorId);
    }
  });

  // ─── NEW EFFECT: force “new” when no existing actors ────────────────────────
  $effect(() => {
    if (existingActors.length === 0 && joinMode === 'existing') {
      console.log('No existing actors — switching joinMode to "new"');
      joinMode = 'new';
    }
  });

  // ─── Main join handler ──────────────────────────────────────────────────────
  async function handleJoin() {
    console.log('handleJoin start:', {
      user: $userStore.user,
      joinMode,
      selectedActorId,
      selectedCardId,
      actorType,
      customName
    });

    if (!$userStore.user) {
      errorMessage = 'You must be logged in to join';
      return;
    }

    if (joinMode === 'existing') {
      console.log('Using existing actor branch');
      if (!selectedActorId) {
        errorMessage = 'Please select an actor';
        return;
      }
    } else {
      console.log('Creating new actor branch');
      if (!selectedCardId) {
        errorMessage = 'Please select a card';
        return;
      }
    }

    isJoining = true;
    errorMessage = '';

    try {
      let actorId: string;

      if (joinMode === 'existing') {
        actorId = selectedActorId;
      } else {
        console.log('Calling createActor()', {
          gameId,
          card: selectedCardId,
          actorType,
          customName
        });
        const newActor = await createActor(
          gameId,
          selectedCardId,
          actorType,
          customName || undefined
        );
        console.log('createActor result:', newActor);
        if (!newActor) throw new Error('Actor creation failed');
        actorId = newActor.actor_id;
      }

      console.log('Calling joinWithActor()', { gameId, actorId });
      const didJoin = await joinWithActor(gameId, actorId);
      console.log('joinWithActor →', didJoin);
      if (!didJoin) throw new Error('Game join failed');

      console.log('Calling updateGame()', game.status);
      await updateGame(gameId, { status: game.status });

      console.log('Syncing currentGameStore and navigating in');
      currentGameStore.set(game);
      onGameEnter();
    } catch (err) {
      console.error('handleJoin error:', err);
      errorMessage = err instanceof Error ? err.message : 'Unable to join game';
    } finally {
      isJoining = false;
      console.log('handleJoin end');
    }
  }
</script>

<div class="space-y-4">
  {#if existingActors.length}
    <fieldset class="flex gap-6">
      <label class="flex items-center cursor-pointer">
        <input
          type="radio"
          class="radio mr-2"
          bind:group={joinMode}
          value="existing"
        />
        Use Existing Actor
      </label>
      <label class="flex items-center cursor-pointer">
        <input
          type="radio"
          class="radio mr-2"
          bind:group={joinMode}
          value="new"
        />
        Create New Actor
      </label>
    </fieldset>
  {/if}

  {#if joinMode === 'existing' && existingActors.length}
    <label class="label">
      <span class="font-semibold">Select Actor</span>
      <select class="select w-full mt-1" bind:value={selectedActorId}>
        {#each existingActors as actor}
          <option value={actor.actor_id}>
            {actor.custom_name ?? actor.actor_id}
          </option>
        {/each}
      </select>
    </label>
  {:else}
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
            {card.role_title}{card.card_category ? ` (${card.card_category})` : ''}
          </option>
        {/each}
      </select>
    </label>
  {/if}

  {#if errorMessage}
    <div class="alert variant-filled-error p-4">
      <icons.AlertCircle class="mr-2" />
      <span>{errorMessage}</span>
    </div>
  {/if}

  <button
    class="btn variant-filled-primary w-full flex justify-center items-center"
    onclick={handleJoin}
    disabled={isJoining}
  >
    {#if isJoining}
      <span class="spinner-third w-4 h-4 mr-2"></span>
      Joining…
    {:else}
      <icons.UserPlus class="mr-2" />
      Join Game
    {/if}
  </button>

  <button
    class="btn variant-ghost-surface w-full"
    onclick={() => goto(`/games/${gameId}`)}
  >
    <icons.Eye class="mr-2" />
    View Game Without Joining
  </button>
</div>
