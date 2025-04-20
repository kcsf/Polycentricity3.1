import { getGun, nodes, generateId, createRelationship } from './gunService';
import { getCurrentUser } from './authService';
import type { Game, Actor, Card, Agreement, AgreementWithPosition } from '../types';
import { GameStatus } from '../types';
import { getPredefinedDeck } from '../data/predefinedDecks';
import { get } from 'svelte/store';
import { currentGameStore, setUserGames } from '../stores/gameStore';

// Caches for performance
const gameCache = new Map<string, Game>();
const actorCache = new Map<string, Actor>();
const cardCache = new Map<string, Card>();
const agreementCache = new Map<string, AgreementWithPosition>();
const roleCache = new Map<string, string>(); // gameId:userId -> actorId

// Export caches for external use
export { actorCache, cardCache, agreementCache };

// REMOVED: Helper function to get an actor by ID (getActorById)
// Replaced with getPlayerRole or getUserActors as these provide more comprehensive checks
// and better cache management with retries

// Conditional logging
const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
const log = (...args: any[]) => isDev && console.log('[gameService]', ...args);
const logWarn = (...args: any[]) => isDev && console.warn('[gameService]', ...args);
const logError = (...args: any[]) => console.error('[gameService]', ...args);

// Cache helpers
function cacheGame(gameId: string, game: Game): void {
  gameCache.set(gameId, { ...game, game_id: gameId });
}

function cacheActor(actorId: string, actor: Actor): void {
  actorCache.set(actorId, { ...actor, actor_id: actorId });
}

function cacheCard(cardId: string, card: Card): void {
  cardCache.set(cardId, { ...card, card_id: cardId });
}

function cacheRole(gameId: string, userId: string, actorId: string): void {
  const key = `${gameId}:${userId}`;
  roleCache.set(key, actorId);
}

// Create a new game with improved reliability and performance - FIRE AND FORGET approach
export async function createGame(
  name: string,
  deckType: string,
  roleAssignmentType: string = 'random'
): Promise<Game | null> {
  try {
    log(`Creating game: ${name} with deck type: ${deckType}`);
    const gun = getGun();
    let currentUser = getCurrentUser();

    if (!currentUser) {
      logWarn('No authenticated user. Using mock user for development');
      currentUser = {
        user_id: 'u838', // Consistent ID for development to make debugging easier
        name: 'Development User',
        email: 'dev@example.com',
        created_at: Date.now(),
        role: 'Guest'
      };
    }

    if (!gun) {
      logError('Gun not initialized');
      return null;
    }

    // Generate a new game ID
    const game_id = generateId();
    log(`Generated game ID: ${game_id}`);
    
    // Create the core game data structure
    const gameData: Game = {
      game_id,
      name,
      creator: currentUser.user_id,
      deck_type: deckType,
      deck_id: deckType === 'eco-village' ? 'd1' : deckType === 'community-garden' ? 'd2' : 'd1',
      role_assignment_type: roleAssignmentType,
      role_assignment: {},
      players: { [currentUser.user_id]: true },
      // IMPORTANT: Always initialize player_actor_map as empty object
      player_actor_map: {},
      created_at: Date.now(),
      status: GameStatus.ACTIVE // Always set to ACTIVE immediately
    };

    // CRITICAL OPTIMIZATION: Immediately cache the game data and update current game store
    // This ensures the UI can update immediately without waiting for Gun.js
    cacheGame(game_id, gameData);
    currentGameStore.set(gameData);

    // TRUE FIRE-AND-FORGET APPROACH
    // Only use a single promise for the core game data, all other writes 
    // happen in the background without waiting
    const gameNode = gun.get(nodes.games).get(game_id);
    const writeStart = performance.now();
    
    try {
      // ONLY PRIMARY WRITE with very short timeout - must store the core game data
      // All other operations are truly fire-and-forget
      await new Promise<void>((resolve) => {
        // Set a very short timeout to prevent UI hanging
        const writeTimeout = setTimeout(() => {
          log('Primary game data write timed out, proceeding anyway');
          resolve(); // Always resolve to prevent UI hanging
        }, 800); // Reduced timeout for better UI responsiveness
        
        gameNode.put({
          game_id,
          name,
          creator: currentUser.user_id,
          deck_type: deckType,
          deck_id: deckType === 'eco-village' ? 'd1' : deckType === 'community-garden' ? 'd2' : 'd1',
          role_assignment_type: roleAssignmentType,
          created_at: Date.now(),
          status: GameStatus.ACTIVE, // Always ACTIVE immediately
          players: { [currentUser.user_id]: true },
          player_actor_map: {} // Initialize empty but consistent object
        }, () => {
          clearTimeout(writeTimeout);
          log('Primary game data write completed');
          resolve();
        });
      });
      
      log(`Primary game data wrote in ${performance.now() - writeStart}ms`);
      
      // ALL SECONDARY WRITES - completely fire and forget (pure optimistic approach)
      // No need to wait for any of these to complete - they happen in the background
      
      // User → game relationship
      gun.get(nodes.users).get(currentUser.user_id).get('games').set(gun.get(nodes.games).get(game_id) as any);
      
      // Empty nodes to avoid undefined errors - purely fire and forget
      gameNode.get('role_assignment').put({});
      gameNode.get('player_actor_map').put({}); // Explicitly ensure player_actor_map exists
      
      // Create references - fire and forget
      gun.get(nodes.games).get(game_id).get('creator_ref').put({ '#': `${nodes.users}/${currentUser.user_id}` });
      
      // Add user to player_actor_map as null (reserved but not assigned) - important optimization
      gun.get(nodes.games).get(game_id).get('player_actor_map').get(currentUser.user_id).put(null);
      
      // Handle deck type
      const deckId = deckType === 'eco-village' ? 'd1' : deckType === 'community-garden' ? 'd2' : null;
      if (deckId) {
        gun.get(nodes.games).get(game_id).get('deck_ref').put({ '#': `${nodes.decks}/${deckId}` });
      }
      
      // DELAYED BACKGROUND OPERATIONS - lowest priority
      
      // Secondary delayed operation for reliability
      setTimeout(() => {
        try {
          // Double-check player_actor_map exists
          gun.get(nodes.games).get(game_id).get('player_actor_map').once((map: any) => {
            if (!map) {
              gun.get(nodes.games).get(game_id).get('player_actor_map').put({});
              log(`Fixed missing player_actor_map for game ${game_id}`);
            }
          });
        } catch (e) {
          // Non-fatal error
          logWarn(`Error in delayed player_actor_map verification: ${e}`);
        }
      }, 500);
      
      // Lowest priority: Setup predefined deck if needed
      if (deckType === 'eco-village' || deckType === 'community-garden') {
        setTimeout(() => {
          (async () => {
            try {
              log(`Setting up predefined deck (background): ${deckType} for game ${game_id}`);
              const actors = getPredefinedDeck(deckType);
              await setGameActors(game_id, actors as Actor[]);
              log(`Completed deck setup for game: ${game_id}`);
            } catch (error) {
              logWarn(`Background deck setup error: ${error}`);
              // Non-fatal error, game is still created successfully
            }
          })();
        }, 700); // Increased delay to let core data sync first
      }
      
      log(`Game created successfully: ${game_id} (${performance.now() - writeStart}ms)`);
      return gameData;
      
    } catch (error) {
      logError(`Error during game creation: ${error}`);
      
      // IMPORTANT: Even on error, we return the game data anyway
      // This ensures the UI flow doesn't block - the user sees the game created
      // even if the database operations failed
      return gameData;
    }
  } catch (error) {
    logError('Unhandled error in createGame:', error);
    return null;
  }
}

// Get a game by ID with caching
export async function getGame(gameId: string): Promise<Game | null> {
  log(`Getting game: ${gameId}`);
  if (gameCache.has(gameId)) {
    log(`Cache hit: ${gameId}`);
    return gameCache.get(gameId)!;
  }

  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return null;
  }

  return new Promise((resolve) => {
    gun.get(nodes.games).get(gameId).once((gameData: Game) => {
      if (!gameData) {
        log(`Game not found: ${gameId}`);
        resolve(null);
        return;
      }
      
      // Add game_id property if it's not already there
      if (!gameData.game_id) {
        gameData.game_id = gameId;
      }
      
      cacheGame(gameId, gameData);
      log(`Game retrieved: ${gameId}`);
      resolve(gameData);
    });
  });
}

// Get all games with improved reliability and performance
export async function getAllGames(): Promise<Game[]> {
  console.log('Fetching all games...');
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return [];
  }

  // Check if we have any cached games - if so, return them immediately 
  // while fetching fresh data in the background
  const cachedGames = Array.from(gameCache.values());
  if (cachedGames.length > 0) {
    log(`Returning ${cachedGames.length} cached games while fetching fresh data`);
    // Refresh in the background
    setTimeout(() => fetchAllGamesBackground(), 100);
    return cachedGames;
  }

  // Otherwise do a regular fetch
  return new Promise((resolve) => {
    const games: Game[] = [];
    const uniqueIds = new Set<string>();
    
    // Flag to track if we've gotten any data
    let hasReceivedData = false;
    
    // Get games from the games node
    gun.get(nodes.games).map().once((gameData: Game, gameId: string) => {
      if (gameData && gameId !== '_' && !uniqueIds.has(gameId)) {
        hasReceivedData = true;
        uniqueIds.add(gameId);
        
        // Add game_id property if it's not already there
        if (!gameData.game_id) {
          gameData.game_id = gameId;
        }
        
        const game = { ...gameData, game_id: gameId };
        games.push(game);
        cacheGame(gameId, game);
      }
    });
    
    // Also try to get games by user reference for more reliability
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.user_id) {
      const userId = currentUser.user_id;
      gun.get(nodes.users).get(String(userId)).get('games').map().once((game, gameId) => {
        if (gameId && gameId !== '_' && !uniqueIds.has(gameId)) {
          hasReceivedData = true;
          // Now fetch the actual game data
          gun.get(nodes.games).get(gameId).once((gameData: Game) => {
            if (gameData) {
              const game = { ...gameData, game_id: gameId };
              uniqueIds.add(gameId);
              games.push(game);
              cacheGame(gameId, game);
            }
          });
        }
      });
    }
    
    // Use a shorter timeout for better performance
    const timeoutDelay = hasReceivedData ? 500 : 1000; // Reduced timeout values
    
    log(`Setting timeout for ${timeoutDelay}ms to wait for Gun.js data`);
    
    setTimeout(() => {
      console.log(`Retrieved ${games.length} games`);
      
      // Clear the background creation flag if it exists
      localStorage.removeItem('game_creating_background');
      
      // If we still don't have any games, try to get them one more time but with a shorter timeout
      if (games.length === 0) {
        log('No games retrieved on first attempt, trying again with direct fetch');
        gun.get(nodes.games).map().once((gameData: Game, gameId: string) => {
          if (gameData && gameId !== '_' && !uniqueIds.has(gameId)) {
            uniqueIds.add(gameId);
            const game = { ...gameData, game_id: gameId };
            games.push(game);
            cacheGame(gameId, game);
          }
        });
        
        // Resolve after a shorter timeout
        setTimeout(() => {
          resolve(games);
        }, 500);
      } else {
        resolve(games);
      }
    }, timeoutDelay);
  });
}

// Background refresh function
function fetchAllGamesBackground(): void {
  const gun = getGun();
  if (!gun) return;

  const uniqueIds = new Set<string>();
  
  // Quietly refresh the cache
  gun.get(nodes.games).map().once((gameData: Game, gameId: string) => {
    if (gameData && gameId !== '_') {
      const game = { ...gameData, game_id: gameId };
      uniqueIds.add(gameId);
      cacheGame(gameId, game);
    }
  });
}

// Join a game
export async function joinGame(gameId: string): Promise<boolean> {
  log(`Joining game: ${gameId}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun || !currentUser) {
    logError('Gun or user not initialized');
    return false;
  }

  // Use cached game data first for better performance
  let game = gameCache.has(gameId) ? gameCache.get(gameId) : await getGame(gameId);
  
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return false;
  }

  // Check if user is already in the game
  const playersObj = game.players as Record<string, boolean | string>;
  if (playersObj && playersObj[currentUser.user_id]) {
    log(`User already in game: ${gameId}`);
    return true;
  }

  // Update players list with the current user
  const updatedPlayers: Record<string, boolean | string> = { ...(playersObj || {}), [currentUser.user_id]: true };
  
  // IMPORTANT: Update cache IMMEDIATELY for responsive UI
  cacheGame(gameId, { ...game, players: updatedPlayers });
  
  // FIRE-AND-FORGET APPROACH - No waiting for callbacks or acks
  
  // 1. Add player to game's players object with both approaches
  gun.get(nodes.games).get(gameId).get('players').put(updatedPlayers);
  gun.get(nodes.games).get(gameId).get('players').get(currentUser.user_id).put(true);
  
  // 2. Create relationship between user and game
  gun.get(nodes.users).get(currentUser.user_id).get('games').set(
    gun.get(nodes.games).get(gameId) as any
  );
  
  // 3. Create relationship between game and user
  gun.get(nodes.games).get(gameId).get('player_refs').set(
    gun.get(nodes.users).get(currentUser.user_id) as any
  );
  
  // 4. Initialize empty player_actor_map entry for user if it doesn't exist
  setTimeout(() => {
    try {
      // Check if game has player_actor_map
      gun.get(nodes.games).get(gameId).get('player_actor_map').once((map: any) => {
        if (!map || !map[currentUser.user_id]) {
          log(`[JoinPage] Backup update to player_actor_map: user ${currentUser.user_id} -> null`);
          
          // Try both approaches for redundancy
          const updatedMap = { ...(map || {}), [currentUser.user_id]: null };
          gun.get(nodes.games).get(gameId).get('player_actor_map').put(updatedMap);
          
          log(`[JoinPage] Successfully updated player_actor_map via direct write`);
        }
      });
    } catch (err) {
      logWarn(`Error updating player_actor_map after join: ${err}`);
      // Non-fatal error, continue
    }
  }, 200);
  
  log(`Joined game: ${gameId}`);
  return true;
}

// Leave a game
export async function leaveGame(gameId: string): Promise<boolean> {
  log(`Leaving game: ${gameId}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun || !currentUser) {
    logError('Gun or user not initialized');
    return false;
  }

  const game = await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return false;
  }

  // Remove user from players list
  const playersObj = game.players as Record<string, boolean | string>;
  if (!playersObj || !playersObj[currentUser.user_id]) {
    log(`User not in game: ${gameId}`);
    return true; // Already not in the game
  }

  const { [currentUser.user_id]: _, ...updatedPlayersObj } = playersObj;
  // Ensure correct type
  const updatedPlayers: Record<string, boolean | string> = updatedPlayersObj;
  
  // IMMEDIATE CACHE UPDATE for responsive UI
  cacheGame(gameId, { ...game, players: updatedPlayers });
  
  // FIRE-AND-FORGET GUN.JS WRITES - Non-blocking
  try {
    // Update players list - fire and forget
    gun.get(nodes.games).get(gameId).get('players').put(updatedPlayers);
    
    // Remove player role - fire and forget
    const startTime = performance.now();
    log(`Starting background role removal for user ${currentUser.user_id}`);
    
    // Get current actor ID from role_assignment
    gun.get(nodes.games).get(gameId).get('role_assignment').get(currentUser.user_id).once((actorId: string) => {
      if (actorId) {
        // Clear user_id from the actor
        gun.get(nodes.actors).get(actorId).get('user_id').put(null);
        
        // Clear role cache
        const key = `${gameId}:${currentUser.user_id}`;
        roleCache.delete(key);
        
        log(`Cleared actor user_id reference in the background`);
      }
    });
    
    // Clear role assignment references
    gun.get(nodes.games).get(gameId).get('role_assignment').get(currentUser.user_id).put(null);
    
    // Clear player_actor_map reference
    gun.get(nodes.games).get(gameId).get('player_actor_map').get(currentUser.user_id).put(null);
    
    // DELAYED BACKGROUND VERIFICATION - ensure consistency
    setTimeout(() => {
      try {
        // Verify player was removed
        gun.get(nodes.games).get(gameId).get('players').once((players: Record<string, boolean>) => {
          if (players && players[currentUser.user_id]) {
            // Still there, try again
            log(`Player still in game, retrying removal in background`);
            gun.get(nodes.games).get(gameId).get('players').put(updatedPlayers);
          }
        });
        
        // Verify role was removed
        gun.get(nodes.games).get(gameId).get('role_assignment').get(currentUser.user_id).once((actorId: string) => {
          if (actorId) {
            log(`Role assignment still exists, retrying removal in background`);
            gun.get(nodes.games).get(gameId).get('role_assignment').get(currentUser.user_id).put(null);
          }
        });
        
        log(`Background verification for leaving game completed in ${performance.now() - startTime}ms`);
      } catch (delayedErr) {
        // Non-fatal error
        logWarn(`Background verification error:`, delayedErr);
      }
    }, 500);
    
    log(`Left game: ${gameId}`);
    return true;
  } catch (error) {
    logError(`Error in leave game operation:`, error);
    // Even if there's an error, we still return true since we've updated the cache
    // and the UI should proceed normally
    return true;
  }
}

// Assign a role to a player
export async function assignRole(gameId: string, userId: string, actorId: string): Promise<boolean> {
  log(`Assigning role ${actorId} to user ${userId} in game ${gameId}`);
  const gun = getGun();
  const startTime = performance.now();
  
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  try {
    // IMMEDIATE CACHE UPDATES for responsive UI
    cacheRole(gameId, userId, actorId);
    
    // Update actor cache if available
    if (actorCache.has(actorId)) {
      const actor = actorCache.get(actorId)!;
      actorCache.set(actorId, { ...actor, user_id: userId, game_id: gameId });
    }
    
    // Update game cache if available
    if (gameCache.has(gameId)) {
      const game = gameCache.get(gameId)!;
      const updatedPlayerActorMap = { ...(game.player_actor_map || {}), [userId]: actorId };
      gameCache.set(gameId, { ...game, player_actor_map: updatedPlayerActorMap });
    }
    
    // FIRE-AND-FORGET APPROACH - All operations non-blocking
    
    // 1. Update the player-actor map using our dedicated function
    updatePlayerActorMap(gameId, userId, actorId);
    
    // 2. Update actor properties directly
    gun.get(nodes.actors).get(actorId).get('user_id').put(userId);
    gun.get(nodes.actors).get(actorId).get('game_id').put(gameId);
    
    // 3. Also update the full actor to ensure consistency
    gun.get(nodes.actors).get(actorId).put({ user_id: userId, game_id: gameId });
    
    // 4. Set role_assignment for backward compatibility
    gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).put(actorId);
    
    // DELAYED VERIFICATION for reliability
    setTimeout(() => {
      try {
        // Verify actor has user_id set correctly
        gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
          if (!actorData || actorData.user_id !== userId) {
            log(`Actor user_id verification failed, retrying write`);
            gun.get(nodes.actors).get(actorId).get('user_id').put(userId);
            gun.get(nodes.actors).get(actorId).put({ user_id: userId, game_id: gameId });
          }
        });
      } catch (err) {
        // Non-fatal error
        logWarn('Delayed actor verification failed:', err);
      }
    }, 500);

    log(`Role assigned (${performance.now() - startTime}ms): ${actorId} to user ${userId} in game ${gameId}`);
    return true;
  } catch (error) {
    logError(`Error in assignRole:`, error);
    
    // Even if there's an error, we return true since we've updated the cache
    // This ensures the UI remains responsive
    return true;
  }
}

// Remove a player's role
async function removePlayerRole(gameId: string, userId: string): Promise<boolean> {
  log(`Removing role from user ${userId} in game ${gameId}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  // Clear cache IMMEDIATELY to make UI responsive
  const key = `${gameId}:${userId}`;
  roleCache.delete(key);
  
  // FIRE-AND-FORGET APPROACH - non-blocking operations
  try {
    // First perform a fast check for the actor
    let actorId: string | null = null;
    
    // Try getting from player_actor_map first (faster than getPlayerRole() which has timeout logic)
    gun.get(nodes.games).get(gameId).get('player_actor_map').get(userId).once((id: string) => {
      if (id && typeof id === 'string') {
        actorId = id;
        // Clear user_id from actor without waiting
        gun.get(nodes.actors).get(actorId).get('user_id').put(null);
        log(`Cleared user_id from actor ${actorId} (fire-and-forget)`);
      }
    });
    
    // Also try role_assignment as fallback
    gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).once((id: string) => {
      if (id && typeof id === 'string' && id !== actorId) {
        // Clear user_id from actor without waiting
        gun.get(nodes.actors).get(id).get('user_id').put(null);
        log(`Cleared user_id from actor ${id} from role_assignment (fire-and-forget)`);
      }
    });
    
    // Clear from role_assignment without waiting
    gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).put(null);
    
    // Clear from player_actor_map without waiting
    gun.get(nodes.games).get(gameId).get('player_actor_map').get(userId).put(null);
    
    // DELAYED BACKGROUND VERIFICATION with fallback for reliability
    setTimeout(async () => {
      try {
        // Get full actor details to ensure we clean everything up
        const actor = await getPlayerRole(gameId, userId);
        if (actor) {
          log(`Found actor ${actor.actor_id} in delayed verification`);
          gun.get(nodes.actors).get(actor.actor_id).get('user_id').put(null);
          
          // Also try again with role_assignment and player_actor_map
          gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).put(null);
          gun.get(nodes.games).get(gameId).get('player_actor_map').get(userId).put(null);
        }
      } catch (delayedErr) {
        // Non-fatal error
        logWarn(`Delayed role removal error:`, delayedErr);
      }
    }, 500);
    
    log(`Role removal operations started for user ${userId} in game ${gameId}`);
    return true;
  } catch (error) {
    logError(`Error in removePlayerRole:`, error);
    // Still return true since we've updated the cache and UI should proceed
    return true;
  }
}

/**
 * Get a player's role in a game with expedited fallbacks - OPTIMIZED VERSION
 * @param gameId The game ID
 * @param userId The user ID
 * @param specifiedActorId Optional specific actor ID to get directly
 * @returns Promise with Actor or null
 */
export async function getPlayerRole(gameId: string, userId: string, specifiedActorId?: string): Promise<Actor | null> {
  log(`Getting role for user ${userId} in game ${gameId}`);
  
  // Check cache first (fastest path)
  const cacheKey = `${gameId}:${userId}`;
  if (roleCache.has(cacheKey)) {
    const actorId = roleCache.get(cacheKey)!;
    if (actorCache.has(actorId)) {
      log(`Cache hit for role: ${actorId}`);
      return actorCache.get(actorId)!;
    }
  }
  
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return null;
  }

  // If a specific actor ID is provided, get that actor directly
  if (specifiedActorId) {
    return new Promise((resolve) => {
      // Set a shorter timeout to ensure we don't hang
      const timeout = setTimeout(() => {
        log(`Timeout getting actor ${specifiedActorId}`);
        resolve(null);
      }, 800); // Faster timeout
      
      gun.get(nodes.actors).get(specifiedActorId).once((actorData: Actor) => {
        clearTimeout(timeout);
        if (!actorData) {
          log(`Actor not found: ${specifiedActorId}`);
          resolve(null);
          return;
        }
        
        if (!actorData.actor_id) {
          actorData.actor_id = specifiedActorId;
        }
        
        cacheActor(specifiedActorId, actorData);
        cacheRole(gameId, userId, specifiedActorId);
        log(`Found specified actor: ${specifiedActorId}`);
        resolve(actorData);
      });
    });
  }

  // Only try once with a quicker timeout
  try {
    log(`Getting role for user ${userId} in game ${gameId}`);
    
    // Make the single attempt faster
    const result = await new Promise<Actor | null>((resolve) => {
      // Set a faster timeout to ensure we don't hang
      const timeout = setTimeout(() => {
        log(`Timeout getting role for user ${userId} in game ${gameId}`);
        resolve(null);
      }, 800); // Shorter timeout for faster UI
      
      // First check player_actor_map (more reliable in practice)
      gun.get(nodes.games).get(gameId).get('player_actor_map').get(userId).once((actorId: string) => {
        if (actorId && typeof actorId === 'string' && actorId.startsWith('a')) {
          // Start secondary timeout in case actor lookup fails
          const actorTimeout = setTimeout(() => {
            clearTimeout(timeout);
            log(`Timeout getting actor data for ${actorId}`);
            resolve(null);
          }, 400); // Very quick timeout for nested query
          
          gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
            clearTimeout(timeout);
            clearTimeout(actorTimeout);
            
            if (!actorData) {
              log(`Actor not found in map: ${actorId}`);
              resolve(null);
              return;
            }
            
            if (!actorData.actor_id) {
              actorData.actor_id = actorId;
            }
            
            cacheActor(actorId, actorData);
            cacheRole(gameId, userId, actorId);
            log(`Found actor via player_actor_map: ${actorId}`);
            resolve(actorData);
          });
        } else {
          // If not found in map, check role_assignment next with a short timeout
          const assignmentTimeout = setTimeout(() => {
            clearTimeout(timeout);
            log(`Timeout getting role_assignment for ${userId}`);
            resolve(null);
          }, 400); // Very quick timeout for nested query
          
          gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).once((actorId: string) => {
            clearTimeout(assignmentTimeout);
            
            if (!actorId) {
              clearTimeout(timeout);
              log(`No role assigned to user ${userId} in game ${gameId}`);
              resolve(null);
              return;
            }
            
            // Another timeout for the final actor lookup
            const actorTimeout = setTimeout(() => {
              clearTimeout(timeout);
              log(`Timeout getting actor data for ${actorId}`);
              resolve(null);
            }, 300); // Very quick timeout for final nested query
            
            gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
              clearTimeout(timeout);
              clearTimeout(actorTimeout);
              
              if (!actorData) {
                log(`Actor not found: ${actorId}`);
                resolve(null);
                return;
              }
              
              if (!actorData.actor_id) {
                actorData.actor_id = actorId;
              }
              
              cacheActor(actorId, actorData);
              cacheRole(gameId, userId, actorId);
              log(`Found actor via role_assignment: ${actorId}`);
              resolve(actorData);
            });
          });
        }
      });
    });
    
    if (result) {
      return result;
    }
  } catch (error) {
    logError(`Error in getPlayerRole:`, error);
  }
  
  log(`Could not get role for user ${userId} in game ${gameId}`);
  return null;
}

// Update game status
export async function updateGameStatus(gameId: string, status: GameStatus): Promise<boolean> {
  log(`Updating game ${gameId} status to ${status}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  // Try to get game from cache first for immediate UI update
  let game = gameCache.has(gameId) ? gameCache.get(gameId) : null;
  
  if (!game) {
    // If not in cache, fetch it, but don't fail if fetch fails
    try {
      game = await getGame(gameId);
    } catch (err) {
      logWarn(`Error fetching game for status update: ${err}`);
    }
    
    if (!game) {
      // Create minimal game data to continue
      game = { game_id: gameId } as Game;
    }
  }

  // IMMEDIATE CACHE UPDATE for responsive UI
  cacheGame(gameId, { ...game, status });
  
  // If it's the current game in the store, update that too for reactive UI
  const currentGame = get(currentGameStore);
  if (currentGame && currentGame.game_id === gameId) {
    currentGameStore.set({ ...currentGame, status });
  }
  
  // FIRE-AND-FORGET GUN.JS WRITE - Non-blocking
  try {
    // Write status without waiting for ack
    gun.get(nodes.games).get(gameId).get('status').put(status);
    
    // DELAYED BACKGROUND VERIFICATION for reliability
    setTimeout(() => {
      try {
        // Check if status was updated and retry if needed
        gun.get(nodes.games).get(gameId).get('status').once((currentStatus: string) => {
          if (currentStatus !== status) {
            log(`Status verification failed, retrying update to ${status}`);
            gun.get(nodes.games).get(gameId).get('status').put(status);
          }
        });
      } catch (delayedErr) {
        // Non-fatal error
        logWarn(`Delayed status verification error:`, delayedErr);
      }
    }, 500);
    
    log(`Game ${gameId} status update started to ${status}`);
    return true;
  } catch (error) {
    logError(`Error in updateGameStatus:`, error);
    // Still return true since we've updated the cache and UI should proceed
    return true;
  }
}

// Subscribe to a game
export function subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
  log(`Subscribing to game: ${gameId}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    callback(null as any);
    return () => {};
  }

  const subscription = gun.get(nodes.games).get(gameId).on((gameData: Game) => {
    if (!gameData) {
      log(`Game subscription: ${gameId} - no data`);
      return;
    }
    
    // Add game_id property if it's not already there
    if (!gameData.game_id) {
      gameData.game_id = gameId;
    }
    
    cacheGame(gameId, gameData);
    log(`Game subscription update: ${gameId}`);
    callback(gameData);
  });

  return () => {
    subscription.off();
    log(`Unsubscribed from game: ${gameId}`);
  };
}

// Set actors for a game
export async function setGameActors(gameId: string, actors: Actor[]): Promise<boolean> {
  log(`Setting ${actors.length} actors for game ${gameId}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  // Helper function to convert arrays to Gun.js compatible objects
  const convertArraysToObjects = (data: any): any => {
    if (!data) return data;
    
    const result = { ...data };
    
    // Convert any array properties to objects with boolean values
    Object.keys(result).forEach(key => {
      if (Array.isArray(result[key])) {
        log(`Converting array to object for property: ${key}`);
        const objValue: Record<string, boolean> = {};
        result[key].forEach((item: any) => {
          const itemKey = typeof item === 'string' ? item : String(item);
          objValue[itemKey] = true;
        });
        result[key] = objValue;
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        // Recursively process nested objects
        result[key] = convertArraysToObjects(result[key]);
      }
    });
    
    return result;
  };

  // IMMEDIATE CACHE UPDATES and FIRE-AND-FORGET WRITES
  try {
    // Process first batch immediately for responsive UI
    const startTime = performance.now();
    const batchSize = 4; // Process a few actors immediately
    
    // For initial batch, update cache and do basic writes
    for (let i = 0; i < Math.min(batchSize, actors.length); i++) {
      const actor = actors[i];
      const actorId = actor.actor_id || generateId();
      
      // Convert any arrays to Gun.js compatible objects
      const processedActor = convertArraysToObjects(actor);
      
      const actorData = {
        ...processedActor,
        actor_id: actorId,
        game_id: gameId,
        created_at: actor.created_at || Date.now(),
        status: actor.status || 'active'
      };
      
      // Immediate cache update for responsive UI
      cacheActor(actorId, actorData);
      
      // Fire-and-forget write
      gun.get(nodes.actors).get(actorId).put(actorData);
    }
    
    // For remaining actors, process in the background
    setTimeout(() => {
      const remainingActors = actors.slice(batchSize);
      log(`Processing remaining ${remainingActors.length} actors in background`);
      
      remainingActors.forEach(actor => {
        const actorId = actor.actor_id || generateId();
        
        // Convert any arrays to Gun.js compatible objects
        const processedActor = convertArraysToObjects(actor);
        
        const actorData = {
          ...processedActor,
          actor_id: actorId,
          game_id: gameId,
          created_at: actor.created_at || Date.now(),
          status: actor.status || 'active'
        };
        
        // Update cache
        cacheActor(actorId, actorData);
        
        // Fire-and-forget write
        gun.get(nodes.actors).get(actorId).put(actorData);
      });
      
      // DELAYED VERIFICATION - ensure a few random actors were saved
      setTimeout(() => {
        try {
          // Choose a few random actors to verify
          const samplesToVerify = Math.min(3, actors.length);
          for (let i = 0; i < samplesToVerify; i++) {
            const index = Math.floor(Math.random() * actors.length);
            const actor = actors[index];
            const actorId = actor.actor_id || '';
            
            if (actorId) {
              gun.get(nodes.actors).get(actorId).once((savedActor: Actor) => {
                if (!savedActor) {
                  log(`Verification failed for actor ${actorId}, retrying write`);
                  // Ensure all arrays are converted to objects for this retry
                  const processedActor = convertArraysToObjects(actor);
                  gun.get(nodes.actors).get(actorId).put({
                    ...processedActor,
                    actor_id: actorId,
                    game_id: gameId,
                    created_at: actor.created_at || Date.now(),
                    status: actor.status || 'active'
                  });
                }
              });
            }
          }
        } catch (verifyErr) {
          // Non-fatal error
          logWarn(`Actor verification error:`, verifyErr);
        }
      }, 1000);
      
      log(`Background actor processing completed in ${performance.now() - startTime}ms`);
    }, 50); // Short delay to let UI update first
    
    log(`Initiated actor setup for ${actors.length} actors`);
    return true;
  } catch (error) {
    logError(`Error in setGameActors:`, error);
    // Attempt to save a few actors anyway to ensure the game has some data
    try {
      // Try to save at least the first actor
      if (actors.length > 0) {
        const actor = actors[0];
        const actorId = actor.actor_id || generateId();
        const actorData = {
          ...actor,
          actor_id: actorId,
          game_id: gameId,
          created_at: actor.created_at || Date.now(),
          status: actor.status || 'active'
        };
        
        cacheActor(actorId, actorData);
        gun.get(nodes.actors).get(actorId).put(actorData);
        log(`Saved at least one actor despite error`);
      }
    } catch (fallbackErr) {
      logError(`Fallback actor save failed:`, fallbackErr);
    }
    
    // Still return true since actors will be loaded from predefined data if needed
    return true;
  }
}

// Get user's games
export async function getUserGames(): Promise<Game[]> {
  log(`Getting user games`);
  const gun = getGun();
  const currentUser = getCurrentUser();
  
  if (!gun) {
    logError('Gun not initialized');
    return [];
  }
  
  if (!currentUser) {
    log('No user logged in');
    return [];
  }

  const userGames: Game[] = [];
  
  // Get games where user is directly listed as a player
  const directGames = await new Promise<Game[]>((resolve) => {
    const games: Game[] = [];
    const gamePromises: Promise<Game | null>[] = [];
    log(`Looking for games in user ${currentUser.user_id} data`);
    
    // First, check if the user has any games
    gun.get(nodes.users).get(currentUser.user_id).once((userData: any) => {
      log(`User data found: ${userData ? 'yes' : 'no'}`);
      if (userData && userData.games) {
        log(`User has games field: ${typeof userData.games}, value:`, JSON.stringify(userData.games));
      } else {
        log(`No games field found in user data`);
      }
    });
    
    // Then try to map through games
    gun.get(nodes.users).get(currentUser.user_id).get('games').map().once((gameValue: any, gameId: string) => {
      log(`Game found for user: ${gameId}, type: ${typeof gameValue}, value: ${JSON.stringify(gameValue)}`);
      if (typeof gameId === 'string' && gameId !== '_') {
        // Store the promise instead of awaiting it here
        const gamePromise = getGame(gameId).then(game => {
          if (game) {
            log(`Retrieved game: ${game.name} (${gameId})`);
            games.push(game);
            return game;
          } else {
            log(`Game exists in user data but not retrievable: ${gameId}`);
            return null;
          }
        });
        gamePromises.push(gamePromise);
      }
    });
    
    // Allow more time for the initial scan to register the promises and for Gun.js to find data 
    setTimeout(() => {
      log(`Waiting for ${gamePromises.length} game promises to resolve`);
      // Wait for all game promises to resolve
      Promise.all(gamePromises).then(() => {
        log(`Retrieved ${games.length} games for user ${currentUser.user_id}`);
        resolve(games);
      });
    }, 1000); // Increased from 300ms to 1000ms for a more complete search
  });

  userGames.push(...directGames);
  
  // Get games through actor participation
  const userActors = await getUserActors(currentUser.user_id);
  
  // Track unique game IDs to avoid duplicates
  const uniqueGameIds = new Set(userGames.map(g => g.game_id));
  
  // Get games for each actor
  const actorGamePromises = userActors.map(async actor => {
    if (actor.game_id && !uniqueGameIds.has(actor.game_id)) {
      uniqueGameIds.add(actor.game_id);
      const game = await getGame(actor.game_id);
      return game;
    }
    return null;
  });
  
  const actorGames = (await Promise.all(actorGamePromises)).filter(g => g !== null) as Game[];
  userGames.push(...actorGames);
  
  log(`Combined ${directGames.length} direct games with ${actorGames.length} actor games for total of ${userGames.length} games`);
  
  // Update the store
  setUserGames(userGames);
  
  return userGames;
}

// Get available cards for a game
export async function getAvailableCardsForGame(gameId: string): Promise<Card[]> {
  log(`Getting available cards for game ${gameId}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return [];
  }

  const game = await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return [];
  }

  // Get deck ID based on game type
  const deckId = game.deck_type === 'eco-village' ? 'd1' : 
                 game.deck_type === 'community-garden' ? 'd2' : null;
  
  if (!deckId) {
    logError(`No deck found for game ${gameId}`);
    return [];
  }
  
  // Get all cards in the deck, filtering out used ones
  return new Promise((resolve) => {
    const cards: Card[] = [];
    const usedCardIds = new Set<string>();
    
    // First, check which cards are already in use by getting all actors in this game
    gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
      if (actorData && actorData.game_id === gameId && actorData.card_id) {
        usedCardIds.add(actorData.card_id);
      }
    });
    
    // Then get all cards in the deck, filtering out used ones
    setTimeout(() => {
      gun.get(nodes.decks).get(deckId).get('cards').map().once((cardValue: any, cardId: string) => {
        if (cardValue && cardId !== '_' && !usedCardIds.has(cardId)) {
          // Fetch the card details
          gun.get(nodes.cards).get(cardId).once((cardData: Card) => {
            if (cardData) {
              if (!cardData.card_id) {
                cardData.card_id = cardId;
              }
              cacheCard(cardId, cardData);
              cards.push(cardData);
            }
          });
        }
      });
      
      setTimeout(() => {
        log(`Found ${cards.length} available cards for game ${gameId}`);
        resolve(cards);
      }, 200);
    }, 100);
  });
}

// Get a specific card by ID
export async function getCard(cardId: string): Promise<Card | null> {
  log(`Fetching card: ${cardId}`);
  if (cardCache.has(cardId)) {
    log(`Cache hit: ${cardId}`);
    return cardCache.get(cardId)!;
  }

  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return null;
  }

  return new Promise((resolve) => {
    gun.get(nodes.cards).get(cardId).once((cardData: Card) => {
      if (!cardData) {
        log(`Card ${cardId} not found in database`);
        
        // Try alternative format - Gun.js sometimes saves with different prefixes
        if (cardId.startsWith('card_')) {
          const alternativeId = cardId.replace('card_', '');
          log(`Trying alternative ID: ${alternativeId}`);
          
          gun.get(nodes.cards).get(alternativeId).once((altCardData: Card) => {
            if (altCardData) {
              log(`Found card with alternative ID: ${alternativeId}`);
              // Fix the ID to match the expected format
              const fixedCard = {
                ...altCardData,
                card_id: cardId // Use the original requested ID for consistency
              };
              cacheCard(cardId, fixedCard);
              resolve(fixedCard);
            } else {
              log(`Card not found with alternative ID: ${alternativeId}`);
              resolve(null);
            }
          });
        } else {
          resolve(null);
        }
        return;
      }
      
      // Card retrieved successfully
      if (!cardData.card_id) {
        cardData.card_id = cardId;
      }
      
      cacheCard(cardId, cardData);
      log(`Successfully retrieved card: ${cardId}`);
      resolve(cardData);
    });
  });
}

/**
 * Get a user's card in a game efficiently with anti-timeout measures
 * @param gameId Game ID
 * @param userId User ID
 * @returns Promise with Card or null
 */
/**
 * Get a user's card in a game
 * @param gameId The game ID
 * @param userId The user ID or actor ID (function handles both formats)
 * @returns Promise resolving to the user's card or null
 */
export async function getUserCard(gameId: string, userId: string): Promise<Card | null> {
  log(`Fetching card for user/actor ${userId} in game ${gameId}`);
  
  // Handle both user IDs and actor IDs
  const isActorId = userId.startsWith('actor_');
  const cacheKey = `${gameId}:${userId}`;
  
  // Check card cache first for immediate response
  if (cardCache.has(cacheKey)) {
    log(`Card cache hit: ${cacheKey}`);
    return cardCache.get(cacheKey)!;
  }
  
  // If this is an actor ID directly, check actor cache
  if (isActorId && actorCache.has(userId)) {
    const cachedActor = actorCache.get(userId)!;
    if (cachedActor.card_id) {
      log(`Actor cache hit: ${userId} -> card ${cachedActor.card_id}`);
      // Try to get card from card cache
      if (cardCache.has(cachedActor.card_id)) {
        const card = cardCache.get(cachedActor.card_id)!;
        cardCache.set(cacheKey, card); // Cache for future user-based lookups
        return card;
      }
      
      // Try to get card directly
      const card = await getCard(cachedActor.card_id);
      if (card) {
        log(`Got card ${card.card_id} via actor cache`);
        cardCache.set(cacheKey, card);
        return card;
      }
    }
  }
  
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return null;
  }
  
  // If we're looking up by user ID, try the faster role_assignment path first
  if (!isActorId) {
    try {
      // Use getPlayerRole with extended timeout
      const actor = await getPlayerRole(gameId, userId);
      if (actor && actor.card_id) {
        log(`Found actor ${actor.actor_id} via role_assignment`);
        
        // Try to get card using getCard with extended timeout 
        const card = await getCard(actor.card_id);
        if (card) {
          log(`Found card ${card.card_id} via role_assignment -> getCard`);
          cardCache.set(cacheKey, card);
          return card;
        }
      }
    } catch (e) {
      logWarn(`Error getting player role: ${e}`);
      // Continue to fallback methods
    }
  }
  
  // Fallback to direct actor search with improved reliability
  return new Promise((resolve) => {
    // Set a global timeout with a longer duration (2000ms vs 800ms)
    const globalTimeout = setTimeout(() => {
      log(`Global timeout getting card for ${userId} in game ${gameId}`);
      resolve(null);
    }, 2000);
    
    let foundActor = false;
    const actorReference = isActorId ? userId : undefined;
    
    // If we have an actor ID directly, use a targeted lookup
    if (actorReference) {
      gun.get(nodes.actors).get(actorReference).once((actorData: Actor) => {
        if (actorData && actorData.game_id === gameId && actorData.card_id) {
          foundActor = true;
          log(`Direct actor lookup for ${actorReference}: found card ${actorData.card_id}`);
          
          // Get card with extended timeout
          const cardTimeout = setTimeout(() => {
            clearTimeout(globalTimeout);
            log(`Card lookup timeout for ${actorData.card_id}`);
            resolve(null);
          }, 1000); // Increased from 400ms
          
          gun.get(nodes.cards).get(actorData.card_id).once((cardData: Card) => {
            clearTimeout(cardTimeout);
            
            if (!cardData) {
              log(`Card ${actorData.card_id} not found, trying alternatives...`);
              // Try retrieving without prefix if it has one, or with prefix if it doesn't
              const alternativeId = actorData.card_id.startsWith('card_') 
                ? actorData.card_id.replace('card_', '') 
                : `card_${actorData.card_id}`;
                
              log(`Trying alternative ID: ${alternativeId}`);
              
              // Extended alternative ID lookup timeout
              const altTimeout = setTimeout(() => {
                clearTimeout(globalTimeout);
                log(`Alternative card lookup timeout for ${alternativeId}`);
                resolve(null);
              }, 800); // Increased from 300ms
              
              gun.get(nodes.cards).get(alternativeId).once((altCardData: Card) => {
                clearTimeout(altTimeout);
                clearTimeout(globalTimeout);
                
                if (altCardData) {
                  log(`Found card with alternative ID: ${alternativeId}`);
                  const fixedCard = {
                    ...altCardData,
                    card_id: actorData.card_id
                  };
                  // Cache in both formats to maximize cache hits
                  cardCache.set(cacheKey, fixedCard);
                  cardCache.set(actorData.card_id, fixedCard);
                  resolve(fixedCard);
                } else {
                  log(`Card not found with alternative ID: ${alternativeId}`);
                  resolve(null);
                }
              });
            } else {
              // Card retrieved successfully
              clearTimeout(globalTimeout);
              log(`Successfully retrieved card: ${actorData.card_id}`);
              
              // Ensure card_id is set
              const enhancedCard = {
                ...cardData,
                card_id: cardData.card_id || actorData.card_id
              };
              
              // Cache the card with both keys for future lookups
              cardCache.set(cacheKey, enhancedCard);
              cardCache.set(enhancedCard.card_id, enhancedCard);
              resolve(enhancedCard);
            }
          });
        } else {
          // Not found by direct lookup, continue to wider search
          log(`Actor ${actorReference} not found or has no card_id, trying map search...`);
        }
      });
    }
    
    // If direct actor lookup didn't resolve, try a map search
    // With map lookup, this will also handle user_id-based searches
    gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
      // Skip if we're looking for an actor directly and it's not this one
      if (actorReference && actorId !== actorReference) return;
      
      // If user ID matching or actor ID matching
      const isMatch = (!isActorId && actorData && actorData.game_id === gameId && actorData.user_id === userId) ||
                     (isActorId && actorId === userId);
      
      if (isMatch && actorData.card_id) {
        foundActor = true;
        log(`Actor map search: found actor ${actorId} with card ${actorData.card_id}`);
        
        // Cache actor for future lookups
        actorCache.set(actorId, actorData);
        
        // Extended card lookup timeout
        const cardTimeout = setTimeout(() => {
          log(`Card lookup timeout for ${actorData.card_id}`);
          // Don't resolve yet, continue looking for other potential matches
        }, 1000); // Increased from 400ms
        
        gun.get(nodes.cards).get(actorData.card_id).once((cardData: Card) => {
          clearTimeout(cardTimeout);
          
          if (!cardData) {
            log(`Card ${actorData.card_id} not found, trying alternatives...`);
            
            // Try with/without card_ prefix
            const alternativeId = actorData.card_id.startsWith('card_') 
              ? actorData.card_id.replace('card_', '') 
              : `card_${actorData.card_id}`;
              
            log(`Trying alternative ID: ${alternativeId}`);
            
            // Extended alternative ID timeout
            const altTimeout = setTimeout(() => {
              log(`Alternative card lookup timeout for ${alternativeId}`);
              // Don't resolve yet, continue looking
            }, 800); // Increased from 300ms
            
            gun.get(nodes.cards).get(alternativeId).once((altCardData: Card) => {
              clearTimeout(altTimeout);
              clearTimeout(globalTimeout);
              
              if (altCardData) {
                log(`Found card with alternative ID: ${alternativeId}`);
                const fixedCard = {
                  ...altCardData,
                  card_id: actorData.card_id
                };
                // Cache with multiple keys for maximum hit rate
                cardCache.set(cacheKey, fixedCard);
                cardCache.set(actorData.card_id, fixedCard);
                cardCache.set(alternativeId, fixedCard);
                resolve(fixedCard);
              } else {
                // Continue looking (don't resolve yet)
                log(`Card not found with alternative ID: ${alternativeId}`);
              }
            });
          } else {
            // Card retrieved successfully
            clearTimeout(globalTimeout);
            log(`Successfully retrieved card: ${actorData.card_id}`);
            
            // Ensure card_id is properly set
            const enhancedCard = {
              ...cardData,
              card_id: cardData.card_id || actorData.card_id
            };
            
            // Cache with multiple keys for better hit rate
            cardCache.set(cacheKey, enhancedCard);
            cardCache.set(enhancedCard.card_id, enhancedCard);
            resolve(enhancedCard);
          }
        });
      }
    });
    
    // Set a slightly longer timeout for the map search
    setTimeout(() => {
      if (!foundActor) {
        clearTimeout(globalTimeout);
        log(`No matching actor found for ${userId} in game ${gameId}`);
        resolve(null);
      }
    }, 1200); // Increased from 600ms
  });
}

/**
 * Subscribe to real-time updates for a user's card in a game
 * @param gameId The game ID
 * @param userId The user ID 
 * @param callback Function to call when the card data changes
 * @returns Unsubscribe function
 */
export function subscribeToUserCard(gameId: string, userId: string, callback: (card: Card | null) => void): () => void {
  log(`Subscribing to card for user ${userId} in game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    callback(null);
    return () => {};
  }

  const cacheKey = `${gameId}:${userId}`;
  let cardSubscription: any;
  let actorSubscription: any;
  let roleSubscription: any;

  // First subscribe to role assignment changes
  roleSubscription = gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).on((actorId: string) => {
    if (!actorId) {
      log(`No role assigned to user ${userId} in game ${gameId}`);
      cardCache.delete(cacheKey);
      callback(null);
      return;
    }

    log(`Found role assignment: ${actorId} for user ${userId} in game ${gameId}`);
    
    // Clean up previous actor subscription if any
    if (actorSubscription) {
      actorSubscription.off();
    }
    
    // Subscribe to actor changes
    actorSubscription = gun.get(nodes.actors).get(actorId).on((actorData: Actor) => {
      if (!actorData || !actorData.card_id) {
        log(`No card_id found for actor ${actorId}`);
        cardCache.delete(cacheKey);
        callback(null);
        return;
      }

      log(`Found card_id ${actorData.card_id} for actor ${actorId}`);
      
      // Clean up previous card subscription if any
      if (cardSubscription) {
        cardSubscription.off();
      }
      
      // Subscribe to card changes
      cardSubscription = gun.get(nodes.cards).get(actorData.card_id).on((cardData: Card) => {
        if (!cardData) {
          log(`Card ${actorData.card_id} not found`);
          
          // Try alternative format
          if (actorData.card_id.startsWith('card_')) {
            const alternativeId = actorData.card_id.replace('card_', '');
            gun.get(nodes.cards).get(alternativeId).once((altCardData: Card) => {
              if (altCardData) {
                const fixedCard = {
                  ...altCardData,
                  card_id: actorData.card_id
                };
                cardCache.set(cacheKey, fixedCard);
                callback(fixedCard);
              } else {
                cardCache.delete(cacheKey);
                callback(null);
              }
            });
          } else {
            cardCache.delete(cacheKey);
            callback(null);
          }
          return;
        }
        
        // Card retrieved successfully
        if (!cardData.card_id) {
          cardData.card_id = actorData.card_id;
        }
        
        cardCache.set(cacheKey, cardData);
        callback(cardData);
      });
    });
  });

  // Return unsubscribe function that cleans up all subscriptions
  return () => {
    if (roleSubscription) roleSubscription.off();
    if (actorSubscription) actorSubscription.off();
    if (cardSubscription) cardSubscription.off();
    log(`Unsubscribed from card for user ${userId} in game ${gameId}`);
  };
}

// Create a new actor for a user in a game
export async function createActor(
  gameId: string, 
  cardId: string, 
  actorType: 'National Identity' | 'Sovereign Identity',
  customName?: string
): Promise<Actor | null> {
  try {
    const startTime = performance.now();
    log(`Creating actor in game ${gameId} with card ${cardId}`);
    const gun = getGun();
    const currentUser = getCurrentUser();
    
    if (!gun || !currentUser) {
      logError('Gun or user not initialized');
      return null;
    }

    // Fast check if game exists in cache first
    let game = gameCache.has(gameId) ? gameCache.get(gameId) : null;
    
    if (!game) {
      try {
        // Only fetch if not in cache, and don't block for long
        game = await getGame(gameId);
      } catch (err) {
        logWarn(`Error fetching game in createActor: ${err}`);
        // Create a minimal game object to continue with actor creation
        game = { 
          game_id: gameId,
          status: GameStatus.ACTIVE 
        } as Game;
      }
    }
    
    // Create actor object immediately
    const actorId = generateId();
    const actor: Actor = {
      actor_id: actorId,
      game_id: gameId,
      user_id: currentUser.user_id,
      card_id: cardId,
      created_at: Date.now(),
      custom_name: customName,
      actor_type: actorType,
      status: 'active',
      agreements: {}
    };
    
    // IMMEDIATE CACHE UPDATE for responsive UI
    cacheActor(actorId, actor);
    // Also cache the role for fast lookups
    cacheRole(gameId, currentUser.user_id, actorId);
    
    // Start card prefetch in the background (don't wait for it)
    getCard(cardId).then(card => {
      if (card) {
        log(`Prefetched card ${cardId} into cache`);
      }
    }).catch(err => {
      logWarn(`Error prefetching card: ${err}`);
    });
    
    // Check if user is in game players and add if needed - fire and forget
    if (game && (!game.players || !game.players[currentUser.user_id])) {
      // Add user to game players first (fire and forget)
      gun.get(nodes.games).get(gameId).get('players').get(currentUser.user_id).put(true);
      log(`Added user ${currentUser.user_id} to game ${gameId} players (fire-and-forget)`);
      
      // Update game cache
      if (gameCache.has(gameId)) {
        const cachedGame = gameCache.get(gameId)!;
        const updatedPlayers = { ...(cachedGame.players || {}), [currentUser.user_id]: true };
        gameCache.set(gameId, { ...cachedGame, players: updatedPlayers });
      }
    } else if (!game) {
      // Always add user to players if game wasn't found
      gun.get(nodes.games).get(gameId).get('players').get(currentUser.user_id).put(true);
      log(`Added user ${currentUser.user_id} to game ${gameId} players (no game data available)`);
    }
    
    // FIRE-AND-FORGET GUN.JS WRITES - Non-blocking operations
    
    // 1. Core actor data - just fire it without waiting
    gun.get(nodes.actors).get(actorId).put(actor);
    log(`Core actor data write initiated for ${actorId}`);
    
    // 2. Use assignRole (which is already fire-and-forget) without awaiting
    assignRole(gameId, currentUser.user_id, actorId)
      .then(() => log(`Role assigned in background: ${actorId} to user ${currentUser.user_id}`))
      .catch(err => logWarn(`Background role assignment error: ${err}`));
    
    // 3. Create relationships in the background - don't block on these
    try {
      // Fire and forget - no await, no callbacks
      createRelationship(`${nodes.users}/${currentUser.user_id}`, 'actors', `${nodes.actors}/${actorId}`);
      createRelationship(`${nodes.actors}/${actorId}`, 'card', `${nodes.cards}/${cardId}`);
      createRelationship(`${nodes.actors}/${actorId}`, 'game', `${nodes.games}/${gameId}`);
      createRelationship(`${nodes.chat}/${gameId}_group/participants`, currentUser.user_id, `${nodes.users}/${currentUser.user_id}`);
      log(`Relationship creation initiated in background`);
    } catch (relErr) {
      // Non-fatal error for relationships
      logWarn(`Error creating relationships: ${relErr}`);
    }
    
    // 4. Direct approach to ensure User->Actor edge exists - fire and forget
    gun.get(nodes.users).get(currentUser.user_id).get('actors').get(actorId).put(true);
    log(`User->Actor edge creation initiated: ${currentUser.user_id} -> ${actorId}`);
    
    // DELAYED BACKGROUND VERIFICATION - ensure actor data exists
    setTimeout(() => {
      try {
        // Verify actor was saved
        gun.get(nodes.actors).get(actorId).once((savedActor: Actor) => {
          if (!savedActor) {
            log(`Actor ${actorId} verification failed, retrying write`);
            // Retry the actor creation
            gun.get(nodes.actors).get(actorId).put(actor);
          }
        });
        
        // Verify role assignment
        gun.get(nodes.games).get(gameId).get('player_actor_map').get(currentUser.user_id).once((savedActorId: string) => {
          if (savedActorId !== actorId) {
            log(`Role assignment verification failed, retrying`);
            gun.get(nodes.games).get(gameId).get('player_actor_map').get(currentUser.user_id).put(actorId);
            gun.get(nodes.games).get(gameId).get('role_assignment').get(currentUser.user_id).put(actorId);
          }
        });
        
        // Verify user is in players list
        gun.get(nodes.games).get(gameId).get('players').get(currentUser.user_id).once((isPlayer: boolean) => {
          if (!isPlayer) {
            log(`Player verification failed, retrying`);
            gun.get(nodes.games).get(gameId).get('players').get(currentUser.user_id).put(true);
          }
        });
        
        log(`Background verification for actor ${actorId} completed in ${performance.now() - startTime}ms`);
      } catch (verifyErr) {
        // Non-fatal error
        logWarn(`Actor verification error:`, verifyErr);
      }
    }, 500);
    
    log(`Actor creation initiated for ${actorId} (${performance.now() - startTime}ms)`);
    return actor;
    
  } catch (error) {
    logError('Error in createActor:', error);
    return null;
  }
}

// Get a user's actors from all games
export async function getUserActors(userId?: string): Promise<Actor[]> {
  try {
    const gun = getGun();
    const currentUser = getCurrentUser();
    
    if (!gun) {
      logError('Gun not initialized');
      return [];
    }
    
    // If userId is not provided, use current user's ID
    const userToCheck = userId || (currentUser?.user_id);
    
    if (!userToCheck) {
      logWarn('No user ID available. Cannot retrieve actors without a user ID.');
      return [];
    }
    
    log(`Getting actors for user: ${userToCheck}`);
    
    // OPTIMIZATION: Always use Promise with timeout to avoid UI freezing
    return new Promise((resolve) => {
      const actors: Actor[] = [];
      const uniqueIds = new Set<string>();
      let methodsCompleted = 0;
      const totalMethods = 2; // Only using role_assignment and direct actor lookups
      
      // Allow a longer global timeout to find more actors - increased for dashboard
      const globalTimeout = setTimeout(() => {
        log(`Global timeout reached with ${actors.length} actors found`);
        finishCollection();
      }, 4000); // Significantly increased for dashboard to ensure we find ALL actors
      
      // Method 1: Check actor cache FIRST for instant retrieval
      // Use Array.from for better TypeScript compatibility instead of for...of with entries()
      Array.from(actorCache.keys()).forEach(actorId => {
        const actor = actorCache.get(actorId)!;
        if (actor.user_id === userToCheck && !uniqueIds.has(actorId)) {
          log(`Cache hit: actor ${actorId} for user ${userToCheck}`);
          uniqueIds.add(actorId);
          actors.push(actor);
        }
      });
      
      // Fast return if we found actors in cache
      if (actors.length > 0) {
        log(`Found ${actors.length} actors in cache, continuing search in background`);
        // We'll go ahead and continue searching, but we can resolve early
        setTimeout(() => {
          resolve([...actors]); // Create a copy
        }, 0);
      }
      
      // Method 2: PRIORITY - Check player_actor_map first (most reliable)
      // This is now our primary lookup method as it's more reliable in practice
      log(`[PRIMARY] Checking player_actor_map for user ${userToCheck}`);
      let method1Complete = false;
      
      // Direct lookup on each game's player_actor_map
      gun.get(nodes.games).map().once((gameData: Game, gameId: string) => {
        if (!gameData || gameId === '_') return;
        
        // Fast check for direct access to player_actor_map
        const directCheck = () => {
          try {
            if (gameData.player_actor_map && typeof gameData.player_actor_map === 'object') {
              const actorId = gameData.player_actor_map[userToCheck];
              if (actorId && typeof actorId === 'string' && !uniqueIds.has(actorId)) {
                log(`Direct hit: player_actor_map[${userToCheck}] = ${actorId} in game ${gameId}`);
                fetchActor(actorId, gameId);
                return true;
              }
            }
            return false;
          } catch (e) {
            return false;
          }
        };
        
        // Try direct object access first (fastest)
        if (!directCheck()) {
          // Then try map lookup (optimized path)
          gun.get(nodes.games).get(gameId).get('player_actor_map').get(userToCheck).once((actorId: string) => {
            if (actorId && actorId !== '_' && !uniqueIds.has(actorId)) {
              log(`Found player_actor_map: ${userToCheck} -> ${actorId} in game ${gameId}`);
              fetchActor(actorId, gameId);
            }
          });
        }
        
        // Also check role_assignment as fallback
        gun.get(nodes.games).get(gameId).get('role_assignment').get(userToCheck).once((actorId: string) => {
          if (actorId && actorId !== '_' && !uniqueIds.has(actorId)) {
            log(`Found role_assignment: ${userToCheck} -> ${actorId} in game ${gameId}`);
            fetchActor(actorId, gameId);
          }
        });
      });
      
      // Set a reasonable timeout to complete this method, but extend it for a more comprehensive search
      setTimeout(() => {
        method1Complete = true;
        methodComplete();
      }, 1500); // Increased from 500 to ensure we get more results
      
      // Method 3: Try to get actors from user->actors relationship AND direct search by user_id
      log(`[SECONDARY] Checking user->actors links and direct user_id search for user ${userToCheck}`);
      let userActorsComplete = false;
      let foundActorsFromUser = false;
      
      // First check: user->actors links (relationship-based)
      gun.get(nodes.users).get(userToCheck).get('actors').map().once((actorValue: any, actorId: string) => {
        if (actorId && actorId !== '_' && !uniqueIds.has(actorId)) {
          foundActorsFromUser = true;
          log(`Found actor link from user->actors: ${actorId}`);
          fetchActor(actorId);
        }
      });
      
      // NEW SEARCH METHOD: Direct search all actors by user_id field (most reliable)
      log(`[CRITICAL] Searching all actors directly by user_id field for ${userToCheck}`);
      gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
        if (!actorData || actorId === '_') return;
        
        // Check if this actor belongs to our user
        if (actorData.user_id === userToCheck && !uniqueIds.has(actorId)) {
          foundActorsFromUser = true;
          log(`Found actor by direct user_id search: ${actorId}`);
          
          // Create a complete actor object with properly typed properties
          const completeActor: Actor = {
            ...actorData,
            actor_id: actorId, // Ensure actor_id is set
            game_id: actorData.game_id || 'unknown', // Use 'unknown' instead of null for TypeScript compatibility
            // Ensure required fields for Actor type are present
            card_id: actorData.card_id || '',
            user_id: actorData.user_id,
            created_at: actorData.created_at || Date.now(),
            actor_type: actorData.actor_type || 'National Identity',
            status: actorData.status || 'active'
          };
          
          uniqueIds.add(actorId);
          actors.push(completeActor);
          
          // Cache for future use
          actorCache.set(actorId, completeActor);
        }
      });
      
      // Set timeout for user actors method completion - longer timeout for comprehensive search
      setTimeout(() => {
        userActorsComplete = true;
        if (foundActorsFromUser) {
          log(`Completing user->actors and direct search with actors found`);
        } else {
          log(`No actors found via user->actors links or direct search`);
        }
        methodComplete();
      }, 2000); // Extended timeout for more thorough search
      
      // Helper to fetch an actor with timeout protection
      function fetchActor(actorId: string, gameId?: string) {
        // Check cache first for speed
        if (actorCache.has(actorId)) {
          const actor = actorCache.get(actorId)!;
          if (!uniqueIds.has(actorId)) {
            uniqueIds.add(actorId);
            actors.push({...actor, game_id: gameId || actor.game_id});
            log(`Used cached actor: ${actorId}`);
          }
          return;
        }
        
        // Set a timeout for this actor fetch
        const fetchTimeout = setTimeout(() => {
          log(`Actor fetch timeout for ${actorId}`);
        }, 500);
        
        // We've already checked that gun exists at the beginning of the function
        // TypeScript doesn't track this, so we'll do a redundant check
        if (!gun) {
          clearTimeout(fetchTimeout);
          logError('Gun not initialized in fetchActor');
          return;
        }
        
        gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
          clearTimeout(fetchTimeout);
          
          if (actorData && !uniqueIds.has(actorId)) {
            uniqueIds.add(actorId);
            
            if (!actorData.actor_id) {
              actorData.actor_id = actorId;
            }
            
            const actor = { ...actorData, actor_id: actorId, game_id: gameId || actorData.game_id };
            actors.push(actor);
            
            // Cache for future use
            actorCache.set(actorId, actor);
            log(`Retrieved actor data: ${actorId}`);
          }
        });
      }
      
      // Helper to track method completion
      function methodComplete() {
        methodsCompleted++;
        log(`Method completed. ${methodsCompleted}/${totalMethods} done`);
        
        if (methodsCompleted >= totalMethods || 
            (method1Complete && userActorsComplete)) {
          finishCollection();
        }
      }
      
      // Function to wrap up actor collection
      function finishCollection() {
        clearTimeout(globalTimeout);
        
        log(`Completed actor scan. Found ${actors.length} actors for user ${userToCheck}`);
        
        // Check if we've already resolved
        if (methodsCompleted > totalMethods) return;
        methodsCompleted = totalMethods + 1; // Mark as done
        
        // Pre-cache cards for actors (fire and forget)
        actors.forEach(actor => {
          if (actor.card_id) {
            // Pre-fetch the card but don't wait for it
            getCard(actor.card_id).then(card => {
              if (card && actor.game_id && actor.user_id) {
                // Cache user:game:card relationship
                cardCache.set(`${actor.game_id}:${actor.user_id}`, card);
              }
            }).catch(err => {
              logWarn(`Failed to pre-cache card ${actor.card_id}:`, err);
            });
          }
        });
        
        // Sort actors by creation date (newest first) for better UX
        actors.sort((a, b) => {
          return (b.created_at || 0) - (a.created_at || 0);
        });
        
        log(`Returning ${actors.length} actors for user ${userToCheck}`);
        resolve(actors);
      }
    });
  } catch (error) {
    logError('Get user actors error:', error);
    return [];
  }
}

// Get all actors for a specific game
export async function getGameActors(gameId: string): Promise<Actor[]> {
  try {
    log(`Getting actors for game: ${gameId}`);
    const gun = getGun();
    
    if (!gun) {
      logError('Gun not initialized');
      return [];
    }
    
    // Try first to get actors through role_assignment (optimized path)
    const actorsViaRoles = await new Promise<Actor[]>((resolve) => {
      const actors: Actor[] = [];
      const uniqueIds = new Set<string>();
      
      // Set a timeout to ensure we don't hang
      const timeout = setTimeout(() => {
        log(`Timeout getting actors via role_assignment for game ${gameId}`);
        resolve(actors);
      }, 1000); // 1 second timeout
      
      gun.get(nodes.games).get(gameId).get('role_assignment').map().once((actorId: string, userId: string) => {
        if (typeof actorId === 'string' && actorId.startsWith('a') && userId !== '_') {
          log(`Found role assignment: ${userId} -> ${actorId}`);
          
          gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
            if (actorData && !uniqueIds.has(actorId)) {
              uniqueIds.add(actorId);
              
              if (!actorData.actor_id) {
                actorData.actor_id = actorId;
              }
              
              const actor = { ...actorData, actor_id: actorId };
              actors.push(actor);
              cacheActor(actorId, actor);
            }
          });
        }
      });
      
      // Use setTimeout to ensure we don't hang, but give Gun.js a bit of time to collect data
      setTimeout(() => {
        clearTimeout(timeout);
        log(`Found ${actors.length} actors via role_assignment for game ${gameId}`);
        resolve(actors);
      }, 800); // Resolve after 800ms (before the 1000ms timeout)
    });
    
    // If we found actors via roles, return them
    if (actorsViaRoles.length > 0) {
      return actorsViaRoles;
    }
    
    // Fallback to searching all actors (less efficient)
    log(`No actors found via role_assignment, searching all actors for game ${gameId}`);
    return new Promise((resolve) => {
      const actors: Actor[] = [];
      const uniqueIds = new Set<string>();
      
      // Set a timeout to ensure we don't hang
      const timeout = setTimeout(() => {
        log(`Timeout getting actors via fallback for game ${gameId}`);
        resolve(actors);
      }, 1000); // 1 second timeout
      
      gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
        if (actorData && actorData.game_id === gameId && !uniqueIds.has(actorId)) {
          uniqueIds.add(actorId);
          
          if (!actorData.actor_id) {
            actorData.actor_id = actorId;
          }
          
          const actor = { ...actorData, actor_id: actorId };
          actors.push(actor);
          cacheActor(actorId, actor);
        }
      });
      
      // Use setTimeout with a shorter duration than the timeout
      setTimeout(() => {
        clearTimeout(timeout);
        log(`Found ${actors.length} actors for game ${gameId} via fallback method`);
        resolve(actors);
      }, 800); // Resolve after 800ms (before the 1000ms timeout)
    });
  } catch (error) {
    logError('Get game actors error:', error);
    return [];
  }
}

/**
 * Subscribe to actors in a game
 * @param gameId The game ID
 * @param callback Function to call when actor data changes
 * @returns Unsubscribe function
 */
export function subscribeToGameActors(gameId: string, callback: (actors: Actor[]) => void): () => void {
  log(`Subscribing to actors for game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    callback([]);
    return () => {};
  }
  
  const actorSubscriptions: any[] = [];
  const actors: Actor[] = [];
  const uniqueIds = new Set<string>();
  
  // Subscribe to role assignments
  const roleSubscription = gun.get(nodes.games).get(gameId).get('role_assignment').map().on((actorId: string, userId: string) => {
    if (typeof actorId === 'string' && actorId.startsWith('a') && userId !== '_') {
      // Subscribe to this actor
      const actorSubscription = gun.get(nodes.actors).get(actorId).on((actorData: Actor) => {
        if (actorData) {
          // Update or add actor
          const actorIndex = actors.findIndex(a => a.actor_id === actorId);
          
          if (!actorData.actor_id) {
            actorData.actor_id = actorId;
          }
          
          const actor = { ...actorData, actor_id: actorId };
          
          if (actorIndex >= 0) {
            actors[actorIndex] = actor;
          } else {
            actors.push(actor);
            uniqueIds.add(actorId);
          }
          
          cacheActor(actorId, actor);
          callback([...actors]); // Create new array to trigger reactivity
        }
      });
      
      actorSubscriptions.push(actorSubscription);
    }
  });
  
  // Return unsubscribe function that cleans up all subscriptions
  return () => {
    if (roleSubscription) roleSubscription.off();
    actorSubscriptions.forEach(sub => sub.off());
    log(`Unsubscribed from actors for game ${gameId}`);
  };
}

// Check if a game is full (reached max_players)
export async function isGameFull(gameId: string): Promise<boolean> {
  try {
    log(`Checking if game ${gameId} is full`);
    const game = await getGame(gameId);
    
    if (!game) {
      logError(`Game not found: ${gameId}`);
      return false;
    }
    
    // If max_players is not set, game is never full
    if (!game.max_players) {
      return false;
    }
    
    const playersObj = game.players as Record<string, boolean | string>;
    const playerCount = playersObj ? Object.keys(playersObj).length : 0;
    
    const isFull = playerCount >= game.max_players;
    log(`Game ${gameId} has ${playerCount}/${game.max_players} players. Full: ${isFull}`);
    return isFull;
  } catch (error) {
    logError('Check if game is full error:', error);
    return false;
  }
}

// Fix game relationships for visualization
export async function fixGameRelationships(): Promise<{success: boolean, gamesFixed: number}> {
  try {
    log('Fixing game relationships for visualization');
    const gun = getGun();
    
    if (!gun) {
      logError('Gun not initialized');
      return {success: false, gamesFixed: 0};
    }
    
    const allGames = await getAllGames();
    let gamesFixed = 0;
    
    for (const game of allGames) {
      try {
        // Batch all operations for each game for better performance
        const promises = [];
        
        // Create relationships for each game
        if (game.creator) {
          promises.push(
            gun.get(nodes.games).get(game.game_id).get('creator_ref').put({
              '#': `${nodes.users}/${game.creator}`
            })
          );
          promises.push(
            createRelationship(`${nodes.users}/${game.creator}`, 'games', `${nodes.games}/${game.game_id}`)
          );
        }
        
        // Game references deck
        if (game.deck_type) {
          const deckId = game.deck_type === 'eco-village' ? 'd1' : 
                         game.deck_type === 'community-garden' ? 'd2' : null;
          if (deckId) {
            promises.push(
              gun.get(nodes.games).get(game.game_id).get('deck_ref').put({
                '#': `${nodes.decks}/${deckId}`
              })
            );
          }
        }
        
        // Add relationships for each player
        if (game.players) {
          const players = Array.isArray(game.players) 
            ? game.players 
            : Object.keys(game.players as Record<string, boolean | string>);
            
          for (const playerId of players) {
            // Skip if playerId is just the Gun metadata property '_'
            if (playerId === '_') continue;
            
            promises.push(
              createRelationship(`${nodes.users}/${playerId}`, 'games', `${nodes.games}/${game.game_id}`)
            );
            
            promises.push(
              createRelationship(`${nodes.games}/${game.game_id}`, 'player_refs', `${nodes.users}/${playerId}`)
            );
          }
        }
        
        // Fix relationships for actors/roles if they exist
        // Safely access the game.roles property
        const roles = game.roles || game.role_assignment || (game as any).deck;
        
        if (roles && typeof roles === 'object') {
          // Filter out internal Gun.js properties
          const actorIds = Object.entries(roles)
            .filter(([key, value]) => key !== '_' && typeof value === 'string')
            .map(([_, actorId]) => actorId);
          
          for (const actorId of actorIds) {
            promises.push(
              createRelationship(`${nodes.games}/${game.game_id}`, 'actor_refs', `${nodes.actors}/${actorId}`)
            );
            
            promises.push(
              createRelationship(`${nodes.actors}/${actorId}`, 'game_refs', `${nodes.games}/${game.game_id}`)
            );
          }
        }
        
        // Execute all promises in parallel
        await Promise.all(promises);
        gamesFixed++;
      } catch (error) {
        logWarn(`Error fixing relationships for game ${game.game_id}:`, error);
      }
    }
    
    log(`Fixed relationships for ${gamesFixed} games`);
    return {success: true, gamesFixed};
  } catch (error) {
    logError('Fix game relationships error:', error);
    return {success: false, gamesFixed: 0};
  }
}

// Add an implementation for assignCardToActor
/**
 * Update player-actor map using fire-and-forget approach
 * @param gameId Game ID
 * @param userId User ID
 * @param actorId Actor ID
 * @returns Promise resolving to true (always succeeds due to fire-and-forget approach)
 */
export function updatePlayerActorMap(gameId: string, userId: string, actorId: string): Promise<boolean> {
  log(`Updating player_actor_map for user ${userId} -> actor ${actorId} in game ${gameId}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return Promise.resolve(false);
  }
  
  try {
    // IMMEDIATE CACHE UPDATE for responsive UI
    // Try to update game cache if exists
    if (gameCache.has(gameId)) {
      const game = gameCache.get(gameId)!;
      const updatedMap = { ...(game.player_actor_map || {}), [userId]: actorId };
      gameCache.set(gameId, { ...game, player_actor_map: updatedMap });
    }
    
    // Cache role mapping
    cacheRole(gameId, userId, actorId);
    
    // FIRE-AND-FORGET GUN.JS WRITES - Non-blocking
    // First ensure the player_actor_map node exists
    gun.get(nodes.games).get(gameId).get('player_actor_map').put({});
    
    // Set mapping both ways for redundancy
    const userActorMap = { [userId]: actorId };
    gun.get(nodes.games).get(gameId).get('player_actor_map').put(userActorMap);
    gun.get(nodes.games).get(gameId).get('player_actor_map').get(userId).put(actorId);
    
    // Also update role_assignment for backward compatibility
    gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).put(actorId);
    
    // DELAYED BACKGROUND VERIFICATION for reliability
    setTimeout(() => {
      try {
        // Verify the mapping was set correctly
        gun.get(nodes.games).get(gameId).get('player_actor_map').get(userId).once((savedActorId: string) => {
          if (savedActorId !== actorId) {
            log(`Player-actor mapping verification failed, retrying`);
            // Retry with both approaches for maximum reliability
            gun.get(nodes.games).get(gameId).get('player_actor_map').get(userId).put(actorId);
            gun.get(nodes.games).get(gameId).get('player_actor_map').put(userActorMap);
          }
        });
      } catch (verifyErr) {
        // Non-fatal error
        logWarn(`Player-actor mapping verification error:`, verifyErr);
      }
    }, 500);
    
    log(`Player-actor mapping update initiated: ${userId} -> ${actorId}`);
    return Promise.resolve(true);
  } catch (error) {
    logError(`Error in updatePlayerActorMap:`, error);
    // Still return true since we've updated the cache and UI should proceed
    return Promise.resolve(true);
  }
}

export async function assignCardToActor(actorId: string, cardId: string): Promise<boolean> {
  log(`Assigning card ${cardId} to actor ${actorId}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  // Check if actor exists in cache first
  let actor = null;
  if (actorCache.has(actorId)) {
    actor = { ...actorCache.get(actorId)!, card_id: cardId };
    // Update cache immediately for responsive UI
    cacheActor(actorId, actor);
  }
  
  // FIRE-AND-FORGET APPROACH - Non-blocking operations
  try {
    // First write - direct card_id assignment
    gun.get(nodes.actors).get(actorId).get('card_id').put(cardId);
    
    // Second write - attempt to create relationship without waiting
    try {
      // We don't use await here to keep this non-blocking
      createRelationship(`${nodes.actors}/${actorId}`, 'card', `${nodes.cards}/${cardId}`);
    } catch (relErr) {
      // Non-fatal error for relationship
      logWarn(`Non-blocking relationship creation error: ${relErr}`);
    }
    
    // If we didn't find the actor in cache, load it now for future reference
    // This is purely for cache consistency and doesn't block the function return
    if (!actor) {
      gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
        if (actorData) {
          actorData.card_id = cardId; // Make sure card_id is set
          cacheActor(actorId, actorData);
        }
      });
    }
    
    // DELAYED BACKGROUND VERIFICATION for reliability
    setTimeout(() => {
      try {
        gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
          if (!actorData || actorData.card_id !== cardId) {
            log(`Card assignment verification failed, retrying`);
            // Retry the assignment
            gun.get(nodes.actors).get(actorId).get('card_id').put(cardId);
            
            // Also update the full actor data if available
            if (actorData) {
              gun.get(nodes.actors).get(actorId).put({
                ...actorData,
                card_id: cardId
              });
            }
          }
        });
      } catch (verifyErr) {
        // Non-fatal error
        logWarn(`Card assignment verification error:`, verifyErr);
      }
    }, 500);
    
    log(`Card ${cardId} assignment to actor ${actorId} initiated`);
    return true;
  } catch (error) {
    logError(`Error in assignCardToActor:`, error);
    
    // Even if there's an error, we might have updated the cache successfully
    // So, we can still return true for UI purposes
    return actorCache.has(actorId); // Return true if we at least cached the change
  }
}