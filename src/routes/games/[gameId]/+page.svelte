<script lang="ts">
    export const prerender = false;
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

    // Check if gameContext has essential data loaded
    function hasCompleteData(gameContext: GameContext): boolean {
        if (!gameContext) return false;
        
        // Basic requirement: we need the game and actors array
        const hasBasicData = gameContext.game && gameContext.actors && gameContext.actors.length > 0;
        
        // At least some actors should have their card data
        const hasActorCards = gameContext.actors?.some(actor => 
            actor.card && actor.card.card_id
        );
        
        return hasBasicData && hasActorCards;
    }

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
            
            // No more mock player roles - we only use authentic data
            
        } catch (err) {
            console.error('[GamePage] Error loading game:', err);
            error = err instanceof Error ? err.message : 'Failed to load game';
        } finally {
            isLoading = false;
        }
    }

    // Subscribe to game updates
    //let unsubscribe = $state<(() => void) | null>(null);
    
    //$effect(() => {
    //if (gameId) {
            // Subscribe to real-time game updates
    //unsubscribe = subscribeToGame(gameId, (updatedGame) => {
    //if (updatedGame) {
    //console.log(`[GamePage] Received game update for ${gameId}`);
    //game = updatedGame;
    //}
    //});
    //}
        
        // Cleanup subscription on unmount
//        return () => {
    //if (unsubscribe) unsubscribe();
    //};
    //});

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
            <div class="alert bg-error-500 text-on-error-token w-1/2 p-4 mb-4">
                <icons.AlertCircle size={24} class="mr-2" />
                <p>{error}</p>
            </div>
            <div class="flex gap-4 mt-4">
                <button class="btn bg-primary-500 text-on-primary-token" onclick={() => loadGameData()}>
                    <icons.RefreshCcw size={18} class="mr-2" />
                    Try Again
                </button>
                <a href="/games" class="btn preset-ghost">
                    <icons.ArrowLeft size={18} class="mr-2" />
                    Back to Games
                </a>
            </div>
        </div>
    {:else if game && playerRole && gameContext && hasCompleteData(gameContext)}
        <!-- Game Page Content with Layout -->
        <GamePageLayout {game} {gameId} {playerRole} {gameContext} actors={gameContext.actors} />
    {:else if game}
        <!-- Game Page Content -->
        <div class="game-page-layout relative flex flex-col overflow-hidden bg-surface-100-800" style="height: calc(100vh - var(--app-bar-height, 64px))">
            <!-- Top Navigation Bar -->
            <div class="bg-surface-100-800 border-b border-surface-300 p-3 shadow-sm flex justify-between">
                <div class="flex items-center">
                    <a href="/games" class="btn btn-sm preset-ghost-surface">
                        <icons.ArrowLeft size={16} class="mr-2" />
                        Back to Games
                    </a>
                    <h1 class="ml-4 text-xl font-bold truncate">{game.name}</h1>
                    {#if game.status}
                        <span class="badge ml-2 bg-primary-500 text-on-primary-token">{game.status}</span>
                    {/if}
                </div>
                <div class="flex gap-2">
                    {#if !playerRole}
                        <button 
                            class="btn btn-sm bg-primary-500 text-on-primary-token" 
                            onclick={goToDetails}
                        >
                            <icons.UserPlus size={16} class="mr-2" />
                            Join Game
                        </button>
                    {/if}
                    <button 
                        class="btn btn-sm preset-ghost-surface"
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
            <div class="alert bg-warning-500 text-on-warning-token w-1/2 p-4 mb-4">
                <icons.AlertTriangle size={24} class="mr-2" />
                <p>Game not found. The game may have been deleted or you may not have permission to view it.</p>
            </div>
            <a href="/games" class="btn bg-primary-500 text-on-primary-token mt-4">
                <icons.ArrowLeft size={18} class="mr-2" />
                Back to Games
            </a>
        </div>
    {/if}
</div>