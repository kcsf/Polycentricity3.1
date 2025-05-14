<script lang="ts">
  import { goto } from '$app/navigation';
  import * as icons from '@lucide/svelte';
  import {
    createActor,
    joinWithActor,
    updateGame
  } from '$lib/services/gameService';
  import { getCurrentUser } from '$lib/services/authService';
  import { currentGameStore } from '$lib/stores/gameStore';
  import { userStore } from '$lib/stores/userStore';
  import type { Game, ActorWithCard, CardWithPosition, User, Actor } from '$lib/types';
  
  import { get, getSet, nodes, getCollection } from '$lib/services/gunService';

  // ─── Props ──────────────────────────────────────────────────────────────────
  let {
    gameId,
    game,
    actors = [] as ActorWithCard[],
    availableCardsForActors = [] as CardWithPosition[],
    onGameEnter = () => goto(`/games/${gameId}`),
  } = $props<{
    gameId: string;
    game: Game;
    actors: ActorWithCard[];
    availableCardsForActors: CardWithPosition[];
    onGameEnter: () => void;
  }>();

  // ─── Local state ────────────────────────────────────────────────────────────
  let joinMode = $state<'existing' | 'new'>('existing');
  let selectedActorId = $state<string>('');
  let selectedCardId = $state<string>('');
  let actorType = $state<'National Identity' | 'Sovereign Identity'>('National Identity');
  let customName = $state<string>('');
  let isJoining = $state<boolean>(false);
  let errorMessage = $state<string>('');

  let userActors = $state<ActorWithCard[]>([]);
  let isLoadingActors = $state(false);

  // ─── Fetch user actors ───────────────────────────────────────────────────────
  async function fetchUserActors(): Promise<ActorWithCard[]> {
    isLoadingActors = true;
    const currentUser = getCurrentUser();
    const userId = currentUser?.user_id;
    if (!userId) {
      isLoadingActors = false;
      return [];
    }

    try {
      const actorRefs = await getSet(`${nodes.users}/${userId}`, 'actors_ref');
      let fetched: ActorWithCard[] = [];

      if (actorRefs.length) {
        const results = await Promise.all(
          actorRefs.map(async ref => {
            const actorId = ref.split('/').pop()!;
            const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
            if (!actor) return null;
            return {
              ...actor,
              card: undefined
            } as ActorWithCard;
          })
        );
        fetched = results.filter((a): a is ActorWithCard => a !== null);
      } else {
        const allActors = await getCollection<Actor>(nodes.actors);
        fetched = allActors
          .filter(a => a.user_ref === userId)
          .map(a => ({ ...a, card: undefined } as ActorWithCard));
      }

      userActors = fetched;
      return fetched;
    } catch (err) {
      console.error('[ActorSelector] Error fetching user actors:', err);
      return [];
    } finally {
      isLoadingActors = false;
    }
  }

  // ─── EFFECT: initialize existingActors ───────────────────────────────────────
  let existingActors = $state<ActorWithCard[]>([]);
  $effect(() => {
    (async () => {
      const fetched = await fetchUserActors();
      existingActors = fetched;
    })();
  });

  // ─── Default card selection ─────────────────────────────────────────────────
  $effect(() => {
    if (availableCardsForActors.length && !selectedCardId) {
      selectedCardId = availableCardsForActors[0].card_id;
    }
  });

  // ─── Force "new" mode when no existing actors ───────────────────────────────
  $effect(() => {
    if (!existingActors.length && joinMode === 'existing') {
      joinMode = 'new';
    } else if (existingActors.length && !selectedActorId) {
      selectedActorId = existingActors[0].actor_id;
    }
  });

  // ─── Main join handler ──────────────────────────────────────────────────────
  async function handleJoin() {
    let currentUser: User | null = null;
    userStore.subscribe(s => (currentUser = s.user))();
    if (!currentUser) {
      errorMessage = 'You must be logged in to join';
      return;
    }

    if (!selectedCardId) {
      errorMessage = 'Please select a card';
      return;
    }
    if (joinMode === 'existing' && !selectedActorId) {
      errorMessage = 'Please select an actor';
      return;
    }

    isJoining = true;
    errorMessage = '';
    try {
      const actorId =
        joinMode === 'existing'
          ? selectedActorId
          : (await createActor(
              gameId,
              selectedCardId,
              actorType,
              customName || undefined
            ))!.actor_id;

      const didJoin = await joinWithActor(gameId, actorId, selectedCardId);
      if (!didJoin) throw new Error('Game join failed');

      await updateGame(gameId, { status: game.status });
      currentGameStore.set(game);
      onGameEnter();
    } catch (err) {
      console.error('handleJoin error:', err);
      errorMessage = err instanceof Error ? err.message : 'Unable to join game';
    } finally {
      isJoining = false;
    }
  }
</script>


<div class="space-y-4">
  <!-- Loading indicator when fetching actors -->
  {#if isLoadingActors}
    <div class="flex justify-center items-center p-4">
      <span class="spinner-third h-8 w-8"></span>
      <span class="ml-2">Loading your actors...</span>
    </div>
  
  <!-- Authentication check -->
  {:else if !getCurrentUser()}
    <div class="alert preset-filled-warning p-4">
      <icons.AlertTriangle class="mr-2" />
      <span>You must be logged in to join this game.</span>
    </div>
    
    <button
      class="btn preset-filled-primary w-full flex justify-center items-center"
      onclick={() => goto('/login')}
    >
      <icons.LogIn class="mr-2" />
      Log In
    </button>
    
    <button
      class="btn preset-ghost-surface-secondary w-full"
      onclick={() => goto(`/games/${gameId}`)}
    >
      <icons.Eye class="mr-2" />
      View Game Without Joining
    </button>
  
  <!-- Main join interface -->
  {:else}
    <!-- Radio group for choosing mode (only shown if user has existing actors) -->
    {#if existingActors?.length}
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

    <!-- Existing Actor Selection -->
    {#if joinMode === 'existing' && existingActors?.length}
      <label class="label">
        <span class="font-semibold">Select Actor</span>
        <select class="select w-full mt-1" bind:value={selectedActorId}>
          {#each existingActors as actor (actor.actor_id)}
          <option value={actor.actor_id}>
            {actor.custom_name ?? actor.actor_id}
          </option>
        {/each}
        </select>
      </label>
      
      <!-- Add card selection for existing actors too -->
      <label class="label">
        <span class="font-semibold">Choose Your Card</span>
        <select class="select w-full mt-1" bind:value={selectedCardId}>
          {#each availableCardsForActors as card (card.card_id)}
            <option value={card.card_id}>
              {card.role_title}{card.card_category ? ` (${card.card_category})` : ''}
            </option>
          {/each}
        </select>
      </label>
    <!-- New Actor Creation -->
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
          {#each availableCardsForActors as card (card.card_id)}
            <option value={card.card_id}>
              {card.role_title}{card.card_category ? ` (${card.card_category})` : ''}
            </option>
          {/each}
        </select>
      </label>
    {/if}

    <!-- Error message display -->
    {#if errorMessage}
      <div class="alert preset-filled-error p-4">
        <icons.AlertCircle class="mr-2" />
        <span>{errorMessage}</span>
      </div>
    {/if}

    <!-- Action buttons -->
    <button
      class="btn preset-filled-primary w-full flex justify-center items-center"
      onclick={handleJoin}
      disabled={isJoining || !getCurrentUser()}
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
      class="btn preset-ghost-surface-secondary w-full"
      onclick={() => goto(`/games/${gameId}`)}
    >
      <icons.Eye class="mr-2" />
      View Game Without Joining
    </button>
  {/if}
</div>