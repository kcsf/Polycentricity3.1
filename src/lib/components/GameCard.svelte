<script lang="ts">
        import type { Game } from '$lib/types';
        import { GameStatus } from '$lib/types';
        import { goto } from '$app/navigation';
        import { formatDateTime } from '$lib/utils/helpers';
        
        export let game: Game;
        
        function getStatusBadgeVariant(status: GameStatus): string {
                switch (status) {
                        case GameStatus.CREATED:
                                return 'variant-soft-primary';
                        case GameStatus.SETUP:
                                return 'variant-soft-warning';
                        case GameStatus.ACTIVE:
                                return 'variant-soft-success';
                        case GameStatus.PAUSED:
                                return 'variant-soft-tertiary';
                        case GameStatus.COMPLETED:
                                return 'variant-soft-surface';
                        default:
                                return 'variant-soft-primary';
                }
        }
        
        function enterGame() {
                goto(`/games/${game.game_id}`);
        }
</script>

<div class="card p-4 shadow-lg hover:shadow-xl transition-all duration-200 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
        <header class="card-header mb-2">
                <h3 class="h3 text-primary-500 dark:text-primary-400">{game.name}</h3>
                <div class="badge {getStatusBadgeVariant(game.status)} text-sm font-medium">
                        {game.status}
                </div>
        </header>
        <section class="p-4 bg-surface-100-800-token rounded-lg">
                <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col">
                                <p class="text-sm font-semibold text-tertiary-500 dark:text-tertiary-400">Players:</p>
                                {#if Array.isArray(game.players)}
                                    <p class="text-sm text-surface-900 dark:text-surface-50">{game.players.length} joined</p>
                                {:else}
                                    <p class="text-sm text-surface-900 dark:text-surface-50">{Object.keys(game.players || {}).length} joined</p>
                                {/if}
                        </div>
                        <div class="flex flex-col">
                                <p class="text-sm font-semibold text-tertiary-500 dark:text-tertiary-400">Deck Type:</p>
                                <p class="text-sm text-surface-900 dark:text-surface-50 capitalize">{game.deck_type}</p>
                        </div>
                        <div class="flex flex-col col-span-2">
                                <p class="text-sm font-semibold text-tertiary-500 dark:text-tertiary-400">Created:</p>
                                <p class="text-sm text-surface-900 dark:text-surface-50">{formatDateTime(game.created_at)}</p>
                        </div>
                </div>
        </section>
        <footer class="card-footer flex justify-end mt-3">
                <button class="btn variant-filled-primary" on:click={enterGame}>
                        Enter Game
                </button>
        </footer>
</div>
