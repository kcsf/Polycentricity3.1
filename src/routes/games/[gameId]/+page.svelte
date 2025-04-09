<script lang="ts">
        import { onMount, onDestroy } from 'svelte';
        import { page } from '$app/stores';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import { currentGameStore } from '$lib/stores/gameStore';
        import { getGame, subscribeToGame, joinGame, getPlayerRole } from '$lib/services/gameService';
        import type { Game, Actor } from '$lib/types';
        import { GameStatus } from '$lib/types';
        import UserCard from '$lib/components/UserCard.svelte';
        import RoleCard from '$lib/components/RoleCard.svelte';
        import ChatBox from '$lib/components/ChatBox.svelte';
        
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
                // Temporarily disabled authentication check for development
                // if (!$userStore.user) {
                //         goto('/login');
                //         return;
                // }
                
                await loadGame();
                
                // Subscribe to game updates
                unsubscribe = subscribeToGame(gameId, (updatedGame) => {
                        game = updatedGame;
                        currentGameStore.set(updatedGame);
                });
                
                // Load player's role if they have one
                let userId = $userStore.user?.user_id;
                
                // Create a mock user ID for development if no user is logged in
                if (!userId) {
                    console.warn('No user ID available. Using mock user ID for development.');
                    userId = 'dev-user-' + Date.now();
                }
                
                if (game) {
                    playerRole = await getPlayerRole(gameId, userId);
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
                        const joined = await joinGame(gameId);
                        
                        if (joined) {
                                await loadGame(); // Reload game data
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
        
        function isCurrentUserInGame(): boolean {
                if (!game) return false;
                
                // If there's a logged in user, check if they're in the game
                if ($userStore.user) {
                    const userId = $userStore.user.user_id;
                    if (Array.isArray(game.players)) {
                        return game.players.includes(userId);
                    } else {
                        // Check if player exists in the object-based players structure
                        return game.players && game.players[userId] === true;
                    }
                }
                
                // For development: always return true when no user is logged in
                console.warn('No user logged in. Treating as if user is in game for development.');
                return true;
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
                                        <div class="card p-4">
                                                {#if Array.isArray(game.players)}
                                                    <h2 class="h2 mb-4">Players ({game.players.length})</h2>
                                                    
                                                    {#if game.players.length === 0}
                                                            <p>No players have joined yet.</p>
                                                    {:else}
                                                            <div class="space-y-2">
                                                                    {#each game.players as playerId}
                                                                            <!-- This is simplified as we don't have a way to get player info from ID -->
                                                                            <div class="p-2 rounded bg-surface-100-800-token">
                                                                                    <p>{playerId}</p>
                                                                            </div>
                                                                    {/each}
                                                            </div>
                                                    {/if}
                                                {:else}
                                                    <!-- Handle players as object format -->
                                                    {@const playerCount = Object.keys(game.players || {}).length}
                                                    <h2 class="h2 mb-4">Players ({playerCount})</h2>
                                                    
                                                    {#if playerCount === 0}
                                                            <p>No players have joined yet.</p>
                                                    {:else}
                                                            <div class="space-y-2">
                                                                    {#each Object.keys(game.players || {}) as playerId}
                                                                            <!-- This is simplified as we don't have a way to get player info from ID -->
                                                                            <div class="p-2 rounded bg-surface-100-800-token">
                                                                                    <p>{playerId}</p>
                                                                            </div>
                                                                    {/each}
                                                            </div>
                                                    {/if}
                                                {/if}
                                        </div>
                                        
                                        {#if isCurrentUserInGame()}
                                                <div class="card p-4">
                                                        <h2 class="h2 mb-4">Your Role</h2>
                                                        
                                                        {#if playerRole}
                                                                <RoleCard actor={playerRole} isAssigned={true} />
                                                        {:else}
                                                                <p>No role assigned yet. The game creator will assign roles soon.</p>
                                                        {/if}
                                                </div>
                                        {/if}
                                </div>
                                
                                <!-- Game main content area -->
                                <div class="lg:col-span-2">
                                        {#if isCurrentUserInGame()}
                                                <div class="card p-4 h-96">
                                                        <h2 class="h2 mb-4">Game Canvas</h2>
                                                        <p class="text-center p-16">
                                                                This is where the game canvas will be displayed.<br>
                                                                The game canvas is being developed separately.
                                                        </p>
                                                </div>
                                                
                                                <div class="card p-4 mt-4 h-64">
                                                        <ChatBox {gameId} chatType="group" />
                                                </div>
                                        {:else}
                                                <div class="card p-8 text-center">
                                                        <h2 class="h2 mb-4">Join to Participate</h2>
                                                        <p class="mb-4">You need to join this game to see the game content and participate.</p>
                                                        <button class="btn variant-filled-primary" on:click={handleJoinGame} disabled={isJoining}>
                                                                {isJoining ? 'Joining...' : 'Join Game'}
                                                        </button>
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
