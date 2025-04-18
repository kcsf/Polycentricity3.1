<script lang="ts">
        import { onMount } from 'svelte';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import { getAllGames } from '$lib/services/gameService';
        import type { Game } from '$lib/types';
        import GameCard from '$lib/components/GameCard.svelte';
        import { RefreshCcw } from 'lucide-svelte';
        
        let allGames = $state<Game[]>([]);
        let isLoading = $state(true);
        let error = $state('');
        let lastRefreshed = $state(new Date());
        
        // Function to load games
        async function loadGames() {
                isLoading = true;
                error = '';
                
                try {
                        console.log('Fetching all games...');
                        const games = await getAllGames();
                        allGames = games;
                        console.log(`Retrieved ${games.length} games`);
                        lastRefreshed = new Date();
                } catch (err) {
                        console.error('Error fetching games:', err);
                        error = 'Failed to load games. Please try again.';
                } finally {
                        isLoading = false;
                }
        }
        
        // Status message for background operations
        let backgroundMessage = $state('');
        
        // Check for background game creation operation
        function checkBackgroundGameCreation() {
                const backgroundCreating = localStorage.getItem('game_creating_background');
                if (backgroundCreating === 'true') {
                        // Remove the flag
                        localStorage.removeItem('game_creating_background');
                        
                        // Show the user a notification that's helpful, not alarming
                        backgroundMessage = 'Your game is being created in the background and should appear soon. If you don\'t see it, click the Refresh Games button.';
                        
                        // Trigger a refresh after a delay to check for the new game
                        setTimeout(() => {
                                loadGames();
                        }, 5000);
                }
        }
        
        // Load games when component mounts
        onMount(() => {
                // Temporarily disabled authentication check for development
                // if (!$userStore.user) {
                //         goto('/login');
                //         return;
                // }
                
                loadGames();
                checkBackgroundGameCreation();
        });
</script>

<div class="container mx-auto p-4">
        <div class="bg-gradient-to-r from-primary-900/30 to-tertiary-900/30 p-6 rounded-lg mb-8 shadow-lg">
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
        
        <!-- Refresh controls -->
        <div class="flex justify-between items-center mb-4">
                <div class="text-sm text-surface-500">
                        {#if !isLoading}
                                Last refreshed: {lastRefreshed.toLocaleTimeString()}
                        {/if}
                </div>
                <button 
                        class="btn variant-soft-primary" 
                        onclick={loadGames} 
                        disabled={isLoading}
                >
                        <RefreshCcw size={18} class={isLoading ? 'animate-spin' : ''} />
                        <span class="ml-2">{isLoading ? 'Refreshing...' : 'Refresh Games'}</span>
                </button>
        </div>
        
        {#if backgroundMessage}
                <div class="alert variant-filled-secondary p-4 mb-4">
                        <div class="flex items-center">
                                <span class="mr-2">ℹ️</span>
                                <p>{backgroundMessage}</p>
                        </div>
                </div>
        {/if}
        
        {#if isLoading}
                <div class="card p-8 text-center bg-surface-100-800-token">
                        <div class="flex justify-center items-center h-32">
                                <div class="spinner-third w-8 h-8"></div>
                                <p class="ml-4 text-lg">Loading games...</p>
                        </div>
                </div>
        {:else if error}
                <div class="alert variant-filled-error p-4 mb-4">
                        <div class="flex items-center">
                                <span class="mr-2">✗</span>
                                <p>{error}</p>
                        </div>
                        <div class="mt-2">
                                <button class="btn btn-sm variant-filled" onclick={loadGames}>Try Again</button>
                        </div>
                </div>
        {:else if allGames.length === 0}
                <div class="card p-10 text-center bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                        <div class="flex flex-col items-center justify-center py-12">
                                <div class="text-5xl text-primary-400 mb-4">🎮</div>
                                <h2 class="h2 mb-2">No Games Available</h2>
                                <p class="mb-6 text-surface-600 dark:text-surface-400">Be the first one to create a game and invite others to play!</p>
                                <div class="flex space-x-4">
                                        <a href="/games/create" class="btn variant-filled-primary">
                                                <span class="mr-2">+</span> Create the First Game
                                        </a>
                                        <button class="btn variant-soft" onclick={loadGames}>
                                                <RefreshCcw size={16} />
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
