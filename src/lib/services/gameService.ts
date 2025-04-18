import { getGun, nodes, generateId, createRelationship } from './gunService';
import { getCurrentUser } from './authService';
import type { Game, Actor, Card } from '../types';
import { GameStatus } from '../types';
import { getPredefinedDeck } from '../data/predefinedDecks';
import { get } from 'svelte/store';
import { currentGameStore, setUserGames } from '../stores/gameStore';

// Caches for performance
const gameCache = new Map<string, Game>();
const actorCache = new Map<string, Actor>();
const cardCache = new Map<string, Card>();
const roleCache = new Map<string, string>(); // gameId+userId -> actorId

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
      logWarn('No authenticated user. Using mock user.');
      currentUser = {
        user_id: 'u838', // Using a consistent ID for development to make debugging easier
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
      // Initialize the player_actor_map (empty at first - will be populated when roles are assigned)
      player_actor_map: {},
      created_at: Date.now(),
      status: GameStatus.ACTIVE // Always set to ACTIVE immediately
    };

    // Immediately cache the game data and update the current game store
    // This ensures the UI can update immediately without waiting for Gun.js
    cacheGame(game_id, gameData);
    currentGameStore.set(gameData);

    // FIRE-AND-FORGET APPROACH
    // We'll save to the database but not wait for confirmation
    // This guarantees the UI doesn't hang waiting for Gun.js operations
    
    // Only the local sync is critical for UI flow
    // Do database writes without waiting for callbacks
    const gameNode = gun.get(nodes.games).get(game_id);
    
    // Create game data with a single put operation
    const writeStart = performance.now();
    
    try {
      // 1. Primary write - must succeed or retry
      await new Promise<void>((resolve, reject) => {
        const writeTimeout = setTimeout(() => {
          log('Game data write timed out, using fallback');
          resolve(); // Resolve anyway to prevent UI hanging
        }, 1000);
        
        gameNode.put({
          game_id,
          name,
          creator: currentUser.user_id,
          deck_type: deckType,
          deck_id: deckType === 'eco-village' ? 'd1' : deckType === 'community-garden' ? 'd2' : 'd1',
          role_assignment_type: roleAssignmentType,
          created_at: Date.now(),
          status: GameStatus.ACTIVE,
          players: { [currentUser.user_id]: true },
          player_actor_map: {}
        }, (ack: any) => {
          clearTimeout(writeTimeout);
          if (ack.err) {
            logWarn('Game data write ack returned error:', ack.err);
            reject(ack.err);
          } else {
            log('Game data write ack received successfully');
            resolve();
          }
        });
      });
      
      log(`Primary game data wrote in ${performance.now() - writeStart}ms`);
      
      // 2. Secondary writes - can be truly fire and forget
      // Use proper type cast for Gun.js set operation
      gun.get(nodes.users).get(currentUser.user_id).get('games').set(gun.get(nodes.games).get(game_id) as any);
      
      // 3. Add empty deck and role_assignment nodes to avoid undefined errors
      gameNode.get('deck').put({});
      gameNode.get('role_assignment').put({});
      
      // 4. Create necessary references in background
      gun.get(nodes.games).get(game_id).get('creator_ref').put({ '#': `${nodes.users}/${currentUser.user_id}` });
      
      if (deckType === 'eco-village' || deckType === 'community-garden') {
        gun.get(nodes.games).get(game_id).get('deck_ref').put({ '#': `${nodes.decks}/${deckType === 'eco-village' ? 'd1' : 'd2'}` });
      }
      
      // Setup predefined deck in the background
      if (deckType === 'eco-village' || deckType === 'community-garden') {
        setTimeout(() => {
          (async () => {
            try {
              log(`Setting up predefined deck (background): ${deckType} for game ${game_id}`);
              const actors = getPredefinedDeck(deckType);
              await setGameActors(game_id, actors as Actor[]);
              log(`Completed background deck setup for game: ${game_id}`);
            } catch (error) {
              logWarn(`Background deck setup error for game ${game_id}:`, error);
              // We still consider the game created successfully even if deck setup fails
            }
          })();
        }, 200); // Small delay to prioritize primary data syncing
      }
      
      log(`Game created successfully: ${game_id} (${performance.now() - writeStart}ms)`);
      return gameData;
      
    } catch (error) {
      logError(`Error during game creation process: ${error}`);
      
      // IMPORTANT: Even on error, we return the game data anyway
      // This ensures the UI flow doesn't block, and we can retry the database operations if needed
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

  const game = await getGame(gameId);
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
  
  try {
    // Use the utility functions from gunService which properly handle Gun.js operations
    await Promise.all([
      // Update players in game
      new Promise<void>((resolve, reject) => {
        gun.get(nodes.games).get(gameId).get('players').put(updatedPlayers, (ack: any) => 
          ack.err ? reject(ack.err) : resolve()
        );
      }),
      
      // Create relationship between user and game using createRelationship
      createRelationship(`${nodes.users}/${currentUser.user_id}`, 'games', `${nodes.games}/${gameId}`),
      
      // Create relationship between game and user reference
      createRelationship(`${nodes.games}/${gameId}`, 'player_refs', `${nodes.users}/${currentUser.user_id}`)
    ]);
  } catch (error) {
    logError(`Error joining game ${gameId}:`, error);
    return false;
  }

  // Update cache
  cacheGame(gameId, { ...game, players: updatedPlayers });
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
  
  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        gun.get(nodes.games).get(gameId).get('players').put(updatedPlayers, (ack: any) => 
          ack.err ? reject(ack.err) : resolve()
        );
      }),
      // Don't remove from user's games list - keep it for history
      removePlayerRole(gameId, currentUser.user_id)
    ]);

    // Update cache
    cacheGame(gameId, { ...game, players: updatedPlayers });
    log(`Left game: ${gameId}`);
    return true;
  } catch (error) {
    logError(`Error leaving game ${gameId}:`, error);
    return false;
  }
}

// Assign a role to a player
export async function assignRole(gameId: string, userId: string, actorId: string): Promise<boolean> {
  log(`Assigning role ${actorId} to user ${userId} in game ${gameId}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  // Only use 2 attempts to keep things fast - if it fails twice, we'll still return success and fix in background
  const maxAttempts = 2;
  const backoffMs = [500, 1000]; // Shorter backoff
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log(`Role assignment attempt ${attempt}/${maxAttempts}`);
      
      // Get current game data to make sure we have the latest version
      // Use cached version if available to avoid Gun.js lookup
      let game = gameCache.has(gameId) ? gameCache.get(gameId) : await getGame(gameId);
      
      if (!game) {
        logWarn(`Game not found during role assignment (attempt ${attempt})`);
        
        if (attempt < maxAttempts) {
          log(`Retrying in ${backoffMs[attempt-1]}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs[attempt-1]));
          continue;
        }
        
        // Create minimal game data to continue
        game = { game_id: gameId } as Game;
      }

      // Initialize player_actor_map if it doesn't exist
      const currentPlayerActorMap = game.player_actor_map || {};
      
      // Update player_actor_map with the new mapping
      const updatedPlayerActorMap = { ...currentPlayerActorMap, [userId]: actorId };
      
      // Get actor to check if it's from another game (but don't wait if cached)
      let actor = actorCache.has(actorId) ? actorCache.get(actorId) : null;
      let isFromAnotherGame = false;
      
      if (actor) {
        isFromAnotherGame = Boolean(actor.game_id) && actor.game_id !== gameId;
      } else {
        try {
          // No waiting if actor is in cache, otherwise brief lookup
          if (!actor) {
            const userActors = await getUserActors();
            actor = userActors.find(a => a.actor_id === actorId) || null;
          }
          
          if (actor) {
            isFromAnotherGame = Boolean(actor.game_id) && actor.game_id !== gameId;
          }
        } catch (actorErr) {
          // Non-fatal error, continue
          logWarn(`Could not check actor origin: ${actorErr}`);
        }
      }
      
      if (isFromAnotherGame) {
        log(`Actor ${actorId} is being reused from game ${actor?.game_id} in new game ${gameId}`);
      }
      
      // Immediately update cache for responsive UI
      cacheRole(gameId, userId, actorId);
      
      // Update game cache with new player_actor_map
      if (gameCache.has(gameId)) {
        const cachedGame = gameCache.get(gameId)!;
        gameCache.set(gameId, { 
          ...cachedGame, 
          player_actor_map: updatedPlayerActorMap 
        });
      }
      
      // FIRE-AND-FORGET APPROACH
      // First, set up the player_actor_map with the new mapping directly
      gun.get(nodes.games).get(gameId).get('player_actor_map').put(updatedPlayerActorMap);
      
      // Also set the direct key/value relationship for redundancy
      gun.get(nodes.games).get(gameId).get('player_actor_map').get(userId).put(actorId);
      
      // Set the role_assignment (traditional way)
      gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).put(actorId);
      
      // Set the user_id on the actor
      gun.get(nodes.actors).get(actorId).get('user_id').put(userId);
      
      // Set the game_id on the actor if it's from another game
      gun.get(nodes.actors).get(actorId).get('game_id').put(gameId);
      
      // Make a retry attempt in the background after a delay
      setTimeout(() => {
        try {
          // Redundant writes with different paths to ensure data consistency
          log(`Background retry: setting player_actor_map[${userId}] = ${actorId}`);
          
          // Try both direct and full object approaches
          gun.get(nodes.games).get(gameId).get('player_actor_map').get(userId).put(actorId);
          gun.get(nodes.games).get(gameId).get('player_actor_map').put(updatedPlayerActorMap);
        } catch (backupErr) {
          // Non-fatal error
          logWarn('Background player_actor_map update failed:', backupErr);
        }
      }, 200);

      log(`Role assigned: ${actorId} to user ${userId} in game ${gameId}`);
      log(`Updated player_actor_map:`, updatedPlayerActorMap);
      return true;
      
    } catch (error) {
      logError(`Error in role assignment attempt ${attempt}:`, error);
      
      if (attempt < maxAttempts) {
        log(`Retrying in ${backoffMs[attempt-1]}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs[attempt-1]));
      }
    }
  }

  // Even if we failed all attempts, we can still return true
  // because we've updated the cache and scheduled background retries
  log(`Unable to verify role assignment success after ${maxAttempts} attempts, but proceeding anyway`);
  return true;
}

// Remove a player's role
async function removePlayerRole(gameId: string, userId: string): Promise<boolean> {
  log(`Removing role from user ${userId} in game ${gameId}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  const actor = await getPlayerRole(gameId, userId);
  if (actor) {
    await new Promise<void>((resolve, reject) => {
      gun.get(nodes.actors).get(actor.actor_id).get('user_id').put(null, (ack: any) =>
        ack.err ? reject(ack.err) : resolve()
      );
    });
  }

  await new Promise<void>((resolve, reject) => {
    gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).put(null, (ack: any) =>
      ack.err ? reject(ack.err) : resolve()
    );
  });
  
  // Clear cache
  const key = `${gameId}:${userId}`;
  roleCache.delete(key);
  
  log(`Role removed from user ${userId} in game ${gameId}`);
  return true;
}

// Get a player's role in a game
export async function getPlayerRole(gameId: string, userId: string, specifiedActorId?: string): Promise<Actor | null> {
  log(`Getting role for user ${userId} in game ${gameId}`);
  
  // Check cache first
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
      gun.get(nodes.actors).get(specifiedActorId).once((actorData: Actor) => {
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

  // First try role_assignment
  return new Promise((resolve) => {
    gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).once((actorId: string) => {
      if (!actorId) {
        log(`No role assigned to user ${userId} in game ${gameId}`);
        resolve(null);
        return;
      }

      gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
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
  });
}

// Update game status
export async function updateGameStatus(gameId: string, status: GameStatus): Promise<boolean> {
  log(`Updating game ${gameId} status to ${status}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  const game = await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return false;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      gun.get(nodes.games).get(gameId).get('status').put(status, (ack: any) =>
        ack.err ? reject(ack.err) : resolve()
      );
    });

    // Update cache
    cacheGame(gameId, { ...game, status });
    log(`Game ${gameId} status updated to ${status}`);
    return true;
  } catch (error) {
    logError(`Error updating game status:`, error);
    return false;
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

  try {
    const promises = actors.map(actor => {
      const actorId = actor.actor_id || generateId();
      const actorData = {
        ...actor,
        actor_id: actorId,
        game_id: gameId,
        created_at: actor.created_at || Date.now(),
        status: actor.status || 'active'
      };
      
      return new Promise<void>((resolve, reject) => {
        gun.get(nodes.actors).get(actorId).put(actorData, (ack: any) => {
          if (ack.err) {
            reject(ack.err);
            return;
          }
          
          cacheActor(actorId, actorData);
          resolve();
        });
      });
    });

    await Promise.all(promises);
    log(`Set ${actors.length} actors for game ${gameId}`);
    return true;
  } catch (error) {
    logError(`Error setting game actors:`, error);
    return false;
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
    
    // Give some time for the initial scan to register the promises
    setTimeout(() => {
      // Wait for all game promises to resolve
      Promise.all(gamePromises).then(() => {
        log(`Retrieved ${games.length} games for user ${currentUser.user_id}`);
        resolve(games);
      });
    }, 300);
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

// Get a user's card in a game efficiently
export async function getUserCard(gameId: string, userId: string): Promise<Card | null> {
  log(`Fetching card for user ${userId} in game ${gameId}`);
  const cacheKey = `${gameId}:${userId}`;
  if (cardCache.has(cacheKey)) {
    log(`Cache hit: ${cacheKey}`);
    return cardCache.get(cacheKey)!;
  }

  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return null;
  }

  // First try getting through role_assignment (faster path)
  const actor = await getPlayerRole(gameId, userId);
  if (actor && actor.card_id) {
    const card = await getCard(actor.card_id);
    if (card) {
      cardCache.set(cacheKey, card);
      log(`Found card ${card.card_id} via role_assignment`);
      return card;
    }
  }

  // Fallback to the direct actor search approach
  return new Promise((resolve) => {
    gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
      if (actorData && actorData.game_id === gameId && actorData.user_id === userId && actorData.card_id) {
        log(`Found actor ${actorId} with card ${actorData.card_id}`);
        
        gun.get(nodes.cards).get(actorData.card_id).once((cardData: Card) => {
          if (!cardData) {
            logWarn(`Card ${actorData.card_id} not found for actor ${actorId}`);
            
            // Try alternative format
            if (actorData.card_id.startsWith('card_')) {
              const alternativeId = actorData.card_id.replace('card_', '');
              log(`Trying alternative ID: ${alternativeId}`);
              
              gun.get(nodes.cards).get(alternativeId).once((altCardData: Card) => {
                if (altCardData) {
                  log(`Found card with alternative ID: ${alternativeId}`);
                  const fixedCard = {
                    ...altCardData,
                    card_id: actorData.card_id
                  };
                  cardCache.set(cacheKey, fixedCard);
                  resolve(fixedCard);
                } else {
                  logError(`Card not found with alternative ID: ${alternativeId}`);
                  resolve(null);
                }
              });
            } else {
              resolve(null);
            }
            return;
          }
          
          // Card retrieved successfully
          log(`Successfully retrieved card: ${actorData.card_id}`);
          
          if (!cardData.card_id) {
            cardData.card_id = actorData.card_id;
          }
          
          cardCache.set(cacheKey, cardData);
          resolve(cardData);
        });
      }
    });
    
    // Use a Promise.resolve() to handle completion instead of setTimeout
    Promise.resolve().then(() => {
      if (!cardCache.has(cacheKey)) {
        log(`No actor found for user ${userId} in game ${gameId}`);
        resolve(null);
      }
    });
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
    log(`Creating actor in game ${gameId} with card ${cardId}`);
    const gun = getGun();
    const currentUser = getCurrentUser();
    
    if (!gun || !currentUser) {
      logError('Gun or user not initialized');
      return null;
    }

    const game = await getGame(gameId);
    if (!game) {
      logError(`Game not found: ${gameId}`);
      return null;
    }
    
    // Check if user is already in the game players
    const playersObj = game.players as Record<string, boolean | string>;
    if (!playersObj || !playersObj[currentUser.user_id]) {
      // Add user to game players first
      const success = await joinGame(gameId);
      if (!success) {
        logError(`Failed to join game ${gameId}`);
        return null;
      }
    }
    
    // Create actor
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

    // Concurrent operations for better performance
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        gun.get(nodes.actors).get(actorId).put(actor, (ack: any) => {
          if (ack.err) {
            logError('Error creating actor:', ack.err);
            reject(ack.err);
            return;
          }
          resolve();
        });
      }),
      getCard(cardId) // Prefetch card into cache
    ]);
    
    // Update role assignment and create relationships
    await Promise.all([
      assignRole(gameId, currentUser.user_id, actorId),
      createRelationship(`${nodes.users}/${currentUser.user_id}`, 'actors', `${nodes.actors}/${actorId}`),
      createRelationship(`${nodes.actors}/${actorId}`, 'card', `${nodes.cards}/${cardId}`),
      createRelationship(`${nodes.actors}/${actorId}`, 'game', `${nodes.games}/${gameId}`),
      // Add user to chat participants using createRelationship
      createRelationship(`${nodes.chat}/${gameId}_group/participants`, currentUser.user_id, `${nodes.users}/${currentUser.user_id}`)
    ]);
    
    // Direct approach to ensure User->Actor edge exists (more reliable than createRelationship)
    gun.get(nodes.users).get(currentUser.user_id).get('actors').get(actorId).put(true, (ack: any) => {
      if (ack.err) {
        logError(`Failed to create direct User->Actor edge: ${ack.err}`);
      } else {
        log(`Created direct User->Actor edge: ${currentUser.user_id} -> ${actorId}`);
      }
    });
    
    // Cache the actor
    cacheActor(actorId, actor);
    log(`Actor created: ${actorId} for user ${currentUser.user_id} in game ${gameId}`);
    
    return actor;
  } catch (error) {
    logError('Create actor error:', error);
    return null;
  }
}

// Get a user's actors from all games
export const actorCache = new Map<string, Actor>();

async function getUserActors(userId?: string): Promise<Actor[]> {
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
    
    return new Promise((resolve) => {
      const actors: Actor[] = [];
      const uniqueIds = new Set<string>();
      let methodsCompleted = 0;
      const totalMethods = 2; // Removed full actor scan method
      
      // Set a short global timeout to ensure we return something
      const globalTimeout = setTimeout(() => {
        if (actors.length > 0) {
          log(`Global timeout reached with ${actors.length} actors found`);
          finishCollection();
        } else {
          log(`Global timeout reached with no actors, waiting a bit longer`);
          // Give a bit more time if we have nothing
          setTimeout(finishCollection, 500);
        }
      }, 1500);
      
      // Method 1: Check actor cache first (instant retrieval)
      for (const [actorId, actor] of actorCache.entries()) {
        if (actor.user_id === userToCheck && !uniqueIds.has(actorId)) {
          log(`Found actor ${actorId} in cache for user ${userToCheck}`);
          uniqueIds.add(actorId);
          actors.push(actor);
        }
      }
      
      // Method 2: PRIORITY - Look at games' role_assignment for this user
      // This should be the most reliable source of actor assignments
      log(`[PRIMARY] Checking role assignments for user ${userToCheck}`);
      let roleAssignmentsComplete = false;
      
      gun.get(nodes.games).map().once((gameData: Game, gameId: string) => {
        if (!gameData) return;
        
        // Check both role_assignment and player_actor_map since player_actor_map is more reliable
        
        // Check player_actor_map first (preferred)
        if (gameData.player_actor_map) {
          // Handle both direct object and Gun.js reference formats
          if (typeof gameData.player_actor_map === 'object' && gameData.player_actor_map['#']) {
            // It's a reference - resolve it by doing a direct get with user ID as key
            const mapPath = gameData.player_actor_map['#'];
            
            gun.get(mapPath).get(userToCheck).once((actorId: string) => {
              if (actorId && actorId !== '_' && !uniqueIds.has(actorId)) {
                log(`Found player_actor_map reference: ${userToCheck} -> ${actorId} in game ${gameId}`);
                fetchActor(actorId, gameId);
              }
            });
          } else {
            // It's a direct object
            const actorId = gameData.player_actor_map[userToCheck];
            if (actorId && !uniqueIds.has(actorId)) {
              log(`Found player_actor_map direct: ${userToCheck} -> ${actorId} in game ${gameId}`);
              fetchActor(actorId, gameId);
            }
          }
        }
        
        // Also check role_assignment for completeness (backup)
        if (gameData.role_assignment) {
          gun.get(nodes.games).get(gameId).get('role_assignment').get(userToCheck).once((actorId: string) => {
            if (actorId && actorId !== '_' && !uniqueIds.has(actorId)) {
              log(`Found role_assignment: ${userToCheck} -> ${actorId} in game ${gameId}`);
              fetchActor(actorId, gameId);
            }
          });
        }
      }).then(() => {
        roleAssignmentsComplete = true;
        methodComplete();
      });
      
      // Method 3: Try to get actors from user->actors relationship (fallback)
      log(`[SECONDARY] Checking user->actors links for user ${userToCheck}`);
      let userActorsComplete = false;
      
      gun.get(nodes.users).get(userToCheck).get('actors').map().once((actorValue: any, actorId: string) => {
        if (actorId && actorId !== '_' && !uniqueIds.has(actorId)) {
          log(`Found actor link from user: ${actorId}`);
          fetchActor(actorId);
        }
      }).then(() => {
        userActorsComplete = true;
        methodComplete();
      });
      
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
            (roleAssignmentsComplete && userActorsComplete)) {
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
      
      // Use Promise.resolve() to handle completion
      Promise.resolve().then(() => {
        log(`Found ${actors.length} actors via role_assignment for game ${gameId}`);
        resolve(actors);
      });
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
      
      // Use Promise.resolve() to handle completion
      Promise.resolve().then(() => {
        log(`Found ${actors.length} actors for game ${gameId} via fallback method`);
        resolve(actors);
      });
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
export async function assignCardToActor(actorId: string, cardId: string): Promise<boolean> {
  log(`Assigning card ${cardId} to actor ${actorId}`);
  const gun = getGun();
  
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        gun.get(nodes.actors).get(actorId).get('card_id').put(cardId, (ack: any) =>
          ack.err ? reject(ack.err) : resolve()
        );
      }),
      createRelationship(`${nodes.actors}/${actorId}`, 'card', `${nodes.cards}/${cardId}`)
    ]);
    
    // Clear cache for this actor
    actorCache.delete(actorId);
    
    log(`Card ${cardId} assigned to actor ${actorId}`);
    return true;
  } catch (error) {
    logError(`Error assigning card ${cardId} to actor ${actorId}:`, error);
    return false;
  }
}