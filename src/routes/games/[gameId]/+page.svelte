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
        
        // Basic components
        import UserCard from '$lib/components/UserCard.svelte';
        import RoleCard from '$lib/components/RoleCard.svelte';
        import ChatBox from '$lib/components/ChatBox.svelte';
        
        // Game-specific components
        import GameBoard from '$lib/components/game/GameBoard.svelte';
        import PlayersList from '$lib/components/game/PlayersList.svelte';
        import GameDashboard from '$lib/components/game/GameDashboard.svelte';
        import RoleSelector from '$lib/components/game/RoleSelector.svelte';
        import D3GameBoardIntegrated from '$lib/components/game/D3GameBoardIntegrated.svelte';
        
        export let data;
        
        let game: Game | null = null;
        let isLoading = true;
        let error = '';
        let playerRole: Actor | null = null;
        let isJoining = false;
        let unsubscribe: () => void;
        
        // Extract gameId from the URL
        const gameId = $page.params.gameId;
        
        onMount(async () => {
                // Redirect to login if not authenticated (commented for development)
                // if (!$userStore.user) {
                //         goto('/login');
                //         return;
                // }
                
                // Load the initial game data
                await loadGame();
                
                // Subscribe to game updates
                unsubscribe = subscribeToGame(gameId, (updatedGame) => {
                        game = updatedGame;
                        currentGameStore.set(updatedGame);
                });
                
                await loadPlayerRole();
                
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
                        
                        // Try to load player role with the actor ID
                        await loadPlayerRoleWithActor(savedActorId);
                    }
                }
                
                // Subscribe to changes in the activeActorId store
                const unsubscribeActorId = activeActorId.subscribe(async (actorId) => {
                    if (actorId && game && $userStore.user) {
                        console.log(`Active actor ID changed to: ${actorId}`);
                        
                        // Check if we need to load (or reload) the player role
                        if (!playerRole || playerRole.actor_id !== actorId) {
                            await loadPlayerRoleWithActor(actorId);
                        }
                    }
                });
                
                // Add cleanup for the actor ID subscription
                return () => {
                    if (unsubscribeActorId) unsubscribeActorId();
                };
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
                        const joined = await joinGame(gameId);
                        
                        if (joined) {
                                // Redirect to join page to select actor
                                goto(`/games/${gameId}/join`);
                        } else {
                                error = 'Failed to join the game';
                        }
                } catch (err) {
                        console.error('Error joining game:', err);
                        error = 'An error occurred while joining the game';
                } finally {
                        isJoining = false;
                }
        }
        
        async function loadPlayerRole() {
                if (game && $userStore.user) {
                    playerRole = await getPlayerRole(gameId, $userStore.user.user_id);
                    console.log('Player role:', playerRole);
                }
        }
        
        async function loadPlayerRoleWithActor(actorId: string) {
                if (!game || !$userStore.user) return;
                
                try {
                    console.log(`Loading player role with actorId: ${actorId}`);
                    playerRole = await getPlayerRole(gameId, $userStore.user.user_id, actorId);
                    
                    if (!playerRole) {
                        // If the role doesn't exist yet, try to assign it
                        console.log(`Assigning actor ${actorId} to user ${$userStore.user.user_id}`);
                        const assigned = await assignRole(gameId, $userStore.user.user_id, actorId);
                        
                        if (assigned) {
                            // Reload the player role
                            playerRole = await getPlayerRole(gameId, $userStore.user.user_id, actorId);
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

<div class="container mx-auto p-4">
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
                <div class="flex flex-col space-y-4">
                        <!-- Game header -->
                        <div class="card p-4">
                                <div class="flex justify-between items-center">
                                        <div>
                                                <h1 class="h1">{game.name}</h1>
                                                <div class="badge {game.status === GameStatus.ACTIVE ? 'variant-filled-success' : 'variant-filled-primary'}">
                                                        {game.status}
                                                </div>
                                                <p class="text-sm mt-2">Created: {new Date(game.created_at).toLocaleDateString()}</p>
                                        </div>
                                        
                                        <div>
                                                {#if !isCurrentUserInGame()}
                                                        <button class="btn variant-filled-primary" on:click={handleJoinGame} disabled={isJoining}>
                                                                {isJoining ? 'Joining...' : 'Join Game'}
                                                        </button>
                                                {:else}
                                                        <a href="/games/{gameId}/chat" class="btn variant-filled-secondary">
                                                                Open Chat
                                                        </a>
                                                {/if}
                                        </div>
                                </div>
                        </div>
                        
                        <!-- Game content -->
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <!-- Player info and role -->
                                <div class="lg:col-span-1 space-y-4">
                                        <!-- Game Dashboard -->
                                        {#if isCurrentUserInGame()}
                                                <div class="mb-4">
                                                        <GameDashboard {game} />
                                                </div>
                                        {/if}
                                        
                                        <!-- Players List -->
                                        <PlayersList 
                                                {game} 
                                                highlightCurrentUser={true} 
                                                currentUserId={$userStore.user?.user_id || null} 
                                        />
                                        
                                        <!-- Role Selection/Display -->
                                        {#if isCurrentUserInGame()}
                                                <RoleSelector 
                                                        {game} 
                                                        userId={$userStore.user?.user_id || 'dev-user-' + Date.now()} 
                                                />
                                        {/if}
                                </div>
                                
                                <!-- Game main content area -->
                                <div class="lg:col-span-2">
                                        {#if isCurrentUserInGame()}
                                                <div class="mb-4">
                                                        <GameBoard 
                                                                {gameId} 
                                                                activeActorId={playerRole?.actor_id}
                                                        />
                                                </div>
                                                
                                                <div class="card p-4 h-64">
                                                        <ChatBox {gameId} chatType="group" />
                                                </div>
                                        {:else}
                                                <div class="card p-8 text-center bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                                                        <div class="flex flex-col items-center justify-center py-12">
                                                                <div class="text-5xl text-primary-400 mb-4">🎲</div>
                                                                <h2 class="h2 mb-2">Join to Participate</h2>
                                                                <p class="mb-6 text-surface-600 dark:text-surface-400">You need to join this game to see the game content and participate.</p>
                                                                <button class="btn variant-filled-primary" on:click={handleJoinGame} disabled={isJoining}>
                                                                        {isJoining ? 'Joining...' : 'Join Game'}
                                                                </button>
                                                        </div>
                                                </div>
                                        {/if}
                                </div>
                        </div>
                </div>
        {:else}
                <div class="alert variant-filled-warning">
                        <p>Game could not be found. It may have been deleted.</p>
                        <div class="mt-4">
                                <a href="/games" class="btn variant-ghost-surface">Back to Games</a>
                        </div>
                </div>
        {/if}
</div>
