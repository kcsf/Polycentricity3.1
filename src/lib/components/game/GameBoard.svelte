<script lang="ts">
    import { onMount } from 'svelte';
    import type { Game, Actor } from '$lib/types';
    import { getGame, subscribeToGame } from '$lib/services/gameService';
    
    export let gameId: string;
    
    let game: Game | null = null;
    let isLoading = true;
    let error = '';
    let unsubscribe: () => void;
    
    onMount(async () => {
        try {
            // Load game data
            game = await getGame(gameId);
            
            if (!game) {
                error = 'Game not found';
                return;
            }
            
            // Subscribe to game updates
            unsubscribe = subscribeToGame(gameId, (updatedGame) => {
                game = updatedGame;
            });
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
        <div class="bg-surface-100-800-token rounded-lg p-6 h-full">
            <h2 class="h2 mb-4">Game Board: {game.name}</h2>
            
            <!-- Add your game board visualization here -->
            <div class="game-visualization bg-surface-200-700-token rounded-lg p-4 h-4/5 flex items-center justify-center">
                <p class="text-lg text-center">
                    Game board visualization will be implemented here.<br>
                    This is where players will see the eco-village simulation.
                </p>
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