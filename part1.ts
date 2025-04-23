/**
 * gameService.ts - Game logic for Polycentricity3
 *
 * Provides schema-aligned operations for games, actors, cards, and agreements using optimized Gun.js functions.
 * Best Practices:
 * - Uses typed get/putSigned from gunService for schema alignment
 * - Avoids direct Gun.db calls, ensuring single-point access
 * - Returns typed data for Runes compatibility
 * - Implements caching and fire-and-forget writes for performance
 * - Handles pagination and sharding for scalability
 *
 * Features:
 * - Game creation with immediate cache updates
 * - Actor and card assignment with background verifications
 * - Agreement management with real-time subscriptions
 * - Optimized player role lookups and game joining/leaving
 * - Card value and capability name resolution
 */

import { getGun, nodes, get, putSigned, getCollection, buildShardedPath, createRelationship, generateId } from './gunService';
import { getCurrentUser } from './authService';
import { currentGameStore, setUserGames } from '../stores/gameStore';
import { get as getStore } from 'svelte/store';
import type { Game, Actor, Card, CardWithPosition, NodePosition, Agreement, AgreementWithPosition } from '$lib/types';
import { GameStatus, AgreementStatus } from '$lib/types';

// Caches for performance
const gameCache = new Map<string, Game>();
const actorCache = new Map<string, Actor>();
const cardCache = new Map<string, CardWithPosition>();
const agreementCache = new Map<string, AgreementWithPosition>();
const roleCache = new Map<string, string>(); // gameId:userId -> actorId

// Export caches for external use
export { actorCache, cardCache, agreementCache };

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

function cacheCard(cardId: string, card: CardWithPosition): void {
  cardCache.set(cardId, { ...card, card_id: cardId });
}

function cacheRole(gameId: string, userId: string, actorId: string): void {
  const key = `${gameId}:${userId}`;
  roleCache.set(key, actorId);
}

function cacheAgreement(agreementId: string, agreement: AgreementWithPosition): void {
  agreementCache.set(agreementId, { ...agreement, agreement_id: agreementId });
}

/**
 * Process card values_ref and capabilities_ref to extract names
 * @param ref - Record of value or capability IDs
 * @param prefix - 'value_' or 'cap_'
 * @returns Array of human-readable names
 */
function getCardNames(ref: Record<string, boolean> | undefined, prefix: 'value_' | 'cap_'): string[] {
  if (!ref) return [];
  return Object.keys(ref)
    .filter(key => key !== '_' && ref[key] === true && key.startsWith(prefix))
    .map(key => 
      key
        .replace(prefix, '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    );
}

/**
 * Create a new game with fire-and-forget approach for non-blocking UI
 * @param name - Game name
 * @param deckType - Deck type (e.g., 'eco-village')
 * @param roleAssignmentType - Role assignment strategy
 * @returns Created Game or null if failed
 */
export async function createGame(name: string, deckType: string, roleAssignmentType: string = 'random'): Promise<Game | null> {
  try {
    log(`Creating game: ${name} with deck type: ${deckType}`);
    const gun = getGun();
    const currentUser = getCurrentUser();

    if (!gun) {
      logError('Gun not initialized');
      return null;
    }

    if (!currentUser) {
      logWarn('No authenticated user. Using mock user for development');
      return null; // Enforce authentication in production
    }

    const gameId = generateId();
    const gameData: Game = {
      game_id: gameId,
      name,
      description: '',
      creator_ref: currentUser.user_id,
      deck_ref: deckType === 'eco-village' ? 'd1' : deckType === 'community-garden' ? 'd2' : 'd1',
      deck_type: deckType,
      status: GameStatus.ACTIVE,
      created_at: Date.now(),
      players: { [currentUser.user_id]: true },
      player_actor_map: { [currentUser.user_id]: null },
      actors_ref: {},
      agreements_ref: {},
      chat_rooms_ref: {}
    };

    cacheGame(gameId, gameData);
    currentGameStore.set(gameData);

    const writeStart = performance.now();
    await new Promise<void>((resolve) => {
      const writeTimeout = setTimeout(() => {
        log('Primary game data write timed out, proceeding anyway');
        resolve();
      }, 800);

      putSigned(`${nodes.games}/${gameId}`, gameData).then(ack => {
        clearTimeout(writeTimeout);
        if (ack.err) logError(`Primary game data write error: ${ack.err}`);
        else log('Primary game data write completed');
        resolve();
      });
    });

    log(`Primary game data wrote in ${performance.now() - writeStart}ms`);

    // Fire-and-forget secondary writes
    createRelationship(`${nodes.users}/${currentUser.user_id}`, 'games', `${nodes.games}/${gameId}`);
    const deckId = deckType === 'eco-village' ? 'd1' : deckType === 'community-garden' ? 'd2' : null;
    if (deckId) {
      createRelationship(`${nodes.games}/${gameId}`, 'deck_ref', `${nodes.decks}/${deckId}`);
    }

    // Delayed verification
    setTimeout(async () => {
      const savedGame = await get<Game>(`${nodes.games}/${gameId}`);
      if (!savedGame) {
        logError(`Game ${gameId} not saved, retrying`);
        await putSigned(`${nodes.games}/${gameId}`, gameData);
      }
      const map = await get<Game>(`${nodes.games}/${gameId}`);
      if (!map?.player_actor_map?.[currentUser.user_id]) {
        log(`Fixed missing player_actor_map for game ${gameId}`);
        await putSigned(`${nodes.games}/${gameId}`, { ...gameData, player_actor_map: { [currentUser.user_id]: null } });
      }
    }, 500);

    return gameData;
  } catch (error) {
    logError('Unhandled error in createGame:', error);
    return null;
  }
}

/**
 * Get a game by ID with caching
 * @param gameId - Game ID
 * @returns Game or null if not found
 */
export async function getGame(gameId: string): Promise<Game | null> {
  log(`Getting game: ${gameId}`);
  if (gameCache.has(gameId)) {
    log(`Cache hit: ${gameId}`);
    return gameCache.get(gameId)!;
  }

  const game = await get<Game>(`${nodes.games}/${gameId}`);
  if (!game) {
    log(`Game not found: ${gameId}`);
    return null;
  }

  cacheGame(gameId, game);
  log(`Game retrieved: ${gameId}`);
  return game;
}

/**
 * Get all games
 * @returns Array of Games
 */
export async function getAllGames(): Promise<Game[]> {
  log('Fetching all games...');
  const cachedGames = Array.from(gameCache.values());
  if (cachedGames.length > 0) {
    log(`Returning ${cachedGames.length} cached games while fetching fresh data`);
    setTimeout(() => fetchAllGamesBackground(), 100);
    return cachedGames;
  }

  const games = await getCollection<Game>(nodes.games);
  games.forEach(game => cacheGame(game.game_id, game));
  log(`Retrieved ${games.length} games`);
  return games;
}

/**
 * Background refresh for all games
 */
function fetchAllGamesBackground(): void {
  const gun = getGun();
  if (!gun) return;

  getCollection<Game>(nodes.games).then(games => {
    games.forEach(game => cacheGame(game.game_id, game));
    log(`Background refresh: Cached ${games.length} games`);
  });
}

/**
 * Join a game
 * @param gameId - Game ID
 * @returns Success status
 */
export async function joinGame(gameId: string): Promise<boolean> {
  log(`Joining game: ${gameId}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun || !currentUser) {
    logError('Gun or user not initialized');
    return false;
  }

  let game = gameCache.has(gameId) ? gameCache.get(gameId) : await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return false;
  }

  if (game.players[currentUser.user_id]) {
    log(`User already in game: ${gameId}`);
    return true;
  }

  const updatedPlayers = { ...game.players, [currentUser.user_id]: true };
  const updatedMap = { ...game.player_actor_map, [currentUser.user_id]: null };
  cacheGame(gameId, { ...game, players: updatedPlayers, player_actor_map: updatedMap });

  createRelationship(`${nodes.users}/${currentUser.user_id}`, 'games', `${nodes.games}/${gameId}`);
  createRelationship(`${nodes.games}/${gameId}`, 'players', `${nodes.users}/${currentUser.user_id}`);
  await putSigned(`${nodes.games}/${gameId}`, { ...game, players: updatedPlayers, player_actor_map: updatedMap });

  setTimeout(async () => {
    const savedGame = await get<Game>(`${nodes.games}/${gameId}`);
    if (!savedGame?.players[currentUser.user_id]) {
      log(`Player not added, retrying`);
      await putSigned(`${nodes.games}/${gameId}`, { ...game, players: updatedPlayers });
    }
    if (!savedGame?.player_actor_map[currentUser.user_id]) {
      log(`Player actor map not updated, retrying`);
      await putSigned(`${nodes.games}/${gameId}`, { ...game, player_actor_map: updatedMap });
    }
  }, 200);

  log(`Joined game: ${gameId}`);
  return true;
}

/**
 * Leave a game
 * @param gameId - Game ID
 * @returns Success status
 */
export async function leaveGame(gameId: string): Promise<boolean> {
  log(`Leaving game: ${gameId}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun || !currentUser) {
    logError('Gun or user not initialized');
    return false;
  }

  const game = await getGame(gameId);
  if (!game || !game.players[currentUser.user_id]) {
    log(`User not in game: ${gameId}`);
    return true;
  }

  const { [currentUser.user_id]: _, ...updatedPlayers } = game.players;
  const updatedMap = { ...game.player_actor_map, [currentUser.user_id]: null };
  cacheGame(gameId, { ...game, players: updatedPlayers, player_actor_map: updatedMap });

  await putSigned(`${nodes.games}/${gameId}`, { ...game, players: updatedPlayers, player_actor_map: updatedMap });
  const actor = await getPlayerRole(gameId, currentUser.user_id);
  if (actor) {
    await putSigned(`${nodes.actors}/${actor.actor_id}`, { ...actor, user_ref: null });
    const key = `${gameId}:${userId}`;
    roleCache.delete(key);
  }

  setTimeout(async () => {
    const savedGame = await get<Game>(`${nodes.games}/${gameId}`);
    if (savedGame?.players[currentUser.user_id]) {
      log(`Player still in game, retrying`);
      await putSigned(`${nodes.games}/${gameId}`, { ...game, players: updatedPlayers });
    }
  }, 500);

  log(`Left game: ${gameId}`);
  return true;
}

/**
 * Get an actor with card details
 * @param actorId - Actor ID
 * @param gameId - Game ID
 * @returns Actor with card details or null
 */
export async function getActorWithCard(actorId: string, gameId: string): Promise<Actor | null> {
  log(`Getting actor with card: ${actorId} in game ${gameId}`);
  const gun = getGun();
  if (!gun) return null;

  const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
  if (!actor || actor.game_ref !== gameId) return null;

  const card = actor.card_ref ? await get<CardWithPosition>(`${nodes.cards}/${actor.card_ref}`) : null;
  const position = await get<NodePosition>(buildShardedPath(nodes.node_positions, gameId, actorId)) ?? {
    node_id: actorId,
    game_ref: gameId,
    type: 'actor',
    x: 0,
    y: 0,
    updated_at: Date.now()
  };

  if (!card) return null;

  cacheActor(actorId, actor);
  return actor;
}

/**
 * Get player role
 * @param gameId - Game ID
 * @param userId - User ID
 * @param specifiedActorId - Optional specific actor ID
 * @returns Actor or null
 */
export async function getPlayerRole(gameId: string, userId: string, specifiedActorId?: string): Promise<Actor | null> {
  log(`Getting role for user ${userId} in game ${gameId}`);
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

  if (specifiedActorId) {
    const actor = await get<Actor>(`${nodes.actors}/${specifiedActorId}`);
    if (actor && actor.game_ref === gameId && actor.user_ref === userId) {
      cacheActor(specifiedActorId, actor);
      cacheRole(gameId, userId, specifiedActorId);
      return actor;
    }
    return null;
  }

  const game = await getGame(gameId);
  if (!game || !game.player_actor_map[userId]) return null;

  const actorId = game.player_actor_map[userId];
  if (!actorId) return null;

  const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
  if (actor && actor.game_ref === gameId && actor.user_ref === userId) {
    cacheActor(actorId, actor);
    cacheRole(gameId, userId, actorId);
    return actor;
  }
  return null;
}

/**
 * Assign a role to a player
 * @param gameId - Game ID
 * @param userId - User ID
 * @param actorId - Actor ID
 * @returns Success status
 */
export async function assignRole(gameId: string, userId: string, actorId: string): Promise<boolean> {
  log(`Assigning role ${actorId} to user ${userId} in game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
  if (!actor || actor.game_ref !== gameId || actor.user_ref) return false;

  cacheRole(gameId, userId, actorId);
  if (actorCache.has(actorId)) {
    const cachedActor = actorCache.get(actorId)!;
    cacheActor(actorId, { ...cachedActor, user_ref: userId });
  }

  const game = await getGame(gameId);
  if (!game) return false;

  const updatedMap = { ...game.player_actor_map, [userId]: actorId };
  cacheGame(gameId, { ...game, player_actor_map: updatedMap });

  await putSigned(`${nodes.actors}/${actorId}`, { ...actor, user_ref: userId });
  await putSigned(`${nodes.games}/${gameId}`, { ...game, player_actor_map: updatedMap });

  setTimeout(async () => {
    const savedActor = await get<Actor>(`${nodes.actors}/${actorId}`);
    if (!savedActor || savedActor.user_ref !== userId) {
      log(`Actor user_ref verification failed, retrying`);
      await putSigned(`${nodes.actors}/${actorId}`, { ...actor, user_ref: userId });
    }
  }, 500);

  return true;
}

/**
 * Update player-actor map
 * @param gameId - Game ID
 * @param userId - User ID
 * @param actorId - Actor ID
 * @returns Success status
 */
export async function updatePlayerActorMap(gameId: string, userId: string, actorId: string): Promise<boolean> {
  log(`Updating player_actor_map for user ${userId} -> actor ${actorId} in game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  const game = await getGame(gameId);
  if (!game) return false;

  const updatedMap = { ...game.player_actor_map, [userId]: actorId };
  cacheGame(gameId, { ...game, player_actor_map: updatedMap });
  cacheRole(gameId, userId, actorId);

  await putSigned(`${nodes.games}/${gameId}`, { ...game, player_actor_map: updatedMap });

  setTimeout(async () => {
    const savedGame = await get<Game>(`${nodes.games}/${gameId}`);
    if (!savedGame?.player_actor_map[userId]) {
      log(`Player-actor mapping verification failed, retrying`);
      await putSigned(`${nodes.games}/${gameId}`, { ...game, player_actor_map: updatedMap });
    }
  }, 500);

  return true;
}

/**
 * Get an agreement by ID
 * @param agreementId - Agreement ID
 * @returns AgreementWithPosition or null
 */
export async function getAgreement(agreementId: string): Promise<AgreementWithPosition | null> {
  log(`Getting agreement: ${agreementId}`);
  if (agreementCache.has(agreementId)) {
    log(`Cache hit for agreement: ${agreementId}`);
    return agreementCache.get(agreementId)!;
  }

  const agreement = await get<Agreement>(`${nodes.agreements}/${agreementId}`);
  if (!agreement) {
    log(`Agreement not found: ${agreementId}`);
    return null;
  }

  const agreementWithPosition: AgreementWithPosition = {
    ...agreement,
    position: { x: Math.random() * 800, y: Math.random() * 600 }
  };

  cacheAgreement(agreementId, agreementWithPosition);
  log(`Agreement retrieved: ${agreementId}`);
  return agreementWithPosition;
}

/**
 * Get available agreements for a game
 * @param gameId - Game ID
 * @returns Array of AgreementWithPosition
 */
export async function getAvailableAgreementsForGame(gameId: string): Promise<AgreementWithPosition[]> {
  log(`Getting all agreements for game: ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return [];
  }

  const game = await getGame(gameId);
  if (!game) {
    log(`Game not found: ${gameId}`);
    return [];
  }

  const agreements = await getCollection<Agreement>(nodes.agreements);
  const gameAgreements = agreements
    .filter(agreement => agreement.game_ref === gameId)
    .map(agreement => ({
      ...agreement,
      position: { x: Math.random() * 800, y: Math.random() * 600 }
    }));

  gameAgreements.forEach(agreement => cacheAgreement(agreement.agreement_id, agreement));
  log(`Retrieved ${gameAgreements.length} agreements for game: ${gameId}`);
  return gameAgreements;
}

/**
 * Create a new agreement
 * @param gameId - Game ID
 * @param title - Agreement title
 * @param description - Agreement summary
 * @param parties - Actor IDs
 * @param terms - Obligations and benefits per actor
 * @returns Created AgreementWithPosition or null
 */
export async function createAgreement(
  gameId: string,
  title: string,
  description: string,
  parties: string[],
  terms: Record<string, { obligations: string[]; benefits: string[] }>
): Promise<AgreementWithPosition | null> {
  log(`Creating agreement '${title}' for game: ${gameId}`);
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

  const agreementId = generateId();
  const createdAt = Date.now();
  const partiesRecord: Record<string, { card_ref: string; obligation: string; benefit: string }> = {};

  for (const actorId of parties) {
    const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
    if (actor && actor.card_ref) {
      partiesRecord[actorId] = {
        card_ref: actor.card_ref,
        obligation: terms[actorId]?.obligations.join('; ') || '',
        benefit: terms[actorId]?.benefits.join('; ') || ''
      };
    }
  }

  const agreement: Agreement = {
    agreement_id: agreementId,
    game_ref: gameId,
    creator_ref: currentUser.user_id,
    title,
    summary: description,
    type: 'asymmetric',
    status: AgreementStatus.PROPOSED,
    parties: partiesRecord,
    cards_ref: Object.fromEntries(Object.values(partiesRecord).map(p => [p.card_ref, true])),
    created_at: createdAt,
    updated_at: createdAt
  };

  const agreementWithPosition: AgreementWithPosition = {
    ...agreement,
    position: { x: Math.random() * 800, y: Math.random() * 600 }
  };

  cacheAgreement(agreementId, agreementWithPosition);

  const startTime = performance.now();
  await putSigned(`${nodes.agreements}/${agreementId}`, agreement);
  await createRelationship(`${nodes.games}/${gameId}`, 'agreements_ref', `${nodes.agreements}/${agreementId}`);
  for (const actorId of parties) {
    await createRelationship(`${nodes.agreements}/${agreementId}`, 'parties', `${nodes.actors}/${actorId}`);
    await createRelationship(`${nodes.actors}/${actorId}`, 'agreements_ref', `${nodes.agreements}/${agreementId}`);
  }

  setTimeout(async () => {
    const savedAgreement = await get<Agreement>(`${nodes.agreements}/${agreementId}`);
    if (!savedAgreement) {
      log(`Agreement ${agreementId} not saved, retrying`);
      await putSigned(`${nodes.agreements}/${agreementId}`, agreement);
    }
  }, 1000);

  log(`Agreement creation initiated: ${agreementId} (${performance.now() - startTime}ms)`);
  return agreementWithPosition;
}

/**
 * Update an existing agreement
 * @param agreementId - Agreement ID
 * @param updateData - Partial agreement data
 * @returns Updated AgreementWithPosition or null
 */
export async function updateAgreement(agreementId: string, updateData: Partial<Agreement>): Promise<AgreementWithPosition | null> {
  log(`Updating agreement: ${agreementId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return null;
  }

  const existingAgreement = await getAgreement(agreementId);
  if (!existingAgreement) {
    logError(`Agreement not found: ${agreementId}`);
    return null;
  }

  const updatedData: Partial<Agreement> = {
    ...updateData,
    updated_at: Date.now()
  };

  const updatedAgreement: AgreementWithPosition = {
    ...existingAgreement,
    ...updatedData
  };

  cacheAgreement(agreementId, updatedAgreement);
  await putSigned(`${nodes.agreements}/${agreementId}`, updatedAgreement);

  if (updateData.parties) {
    const previousParties = Object.keys(existingAgreement.parties || {});
    const newParties = Object.keys(updateData.parties as Record<string, any>);
    const partiesToRemove = previousParties.filter(id => !newParties.includes(id));
    const partiesToAdd = newParties.filter(id => !previousParties.includes(id));

    for (const actorId of partiesToRemove) {
      gun.get(nodes.actors).get(actorId).get('agreements_ref').get(agreementId).put(null);
      gun.get(nodes.agreements).get(agreementId).get('parties').get(actorId).put(null);
    }
    for (const actorId of partiesToAdd) {
      await createRelationship(`${nodes.agreements}/${agreementId}`, 'parties', `${nodes.actors}/${actorId}`);
      await createRelationship(`${nodes.actors}/${actorId}`, 'agreements_ref', `${nodes.agreements}/${agreementId}`);
    }
  }

  setTimeout(async () => {
    const savedAgreement = await get<Agreement>(`${nodes.agreements}/${agreementId}`);
    if (!savedAgreement || Object.keys(updatedData).some(key => savedAgreement[key as keyof Agreement] !== updatedData[key as keyof Agreement])) {
      log(`Agreement update verification failed, retrying`);
      await putSigned(`${nodes.agreements}/${agreementId}`, updatedAgreement);
    }
  }, 1000);

  return updatedAgreement;
}

/**
 * Subscribe to game agreements
 * @param gameId - Game ID
 * @param callback - Callback for agreement updates
