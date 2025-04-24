<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { currentGameStore, setCurrentGame } from '$lib/stores/gameStore';
    import { getGame, subscribeToGame, getGameActors, getUserCard, joinGame, getPlayerRole, 
        getAvailableCardsForGame, getAvailableAgreementsForGame, actorCache } from '$lib/services/gameService';
    import { getGun, nodes } from '$lib/services/gunService';
    import type { Game, Actor } from '$lib/types';
    import { GameStatus } from '$lib/types';
    import * as icons from '@lucide/svelte';
    
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
    let activeActorId = $state<string | null>(null);
    
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
    
    // Use $effect for the initial data loading and cleanup
    $effect(() => {
        // Load game data when component mounts
        loadGameData().then(() => {
            // Once game data is loaded, safely set up user in game status
            if (game) {
                setupUserInGame();
            }
        });
        
        // Return cleanup function equivalent to onDestroy
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    });
    
    // Optimized function to load all game data efficiently
    async function loadGameData() {
        isLoading = true;
        error = '';
        
        try {
            // 1. Load the game first - this is critical as a dependency for other data
            log(`Loading game data for: ${gameId}`);
            game = await getGame(gameId);
            
            if (!game) {
                error = 'Game not found. Please try refreshing the page.';
                isLoading = false;
                log('Game not found');
                return { game: null, actors: [], cards: [], agreements: [] };
            }
            
            log(`Game loaded: ${gameId}`);
            
            // Store game in the app store for global access
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
            
            // 3. Load all related data concurrently for better performance
            // This leverages Promise.all to fetch multiple data sets at once
            log(`Loading related data for game: ${gameId}`);
            const [actors, cards, agreements] = await Promise.all([
                getGameActors(gameId),
                getAvailableCardsForGame(gameId),
                getAvailableAgreementsForGame(gameId)
            ]);
            
            log(`Data loaded: ${actors.length} actors, ${cards.length} cards, ${agreements.length} agreements`);
            
            // 4. Load the user's actor in this game - can run after other data loads
            await loadUserActor();
            
            // 5. Update user's game status
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
    
    /**
     * Load the current user's actor in this game using optimized approach
     * This function uses a tiered strategy to efficiently locate the user's actor
     * while avoiding unnecessary database calls
     * 
     * @returns Actor object if found, null otherwise
     */
    async function loadUserActor() {
        const user = $userStore.user;
        if (!user?.user_id) {
            log(`No user logged in, cannot load actor`);
            return null;
        }
        
        const userId = user.user_id;
        log(`Looking up actor for user ${userId} in game ${gameId}`);

        // Strategy 1: Check localStorage for the most immediate reference
        // This is the fastest method and works between page refreshes
        const savedActorId = localStorage.getItem(`game_${gameId}_actor`);
        if (savedActorId) {
            log(`Found saved actor ID in localStorage: ${savedActorId}`);
            
            // Verify actor in cache using game_ref (preferred) or game_id
            if (actorCache.has(savedActorId)) {
                const actor = actorCache.get(savedActorId)!;
                // Check both game_ref and game_id for maximum compatibility
                const gameMatches = (actor.game_ref === gameId || actor.game_id === gameId);
                const userMatches = (actor.user_id === userId);
                
                if (gameMatches && userMatches) {
                    log(`Actor found in cache: ${actor.actor_id} (matches user and game)`);
                    playerRole = actor;
                    activeActorId = actor.actor_id;
                    return actor;
                }
                
                log(`Actor in cache doesn't match expected game/user`);
            } else {
                log(`Actor ${savedActorId} not found in cache`);
            }
            
            // Clean up invalid reference - important for data consistency
            log(`Removing invalid localStorage actor reference`);
            localStorage.removeItem(`game_${gameId}_actor`);
        }

        // Strategy 2: Use the gameService API (getPlayerRole is specifically optimized for this)
        // This function efficiently checks the player_actor_map and falls back to database search if needed
        log(`Using getPlayerRole to find actor for user ${userId}`);
        const actor = await getPlayerRole(gameId, userId, activeActorId || undefined);
        
        if (actor) {
            log(`Actor found through getPlayerRole: ${actor.actor_id}`);
            playerRole = actor;
            activeActorId = actor.actor_id;
            
            // Store for future page loads - critical for page refreshes
            localStorage.setItem(`game_${gameId}_actor`, actor.actor_id);
            return actor;
        }

        log(`No actor found for user ${userId} in game ${gameId}`);
        return null;
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
    
    /**
     * Check if the current user is part of the game
     * This is a pure function that doesn't modify any state
     * 
     * @returns boolean - true if user is in the game, false otherwise
     */
    function checkIfUserInGame(): boolean {
        // If no game loaded or no user logged in, definitely not in game
        if (!game || !$userStore.user?.user_id) {
            return false;
        }
        
        const userId = $userStore.user.user_id;
        
        // Fastest check: If user has an assigned actor role, they're in the game
        if (playerRole !== null) {
            log(`User in game check: User has playerRole ${playerRole.actor_id}`);
            return true;
        }
        
        // Next check: Look for user in the players list/map
        if (game.players) {
            // Handle both array and object format for players
            if (Array.isArray(game.players)) {
                const isInGame = game.players.includes(userId);
                log(`User in game check (array): ${isInGame ? 'Found' : 'Not found'} in players array`);
                return isInGame;
            } else {
                const isInGame = Boolean(game.players[userId]);
                log(`User in game check (object): ${isInGame ? 'Found' : 'Not found'} in players object`);
                return isInGame;
            }
        }
        
        // If no players data available, user can't be in the game
        log(`User in game check: No players data available`);
        return false;
    }
    
    /**
     * Setup the user's in-game state
     * This function optimizes the user-in-game detection process
     * and is safe to call multiple times or from subscriptions
     */
    function setupUserInGame() {
        // If user has a player role, they're in the game - fastest path
        if (playerRole) {
            if (!userInGame) {
                log(`Player has role ${playerRole.actor_id} but userInGame was false - updating`);
                userInGame = true;
            }
            return;
        }
        
        // Otherwise, update based on the full game state check
        const isInGame = checkIfUserInGame();
        
        // Only update state if it changed to avoid unnecessary renders
        if (userInGame !== isInGame) {
            log(`Updating userInGame from ${userInGame} to ${isInGame}`);
            userInGame = isInGame;
        }
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