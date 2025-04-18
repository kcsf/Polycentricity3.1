<script lang="ts">
        import { onMount } from 'svelte';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import { userGamesStore } from '$lib/stores/gameStore';
        import { getUserGames, getAllGames, getUserActors, getGame } from '$lib/services/gameService';
        import { getGun, nodes } from '$lib/services/gunService';
        import UserCard from '$lib/components/UserCard.svelte';
        import GameCard from '$lib/components/GameCard.svelte';
        import ProfileUpdateModal from '$lib/components/ProfileUpdateModal.svelte';
        import ActorEditModal from '$lib/components/ActorEditModal.svelte';
        import * as icons from 'lucide-svelte';
        // Dashboard specific imports
        
        // Dashboard state using Svelte 5.25.9 Runes mode
        let isLoading = $state(true);
        let actorStats = $state<any[]>([]);
        let actorGames = $state<any[]>([]); // Games found through actors
        let dashboardStats = $state({
            gamesCreated: 0,
            gamesJoined: 0,
            agreementsParticipating: 0,
            agreementsCreated: 0,
            decksCreated: 0,
            cardsOwned: 0
        });

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
                
                // For each actor, ensure we have all actor properties properly formatted
                actors.forEach((actor, index) => {
                    // Always enhance with actor properties regardless of card assignment
                    enhancedActors[index] = {
                        ...actor,
                        // Use proper properties based on reference data
                        actor_id: actor.actor_id,
                        actor_type: actor.actor_type || 'Actor', 
                        custom_name: actor.custom_name || actor.name || 'Unnamed Actor',
                        created_at: actor.created_at || Date.now(),
                        status: actor.status || 'active',
                        game_id: actor.game_id,
                        // Add any game metadata if available
                        game_name: actor.game_name || 'Unknown Game'
                    };
                    
                    actorsProcessed++;
                    if (actorsProcessed === actors.length) {
                        console.log(`Enhanced ${enhancedActors.length} actors with actor properties`);
                        resolve(enhancedActors);
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
        
        // Using onMount with proper error handling for Svelte 5.25.9 Runes mode
        onMount(async () => {
                // Fetch user's games and actors
                try {
                        // Get all user's actors first
                        try {
                            const userActors = await getUserActors();
                            console.log(`Found ${userActors.length} actors for user ${$userStore.user?.user_id || 'unknown'}`);
                            
                            // Debug each actor found
                            if (userActors.length > 0) {
                                userActors.forEach((actor, index) => {
                                    console.log(`Actor ${index + 1}: ID=${actor.actor_id}, Game=${actor.game_id}, Card=${actor.card_id || 'none'}`);
                                });
                            } else {
                                console.warn(`No actors found for user ${$userStore.user?.user_id || 'unknown'} - this suggests a possible connectivity issue with Gun.js`);
                            }
                            
                            // Load detailed actor information
                            actorStats = await loadFullActorDetails(userActors || []);
                        } catch (error) {
                            console.error("Error retrieving user actors:", error);
                            actorStats = [];
                        }
                        
                        // Get games directly through user relationship
                        let directUserGames = [];
                        try {
                            console.log(`Attempting to get games for user ${$userStore.user?.user_id || 'unknown'}`);
                            directUserGames = await getUserGames();
                            
                            // Debug each game found
                            if (directUserGames.length > 0) {
                                console.log(`Found ${directUserGames.length} direct games for user ${$userStore.user?.user_id || 'unknown'}`);
                                directUserGames.forEach((game, index) => {
                                    console.log(`Game ${index + 1}: ID=${game.game_id}, Name=${game.name || 'Unnamed'}`);
                                });
                            } else {
                                console.warn(`No direct games found for user ${$userStore.user?.user_id || 'unknown'} - this suggests a possible connectivity issue with Gun.js`);
                            }
                        } catch (error) {
                            console.error("Error retrieving user games:", error);
                            directUserGames = [];
                        }
                        
                        // Also get games through actors (deeper traversal)
                        const actorLinkedGames = await getGamesFromActors(actorStats);
                        
                        // Combine both game lists, removing duplicates using Map
                        const gamesMap = new Map();
                        
                        // Add all games to the map, keyed by game_id
                        [...directUserGames, ...actorLinkedGames].forEach(game => {
                            if (game && game.game_id) {
                                gamesMap.set(game.game_id, game);
                            }
                        });
                        
                        // Convert map back to array
                        const allUserGames = Array.from(gamesMap.values());
                        
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
                
                // Add a cleanup function to prevent memory leaks
                return () => {
                    // Perform any cleanup needed when component is destroyed
                    console.log('Dashboard component unmounted');
                };
        });
        
        // Add a Runes $effect to log when dashboard data changes
        $effect(() => {
            if (!isLoading) {
                const stats = { ...dashboardStats }; // Create a copy to avoid logging the proxy
                console.log('%c[snapshot]', 'color: grey', 'Dashboard data loaded with stats:', stats);
            }
        });
        
        // Format numbers with commas
        function formatNumber(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
        
        // Modal states using Svelte 5.25.9 Runes mode
        let profileModalOpen = $state(false);
        let actorEditModalOpen = $state(false);
        let selectedActor = $state<any | null>(null);
        
        // Modal handling for profile update
        function openProfileUpdateModal() {
            profileModalOpen = true;
        }
        
        // Modal handling for actor edit
        function openActorEditModal(actor) {
            selectedActor = actor;
            actorEditModalOpen = true;
        }
</script>

<div class="container mx-auto px-4 py-6">
        <!-- Profile Header Card -->
        {#if $userStore.user}
            <div class="overflow-hidden rounded-lg bg-surface-50 dark:bg-surface-900 shadow-lg mb-6">
                <h2 class="sr-only" id="profile-overview-title">Profile Overview</h2>
                <div class="p-6">
                    <div class="sm:flex sm:items-center sm:justify-between">
                        <div class="sm:flex sm:space-x-5">
                            <div class="shrink-0">
                                <div class="mx-auto size-20 rounded-full bg-primary-500/20 dark:bg-primary-500/30 flex items-center justify-center text-2xl font-bold text-primary-700 dark:text-primary-300">
                                    {$userStore.user.name ? $userStore.user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                            </div>
                            <div class="mt-4 text-center sm:mt-0 sm:pt-1 sm:text-left">
                                <p class="text-sm font-medium text-surface-600 dark:text-surface-400">Welcome back,</p>
                                <p class="text-xl font-bold text-primary-700 dark:text-primary-300 sm:text-2xl">{$userStore.user.name}</p>
                                <p class="text-sm font-medium text-surface-600 dark:text-surface-400">{$userStore.user.role || 'Member'}</p>
                            </div>
                        </div>
                        <div class="mt-5 flex justify-center sm:mt-0">
                            <button 
                                class="btn variant-soft-primary"
                                onclick={openProfileUpdateModal}
                            >
                                <icons.UserCog size={16} class="mr-2" /> 
                                Update Profile
                            </button>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 divide-y divide-surface-200 dark:divide-surface-700 border-t border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                    <!-- Games Joined -->
                    <div class="px-6 py-5 text-center">
                        <div class="flex items-center justify-center mb-2">
                            <icons.Gamepad2 class="text-primary-500 dark:text-primary-400 mr-2" size={18} />
                            <span class="text-lg font-semibold text-primary-700 dark:text-primary-300">{formatNumber(dashboardStats.gamesJoined)}</span>
                        </div>
                        <span class="text-sm font-medium text-surface-600 dark:text-surface-400">Games Joined</span>
                    </div>
                    
                    <!-- Decks Created -->
                    <div class="px-6 py-5 text-center">
                        <div class="flex items-center justify-center mb-2">
                            <icons.FileCode class="text-secondary-500 dark:text-secondary-400 mr-2" size={18} />
                            <span class="text-lg font-semibold text-secondary-700 dark:text-secondary-300">{formatNumber(dashboardStats.decksCreated)}</span>
                        </div>
                        <span class="text-sm font-medium text-surface-600 dark:text-surface-400">Decks Created</span>
                    </div>
                    
                    <!-- Agreements -->
                    <div class="px-6 py-5 text-center">
                        <div class="flex items-center justify-center mb-2">
                            <icons.Handshake class="text-tertiary-500 dark:text-tertiary-400 mr-2" size={18} />
                            <span class="text-lg font-semibold text-tertiary-700 dark:text-tertiary-300">{formatNumber(dashboardStats.agreementsParticipating)}</span>
                        </div>
                        <span class="text-sm font-medium text-surface-600 dark:text-surface-400">Agreements</span>
                    </div>
                    
                    <!-- Cards Owned -->
                    <div class="px-6 py-5 text-center">
                        <div class="flex items-center justify-center mb-2">
                            <icons.CreditCard class="text-warning-500 dark:text-warning-400 mr-2" size={18} />
                            <span class="text-lg font-semibold text-warning-700 dark:text-warning-300">{formatNumber(dashboardStats.cardsOwned)}</span>
                        </div>
                        <span class="text-sm font-medium text-surface-600 dark:text-surface-400">Cards Owned</span>
                    </div>
                </div>
            </div>
        {/if}
        
        {#if $userStore.isLoading || isLoading}
                <div class="card variant-soft p-8 text-center animate-pulse">
                        <div class="flex justify-center">
                                <icons.Loader size={24} class="animate-spin mr-2" />
                                <p>Loading your dashboard...</p>
                        </div>
                </div>
        {:else}
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <!-- Left sidebar: Your Actors section -->
                        <div class="lg:col-span-4 xl:col-span-3 space-y-6">
                                <!-- Your Actors Card -->
                                <div class="card variant-filled-surface p-0 shadow-xl overflow-hidden">
                                        <header class="bg-tertiary-500/10 dark:bg-tertiary-500/20 p-5">
                                                <h2 class="h2 text-tertiary-700 dark:text-tertiary-300">Your Actors</h2>
                                        </header>
                                        
                                        <div class="p-5">
                                                {#if actorStats.length === 0}
                                                        <div class="rounded-lg bg-surface-50-900-token p-6 text-center">
                                                                <icons.User size={48} class="mx-auto text-surface-400-500-token mb-3" />
                                                                <h3 class="h3 text-tertiary-500 mb-2">No Actors Yet</h3>
                                                                <p class="text-sm text-surface-700-300-token mb-4">
                                                                        You haven't been assigned any actor roles yet.
                                                                        Join a game to get started.
                                                                </p>
                                                                <a href="/games" class="btn variant-soft-tertiary">
                                                                        <icons.Search size={18} class="mr-2" />
                                                                        Browse Games
                                                                </a>
                                                        </div>
                                                {:else}
                                                        <div class="space-y-4">
                                                                {#each actorStats as actor}
                                                                        <div class="card variant-soft p-4 rounded-lg">
                                                                                <div class="flex flex-col">
                                                                                        <div class="flex items-center mb-2">
                                                                                                <!-- Actor name & type -->
                                                                                                <div class="grow">
                                                                                                        <h3 class="text-lg font-bold text-tertiary-600 dark:text-tertiary-400">
                                                                                                                {actor.custom_name || 'Unnamed Actor'}
                                                                                                        </h3>
                                                                                                        <p class="text-xs text-surface-600-400-token">
                                                                                                                Type: {actor.actor_type || 'Standard Actor'}
                                                                                                        </p>
                                                                                                </div>
                                                                                                
                                                                                                <!-- Status indicator and edit button -->
                                                                                                <div class="shrink-0 flex items-center gap-2">
                                                                                                        <span class="badge {actor.status === 'active' ? 'variant-filled-success' : 'variant-filled-warning'}">
                                                                                                                {actor.status || 'Unknown'}
                                                                                                        </span>
                                                                                                        <button 
                                                                                                            class="btn-icon variant-soft-tertiary btn-sm" 
                                                                                                            title="Edit Actor" 
                                                                                                            onclick={() => openActorEditModal(actor)}
                                                                                                        >
                                                                                                            <!-- Simply use the Pencil component directly since it's imported -->
                                                                                                            <icons.Pencil size={14} />
                                                                                                        </button>
                                                                                                </div>
                                                                                        </div>
                                                                                        
                                                                                        {#if actor.game_id}
                                                                                                <div class="flex items-center mt-2 text-sm">
                                                                                                        <icons.Gamepad2 size={16} class="mr-2 text-primary-500" />
                                                                                                        <span>Game: {actor.game_name || 'Unknown Game'}</span>
                                                                                                </div>
                                                                                        {/if}
                                                                                        
                                                                                        <div class="flex items-center mt-2 text-sm">
                                                                                                <icons.Calendar size={16} class="mr-2 text-tertiary-500" />
                                                                                                <span>Created: {new Date(actor.created_at).toLocaleDateString()}</span>
                                                                                        </div>
                                                                                        
                                                                                        {#if actor.game_id}
                                                                                                <div class="mt-4">
                                                                                                        <a href="/games/{actor.game_id}" class="btn btn-sm variant-soft-primary w-full">
                                                                                                                <icons.ExternalLink size={14} class="mr-2" />
                                                                                                                View Game
                                                                                                        </a>
                                                                                                </div>
                                                                                        {/if}
                                                                                </div>
                                                                        </div>
                                                                {/each}
                                                        </div>
                                                {/if}
                                        </div>
                                </div>
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
                                                {#each [...new Map($userGamesStore.map(g => [g.game_id, g])).values()] as game (game.game_id)}
                                                        <div class="relative">
                                                            <!-- Force "View Game" by setting isUserInGame prop directly -->
                                                            <a href={`/games/${game.game_id}`} class="block">
                                                                <div class="card p-0 shadow-xl hover:shadow-2xl transition-all duration-200 bg-surface-50 dark:bg-surface-900 border border-surface-200-700-token overflow-hidden flex flex-col h-full">
                                                                    <!-- Game Banner & Header -->
                                                                    <div class="relative bg-primary-500/10 dark:bg-primary-500/20 p-5 border-b border-surface-200-700-token">
                                                                        <!-- Status Badge -->
                                                                        <div class="absolute top-3 right-3">
                                                                            <div class="badge variant-filled-success font-medium">
                                                                                <icons.Play size={14} class="mr-1" />
                                                                                {game.status}
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <!-- Game Title -->
                                                                        <h3 class="h3 text-primary-700 dark:text-primary-300 pr-16">{game.name}</h3>
                                                                        
                                                                        <!-- Date & Players Info -->
                                                                        <div class="flex flex-wrap justify-between items-center mt-3 text-xs text-surface-700 dark:text-surface-300">
                                                                            <div class="flex items-center">
                                                                                <icons.Calendar size={14} class="mr-1" />
                                                                                <span>{new Date(game.created_at).toLocaleDateString()}</span>
                                                                            </div>
                                                                            
                                                                            <div class="flex items-center mt-1 sm:mt-0">
                                                                                <icons.Users size={14} class="mr-1" />
                                                                                <span>
                                                                                    {Object.keys(game.players || {}).length} 
                                                                                    {game.max_players ? `/ ${game.max_players}` : 'players'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <!-- Game Details Section -->
                                                                    <div class="p-5 flex-grow flex flex-col">
                                                                        <div class="flex-grow">
                                                                            {#if game.description}
                                                                                <p class="text-sm text-surface-700-300-token line-clamp-2">{game.description}</p>
                                                                            {/if}
                                                                        </div>
                                                                        
                                                                        <!-- Action Button -->
                                                                        <div class="mt-3">
                                                                            <div class="btn variant-filled-primary w-full">
                                                                                <icons.LogIn size={18} class="mr-2" />
                                                                                View Game
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </a>
                                                        </div>
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
                                
                                <!-- Actors section removed from here - now only in left sidebar -->
                        </div>
                </div>
        {/if}
</div>

<!-- Profile Update Modal -->
<ProfileUpdateModal bind:open={profileModalOpen} />

<!-- Actor Edit Modal -->
<ActorEditModal bind:open={actorEditModalOpen} bind:actor={selectedActor} />
