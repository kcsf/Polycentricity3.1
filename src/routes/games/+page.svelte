<script lang="ts">
        import { onMount } from 'svelte';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import { getAllGames } from '$lib/services/gameService';
        import type { Game } from '$lib/types';
        import GameCard from '$lib/components/GameCard.svelte';
        
        let allGames: Game[] = [];
        let isLoading = true;
        let error = '';
        
        onMount(async () => {
                // Temporarily disabled authentication check for development
                // if (!$userStore.user) {
                //         goto('/login');
                //         return;
                // }
                
                // Fetch all games
                try {
                        const games = await getAllGames();
                        allGames = games;
                } catch (err) {
                        console.error('Error fetching games:', err);
                        error = 'Failed to load games. Please try again.';
                } finally {
                        isLoading = false;
                }
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
        
        {#if isLoading}
                <div class="card p-8 text-center bg-surface-100-800-token">
                        <div class="flex justify-center items-center h-32">
                                <div class="spinner-third w-8 h-8"></div>
                                <p class="ml-4 text-lg">Loading games...</p>
                        </div>
                </div>
        {:else if error}
                <div class="alert variant-filled-error">
                        <p>{error}</p>
                </div>
        {:else if allGames.length === 0}
                <div class="card p-10 text-center bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                        <div class="flex flex-col items-center justify-center py-12">
                                <div class="text-5xl text-primary-400 mb-4">🎮</div>
                                <h2 class="h2 mb-2">No Games Available</h2>
                                <p class="mb-6 text-surface-600 dark:text-surface-400">Be the first one to create a game and invite others to play!</p>
                                <a href="/games/create" class="btn variant-filled-primary">
                                        <span class="mr-2">+</span> Create the First Game
                                </a>
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
