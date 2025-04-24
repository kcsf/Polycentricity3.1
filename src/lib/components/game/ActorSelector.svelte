<script lang="ts">
    import { onMount } from 'svelte';
    import { userStore } from '$lib/stores/userStore';
    import { currentGameStore } from '$lib/stores/gameStore';
    import { goto } from '$app/navigation';
    import * as icons from '@lucide/svelte';
    import { 
        getGame, 
        getAvailableCardsForGame, 
        createActor, 
        joinGame, 
        assignRole, 
        updatePlayerActorMap, 
        updateGameStatus,
        getUserActors,
        getGameActors,
        getCard
    } from '$lib/services/gameService';
    import type { Actor, Card, CardWithPosition, Game } from '$lib/types';
    import { GameStatus } from '$lib/types';

    // Props
    export let gameId: string;
    export let game: Game | null = null;

    // State variables (using Svelte 5 Runes syntax)
    let isLoading = $state(true);
    let isJoining = $state(false);
    let errorMessage = $state('');
    
    // User's existing actors
    let userActors = $state<Actor[]>([]);
    let userActorsWithCards = $state<{actor: Actor, card: Card | null}[]>([]);
    let filteredActors = $state<{actor: Actor, card: Card | null}[]>([]);
    let selectedExistingActorId = $state('');
    
    // New actor creation state
    let availableCards = $state<CardWithPosition[]>([]);
    let selectedCardId = $state('');
    let actorType = $state<'National Identity' | 'Sovereign Identity'>('National Identity');
    let customName = $state('');
    
    // Tab state
    let activeTab = $state<'join-existing' | 'create-new'>('create-new');
    
    // Function to check if user has already joined the game
    async function checkUserJoined(): Promise<boolean> {
        if (!game || !$userStore.user) return false;
        
        const userId = $userStore.user.user_id;
        return !!game.players[userId];
    }
    
    // Function to load user's existing actors
    async function loadUserActors() {
        if (!$userStore.user) return;
        
        try {
            const actors = await getUserActors($userStore.user.user_id);
            
            // Get card details for each actor
            const actorsWithCards = await Promise.all(
                actors.map(async (actor) => {
                    let card = null;
                    if (actor.card_ref) {
                        try {
                            card = await getCard(actor.card_ref, true);
                        } catch (err) {
                            console.error(`Error loading card for actor ${actor.actor_id}:`, err);
                        }
                    }
                    return { actor, card };
                })
            );
            
            userActors = actors;
            userActorsWithCards = actorsWithCards;
            
            // Filter actors that could be assigned to this game
            filterActorsForGame();
            
            // Set default selection if available
            if (filteredActors.length > 0) {
                selectedExistingActorId = filteredActors[0].actor.actor_id;
                activeTab = 'join-existing';
            } else {
                activeTab = 'create-new';
            }
            
            console.log(`Loaded ${userActors.length} user actors, ${filteredActors.length} can join this game`);
        } catch (err) {
            console.error('Error loading user actors:', err);
            errorMessage = 'Failed to load your existing actors';
        }
    }
    
    // Filter actors that can be assigned to this game 
    // (not already in this game and right actor type)
    function filterActorsForGame() {
        filteredActors = userActorsWithCards.filter(({ actor, card }) => 
            // Actor isn't already in this game
            actor.game_ref !== gameId &&
            // Card matches the game's deck type (optional check)
            (game?.deck_type ? 
                card?.card_category.toLowerCase().includes(game.deck_type.toLowerCase()) : 
                true)
        );
    }
    
    // Load available cards that can be used to create new actors
    async function loadAvailableCards() {
        if (!gameId) return;
        
        try {
            // Use the getAvailableCardsForGame function with includeNames=true
            const cards = await getAvailableCardsForGame(gameId, true);
            availableCards = cards;
            
            // Set the first card as selected by default if available
            if (cards.length > 0) {
                selectedCardId = cards[0].card_id;
            }
            
            console.log(`Loaded ${availableCards.length} available cards for actor creation`);
        } catch (err) {
            console.error('Error loading available cards:', err);
            errorMessage = 'Failed to load available cards';
        }
    }
    
    // Function to handle using an existing actor
    async function handleUseExistingActor() {
        if (!$userStore.user || !gameId || !selectedExistingActorId) {
            errorMessage = 'Please select an actor to join with';
            return;
        }
        
        isJoining = true;
        errorMessage = '';
        
        try {
            // Join the game first
            const joinSuccess = await joinGame(gameId);
            if (!joinSuccess) {
                throw new Error('Failed to join game');
            }
            
            // Update the actor's game reference
            const assignSuccess = await assignRole(
                gameId, 
                $userStore.user.user_id, 
                selectedExistingActorId
            );
            
            if (!assignSuccess) {
                throw new Error('Failed to assign actor to game');
            }
            
            // Update player-actor map
            await updatePlayerActorMap(
                gameId, 
                $userStore.user.user_id, 
                selectedExistingActorId
            );
            
            // Update game status to active
            await updateGameStatus(gameId, GameStatus.ACTIVE);
            
            // Store actor ID in localStorage
            localStorage.setItem(`game_${gameId}_actor`, selectedExistingActorId);
            
            // Set the current game in the store for navigation
            if (game) {
                currentGameStore.set(game);
            }
            
            // Navigate to the game board
            goto(`/games/${gameId}`);
        } catch (err) {
            console.error('Error using existing actor:', err);
            errorMessage = 'Failed to join game with existing actor';
        } finally {
            isJoining = false;
        }
    }
    
    // Function to handle creating a new actor
    async function handleCreateNewActor() {
        if (!$userStore.user) {
            errorMessage = 'You must be logged in to create an actor';
            return;
        }
        
        if (!selectedCardId) {
            errorMessage = 'Please select a card';
            return;
        }
        
        isJoining = true;
        errorMessage = '';
        
        try {
            // Create a new actor
            const newActor = await createActor(
                gameId,
                selectedCardId,
                actorType,
                customName || undefined
            );
            
            if (!newActor) {
                throw new Error('Actor creation failed - no actor ID returned');
            }
            
            console.log(`Actor created successfully: ${newActor.actor_id}`);
            
            // Store actor ID in localStorage
            localStorage.setItem(`game_${gameId}_actor`, newActor.actor_id);
            
            // Update game status to active
            await updateGameStatus(gameId, GameStatus.ACTIVE);
            
            // Join the game and assign the actor to the user
            const joinSuccess = await joinGame(gameId);
            if (joinSuccess && $userStore.user?.user_id) {
                await assignRole(gameId, $userStore.user.user_id, newActor.actor_id);
                await updatePlayerActorMap(gameId, $userStore.user.user_id, newActor.actor_id);
            }
            
            // Set the current game in the store for the navigation system
            if (game) {
                currentGameStore.set(game);
            }
            
            // Navigate directly to the game board
            goto(`/games/${gameId}`);
        } catch (err) {
            console.error('Error creating actor:', err);
            errorMessage = 'Failed to create actor';
        } finally {
            isJoining = false;
        }
    }
    
    // Format card title for display
    function formatCardTitle(card: Card): string {
        return `${card.role_title || 'Card'} ${card.card_category ? `(${card.card_category})` : ''}`;
    }
    
    // Initialize everything when the component mounts
    onMount(async () => {
        try {
            isLoading = true;
            
            if (!gameId) {
                errorMessage = 'Game ID not provided';
                return;
            }
            
            // Load game if not provided
            if (!game) {
                game = await getGame(gameId);
                if (!game) {
                    errorMessage = 'Game not found';
                    return;
                }
            }
            
            // Check if user already joined the game
            const hasJoined = await checkUserJoined();
            if (hasJoined) {
                // User already joined, just navigate to the game
                goto(`/games/${gameId}`);
                return;
            }
            
            // Load existing user actors and available cards in parallel
            await Promise.all([
                loadUserActors(),
                loadAvailableCards()
            ]);
            
        } catch (err) {
            console.error('Error initializing ActorSelector:', err);
            errorMessage = 'Failed to initialize game join interface';
        } finally {
            isLoading = false;
        }
    });
</script>

<div class="h-full">
    <h2 class="h4 mb-5 text-primary-500">Select Your Actor</h2>
    
    {#if isLoading}
        <div class="flex flex-col justify-center items-center space-y-4 py-8">
            <div class="spinner-third w-8 h-8 mb-4"></div>
            <p class="text-center">Loading options...</p>
        </div>
    {:else if errorMessage}
        <div class="alert variant-filled-error p-4 mb-4">
            <icons.AlertCircle size={20} />
            <span>{errorMessage}</span>
        </div>
    {:else if !$userStore.user}
        <div class="flex flex-col justify-center items-center space-y-4">
            <p class="text-center mb-2 text-warning-500">
                You must be logged in to join this game.
            </p>
            <a href="/login" class="btn variant-filled-primary w-full">
                <icons.LogIn size={18} class="mr-2" />
                Log In to Join
            </a>
            <button class="btn variant-ghost-surface w-full" onclick={() => goto(`/games/${gameId}`)}>
                <icons.Eye size={18} class="mr-2" />
                View Game as Guest
            </button>
        </div>
    {:else if availableCards.length === 0 && filteredActors.length === 0}
        <div class="flex flex-col justify-center items-center space-y-4">
            <div class="p-4 bg-warning-500/10 rounded-lg text-center">
                <h4 class="font-semibold text-warning-500 mb-2">No Available Options</h4>
                <p class="text-sm mb-4">
                    All cards for this game have been assigned to actors and you don't have any compatible existing actors.
                    Please try another game or view this game without joining.
                </p>
                
                <button class="btn variant-filled-primary w-full" onclick={() => goto(`/games/${gameId}`)}>
                    <icons.Eye size={18} class="mr-2" />
                    View Game Without Joining
                </button>
            </div>
        </div>
    {:else}
        <!-- Tabs for join options -->
        <div class="border-b border-surface-500/30 mb-4">
            <div class="flex">
                {#if filteredActors.length > 0}
                    <button 
                        class="px-4 py-2 font-medium text-sm border-b-2 transition-colors duration-150 
                            {activeTab === 'join-existing' ? 
                                'border-primary-500 text-primary-500' : 
                                'border-transparent hover:border-surface-500/50'}"
                        onclick={() => activeTab = 'join-existing'}
                    >
                        Use Existing Actor
                    </button>
                {/if}
                
                {#if availableCards.length > 0}
                    <button 
                        class="px-4 py-2 font-medium text-sm border-b-2 transition-colors duration-150 
                            {activeTab === 'create-new' ? 
                                'border-primary-500 text-primary-500' : 
                                'border-transparent hover:border-surface-500/50'}"
                        onclick={() => activeTab = 'create-new'}
                    >
                        Create New Actor
                    </button>
                {/if}
            </div>
        </div>
        
        <!-- Tab content -->
        {#if activeTab === 'join-existing' && filteredActors.length > 0}
            <div class="space-y-4">
                <label class="label pb-1 border-b border-surface-500/30">
                    <span class="font-semibold text-tertiary-400">Select Existing Actor</span>
                    <select class="select mt-1 w-full" bind:value={selectedExistingActorId}>
                        {#each filteredActors as { actor, card }}
                            <option value={actor.actor_id}>
                                {actor.custom_name || (card ? card.role_title : 'Unnamed Actor')} ({actor.actor_type})
                            </option>
                        {/each}
                    </select>
                </label>
                
                <!-- Actor preview -->
                {#if selectedExistingActorId}
                    {#each filteredActors.filter(item => item.actor.actor_id === selectedExistingActorId) as { actor, card }}
                        <div class="card p-4 bg-primary-900/20 mt-3">
                            <h3 class="h3 text-primary-400">{actor.custom_name || (card ? card.role_title : 'Unnamed Actor')}</h3>
                            <div class="badge variant-soft-secondary">{actor.actor_type}</div>
                            
                            {#if card}
                                <div class="mt-3">
                                    <h4 class="font-bold text-sm text-tertiary-400">Card:</h4>
                                    <p class="text-sm">{card.role_title || 'Unnamed Card'} ({card.card_category})</p>
                                </div>
                                
                                <div class="mt-3">
                                    <h4 class="font-bold text-sm text-tertiary-400">Backstory:</h4>
                                    <p class="text-sm">{card.backstory || 'No backstory available'}</p>
                                </div>
                            {/if}
                        </div>
                    {/each}
                {/if}
                
                <div class="flex flex-col space-y-2 pt-3">
                    <button
                        class="btn variant-filled-primary w-full"
                        onclick={handleUseExistingActor}
                        disabled={!selectedExistingActorId || isJoining}
                    >
                        {#if isJoining}
                            <span class="spinner-third w-4 h-4 mr-2"></span>
                            Joining Game...
                        {:else}
                            <icons.UserPlus size={18} class="mr-2" />
                            Join Game with Selected Actor
                        {/if}
                    </button>
                    
                    <button class="btn variant-ghost-surface w-full" onclick={() => goto(`/games/${gameId}`)}>
                        <icons.Eye size={18} class="mr-2" />
                        View Game Without Joining
                    </button>
                </div>
            </div>
        {:else if activeTab === 'create-new' && availableCards.length > 0}
            <div class="space-y-4">
                <label class="label pb-1 border-b border-surface-500/30">
                    <span class="font-semibold text-tertiary-400">Select Identity Type</span>
                    <select class="select mt-1 w-full" bind:value={actorType}>
                        <option value="National Identity">National Identity</option>
                        <option value="Sovereign Identity">Sovereign Identity</option>
                    </select>
                </label>
                
                <label class="label pb-1 border-b border-surface-500/30">
                    <span class="font-semibold text-tertiary-400">Custom Name (Optional)</span>
                    <input 
                        class="input mt-1 w-full" 
                        type="text" 
                        bind:value={customName} 
                        placeholder="Enter a name for your actor" 
                    />
                </label>
                
                <label class="label pb-1 border-b border-surface-500/30">
                    <span class="font-semibold text-tertiary-400">Choose Your Card</span>
                    <select class="select mt-1 w-full" bind:value={selectedCardId}>
                        {#each availableCards as card}
                            <option value={card.card_id}>
                                {formatCardTitle(card)}
                            </option>
                        {/each}
                    </select>
                </label>
                
                <!-- Card preview -->
                {#if selectedCardId && availableCards.length > 0}
                    {#each availableCards.filter(card => card.card_id === selectedCardId) as selectedCard}
                        <div class="card p-4 bg-primary-900/20 mt-3">
                            <h3 class="h3 text-primary-400">{selectedCard.role_title || 'Unnamed Role'}</h3>
                            <div class="badge variant-soft-secondary">{selectedCard.card_category || 'Uncategorized'}</div>
                            
                            <div class="mt-3">
                                <h4 class="font-bold text-sm text-tertiary-400">Backstory:</h4>
                                <p class="text-sm">{selectedCard.backstory || 'No backstory available'}</p>
                            </div>
                            
                            <div class="mt-3">
                                <h4 class="font-bold text-sm text-tertiary-400">Goals:</h4>
                                <p class="text-sm">{selectedCard.goals || 'No goals defined'}</p>
                            </div>
                        </div>
                    {/each}
                {/if}
                
                <div class="flex flex-col space-y-2 pt-3">
                    <button
                        class="btn variant-filled-primary w-full"
                        onclick={handleCreateNewActor}
                        disabled={!selectedCardId || isJoining}
                    >
                        {#if isJoining}
                            <span class="spinner-third w-4 h-4 mr-2"></span>
                            Creating Actor...
                        {:else}
                            <icons.UserPlus size={18} class="mr-2" />
                            Join Game with New Actor
                        {/if}
                    </button>
                    
                    <button class="btn variant-ghost-surface w-full" onclick={() => goto(`/games/${gameId}`)}>
                        <icons.Eye size={18} class="mr-2" />
                        View Game Without Joining
                    </button>
                </div>
            </div>
        {/if}
    {/if}
</div>