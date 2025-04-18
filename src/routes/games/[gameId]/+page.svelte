<script lang="ts">
        import { onMount, onDestroy } from 'svelte';
        import { page } from '$app/stores';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import { currentGameStore } from '$lib/stores/gameStore';
        import { activeActorId } from '$lib/stores/enhancedGameStore';
        import { getGame, subscribeToGame, joinGame, getPlayerRole, assignRole } from '$lib/services/gameService';
        import type { Game, Actor } from '$lib/types';
        import { GameStatus } from '$lib/types';
        
        import GamePageLayout from './GamePageLayout.svelte';
        
        export const data = {}; // Using export const instead of export let for external reference
        
        let game: Game | null = null;
        let isLoading = true;
        let error = '';
        let playerRole: Actor | null = null;
        let isJoining = false;
        let unsubscribe: () => void;
        
        // Extract gameId from the URL
        const gameId = $page.params.gameId;
        
        onMount(async () => {
                try {
                    // Initialize error and loading states
                    error = '';
                    isLoading = true;
                    
                    // Load the initial game data with a timeout to prevent freezing
                    const gamePromise = loadGame();
                    const timeoutPromise = new Promise<void>((_, reject) => {
                        setTimeout(() => reject(new Error('Game loading timeout')), 10000);
                    });
                    
                    try {
                        await Promise.race([gamePromise, timeoutPromise]);
                    } catch (err) {
                        console.error('Error or timeout during game loading:', err);
                        error = 'Failed to load game data. Please try again or go back to games list.';
                        isLoading = false;
                        return;
                    }
                    
                    // If game load succeeded, subscribe to game updates
                    unsubscribe = subscribeToGame(gameId, (updatedGame) => {
                        if (updatedGame) {
                            game = updatedGame;
                            currentGameStore.set(updatedGame);
                        }
                    });
                    
                    // Set a reasonable timeout for player role loading
                    const playerRolePromise = loadPlayerRole();
                    const roleTimeoutPromise = new Promise<void>((resolve) => {
                        setTimeout(resolve, 5000);
                    });
                    
                    // Don't wait forever for player role
                    await Promise.race([playerRolePromise, roleTimeoutPromise]);
                    
                    // Update activeActorId store if we have a player role
                    if (playerRole) {
                        console.log(`Setting active actor ID in store: ${playerRole.actor_id}`);
                        activeActorId.set(playerRole.actor_id);
                    } else {
                        // If no active actor, check localStorage from a recent join
                        const savedActorId = localStorage.getItem(`game_${gameId}_actor`);
                        if (savedActorId) {
                            console.log(`Found saved actor ID in localStorage: ${savedActorId}`);
                            activeActorId.set(savedActorId);
                            
                            // Try to load player role with the actor ID but with timeout
                            const actorRolePromise = loadPlayerRoleWithActor(savedActorId);
                            await Promise.race([actorRolePromise, roleTimeoutPromise]);
                        }
                    }
                    
                    // Subscribe to changes in the activeActorId store
                    const unsubscribeActorId = activeActorId.subscribe((actorId) => {
                        if (actorId && game && $userStore.user) {
                            console.log(`Active actor ID changed to: ${actorId}`);
                            
                            // Check if we need to load (or reload) the player role
                            if (!playerRole || playerRole.actor_id !== actorId) {
                                // Don't await - run in background to prevent freezing
                                loadPlayerRoleWithActor(actorId).catch(err => {
                                    console.error('Error loading player role:', err);
                                });
                            }
                        }
                    });
                    
                    // Add cleanup for the actor ID subscription
                    return () => {
                        if (unsubscribeActorId) unsubscribeActorId();
                    };
                } catch (err) {
                    console.error('Fatal error during game page initialization:', err);
                    error = 'An unexpected error occurred. Please try again or go back to games list.';
                } finally {
                    isLoading = false;
                }
        });
        
        onDestroy(() => {
                if (unsubscribe) {
                        unsubscribe();
                }
        });
        
        async function loadGame() {
                try {
                        isLoading = true;
                        game = await getGame(gameId);
                        
                        if (game) {
                                currentGameStore.set(game);
                        } else {
                                error = 'Game not found';
                        }
                } catch (err) {
                        console.error('Error loading game:', err);
                        error = 'Failed to load game data';
                } finally {
                        isLoading = false;
                }
        }
        
        async function handleJoinGame() {
                if (!game) return;
                
                try {
                        isJoining = true;
                        error = '';
                        
                        // Use a timeout to prevent freezing during join
                        const joinPromise = joinGame(gameId);
                        const timeoutPromise = new Promise<boolean>((resolve) => {
                            setTimeout(() => resolve(false), 8000);
                        });
                        
                        const joined = await Promise.race([joinPromise, timeoutPromise]);
                        
                        if (joined) {
                                // Redirect to details page instead of directly to join
                                // This avoids freezing issues with the join page
                                goto(`/games/${gameId}/details`);
                        } else {
                                error = 'Failed to join the game or the operation timed out';
                                console.log('Redirecting to the details page instead due to join timeout/failure');
                                goto(`/games/${gameId}/details`);
                        }
                } catch (err) {
                        console.error('Error joining game:', err);
                        error = 'An error occurred while joining the game';
                        // Still redirect to a safe page
                        goto(`/games/${gameId}/details`);
                } finally {
                        isJoining = false;
                }
        }
        
        async function loadPlayerRole() {
                if (game && $userStore.user) {
                    try {
                        console.log(`Loading player role for user ${$userStore.user.user_id} in game ${gameId}`);
                        playerRole = await getPlayerRole(gameId, $userStore.user.user_id);
                        console.log('Player role:', playerRole);
                    } catch (err) {
                        console.error('Error loading player role:', err);
                        // Don't throw - gracefully handle the error
                    }
                }
        }
        
        async function loadPlayerRoleWithActor(actorId: string) {
                if (!game || !$userStore.user) return;
                
                try {
                    console.log(`Loading player role with actorId: ${actorId}`);
                    
                    // Use a timeout to prevent infinite waiting
                    const rolePromise = getPlayerRole(gameId, $userStore.user.user_id, actorId);
                    const timeoutPromise = new Promise<null>((resolve) => {
                        setTimeout(() => resolve(null), 5000); // 5-second timeout
                    });
                    
                    // Race between the role retrieval and timeout
                    playerRole = await Promise.race([rolePromise, timeoutPromise]);
                    
                    if (!playerRole) {
                        console.log('No player role found or timeout occurred, attempting to assign role');
                        // If the role doesn't exist yet, try to assign it
                        console.log(`Assigning actor ${actorId} to user ${$userStore.user.user_id}`);
                        const assigned = await assignRole(gameId, $userStore.user.user_id, actorId);
                        
                        if (assigned) {
                            // Reload the player role with a timeout
                            const reloadPromise = getPlayerRole(gameId, $userStore.user.user_id, actorId);
                            playerRole = await Promise.race([reloadPromise, timeoutPromise]);
                            console.log('Role assigned and loaded:', playerRole);
                        } else {
                            console.error('Failed to assign role');
                        }
                    } else {
                        console.log('Found existing player role:', playerRole);
                    }
                } catch (err) {
                    console.error('Error in loadPlayerRoleWithActor:', err);
                }
        }
                
        function isCurrentUserInGame(): boolean {
                if (!game) return false;
                
                // If there's a logged in user, check if they're in the game
                if ($userStore.user) {
                    const userId = $userStore.user.user_id;
                    
                    // First check if player is in the players array/object
                    let isInPlayers = false;
                    if (Array.isArray(game.players)) {
                        isInPlayers = game.players.includes(userId);
                    } else {
                        // Check if player exists in the object-based players structure
                        isInPlayers = game.players && game.players[userId] === true;
                    }
                    
                    // If they have a role assigned, they're definitely in the game
                    const hasRole = playerRole !== null;
                    
                    return isInPlayers || hasRole;
                }
                
                // For development: always return false when no user is logged in
                console.warn('No user logged in. User is not in game.');
                return false;
        }
</script>

<div class="game-page-wrapper w-full h-full m-0 p-0 overflow-hidden">
        {#if isLoading}
                <div class="card p-8 text-center">
                        <p>Loading game...</p>
                </div>
        {:else if error}
                <div class="alert variant-filled-error mb-4">
                        <p>{error}</p>
                        <div class="mt-4">
                                <a href="/games" class="btn variant-ghost-surface">Back to Games</a>
                        </div>
                </div>
        {:else if game}
                {#if isCurrentUserInGame()}
                        <GamePageLayout {game} {gameId} {playerRole} />
                {:else}
                        <!-- Not in game yet - show join screen -->
                        <div class="card p-8 m-4 text-center">
                                <h1 class="h1 mb-2">{game.name}</h1>
                                <div class="badge {game.status === GameStatus.ACTIVE ? 'variant-filled-success' : 'variant-filled-primary'} mb-4">
                                        {game.status}
                                </div>
                                <p class="text-sm mb-6">Created: {new Date(game.created_at).toLocaleDateString()}</p>
                                
                                <div class="card p-8 text-center bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                                        <h3 class="h3">Join the Game</h3>
                                        <p class="mt-4">Join this game to view the game board and interact with other players.</p>
                                        <button 
                                            class="btn variant-filled-primary mt-6" 
                                            onclick={handleJoinGame} 
                                            disabled={isJoining}
                                        >
                                            {#if isJoining}
                                                <div class="spinner-third w-4 h-4 mr-2"></div>
                                                Joining...
                                            {:else}
                                                Join Game
                                            {/if}
                                        </button>
                                </div>
                        </div>
                {/if}
        {:else}
                <div class="alert variant-filled-error m-4">
                        <p>Unable to load game data.</p>
                        <div class="mt-4">
                                <a href="/games" class="btn variant-ghost-surface">Back to Games</a>
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