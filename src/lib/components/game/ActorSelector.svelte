<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    getUserActors, 
    getAvailableCardsForGame, 
    createActor, 
    subscribeToUserCard,
    joinGame,
    assignRole
  } from '$lib/services/gameService';
  import { nodes, createRelationship } from '$lib/services/gunService';
  import { getCurrentUser } from '$lib/services/authService';
  import type { Actor, Card } from '$lib/types';
  import * as icons from 'lucide-svelte';
  
  // Use Svelte 5 $props() syntax
  const { gameId, onSelectActor } = $props<{
    gameId: string;
    onSelectActor: (actor: Actor) => void;
  }>();
  
  // State with strict TypeScript types
  let isLoading: boolean = $state(true);
  let existingActors: Actor[] = $state([]);
  let availableCards: Card[] = $state([]);
  let selectedActorId: string = $state('');
  let selectedCardId: string = $state('');
  let actorType: 'National Identity' | 'Sovereign Identity' = $state('National Identity');
  let customName: string = $state('');
  let creatingActor: boolean = $state(false);
  let mode: 'select' | 'create' = $state('select');
  let errorMessage: string = $state('');
  
  // Add conditional development logging
  const isDev = import.meta.env.DEV;
  const log = (...args: any[]) => isDev && console.log('[ActorSelector]', ...args);
  const logError = (...args: any[]) => console.error('[ActorSelector]', ...args);
  
  // Subscription cleanup
  let unsubscribe: (() => void) | null = null;
  
  onMount(async () => {
    try {
      isLoading = true;
      
      // Load actors and cards concurrently for better performance
      log(`Loading data for game ${gameId}`);
      const [allUserActors, cards] = await Promise.all([
        getUserActors(),
        getAvailableCardsForGame(gameId)
      ]);
      
      // Display ALL user actors, not just ones from this game
      log(`Processing ${allUserActors.length} user actors for selection`);
      
      // We want to show all user actors, not just those from this game
      existingActors = allUserActors;
      existingActors.forEach(actor => {
        log(`Actor ${actor.actor_id}: game_id=${actor.game_id}, card_id=${actor.card_id}, name=${actor.custom_name || 'unnamed'}`);
      });
      
      availableCards = cards;
      
      log(`Found ${existingActors.length} actors and ${availableCards.length} cards for game ${gameId}`);
      
      // Retry if no actors found but expected some (retry with explicit getCurrentUser)
      if (existingActors.length === 0 && allUserActors.length > 0) {
        log('No actors found for this game, retrying with explicit user ID');
        const currentUser = getCurrentUser();
        if (currentUser) {
          const userActorsRetry = await getUserActors(currentUser.user_id);
          log(`Retry returned ${userActorsRetry.length} total actors`);
          
          existingActors = userActorsRetry.filter(actor => {
            const matches = actor.game_id === gameId;
            log(`Retry: Actor ${actor.actor_id} game_id=${actor.game_id}, matches=${matches}`);
            return matches;
          });
          
          log(`After retry: found ${existingActors.length} actors for game ${gameId}`);
        }
      }
      
      // Determine initial mode based on data
      if (existingActors.length === 0) {
        mode = 'create';
        if (availableCards.length > 0) {
          selectedCardId = availableCards[0].card_id;
        }
      } else {
        mode = 'select';
        selectedActorId = existingActors[0].actor_id;
        if (availableCards.length > 0) {
          selectedCardId = availableCards[0].card_id;
        }
      }
    } catch (err) {
      logError('Error loading actors and cards:', err);
      errorMessage = 'Failed to load actor data. Please try again.';
    } finally {
      isLoading = false;
    }
  });
  
  onDestroy(() => {
    // Clean up any subscriptions
    if (unsubscribe) unsubscribe();
  });
  
  async function handleSelectActor() {
    try {
      // Check if we have valid actors and a selection
      if (existingActors.length === 0) {
        errorMessage = 'No actors available to select';
        return;
      }
      
      if (!selectedActorId) {
        errorMessage = 'Please select an actor';
        return;
      }
      
      // Set UI feedback
      creatingActor = true;
      errorMessage = '';
      
      const actor = existingActors.find(a => a.actor_id === selectedActorId);
      
      if (actor) {
        log(`Selected actor: ${actor.actor_id} from game ${actor.game_id}`);
        
        // Make sure the actor has a user_id (if not, use current user)
        if (!actor.user_id) {
          const currentUser = getCurrentUser();
          if (currentUser) {
            actor.user_id = currentUser.user_id;
            log(`Adding missing user_id ${currentUser.user_id} to actor`);
          } else {
            logError('Cannot select actor: Missing user_id and no current user');
            errorMessage = 'Actor data is incomplete. Please try creating a new actor instead.';
            creatingActor = false;
            return;
          }
        }
        
        // If actor was from a different game, we need to set up relationships with the new game
        if (actor.game_id !== gameId) {
          log(`Actor ${actor.actor_id} is from game ${actor.game_id}, adding to new game ${gameId}`);
          
          try {
            // Join the game first to ensure the user is registered as a player
            const joinSuccess = await joinGame(gameId);
            if (!joinSuccess) {
              logError(`Failed to join game ${gameId}`);
              errorMessage = 'Failed to join the game. Please try again.';
              creatingActor = false;
              return;
            }
            
            // Create relationship between actor and new game (Gun.js edge)
            await createRelationship(`${nodes.actors}/${actor.actor_id}`, 'game', `${nodes.games}/${gameId}`);
            log(`Created relationship: Actor ${actor.actor_id} -> Game ${gameId}`);
            
            // Assign the actor to the user in the game's role assignment
            await assignRole(gameId, actor.user_id, actor.actor_id);
            log(`Assigned role: User ${actor.user_id} -> Actor ${actor.actor_id} in Game ${gameId}`);
            
            // Update the actor's game_id to the current game for proper display
            actor.game_id = gameId;
          } catch (relErr) {
            logError('Error creating game relationship:', relErr);
            errorMessage = 'Failed to associate actor with this game. Please try again.';
            creatingActor = false;
            return;
          }
        }
        
        // Set up real-time subscription to actor's card
        if (unsubscribe) unsubscribe();
        
        try {
          unsubscribe = subscribeToUserCard(gameId, actor.user_id, (card) => {
            log('Card data updated via subscription');
            // Card updates would be handled here
          });
        } catch (subErr) {
          // Non-fatal error, just log it
          logError('Error setting up card subscription:', subErr);
        }
        
        // Call the parent handler with selected actor
        onSelectActor(actor);
      } else {
        log(`Actor with ID ${selectedActorId} not found in existingActors array`);
        errorMessage = 'Selected actor not found';
      }
    } catch (err) {
      logError('Error selecting actor:', err);
      errorMessage = 'Failed to select actor';
    } finally {
      creatingActor = false;
    }
  }
  
  async function handleCreateActor() {
    try {
      creatingActor = true;
      errorMessage = '';
      
      // Validate required fields
      if (!selectedCardId) {
        errorMessage = 'Please select a card';
        return;
      }
      
      if (!actorType) {
        errorMessage = 'Please select an actor type';
        return;
      }
      
      // Implement retry logic for actor creation (similar to game creation)
      log(`Creating actor with card ${selectedCardId} for game ${gameId}`);
      
      let newActor = null;
      let attempts = 0;
      const maxAttempts = 3;
      const backoffMs = [500, 1000, 2000]; // Exponential backoff
      
      while (!newActor && attempts < maxAttempts) {
        attempts++;
        
        try {
          log(`Actor creation attempt ${attempts}/${maxAttempts}`);
          const startTime = performance.now();
          
          newActor = await createActor(
            gameId,
            selectedCardId,
            actorType,
            customName || undefined
          );
          
          const duration = performance.now() - startTime;
          log(`Actor creation attempt ${attempts} took ${duration.toFixed(4)}ms`);
          
          if (newActor) {
            log(`Actor created successfully: ${newActor.actor_id}`);
            break;
          } else {
            log(`Actor creation attempt ${attempts} failed`);
            
            if (attempts < maxAttempts) {
              // Wait with exponential backoff before retrying
              await new Promise(resolve => setTimeout(resolve, backoffMs[attempts - 1]));
            }
          }
        } catch (attemptErr) {
          logError(`Actor creation attempt ${attempts} error:`, attemptErr);
          
          if (attempts < maxAttempts) {
            // Wait with exponential backoff before retrying
            await new Promise(resolve => setTimeout(resolve, backoffMs[attempts - 1]));
          }
        }
      }
      
      if (newActor) {
        // Set up subscription for real-time updates (non-blocking, with error handling)
        if (unsubscribe) unsubscribe();
        
        try {
          unsubscribe = subscribeToUserCard(gameId, newActor.user_id, (card) => {
            log('Card data updated via subscription');
            // Card updates would be handled here
          });
        } catch (subErr) {
          // Non-fatal error, just log it and continue
          logError('Error setting up card subscription:', subErr);
        }
        
        // Complete the actor selection
        onSelectActor(newActor);
      } else {
        errorMessage = 'Failed to create actor after multiple attempts';
      }
    } catch (err) {
      logError('Error in handleCreateActor:', err);
      errorMessage = 'Failed to create actor';
    } finally {
      creatingActor = false;
    }
  }
  
  function setMode(newMode: 'select' | 'create') {
    mode = newMode;
    errorMessage = '';
  }
  
  // Format card info with null checks for display
  function formatCardTitle(card: Card): string {
    return `${card.role_title || 'Card'} ${card.card_category ? `(${card.card_category})` : ''}`;
  }
  
  // Helper function to show proper game origin for actors
  function formatActorOrigin(actor: Actor): string {
    if (actor.game_id === gameId) {
      return '';
    }
    
    // Try to get a short display ID
    const shortId = actor.game_id.substring(0, 4);
    return ` [from other game: ${shortId}...]`;
  }
  
  // Helper function to check if selected actor is from another game
  function isSelectedActorFromOtherGame(): boolean {
    if (!selectedActorId) return false;
    const actor = existingActors.find(a => a.actor_id === selectedActorId);
    return actor ? actor.game_id !== gameId : false;
  }
</script>

<div class="p-4 bg-surface-100-800-token rounded-lg">
  {#if isLoading}
    <div class="flex justify-center items-center p-8">
      <div class="spinner-third w-12 h-12"></div>
      <p class="ml-4">Loading actors and cards...</p>
    </div>
  {:else}
    <!-- Tab navigation -->
    <div class="flex border-b border-surface-300-600-token mb-4">
      <button
        class="px-4 py-2 {mode === 'select' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600'}"
        onclick={() => setMode('select')}
        disabled={existingActors.length === 0}
      >
        <span class="flex items-center">
          <icons.Users size={16} class="mr-2" />
          Use Existing Actor
        </span>
      </button>
      <button
        class="px-4 py-2 {mode === 'create' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600'}"
        onclick={() => setMode('create')}
        disabled={availableCards.length === 0}
      >
        <span class="flex items-center">
          <icons.UserPlus size={16} class="mr-2" />
          Create New Actor
        </span>
      </button>
    </div>
    
    {#if errorMessage}
      <div class="alert variant-filled-error mb-4">
        <icons.AlertCircle size={16} />
        <span>{errorMessage}</span>
      </div>
    {/if}
    
    <!-- Select existing actor -->
    {#if mode === 'select'}
      {#if existingActors.length === 0}
        <div class="card p-4 text-center">
          <p>You don't have any existing actors to use in this game.</p>
          <button 
            class="btn variant-ghost-primary mt-2" 
            onclick={() => setMode('create')}
            disabled={availableCards.length === 0}
          >
            Create a new actor instead
          </button>
          {#if availableCards.length === 0}
            <p class="text-error-500 mt-2">No cards available. All cards have been assigned.</p>
          {/if}
        </div>
      {:else}
        <div class="space-y-4">
          <label class="label">
            <span>Select an existing actor</span>
            <select class="select" bind:value={selectedActorId}>
              {#each existingActors as actor}
                <option value={actor.actor_id}>
                  {actor.custom_name || 'Actor'} ({actor.actor_type || 'Unknown Type'})
                  {formatActorOrigin(actor)}
                </option>
              {/each}
            </select>
          </label>
          
          <!-- Show spinner when working -->
          <button
            class="btn variant-filled-primary w-full"
            onclick={handleSelectActor}
            disabled={!selectedActorId || creatingActor}
          >
            {#if creatingActor}
              <span class="spinner-third w-4 h-4 mr-2"></span>
              {#if isSelectedActorFromOtherGame()}
                Associating Actor with this Game...
              {:else}
                Selecting Actor...
              {/if}
            {:else}
              {#if isSelectedActorFromOtherGame()}
                Use Actor from Other Game
              {:else}
                Continue with Selected Actor
              {/if}
            {/if}
          </button>
        </div>
      {/if}
    {/if}
    
    <!-- Create new actor -->
    {#if mode === 'create'}
      {#if availableCards.length === 0}
        <div class="card p-4 text-center">
          <p>No cards available for this game. All cards have been assigned to players.</p>
          {#if existingActors.length > 0}
            <button class="btn variant-ghost-primary mt-2" onclick={() => setMode('select')}>
              Use an existing actor instead
            </button>
          {/if}
        </div>
      {:else}
        <div class="space-y-4">
          <label class="label">
            <span>Actor Type</span>
            <select class="select" bind:value={actorType}>
              <option value="National Identity">National Identity</option>
              <option value="Sovereign Identity">Sovereign Identity</option>
            </select>
          </label>
          
          <label class="label">
            <span>Custom Name (optional)</span>
            <input 
              class="input" 
              type="text" 
              bind:value={customName} 
              placeholder="Enter a name for your actor" 
            />
          </label>
          
          <label class="label">
            <span>Select a Card</span>
            <select class="select" bind:value={selectedCardId}>
              {#each availableCards as card}
                <option value={card.card_id}>
                  {formatCardTitle(card)}
                </option>
              {/each}
            </select>
          </label>
          
          <!-- Card preview with null checks -->
          {#if selectedCardId && availableCards.length > 0}
            {#each availableCards.filter(card => card.card_id === selectedCardId) as selectedCard}
              <div class="card p-4 bg-primary-900/20">
                <h3 class="h3 text-primary-500">{selectedCard.role_title || 'Unnamed Role'}</h3>
                <div class="badge variant-soft-secondary">{selectedCard.card_category || 'Uncategorized'}</div>
                
                <div class="mt-2">
                  <h4 class="font-bold text-sm text-tertiary-500">Backstory:</h4>
                  <p class="text-sm">{selectedCard.backstory ?? 'No backstory available'}</p>
                </div>
                
                <div class="mt-2">
                  <h4 class="font-bold text-sm text-tertiary-500">Goals:</h4>
                  <p class="text-sm">{selectedCard.goals ?? 'No goals defined'}</p>
                </div>
              </div>
            {/each}
          {/if}
          
          <button
            class="btn variant-filled-primary w-full"
            onclick={handleCreateActor}
            disabled={!selectedCardId || creatingActor}
          >
            {#if creatingActor}
              <span class="spinner-third w-4 h-4 mr-2"></span>
              Creating Actor...
            {:else}
              Create New Actor
            {/if}
          </button>
        </div>
      {/if}
    {/if}
  {/if}
</div>