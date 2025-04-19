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
    import * as icons from 'lucide-svelte';
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
    
    async function handleActorSelection(actor: Actor) {
        try {
            if (!$userStore.user) {
                errorMessage = 'You must be logged in to join a game';
                return;
            }
            
            console.log(`[JoinPage] Selected actor: ${actor.actor_id} for game ${gameId}`);
            selectedActor = actor;
            actorSelected = true;
            
            // Define reusable retry logic for critical operations
            const maxAttempts = 3;
            const backoffMs = [500, 1000, 2000]; // Exponential backoff
            
            // Helper function for retry logic
            async function executeWithRetry<T>(
                operation: () => Promise<T>,
                description: string,
                validateResult: (result: T) => boolean = (r) => !!r
            ): Promise<{success: boolean, result?: T}> {
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    console.log(`[JoinPage] ${description}... (attempt ${attempt}/${maxAttempts})`);
                    
                    try {
                        const result = await operation();
                        const isValid = validateResult(result);
                        
                        console.log(`[JoinPage] ${description} result:`, result, `valid:`, isValid);
                        
                        if (isValid) {
                            return { success: true, result };
                        }
                    } catch (error) {
                        console.error(`[JoinPage] Error during ${description} (attempt ${attempt}):`, error);
                    }
                    
                    if (attempt < maxAttempts) {
                        console.log(`[JoinPage] ${description} failed or returned invalid result, retrying in ${backoffMs[attempt-1]}ms`);
                        await new Promise(resolve => setTimeout(resolve, backoffMs[attempt-1]));
                    }
                }
                
                console.error(`[JoinPage] ${description} failed after ${maxAttempts} attempts`);
                return { success: false };
            }
            
            // Step 1: First join the game itself to add the player to the players array
            const joinOperation = async () => joinGame(gameId);
            const joinResult = await executeWithRetry(joinOperation, "Joining game");
            
            if (!joinResult.success) {
                errorMessage = 'Failed to join the game after multiple attempts';
                return;
            }
            
            // Step 2: Assign the selected actor to the user in this game
            // This critical operation updates the player_actor_map
            console.log(`[JoinPage] Assigning actor ${actor.actor_id} to user ${$userStore.user.user_id} in game ${gameId}`);
            
            const assignOperation = async () => assignRole(gameId, $userStore.user.user_id, actor.actor_id);
            const assignResult = await executeWithRetry(assignOperation, "Assigning role");
            
            if (!assignResult.success) {
                errorMessage = 'Failed to assign role after multiple attempts';
                return;
            }
            
            // Step 3: Set the selected actor in localStorage for persistence
            localStorage.setItem(`game_${gameId}_actor`, actor.actor_id);
            
            // Step 4: Update the active actor ID in the store
            console.log(`[JoinPage] Setting active actor in store: ${actor.actor_id}`);
            activeActorId.set(actor.actor_id);
            
            // Step 5: Update player_actor_map using the optimized service function
            // This is a fire-and-forget operation that handles caching and background verification
            try {
                console.log(`[JoinPage] Updating player_actor_map with optimized function: user ${$userStore.user.user_id} -> actor ${actor.actor_id}`);
                updatePlayerActorMap(gameId, $userStore.user.user_id, actor.actor_id);
            } catch (mapErr) {
                // Non-fatal error - the assignRole function should have handled this already
                console.warn('[JoinPage] Backup player_actor_map update failed:', mapErr);
            }
            
            // Step 6: Double-check that the player_actor_map was updated
            const verifyMapOperation = async () => {
                const game = await getGame(gameId);
                if (!game) return false;
                
                if (!game.player_actor_map) {
                    console.warn('[JoinPage] Game has no player_actor_map property, will try to create it');
                    return false;
                }
                
                // The map may be a Gun.js reference or a regular object
                const isReference = typeof game.player_actor_map === 'object' && game.player_actor_map['#'];
                
                if (isReference) {
                    console.log('[JoinPage] player_actor_map is a Gun.js reference:', game.player_actor_map);
                    return true; // We'll resolve it later in the game page
                }
                
                // Check if our mapping is in the object
                if (game.player_actor_map[$userStore.user.user_id] === actor.actor_id) {
                    console.log(`[JoinPage] ✅ player_actor_map correctly set for user ${$userStore.user.user_id} -> actor ${actor.actor_id}`);
                    return true;
                }
                
                console.warn(`[JoinPage] ⚠️ player_actor_map doesn't have our mapping yet:`, game.player_actor_map);
                return false;
            };
            
            await executeWithRetry(verifyMapOperation, "Verifying player_actor_map");
            
            // Even if verification failed, we proceed with the redirect
            // The game page has recovery mechanisms for missing player_actor_map entries
            
            // Now redirect to the game page
            console.log(`[JoinPage] Actor selected and role assigned - redirecting to game page: /games/${gameId}`);
            // Set actorSelected to true for better UI feedback
            actorSelected = true;
            
            // Skip all async operations and redirect immediately
            console.log(`[JoinPage] Redirecting immediately to game page: /games/${gameId}`);
            window.location.href = `/games/${gameId}`;
            
            // No await/catch needed since we're using direct location change
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