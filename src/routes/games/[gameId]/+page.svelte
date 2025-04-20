<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { currentGameStore } from '$lib/stores/gameStore';
    import { activeActorId } from '$lib/stores/enhancedGameStore';
    import { getGame, subscribeToGame, getGameActors, getUserCard, joinGame, getPlayerRole, 
        getAvailableCardsForGame, getAvailableAgreementsForGame, actorCache } from '$lib/services/gameService';
    import { getGun, nodes } from '$lib/services/gunService';
    import type { Game, Actor } from '$lib/types';
    import { GameStatus } from '$lib/types';
    import * as icons from 'lucide-svelte';
    
    import GamePageLayout from './GamePageLayout.svelte';
    
    // Extract gameId from the URL parameters
    const gameId = $page.params.gameId;
    
    // Use Svelte 5 RUNES state management
    let game = $state<Game | null>(null);
    let playerRole = $state<Actor | null>(null);
    let isLoading = $state(true);
    let error = $state('');
    let isJoining = $state(false);
    let unsubscribe = $state<(() => void) | undefined>(undefined);
    
    // Log messages for easier debugging
    const isDev = process.env.NODE_ENV !== 'production';
    const log = (...args: any[]) => isDev && console.log('[GamePage]', ...args);
    
    // If the URL changes but we're still on a game page, handle it
    $effect(() => {
        const currentGameId = $page.params.gameId;
        if (currentGameId !== gameId && currentGameId) {
            window.location.reload(); // Simple approach - reload page when gameId changes
        }
    });
    
    onMount(() => {
        loadGameData().then(() => {
            // Once game data is loaded, safely set up user in game status
            if (game) {
                setupUserInGame();
            }
        });
        
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    });
    
    // Primary function to load game data
    async function loadGameData() {
        isLoading = true;
        error = '';
        
        try {
            // Sequential loading of all game data with proper logging for each step
            // This ensures caches are populated in the correct order and dependencies are available
            
            // 1. Load the game first
            log(`Loading game data for: ${gameId}`);
            game = await getGame(gameId);
            
            if (!game) {
                error = 'Game not found. Please try refreshing the page.';
                isLoading = false;
                log('Game not found');
                return { game: null, actors: [], cards: [], agreements: [] };
            }
            
            log(`Game loaded: ${gameId}`);
            
            // Store it for the app 
            currentGameStore.set(game);
            
            // 2. Set up real-time updates for the game
            unsubscribe = subscribeToGame(gameId, (updatedGame) => {
                if (updatedGame) {
                    game = updatedGame;
                    currentGameStore.set(updatedGame);
                    
                    // Check if user's game status changed
                    setupUserInGame();
                }
            });
            
            // 3. Load actors
            log(`Loading actors for game: ${gameId}`);
            const actors = await getGameActors(gameId);
            log(`Actors loaded: ${actors.length}`);
            
            // 4. Load cards
            log(`Loading cards for game: ${gameId}`);
            const cards = await getAvailableCardsForGame(gameId);
            log(`Cards loaded: ${cards.length}`);
            
            // 5. Load agreements
            log(`Loading agreements for game: ${gameId}`);
            const agreements = await getAvailableAgreementsForGame(gameId);
            log(`Agreements loaded: ${agreements.length}`);
            
            // 6. Load the user's role in this game using the cached data
            const userActorPromise = loadUserActor();
            const userActorTimeout = new Promise<void>((resolve) => {
                setTimeout(() => {
                    log('User actor loading timed out after 3 seconds');
                    resolve();
                }, 3000);
            });
            
            // Don't wait indefinitely for user actor
            await Promise.race([userActorPromise, userActorTimeout]);
            
            // 7. After loading completes, determine if user is in game
            setupUserInGame();
            
            // Return the complete dataset for component use
            return { game, actors, cards, agreements };
        } catch (err) {
            log('Error loading game data:', err);
            error = 'Failed to load game data. Please try refreshing the page.';
            return { game: null, actors: [], cards: [], agreements: [] };
        } finally {
            isLoading = false;
        }
    }
    
    // Logic to load the current user's actor in this game
    /**
     * Load the user's actor in the current game using cached data
     * This implementation optimizes actor lookup by using the cached data from loadGameData
     * instead of making redundant Gun.js requests
     */
    async function loadUserActor() {
        if (!game || !$userStore.user) return null;
        
        try {
            const userId = $userStore.user.user_id;
            log(`Looking up actor for user ${userId} in game ${gameId} using cached data`);
            
            // We already imported actorCache at the top of the file
            
            // Define a common function to set the actor data and return it
            const setActor = (actor: Actor) => {
                playerRole = actor;
                if (actor.actor_id) {
                    activeActorId.set(actor.actor_id);
                    localStorage.setItem(`game_${gameId}_actor`, actor.actor_id);
                }
                return actor;
            };
            
            // 1. First check if we have a valid actor ID in localStorage
            // but don't trust it blindly - we'll validate it against the cache or database
            const savedActorId = localStorage.getItem(`game_${gameId}_actor`);
            if (savedActorId) {
                log(`Found actor ID in localStorage: ${savedActorId}, validating...`);
                
                // Check if this actor exists in the cache
                if (actorCache.has(savedActorId)) {
                    const cachedActor = actorCache.get(savedActorId);
                    if (cachedActor && (cachedActor.user_id === userId || !cachedActor.user_id)) {
                        log(`Found valid actor in cache: ${savedActorId}`);
                        return setActor(cachedActor);
                    }
                }
            }
            
            // 2. Use the actors we already loaded in loadGameData
            // This avoids making additional Gun.js queries
            log(`Getting actors for game ${gameId} from cache`);
            const actors = await getGameActors(gameId);
            log(`Retrieved ${actors.length} actors from cache`);
            
            // Find actor assigned to the current user
            if (actors.length > 0) {
                const userActor = actors.find(a => a.user_id === userId);
                if (userActor) {
                    log(`Found user actor: ${userActor.actor_id}`);
                    return setActor(userActor);
                }
                
                // If we have a saved actor ID, look for it in the actors list
                if (savedActorId) {
                    const savedActor = actors.find(a => a.actor_id === savedActorId);
                    if (savedActor) {
                        log(`Found saved actor ${savedActor.actor_id} in actors list`);
                        return setActor(savedActor);
                    }
                }
            }
            
            // 3. Check if the game's player_actor_map has a mapping for this user
            if (game.player_actor_map && typeof game.player_actor_map === 'object') {
                // Check if it's a regular object (not a Gun reference)
                const isGunRef = game.player_actor_map['#'] && typeof game.player_actor_map['#'] === 'string';
                
                if (!isGunRef && userId in game.player_actor_map) {
                    const mappedActorId = game.player_actor_map[userId];
                    log(`Found actor ID ${mappedActorId} in player_actor_map`);
                    
                    // Check if this actor ID is already in the cache
                    if (mappedActorId && actorCache.has(mappedActorId)) {
                        const actor = actorCache.get(mappedActorId);
                        if (actor) {
                            log(`Found actor in cache: ${mappedActorId}`);
                            return setActor(actor);
                        }
                    }
                    
                    // If not in cache, try to get it with getPlayerRole
                    if (mappedActorId) {
                        try {
                            const actor = await getPlayerRole(gameId, userId, mappedActorId);
                            if (actor) {
                                log(`Retrieved actor ${actor.actor_id} with getPlayerRole`);
                                return setActor(actor);
                            }
                        } catch (err) {
                            log(`Error getting actor: ${err}`);
                        }
                    }
                }
            }
            
            // 4. Handle Gun.js reference in player_actor_map (if needed)
            if (game.player_actor_map && typeof game.player_actor_map === 'object' && 
                game.player_actor_map['#'] && typeof game.player_actor_map['#'] === 'string') {
                
                log('player_actor_map is a Gun.js reference, trying getPlayerRole directly');
                
                // Use getPlayerRole directly if we have a valid actor ID in localStorage
                if (savedActorId) {
                    try {
                        // Just try once with a timeout - we've already tried other methods
                        log(`Attempting getPlayerRole once with actor ID ${savedActorId}`);
                        
                        const rolePromise = getPlayerRole(gameId, userId, savedActorId);
                        const roleTimeout = new Promise<null>((resolve) => {
                            setTimeout(() => {
                                log('getPlayerRole timed out after 2 seconds');
                                resolve(null);
                            }, 2000);
                        });
                        
                        const actor = await Promise.race([rolePromise, roleTimeout]);
                        
                        if (actor) {
                            log(`Successfully retrieved actor ${actor.actor_id} with getPlayerRole`);
                            return setActor(actor);
                        } else {
                            log(`Could not retrieve actor ${savedActorId} - removing from localStorage`);
                            localStorage.removeItem(`game_${gameId}_actor`);
                        }
                    } catch (error) {
                        log(`Error using getPlayerRole: ${error}`);
                        localStorage.removeItem(`game_${gameId}_actor`);
                    }
                }
            }
            
            // 5. As last resort, fall back to direct lookup against Gun.js
            try {
                log('Falling back to direct Gun.js reference resolution');
                
                if (game.player_actor_map && typeof game.player_actor_map === 'object' && 
                    game.player_actor_map['#'] && typeof game.player_actor_map['#'] === 'string') {
                    
                    const mapPath = game.player_actor_map['#'];
                    const gun = getGun();
                            
                    // Create a non-undefined player_actor_map if it doesn't exist
                    gun.get(mapPath).put({}, (ack) => {
                        if (ack.err) {
                            log('Error initializing player_actor_map:', ack.err);
                        } else {
                            log('player_actor_map initialized successfully');
                        }
                    });
                    
                    // Use a direct lookup with the user ID as key
                    const mappedActorId = await new Promise<string | null>((resolve) => {
                        gun.get(mapPath).get(userId).once((actorId: string) => {
                            if (actorId) {
                                log(`Direct map lookup found: ${userId} -> ${actorId}`);
                                resolve(actorId);
                            } else {
                                log(`Direct map lookup found no mapping for user ${userId}`);
                                resolve(null);
                            }
                        });
                        
                        // Also set a timeout to avoid hanging
                        setTimeout(() => resolve(null), 1000);
                    });
                            
                    if (mappedActorId) {
                        log(`Found actor mapping via direct Gun.js lookup: user ${userId} -> actor ${mappedActorId}`);
                        
                        try {
                            // Use getPlayerRole with retry logic
                            log(`Attempting to get player role with getPlayerRole(${gameId}, ${userId}, ${mappedActorId})`);
                            
                            // Define retry settings if not already defined
                            const maxAttempts = 2;
                            const backoffMs = 500;
                            
                            let mappedActor = null;
                            
                            // Try up to maxAttempts times with backoff
                            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                                try {
                                    log(`getPlayerRole attempt ${attempt}/${maxAttempts}`);
                                    const rolePromise = getPlayerRole(gameId, userId, mappedActorId);
                                    const roleTimeout = new Promise<null>((resolve) => {
                                        setTimeout(() => {
                                            log(`getPlayerRole attempt ${attempt} timed out`);
                                            resolve(null);
                                        }, 2000);
                                    });
                                    
                                    mappedActor = await Promise.race([rolePromise, roleTimeout]);
                                    
                                    if (mappedActor) {
                                        log(`Successfully retrieved mapped actor ${mappedActor.actor_id} on attempt ${attempt}`);
                                        break; // Success, exit the retry loop
                                    } else if (attempt < maxAttempts) {
                                        log(`Retry attempt ${attempt} failed, waiting ${backoffMs}ms before next attempt`);
                                        await new Promise(resolve => setTimeout(resolve, backoffMs));
                                    }
                                } catch (retryErr) {
                                    log(`Error in getPlayerRole retry attempt ${attempt}:`, retryErr);
                                    if (attempt < maxAttempts) {
                                        log(`Will retry after ${backoffMs}ms`);
                                        await new Promise(resolve => setTimeout(resolve, backoffMs));
                                    }
                                }
                            }
                            
                            // Do not create fallback actors with incomplete data
                            if (!mappedActor) {
                                log(`All getPlayerRole attempts failed for actor ${mappedActorId}. Not creating fallback actor.`);
                                // Remove invalid actor ID from localStorage
                                localStorage.removeItem(`game_${gameId}_actor`);
                            }
                            
                            if (mappedActor) {
                                log(`Using actor ${mappedActor.actor_id}`);
                                playerRole = mappedActor;
                                activeActorId.set(mappedActor.actor_id);
                                
                                // Store in localStorage for additional redundancy
                                localStorage.setItem(`game_${gameId}_actor`, mappedActor.actor_id);
                                
                                return mappedActor;
                            } else {
                                log(`getPlayerRole returned null for actor ${mappedActorId}`);
                            }
                        } catch (mappingErr) {
                            log('Error retrieving mapped actor:', mappingErr);
                        }
                    }
                }
            } catch (directErr) {
                log('Error with direct Gun.js access:', directErr);
            }
            
            // Normal object (not a reference)
            else if (game.player_actor_map && typeof game.player_actor_map === 'object' && 
                    !game.player_actor_map['#'] && game.player_actor_map[userId]) {
                const mappedActorId = game.player_actor_map[userId];
                log(`Found actor mapping in game object: user ${userId} -> actor ${mappedActorId}`);
                
                try {
                    // Define retry settings
                    const maxAttempts = 2;
                    const backoffMs = 500;
                    
                    // Use getPlayerRole with retry logic
                    log(`Attempting to get player role with getPlayerRole(${gameId}, ${userId}, ${mappedActorId})`);
                    
                    let mappedActor = null;
                    
                    // Try up to maxAttempts times with backoff
                    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                        try {
                            log(`getPlayerRole attempt ${attempt}/${maxAttempts}`);
                            const rolePromise = getPlayerRole(gameId, userId, mappedActorId);
                            const roleTimeout = new Promise<null>((resolve) => {
                                setTimeout(() => {
                                    log(`getPlayerRole attempt ${attempt} timed out`);
                                    resolve(null);
                                }, 2000);
                            });
                            
                            mappedActor = await Promise.race([rolePromise, roleTimeout]);
                            
                            if (mappedActor) {
                                log(`Successfully retrieved mapped actor ${mappedActor.actor_id} on attempt ${attempt}`);
                                break; // Success, exit the retry loop
                            } else if (attempt < maxAttempts) {
                                log(`Retry attempt ${attempt} failed, waiting ${backoffMs}ms before next attempt`);
                                await new Promise(resolve => setTimeout(resolve, backoffMs));
                            }
                        } catch (retryErr) {
                            log(`Error in getPlayerRole retry attempt ${attempt}:`, retryErr);
                            if (attempt < maxAttempts) {
                                log(`Will retry after ${backoffMs}ms`);
                                await new Promise(resolve => setTimeout(resolve, backoffMs));
                            }
                        }
                    }
                    
                    // Do not create fallback actors with incomplete data
                    if (!mappedActor && savedActorId) {
                        log(`All getPlayerRole attempts failed for actor ${savedActorId}. Not creating fallback actor.`);
                        // Remove invalid actor ID from localStorage
                        localStorage.removeItem(`game_${gameId}_actor`);
                    }
                    
                    if (mappedActor) {
                        log(`Using actor ${mappedActor.actor_id} from ${savedActorId ? "localStorage fallback" : "role retrieval"}`);
                        playerRole = mappedActor;
                        activeActorId.set(mappedActor.actor_id);
                        return mappedActor;
                    } else {
                        log(`getPlayerRole returned null for actor ${mappedActorId}`);
                    }
                } catch (mappingErr) {
                    log('Error retrieving mapped actor:', mappingErr);
                }
            } else {
                log(`No mapping found for user ${userId} in player_actor_map`);
            }
        } else {
            log('Game does not have a player_actor_map property');
            
            // If we have a saved actor ID, try one last direct lookup
            if (savedActorId) {
                log(`Attempting direct Gun.js update to create missing player_actor_map with user ${userId} -> actor ${savedActorId}`);
                
                // Create player_actor_map with the saved actor as a fire-and-forget operation
                try {
                    const gun = getGun();
                            
                            // Initialize player_actor_map with empty object to ensure it exists
                    log('Creating player_actor_map node');
                    const gameNode = gun.get(nodes.games).get(gameId);
                    
                    await new Promise<void>(resolve => {
                        gameNode.get('player_actor_map').put({}, ack => {
                            if (ack.err) {
                                log('Error creating player_actor_map node:', ack.err);
                            } else {
                                log('Successfully created player_actor_map node');
                            }
                            resolve();
                        });
                        
                        // Timeout to avoid hanging
                        setTimeout(resolve, 500);
                    });
                    
                    // Map the user to the actor
                    const userActorMap: Record<string, string> = {};
                    userActorMap[userId] = savedActorId;
                    
                    log(`Setting player_actor_map with ${userId} -> ${savedActorId}`);
                    
                    // Then set the specific mapping
                    await new Promise<void>(resolve => {
                        gameNode.get('player_actor_map').put(userActorMap, ack => {
                            if (ack.err) {
                                log('Error setting user->actor mapping:', ack.err);
                            } else {
                                log('Successfully mapped user to actor');
                            }
                            resolve();
                        });
                        
                        // Timeout to avoid hanging
                        setTimeout(resolve, 500);
                    });
                    
                    // Now try to get the actor data
                    try {
                        // Use getPlayerRole with retry logic (2 attempts, 500ms backoff)
                        log(`Attempting final getPlayerRole attempt with retry logic - actor ${savedActorId}`);
                        
                        let actor = null;
                        
                        // Define retry settings
                        const maxAttempts = 2;
                        const backoffMs = 500;
                        
                        // Try up to maxAttempts times with backoff
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            try {
                                log(`Final getPlayerRole attempt ${attempt}/${maxAttempts}`);
                                const rolePromise = getPlayerRole(gameId, userId, savedActorId);
                                const roleTimeout = new Promise<null>((resolve) => {
                                    setTimeout(() => {
                                        log(`Final getPlayerRole attempt ${attempt} timed out`);
                                        resolve(null);
                                    }, 2000);
                                });
                                
                                actor = await Promise.race([rolePromise, roleTimeout]);
                                
                                if (actor) {
                                    log(`Successfully retrieved actor ${actor.actor_id} on final attempt ${attempt}`);
                                    break; // Success, exit the retry loop
                                } else if (attempt < maxAttempts) {
                                    log(`Final retry attempt ${attempt} failed, waiting ${backoffMs}ms before next attempt`);
                                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                                }
                            } catch (retryErr) {
                                log(`Error in final getPlayerRole retry attempt ${attempt}:`, retryErr);
                                if (attempt < maxAttempts) {
                                    log(`Will retry after ${backoffMs}ms`);
                                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                                }
                            }
                        }
                        
                        // Do not create fallback actors with incomplete data
                        if (!actor) {
                            log(`All final getPlayerRole attempts failed for actor ${savedActorId}. Not creating fallback actor.`);
                            // Remove invalid actor ID from localStorage
                            localStorage.removeItem(`game_${gameId}_actor`);
                        }
                        
                        if (actor) {
                            log(`Using actor ${actor.actor_id} after fixing player_actor_map`);
                            playerRole = actor;
                            activeActorId.set(actor.actor_id);
                            return actor;
                        }
                    } catch (actorErr) {
                        log('Error getting actor after fixing player_actor_map:', actorErr);
                    }
                } catch (err) {
                    log('Error fixing missing player_actor_map:', err);
                }
            }
                }
            } catch (mapErr) {
                log('Error accessing player_actor_map:', mapErr);
            }
            
            log('No actor found for current user');
            return null;
            
        } catch (err) {
            log('Error loading user actor:', err);
            return null;
        }
    }
    
    // Handle joining a game
    async function handleJoinGame() {
        if (!game) return;
        
        try {
            isJoining = true;
            error = '';
            
            // Simple safe redirect to details page with error handling
            try {
                await goto(`/games/${gameId}/details`);
                log('Navigation to game details successful');
            } catch (navError) {
                log('Navigation error redirecting to details page:', navError);
                // Try fallback navigation
                window.location.href = `/games/${gameId}/details`;
            }
        } catch (err) {
            log('Error in handleJoinGame:', err);
            error = 'An error occurred. Please try again.';
        } finally {
            isJoining = false;
        }
    }
    
    // Check if the current user is part of this game
    // Don't create temporary actors - they cause data inconsistency issues
    // Instead, validate and fetch real Actor data from the database
    
    // Function to enhance actor data in the background (safe to call from template)
    function enhanceActorInBackground(gameId: string, userId: string): void {
        setTimeout(() => {
            getPlayerRole(gameId, userId)
                .then(fullActor => {
                    if (fullActor) {
                        log('Enhanced minimal actor with full data');
                        playerRole = fullActor;
                    }
                })
                .catch(err => log('Background actor enhancement failed:', err));
        }, 1000);
    }
    
    // Separate function to fetch actor data from player_actor_map
    function fetchPlayerRoleFromMapping(gameId: string, userId: string): void {
        setTimeout(() => {
            getPlayerRole(gameId, userId)
                .then(fullActor => {
                    if (fullActor) {
                        log('Retrieved actor from player_actor_map');
                        playerRole = fullActor;
                        activeActorId.set(fullActor.actor_id);
                        localStorage.setItem(`game_${gameId}_actor`, fullActor.actor_id);
                    }
                })
                .catch(err => log('Background actor fetch failed:', err));
        }, 500);
    }
    
    // State to track if user is in game - separate from the checking logic
    let userInGame = $state(false);
    
    // Function to CHECK if user is in game WITHOUT modifying state
    // This returns boolean only, doesn't modify any state
    function checkIfUserInGame(): boolean {
        if (!game || !$userStore.user) return false;
        
        const userId = $userStore.user.user_id;
        
        // Check localStorage for a saved actor ID for this game
        const savedActorId = localStorage.getItem(`game_${gameId}_actor`);
        if (savedActorId) {
            return true;
        }
        
        // Check if player is in the players array/object
        let isInPlayers = false;
        if (game.players) {
            if (Array.isArray(game.players)) {
                isInPlayers = game.players.includes(userId);
            } else {
                isInPlayers = Boolean(game.players[userId]);
            }
        }
        
        // If they have a role assigned, they're definitely in the game
        const hasRole = playerRole !== null;
        
        // Check for player_actor_map entry as a fallback
        let hasMapping = false;
        if (game.player_actor_map && game.player_actor_map[userId]) {
            hasMapping = true;
        }
        
        return isInPlayers || hasRole || hasMapping;
    }
    
    // Function to SETUP user in game - handles all state mutations
    // This can be called from outside template expressions
    function setupUserInGame() {
        if (!game || !$userStore.user) return;
        
        const userId = $userStore.user.user_id;
        
        // ENHANCED CHECK: First check localStorage for a saved actor ID for this game
        const savedActorId = localStorage.getItem(`game_${gameId}_actor`);
        if (savedActorId) {
            log(`Found saved actor ID in localStorage: ${savedActorId}`);
            
            // If we have a saved actor ID but no playerRole, validate it
            if (!playerRole) {
                // Set the activeActorId to retrieve data, but don't set the
                // playerRole until we've validated the actor exists
                activeActorId.set(savedActorId);
                
                // Immediately start loading actual player data
                getPlayerRole(gameId, userId, savedActorId)
                    .then(fullActor => {
                        if (fullActor) {
                            log(`Retrieved complete actor data for ${savedActorId}`);
                            playerRole = fullActor;
                        } else {
                            log(`Invalid actor ID in localStorage: ${savedActorId}, removing`);
                            localStorage.removeItem(`game_${gameId}_actor`);
                            userInGame = false;
                        }
                    })
                    .catch(err => {
                        log(`Error retrieving actor ${savedActorId}: ${err}`);
                        localStorage.removeItem(`game_${gameId}_actor`);
                        userInGame = false;
                    });
            }
            
            userInGame = true;
            return;
        }
        
        // Check for player_actor_map entry as a fallback
        if (game.player_actor_map && game.player_actor_map[userId] && !playerRole) {
            log('Found player_actor_map entry but no playerRole, fetching in background');
            fetchPlayerRoleFromMapping(gameId, userId);
            userInGame = true;
            return;
        }
        
        // Update the userInGame state based on the other checks
        userInGame = checkIfUserInGame();
    }
</script>

<div class="game-page-wrapper w-full h-full m-0 p-0 overflow-hidden">
    {#if isLoading}
        <div class="flex justify-center items-center h-full">
            <div class="card p-8 text-center bg-surface-200-700-token/30 max-w-md">
                <div class="flex flex-col items-center">
                    <div class="spinner-third w-10 h-10 text-primary-500 m-4"></div>
                    <p class="text-lg">Loading game...</p>
                </div>
            </div>
        </div>
    {:else if error}
        <div class="flex justify-center items-center h-full">
            <div class="card p-8 max-w-md">
                <div class="alert variant-filled-error">
                    <icons.AlertCircle size={24} class="mr-2" />
                    <p>{error}</p>
                </div>
                <div class="flex justify-center mt-6">
                    <a href="/games" class="btn variant-filled-surface">
                        <icons.ArrowLeft size={18} class="mr-2" />
                        Back to Games
                    </a>
                </div>
            </div>
        </div>
    {:else if game}
        {#if userInGame}
            <GamePageLayout {game} {gameId} {playerRole} />
        {:else}
            <div class="flex justify-center items-center h-full">
                <div class="card p-8 m-4 text-center max-w-lg">
                    <h1 class="h2 mb-2">{game.name}</h1>
                    <div class="badge {game.status === GameStatus.ACTIVE ? 'variant-filled-success' : 'variant-filled-primary'} mb-4">
                        {game.status}
                    </div>
                    <p class="text-sm mb-6">
                        Created: {new Date(game.created_at).toLocaleDateString()}
                    </p>
                    
                    <div class="card p-8 text-center bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                        <h3 class="h3">Join the Game</h3>
                        <p class="mt-4">You need to join this game to view the game board and interact with other players.</p>
                        
                        <div class="flex flex-col sm:flex-row gap-2 mt-6 justify-center">
                            <button 
                                class="btn variant-filled-primary" 
                                onclick={async () => {
                                    try {
                                        await goto(`/games/${gameId}/join`);
                                        log('Navigation to join page successful');
                                    } catch (navError) {
                                        log('Navigation error going to join page:', navError);
                                        window.location.href = `/games/${gameId}/join`;
                                    }
                                }}
                                disabled={isJoining}
                            >
                                {#if isJoining}
                                    <div class="spinner-third w-4 h-4 mr-2"></div>
                                    Joining...
                                {:else}
                                    <icons.UserPlus size={18} class="mr-2" />
                                    Join Game
                                {/if}
                            </button>
                            
                            <button class="btn variant-ghost" onclick={async () => {
                                try {
                                    await goto(`/games/${gameId}/details`);
                                    log('Navigation to details page successful');
                                } catch (navError) {
                                    log('Navigation error going to details page:', navError);
                                    window.location.href = `/games/${gameId}/details`;
                                }
                            }}>
                                <icons.Info size={18} class="mr-2" />
                                Game Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    {:else}
        <div class="flex justify-center items-center h-full">
            <div class="card p-8 max-w-md">
                <div class="alert variant-filled-error">
                    <icons.AlertCircle size={24} class="mr-2" />
                    <p>Unable to load game data.</p>
                </div>
                <div class="flex justify-center mt-6">
                    <a href="/games" class="btn variant-filled-surface">
                        <icons.ArrowLeft size={18} class="mr-2" />
                        Back to Games
                    </a>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
  /* Override parent container styles to achieve full width/height without padding or margins */
  :global(main.flex.grow.container.mx-auto.p-4) {
    padding: 0 !important;
    margin: 0 !important;
    max-width: none !important;
    width: 100vw !important;
    height: calc(100vh - var(--app-bar-height, 64px)) !important;
    overflow: hidden !important;
  }
  
  .game-page-wrapper {
    position: absolute;
    top: var(--app-bar-height, 64px); /* Position below the main site header */
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw !important;
    height: calc(100vh - var(--app-bar-height, 64px)) !important; 
  }
</style>