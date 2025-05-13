<script lang="ts">
  import { goto } from '$app/navigation';
  import * as icons from '@lucide/svelte';
  import {
    createActor,
    joinWithActor,
    updateGame,
    getGame
  } from '$lib/services/gameService';
  import { getCurrentUser } from '$lib/services/authService';
  import { currentGameStore } from '$lib/stores/gameStore';
  import { userStore } from '$lib/stores/userStore';
  import type { Game, ActorWithCard, CardWithPosition, User, Actor } from '$lib/types';
  
  // We'll import gunService directly to fetch user actors
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

  console.log('ActorSelector props:', { gameId, game, actors, availableCardsForActors });

  // ─── Local state ────────────────────────────────────────────────────────────
  let joinMode = $state<'existing' | 'new'>('existing');
  let selectedActorId = $state<string>('');
  let selectedCardId = $state<string>('');
  let actorType = $state<'National Identity' | 'Sovereign Identity'>('National Identity');
  let customName = $state<string>('');
  let isJoining = $state<boolean>(false);
  let errorMessage = $state<string>('');

  // ─── User's existing actors ───────────────────────────────────────────────
  let userActors = $state<ActorWithCard[]>([]);
  let isLoadingActors = $state(false);
  
  // Function to fetch user actors directly from the database
  async function fetchUserActors() {
    isLoadingActors = true;
    
    // Get current user from authService
    const currentUser = getCurrentUser();
    
    // Debug authentication state
    console.log('[ActorSelector] Authentication check:', { 
      hasUser: !!currentUser,
      userId: currentUser?.user_id
    });
    
    if ($userStore.user) {
      console.log('[ActorSelector] User store user ID:', $userStore.user.user_id);
    } else {
      console.log('[ActorSelector] No user in userStore');
    }
    
    // Get user ID safely
    const userId = currentUser?.user_id;
    
    if (!userId) {
      console.log('[ActorSelector] No authenticated user found');
      isLoadingActors = false;
      return [];
    }
    
    try {
      console.log(`[ActorSelector] Fetching actors for user: ${userId}`);
      
      // First check if user has actors_ref set
      const actorRefs = await getSet(`${nodes.users}/${userId}`, "actors_ref");
      console.log(`[ActorSelector] Found ${actorRefs.length} actor references for user ${userId}`);
      
      let fetchedActors: ActorWithCard[] = [];
      
      // If user has actor references, fetch those specific actors
      if (actorRefs.length > 0) {
        console.log(`[ActorSelector] Fetching ${actorRefs.length} specific actors:`, actorRefs);
        
        const userActorsData = await Promise.all(
          actorRefs.map(async (ref) => {
            // Extract actor ID from reference path
            const actorId = ref.includes('/') ? ref.split('/').pop()! : ref;
            console.log(`[ActorSelector] Fetching actor: ${actorId}`);
            
            const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
            
            if (actor) {
              console.log(`[ActorSelector] Found actor: ${actorId}`, actor);
              // Convert to ActorWithCard format expected by the component
              return {
                ...actor,
                card: null // We don't need the card details here
              } as ActorWithCard;
            }
            console.log(`[ActorSelector] Actor not found: ${actorId}`);
            return null;
          })
        );
        
        // Filter out any nulls from failed fetches
        fetchedActors = userActorsData.filter((actor): actor is ActorWithCard => actor !== null);
      } else {
        console.log(`[ActorSelector] No actor references found, querying all actors`);
        
        // Fallback: query all actors and filter by user reference
        const allActors = await getCollection<Actor>(nodes.actors);
        console.log(`[ActorSelector] Found ${allActors.length} total actors, filtering for user ${userId}`);
        
        fetchedActors = allActors
          .filter(actor => actor.user_ref === userId)
          .map(actor => ({
            ...actor,
            card: null // We don't need the card details here
          } as ActorWithCard));
          
        console.log(`[ActorSelector] After filtering, found ${fetchedActors.length} actors for user ${userId}`);
      }
      
      console.log('[ActorSelector] Final actors found:', fetchedActors.length, fetchedActors);
      userActors = fetchedActors;
      return fetchedActors;
    } catch (error) {
      console.error('[ActorSelector] Error fetching user actors:', error);
      return [];
    } finally {
      isLoadingActors = false;
    }
  }
  
  // Call fetchUserActors on component initialization and track results
  let existingActors = $state<ActorWithCard[]>([]);
  
  $effect(async () => {
    console.log('[ActorSelector] Initializing fetchUserActors effect');
    const actors = await fetchUserActors();
    console.log('[ActorSelector] Setting existingActors to', actors);
    existingActors = actors;
  });

  // ─── Defaults & Debug ────────────────────────────────────────────────────────
  $effect(() => {
    console.log('availableCardsForActors →', availableCardsForActors);
    if (availableCardsForActors.length && !selectedCardId) {
      selectedCardId = availableCardsForActors[0].card_id;
      console.log('Default selectedCardId →', selectedCardId);
    }
  });

  // Log existingActors whenever it changes
  $effect(() => {
    console.log('existingActors →', existingActors);
  });

  // ─── EFFECTS: Handle actors and authentication ─────────────────────────────
  
  // Check authentication status on component initialization
  $effect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.log('[ActorSelector] Not authenticated - will show login warning');
      // Clear any previous error message
      errorMessage = '';
    }
  });
  
  // Force "new" mode when no existing actors are available
  $effect(() => {
    console.log('[ActorSelector] Checking existingActors length:', existingActors?.length);
    if (!existingActors?.length && joinMode === 'existing') {
      console.log('[ActorSelector] No existing actors — switching joinMode to "new"');
      joinMode = 'new';
    } else if (existingActors?.length) {
      console.log('[ActorSelector] Found existing actors, setting selectedActorId');
      // Set default selected actor if we have actors but no selection
      if (!selectedActorId && existingActors.length > 0) {
        selectedActorId = existingActors[0].actor_id;
        console.log('[ActorSelector] Default selectedActorId →', selectedActorId);
      }
    }
  });

  // ─── Main join handler ──────────────────────────────────────────────────────
  async function handleJoin() {
    // Get current user safely
    let currentUser;
    userStore.subscribe(session => {
      currentUser = session.user;
    })();
    
    console.log('handleJoin start:', {
      user: currentUser?.user_id || 'Not logged in',
      joinMode,
      selectedActorId,
      selectedCardId,
      actorType,
      customName,
    });

    if (!currentUser) {
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
          customName,
        });
        const newActor = await createActor(
          gameId,
          selectedCardId,
          actorType,
          customName || undefined,
        );
        console.log('createActor result:', newActor);
        if (!newActor) throw new Error('Actor creation failed');
        actorId = newActor.actor_id;
      }

      console.log('Calling joinWithActor()', { gameId, actorId });
      const didJoin = await joinWithActor(gameId, actorId);
      console.log('joinWithActor →', didJoin);
      if (!didJoin) throw new Error('Game join failed');
      
      // Debug database state after joining
      console.log('Checking game state after joining');
      
      // This part is critical - we need to manually update actors_ref
      // since joinWithActor doesn't do it properly
      
      // Get the current game
      const updatedGame = await getGame(gameId);
      console.log('Game after joining:', updatedGame);
      
      if (updatedGame) {
        console.log('Current game.players:', updatedGame.players);
        console.log('Current game.player_actor_map:', updatedGame.player_actor_map);
        console.log('Current game.actors_ref:', updatedGame.actors_ref); 
        
        // The issue is that game.actors_ref is not being updated!
        // We need to manually add the actor to actors_ref for proper display
        
        // Let's fix the missing actors_ref relationship
        // This will fix the issue where the details page doesn't recognize the actor
        try {
          console.log(`Adding relationship between game ${gameId} 'actors_ref' and actor ${actorId}`);
          
          // Create the bidirectional relationship - this is what's missing from joinWithActor
          const gameActorsRefPath = `${nodes.games}/${gameId}/actors_ref`;
          const actorPath = `${nodes.actors}/${actorId}`;
          
          // Create an object with actor_id: true
          const actorsRefMap = { ...(updatedGame.actors_ref || {}) };
          actorsRefMap[actorId] = true;
          
          // Update the map first
          await get(gameActorsRefPath).put(actorsRefMap);
          console.log('Updated game.actors_ref map:', actorsRefMap);
          
          // Then create the relationship edge
          await get(gameActorsRefPath).set(get(actorPath));
          console.log(`Created relationship from ${gameActorsRefPath} to ${actorPath}`);
          
          console.log('FIXED: Added actor to game.actors_ref');
        } catch (err) {
          console.error('Error fixing actors_ref relationship:', err);
        }
      }

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