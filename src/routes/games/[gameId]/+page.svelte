<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { currentGameStore } from '$lib/stores/gameStore';
    import { activeActorId } from '$lib/stores/enhancedGameStore';
    import { getGame, subscribeToGame, getGameActors, getUserCard, joinGame, getPlayerRole } from '$lib/services/gameService';
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
        loadGameData();
        
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
            // Load the game with timeout protection
            const gameLoadPromise = getGame(gameId);
            
            // Set a timeout for loading to prevent infinite waiting
            const timeout = new Promise<null>((resolve) => {
                setTimeout(() => {
                    log('Game loading timed out after 3 seconds');
                    resolve(null);
                }, 3000);
            });
            
            // Race between loading and timeout
            game = await Promise.race([gameLoadPromise, timeout]);
            
            if (!game) {
                error = 'Game not found or loading timed out. Please try refreshing the page.';
                isLoading = false;
                return;
            }
            
            // Store it for the app 
            currentGameStore.set(game);
            
            // Set up real-time updates
            unsubscribe = subscribeToGame(gameId, (updatedGame) => {
                if (updatedGame) {
                    game = updatedGame;
                    currentGameStore.set(updatedGame);
                }
            });
            
            // Load the user's role in this game (if any) with timeout protection
            const userActorPromise = loadUserActor();
            const userActorTimeout = new Promise<void>((resolve) => {
                setTimeout(() => {
                    log('User actor loading timed out after 3 seconds');
                    resolve();
                }, 3000);
            });
            
            // Don't wait indefinitely for user actor
            await Promise.race([userActorPromise, userActorTimeout]);
        } catch (err) {
            log('Error loading game data:', err);
            error = 'Failed to load game data. Please try refreshing the page.';
        } finally {
            isLoading = false;
        }
    }
    
    // Logic to load the current user's actor in this game
    async function loadUserActor() {
        if (!game || !$userStore.user) return null;
        
        try {
            const userId = $userStore.user.user_id;
            log(`Loading user ${userId} actor for game ${gameId}`);
            
            // Define retry settings
            const maxAttempts = 2;
            const backoffMs = 500;
            
            // Create a timeout for the entire function
            const globalTimeout = setTimeout(() => {
                log('loadUserActor timed out globally after 10 seconds');
                isLoading = false; // Force loading to complete even if actor not found
            }, 10000);
            
            // First look for the user's actor among game actors with timeout protection
            const actorsPromise = getGameActors(gameId);
            const actorsTimeout = new Promise<Actor[]>((resolve) => {
                setTimeout(() => {
                    log('getGameActors timed out after 3 seconds');
                    resolve([]);
                }, 3000);
            });
            
            const actors = await Promise.race([actorsPromise, actorsTimeout]);
            log(`Found ${actors.length} actors in game`);
            
            // Find actor assigned to the current user
            if (actors.length > 0) {
                const userActor = actors.find(a => a.user_id === userId);
                if (userActor) {
                    log(`Found user actor: ${userActor.actor_id}`);
                    playerRole = userActor;
                    
                    // Store the active actor ID
                    if (userActor.actor_id) {
                        activeActorId.set(userActor.actor_id);
                        
                        // Also store in localStorage for persistence
                        localStorage.setItem(`game_${gameId}_actor`, userActor.actor_id);
                    }
                    
                    return userActor;
                }
            }
            
            // If no actor found by direct lookup, try localStorage (from previous sessions)
            const savedActorId = localStorage.getItem(`game_${gameId}_actor`);
            if (savedActorId) {
                log(`Checking saved actor ID from localStorage: ${savedActorId}`);
                
                // Look up this actor in the game actors list
                const savedActor = actors.find(a => a.actor_id === savedActorId);
                if (savedActor) {
                    log(`Found actor from localStorage: ${savedActor.actor_id}`);
                    playerRole = savedActor;
                    activeActorId.set(savedActor.actor_id);
                    return savedActor;
                }
                
                // Check if we just joined with an actor from a different game
                // This is a critical check for actors being reused across games
                if (game.player_actor_map && game.player_actor_map[userId] === savedActorId) {
                    log(`Found actor ${savedActorId} in game's player_actor_map`);
                    
                    // Import the actor into this game's context
                    try {
                        // Get the complete actor data
                        const importedActor = await getPlayerRole(gameId, userId, savedActorId);
                        
                        if (importedActor) {
                            log(`Successfully retrieved actor ${importedActor.actor_id}`);
                            playerRole = importedActor;
                            activeActorId.set(importedActor.actor_id);
                            return importedActor;
                        }
                    } catch (importErr) {
                        log('Error importing actor:', importErr);
                    }
                }
            }
            
            // Check game's player_actor_map as a last resort
            try {
                if (game.player_actor_map) {
                    log('Checking game.player_actor_map:', JSON.stringify(game.player_actor_map));
                    
                    // Check if player_actor_map is a Gun.js reference or regular object
                    // These show up as an object with a # property: {"#": "games/gameId/player_actor_map"}
                    const isGunRef = typeof game.player_actor_map === 'object' && 
                                   game.player_actor_map['#'] && 
                                   typeof game.player_actor_map['#'] === 'string';
                    
                    // There are two approaches to handle player_actor_map:
                    // 1. If it's a Gun.js reference, we need to resolve it 
                    // 2. If it's a regular object, we can access it directly
                    
                    if (isGunRef) {
                        log('player_actor_map is a Gun.js reference, trying getPlayerRole first');
                        
                        // Let's try to use getPlayerRole function directly first (safer)
                        try {
                            if (savedActorId) {
                                // Use getPlayerRole with retry logic (2 attempts, 500ms backoff)
                                log(`Attempting getPlayerRole with retry logic - actor ${savedActorId}`);
                                
                                let actorFromRole = null;
                                
                                // Try up to maxAttempts times with backoff
                                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                                    try {
                                        log(`getPlayerRole attempt ${attempt}/${maxAttempts}`);
                                        const rolePromise = getPlayerRole(gameId, userId, savedActorId);
                                        const roleTimeout = new Promise<null>((resolve) => {
                                            setTimeout(() => {
                                                log(`getPlayerRole attempt ${attempt} timed out`);
                                                resolve(null);
                                            }, 2000);
                                        });
                                        
                                        actorFromRole = await Promise.race([rolePromise, roleTimeout]);
                                        
                                        if (actorFromRole) {
                                            log(`Successfully retrieved actor ${actorFromRole.actor_id} on attempt ${attempt}`);
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
                                
                                // Fall back to localStorage if all retry attempts failed
                                if (!actorFromRole) {
                                    log(`All getPlayerRole attempts failed, falling back to basic actor with savedActorId: ${savedActorId}`);
                                    // This is a basic placeholder actor with just the ID
                                    actorFromRole = { 
                                        actor_id: savedActorId,
                                        game_id: gameId,
                                        user_id: userId
                                    } as Actor;
                                }
                                
                                if (actorFromRole) {
                                    log(`Using actor ${actorFromRole.actor_id}`);
                                    playerRole = actorFromRole;
                                    activeActorId.set(actorFromRole.actor_id);
                                    return actorFromRole;
                                }
                            }
                        } catch (roleErr) {
                            log('Error using getPlayerRole:', roleErr);
                        }
                        
                        // Fall back to direct lookup only as a last resort
                        try {
                            log('Falling back to direct Gun.js reference resolution');
                            
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
                                    // Use getPlayerRole with retry logic (2 attempts, 500ms backoff)
                                    log(`Attempting to get player role with getPlayerRole(${gameId}, ${userId}, ${mappedActorId}) with retries`);
                                    
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
                                    
                                    // Fall back to basic actor if all retry attempts failed
                                    if (!mappedActor) {
                                        log(`All getPlayerRole attempts failed, falling back to basic actor with mappedActorId: ${mappedActorId}`);
                                        // This is a basic placeholder actor with just the ID
                                        mappedActor = { 
                                            actor_id: mappedActorId,
                                            game_id: gameId,
                                            user_id: userId
                                        } as Actor;
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
                        } catch (directErr) {
                            log('Error with direct Gun.js access:', directErr);
                        }
                    }
                    
                    // Normal object (not a reference)
                    else if (game.player_actor_map[userId]) {
                        const mappedActorId = game.player_actor_map[userId];
                        log(`Found actor mapping in game object: user ${userId} -> actor ${mappedActorId}`);
                        
                        try {
                            // Use getPlayerRole with retry logic (2 attempts, 500ms backoff)
                            log(`Attempting to get player role with getPlayerRole(${gameId}, ${userId}, ${mappedActorId}) with retries`);
                            
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
                            
                            // Fall back to localStorage if all retry attempts failed
                            if (!mappedActor && savedActorId) {
                                log(`All getPlayerRole attempts failed, falling back to localStorage actorId: ${savedActorId}`);
                                // This is a basic placeholder actor with just the ID
                                mappedActor = { 
                                    actor_id: savedActorId,
                                    game_id: gameId,
                                    user_id: userId
                                } as Actor;
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
                                
                                // Fall back to basic actor if all retry attempts failed
                                if (!actor) {
                                    log(`All final getPlayerRole attempts failed, falling back to basic actor with savedActorId: ${savedActorId}`);
                                    // This is a basic placeholder actor with just the ID
                                    actor = { 
                                        actor_id: savedActorId,
                                        game_id: gameId,
                                        user_id: userId
                                    } as Actor;
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
    // Function to create a temporary actor from localStorage data
    function createTemporaryActor(savedActorId: string, userId: string): Actor {
        log('Creating temporary playerRole from localStorage data');
        // Create a minimal Actor object to allow game access
        return {
            actor_id: savedActorId,
            user_id: userId,
            game_id: gameId,
            actor_type: 'National Identity',
            created_at: Date.now()
        };
    }
    
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
    
    function isCurrentUserInGame(): boolean {
        if (!game || !$userStore.user) return false;
        
        const userId = $userStore.user.user_id;
        
        // ENHANCED CHECK: First check localStorage for a saved actor ID for this game
        // This is the most reliable method, as it persists through page refreshes
        const savedActorId = localStorage.getItem(`game_${gameId}_actor`);
        if (savedActorId) {
            log(`Found saved actor ID in localStorage: ${savedActorId}`);
            
            // If we have a saved actor ID but no playerRole, force-set a temporary one
            // in a separate function call (not inside the template expression)
            if (!playerRole) {
                // Create a temporary actor object
                playerRole = createTemporaryActor(savedActorId, userId);
                
                // Also set the activeActorId to ensure consistency
                activeActorId.set(savedActorId);
                
                // Schedule a background check to enhance this minimal actor data
                // Using a separate function to avoid template mutations
                enhanceActorInBackground(gameId, userId);
            }
            
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
            
            // If we have a mapping but no role, schedule a background fetch
            // Using a safe approach that doesn't mutate state in a template expression
            if (!playerRole) {
                log('Found player_actor_map entry but no playerRole, fetching in background');
                fetchPlayerRoleFromMapping(gameId, userId);
            }
        }
        
        return isInPlayers || hasRole || hasMapping;
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
        {#if isCurrentUserInGame()}
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