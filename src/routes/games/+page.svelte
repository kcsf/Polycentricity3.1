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
        <div class="flex justify-between items-center mb-6">
                <h1 class="h1">Games</h1>
                <a href="/games/create" class="btn variant-filled-primary">Create Game</a>
        </div>
        
        {#if isLoading}
                <div class="card p-8 text-center">
                        <p>Loading games...</p>
                </div>
        {:else if error}
                <div class="alert variant-filled-error">
                        <p>{error}</p>
                </div>
        {:else if allGames.length === 0}
                <div class="card p-8 text-center">
                        <p class="mb-4">No games available.</p>
                        <a href="/games/create" class="btn variant-filled-primary">Create the First Game</a>
                </div>
        {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {#each allGames as game (game.game_id)}
                                <GameCard {game} />
                        {/each}
                </div>
        {/if}
</div>
