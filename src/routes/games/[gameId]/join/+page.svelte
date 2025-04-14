<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { getGame, isGameFull, joinGame, getUserActors, assignRole } from '$lib/services/gameService';
    import { userStore } from '$lib/stores/userStore';
    import { activeActorId } from '$lib/stores/enhancedGameStore'; 
    import ActorSelector from '$lib/components/game/ActorSelector.svelte';
    import type { Game, Actor } from '$lib/types';
    import * as icons from 'svelte-lucide';
    import { GameStatus } from '$lib/types';
    
    const gameId = $page.params.gameId;
    
    let game: Game | null = null;
    let isLoading = true;
    let errorMessage = '';
    let isFull = false;
    let actorSelected = false;
    let selectedActor: Actor | null = null;
    
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
                    // Redirect back to game page
                    goto(`/games/${gameId}`);
                    return;
                } else {
                    console.log(`No actor found for game ${gameId}`);
                }
            }
            
            // Check if user is already in the game
            const playersObj = game.players as Record<string, boolean>;
            if (playersObj && $userStore.user && playersObj[$userStore.user.user_id]) {
                // User is already in the game, redirect to game page
                goto(`/games/${gameId}`);
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
            
            console.log(`Selected actor: ${actor.actor_id} for game ${gameId}`);
            selectedActor = actor;
            actorSelected = true;
            
            // Step 1: First join the game itself to add the player to the players array
            console.log('Joining game...');
            const joinResult = await joinGame(gameId);
            console.log(`Join result: ${joinResult}`);
            
            if (!joinResult) {
                errorMessage = 'Failed to join the game';
                return;
            }
            
            // Step 2: Assign the selected actor to the user in this game
            console.log(`Assigning actor ${actor.actor_id} to user ${$userStore.user.user_id} in game ${gameId}`);
            const roleAssigned = await assignRole(gameId, $userStore.user.user_id, actor.actor_id);
            
            if (!roleAssigned) {
                errorMessage = 'Failed to assign role';
                return;
            }
            
            // Step 3: Set the selected actor in localStorage for persistence
            localStorage.setItem(`game_${gameId}_actor`, actor.actor_id);
            
            // Step 4: Update the active actor ID in the store
            console.log(`Setting active actor in store: ${actor.actor_id}`);
            activeActorId.set(actor.actor_id);
            
            // Now we can redirect straight to the game page - no need for a second click
            console.log(`Actor selected and role assigned - redirecting to game page`);
            goto(`/games/${gameId}`);
        } catch (err) {
            console.error('Error during actor selection:', err);
            errorMessage = 'Failed to process actor selection';
        }
    }
    
    function goBack() {
        goto('/games');
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
            <button class="btn variant-ghost-surface" on:click={goBack}>
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
            <button class="btn variant-filled-primary" on:click={goBack}>
                <icons.ArrowLeft size={20} class="mr-2" />
                Back to Games
            </button>
        </div>
    {:else if isFull}
        <div class="card p-8 text-center bg-surface-100-800-token">
            <icons.UserX size={40} class="mx-auto mb-4 text-error-500" />
            <h2 class="h2 mb-2">Game is Full</h2>
            <p class="mb-4">This game has reached its maximum player capacity.</p>
            <button class="btn variant-filled-primary" on:click={goBack}>
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