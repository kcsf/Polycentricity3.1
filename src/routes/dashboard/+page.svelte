<script lang="ts">
        import { onMount } from 'svelte';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import { userGamesStore } from '$lib/stores/gameStore';
        import { getUserGames, getAllGames, getUserActors } from '$lib/services/gameService';
        import { getGun, nodes } from '$lib/services/gunService';
        import UserCard from '$lib/components/UserCard.svelte';
        import GameCard from '$lib/components/GameCard.svelte';
        import * as icons from 'svelte-lucide';
        
        // Dashboard state
        let isLoading = true;
        let actorStats = [];
        let dashboardStats = {
            gamesCreated: 0,
            gamesJoined: 0,
            agreementsParticipating: 0,
            agreementsCreated: 0,
            decksCreated: 0,
            cardsOwned: 0
        };

        // Function to count agreements by type for a user
        async function countUserAgreements() {
            const gun = getGun();
            if (!gun || !$userStore.user) return { participating: 0, created: 0 };
            
            return new Promise((resolve) => {
                let participating = 0;
                let created = 0;
                
                gun.get(nodes.agreements).map().once((agreement, id) => {
                    if (!agreement) return;
                    
                    // Check if the user is in any of the parties
                    if (agreement.parties && Object.keys(agreement.parties).some(actorId => {
                        const actorMatch = actorStats.find(actor => actor.actor_id === actorId);
                        return actorMatch && actorMatch.user_id === $userStore.user?.user_id;
                    })) {
                        participating++;
                    }
                    
                    // Check if the user created the agreement
                    if (agreement.created_by === $userStore.user.user_id) {
                        created++;
                    }
                });
                
                // Give Gun.js some time to fetch data
                setTimeout(() => {
                    resolve({ participating, created });
                }, 500);
            });
        }
        
        // Function to count decks created by the user
        async function countUserDecks() {
            const gun = getGun();
            if (!gun || !$userStore.user) return 0;
            
            return new Promise((resolve) => {
                let count = 0;
                
                gun.get(nodes.decks).map().once((deck, id) => {
                    if (deck && deck.creator === $userStore.user?.user_id) {
                        count++;
                    }
                });
                
                // Give Gun.js some time to fetch data
                setTimeout(() => {
                    resolve(count);
                }, 500);
            });
        }
        
        // Function to count cards owned by user
        async function countUserCards() {
            if (!actorStats.length || !$userStore.user) return 0;
            
            // Count cards assigned to user's actors
            let cardCount = 0;
            actorStats.forEach(actor => {
                if (actor.card_id) cardCount++;
            });
            
            return cardCount;
        }
        
        onMount(async () => {
                // Fetch user's games
                try {
                        // Get all games
                        const allGames = await getAllGames();
                        
                        // Get user's games
                        const userGames = await getUserGames();
                        userGamesStore.set(userGames || []);
                        console.log(`Dashboard loaded ${userGames.length} games`);
                        
                        // Get user's actors
                        const userActors = await getUserActors();
                        actorStats = userActors || [];
                        
                        // Calculate dashboard stats
                        if ($userStore.user) {
                            // Count games created by the user
                            dashboardStats.gamesCreated = allGames.filter(game => 
                                game.creator === $userStore.user?.user_id
                            ).length;
                            
                            // Count games joined
                            dashboardStats.gamesJoined = userGames.length;
                            
                            // Count agreements
                            const agreementCounts = await countUserAgreements();
                            dashboardStats.agreementsParticipating = agreementCounts.participating;
                            dashboardStats.agreementsCreated = agreementCounts.created;
                            
                            // Count decks
                            dashboardStats.decksCreated = await countUserDecks();
                            
                            // Count cards
                            dashboardStats.cardsOwned = await countUserCards();
                        }
                } catch (error) {
                        console.error('Error fetching dashboard data:', error);
                        userGamesStore.set([]); // Ensure we always set a valid array
                } finally {
                        isLoading = false;
                }
        });
        
        // Format numbers with commas
        function formatNumber(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
</script>

<div class="container mx-auto px-4 py-6">
        <h1 class="h1 mb-6 text-primary-500 dark:text-primary-400">Your Dashboard</h1>
        
        {#if $userStore.isLoading || isLoading}
                <div class="card variant-soft p-8 text-center animate-pulse">
                        <div class="flex justify-center">
                                <icons.Loader size={24} class="animate-spin mr-2" />
                                <p>Loading your dashboard...</p>
                        </div>
                </div>
        {:else}
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <!-- Left sidebar: User profile and quick stats section -->
                        <div class="lg:col-span-4 xl:col-span-3 space-y-6">
                                <!-- User profile card -->
                                <div class="card variant-filled-surface p-0 shadow-xl overflow-hidden">
                                        <header class="bg-primary-500/10 dark:bg-primary-500/20 p-5">
                                                <h2 class="h2 text-primary-700 dark:text-primary-300">Profile</h2>
                                        </header>
                                        
                                        <div class="p-5">
                                                {#if $userStore.user}
                                                        <UserCard user={$userStore.user} showDetails={true} />
                                                {:else}
                                                        <!-- For development only -->
                                                        <div class="rounded-lg bg-surface-50-900-token p-4 border border-surface-300-600-token">
                                                                <h3 class="h3 text-primary-500">Development User</h3>
                                                                <div class="flex items-center mt-2 text-sm">
                                                                        <icons.User size={16} class="mr-2 text-tertiary-500" />
                                                                        <span>Guest Developer</span>
                                                                </div>
                                                                <div class="flex items-center mt-1 text-sm">
                                                                        <icons.Mail size={16} class="mr-2 text-tertiary-500" />
                                                                        <span>dev@example.com</span>
                                                                </div>
                                                        </div>
                                                {/if}
                                        </div>
                                </div>
                                
                                <!-- Quick Stats Card -->
                                <div class="card variant-filled-surface p-0 shadow-xl overflow-hidden">
                                        <header class="bg-secondary-500/10 dark:bg-secondary-500/20 p-5">
                                                <h2 class="h2 text-secondary-700 dark:text-secondary-300">Quick Stats</h2>
                                        </header>
                                        
                                        <div class="p-5">
                                                <div class="grid grid-cols-2 gap-4">
                                                        <div class="card variant-soft-primary p-4 text-center flex flex-col items-center justify-center">
                                                                <icons.Gamepad2 size={24} class="mb-2" />
                                                                <p class="h3 text-primary-600 dark:text-primary-400 font-bold">
                                                                        {formatNumber(dashboardStats.gamesJoined)}
                                                                </p>
                                                                <p class="text-xs font-medium">Games Joined</p>
                                                        </div>
                                                        
                                                        <div class="card variant-soft-secondary p-4 text-center flex flex-col items-center justify-center">
                                                                <icons.FileCode size={24} class="mb-2" />
                                                                <p class="h3 text-secondary-600 dark:text-secondary-400 font-bold">
                                                                        {formatNumber(dashboardStats.decksCreated)}
                                                                </p>
                                                                <p class="text-xs font-medium">Decks Created</p>
                                                        </div>
                                                        
                                                        <div class="card variant-soft-tertiary p-4 text-center flex flex-col items-center justify-center">
                                                                <icons.Handshake size={24} class="mb-2" />
                                                                <p class="h3 text-tertiary-600 dark:text-tertiary-400 font-bold">
                                                                        {formatNumber(dashboardStats.agreementsParticipating)}
                                                                </p>
                                                                <p class="text-xs font-medium">Agreements</p>
                                                        </div>
                                                        
                                                        <div class="card variant-soft-warning p-4 text-center flex flex-col items-center justify-center">
                                                                <icons.CreditCard size={24} class="mb-2" />
                                                                <p class="h3 text-warning-600 dark:text-warning-400 font-bold">
                                                                        {formatNumber(dashboardStats.cardsOwned)}
                                                                </p>
                                                                <p class="text-xs font-medium">Cards Owned</p>
                                                        </div>
                                                </div>
                                        </div>
                                </div>
                                
                                <!-- Actor Stats Card -->
                                {#if actorStats.length > 0}
                                        <div class="card variant-filled-surface p-0 shadow-xl overflow-hidden">
                                                <header class="bg-tertiary-500/10 dark:bg-tertiary-500/20 p-5">
                                                        <h2 class="h2 text-tertiary-700 dark:text-tertiary-300">Actor Stats</h2>
                                                </header>
                                                
                                                <div class="p-5">
                                                        <div class="space-y-3">
                                                                {#each actorStats as actor}
                                                                        <div class="card variant-soft p-3 border border-surface-300-600-token">
                                                                                <div class="flex justify-between items-center">
                                                                                        <div>
                                                                                                <p class="font-semibold text-primary-600 dark:text-primary-400">
                                                                                                        {actor.name || actor.role_title || 'Unnamed Actor'}
                                                                                                </p>
                                                                                                <p class="text-xs text-surface-600-300-token flex items-center">
                                                                                                        <icons.Tag size={12} class="mr-1" />
                                                                                                        {actor.actor_id.substring(0, 8)}...
                                                                                                </p>
                                                                                        </div>
                                                                                        <div class="badge variant-filled-secondary">
                                                                                                {actor.role_title || 'No Role'}
                                                                                        </div>
                                                                                </div>
                                                                                {#if actor.game_id}
                                                                                        <div class="mt-2 text-xs flex justify-end">
                                                                                                <a href="/games/{actor.game_id}" class="btn btn-sm variant-soft-primary">
                                                                                                        <icons.LogIn size={14} class="mr-1"/>
                                                                                                        View Game
                                                                                                </a>
                                                                                        </div>
                                                                                {/if}
                                                                        </div>
                                                                {/each}
                                                        </div>
                                                </div>
                                        </div>
                                {/if}
                        </div>
                        
                        <!-- Right side content: Games section -->
                        <div class="lg:col-span-8 xl:col-span-9">
                                <!-- Games Header -->
                                <div class="card variant-filled-primary p-5 shadow-xl mb-6">
                                        <div class="flex flex-col md:flex-row justify-between items-center">
                                                <h2 class="h2 text-white mb-4 md:mb-0">Your Games</h2>
                                                <div class="flex gap-3">
                                                        <a href="/games" class="btn variant-filled-surface">
                                                                <icons.ListFilter size={18} class="mr-2" />
                                                                Browse Games
                                                        </a>
                                                        <a href="/games/create" class="btn variant-filled-surface">
                                                                <icons.Plus size={18} class="mr-2" />
                                                                Create Game
                                                        </a>
                                                </div>
                                        </div>
                                </div>
                                
                                <!-- Games Grid -->
                                {#if $userGamesStore.length === 0}
                                        <div class="card variant-ghost p-10 text-center shadow-xl border border-surface-300-600-token">
                                                <div class="flex flex-col items-center justify-center">
                                                        <icons.Gamepad2 size={64} class="text-surface-400-500-token mb-4" />
                                                        <h3 class="h3 text-primary-500 dark:text-primary-400 mb-2">No Games Yet</h3>
                                                        <p class="mb-6 text-surface-700-300-token max-w-md">
                                                                You haven't joined any games yet. Browse available games or create
                                                                your own to get started with collaborative sustainability modeling.
                                                        </p>
                                                        <div class="flex flex-col sm:flex-row gap-4">
                                                                <a href="/games" class="btn variant-filled-secondary">
                                                                        <icons.Search size={18} class="mr-2" />
                                                                        Find Games
                                                                </a>
                                                                <a href="/games/create" class="btn variant-filled-primary">
                                                                        <icons.Plus size={18} class="mr-2" />
                                                                        Create New Game
                                                                </a>
                                                        </div>
                                                </div>
                                        </div>
                                {:else}
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {#each $userGamesStore as game (game.game_id)}
                                                        <GameCard {game} />
                                                {/each}
                                        </div>
                                        
                                        {#if $userGamesStore.length > 4}
                                                <div class="mt-6 text-center">
                                                        <a href="/games" class="btn variant-ghost-primary">
                                                                <icons.ChevronDown size={18} class="mr-2" />
                                                                View All Games
                                                        </a>
                                                </div>
                                        {/if}
                                {/if}
                        </div>
                </div>
        {/if}
</div>
