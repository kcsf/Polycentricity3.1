<script lang="ts">
    import { goto } from '$app/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { getAllGames, subscribeToGame } from '$lib/services/gameService';
    import type { Game } from '$lib/types';
    import GameCard from '$lib/components/GameCard.svelte';
    import * as icons from '@lucide/svelte';

    // State variables using $state
    let allGames = $state<Game[]>([]);
    let isLoading = $state(true);
    let error = $state('');
    let lastRefreshed = $state(new Date());
    let backgroundMessage = $state('');

    // Load games and subscribe to updates using $effect
    $effect(() => {
        // Temporarily disabled authentication check for development
        // if (!$userStore.user) {
        //     goto('/login');
        //     return;
        // }

        // Initial load
        const loadGames = async () => {
            try {
                isLoading = true;
                error = '';
                lastRefreshed = new Date();
                const games = await getAllGames();
                allGames = games;
                console.log(`Retrieved ${games.length} games`);
            } catch (err) {
                console.error('Error fetching games:', err);
                error = `Failed to load games: ${err.message || 'Unknown error'}. Please try again.`;
            } finally {
                isLoading = false;
            }
        };

        loadGames();

        // Subscribe to real-time game updates
        const unsubscribe = subscribeToGame('games', (gameData: Game) => {
            if (gameData) {
                const existingIndex = allGames.findIndex(g => g.game_id === gameData.game_id);
                if (existingIndex >= 0) {
                    allGames[existingIndex] = gameData;
                    allGames = [...allGames]; // Trigger reactivity
                } else {
                    allGames = [...allGames, gameData];
                }
            }
        });

        // Check for background game creation
        const backgroundCreating = localStorage.getItem('game_creating_background');
        if (backgroundCreating === 'true') {
            localStorage.removeItem('game_creating_background');
            backgroundMessage = 'Your game is being created in the background and should appear soon. If you don\'t see it, click the Refresh Games button.';
        }

        // Cleanup subscription on unmount
        return () => unsubscribe();
    });

    function refreshGames() {
        // Trigger a manual refresh by resetting lastRefreshed
        lastRefreshed = new Date();
        isLoading = true;
        error = '';
        getAllGames()
            .then(games => {
                allGames = games;
                console.log(`Refreshed ${games.length} games`);
            })
            .catch(err => {
                console.error('Error refreshing games:', err);
                error = `Failed to refresh games: ${err.message || 'Unknown error'}. Please try again.`;
            })
            .finally(() => {
                isLoading = false;
            });
    }
</script>

<div class="container mx-auto p-6 space-y-6">
    <!-- Header Section -->
    <div class="card bg-gradient-to-r from-primary-900/30 to-tertiary-900/30 p-6 rounded-lg shadow-xl">
        <div class="flex justify-between items-center">
            <div>
                <h1 class="h1 text-primary-400 mb-2">Available Games</h1>
                <p class="text-surface-300">Choose an existing game to join or create a new one</p>
            </div>
            <a href="/games/create" class="btn variant-filled-primary">
                <span class="text-lg mr-2">+</span> Create Game
            </a>
        </div>
    </div>

    <!-- Refresh Controls -->
    <div class="flex justify-between items-center">
        <div class="text-sm text-surface-500">
            {#if !isLoading}
                Last refreshed: {lastRefreshed.toLocaleTimeString()}
            {/if}
        </div>
        <button 
            class="btn variant-soft-primary" 
            onclick={refreshGames} 
            disabled={isLoading}
        >
            <icons.RefreshCcw size={18} class={isLoading ? 'animate-spin' : ''} />
            <span class="ml-2">{isLoading ? 'Refreshing...' : 'Refresh Games'}</span>
        </button>
    </div>

    {#if backgroundMessage}
        <div class="alert variant-filled-secondary p-4">
            <div class="flex items-center">
                <span class="mr-2">ℹ️</span>
                <p>{backgroundMessage}</p>
            </div>
        </div>
    {/if}

    {#if isLoading}
        <div class="card p-8 text-center bg-surface-100-800-token">
            <div class="flex justify-center items-center h-32">
                <span class="loading loading-spinner loading-lg text-primary-500 mr-4"></span>
                <p class="text-lg">Loading games...</p>
            </div>
        </div>
    {:else if error}
        <div class="alert variant-filled-error p-4">
            <div class="flex items-center">
                <icons.AlertCircle size={20} class="mr-2" />
                <p>{error}</p>
            </div>
            <div class="mt-2">
                <button class="btn btn-sm variant-filled" onclick={refreshGames}>Try Again</button>
            </div>
        </div>
    {:else if allGames.length === 0}
        <div class="card p-10 text-center bg-surface-100-800-token border border-surface-200 dark:border-surface-700">
            <div class="flex flex-col items-center justify-center py-12">
                <div class="text-5xl text-primary-400 mb-4">🎮</div>
                <h2 class="h2 mb-2">No Games Available</h2>
                <p class="mb-6 text-surface-600 dark:text-surface-400">Be the first one to create a game and invite others to play!</p>
                <div class="flex space-x-4">
                    <a href="/games/create" class="btn variant-filled-primary">
                        <span class="mr-2">+</span> Create the First Game
                    </a>
                    <button class="btn variant-soft" onclick={refreshGames}>
                        <icons.RefreshCcw size={16} />
                        <span class="ml-2">Refresh</span>
                    </button>
                </div>
            </div>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each allGames as game (game.game_id)}
                <GameCard {game} />
            {/each}
        </div>
    {/if}
</div>