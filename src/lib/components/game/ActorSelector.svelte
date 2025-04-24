<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    getUserActors, 
    getAvailableCardsForGame, 
    createActor, 
    subscribeToUserCard,
    joinGame,
    assignRole,
    updatePlayerActorMap,
    updateGameStatus
  } from '$lib/services/gameService';
  import { GameStatus } from '$lib/types';
  import { nodes, createRelationship, getGun } from '$lib/services/gunService';
  import { getCurrentUser } from '$lib/services/authService';
  import type { Actor, Card } from '$lib/types';
  import * as icons from '@lucide/svelte';
  
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
  
  // Cleaned up for Svelte 5.28.1 - avoids state mutations in template expressions
  async function handleSelectActor() {
    try {
      // Input validation
      if (existingActors.length === 0) {
        errorMessage = 'No actors available to select';
        return;
      }
      
      if (!selectedActorId) {
        errorMessage = 'Please select an actor';
        return;
      }
      
      // Update UI state
      creatingActor = true;
      errorMessage = '';
      
      // Find the selected actor in our list
      const actor = existingActors.find(a => a.actor_id === selectedActorId);
      if (!actor) {
        log(`Actor with ID ${selectedActorId} not found`);
        errorMessage = 'Selected actor not found';
        creatingActor = false;
        return;
      }
      
      log(`Selected actor: ${actor.actor_id} from game ${actor.game_id}`);
      
      // Handle missing user_id by creating a new actor object (no direct mutation)
      const currentUser = getCurrentUser();
      const actorWithUser = !actor.user_id && currentUser?.user_id
        ? { ...actor, user_id: currentUser.user_id }
        : actor;
        
      if (!actorWithUser.user_id) {
        logError('Cannot select actor: Missing user_id and no current user');
        errorMessage = 'Actor data is incomplete. Please try creating a new actor.';
        creatingActor = false;
        return;
      }
      
      // If actor is from a different game, handle the transfer
      const isCrossGameTransfer = actorWithUser.game_id !== gameId;
      const finalActor = isCrossGameTransfer
        ? { ...actorWithUser, game_id: gameId }
        : actorWithUser;
      
      // Always store in localStorage - critical for game page detection
      localStorage.setItem(`game_${gameId}_actor`, finalActor.actor_id);
      
      // Handle actors from other games
      if (isCrossGameTransfer) {
        log(`Transferring actor from game ${actorWithUser.game_id} to ${gameId}`);
        
        // Background operations for cross-game transfer
        setTimeout(() => {
          try {
            // Create relationships
            createRelationship(
              `${nodes.actors}/${finalActor.actor_id}`, 
              'game', 
              `${nodes.games}/${gameId}`
            );
            
            if (finalActor.card_id) {
              createRelationship(
                `${nodes.actors}/${finalActor.actor_id}`, 
                'card', 
                `${nodes.cards}/${finalActor.card_id}`
              );
            }
            
            // Chain join operations
            joinGame(gameId)
              .then(joinSuccess => {
                log(`Background joinGame complete: ${joinSuccess}`);
                return joinSuccess && finalActor.user_id
                  ? assignRole(gameId, finalActor.user_id, finalActor.actor_id)
                  : false;
              })
              .then(assignSuccess => {
                log(`Background assignRole complete: ${assignSuccess}`);
                if (assignSuccess && finalActor.user_id) {
                  updatePlayerActorMap(gameId, finalActor.user_id, finalActor.actor_id);
                }
              })
              .catch(err => logError('Background operations error:', err));
          } catch (err) {
            logError('Error in background setup:', err);
          }
        }, 100);
      }
      
      // Set up card subscription
      setTimeout(() => {
        try {
          if (unsubscribe) unsubscribe();
          unsubscribe = subscribeToUserCard(gameId, finalActor.user_id, card => {
            log('Card data updated via subscription');
          });
        } catch (subErr) {
          logError('Subscription error:', subErr);
        }
      }, 200);
      
      // Finish up
      creatingActor = false;
      onSelectActor(finalActor);
    } catch (err) {
      logError('Error selecting actor:', err);
      errorMessage = 'Failed to select actor';
      creatingActor = false;
    }
  }
  
  // Modified with fire-and-forget pattern to avoid navigation issues
  // Streamlined actor creation function for Svelte 5.28.1
  async function handleCreateActor() {
    try {
      creatingActor = true;
      errorMessage = '';
      
      // Get the current user - required for creating actor
      const user = getCurrentUser();
      if (!user?.user_id) {
        errorMessage = 'You must be logged in to create an actor';
        creatingActor = false;
        return;
      }
      
      // Validate required fields
      if (!selectedCardId) {
        errorMessage = 'Please select a card';
        creatingActor = false;
        return;
      }
      
      if (!actorType) {
        errorMessage = 'Please select an actor type';
        creatingActor = false;
        return;
      }
      
      log(`Creating actor with card ${selectedCardId} for game ${gameId}`);
      
      try {
        // Create actor with proper parameters
        const newActor = await createActor(
          gameId,
          selectedCardId,
          actorType,
          customName || undefined
        );
        
        if (!newActor) {
          throw new Error('Actor creation failed - no actor ID returned');
        }
        
        log(`Actor created successfully: ${newActor.actor_id}`);
        
        // Ensure actor has user_id set - create a new object if needed (avoid direct mutation)
        const actorWithUser = newActor.user_id 
          ? newActor 
          : { ...newActor, user_id: user.user_id };
        
        // CRITICAL: Store actor ID in localStorage for persistence between page loads
        // This is the PRIMARY way the game page detects if a player has joined
        localStorage.setItem(`game_${gameId}_actor`, actorWithUser.actor_id);
        
        // Fire-and-forget: Update game status to active immediately
        try {
          // Use proper gameService function instead of direct put
          updateGameStatus(gameId, GameStatus.ACTIVE)
            .then(success => {
              log(`Updated game status to active: ${success}`);
            })
            .catch(err => {
              logError('Error updating game status:', err);
            });
        } catch (statusErr) {
          logError('Error updating game status:', statusErr);
        }
        
        // Background relationship creation - non-blocking
        setTimeout(() => {
          // Chain all the operations with proper error handling
          joinGame(gameId)
            .then(joinSuccess => {
              log(`Background joinGame complete: ${joinSuccess}`);
              return joinSuccess && actorWithUser.user_id
                ? assignRole(gameId, actorWithUser.user_id, actorWithUser.actor_id)
                : false;
            })
            .then(assignSuccess => {
              log(`Background assignRole complete: ${assignSuccess}`);
              if (assignSuccess && actorWithUser.user_id) {
                updatePlayerActorMap(gameId, actorWithUser.user_id, actorWithUser.actor_id);
              }
            })
            .catch(bgErr => logError('Background operations error:', bgErr));
        }, 100);
        
        // Call the parent handler immediately to proceed with navigation
        onSelectActor(actorWithUser);
        
        // Reset creating state
        creatingActor = false;
      } catch (actorErr) {
        logError('Error in actor creation:', actorErr);
        errorMessage = 'Failed to create actor';
        creatingActor = false;
      }
    } catch (err) {
      logError('Error in handleCreateActor:', err);
      errorMessage = 'Failed to create actor';
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
              Processing...
            {:else}
              Create New Actor
            {/if}
          </button>
        </div>
      {/if}
    {/if}
  {/if}
</div>