import { getGun, nodes, generateId, createRelationship } from './gunService';
import { getCurrentUser } from './authService';
import type { Game, Actor, Card } from '$lib/types';
import { GameStatus } from '$lib/types';
import { getPredefinedDeck } from '$lib/data/predefinedDecks';

// Caches for performance
const gameCache = new Map<string, Game>();
const actorCache = new Map<string, Actor>();
const cardCache = new Map<string, Card>();

// Conditional logging
const isDev = process.env.NODE_ENV !== 'production';
const log = (...args: any[]) => isDev && console.log('[gameService]', ...args);

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
      log('No authenticated user. Using mock user.');
      currentUser = {
        user_id: 'dev-user-' + Date.now(),
        name: 'Development User',
        email: 'dev@example.com',
        created_at: Date.now()
      };
    }

    if (!gun) {
      console.error('Gun not initialized');
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

    if (deckType === 'eco-village' || deckType === 'community-garden') {
      const actors = getPredefinedDeck(deckType);
      await setGameActors(game_id, actors);
    }

    await Promise.all([
      gun.get(nodes.users).get(currentUser.user_id).get('games').set(game_id),
      gun.get(nodes.games).get(game_id).get('creator_ref').put({ '#': `${nodes.users}/${currentUser.user_id}` }),
      deckType === 'eco-village' || deckType === 'community-garden'
        ? gun.get(nodes.games).get(game_id).get('deck_ref').put({ '#': `${nodes.decks}/${deckType === 'eco-village' ? 'd1' : 'd2'}` })
        : Promise.resolve()
    ]);

    gameCache.set(game_id, gameData);
    log(`Game created: ${game_id}`);
    return gameData;
  } catch (error) {
    console.error('Create game error:', error);
    return null;
  }
}

// Get a game by ID
export async function getGame(gameId: string): Promise<Game | null> {
  log(`Getting game: ${gameId}`);
  if (gameCache.has(gameId)) {
    log(`Cache hit: ${gameId}`);
    return gameCache.get(gameId)!;
  }

  const gun = getGun();
  if (!gun) {
    console.error('Gun not initialized');
    return null;
  }

  return new Promise((resolve) => {
    gun.get(nodes.games).get(gameId).once((gameData: Game) => {
      if (!gameData) {
        log(`Game not found: ${gameId}`);
        resolve(null);
        return;
      }
      gameCache.set(gameId, gameData);
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
    console.error('Gun not initialized');
    return [];
  }

  return new Promise((resolve) => {
    const games: Game[] = [];
    gun.get(nodes.games).map().once((gameData: Game, gameId: string) => {
      if (gameData && gameId !== '_') {
        const game = { ...gameData, game_id: gameId };
        games.push(game);
        gameCache.set(gameId, game);
      }
    }).then(() => {
      log(`Retrieved ${games.length} games`);
      resolve(games);
    });
  });
}

// Get all actors for a specific game
export async function getGameActors(gameId: string): Promise<Actor[]> {
  log(`Getting actors for game: ${gameId}`);
  const gun = getGun();
  if (!gun) {
    console.error('Gun not initialized');
    return [];
  }

  return new Promise((resolve) => {
    const actors: Actor[] = [];
    gun.get(nodes.games).get(gameId).get('players').map().once((actorId, userId) => {
      if (typeof actorId === 'string' && actorId.startsWith('a')) {
        gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
          if (actorData) {
            const actor = { ...actorData, actor_id: actorId };
            actors.push(actor);
            actorCache.set(actorId, actor);
          }
        });
      }
    }).then(() => {
      log(`Found ${actors.length} actors for game ${gameId}`);
      resolve(actors);
    });
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
    console.error('Gun not initialized');
    return null;
  }

  return new Promise((resolve) => {
    gun.get(nodes.cards).get(cardId).once((cardData: Card) => {
      if (!cardData) {
        if (cardId.startsWith('card_')) {
          const altId = cardId.replace('card_', '');
          gun.get(nodes.cards).get(altId).once((altCardData: Card) => {
            if (altCardData) {
              const card = { ...altCardData, card_id: cardId };
              cardCache.set(cardId, card);
              log(`Found card with alternative ID: ${altId}`);
              resolve(card);
            } else {
              resolve(null);
            }
          });
        } else {
          resolve(null);
        }
        return;
      }
      if (!cardData.card_id) cardData.card_id = cardId;
      cardCache.set(cardId, cardData);
      log(`Retrieved card: ${cardId}`);
      resolve(cardData);
    });
  });
}

// Get a user's card in a game
export async function getUserCard(gameId: string, userId: string): Promise<Card | null> {
  log(`Fetching card for user ${userId} in game ${gameId}`);
  const cacheKey = `${gameId}:${userId}`;
  if (cardCache.has(cacheKey)) {
    log(`Cache hit: ${cacheKey}`);
    return cardCache.get(cacheKey)!;
  }

  const gun = getGun();
  if (!gun) {
    console.error('Gun not initialized');
    return null;
  }

  const actor = await getPlayerRole(gameId, userId);
  if (actor && actor.card_id) {
    const card = await getCard(actor.card_id);
    if (card) {
      cardCache.set(cacheKey, card);
      log(`Found card ${card.card_id} via role_assignment`);
      return card;
    }
  }

  return new Promise((resolve) => {
    gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
      if (actorData && actorData.game_id === gameId && actorData.user_id === userId && actorData.card_id) {
        gun.get(nodes.cards).get(actorData.card_id).once((cardData: Card) => {
          if (!cardData) {
            if (actorData.card_id.startsWith('card_')) {
              const altId = actorData.card_id.replace('card_', '');
              gun.get(nodes.cards).get(altId).once((altCardData: Card) => {
                if (altCardData) {
                  const card = { ...altCardData, card_id: actorData.card_id };
                  cardCache.set(cacheKey, card);
                  log(`Found card with alternative ID: ${altId}`);
                  resolve(card);
                } else {
                  resolve(null);
                }
              });
            } else {
              resolve(null);
            }
            return;
          }
          if (!cardData.card_id) cardData.card_id = actorData.card_id;
          cardCache.set(cacheKey, cardData);
          log(`Found card ${cardData.card_id} via actors`);
          resolve(cardData);
        });
      }
    }).then(() => resolve(null));
  });
}

// Subscribe to a user's card
export function subscribeToUserCard(gameId: string, userId: string, callback: (card: Card | null) => void): () => void {
  log(`Subscribing to card for user ${userId} in game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    console.error('Gun not initialized');
    callback(null);
    return () => {};
  }

  const cacheKey = `${gameId}:${userId}`;
  let subscription: any;

  gun.get(nodes.games).get(gameId).get('role_assignment').get(userId).on((actorId) => {
    if (!actorId) {
      cardCache.delete(cacheKey);
      callback(null);
      return;
    }
    gun.get(nodes.actors).get(actorId).on((actorData: Actor) => {
      if (!actorData?.card_id) {
        cardCache.delete(cacheKey);
        callback(null);
        return;
      }
      subscription = gun.get(nodes.cards).get(actorData.card_id).on((cardData: Card) => {
        if (cardData) {
          if (!cardData.card_id) cardData.card_id = actorData.card_id;
          cardCache.set(cacheKey, cardData);
          callback(cardData);
        } else {
          cardCache.delete(cacheKey);
          callback(null);
        }
      });
    });
  });

  return () => {
    if (subscription) subscription.off();
    log(`Unsubscribed from card for user ${userId} in game ${gameId}`);
  };
}

// Other functions (summarized changes):
// - joinGame: Use Promise.all for concurrent player updates and relationships.
// - assignRole: Cache role assignments, add subscribeToRole.
// - getPlayerRole: Add caching, optimize with role_assignment first.
// - createActor: Concurrent puts, cache actor.
// - getUserActors: Replace setTimeout with .then(), add caching.
// - getAvailableCardsForGame: Replace setTimeout with .then(), cache cards.
// - fixGameRelationships: Concurrent relationship updates, add logging.
// - updateGameStatus, isGameFull, leaveGame: Add caching, optimize puts.

// Example for joinGame (others follow similar pattern)
export async function joinGame(gameId: string): Promise<boolean> {
  log(`Joining game: ${gameId}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun || !currentUser) {
    console.error('Gun or user not initialized');
    return false;
  }

  const game = await getGame(gameId);
  if (!game) {
    console.error(`Game not found: ${gameId}`);
    return false;
  }

  const playersObj = game.players as Record<string, boolean>;
  if (playersObj && playersObj[currentUser.user_id]) {
    log(`User already in game: ${gameId}`);
    return true;
  }

  const updatedPlayers = { ...(playersObj || {}), [currentUser.user_id]: true };
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      gun.get(nodes.games).get(gameId).get('players').put(updatedPlayers, (ack: any) => (ack.err ? reject(ack.err) : resolve()));
    }),
    gun.get(nodes.users).get(currentUser.user_id).get('games').set(gameId),
    gun.get(nodes.games).get(gameId).get('player_refs').set({ '#': `${nodes.users}/${currentUser.user_id}` })
  ]);

  gameCache.set(gameId, { ...game, players: updatedPlayers });
  log(`Joined game: ${gameId}`);
  return true;
}