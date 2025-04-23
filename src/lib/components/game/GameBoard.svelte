<script lang="ts">
    import { onMount } from 'svelte';
    import type { Game, Actor } from '$lib/types';
    import { getGame, subscribeToGame } from '$lib/services/gameService';
    import { currentGameStore } from '$lib/stores/gameStore';
    import D3GameBoardIntegrated from './D3GameBoardIntegrated.svelte';
    
    // Use Svelte 5 Runes for props
    const { gameId, activeActorId = undefined } = $props<{ 
        gameId: string;
        activeActorId?: string | null;
    }>();
    
    // Local state with Svelte 5 Runes
    let game = $state<Game | null>(null);
    let isLoading = $state(true);
    let error = $state('');
    let unsubscribe = $state<(() => void) | undefined>(undefined);
    
    onMount(async () => {
        try {
            // Load game data
            game = await getGame(gameId);
            
            if (!game) {
                error = 'Game not found';
                return;
            }
            
            // Store game in the central store
            currentGameStore.set(game);
            
            // Subscribe to game updates
            unsubscribe = subscribeToGame(gameId, (updatedGame) => {
                if (updatedGame) {
                    game = updatedGame;
                    currentGameStore.set(updatedGame);
                }
            });
            
            // Log the active actor for debugging
            if (activeActorId) {
                console.log(`Active actor in game board: ${activeActorId}`);
            }
        } catch (err) {
            console.error('Error loading game board:', err);
            error = 'Failed to load game data';
        } finally {
            isLoading = false;
        }
        
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    });
</script>

<div class="game-board w-full h-full">
    {#if isLoading}
        <div class="flex justify-center items-center h-full">
            <div class="spinner-third w-8 h-8"></div>
            <p class="ml-4">Loading game board...</p>
        </div>
    {:else if error}
        <div class="alert variant-filled-error p-4">
            <p>{error}</p>
        </div>
    {:else if game}
        <div class="bg-surface-100-800-token h-full flex flex-col">
            <!-- D3 Game Board Visualization -->
            <div class="flex-grow overflow-hidden">
                <D3GameBoardIntegrated 
                    {gameId} 
                    activeActorId={activeActorId}
                />
            </div>
        </div>
    {:else}
        <div class="alert variant-filled-warning p-4">
            <p>Game data could not be loaded.</p>
        </div>
    {/if}
</div>

<style>
    .game-board {
        min-height: 400px;
    }
</style>