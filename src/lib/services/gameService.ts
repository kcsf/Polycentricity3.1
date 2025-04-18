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

// Create a new game (optimized with concurrent operations)
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
        user_id: 'dev-user-' + Date.now(),
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

    const game_id = generateId();
    const gameData: Game = {
      game_id,
      name,
      creator: currentUser.user_id,
      deck_type: deckType,
      deck: {},
      role_assignment: {},
      role_assignment_type: roleAssignmentType,
      players: { [currentUser.user_id]: true },
      created_at: Date.now(),
      status: GameStatus.CREATED
    };

    // Perform concurrent writes
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        gun.get(nodes.games).get(game_id).put({
          game_id,
          name,
          creator: currentUser.user_id,
          deck_type: deckType,
          role_assignment_type: roleAssignmentType,
          created_at: Date.now(),
          status: GameStatus.CREATED
        }, (ack: any) => (ack.err ? reject(ack.err) : resolve()));
      }),
      new Promise<void>((resolve, reject) => {
        gun.get(nodes.games).get(game_id).get('players').put({ [currentUser.user_id]: true }, (ack: any) => (ack.err ? reject(ack.err) : resolve()));
      }),
      new Promise<void>((resolve, reject) => {
        gun.get(nodes.games).get(game_id).get('deck').put({}, (ack: any) => (ack.err ? reject(ack.err) : resolve()));
      }),
      new Promise<void>((resolve, reject) => {
        gun.get(nodes.games).get(game_id).get('role_assignment').put({}, (ack: any) => (ack.err ? reject(ack.err) : resolve()));
      })
    ]);

    // Setup predefined deck if specified
    if (deckType === 'eco-village' || deckType === 'community-garden') {
      const actors = getPredefinedDeck(deckType);
      await setGameActors(game_id, actors as Actor[]);
    }

    // Create relationships for graph visualization
    await Promise.all([
      new Promise<void>((resolve) => {
        gun.get(nodes.users).get(currentUser.user_id).get('games').set(game_id as any, resolve);
      }),
      gun.get(nodes.games).get(game_id).get('creator_ref').put({ '#': `${nodes.users}/${currentUser.user_id}` }),
      deckType === 'eco-village' || deckType === 'community-garden'
        ? gun.get(nodes.games).get(game_id).get('deck_ref').put({ '#': `${nodes.decks}/${deckType === 'eco-village' ? 'd1' : 'd2'}` })
        : Promise.resolve()
    ]);

    // Cache the game and update current game store
    cacheGame(game_id, gameData);
    currentGameStore.set(gameData);
    log(`Game created: ${game_id}`);
    
    return gameData;
  } catch (error) {
    logError('Create game error:', error);
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

// Get all games
export async function getAllGames(): Promise<Game[]> {
  log('Getting all games');
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return [];
  }

  return new Promise((resolve) => {
    const games: Game[] = [];
    const uniqueIds = new Set<string>();
    
    gun.get(nodes.games).map().once((gameData: Game, gameId: string) => {
      if (gameData && gameId !== '_' && !uniqueIds.has(gameId)) {
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
    
    // Use a short timeout instead of .then() since Gun.js map().once() doesn't consistently support .then()
    // We'll implement a better solution when Gun.js provides more reliable promise support
    const gunRef = gun.get(nodes.games).map().once(() => {});
    
    // Use a separate promise that resolves after the Gun.js operations
    Promise.resolve().then(() => {
      log(`Retrieved ${games.length} games`);
      resolve(games);
    });
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
  const playersObj = game.players as Record<string, boolean>;
  if (playersObj && playersObj[currentUser.user_id]) {
    log(`User already in game: ${gameId}`);
    return true;
  }

  // Update players list with the current user
  const updatedPlayers = { ...(playersObj || {}), [currentUser.user_id]: true };
  
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
  const playersObj = game.players as Record<string, boolean>;
  if (!playersObj || !playersObj[currentUser.user_id]) {
    log(`User not in game: ${gameId}`);
    return true; // Already not in the game
  }

  const { [currentUser.user_id]: _, ...updatedPlayers } = playersObj;
  
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

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).put(actorId, (ack: any) =>
          ack.err ? reject(ack.err) : resolve()
        );
      }),
      gun.get(nodes.actors).get(actorId).get('user_id').put(userId)
    ]);

    // Update cache
    cacheRole(gameId, userId, actorId);
    log(`Role assigned: ${actorId} to user ${userId} in game ${gameId}`);
    return true;
  } catch (error) {
    logError(`Error assigning role ${actorId} to user ${userId}:`, error);
    return false;
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

  const actor = await getPlayerRole(gameId, userId);
  if (actor) {
    await gun.get(nodes.actors).get(actor.actor_id).get('user_id').put(null);
  }

  await gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).put(null);
  
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
    gun.get(nodes.users).get(currentUser.user_id).get('games').map().once((gameId: string) => {
      if (typeof gameId === 'string' && gameId !== '_') {
        getGame(gameId).then(game => {
          if (game) {
            games.push(game);
          }
        });
      }
    });
    
    // Use a separate promise that resolves after the Gun.js operations complete
    Promise.resolve().then(() => {
      log(`Retrieved ${games.length} games for user ${currentUser.user_id}`);
      resolve(games);
    });
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
    const playersObj = game.players as Record<string, boolean>;
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
      logWarn('No user ID available. Using mock user ID for development.');
      return [];
    }
    
    log(`Getting actors for user: ${userToCheck}`);
    
    return new Promise((resolve) => {
      const actors: Actor[] = [];
      const uniqueIds = new Set<string>();
      
      gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
        if (actorData && actorData.user_id === userToCheck && !uniqueIds.has(actorId)) {
          uniqueIds.add(actorId);
          
          if (!actorData.actor_id) {
            actorData.actor_id = actorId;
          }
          
          const actor = { ...actorData, actor_id: actorId };
          actors.push(actor);
          cacheActor(actorId, actor);
        }
      });
      // Use Promise.resolve() to handle completion instead of setTimeout
      Promise.resolve().then(() => {
        log(`Found ${actors.length} actors for user ${userToCheck}`);
        
        // Add caching layer to enhance future queries
        const processedActors = actors.map(async actor => {
          if (actor.card_id) {
            // Pre-cache cards for actors
            const card = await getCard(actor.card_id);
            if (card) {
              // Cache user:game:card relationship
              cardCache.set(`${actor.game_id}:${actor.user_id}`, card);
            }
          }
          return actor;
        });
        
        Promise.all(processedActors).then(enhancedActors => {
          log(`Enhanced ${enhancedActors.length} actors with actor properties`);
          resolve(enhancedActors);
        });
      });
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
    
    const playersObj = game.players as Record<string, boolean>;
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
            : Object.keys(game.players as Record<string, boolean>);
            
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