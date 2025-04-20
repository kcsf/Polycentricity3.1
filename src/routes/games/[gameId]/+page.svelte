<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { currentGameStore } from '$lib/stores/gameStore';
    import { activeActorId } from '$lib/stores/enhancedGameStore';
    import { getGame, subscribeToGame, getGameActors, getUserCard, joinGame, getPlayerRole, 
        getAvailableCardsForGame, getAvailableAgreementsForGame, actorCache } from '$lib/services/gameService';
    import { getGun, nodes } from '$lib/services/gunService';
    import type { Game, Actor } from '$lib/types';
    import { GameStatus } from '$lib/types';
    import * as icons from 'lucide-svelte';
    
    import GamePageLayout from './GamePageLayout.svelte';
    
    // Extract gameId from the URL parameters
    const gameId = $page.params.gameId;
    
    // Use Svelte 5 RUNES state management
    let game = $state<Game | null>(null);
    let playerRole = $state<Actor | null>(null);
    let isLoading = $state(true);
    let error = $state('');
    let isJoining = $state(false);
    let unsubscribe = $state<(() => void) | undefined>(undefined);
    
    // Log messages for easier debugging
    const isDev = process.env.NODE_ENV !== 'production';
    const log = (...args: any[]) => isDev && console.log('[GamePage]', ...args);
    
    // If the URL changes but we're still on a game page, handle it
    $effect(() => {
        const currentGameId = $page.params.gameId;
        if (currentGameId !== gameId && currentGameId) {
            window.location.reload(); // Simple approach - reload page when gameId changes
        }
    });
    
    onMount(() => {
        loadGameData().then(() => {
            // Once game data is loaded, safely set up user in game status
            if (game) {
                setupUserInGame();
            }
        });
        
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    });
    
    // Primary function to load game data
    async function loadGameData() {
        isLoading = true;
        error = '';
        
        try {
            // Sequential loading of all game data with proper logging for each step
            // This ensures caches are populated in the correct order and dependencies are available
            
            // 1. Load the game first
            log(`Loading game data for: ${gameId}`);
            game = await getGame(gameId);
            
            if (!game) {
                error = 'Game not found. Please try refreshing the page.';
                isLoading = false;
                log('Game not found');
                return { game: null, actors: [], cards: [], agreements: [] };
            }
            
            log(`Game loaded: ${gameId}`);
            
            // Store it for the app 
            currentGameStore.set(game);
            
            // 2. Set up real-time updates for the game
            unsubscribe = subscribeToGame(gameId, (updatedGame) => {
                if (updatedGame) {
                    game = updatedGame;
                    currentGameStore.set(updatedGame);
                    
                    // Check if user's game status changed
                    setupUserInGame();
                }
            });
            
            // 3. Load actors
            log(`Loading actors for game: ${gameId}`);
            const actors = await getGameActors(gameId);
            log(`Actors loaded: ${actors.length}`);
            
            // 4. Load cards
            log(`Loading cards for game: ${gameId}`);
            const cards = await getAvailableCardsForGame(gameId);
            log(`Cards loaded: ${cards.length}`);
            
            // 5. Load agreements
            log(`Loading agreements for game: ${gameId}`);
            const agreements = await getAvailableAgreementsForGame(gameId);
            log(`Agreements loaded: ${agreements.length}`);
            
            // 6. Load the user's role in this game using the cached data
            // No timeout needed since we're only using cached data, not Gun.js calls
            await loadUserActor();
            
            // 7. After loading completes, determine if user is in game
            setupUserInGame();
            
            // Return the complete dataset for component use
            return { game, actors, cards, agreements };
        } catch (err) {
            log('Error loading game data:', err);
            error = 'Failed to load game data. Please try refreshing the page.';
            return { game: null, actors: [], cards: [], agreements: [] };
        } finally {
            isLoading = false;
        }
    }
    
    // Logic to load the current user's actor in this game
    /**
     * Load the user's actor in the current game using getPlayerRole
     * Simple implementation that leverages the gameService functions
     */
    async function loadUserActor() {
        const user = $userStore.user;
        if (!user || !user.user_id) {
            log('[GamePage] No user logged in, cannot load actor');
            return null;
        }

        // Check localStorage for a cached actor ID and validate it
        const savedActorId = localStorage.getItem(`game_${gameId}_actor`);
        if (savedActorId && actorCache.has(savedActorId)) {
            const actor = actorCache.get(savedActorId)!;
            if (actor.game_id === gameId && actor.user_id === user.user_id) {
                log(`[GamePage] Actor lookup for user ${user.user_id}: ${actor.actor_id} (from cache)`);
                // Update state variables
                playerRole = actor;
                activeActorId.set(actor.actor_id);
                return actor;
            }
        }

        // Fetch actor using getPlayerRole
        const actor = await getPlayerRole(gameId, user.user_id);
        if (actor) {
            log(`[GamePage] Actor lookup for user ${user.user_id}: ${actor.actor_id}`);
            // Update state variables
            playerRole = actor;
            activeActorId.set(actor.actor_id);
            localStorage.setItem(`game_${gameId}_actor`, actor.actor_id); // Cache for future loads
        } else {
            log(`[GamePage] Actor lookup for user ${user.user_id}: none`);
        }

        return actor;
    }
    
    async function handleJoinGame() {
        if (!game) return;
        
        try {
            isJoining = true;
            error = '';
            
            // Simple safe redirect to details page with error handling
            try {
                await goto(`/games/${gameId}/details`);
                log('Navigation to game details successful');
            } catch (navError) {
                log('Navigation error redirecting to details page:', navError);
                // Try fallback navigation
                window.location.href = `/games/${gameId}/details`;
            }
        } catch (err) {
            log('Error in handleJoinGame:', err);
            error = 'An error occurred. Please try again.';
        } finally {
            isJoining = false;
        }
    }
    
    // Check if the current user is part of this game
    // Don't create temporary actors - they cause data inconsistency issues
    // Instead, validate and fetch real Actor data from cache
    
    // State to track if user is in game - separate from the checking logic
    let userInGame = $state(false);
    
    // Function to CHECK if user is in game WITHOUT modifying state
    // This returns boolean only, doesn't modify any state
    function checkIfUserInGame(): boolean {
        if (!game || !$userStore.user) return false;
        
        const userId = $userStore.user.user_id;
        
        // If they have a role assigned, they're definitely in the game
        if (playerRole !== null) {
            return true;
        }
        
        // Simple check: The user is in the game if they're in the players list
        if (game.players) {
            if (Array.isArray(game.players)) {
                return game.players.includes(userId);
            } else {
                return Boolean(game.players[userId]);
            }
        }
        
        return false;
    }
    
    // Function to SETUP user in game - handles all state mutations
    // This can be called from outside template expressions
    function setupUserInGame() {
        // If playerRole is already set, we're definitely in the game
        if (playerRole) {
            userInGame = true;
            return;
        }
        
        // Otherwise, update based on the game state check
        userInGame = checkIfUserInGame();
        
        // If we're not in game but should be (e.g., just after joining),
        // loadUserActor would have already been called during initial page load
    }
</script>

<div class="game-page-wrapper w-full h-full m-0 p-0 overflow-hidden">
    {#if isLoading}
        <div class="flex justify-center items-center h-full">
            <div class="card p-8 text-center bg-surface-200-700-token/30 max-w-md">
                <div class="flex flex-col items-center">
                    <div class="spinner-third w-10 h-10 text-primary-500 m-4"></div>
                    <p class="text-lg">Loading game...</p>
                </div>
            </div>
        </div>
    {:else if error}
        <div class="flex justify-center items-center h-full">
            <div class="card p-8 max-w-md">
                <div class="alert variant-filled-error">
                    <icons.AlertCircle size={24} class="mr-2" />
                    <p>{error}</p>
                </div>
                <div class="flex justify-center mt-6">
                    <a href="/games" class="btn variant-filled-surface">
                        <icons.ArrowLeft size={18} class="mr-2" />
                        Back to Games
                    </a>
                </div>
            </div>
        </div>
    {:else if game}
        {#if userInGame}
            <GamePageLayout {game} {gameId} {playerRole} />
        {:else}
            <div class="flex justify-center items-center h-full">
                <div class="card p-8 m-4 text-center max-w-lg">
                    <h1 class="h2 mb-2">{game.name}</h1>
                    <div class="badge {game.status === GameStatus.ACTIVE ? 'variant-filled-success' : 'variant-filled-primary'} mb-4">
                        {game.status}
                    </div>
                    <p class="text-sm mb-6">
                        Created: {new Date(game.created_at).toLocaleDateString()}
                    </p>
                    
                    <div class="card p-8 text-center bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                        <h3 class="h3">Join the Game</h3>
                        <p class="mt-4">You need to join this game to view the game board and interact with other players.</p>
                        
                        <div class="flex flex-col sm:flex-row gap-2 mt-6 justify-center">
                            <button 
                                class="btn variant-filled-primary" 
                                onclick={async () => {
                                    try {
                                        await goto(`/games/${gameId}/join`);
                                        log('Navigation to join page successful');
                                    } catch (navError) {
                                        log('Navigation error going to join page:', navError);
                                        window.location.href = `/games/${gameId}/join`;
                                    }
                                }}
                                disabled={isJoining}
                            >
                                {#if isJoining}
                                    <div class="spinner-third w-4 h-4 mr-2"></div>
                                    Joining...
                                {:else}
                                    <icons.UserPlus size={18} class="mr-2" />
                                    Join Game
                                {/if}
                            </button>
                            
                            <button class="btn variant-ghost" onclick={async () => {
                                try {
                                    await goto(`/games/${gameId}/details`);
                                    log('Navigation to details page successful');
                                } catch (navError) {
                                    log('Navigation error going to details page:', navError);
                                    window.location.href = `/games/${gameId}/details`;
                                }
                            }}>
                                <icons.Info size={18} class="mr-2" />
                                Game Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    {:else}
        <div class="flex justify-center items-center h-full">
            <div class="card p-8 max-w-md">
                <div class="alert variant-filled-error">
                    <icons.AlertCircle size={24} class="mr-2" />
                    <p>Unable to load game data.</p>
                </div>
                <div class="flex justify-center mt-6">
                    <a href="/games" class="btn variant-filled-surface">
                        <icons.ArrowLeft size={18} class="mr-2" />
                        Back to Games
                    </a>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
  /* Override parent container styles to achieve full width/height without padding or margins */
  :global(main.flex.grow.container.mx-auto.p-4) {
    padding: 0 !important;
    margin: 0 !important;
    max-width: none !important;
    width: 100vw !important;
    height: calc(100vh - var(--app-bar-height, 64px)) !important;
    overflow: hidden !important;
  }
  
  .game-page-wrapper {
    position: absolute;
    top: var(--app-bar-height, 64px); /* Position below the main site header */
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw !important;
    height: calc(100vh - var(--app-bar-height, 64px)) !important; 
  }
</style>