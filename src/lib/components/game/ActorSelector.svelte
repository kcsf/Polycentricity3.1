<script lang="ts">
    import { onMount } from 'svelte';
    import { getUserActors, getAvailableCardsForGame, createActor, getCard, getGameActors } from '$lib/services/gameService';
    import type { Actor, Card } from '$lib/types';
    import * as icons from 'lucide-svelte';
    
    export let gameId: string;
    export let onSelectActor: (actor: Actor) => void;
    
    let isLoading = true;
    let existingActors: Actor[] = [];
    let availableCards: Card[] = [];
    let selectedActorId: string = '';
    let selectedCardId: string = '';
    let actorType: 'National Identity' | 'Sovereign Identity' = 'National Identity';
    let customName: string = '';
    let creatingActor = false;
    let selectedExistingActor: boolean = false;
    let errorMessage: string = '';
    
    // Component modes
    let mode: 'select' | 'create' = 'select';
    
    onMount(async () => {
        try {
            isLoading = true;
            
            // Only load actors created by the current user
            const userActors = await getUserActors();
            console.log('Getting only user actors created by the current user:', userActors);
            
            // Filter to only include actors created by this user AND for this game
            existingActors = userActors.filter(actor => actor.game_id === gameId);
            
            console.log(`Found ${existingActors.length} actors for user in game ${gameId}`);
            
            // If no existing actors for this game, check if there are any actors without game assignment
            if (existingActors.length === 0) {
                console.log('No actors found for this game, checking for unassigned actors');
                // No actors exist for this game, load available cards
                availableCards = await getAvailableCardsForGame(gameId);
                console.log(`Found ${availableCards.length} available cards for game ${gameId}`);
                
                // Preselect first available card if any
                if (availableCards.length > 0) {
                    selectedCardId = availableCards[0].card_id;
                }
                
                // Default to create mode since no existing actors for this game
                selectedExistingActor = false;
                mode = 'create';
            } else {
                // User has existing actors for this game
                selectedActorId = existingActors[0].actor_id;
                selectedExistingActor = true;
                
                // Still load available cards in case user wants to create a new actor
                availableCards = await getAvailableCardsForGame(gameId);
                
                if (availableCards.length > 0) {
                    selectedCardId = availableCards[0].card_id;
                }
            }
        } catch (err) {
            console.error('Error loading actors and cards:', err);
            errorMessage = 'Failed to load actor data';
        } finally {
            isLoading = false;
        }
    });
    
    async function handleSelectActor() {
        try {
            if (selectedExistingActor) {
                // Find the selected actor from existing actors
                const actor = existingActors.find(a => a.actor_id === selectedActorId);
                if (actor) {
                    onSelectActor(actor);
                } else {
                    errorMessage = 'Selected actor not found';
                }
            } else {
                errorMessage = 'Please select an existing actor';
            }
        } catch (err) {
            console.error('Error selecting actor:', err);
            errorMessage = 'Failed to select actor';
        }
    }
    
    async function handleCreateActor() {
        try {
            creatingActor = true;
            errorMessage = '';
            
            if (!selectedCardId) {
                errorMessage = 'Please select a card';
                creatingActor = false;
                return;
            }
            
            // Create a new actor with the selected card
            const newActor = await createActor(
                gameId,
                selectedCardId,
                actorType,
                customName || undefined
            );
            
            if (newActor) {
                onSelectActor(newActor);
            } else {
                errorMessage = 'Failed to create actor';
            }
        } catch (err) {
            console.error('Error creating actor:', err);
            errorMessage = 'Failed to create actor';
        } finally {
            creatingActor = false;
        }
    }
    
    function setMode(newMode: 'select' | 'create') {
        mode = newMode;
        selectedExistingActor = mode === 'select';
        errorMessage = '';
    }
    
    // Format card info for display
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
                on:click={() => setMode('select')}
                disabled={existingActors.length === 0}
            >
                <span class="flex items-center">
                    <icons.Users size={16} class="mr-2" />
                    Use Existing Actor
                </span>
            </button>
            <button 
                class="px-4 py-2 {mode === 'create' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600'}" 
                on:click={() => setMode('create')}
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
                    <p>You don't have any existing actors to use.</p>
                    <button class="btn variant-ghost-primary mt-2" on:click={() => setMode('create')}>
                        Create a new actor instead
                    </button>
                </div>
            {:else}
                <div class="form-group space-y-4">
                    <label class="label">
                        <span>Select an existing actor</span>
                        <select 
                            class="select" 
                            bind:value={selectedActorId}
                        >
                            {#each existingActors as actor}
                                <option value={actor.actor_id}>
                                    {actor.custom_name || 'Actor'} ({actor.actor_type || 'Unknown Type'})
                                    {actor.game_id === gameId ? ' ✓ (Already in this game)' : ''}
                                </option>
                            {/each}
                        </select>
                    </label>
                    
                    <button 
                        class="btn variant-filled-primary w-full" 
                        on:click={handleSelectActor}
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
                        <button class="btn variant-ghost-primary mt-2" on:click={() => setMode('select')}>
                            Use an existing actor instead
                        </button>
                    {/if}
                </div>
            {:else}
                <div class="form-group space-y-4">
                    <label class="label">
                        <span>Actor Type</span>
                        <select class="select" bind:value={actorType}>
                            <option value="National Identity">National Identity</option>
                            <option value="Sovereign Identity">Sovereign Identity</option>
                        </select>
                    </label>
                    
                    <label class="label">
                        <span>Custom Name (optional)</span>
                        <input class="input" type="text" bind:value={customName} placeholder="Enter a name for your actor" />
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
                    
                    <!-- Card preview -->
                    {#if selectedCardId}
                        {#if availableCards.length > 0}
                            {#each availableCards.filter(card => card.card_id === selectedCardId) as selectedCard}
                                <div class="card p-4 bg-primary-900/20">
                                    <h3 class="h3 text-primary-500">{selectedCard.role_title}</h3>
                                    <div class="badge variant-soft-secondary">{selectedCard.card_category}</div>
                                    
                                    <div class="mt-2">
                                        <h4 class="font-bold text-sm text-tertiary-500">Backstory:</h4>
                                        <p class="text-sm">{selectedCard.backstory}</p>
                                    </div>
                                    
                                    <div class="mt-2">
                                        <h4 class="font-bold text-sm text-tertiary-500">Goals:</h4>
                                        <p class="text-sm">{selectedCard.goals}</p>
                                    </div>
                                </div>
                            {/each}
                        {/if}
                    {/if}
                    
                    <button 
                        class="btn variant-filled-primary w-full" 
                        on:click={handleCreateActor}
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