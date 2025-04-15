<script lang="ts">
        import { onMount } from 'svelte';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import { userGamesStore } from '$lib/stores/gameStore';
        import { getUserGames, getAllGames, getUserActors, getGame } from '$lib/services/gameService';
        import { getGun, nodes } from '$lib/services/gunService';
        import UserCard from '$lib/components/UserCard.svelte';
        import GameCard from '$lib/components/GameCard.svelte';
        import * as icons from 'svelte-lucide';
        
        // Dashboard state
        let isLoading = true;
        let actorStats = [];
        let actorGames = []; // Games found through actors
        let dashboardStats = {
            gamesCreated: 0,
            gamesJoined: 0,
            agreementsParticipating: 0,
            agreementsCreated: 0,
            decksCreated: 0,
            cardsOwned: 0
        };

        // Get all games that a user's actors are part of (deeper traversal)
        async function getGamesFromActors(actors) {
            const gun = getGun();
            if (!gun || !actors.length) return [];
            
            return new Promise((resolve) => {
                const games = [];
                const gameIds = new Set();
                
                // Extract game_ids from actors
                const actorGameIds = actors
                    .filter(actor => actor.game_id)
                    .map(actor => actor.game_id);
                    
                // Deduplicate game IDs
                const uniqueGameIds = [...new Set(actorGameIds)];
                
                console.log(`Found ${uniqueGameIds.length} unique games from actors`);
                
                // For each game ID, get the full game data
                if (uniqueGameIds.length === 0) {
                    resolve([]);
                    return;
                }
                
                let gamesLoaded = 0;
                
                uniqueGameIds.forEach(gameId => {
                    gun.get(nodes.games).get(gameId).once((gameData) => {
                        if (gameData && gameData.game_id) {
                            games.push(gameData);
                            gameIds.add(gameData.game_id);
                        }
                        
                        gamesLoaded++;
                        if (gamesLoaded === uniqueGameIds.length) {
                            console.log(`Loaded ${games.length} games through actor traversal`);
                            resolve(games);
                        }
                    });
                });
                
                // Failsafe timeout in case not all games are found
                setTimeout(() => {
                    if (games.length < uniqueGameIds.length) {
                        console.log(`Timeout reached, returning ${games.length} games`);
                        resolve(games);
                    }
                }, 1000);
            });
        }

        // Function to count agreements by type for a user
        async function countUserAgreements() {
            const gun = getGun();
            if (!gun || !$userStore.user) return { participating: 0, created: 0 };
            
            return new Promise((resolve) => {
                let participating = 0;
                let created = 0;
                
                gun.get(nodes.agreements).map().once((agreement, id) => {
                    if (!agreement) return;
                    
                    // Check if the user is in any of the parties via their actors
                    if (agreement.parties) {
                        const partyActorIds = Object.keys(agreement.parties);
                        const userInParty = partyActorIds.some(actorId => {
                            const actorMatch = actorStats.find(actor => actor.actor_id === actorId);
                            return actorMatch && actorMatch.user_id === $userStore.user?.user_id;
                        });
                        
                        if (userInParty) {
                            participating++;
                        }
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
        
        // Load actor details including card and game information
        async function loadFullActorDetails(actors) {
            if (!actors.length) return actors;
            
            const gun = getGun();
            if (!gun) return actors;
            
            return new Promise((resolve) => {
                const enhancedActors = [...actors];
                let actorsProcessed = 0;
                
                // For each actor, get their associated card details if they have a card_id
                actors.forEach((actor, index) => {
                    if (actor.card_id) {
                        gun.get(nodes.cards).get(actor.card_id).once((cardData) => {
                            if (cardData) {
                                // Merge card details into actor data
                                enhancedActors[index] = {
                                    ...actor,
                                    card_details: cardData,
                                    // If actor has no name but card has role_title, use that
                                    name: actor.name || cardData.role_title || 'Unnamed Actor'
                                };
                            }
                            
                            actorsProcessed++;
                            if (actorsProcessed === actors.length) {
                                console.log(`Enhanced ${enhancedActors.length} actors with card details`);
                                resolve(enhancedActors);
                            }
                        });
                    } else {
                        actorsProcessed++;
                        if (actorsProcessed === actors.length) {
                            resolve(enhancedActors);
                        }
                    }
                });
                
                // Failsafe timeout
                setTimeout(() => {
                    if (actorsProcessed < actors.length) {
                        console.log('Timeout reached while loading actor details');
                        resolve(enhancedActors);
                    }
                }, 1000);
            });
        }
        
        onMount(async () => {
                // Fetch user's games and actors
                try {
                        // Get all user's actors first
                        const userActors = await getUserActors();
                        console.log(`Found ${userActors.length} actors for user`);
                        
                        // Load detailed actor information
                        actorStats = await loadFullActorDetails(userActors || []);
                        
                        // Get games directly through user relationship
                        const directUserGames = await getUserGames();
                        
                        // Also get games through actors (deeper traversal)
                        const actorLinkedGames = await getGamesFromActors(actorStats);
                        
                        // Combine both game lists, removing duplicates
                        const allUserGames = [...directUserGames];
                        
                        // Add actor-linked games if they're not already in the user games
                        actorLinkedGames.forEach(game => {
                            if (!allUserGames.some(g => g.game_id === game.game_id)) {
                                allUserGames.push(game);
                            }
                        });
                        
                        console.log(`Combined ${directUserGames.length} direct games with ${actorLinkedGames.length} actor games for total of ${allUserGames.length} games`);
                        
                        // Store in the games store
                        userGamesStore.set(allUserGames);
                        
                        // Get all games (for additional stats)
                        const allGames = await getAllGames();
                        
                        // Calculate dashboard stats
                        if ($userStore.user) {
                            // Count games created by the user
                            dashboardStats.gamesCreated = allGames.filter(game => 
                                game.creator === $userStore.user?.user_id
                            ).length;
                            
                            // Count games joined (from combined list)
                            dashboardStats.gamesJoined = allUserGames.length;
                            
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
                                
                                <!-- Actors Card -->
                                {#if actorStats.length > 0}
                                        <div class="card variant-filled-surface p-0 shadow-xl overflow-hidden">
                                                <header class="bg-tertiary-500/10 dark:bg-tertiary-500/20 p-5">
                                                        <h2 class="h2 text-tertiary-700 dark:text-tertiary-300">Actors</h2>
                                                </header>
                                                
                                                <div class="p-5">
                                                        <div class="space-y-3">
                                                                {#each actorStats as actor}
                                                                        <div class="card variant-soft p-4 border border-surface-300-600-token">
                                                                                <!-- Actor Header -->
                                                                                <div class="flex justify-between items-start">
                                                                                        <div>
                                                                                                <p class="font-semibold text-primary-600 dark:text-primary-400 text-lg">
                                                                                                        {actor.name || actor.role_title || 'Unnamed Actor'}
                                                                                                </p>
                                                                                                {#if actor.card_details?.role_title && actor.card_details?.role_title !== actor.name}
                                                                                                        <p class="text-sm text-secondary-500 -mt-1">
                                                                                                                {actor.card_details.role_title}
                                                                                                        </p>
                                                                                                {/if}
                                                                                        </div>
                                                                                        <div class="badge variant-filled-secondary">
                                                                                                {#if actor.card_details?.card_category}
                                                                                                        {actor.card_details.card_category}
                                                                                                {:else}
                                                                                                        Actor
                                                                                                {/if}
                                                                                        </div>
                                                                                </div>
                                                                                
                                                                                <!-- Actor Properties -->
                                                                                <div class="grid grid-cols-2 gap-2 my-2">
                                                                                        {#if actor.actor_id}
                                                                                                <div class="flex items-center text-xs">
                                                                                                        <icons.Tag size={12} class="mr-1 text-tertiary-500" />
                                                                                                        <span class="opacity-75 overflow-hidden overflow-ellipsis whitespace-nowrap" 
                                                                                                              title={actor.actor_id}>{actor.actor_id.substring(0, 10)}...</span>
                                                                                                </div>
                                                                                        {/if}
                                                                                        
                                                                                        {#if actor.card_details?.card_number}
                                                                                                <div class="flex items-center text-xs">
                                                                                                        <icons.CreditCard size={12} class="mr-1 text-tertiary-500" />
                                                                                                        <span>Card #{actor.card_details.card_number}</span>
                                                                                                </div>
                                                                                        {/if}
                                                                                </div>
                                                                                
                                                                                <!-- Actor Description (if available) -->
                                                                                {#if actor.card_details?.backstory}
                                                                                        <div class="mt-2 text-xs text-surface-700-300-token">
                                                                                                <p class="line-clamp-2">{actor.card_details.backstory}</p>
                                                                                        </div>
                                                                                {/if}
                                                                                
                                                                                <!-- Game Link -->
                                                                                {#if actor.game_id}
                                                                                        <div class="mt-3 text-xs flex justify-end">
                                                                                                <a href="/games/{actor.game_id}" class="btn btn-sm variant-soft-primary">
                                                                                                        <icons.LogIn size={14} class="mr-1"/>
                                                                                                        View Game
                                                                                                </a>
                                                                                        </div>
                                                                                {:else}
                                                                                        <div class="mt-3 text-xs text-surface-600-300-token italic">
                                                                                                Not currently in a game
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
