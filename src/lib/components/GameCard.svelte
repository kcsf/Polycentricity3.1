<script lang="ts">
        import type { Game } from '$lib/types';
        import { GameStatus } from '$lib/types';
        import { goto } from '$app/navigation';
        import { formatDateTime } from '$lib/utils/helpers';
        import { userStore } from '$lib/stores/userStore';
        import * as icons from 'svelte-lucide';
        import { joinGame } from '$lib/services/gameService';
        
        export let game: Game;
        
        let isJoining = false;
        let joinError = '';
        
        // Computed properties for game state
        $: playerCount = Object.keys(game.players || {}).length;
        $: isFull = game.max_players && playerCount >= game.max_players;
        $: isUserInGame = $userStore.user && game.players && $userStore.user.user_id in game.players;
        $: canJoin = !isUserInGame && !isFull && game.status === GameStatus.ACTIVE;
        
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
        
        async function handleJoinGame() {
                if (!$userStore.user) {
                        goto('/login');
                        return;
                }
                
                try {
                        isJoining = true;
                        joinError = '';
                        
                        // Direct to game join page instead of directly joining
                        // This will allow for actor selection/creation
                        goto(`/games/${game.game_id}/join`);
                } catch (err) {
                        console.error('Error joining game:', err);
                        joinError = 'Failed to join game. Please try again.';
                } finally {
                        isJoining = false;
                }
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
                                <div class="flex items-center">
                                        <p class="text-sm text-surface-900 dark:text-surface-50">
                                                {playerCount} {game.max_players ? `/ ${game.max_players}` : ''}
                                        </p>
                                        {#if isFull}
                                                <div class="badge variant-filled-warning text-xs ml-2">Full</div>
                                        {/if}
                                </div>
                        </div>
                        <div class="flex flex-col">
                                <p class="text-sm font-semibold text-tertiary-500 dark:text-tertiary-400">Deck Type:</p>
                                <p class="text-sm text-surface-900 dark:text-surface-50 capitalize">{game.deck_type}</p>
                        </div>
                        <div class="flex flex-col">
                                <p class="text-sm font-semibold text-tertiary-500 dark:text-tertiary-400">Role Assignment:</p>
                                <p class="text-sm text-surface-900 dark:text-surface-50 capitalize">{game.role_assignment || 'random'}</p>
                        </div>
                        <div class="flex flex-col">
                                <p class="text-sm font-semibold text-tertiary-500 dark:text-tertiary-400">Created:</p>
                                <p class="text-sm text-surface-900 dark:text-surface-50">{formatDateTime(game.created_at)}</p>
                        </div>
                        {#if game.description}
                                <div class="flex flex-col col-span-2 mt-2">
                                        <p class="text-sm text-surface-900 dark:text-surface-50">{game.description}</p>
                                </div>
                        {/if}
                </div>
        </section>
        <footer class="card-footer flex justify-end mt-3 space-x-2">
                {#if isUserInGame}
                        <button class="btn variant-filled-primary" on:click={enterGame}>
                                <span class="mr-2">
                                        <icons.LogIn size={18} />
                                </span>
                                Continue Game
                        </button>
                {:else if game.status === GameStatus.ACTIVE}
                        <button 
                                class="btn variant-filled-success" 
                                on:click={handleJoinGame} 
                                disabled={isJoining || isFull}
                        >
                                {#if isJoining}
                                        <span class="spinner-third w-4 h-4 mr-2"></span>
                                        Joining...
                                {:else}
                                        <span class="mr-2">
                                                <icons.UserPlus size={18} />
                                        </span>
                                        Join Game
                                {/if}
                        </button>
                {/if}
                
                <button class="btn variant-ghost-primary" on:click={enterGame}>
                        <span class="mr-2">
                                <icons.Info size={18} />
                        </span>
                        Details
                </button>
        </footer>
        
        {#if joinError}
                <div class="mt-2 text-error-500 text-sm">{joinError}</div>
        {/if}
</div>
