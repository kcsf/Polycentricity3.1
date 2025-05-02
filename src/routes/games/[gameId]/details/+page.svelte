<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import {
        getGameContext,
        subscribeToGame,
        type GameContext
    } from '$lib/services/gameService';
    import { getGun } from '$lib/services/gunService';
    import { userStore } from '$lib/stores/userStore';
    import type { Game, ActorWithCard, CardWithPosition } from '$lib/types';
    import { GameStatus } from '$lib/types';
    import * as icons from '@lucide/svelte';
    import ActorSelector from '$lib/components/game/ActorSelector.svelte';

    // Pull the param out of $page
    const gameId = $page.params.gameId;

    // Safety redirect
    if (!gameId) {
        goto('/games');
    }

    // State
    let game = $state<Game | null>(null);
    let deckName = $state<string>('');
    let isLoading = $state(true);
    let errorMessage = $state('');
    let isFull = $state(false);
    let totalCards = $state<number>(0);
    let usedCards = $state<number>(0);
    let availableCardsCount = $state<number>(0);
    let actors = $state<ActorWithCard[]>([]);
    let availableCardsForActors = $state<CardWithPosition[]>([]);

    // Derived for your table
    const cardActorMappings = $derived(
        actors.map(actor => ({
            actorId: actor.actor_id,
            actorName: actor.custom_name || '',
            actorType: actor.actor_type || '',
            userRef: actor.user_ref || '',
            cardId: actor.card?.card_id || '',
            cardTitle: actor.card?.role_title || 'Unknown Card'
        }))
    );

    // 1️⃣ Initial load of everything
    $effect(async () => {
        isLoading = true;
        errorMessage = '';
        console.log(`[GameDetailsPage] Loading context for ${gameId}`);
        
        // Direct lookup of actors for debugging
        const gun = getGun();
        if (gun) {
            console.log(`[GameDetailsPage] Direct lookup of game data for ${gameId}`);
            gun.get('games').get(gameId).once((data) => {
                console.log(`[GameDetailsPage] Raw game data:`, data);
                if (data && data.actors_ref) {
                    console.log(`[GameDetailsPage] Raw actors_ref:`, data.actors_ref);
                    
                    // Extract actor IDs from boolean true values
                    const directActorIds = Object.keys(data.actors_ref).filter(key => 
                        data.actors_ref[key] === true
                    );
                    console.log(`[GameDetailsPage] Direct actor IDs:`, directActorIds);
                    
                    // Debug load of first actor
                    if (directActorIds.length > 0) {
                        gun.get('actors').get(directActorIds[0]).once((actorData) => {
                            console.log(`[GameDetailsPage] First actor data:`, actorData);
                        });
                    }
                }
            });
        }
        
        const ctx: GameContext | null = await getGameContext(gameId);
        if (!ctx) {
            errorMessage = 'Game not found';
            console.error(`[GameDetailsPage] No context for ${gameId}`);
            // Reset state on failure
            game = null;
            deckName = '';
            totalCards = 0;
            usedCards = 0;
            availableCardsCount = 0;
            actors = [];
            availableCardsForActors = [];
            isFull = false;
        } else {
            // Destructure and assign
            game = ctx.game;
            deckName = ctx.deckName;
            totalCards = ctx.totalCards;
            usedCards = ctx.usedCards;
            availableCardsForActors = ctx.availableCards;
            availableCardsCount = ctx.availableCardsCount;
            actors = ctx.actors; // Missing assignment
            // Log card counts for debugging
            console.log(`[GameDetailsPage] Card Counts - Total: ${totalCards}, Used: ${usedCards}, Available: ${availableCardsCount}`);
            console.log(`[GameDetailsPage] Available Cards:`, availableCardsForActors);
            console.log(`[GameDetailsPage] Actors:`, actors);
            // Compute isFull
            const max = typeof game.max_players === 'string'
                ? parseInt(game.max_players, 10)
                : game.max_players;
            const count = Object.keys(game.players || {}).length;
            isFull = max ? count >= max : false;
        }
        isLoading = false;
    });

    // 2️⃣ Live‐update subscription for this one game
    $effect(() => {
        const unsubscribe = subscribeToGame(gameId, () => {
            // Re‐run the same load logic
            getGameContext(gameId).then(ctx => {
                if (!ctx) {
                    console.error(`[GameDetailsPage] Subscription update failed for ${gameId}`);
                    return;
                }
                game = ctx.game;
                deckName = ctx.deckName;
                totalCards = ctx.totalCards;
                usedCards = ctx.usedCards;
                availableCardsForActors = ctx.availableCards;
                availableCardsCount = ctx.availableCardsCount;
                actors = ctx.actors; // Missing assignment
                const max = typeof game.max_players === 'string'
                    ? parseInt(game.max_players, 10)
                    : game.max_players;
                const count = Object.keys(game.players || {}).length;
                isFull = max ? count >= max : false;
                console.log(`[GameDetailsPage] Subscription updated - Card Counts - Total: ${totalCards}, Used: ${usedCards}, Available: ${availableCardsCount}`);
            });
        });
        return () => unsubscribe();
    });

    // Navigation helpers
    function goBack() {
        goto('/games');
    }
    function viewGame() {
        goto(`/games/${gameId}`);
    }

    // Format card title
    function formatCardTitle(card: CardWithPosition): string {
        return `${card.role_title || 'Card'}${card.card_category ? ` (${card.card_category})` : ''}`;
    }

    // Days since creation
    function getDaysSinceCreation(createdTimestamp: number): string {
        if (!createdTimestamp) return 'Unknown date';
        try {
            const now = new Date();
            const created = new Date(createdTimestamp);
            const diff = Math.ceil(Math.abs(now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff} days ago`;
        } catch {
            return 'Date error';
        }
    }
</script>

<div class="container mx-auto p-6 space-y-8">
    <!-- Header Section -->
    <div class="card bg-gradient-to-r from-primary-900/30 to-tertiary-900/30 p-6 rounded-lg shadow-xl">
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
        <div class="card p-8 text-center bg-surface-100-800">
            <div class="flex justify-center items-center h-32">
                <span class="loading loading-spinner loading-lg text-primary-500 mr-4"></span>
                <p class="text-lg">Loading game data...</p>
            </div>
        </div>
    {:else if errorMessage}
        <div class="alert variant-filled-error p-4 mb-4">
            <icons.AlertCircle size={20} class="mr-2" />
            <span>{errorMessage}</span>
        </div>
        <div class="flex justify-center mt-4">
            <button class="btn variant-filled-primary" onclick={goBack}>
                <icons.ArrowLeft size={20} class="mr-2" />
                Back to Games
            </button>
        </div>
    {:else if game}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Game Details Card -->
            <div class="card p-6 bg-surface-100-800 lg:col-span-2 space-y-6">
                <header class="flex justify-between items-start">
                    <h2 class="h2 text-primary-500">{game.name}</h2>
                    <div class="badge {game.status === GameStatus.ACTIVE ? 'variant-filled-success' : game.status === GameStatus.COMPLETED ? 'variant-filled-success' : 'variant-filled-warning'} text-sm">
                        {#if game.status === GameStatus.ACTIVE}
                            <icons.Play size={16} class="mr-1" />
                        {:else if game.status === GameStatus.CREATED || game.status === GameStatus.SETUP}
                            <icons.Edit size={16} class="mr-1" />
                        {:else if game.status === GameStatus.COMPLETED}
                            <icons.CheckCircle size={16} class="mr-1" />
                        {:else if game.status === GameStatus.PAUSED}
                            <icons.Pause size={16} class="mr-1" />
                        {:else}
                            <icons.HelpCircle size={16} class="mr-1" />
                        {/if}
                        {game.status}
                    </div>
                </header>

                {#if game.description}
                    <div class="p-4 rounded-lg bg-surface-200-700/30">
                        <p class="italic text-surface-300">{game.description}</p>
                    </div>
                {/if}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 class="font-semibold text-tertiary-500 mb-3">Game Info</h3>
                        <ul class="space-y-4">
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
                            <!-- Players block -->
                            <li class="flex items-center">
                                <icons.Users class="mr-3 text-tertiary-500" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Players</span>
                                    <span class="text-sm opacity-80">
                                        {#if game.max_players}
                                            {Object.keys(game.players || {}).length} / {game.max_players} players
                                        {:else}
                                            {Object.keys(game.players || {}).length} players
                                        {/if}
                                        {#if isFull}
                                            <span class="badge variant-filled-warning text-xs ml-1">Full</span>
                                        {/if}
                                    </span>
                                </div>
                            </li>

                            <!-- Deck + Available Cards -->
                            <li class="flex items-start">
                                <icons.LayoutGrid class="mr-3 text-tertiary-500 mt-1" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Deck</span>
                                    <span class="text-sm opacity-80">{deckName || 'Unknown Deck'}</span>
                                    <div class="flex flex-wrap gap-1 mt-1 text-sm">
                                        <span class="badge variant-filled-secondary text-xs">
                                            {totalCards} total
                                        </span>
                                        <span class="badge variant-filled-success text-xs">
                                            {availableCardsCount} available
                                        </span>
                                    </div>
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
                        <h3 class="font-semibold text-tertiary-500 mb-3">Join Game</h3>
                        <div class="card p-5 bg-surface-200-700/30 rounded-lg">
                            {#if game.status === GameStatus.ACTIVE && !isFull}
                                <!-- Use the reusable ActorSelector component -->
                                <ActorSelector 
                                    {gameId} 
                                    {game} 
                                    availableCardsForActors={availableCardsForActors}
                                    onGameEnter={viewGame}
                                />
                            {:else if game.status === GameStatus.ACTIVE && isFull}
                                <div class="flex flex-col justify-center items-center space-y-4">
                                    <p class="mb-4 text-sm text-warning-500 text-center">
                                        This game is currently full. You can view the game, but cannot join until a player leaves.
                                    </p>
                                    <button class="btn variant-filled-primary w-full" onclick={viewGame}>
                                        <icons.Eye size={18} class="mr-2" />
                                        View Game
                                    </button>
                                </div>
                            {:else}
                                <div class="flex flex-col justify-center items-center space-y-4">
                                    <p class="mb-4 text-sm text-warning-500 text-center">
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
                <div class="card p-6 bg-surface-100-800 lg:col-span-3 space-y-4">
                    <h3 class="h3 text-primary-500">Card-Actor Assignments</h3>

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

                    <div class="p-3 bg-surface-200-700/30 rounded-lg">
                        <p class="text-sm">
                            <span class="font-semibold">{cardActorMappings.length}</span> 
                            {cardActorMappings.length === 1 ? 'actor has a' : 'actors have'} card assigned in this game.
                        </p>
                    </div>
                </div>
            {/if}

            <!-- Rules & Instructions Card -->
            <div class="card p-6 bg-surface-100-800 space-y-6">
                <h3 class="h3 text-secondary-500">How To Play</h3>

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

                <div class="p-4 bg-secondary-500/10 rounded-lg">
                    <h4 class="font-semibold text-secondary-400 mb-2">Game Objective</h4>
                    <p class="text-sm">Create a thriving, sustainable community by balancing individual and collective needs through effective collaboration and resource management.</p>
                </div>
            </div>
        </div>
    {/if}
</div>