<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { userStore } from '$lib/stores/userStore';
    import { 
        getGameContext, 
        subscribeToGame
    } from '$lib/services/gameService';
    import type { Game, ActorWithCard, GameContext } from '$lib/types';
    import * as icons from '@lucide/svelte';
    import D3CardBoard from '$lib/components/game/D3CardBoard.svelte';
    import GamePageLayout from './GamePageLayout.svelte';

    // Get gameId from URL parameters
    const gameId = $page.params.gameId;
    
    // State variables using Svelte 5 $state
    let isLoading = $state(true);
    let error = $state('');
    let game = $state<Game | null>(null);
    let playerRole = $state<ActorWithCard | null>(null);
    let gameContext = $state<GameContext | null>(null);

    // Load game data using gameContext
    $effect(() => {
        loadGameData();
    });

    async function loadGameData() {
        console.log(`[GamePage] Loading game data for ${gameId}`);
        try {
            isLoading = true;
            error = '';
            
            // Use getGameContext to efficiently load all game data
            gameContext = await getGameContext(gameId);
            
            if (!gameContext) {
                throw new Error(`Failed to load game context for game ${gameId}`);
            }
            
            game = gameContext.game;
            console.log(`[GamePage] Loaded game: ${game.name}`);
            
            // Find player role if user is logged in
            if ($userStore.user) {
                const userId = $userStore.user.user_id;
                
                // Try to find an actor for this user
                if (gameContext.actors) {
                    const userActor = gameContext.actors.find(actor => actor.user_ref === userId);
                    if (userActor) {
                        playerRole = userActor;
                        console.log(`[GamePage] Found player role: ${playerRole.actor_id}`);
                    }
                }
            }
            
            // For demo/testing purposes - create a mock player role if none exists
            // This ensures sidebars work correctly in development
            if (!playerRole && gameContext.actors && gameContext.actors.length > 0) {
                // Use the first actor as a mock player role for demonstration
                playerRole = gameContext.actors[0];
                console.log(`[GamePage] Using mock player role for demo: ${playerRole.actor_id}`);
            }
            
        } catch (err) {
            console.error('[GamePage] Error loading game:', err);
            error = err instanceof Error ? err.message : 'Failed to load game';
        } finally {
            isLoading = false;
        }
    }

    // Subscribe to game updates
    let unsubscribe = $state<(() => void) | null>(null);
    
    $effect(() => {
        if (gameId) {
            // Subscribe to real-time game updates
            unsubscribe = subscribeToGame(gameId, (updatedGame) => {
                if (updatedGame) {
                    console.log(`[GamePage] Received game update for ${gameId}`);
                    game = updatedGame;
                }
            });
        }
        
        // Cleanup subscription on unmount
        return () => {
            if (unsubscribe) unsubscribe();
        };
    });

    function goToDetails() {
        goto(`/games/${gameId}/details`);
    }
</script>

<div class="w-full h-full flex flex-col">
    {#if isLoading}
        <div class="flex flex-col items-center justify-center h-full">
            <div class="loading loading-spinner loading-lg text-primary-500"></div>
            <p class="mt-4">Loading game...</p>
        </div>
    {:else if error}
        <div class="flex flex-col items-center justify-center h-full">
            <div class="alert variant-filled-error w-1/2 p-4 mb-4">
                <icons.AlertCircle size={24} class="mr-2" />
                <p>{error}</p>
            </div>
            <div class="flex gap-4 mt-4">
                <button class="btn variant-filled-primary" onclick={() => loadGameData()}>
                    <icons.RefreshCcw size={18} class="mr-2" />
                    Try Again
                </button>
                <a href="/games" class="btn variant-ghost">
                    <icons.ArrowLeft size={18} class="mr-2" />
                    Back to Games
                </a>
            </div>
        </div>
    {:else if game && playerRole}
        <!-- Game Page Content with Layout -->
        <GamePageLayout {game} {gameId} {playerRole} />
    {:else if game}
        <!-- Game Page Content -->
        <div class="game-page-layout relative flex flex-col overflow-hidden bg-surface-100-800" style="height: calc(100vh - var(--app-bar-height, 64px))">
            <!-- Top Navigation Bar -->
            <div class="bg-surface-100-800 border-b border-surface-300 p-3 shadow-sm flex justify-between">
                <div class="flex items-center">
                    <a href="/games" class="btn btn-sm variant-ghost-surface">
                        <icons.ArrowLeft size={16} class="mr-2" />
                        Back to Games
                    </a>
                    <h1 class="ml-4 text-xl font-bold truncate">{game.name}</h1>
                    {#if game.status}
                        <span class="badge ml-2 variant-filled-primary">{game.status}</span>
                    {/if}
                </div>
                <div class="flex gap-2">
                    {#if !playerRole}
                        <button 
                            class="btn btn-sm variant-filled-primary" 
                            onclick={goToDetails}
                        >
                            <icons.UserPlus size={16} class="mr-2" />
                            Join Game
                        </button>
                    {/if}
                    <button 
                        class="btn btn-sm variant-ghost-surface"
                        onclick={goToDetails}
                    >
                        <icons.Info size={16} class="mr-2" />
                        Game Details
                    </button>
                </div>
            </div>
            
            <!-- Main Game Board Section without Layout -->
            <div class="flex-1 flex-grow relative overflow-hidden">
                {#if gameContext}
                    <D3CardBoard {gameId} activeActorId={playerRole?.actor_id} />
                {/if}
            </div>
        </div>
    {:else}
        <div class="flex flex-col items-center justify-center h-full">
            <div class="alert variant-filled-warning w-1/2 p-4 mb-4">
                <icons.AlertTriangle size={24} class="mr-2" />
                <p>Game not found. The game may have been deleted or you may not have permission to view it.</p>
            </div>
            <a href="/games" class="btn variant-filled-primary mt-4">
                <icons.ArrowLeft size={18} class="mr-2" />
                Back to Games
            </a>
        </div>
    {/if}
</div>