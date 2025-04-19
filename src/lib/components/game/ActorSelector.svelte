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
  import { nodes, createRelationship, getGun } from '$lib/services/gunService';
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
  
  // Modified for Svelte 5.25.9 Runes mode to avoid state_unsafe_mutation errors
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
      
      if (!actor) {
        log(`Actor with ID ${selectedActorId} not found in existingActors array`);
        errorMessage = 'Selected actor not found';
        creatingActor = false;
        return;
      }
      
      log(`Selected actor: ${actor.actor_id} from game ${actor.game_id}`);
      
      // Make sure the actor has a user_id (if not, use current user)
      const currentUser = getCurrentUser();
      let actorToUse = actor; // Create a new variable we can reassign
      
      if (!actor.user_id && currentUser) {
        // Create a new actor object with the user_id added (avoid direct mutation)
        actorToUse = { 
          ...actor,
          user_id: currentUser.user_id 
        };
        log(`Adding missing user_id ${currentUser.user_id} to actor`);
      } else if (!actor.user_id) {
        logError('Cannot select actor: Missing user_id and no current user');
        errorMessage = 'Actor data is incomplete. Please try creating a new actor instead.';
        creatingActor = false;
        return;
      }
      
      // If actor was from a different game, we need to set up relationships with the new game
      if (actorToUse.game_id !== gameId) {
        log(`Actor ${actorToUse.actor_id} is from game ${actorToUse.game_id}, adding to new game ${gameId}`);
        
        // Store original game_id for reference before we modify it
        const originalGameId = actorToUse.game_id;
        
        // Create a new actor object with updated game_id (avoid direct mutation)
        actorToUse = {
          ...actorToUse,
          game_id: gameId
        };
        
        // CRITICAL: First update local state for immediate feedback
        // This localStorage value is the PRIMARY way the game page detects if a player has joined
        // Even if database operations fail, this ensures the player can access the game
        localStorage.setItem(`game_${gameId}_actor`, actorToUse.actor_id);
        
        // Fire-and-forget background operations
        setTimeout(() => {
          try {
            // 1. Create Actor->Game relationship
            createRelationship(`${nodes.actors}/${actorToUse.actor_id}`, 'game', `${nodes.games}/${gameId}`);
            log(`Created relationship: Actor ${actorToUse.actor_id} -> Game ${gameId}`);
            
            // 2. If the actor has a card_id, create the Actor->Card relationship
            if (actorToUse.card_id) {
              createRelationship(`${nodes.actors}/${actorToUse.actor_id}`, 'card', `${nodes.cards}/${actorToUse.card_id}`);
              log(`Created relationship: Actor ${actorToUse.actor_id} -> Card ${actorToUse.card_id}`);
            }
            
            // 3. Call Gun.js gameService functions in chain
            joinGame(gameId).then(joinSuccess => {
              log(`Background joinGame complete: ${joinSuccess}`);
              
              // Assign role in the new game
              if (joinSuccess && actorToUse.user_id) {
                return assignRole(gameId, actorToUse.user_id, actorToUse.actor_id);
              }
              return false;
            }).then(assignSuccess => {
              log(`Background assignRole complete: ${assignSuccess}`);
              
              // 4. Update player_actor_map
              if (assignSuccess && actorToUse.user_id) {
                updatePlayerActorMap(gameId, actorToUse.user_id, actorToUse.actor_id);
                log(`Updated player_actor_map for ${actorToUse.user_id}`);
              }
            }).catch(err => {
              logError('Error in background operations:', err);
            });
          } catch (err) {
            logError('Error in background relationship setup:', err);
          }
        }, 100);
      }
      
      // Set up subscription in the background
      setTimeout(() => {
        try {
          if (unsubscribe) unsubscribe();
          
          unsubscribe = subscribeToUserCard(gameId, actorToUse.user_id, (card) => {
            log('Card data updated via subscription');
          });
        } catch (subErr) {
          logError('Error setting up card subscription:', subErr);
        }
      }, 200);
      
      // Reset creating flag and immediately call parent handler
      creatingActor = false;
      
      // CRITICAL DUPLICATE STORAGE: Set actor to localStorage for persistence
      // This is intentionally duplicated from above to ensure it happens even if the first one fails
      // This localStorage value is the PRIMARY way the game page detects if a player has joined
      localStorage.setItem(`game_${gameId}_actor`, actorToUse.actor_id);
      
      // Call the parent handler with selected actor
      onSelectActor(actorToUse);
    } catch (err) {
      logError('Error selecting actor:', err);
      errorMessage = 'Failed to select actor';
      creatingActor = false;
    }
  }
  
  // Modified with fire-and-forget pattern to avoid navigation issues
  async function handleCreateActor() {
    try {
      creatingActor = true;
      errorMessage = '';
      
      // Get the current user - we need this for creating actor
      const user = getCurrentUser();
      if (!user || !user.user_id) {
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
        // Fixed parameter order based on gameService.ts definition
        // createActor(gameId, cardId, actorType, customName)
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
        
        // Make sure actor has user_id set
        if (!newActor.user_id) {
          newActor.user_id = user.user_id;
        }
        
        // CRITICAL: Store actor ID in localStorage for persistence between page loads
        // This is the PRIMARY way the game page detects if a player has joined
        localStorage.setItem(`game_${gameId}_actor`, newActor.actor_id);
        
        // Fire-and-forget: Update game status to active immediately
        try {
          const gun = getGun();
          if (gun) {
            gun.get(nodes.games).get(gameId).get('status').put('active');
            log(`Directly updated game status to active`);
          }
        } catch (statusErr) {
          logError('Error updating game status:', statusErr);
        }
        
        // Background relationship creation - non-blocking
        setTimeout(() => {
          try {
            joinGame(gameId).then(joinSuccess => {
              log(`Background joinGame complete: ${joinSuccess}`);
              
              if (joinSuccess && newActor.user_id) {
                return assignRole(gameId, newActor.user_id, newActor.actor_id);
              }
              return false;
            }).then(assignSuccess => {
              log(`Background assignRole complete: ${assignSuccess}`);
              
              if (assignSuccess && newActor.user_id) {
                updatePlayerActorMap(gameId, newActor.user_id, newActor.actor_id);
              }
            }).catch(bgErr => {
              logError('Background operations error:', bgErr);
            });
          } catch (bgErr) {
            logError('Error initiating background operations:', bgErr);
          }
        }, 100);
        
        // Call the parent handler immediately to proceed with navigation
        // This avoids the page refresh issue
        onSelectActor(newActor);
        
        // Reset creating state since we're done with critical operations
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