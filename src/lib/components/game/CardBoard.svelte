<script lang="ts">
    import { onMount } from 'svelte';
    import type { Game, Actor } from '$lib/types';
    import { getGame, subscribeToGame } from '$lib/services/gameService';
    import D3CardBoard from './D3CardBoard.svelte';
    import GameHeader from './GameHeader.svelte';
    import gameStore from '$lib/stores/enhancedGameStore';
    
    export let gameId: string;
    export let activeActorId: string | undefined = undefined;
    
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
            
            // Initialize the active actor in the store if it's provided
            if (activeActorId) {
                console.log(`Setting active actor in card board: ${activeActorId}`);
                gameStore.setActiveActorId(activeActorId);
            }
        } catch (err) {
            console.error('Error loading card board:', err);
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

<div class="card-board w-full h-full">
    {#if isLoading}
        <div class="flex justify-center items-center h-full">
            <div class="spinner-third w-8 h-8"></div>
            <p class="ml-4">Loading card board...</p>
        </div>
    {:else if error}
        <div class="alert variant-filled-error p-4">
            <p>{error}</p>
        </div>
    {:else if game}
        <div class="bg-surface-100-800-token rounded-lg p-4 h-full flex flex-col">
            <GameHeader {game} />
            
            <!-- D3 Card Board Visualization -->
            <div class="flex-grow overflow-hidden">
                <D3CardBoard 
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