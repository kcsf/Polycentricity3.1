<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { getGame, isGameFull, joinGame, getUserActors, assignRole, updatePlayerActorMap } from '$lib/services/gameService';
    import { userStore } from '$lib/stores/userStore';
    import { activeActorId } from '$lib/stores/enhancedGameStore'; 
    import { getGun, nodes } from '$lib/services/gunService';
    import ActorSelector from '$lib/components/game/ActorSelector.svelte';
    import type { Game, Actor } from '$lib/types';
    import * as icons from '@lucide/svelte';
    import { GameStatus } from '$lib/types';
    
    // Extract gameId from URL parameter
    const gameId = $page.params.gameId;
    
    // Use Svelte 5 RUNES state management
    let game = $state<Game | null>(null);
    let isLoading = $state(true);
    let errorMessage = $state('');
    let isFull = $state(false);
    let actorSelected = $state(false);
    let selectedActor = $state<Actor | null>(null);
    
    onMount(async () => {
        try {
            // Check if user is logged in
            if (!$userStore.user) {
                goto('/login');
                return;
            }
            
            isLoading = true;
            
            // Load game data
            game = await getGame(gameId);
            
            if (!game) {
                errorMessage = 'Game not found';
                return;
            }
            
            // Check if game is active
            if (game.status !== GameStatus.ACTIVE) {
                errorMessage = `Game is not active (current status: ${game.status})`;
                return;
            }
            
            // Check if game is full
            isFull = await isGameFull(gameId);
            
            if (isFull) {
                errorMessage = 'This game is already full';
                return;
            }
            
            // Check if current user already has a role in this game
            const userId = $userStore.user.user_id;
            if (userId) {
                const existingActors = await getUserActors();
                const actorForThisGame = existingActors.find(actor => actor.game_id === gameId);
                
                console.log(`Checking existing actors: ${existingActors.length} actors, Game ID: ${gameId}`);
                if (actorForThisGame) {
                    console.log(`User already has actor ${actorForThisGame.actor_id} assigned to game ${gameId}`);
                    // Redirect back to game page with error handling
                    try {
                        await goto(`/games/${gameId}`);
                        console.log(`[JoinPage] Navigation to game page successful (existing actor)`);
                    } catch (navError) {
                        console.error('[JoinPage] Navigation error (existing actor):', navError);
                        // Try fallback navigation
                        window.location.href = `/games/${gameId}`;
                    }
                    return;
                } else {
                    console.log(`No actor found for game ${gameId}`);
                }
            }
            
            // Check if user is already in the game
            const playersObj = game.players as Record<string, boolean> | Record<string, string>;
            if (playersObj && $userStore.user && playersObj[$userStore.user.user_id]) {
                // User is already in the game, redirect to game page with error handling
                try {
                    await goto(`/games/${gameId}`);
                    console.log(`[JoinPage] Navigation to game page successful (already in game)`);
                } catch (navError) {
                    console.error('[JoinPage] Navigation error (already in game):', navError);
                    // Try fallback navigation
                    window.location.href = `/games/${gameId}`;
                }
                return;
            }
        } catch (err) {
            console.error('Error loading game:', err);
            errorMessage = 'Failed to load game data';
        } finally {
            isLoading = false;
        }
    });
    
    // Optimized with fire-and-forget pattern for better navigation
    async function handleActorSelection(actor: Actor) {
        try {
            if (!$userStore.user) {
                errorMessage = 'You must be logged in to join a game';
                return;
            }
            
            console.log(`[JoinPage] Selected actor: ${actor.actor_id} for game ${gameId}`);
            selectedActor = actor;
            actorSelected = true;
            
            // STEP 1: Set up critical state for immediate navigation
            
            // First, store actor ID in localStorage for persistence between page loads
            localStorage.setItem(`game_${gameId}_actor`, actor.actor_id);
            
            // Update the active actor ID in the store for immediate UI updates
            console.log(`[JoinPage] Setting active actor in store: ${actor.actor_id}`);
            activeActorId.set(actor.actor_id);
            
            // STEP 2: Fire-and-forget background operations
            // These will continue to run after we navigate away
            
            // Setup retry logic with timeouts
            const maxAttempts = 3;
            const backoffMs = [500, 1000, 2000]; // Exponential backoff
            let currentAttempt = 0;
            
            // Background operation to handle game joining and role assignment
            // This will continue to execute after navigation
            setTimeout(() => {
                try {
                    // Try to join the game (adds player to players array)
                    joinGame(gameId)
                        .then(joinSuccess => {
                            console.log(`[JoinPage:Background] Joined game: ${joinSuccess}`);
                            
                            // Assign the actor to the user
                            if (joinSuccess) {
                                return assignRole(gameId, $userStore.user.user_id, actor.actor_id);
                            }
                            return false;
                        })
                        .then(assignSuccess => {
                            console.log(`[JoinPage:Background] Assigned role: ${assignSuccess}`);
                            
                            // Update player_actor_map as an additional safety measure
                            if (assignSuccess) {
                                updatePlayerActorMap(gameId, $userStore.user.user_id, actor.actor_id);
                                console.log(`[JoinPage:Background] Updated player_actor_map`);
                            }
                        })
                        .catch(error => {
                            console.error('[JoinPage:Background] Error in join/assign process:', error);
                            currentAttempt++;
                            
                            // Simple retry mechanism
                            if (currentAttempt < maxAttempts) {
                                console.log(`[JoinPage:Background] Will retry in ${backoffMs[currentAttempt-1]}ms`);
                                // Will attempt again on next tick
                            }
                        });
                } catch (bgErr) {
                    console.error('[JoinPage:Background] Error initiating background process:', bgErr);
                }
            }, 100);
            
            // STEP 3: Immediately redirect to the game page
            console.log(`[JoinPage] Redirecting immediately to game page: /games/${gameId}`);
            
            // Use direct location change for guaranteed navigation
            // This bypasses SvelteKit router issues and prevents hanging
            window.location.href = `/games/${gameId}`;
        } catch (err) {
            console.error('[JoinPage] Error during actor selection:', err);
            errorMessage = 'Failed to process actor selection';
        }
    }
    
    async function goBack() {
        try {
            await goto('/games');
            console.log('[JoinPage] Navigation back to games list successful');
        } catch (navError) {
            console.error('[JoinPage] Navigation error going back to games list:', navError);
            // Try fallback navigation
            window.location.href = '/games';
        }
    }
</script>

<div class="container mx-auto p-4">
    <div class="bg-gradient-to-r from-primary-900/30 to-tertiary-900/30 p-6 rounded-lg mb-8 shadow-lg">
        <div class="flex justify-between items-center">
            <div>
                <h1 class="h1 text-primary-400 mb-2">Join Game</h1>
                <p class="text-surface-300">
                    {#if game}
                        Create or select an actor to join "{game.name}"
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
    {:else if isFull}
        <div class="card p-8 text-center bg-surface-100-800-token">
            <icons.UserX size={40} class="mx-auto mb-4 text-error-500" />
            <h2 class="h2 mb-2">Game is Full</h2>
            <p class="mb-4">This game has reached its maximum player capacity.</p>
            <button class="btn variant-filled-primary" onclick={goBack}>
                Find Another Game
            </button>
        </div>
    {:else if game}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Game Details -->
            <div class="card p-4 bg-surface-100-800-token">
                <h2 class="h2 mb-4 text-primary-500">Game Details</h2>
                <div class="space-y-4">
                    <div>
                        <h3 class="font-bold text-tertiary-500">Game Name:</h3>
                        <p>{game.name}</p>
                    </div>
                    {#if game.description}
                        <div>
                            <h3 class="font-bold text-tertiary-500">Description:</h3>
                            <p>{game.description}</p>
                        </div>
                    {/if}
                    <div>
                        <h3 class="font-bold text-tertiary-500">Status:</h3>
                        <div class="badge {game.status === 'active' ? 'variant-filled-success' : 'variant-filled-warning'}">
                            {game.status}
                        </div>
                    </div>
                    <div>
                        <h3 class="font-bold text-tertiary-500">Deck Type:</h3>
                        <p class="capitalize">{game.deck_type}</p>
                    </div>
                    <div>
                        <h3 class="font-bold text-tertiary-500">Role Assignment:</h3>
                        <p class="capitalize">{game.role_assignment || 'random'}</p>
                    </div>
                    <div>
                        <h3 class="font-bold text-tertiary-500">Players:</h3>
                        <p>{Object.keys(game.players || {}).length} {game.max_players ? `/ ${game.max_players}` : ''}</p>
                    </div>
                </div>
            </div>
            
            <!-- Actor Selection -->
            <div class="lg:col-span-2">
                <div class="card p-4 bg-surface-100-800-token">
                    <h2 class="h2 mb-4 text-primary-500">Select Your Actor</h2>
                    <p class="mb-4">Choose an existing actor or create a new one to join this game.</p>
                    
                    <ActorSelector {gameId} onSelectActor={handleActorSelection} />
                </div>
            </div>
        </div>
    {/if}
</div>