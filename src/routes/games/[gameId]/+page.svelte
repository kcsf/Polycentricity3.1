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

    const gameId = $page.params.gameId;

    let isLoading   = $state(true);
    let error       = $state('');
    let game        = $state<Game | null>(null);
    let playerRole  = $state<ActorWithCard | null>(null);
    let gameContext = $state<GameContext | null>(null);

    function hasCompleteData(ctx: GameContext): boolean {
        return !!ctx.game
            && ctx.actors?.length > 0
            && ctx.actors.some(a => a.card?.card_id);
    }

    async function loadGameData() {
        console.log(`[GamePage] Loading game data for ${gameId}`);
        try {
            isLoading = true;
            error     = '';
            const ctx = await getGameContext(gameId);
            if (!ctx) throw new Error(`Failed to load context for ${gameId}`);
            gameContext = ctx;
            game        = ctx.game;

            if ($userStore.user && ctx.actors) {
                const uid = $userStore.user.user_id;
                const actor = ctx.actors.find(a => a.user_ref === uid);
                if (actor) playerRole = actor;
            }
        } catch (err: any) {
            console.error('[GamePage] Error loading game:', err);
            error = err.message || 'Failed to load game';
        } finally {
            isLoading = false;
        }
    }

    // 1) Prime Gun (no-op subscribe) then bulk-load context
    $effect(() => {
        const unsubscribePrime = subscribeToGame(
            gameId,
            (updatedGame: Game) => {
                game = updatedGame;
            }
        );
        const timer = setTimeout(loadGameData, 100);

        return () => {
            clearTimeout(timer);
            unsubscribePrime();
        };
    });

    // 2) Subscribe to Game changes
    $effect(() => {
        if (!gameContext) return;
        
        const unsubscribe = subscribeToGame(
            gameId,
            async (updatedGame: Game) => {
                console.log('[GamePage] Game updated, refreshing context');
                game = updatedGame;
                
                // Re-fetch full context to get latest agreements
                try {
                    const freshContext = await getGameContext(gameId);
                    if (freshContext) {
                        gameContext = freshContext;
                        console.log(`[GamePage] Setting gameContext with ${freshContext.agreements.length} agreements`);
                    }
                } catch (err) {
                    console.error('[GamePage] Error refreshing context:', err);
                }
            }
        );
        return () => unsubscribe();
    });

    // 3) Subscribe to agreements changes using gameService subscription
    $effect(() => {
        if (!gameContext) return;
        
        // Use a simple timer to periodically refresh context for agreement changes
        const intervalId = setInterval(async () => {
            try {
                const freshContext = await getGameContext(gameId);
                if (freshContext && freshContext.agreements.length !== gameContext.agreements.length) {
                    console.log(`[GamePage] Detected agreement changes, refreshing context`);
                    gameContext = freshContext;
                }
            } catch (err) {
                console.error('[GamePage] Error refreshing context:', err);
            }
        }, 2000); // Check every 2 seconds
        
        return () => clearInterval(intervalId);
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
                <D3CardBoard {gameId} {gameContext} activeActorId={playerRole?.actor_id} />
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