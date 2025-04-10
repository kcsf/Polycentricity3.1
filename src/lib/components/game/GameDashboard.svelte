<script lang="ts">
    import type { Game } from '$lib/types';
    import { GameStatus } from '$lib/types';
    import { formatDateTime } from '$lib/utils/helpers';
    
    export let game: Game;
    
    // Utility function to get a appropriate color variant for game status
    function getStatusColor(status: GameStatus): string {
        switch (status) {
            case GameStatus.CREATED:
                return 'text-primary-500 dark:text-primary-400';
            case GameStatus.SETUP:
                return 'text-warning-500 dark:text-warning-400';
            case GameStatus.ACTIVE:
                return 'text-success-500 dark:text-success-400';
            case GameStatus.PAUSED:
                return 'text-tertiary-500 dark:text-tertiary-400';
            case GameStatus.COMPLETED:
                return 'text-surface-500 dark:text-surface-400';
            default:
                return 'text-primary-500 dark:text-primary-400';
        }
    }
    
    // Calculate game metrics
    $: playerCount = Array.isArray(game.players) 
        ? game.players.length 
        : Object.keys(game.players || {}).length;
    
    $: deckCount = game.deck 
        ? (Array.isArray(game.deck) 
            ? game.deck.length 
            : Object.keys(game.deck).length) 
        : 0;
    
    $: gameAge = Math.floor((Date.now() - game.created_at) / (1000 * 60 * 60 * 24)); // in days
</script>

<div class="game-dashboard">
    <div class="card p-4 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
        <h3 class="h3 mb-4 text-primary-500 dark:text-primary-400">Game Dashboard</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <!-- Game Status -->
            <div class="card p-4 bg-surface-100-800-token">
                <h4 class="font-semibold mb-1 text-tertiary-500 dark:text-tertiary-400">Status</h4>
                <p class="text-lg {getStatusColor(game.status)} capitalize">{game.status}</p>
            </div>
            
            <!-- Game Age -->
            <div class="card p-4 bg-surface-100-800-token">
                <h4 class="font-semibold mb-1 text-tertiary-500 dark:text-tertiary-400">Game Age</h4>
                <p class="text-lg">{gameAge} {gameAge === 1 ? 'day' : 'days'}</p>
                <p class="text-xs text-surface-600 dark:text-surface-400">Created: {formatDateTime(game.created_at)}</p>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Player Count -->
            <div class="card p-4 bg-surface-100-800-token">
                <h4 class="font-semibold mb-1 text-tertiary-500 dark:text-tertiary-400">Players</h4>
                <p class="text-2xl">{playerCount}</p>
            </div>
            
            <!-- Deck Type -->
            <div class="card p-4 bg-surface-100-800-token">
                <h4 class="font-semibold mb-1 text-tertiary-500 dark:text-tertiary-400">Deck Type</h4>
                <p class="text-md capitalize">{game.deck_type}</p>
            </div>
            
            <!-- Deck Size -->
            <div class="card p-4 bg-surface-100-800-token">
                <h4 class="font-semibold mb-1 text-tertiary-500 dark:text-tertiary-400">Deck Size</h4>
                <p class="text-2xl">{deckCount}</p>
            </div>
        </div>
    </div>
</div>