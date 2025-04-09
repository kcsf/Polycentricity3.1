<script lang="ts">
        import { onMount } from 'svelte';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import { userGamesStore } from '$lib/stores/gameStore';
        import { getUserGames } from '$lib/services/gameService';
        import UserCard from '$lib/components/UserCard.svelte';
        import GameCard from '$lib/components/GameCard.svelte';
        
        let isLoading = true;
        
        onMount(async () => {
                // Check if user is authenticated
                if (!$userStore.user) {
                        goto('/login');
                        return;
                }
                
                // Fetch user's games
                try {
                        const games = await getUserGames();
                        // The games array will be empty if there are no games or if there was an error
                        // but it will never be null
                        userGamesStore.set(games || []);
                        console.log(`Dashboard loaded ${games.length} games`);
                } catch (error) {
                        console.error('Error fetching user games:', error);
                        userGamesStore.set([]); // Ensure we always set a valid array
                } finally {
                        isLoading = false;
                }
        });
</script>

<div class="container mx-auto p-4">
        <h1 class="h1 mb-4">Dashboard</h1>
        
        {#if $userStore.isLoading || isLoading}
                <div class="card p-8 text-center">
                        <p>Loading your dashboard...</p>
                </div>
        {:else if $userStore.user}
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <!-- User profile section -->
                        <div class="lg:col-span-1">
                                <h2 class="h2 mb-4">Your Profile</h2>
                                <UserCard user={$userStore.user} showDetails={true} />
                                
                                <div class="card p-4 mt-4">
                                        <h3 class="h3 mb-2">Quick Stats</h3>
                                        <div class="grid grid-cols-2 gap-2">
                                                <div class="p-2 bg-surface-100-800-token rounded text-center">
                                                        <p class="h4">{$userGamesStore.length}</p>
                                                        <p class="text-xs">Games</p>
                                                </div>
                                                <div class="p-2 bg-surface-100-800-token rounded text-center">
                                                        <p class="h4">0</p>
                                                        <p class="text-xs">Agreements</p>
                                                </div>
                                        </div>
                                </div>
                        </div>
                        
                        <!-- Games section -->
                        <div class="lg:col-span-2">
                                <div class="flex justify-between items-center mb-4">
                                        <h2 class="h2">Your Games</h2>
                                        <a href="/games/create" class="btn variant-filled-primary">Create Game</a>
                                </div>
                                
                                {#if $userGamesStore.length === 0}
                                        <div class="card p-8 text-center">
                                                <p class="mb-4">You haven't joined any games yet.</p>
                                                <div class="flex justify-center">
                                                        <a href="/games" class="btn variant-filled-secondary">Browse Games</a>
                                                        <a href="/games/create" class="btn variant-filled-primary ml-2">Create Game</a>
                                                </div>
                                        </div>
                                {:else}
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {#each $userGamesStore as game (game.game_id)}
                                                        <GameCard {game} />
                                                {/each}
                                        </div>
                                        
                                        <div class="mt-4 text-center">
                                                <a href="/games" class="btn variant-ghost">View All Games</a>
                                        </div>
                                {/if}
                        </div>
                </div>
        {:else}
                <div class="card p-8 text-center">
                        <p class="mb-4">You need to be logged in to view your dashboard.</p>
                        <div class="flex justify-center space-x-4">
                                <a href="/login" class="btn variant-filled-primary">Login</a>
                                <a href="/register" class="btn variant-filled-secondary">Register</a>
                        </div>
                </div>
        {/if}
</div>
