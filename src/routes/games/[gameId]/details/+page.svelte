<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { 
        getGameContext, 
        type GameContext, 
        getCard, 
        getGameActors, 
        getAvailableCardsForGame,
        createActor,
        joinGame,
        assignRole,
        updatePlayerActorMap,
        updateGameStatus
    } from '$lib/services/gameService';
    import { currentGameStore } from '$lib/stores/gameStore';
    import { getCurrentUser } from '$lib/services/authService';
    import { userStore } from '$lib/stores/userStore';
    import type { Game, Actor, Card } from '$lib/types';
    import { GameStatus } from '$lib/types';
    import * as icons from '@lucide/svelte';
    
    const gameId = $page.params.gameId;
    
    // Use Svelte 5 Runes for state variables
    let game = $state<Game | null>(null);
    let isLoading = $state(true);
    let errorMessage = $state('');
    let isFull = $state(false);
    let totalCards = $state<number>(0);
    let usedCards = $state<number>(0);
    let availableCards = $state<number>(0);
    let actors = $state<Actor[]>([]);
    let cardActorMappings = $state<{
        actorId: string;
        actorName: string;
        actorType: string;
        userRef: string;
        cardId: string;
        cardTitle: string;
    }[]>([]);
    
    // Actor selector state variables
    let availableCardsForActors = $state<Card[]>([]);
    let selectedCardId = $state<string>('');
    let actorType = $state<'National Identity' | 'Sovereign Identity'>('National Identity');
    let customName = $state<string>('');
    let creatingActor = $state<boolean>(false);
    let loadingCards = $state<boolean>(false);
    
    // Use an effect to load data when the component mounts using getGameContext
    $effect(async () => {
        try {
            isLoading = true;
            
            // Load all game data with one optimized function call
            const gameContext = await getGameContext(gameId);
            
            if (!gameContext) {
                errorMessage = 'Game not found';
                return;
            }
            
            // Destructure values from the game context
            game = gameContext.game;
            
            // For the card counts, we want to calculate them precisely based on actual actors
            // The length of actors with card_ref represents the actual used cards
            actors = gameContext.actors; // Store actors from game context
            
            // Calculate total cards and used cards directly
            totalCards = gameContext.totalCards;
            
            // Count the actual number of actors with card references
            usedCards = actors.filter(actor => actor.card_ref).length;
            
            // Available cards is the difference between total and used
            availableCards = totalCards - usedCards;
            
            // Determine if game is full based on players count and max_players
            const maxPlayers = typeof game.max_players === 'string' 
                ? parseInt(game.max_players, 10) 
                : game.max_players;
                
            const playerCount = Object.keys(game.players || {}).length;
            isFull = maxPlayers ? playerCount >= maxPlayers : false;
            
            // Load card-actor mappings
            const mappings = [];
            
            // For each actor with a card, get card details and create mapping
            for (const actor of actors) {
                if (actor.card_ref) {
                    try {
                        const card = await getCard(actor.card_ref, true);
                        if (card) {
                            mappings.push({
                                actorId: actor.actor_id,
                                actorName: actor.custom_name || '',
                                actorType: actor.actor_type || '',
                                userRef: actor.user_ref || '',
                                cardId: card.card_id,
                                cardTitle: card.role_title || card.name || ''
                            });
                        }
                    } catch (err) {
                        console.error(`Error loading card ${actor.card_ref} for actor ${actor.actor_id}:`, err);
                    }
                }
            }
            
            cardActorMappings = mappings;
            
            // Log card counts for debugging
            console.log(`Card Counts - Total: ${totalCards}, Used: ${usedCards}, Available: ${availableCards}`);
            
            // Load available cards automatically if the user is logged in
            if ($userStore.user && game.status === GameStatus.ACTIVE && !isFull) {
                await loadAvailableCards();
            }
            
        } catch (err) {
            console.error('Error loading game context:', err);
            errorMessage = 'Failed to load game data';
        } finally {
            isLoading = false;
        }
    });
    
    function goBack() {
        goto('/games');
    }
    
    function viewGame() {
        goto(`/games/${gameId}`);
    }
    
    // Load available cards for the actor selector
    async function loadAvailableCards() {
        try {
            loadingCards = true;
            console.log("Loading available cards for game:", gameId);
            
            // Get available cards from the game service
            const cards = await getAvailableCardsForGame(gameId, true);
            console.log("Retrieved available cards:", cards.length, cards);
            
            // Set the cards in the local state
            availableCardsForActors = cards;
            
            // Set the first card as selected by default
            if (cards.length > 0) {
                selectedCardId = cards[0].card_id;
                console.log("Selected card ID:", selectedCardId);
            } else {
                console.log("No cards available to select");
            }
            
            return cards.length > 0;
        } catch (err) {
            console.error('Error loading available cards:', err);
            errorMessage = `Failed to load cards: ${err.message || 'Unknown error'}`;
            return false;
        } finally {
            loadingCards = false;
        }
    }
    
    // Function to handle actor creation
    async function handleCreateActor() {
        try {
            if (!$userStore.user) {
                errorMessage = 'You must be logged in to create an actor';
                return;
            }
            
            if (!selectedCardId) {
                errorMessage = 'Please select a card';
                return;
            }
            
            creatingActor = true;
            errorMessage = '';
            
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
            viewGame();
        } catch (err) {
            console.error('Error creating actor:', err);
            errorMessage = 'Failed to create actor';
        } finally {
            creatingActor = false;
        }
    }
    
    // Format card title for display
    function formatCardTitle(card: Card): string {
        return `${card.role_title || 'Card'} ${card.card_category ? `(${card.card_category})` : ''}`;
    }
    
    // Get the day's difference between now and the game created date
    function getDaysSinceCreation(createdTimestamp: number): string {
        if (!createdTimestamp) return 'Unknown date';
        
        try {
            const now = new Date();
            const created = new Date(createdTimestamp);
            
            // Check if date is valid
            if (isNaN(created.getTime())) return 'Invalid date';
            
            const diffTime = Math.abs(now.getTime() - created.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            return `${diffDays} days ago`;
        } catch (error) {
            console.error('Error calculating date difference:', error);
            return 'Date error';
        }
    }
</script>

<div class="container mx-auto p-4">
    <div class="bg-gradient-to-r from-primary-900/30 to-tertiary-900/30 p-6 rounded-lg mb-8 shadow-lg">
        <div class="flex justify-between items-center">
            <div>
                <h1 class="h1 text-primary-400 mb-2">Game Details</h1>
                <p class="text-surface-300">
                    {#if game}
                        Viewing details for "{game.name}"
                    {:else}
                        Loading game details...
                    {/if}
                </p>
            </div>
            <button class="btn variant-ghost-surface" onclick={goBack}>
                <icons.ArrowLeft size={20} class="mr-2" />
                Back to Games
            </button>
        </div>
    </div>
    
    {#if isLoading}
        <div class="card p-8 text-center bg-surface-100-800-token">
            <div class="flex justify-center items-center h-32">
                <div class="spinner-third w-8 h-8"></div>
                <p class="ml-4 text-lg">Loading game data...</p>
            </div>
        </div>
    {:else if errorMessage}
        <div class="alert variant-filled-error p-4 mb-4">
            <icons.AlertCircle size={20} />
            <span>{errorMessage}</span>
        </div>
        <div class="flex justify-center mt-4">
            <button class="btn variant-filled-primary" onclick={goBack}>
                <icons.ArrowLeft size={20} class="mr-2" />
                Back to Games
            </button>
        </div>
    {:else if game}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Game Details Card -->
            <div class="card p-6 bg-surface-100-800-token lg:col-span-2">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="h2 text-primary-500">{game.name}</h2>
                    <div class="badge {game.status === GameStatus.ACTIVE ? 'variant-filled-success' : 'variant-filled-warning'} text-sm">
                        {#if game.status === GameStatus.ACTIVE}
                            <icons.Play size={16} class="mr-1" />
                        {:else if game.status === GameStatus.DRAFT}
                            <icons.Edit size={16} class="mr-1" />
                        {:else if game.status === GameStatus.COMPLETE}
                            <icons.CheckCircle size={16} class="mr-1" />
                        {:else}
                            <icons.HelpCircle size={16} class="mr-1" />
                        {/if}
                        {game.status}
                    </div>
                </div>
                
                {#if game.description}
                    <div class="mb-6 p-4 rounded-lg bg-surface-200-700-token/30">
                        <p class="italic">{game.description}</p>
                    </div>
                {/if}
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 class="font-semibold text-tertiary-500 mb-2">Game Info</h3>
                        <ul class="space-y-3">
                            <li class="flex items-center">
                                <icons.Calendar class="mr-3 text-tertiary-500" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Created</span>
                                    <span class="text-sm opacity-80">
                                        {new Date(game.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                        ({getDaysSinceCreation(game.created_at)})
                                    </span>
                                </div>
                            </li>
                            <li class="flex items-center">
                                <icons.Users class="mr-3 text-tertiary-500" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Players</span>
                                    <span class="text-sm opacity-80">
                                        {Object.keys(game.players || {}).length} 
                                        {game.max_players !== undefined && game.max_players > 0 
                                            ? `/ ${Number(game.max_players)}` 
                                            : 'players'} 
                                        {#if isFull}
                                            <span class="badge variant-filled-warning text-xs ml-1">Full</span>
                                        {/if}
                                    </span>
                                </div>
                            </li>
                            <li class="flex items-center">
                                <icons.LayoutGrid class="mr-3 text-tertiary-500" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Deck Type</span>
                                    <span class="text-sm opacity-80 capitalize">
                                        {game.deck_type === 'eco-village' ? 'Eco-Village' :
                                         game.deck_type === 'community-garden' ? 'Community Garden' :
                                         game.deck_type}
                                        {#if totalCards > 0}
                                            <div class="flex flex-wrap gap-1 mt-1">
                                                <span class="badge variant-filled-secondary text-xs">{totalCards} total cards</span>
                                                {#if usedCards > 0}
                                                    <span class="badge variant-filled-primary text-xs">{usedCards} used</span>
                                                {/if}
                                                {#if availableCards > 0}
                                                    <span class="badge variant-filled-success text-xs">{availableCards} available</span>
                                                {/if}
                                            </div>
                                        {/if}
                                    </span>
                                </div>
                            </li>
                            <li class="flex items-center">
                                <icons.SwitchCamera class="mr-3 text-tertiary-500" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Role Assignment</span>
                                    <span class="text-sm opacity-80">
                                        {game.role_assignment_type === 'player-choice' ? 'Player Choice' : 'Random'}
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </div>
                    
                    <div>
                        <h3 class="font-semibold text-tertiary-500 mb-2">Join Game</h3>
                        
                        <div class="card p-5 bg-surface-200-700-token/30 rounded-lg">
                            {#if game.status === GameStatus.ACTIVE && !isFull}
                                <div class="space-y-4">
                                    <h4 class="h4 mb-4 text-primary-500">Select Your Actor</h4>
                                
                                    {#if $userStore.user}
                                        <!-- Load available cards button -->
                                        {#if loadingCards}
                                            <div class="flex flex-col justify-center items-center space-y-4">
                                                <div class="spinner-third w-8 h-8 mb-4"></div>
                                                <p class="text-center">Loading available cards...</p>
                                            </div>
                                        {:else if availableCardsForActors.length === 0}
                                            <div class="flex flex-col justify-center items-center space-y-4">
                                                <div class="p-4 bg-warning-500/10 rounded-lg text-center">
                                                    <h4 class="font-semibold text-warning-500 mb-2">No Available Cards</h4>
                                                    <p class="text-sm mb-4">
                                                        All cards for this game have been assigned to actors. 
                                                        Please try another game or view this game without joining.
                                                    </p>
                                                    
                                                    <button class="btn variant-filled-primary w-full" onclick={viewGame}>
                                                        <icons.Eye size={18} class="mr-2" />
                                                        View Game Without Joining
                                                    </button>
                                                </div>
                                            </div>
                                        {:else}
                                            <!-- Card selection form -->
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
                                                        {#each availableCardsForActors as card}
                                                            <option value={card.card_id}>
                                                                {formatCardTitle(card)}
                                                            </option>
                                                        {/each}
                                                    </select>
                                                </label>
                                                
                                                <!-- Card preview -->
                                                {#if selectedCardId && availableCardsForActors.length > 0}
                                                    {#each availableCardsForActors.filter(card => card.card_id === selectedCardId) as selectedCard}
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
                                                        onclick={handleCreateActor}
                                                        disabled={!selectedCardId || creatingActor}
                                                    >
                                                        {#if creatingActor}
                                                            <span class="spinner-third w-4 h-4 mr-2"></span>
                                                            Creating Actor...
                                                        {:else}
                                                            <icons.UserPlus size={18} class="mr-2" />
                                                            Join Game with Selected Card
                                                        {/if}
                                                    </button>
                                                    
                                                    <button class="btn variant-ghost-surface w-full" onclick={viewGame}>
                                                        <icons.Eye size={18} class="mr-2" />
                                                        View Game Without Joining
                                                    </button>
                                                </div>
                                            </div>
                                        {/if}
                                    {:else}
                                        <div class="flex flex-col justify-center items-center space-y-4">
                                            <p class="text-center mb-2 text-warning-500">
                                                You must be logged in to join this game.
                                            </p>
                                            <a href="/login" class="btn variant-filled-primary w-full">
                                                <icons.LogIn size={18} class="mr-2" />
                                                Log In to Join
                                            </a>
                                            <button class="btn variant-ghost-surface w-full" onclick={viewGame}>
                                                <icons.Eye size={18} class="mr-2" />
                                                View Game as Guest
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            {:else if game.status === GameStatus.ACTIVE && isFull}
                                <div class="flex flex-col justify-center items-center space-y-4">
                                    <p class="mb-4 text-sm text-warning-500">
                                        This game is currently full. You can view the game, but cannot join until a player leaves.
                                    </p>
                                    <button class="btn variant-filled-primary w-full" onclick={viewGame}>
                                        <icons.Eye size={18} class="mr-2" />
                                        View Game
                                    </button>
                                </div>
                            {:else}
                                <div class="flex flex-col justify-center items-center space-y-4">
                                    <p class="mb-4 text-sm text-warning-500">
                                        This game is {game.status.toLowerCase()}. You can view the game, but joining is only available for active games.
                                    </p>
                                    <button class="btn variant-filled-primary w-full" onclick={viewGame}>
                                        <icons.Eye size={18} class="mr-2" />
                                        View Game
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Card-Actor Mappings Card -->
            {#if cardActorMappings.length > 0}
                <div class="card p-6 bg-surface-100-800-token lg:col-span-3 mb-8">
                    <h3 class="h3 mb-4 text-primary-500">Card-Actor Assignments</h3>
                    
                    <div class="overflow-x-auto">
                        <table class="table table-compact table-hover">
                            <thead>
                                <tr>
                                    <th class="text-secondary-500">Actor Name</th>
                                    <th class="text-secondary-500">Type</th>
                                    <th class="text-secondary-500">User</th>
                                    <th class="text-secondary-500">Card Name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each cardActorMappings as mapping}
                                    <tr>
                                        <td class="font-medium">{mapping.actorName || 'Unnamed Actor'}</td>
                                        <td>{mapping.actorType || 'N/A'}</td>
                                        <td>{mapping.userRef || 'No User'}</td>
                                        <td class="text-primary-500 font-medium">{mapping.cardTitle || 'Unknown Card'}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="mt-4 p-3 bg-surface-200-700-token/30 rounded-lg">
                        <p class="text-sm">
                            <span class="font-semibold">{cardActorMappings.length}</span> 
                            {cardActorMappings.length === 1 ? 'actor has a' : 'actors have'} card assigned in this game.
                        </p>
                    </div>
                </div>
            {/if}
            
            <!-- Rules & Instructions Card -->
            <div class="card p-6 bg-surface-100-800-token">
                <h3 class="h3 mb-4 text-secondary-500">How To Play</h3>
                
                <div class="space-y-4">
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">1. Join the Game</h4>
                        <p class="text-sm">Click "Create Actor & Join Game" to enter the game and select your actor role.</p>
                    </div>
                    
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">2. Select Your Actor</h4>
                        <p class="text-sm">Choose a role from the available cards. Each actor has unique values, capabilities, and goals.</p>
                    </div>
                    
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">3. Interact With Others</h4>
                        <p class="text-sm">Collaborate with other players to achieve collective goals while managing your individual objectives.</p>
                    </div>
                    
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">4. Create Agreements</h4>
                        <p class="text-sm">Establish formal agreements with other actors to exchange benefits and obligations.</p>
                    </div>
                    
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">5. Chat & Communicate</h4>
                        <p class="text-sm">Use the chat system to communicate with all players or privately with specific actors.</p>
                    </div>
                </div>
                
                <div class="mt-6 p-4 bg-secondary-500/10 rounded-lg">
                    <h4 class="font-semibold text-secondary-400 mb-2">Game Objective</h4>
                    <p class="text-sm">Create a thriving, sustainable community by balancing individual and collective needs through effective collaboration and resource management.</p>
                </div>
            </div>
        </div>
    {/if}
</div>