<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    getUserActors, 
    getAvailableCardsForGame, 
    createActor, 
    subscribeToUserCard 
  } from '$lib/services/gameService';
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
      const [userActors, cards] = await Promise.all([
        getUserActors(),
        getAvailableCardsForGame(gameId)
      ]);
      
      // Filter actors for this game
      existingActors = userActors.filter(actor => actor.game_id === gameId);
      availableCards = cards;
      
      log(`Found ${existingActors.length} actors and ${availableCards.length} cards for game ${gameId}`);
      
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
      const actor = existingActors.find(a => a.actor_id === selectedActorId);
      if (actor) {
        log(`Selected actor: ${actor.actor_id}`);
        
        // Set up real-time subscription to actor's card
        if (unsubscribe) unsubscribe();
        unsubscribe = subscribeToUserCard(gameId, actor.user_id, (card) => {
          log('Card data updated via subscription');
          // Card updates would be handled here
        });
        
        onSelectActor(actor);
      } else {
        errorMessage = 'Selected actor not found';
      }
    } catch (err) {
      logError('Error selecting actor:', err);
      errorMessage = 'Failed to select actor';
    }
  }
  
  async function handleCreateActor() {
    try {
      creatingActor = true;
      errorMessage = '';
      
      if (!selectedCardId) {
        errorMessage = 'Please select a card';
        return;
      }
      
      log(`Creating actor with card ${selectedCardId} for game ${gameId}`);
      const newActor = await createActor(
        gameId,
        selectedCardId,
        actorType,
        customName || undefined
      );
      
      if (newActor) {
        log(`Actor created successfully: ${newActor.actor_id}`);
        
        // Set up subscription for real-time updates
        if (unsubscribe) unsubscribe();
        unsubscribe = subscribeToUserCard(gameId, newActor.user_id, (card) => {
          log('Card data updated via subscription');
          // Card updates would be handled here
        });
        
        onSelectActor(newActor);
      } else {
        errorMessage = 'Failed to create actor';
      }
    } catch (err) {
      logError('Error creating actor:', err);
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
                </option>
              {/each}
            </select>
          </label>
          
          <button
            class="btn variant-filled-primary w-full"
            onclick={handleSelectActor}
            disabled={!selectedActorId}
          >
            Continue with Selected Actor
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