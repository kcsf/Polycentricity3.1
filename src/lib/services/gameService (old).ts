import {
  getGun,
  nodes,
  get,
  put,
  putSigned,
  getCollection,
  buildShardedPath,
  createRelationship,
  generateId,
} from "./gunService";
import { getCurrentUser } from "./authService";
import { currentGameStore } from "../stores/gameStore";
import { get as getStore } from "svelte/store";
import type {
  Game,
  Actor,
  ActorWithCard,
  Card,
  CardWithPosition,
  NodePosition,
  Agreement,
  AgreementWithPosition,
} from "$lib/types";
import { GameStatus, AgreementStatus } from "$lib/types";

// Caches for performance
const gameCache = new Map<string, Game>();
const actorCache = new Map<string, Actor>();
const actorWithCardCache = new Map<string, ActorWithCard>(); // Separate cache for ActorWithCard
const cardCache = new Map<string, CardWithPosition>();
const agreementCache = new Map<string, AgreementWithPosition>();
const roleCache = new Map<string, string>(); // gameId:userId -> actorId

export { actorCache, actorWithCardCache, cardCache, agreementCache };

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
const log = (...args: any[]) => isDev && console.log("[gameService]", ...args);
const logWarn = (...args: any[]) =>
  isDev && console.warn("[gameService]", ...args);
const logError = (...args: any[]) => console.error("[gameService]", ...args);

// Utility for random position
function randomPos(): { x: number; y: number } {
  return { x: Math.random() * 800, y: Math.random() * 600 };
}

// Wrapper for putSigned with retry logic
async function signedPutOrRetry<T>(
  path: string,
  data: T,
  timeoutMs: number = 800,
): Promise<void> {
  await new Promise<void>((resolve) => {
    const writeTimeout = setTimeout(() => {
      log(`Write to ${path} timed out, proceeding anyway`);
      resolve();
    }, timeoutMs);

    putSigned(path, data).then((ack) => {
      clearTimeout(writeTimeout);
      if (ack.err) logError(`Write to ${path} error: ${ack.err}`);
      else log(`Write to ${path} completed`);
      resolve();
    });
  });

  setTimeout(async () => {
    const savedData = await get<T>(path);
    if (!savedData) {
      logError(`Data at ${path} not saved, retrying`);
      await putSigned(path, data);
    }
  }, 500);
}

// Cache helpers
function cacheGame(gameId: string, game: Game): void {
  gameCache.set(gameId, { ...game, game_id: gameId });
}
function cacheActor(actorId: string, actor: Actor): void {
  actorCache.set(actorId, { ...actor, actor_id: actorId });
}
function cacheActorWithCard(actorId: string, actor: ActorWithCard): void {
  actorWithCardCache.set(actorId, { ...actor, actor_id: actorId });
}
function cacheCard(cardId: string, card: CardWithPosition): void {
  cardCache.set(cardId, { ...card, card_id: cardId });
}
function cacheRole(gameId: string, userId: string, actorId: string): void {
  roleCache.set(`${gameId}:${userId}`, actorId);
}
function cacheAgreement(
  agreementId: string,
  agreement: AgreementWithPosition,
): void {
  agreementCache.set(agreementId, { ...agreement, agreement_id: agreementId });
}

/**
 * Helper to format raw value/capability IDs into human names
 */
function getCardNames(
  ref: Record<string, boolean> | undefined,
  prefix: "value_" | "cap_",
): string[] {
  if (!ref) return [];
  return Object.keys(ref)
    .filter((key) => key !== "_" && ref[key] && key.startsWith(prefix))
    .map((key) =>
      key
        .replace(prefix, "")
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    );
}

/**
 * Create a new game with fire-and-forget approach for non-blocking UI
 * @param name - Game name
 * @param deckType - Deck type (e.g., 'eco-village')
 * @param roleAssignmentType - Role assignment strategy ('player-choice' or 'random')
 * @param maxPlayers - Optional maximum number of players
 * @returns Created Game or null if failed
 */
export async function createGame(
  name: string,
  deckType: string,
  roleAssignmentType: "player-choice" | "random" = "random",
  maxPlayers?: number,
): Promise<Game | null> {
  try {
    log(`Creating game: ${name} with deck type: ${deckType}`);
    const gun = getGun();
    const currentUser = getCurrentUser();

    if (!gun || !currentUser) {
      logError("Gun or user not initialized");
      return null;
    }

    const gameId = generateId();
    const normalizedMaxPlayers =
      typeof maxPlayers === "number" && maxPlayers > 0 ? maxPlayers : undefined;

    if (normalizedMaxPlayers) {
      log(`Creating game with max_players: ${normalizedMaxPlayers}`);
    }

    const gameData: Game = {
      game_id: gameId,
      name,
      description: "",
      creator_ref: currentUser.user_id,
      deck_ref:
        deckType === "eco-village"
          ? "d1"
          : deckType === "community-garden"
            ? "d2"
            : "d1",
      deck_type: deckType,
      role_assignment_type: roleAssignmentType,
      status: GameStatus.ACTIVE,
      created_at: Date.now(),
      players: { [currentUser.user_id]: true },
      player_actor_map: { [currentUser.user_id]: null },
      actors_ref: {},
      agreements_ref: {},
      chat_rooms_ref: {},
      max_players: normalizedMaxPlayers,
    };

    cacheGame(gameId, gameData);
    currentGameStore.set(gameData);

    const writeStart = performance.now();
    await signedPutOrRetry(`${nodes.games}/${gameId}`, gameData);

    log(`Primary game data wrote in ${performance.now() - writeStart}ms`);

    // Fire-and-forget secondary writes
    createRelationship(
      `${nodes.users}/${currentUser.user_id}`,
      "games_ref",
      `${nodes.games}/${gameId}`,
    );
    const deckId =
      deckType === "eco-village"
        ? "d1"
        : deckType === "community-garden"
          ? "d2"
          : null;
    if (deckId) {
      createRelationship(
        `${nodes.games}/${gameId}`,
        "deck_ref",
        `${nodes.decks}/${deckId}`,
      );
    }

    return gameData;
  } catch (error) {
    logError("Unhandled error in createGame:", error);
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
  log("Fetching all games...");
  const cachedGames = Array.from(gameCache.values());
  if (cachedGames.length > 0) {
    log(
      `Returning ${cachedGames.length} cached games while fetching fresh data`,
    );
    setTimeout(() => fetchAllGamesBackground(), 100);
    return cachedGames;
  }

  const games = await getCollection<Game>(nodes.games);
  games.forEach((game) => cacheGame(game.game_id, game));
  log(`Retrieved ${games.length} games`);
  return games;
}

/**
 * Background refresh for all games
 */
function fetchAllGamesBackground(): void {
  const gun = getGun();
  if (!gun) return;

  getCollection<Game>(nodes.games).then((games) => {
    games.forEach((game) => cacheGame(game.game_id, game));
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
    logError("Gun or user not initialized");
    return false;
  }

  let game = gameCache.has(gameId)
    ? gameCache.get(gameId)
    : await getGame(gameId);
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

  await put(`${nodes.games}/${gameId}`, {
    players: updatedPlayers,
    player_actor_map: updatedMap,
  });

  cacheGame(gameId, {
    ...game,
    players: updatedPlayers,
    player_actor_map: updatedMap,
  });

  createRelationship(
    `${nodes.users}/${currentUser.user_id}`,
    "games_ref",
    `${nodes.games}/${gameId}`,
  );
  createRelationship(
    `${nodes.games}/${gameId}`,
    "players",
    `${nodes.users}/${currentUser.user_id}`,
  );

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
    logError("Gun or user not initialized");
    return false;
  }

  const game = await getGame(gameId);
  if (!game || !game.players[currentUser.user_id]) {
    log(`User not in game: ${gameId}`);
    return true;
  }

  const { [currentUser.user_id]: _, ...updatedPlayers } = game.players;
  const updatedMap = { ...game.player_actor_map, [currentUser.user_id]: null };

  await put(`${nodes.games}/${gameId}`, {
    players: updatedPlayers,
    player_actor_map: updatedMap,
  });

  cacheGame(gameId, {
    ...game,
    players: updatedPlayers,
    player_actor_map: updatedMap,
  });

  const actor = await getPlayerRole(gameId, currentUser.user_id);
  if (actor) {
    const updatedGamesRef = { ...actor.games_ref };
    delete updatedGamesRef[gameId];
    const updatedCardsByGame = { ...actor.cards_by_game };
    delete updatedCardsByGame[gameId];

    await put(`${nodes.actors}/${actor.actor_id}`, {
      ...actor,
      games_ref: updatedGamesRef,
      cards_by_game: updatedCardsByGame,
    });

    gun
      .get(nodes.games)
      .get(gameId)
      .get("actors_ref")
      .get(actor.actor_id)
      .put(null);

    const key = `${gameId}:${currentUser.user_id}`;
    roleCache.delete(key);
    actorCache.delete(actor.actor_id);
    actorWithCardCache.delete(actor.actor_id);
  }

  log(`Left game: ${gameId}`);
  return true;
}

/**
 * Get an actor with card details for a specific game
 * @param actorId - Actor ID
 * @param gameId - Game ID
 * @returns Actor with card details or null
 */
export async function getActorWithCard(
  actorId: string,
  gameId: string,
): Promise<ActorWithCard | null> {
  log(`Getting actor with card: ${actorId} in game ${gameId}`);
  if (actorWithCardCache.has(actorId)) {
    const cached = actorWithCardCache.get(actorId)!;
    if (cached.games_ref[gameId]) {
      log(`Cache hit for actor with card: ${actorId}`);
      return cached;
    }
  }

  const gun = getGun();
  if (!gun) return null;

  const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
  if (!actor || !actor.games_ref[gameId]) return null;

  const position =
    (await get<NodePosition>(
      buildShardedPath(nodes.node_positions, gameId, actorId),
    )) ?? undefined;

  const cardId = actor.cards_by_game[gameId];
  let card: CardWithPosition | undefined;
  if (cardId) {
    card = await getCard(cardId, true);
  }

  const out: ActorWithCard = {
    ...actor,
    card,
    position: position && { x: position.x, y: position.y },
  };
  cacheActor(actorId, actor);
  cacheActorWithCard(actorId, out);
  return out;
}

/**
 * Get player role
 * @param gameId - Game ID
 * @param userId - User ID
 * @param specifiedActorId - Optional specific actor ID
 * @returns Actor or null
 */
export async function getPlayerRole(
  gameId: string,
  userId: string,
  specifiedActorId?: string,
): Promise<Actor | null> {
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
    logError("Gun not initialized");
    return null;
  }

  if (specifiedActorId) {
    const actor = await get<Actor>(`${nodes.actors}/${specifiedActorId}`);
    if (actor && actor.games_ref[gameId] && actor.user_ref === userId) {
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
  if (actor && actor.games_ref[gameId] && actor.user_ref === userId) {
    cacheActor(actorId, actor);
    cacheRole(gameId, userId, actorId);
    return actor;
  }
  return null;
}

/**
 * Assign a role to a player by adding an existing Actor to a Game
 * @param gameId - Game ID
 * @param userId - User ID
 * @param actorId - Actor ID
 * @param cardId - Card ID for the Game
 * @returns Success status
 */
export async function assignRole(
  gameId: string,
  userId: string,
  actorId: string,
  cardId: string,
): Promise<boolean> {
  log(
    `Assigning role ${actorId} to user ${userId} in game ${gameId} with card ${cardId}`,
  );
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    return false;
  }

  const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
  if (!actor || actor.user_ref !== userId) return false;

  const game = await getGame(gameId);
  if (!game) return false;

  const updatedGamesRef = { ...actor.games_ref, [gameId]: true };
  const updatedCardsByGame = { ...actor.cards_by_game, [gameId]: cardId };

  cacheRole(gameId, userId, actorId);
  if (actorCache.has(actorId)) {
    const cachedActor = actorCache.get(actorId)!;
    cacheActor(actorId, {
      ...cachedActor,
      games_ref: updatedGamesRef,
      cards_by_game: updatedCardsByGame,
    });
  }
  if (actorWithCardCache.has(actorId)) {
    const cachedActorWithCard = actorWithCardCache.get(actorId)!;
    cacheActorWithCard(actorId, {
      ...cachedActorWithCard,
      games_ref: updatedGamesRef,
      cards_by_game: updatedCardsByGame,
      card: cardCache.get(cardId),
    });
  }

  const updatedMap = { ...game.player_actor_map, [userId]: actorId };
  cacheGame(gameId, { ...game, player_actor_map: updatedMap });

  await signedPutOrRetry(`${nodes.actors}/${actorId}`, {
    ...actor,
    games_ref: updatedGamesRef,
    cards_by_game: updatedCardsByGame,
  });
  await signedPutOrRetry(`${nodes.games}/${gameId}`, {
    ...game,
    player_actor_map: updatedMap,
    actors_ref: { ...game.actors_ref, [actorId]: true },
  });

  return true;
}

/**
 * Update player-actor map
 * @param gameId - Game ID
 * @param userId - User ID
 * @param actorId - Actor ID
 * @returns Success status
 */
export async function updatePlayerActorMap(
  gameId: string,
  userId: string,
  actorId: string,
): Promise<boolean> {
  log(
    `Updating player_actor_map for user ${userId} -> actor ${actorId} in game ${gameId}`,
  );
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    return false;
  }

  const game = await getGame(gameId);
  if (!game) return false;

  const updatedMap = { ...game.player_actor_map, [userId]: actorId };
  cacheGame(gameId, { ...game, player_actor_map: updatedMap });
  cacheRole(gameId, userId, actorId);

  await signedPutOrRetry(`${nodes.games}/${gameId}`, {
    ...game,
    player_actor_map: updatedMap,
  });

  return true;
}

/**
 * Get an agreement by ID
 * @param agreementId - Agreement ID
 * @returns AgreementWithPosition or null
 */
export async function getAgreement(
  agreementId: string,
): Promise<AgreementWithPosition | null> {
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
    position: randomPos(),
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
export async function getAvailableAgreementsForGame(
  gameId: string,
): Promise<AgreementWithPosition[]> {
  log(`Getting all agreements for game: ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    return [];
  }

  const game = await getGame(gameId);
  if (!game) {
    log(`Game not found: ${gameId}`);
    return [];
  }

  const agreements = await getCollection<Agreement>(nodes.agreements);
  const gameAgreements = agreements
    .filter((agreement) => agreement.game_ref === gameId)
    .map((agreement) => ({
      ...agreement,
      position: randomPos(),
    }));

  gameAgreements.forEach((agreement) =>
    cacheAgreement(agreement.agreement_id, agreement),
  );
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
  terms: Record<string, { obligations: string[]; benefits: string[] }>,
): Promise<AgreementWithPosition | null> {
  log(`Creating agreement '${title}' for game: ${gameId}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun || !currentUser) {
    logError("Gun or user not initialized");
    return null;
  }

  const game = await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return null;
  }

  const agreementId = generateId();
  const createdAt = Date.now();
  const partiesRecord: Record<
    string,
    { card_ref: string; obligation: string; benefit: string }
  > = {};

  for (const actorId of parties) {
    const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
    if (actor && actor.cards_by_game[gameId]) {
      partiesRecord[actorId] = {
        card_ref: actor.cards_by_game[gameId],
        obligation: terms[actorId]?.obligations.join("; ") || "",
        benefit: terms[actorId]?.benefits.join("; ") || "",
      };
    }
  }

  const agreement: Agreement = {
    agreement_id: agreementId,
    game_ref: gameId,
    creator_ref: currentUser.user_id,
    title,
    summary: description,
    type: "asymmetric",
    status: AgreementStatus.PROPOSED,
    parties: partiesRecord,
    cards_ref: Object.fromEntries(
      Object.values(partiesRecord).map((p) => [p.card_ref, true]),
    ),
    created_at: createdAt,
    updated_at: createdAt,
  };

  const agreementWithPosition: AgreementWithPosition = {
    ...agreement,
    position: randomPos(),
  };

  cacheAgreement(agreementId, agreementWithPosition);

  const startTime = performance.now();
  await signedPutOrRetry(`${nodes.agreements}/${agreementId}`, agreement);
  await createRelationship(
    `${nodes.games}/${gameId}`,
    "agreements_ref",
    `${nodes.agreements}/${agreementId}`,
  );
  for (const actorId of parties) {
    await createRelationship(
      `${nodes.agreements}/${agreementId}`,
      "parties",
      `${nodes.actors}/${actorId}`,
    );
    await createRelationship(
      `${nodes.actors}/${actorId}`,
      "agreements_ref",
      `${nodes.agreements}/${agreementId}`,
    );
  }

  log(
    `Agreement creation initiated: ${agreementId} (${performance.now() - startTime}ms)`,
  );
  return agreementWithPosition;
}

/**
 * Update an existing agreement
 * @param agreementId - Agreement ID
 * @param updateData - Partial agreement data
 * @returns Updated AgreementWithPosition or null
 */
export async function updateAgreement(
  agreementId: string,
  updateData: Partial<Agreement>,
): Promise<AgreementWithPosition | null> {
  log(`Updating agreement: ${agreementId}`);
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    return null;
  }

  const existingAgreement = await getAgreement(agreementId);
  if (!existingAgreement) {
    logError(`Agreement not found: ${agreementId}`);
    return null;
  }

  const updatedData: Partial<Agreement> = {
    ...updateData,
    updated_at: Date.now(),
  };

  const updatedAgreement: AgreementWithPosition = {
    ...existingAgreement,
    ...updatedData,
  };

  cacheAgreement(agreementId, updatedAgreement);
  await signedPutOrRetry(
    `${nodes.agreements}/${agreementId}`,
    updatedAgreement,
  );

  if (updateData.parties) {
    const previousParties = Object.keys(existingAgreement.parties || {});
    const newParties = Object.keys(updateData.parties as Record<string, any>);
    const partiesToRemove = previousParties.filter(
      (id) => !newParties.includes(id),
    );
    const partiesToAdd = newParties.filter(
      (id) => !previousParties.includes(id),
    );

    for (const actorId of partiesToRemove) {
      gun
        .get(nodes.actors)
        .get(actorId)
        .get("agreements_ref")
        .get(agreementId)
        .put(null);
      gun
        .get(nodes.agreements)
        .get(agreementId)
        .get("parties")
        .get(actorId)
        .put(null);
    }
    for (const actorId of partiesToAdd) {
      await createRelationship(
        `${nodes.agreements}/${agreementId}`,
        "parties",
        `${nodes.actors}/${actorId}`,
      );
      await createRelationship(
        `${nodes.actors}/${actorId}`,
        "agreements_ref",
        `${nodes.agreements}/${agreementId}`,
      );
    }
  }

  return updatedAgreement;
}

/**
 * Subscribe to game agreements
 * @param gameId - Game ID
 * @param callback - Callback for agreement updates
 * @returns Unsubscribe function
 */
export function subscribeToGameAgreements(
  gameId: string,
  callback: (agreements: AgreementWithPosition[]) => void,
): () => void {
  log(`Subscribing to agreements for game: ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    callback([]);
    return () => {};
  }

  const agreementSubscriptions: any[] = [];
  let initialLoad = true;

  const gameSubscription = gun
    .get(nodes.games)
    .get(gameId)
    .get("agreements_ref")
    .on((data: any) => {
      if (data && data["#"]) {
        const agreementId = data["#"].split("/").pop();
        if (agreementId && agreementId !== "_") {
          const subscription = gun
            .get(nodes.agreements)
            .get(agreementId)
            .on((agreement: Agreement) => {
              if (agreement && agreement.game_ref === gameId) {
                const agreementWithPos: AgreementWithPosition = {
                  ...agreement,
                  position: agreementCache.has(agreementId)
                    ? agreementCache.get(agreementId)!.position
                    : randomPos(),
                };
                cacheAgreement(agreementId, agreementWithPos);
                const agreements = Array.from(agreementCache.values()).filter(
                  (a) => a.game_ref === gameId,
                );
                callback(agreements);
              }
            });
          agreementSubscriptions.push(subscription);
        }
      }
    });

  if (initialLoad) {
    initialLoad = false;
    getAvailableAgreementsForGame(gameId).then((agreements) => {
      if (agreements.length > 0) callback(agreements);
    });
  }

  return () => {
    log(`Unsubscribing from agreements for game: ${gameId}`);
    gameSubscription.off();
    agreementSubscriptions.forEach((sub) => sub.off());
  };
}

/**
 * Get available cards for a game
 * @param gameId - Game ID
 * @param includeNames - Whether to include value and capability names
 * @returns Array of Cards
 */
export async function getAvailableCardsForGame(
  gameId: string,
  includeNames: boolean = false,
): Promise<CardWithPosition[]> {
  log(`Getting available cards for game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    return [];
  }

  const game = await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return [];
  }

  const deckId = game.deck_ref;
  if (!deckId) {
    logError(`No deck found for game ${gameId}`);
    return [];
  }

  const cards = await getCollection<Card>(nodes.cards);
  const usedCardIds = new Set<string>();
  const actors = await getCollection<Actor>(nodes.actors);
  actors
    .filter((actor) => actor.games_ref[gameId] && actor.cards_by_game[gameId])
    .forEach((actor) => usedCardIds.add(actor.cards_by_game[gameId]));

  const availableCards = cards
    .filter((card) => !usedCardIds.has(card.card_id) && card.decks_ref[deckId])
    .map((card) => ({
      ...card,
      position: randomPos(),
      _valueNames: includeNames
        ? getCardNames(card.values_ref, "value_")
        : undefined,
      _capabilityNames: includeNames
        ? getCardNames(card.capabilities_ref, "cap_")
        : undefined,
    }));

  availableCards.forEach((card) => cacheCard(card.card_id, card));
  log(`Found ${availableCards.length} available cards for game ${gameId}`);
  return availableCards;
}

/**
 * Get a card by ID
 * @param cardId - Card ID
 * @param includeNames - Whether to include value and capability names
 */
export async function getCard(
  cardId: string,
  includeNames: boolean = false,
): Promise<CardWithPosition | null> {
  log(`Fetching card: ${cardId}`);
  if (cardCache.has(cardId)) {
    const cached = cardCache.get(cardId)!;
    if (includeNames && (!cached._valueNames || !cached._capabilityNames)) {
      cached._valueNames = getCardNames(cached.values_ref, "value_");
      cached._capabilityNames = getCardNames(cached.capabilities_ref, "cap_");
      cacheCard(cardId, cached);
    }
    return cached;
  }

  const rawCard = await get<Card>(`${nodes.cards}/${cardId}`);
  if (!rawCard) {
    log(`Card not found: ${cardId}`);
    return null;
  }

  const flatValues: Record<string, boolean> = {};
  const flatCaps: Record<string, boolean> = {};

  const valueEntries = await getCollection<any>(
    `${nodes.cards}/${cardId}/values_ref`,
  );
  valueEntries.forEach((v) => {
    const vid = v.value_id || v.id;
    if (vid) flatValues[vid] = true;
  });

  const capEntries = await getCollection<any>(
    `${nodes.cards}/${cardId}/capabilities_ref`,
  );
  capEntries.forEach((c) => {
    const cid = c.capability_id || c.id;
    if (cid) flatCaps[cid] = true;
  });

  const _valueNames = includeNames
    ? getCardNames(flatValues, "value_")
    : undefined;
  const _capabilityNames = includeNames
    ? getCardNames(flatCaps, "cap_")
    : undefined;

  const cardWithPosition: CardWithPosition = {
    ...rawCard,
    values_ref: flatValues,
    capabilities_ref: flatCaps,
    position: randomPos(),
    _valueNames,
    _capabilityNames,
  };

  cacheCard(cardId, cardWithPosition);
  log(`Successfully retrieved card: ${cardId}`);
  return cardWithPosition;
}

/**
 * Get a user's card in a game
 * @param gameId - Game ID
 * @param userId - User ID
 * @param includeNames - Whether to include value and capability names
 * @returns Card or null
 */
export async function getUserCard(
  gameId: string,
  userId: string,
  includeNames: boolean = false,
): Promise<CardWithPosition | null> {
  log(`Fetching card for user ${userId} in game ${gameId}`);
  const cacheKey = `${gameId}:${userId}`;
  if (cardCache.has(cacheKey)) {
    log(`Cache hit: ${cacheKey}`);
    const card = cardCache.get(cacheKey)!;
    if (includeNames && (!card._valueNames || !card._capabilityNames)) {
      card._valueNames = getCardNames(card.values_ref, "value_");
      card._capabilityNames = getCardNames(card.capabilities_ref, "cap_");
      cardCache.set(cacheKey, card);
    }
    return card;
  }

  const actor = await getPlayerRole(gameId, userId);
  if (!actor || !actor.cards_by_game[gameId]) {
    log(`No card found for user ${userId} in game ${gameId}`);
    return null;
  }

  const card = await getCard(actor.cards_by_game[gameId], includeNames);
  if (card) {
    cardCache.set(cacheKey, card);
    log(`Found card ${card.card_id} for user ${userId}`);
  }
  return card;
}

/**
 * Subscribe to a user’s card
 * @param gameId - Game ID
 * @param userId - User ID
 * @param callback - Callback for card updates
 * @returns Unsubscribe function
 */
export function subscribeToUserCard(
  gameId: string,
  userId: string,
  callback: (card: CardWithPosition | null) => void,
): () => void {
  log(`Subscribing to card for user ${userId} in game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    callback(null);
    return () => {};
  }

  const cacheKey = `${gameId}:${userId}`;
  let cardSubscription: any;
  let actorSubscription: any;
  let playerSubscription: any;

  playerSubscription = gun
    .get(nodes.games)
    .get(gameId)
    .get("player_actor_map")
    .on((data: any) => {
      const actorId = data?.[userId];
      if (!actorId) {
        log(`No role assigned to user ${userId} in game ${gameId}`);
        cardCache.delete(cacheKey);
        callback(null);
        return;
      }

      if (actorSubscription) actorSubscription.off();
      actorSubscription = gun
        .get(nodes.actors)
        .get(actorId)
        .on((actorData: Actor) => {
          if (!actorData || !actorData.cards_by_game[gameId]) {
            log(`No card for actor ${actorId} in game ${gameId}`);
            cardCache.delete(cacheKey);
            callback(null);
            return;
          }

          if (cardSubscription) cardSubscription.off();
          cardSubscription = gun
            .get(nodes.cards)
            .get(actorData.cards_by_game[gameId])
            .on((cardData: Card) => {
              if (!cardData) {
                log(`Card ${actorData.cards_by_game[gameId]} not found`);
                cardCache.delete(cacheKey);
                callback(null);
                return;
              }

              const cardWithPosition: CardWithPosition = {
                ...cardData,
                position: randomPos(),
                _valueNames: getCardNames(cardData.values_ref, "value_"),
                _capabilityNames: getCardNames(
                  cardData.capabilities_ref,
                  "cap_",
                ),
              };

              cardCache.set(cacheKey, cardWithPosition);
              callback(cardWithPosition);
            });
        });
    });

  return () => {
    if (playerSubscription) playerSubscription.off();
    if (actorSubscription) actorSubscription.off();
    if (cardSubscription) cardSubscription.off();
    log(`Unsubscribed from card for user ${userId} in game ${gameId}`);
  };
}

/**
 * Create a new actor
 * @param gameId - Game ID
 * @param cardId - Card ID for the Game
 * @param actorType - Actor type
 * @param customName - Optional custom name
 * @returns Created Actor or null
 */
export async function createActor(
  gameId: string,
  cardId: string,
  actorType: Actor["actor_type"],
  customName?: string,
): Promise<Actor | null> {
  log(`Creating actor for game ${gameId} with card ${cardId}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun || !currentUser) {
    logError("Gun or user not initialized");
    return null;
  }

  const game = await get<Game>(`${nodes.games}/${gameId}`);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return null;
  }

  const actorId = generateId();
  const actor: Actor = {
    actor_id: actorId,
    user_ref: currentUser.user_id,
    games_ref: { [gameId]: true },
    cards_by_game: { [gameId]: cardId },
    actor_type: actorType,
    custom_name: customName,
    status: "active",
    agreements_ref: {},
    created_at: Date.now(),
  };

  cacheActor(actorId, actor);
  cacheRole(gameId, currentUser.user_id, actorId);

  await signedPutOrRetry(`${nodes.actors}/${actorId}`, actor);
  await createRelationship(
    `${nodes.users}/${currentUser.user_id}`,
    "actors_ref",
    `${nodes.actors}/${actorId}`,
  );
  await createRelationship(
    `${nodes.games}/${gameId}`,
    "actors_ref",
    `${nodes.actors}/${actorId}`,
  );
  await updatePlayerActorMap(gameId, currentUser.user_id, actorId);

  return actor;
}

/**
 * Get user’s actors across all games
 * @param userId - Optional user ID (defaults to current user)
 * @returns Array of Actors
 */
export async function getUserActors(userId?: string): Promise<Actor[]> {
  log(`Getting actors for user: ${userId || "current"}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun) {
    logError("Gun not initialized");
    return [];
  }

  const userToCheck = userId || currentUser?.user_id;
  if (!userToCheck) {
    logWarn("No user ID available");
    return [];
  }

  const actors = await getCollection<Actor>(nodes.actors);
  const userActors = actors.filter((actor) => actor.user_ref === userToCheck);
  userActors.forEach((actor) => cacheActor(actor.actor_id, actor));
  log(`Found ${userActors.length} actors for user ${userToCheck}`);
  return userActors;
}

/**
 * Get all actors for a game
 * @param gameId - Game ID
 * @returns Array of ActorWithCard
 */
export async function getGameActors(gameId: string): Promise<ActorWithCard[]> {
  log(`Getting actors for game: ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    return [];
  }

  const actors = await getCollection<Actor>(nodes.actors);
  const gameActorsPromises = actors
    .filter((actor) => actor.games_ref[gameId])
    .map((actor) => getActorWithCard(actor.actor_id, gameId));

  const gameActors = (await Promise.all(gameActorsPromises)).filter(
    (actor): actor is ActorWithCard => actor !== null,
  );
  gameActors.forEach((actor) => {
    cacheActor(actor.actor_id, actor);
    cacheActorWithCard(actor.actor_id, actor);
  });
  log(`Found ${gameActors.length} actors for game ${gameId}`);
  return gameActors;
}

/**
 * Subscribe to game actors
 * @param gameId - Game ID
 * @param callback - Callback for actor updates
 * @returns Unsubscribe function
 */
export function subscribeToGameActors(
  gameId: string,
  callback: (actors: ActorWithCard[]) => void,
): () => void {
  log(`Subscribing to actors for game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    callback([]);
    return () => {};
  }

  const actorSubscriptions: any[] = [];
  const actors: ActorWithCard[] = [];
  const uniqueIds = new Set<string>();

  const subscription = gun
    .get(nodes.games)
    .get(gameId)
    .get("actors_ref")
    .on((data: any) => {
      if (data && data["#"]) {
        const actorId = data["#"].split("/").pop();
        if (actorId && actorId !== "_") {
          const actorSubscription = gun
            .get(nodes.actors)
            .get(actorId)
            .on(async (actorData: Actor) => {
              if (actorData && actorData.games_ref[gameId]) {
                const actorWithCard = await getActorWithCard(actorId, gameId);
                if (!actorWithCard) return;

                const actorIndex = actors.findIndex(
                  (a) => a.actor_id === actorId,
                );
                if (actorIndex >= 0) {
                  actors[actorIndex] = actorWithCard;
                } else {
                  actors.push(actorWithCard);
                  uniqueIds.add(actorId);
                }
                cacheActor(actorId, actorData);
                cacheActorWithCard(actorId, actorWithCard);
                callback([...actors]);
              }
            });
          actorSubscriptions.push(actorSubscription);
        }
      }
    });

  return () => {
    subscription.off();
    actorSubscriptions.forEach((sub) => sub.off());
    log(`Unsubscribed from actors for game ${gameId}`);
  };
}

/**
 * Update game status
 * @param gameId - Game ID
 * @param status - New status
 * @returns Success status
 */
export async function updateGame(
  gameId: string,
  updates: Partial<Game>,
): Promise<boolean> {
  log(`[updateGame] Updating game ${gameId} with`, updates);
  try {
    const gun = getGun();
    if (!gun) {
      logError("Gun not initialized");
      return false;
    }

    const existingGame = await getGame(gameId);
    if (!existingGame) {
      logError(`Game not found: ${gameId}`);
      return false;
    }

    if (updates.max_players !== undefined) {
      if (typeof updates.max_players === "string") {
        updates.max_players = parseInt(updates.max_players as string, 10);
      }
      if (
        typeof updates.max_players !== "number" ||
        updates.max_players <= 0 ||
        isNaN(updates.max_players)
      ) {
        updates.max_players = undefined;
      }
      log(`[updateGame] Normalized max_players to: ${updates.max_players}`);
    }

    const payload = {
      ...updates,
      updated_at: Date.now(),
    };

    await put(`${nodes.games}/${gameId}`, payload);

    const mergedGame = {
      ...existingGame,
      ...payload,
    };
    cacheGame(gameId, mergedGame);

    const currentGame = getStore(currentGameStore);
    if (currentGame && currentGame.game_id === gameId) {
      currentGameStore.set(mergedGame);
    }

    log(`[updateGame] Updated game ${gameId}`);
    return true;
  } catch (error) {
    logError("[updateGame] Error:", error);
    return false;
  }
}

export async function updateGameStatus(
  gameId: string,
  status: GameStatus,
): Promise<boolean> {
  return updateGame(gameId, { status });
}

/**
 * Subscribe to a game
 * @param gameId - Game ID
 * @param callback - Callback for game updates
 * @returns Unsubscribe function
 */
export function subscribeToGame(
  gameId: string,
  callback: (game: Game) => void,
): () => void {
  log(`Subscribing to game: ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    callback(null as any);
    return () => {};
  }

  const subscription = gun
    .get(nodes.games)
    .get(gameId)
    .on((gameData: Game) => {
      if (!gameData) {
        log(`Game subscription: ${gameId} - no data`);
        return;
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

/**
 * Set actors for a game
 * @param gameId - Game ID
 * @param actors - Array of Actors
 * @returns Success status
 */
export async function setGameActors(
  gameId: string,
  actors: Actor[],
): Promise<boolean> {
  log(`Setting ${actors.length} actors for game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    return false;
  }

  const batchSize = 4;
  const startTime = performance.now();

  for (let i = 0; i < Math.min(batchSize, actors.length); i++) {
    const actor = actors[i];
    const actorId = actor.actor_id || generateId();
    const actorData: Actor = {
      ...actor,
      actor_id: actorId,
      games_ref: { ...actor.games_ref, [gameId]: true },
      cards_by_game: { ...actor.cards_by_game },
      created_at: Date.now(),
      status: "active",
    };
    cacheActor(actorId, actorData);
    await put(`${nodes.actors}/${actorId}`, actorData);
    await gun
      .get(nodes.games)
      .get(gameId)
      .get("actors_ref")
      .get(actorId)
      .put(true);
  }

  if (actors.length > batchSize) {
    setTimeout(async () => {
      const remainingActors = actors.slice(batchSize);
      for (const actor of remainingActors) {
        const actorId = actor.actor_id || generateId();
        const actorData: Actor = {
          ...actor,
          actor_id: actorId,
          games_ref: { ...actor.games_ref, [gameId]: true },
          cards_by_game: { ...actor.cards_by_game },
          created_at: Date.now(),
          status: "active",
        };
        cacheActor(actorId, actorData);
        await put(`${nodes.actors}/${actorId}`, actorData);
        await gun
          .get(nodes.games)
          .get(gameId)
          .get("actors_ref")
          .get(actorId)
          .put(true);
      }
    }, 50);
  }

  log(
    `Initiated actor setup for ${actors.length} actors in ${performance.now() - startTime}ms`,
  );
  return true;
}

/**
 * Check if a game is full
 * @param gameId - Game ID
 * @returns Whether the game is full
 */
export async function isGameFull(gameId: string): Promise<boolean> {
  log(`Checking if game ${gameId} is full`);
  const game = await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return false;
  }

  const maxPlayers =
    typeof game.max_players === "string"
      ? parseInt(game.max_players as string, 10)
      : game.max_players;

  if (!maxPlayers) return false;

  const playerCount = Object.keys(game.players || {}).length;
  const isFull = playerCount >= maxPlayers;
  log(
    `Game ${gameId} has ${playerCount}/${maxPlayers} players. Full: ${isFull}`,
  );
  return isFull;
}

/**
 * Fetch all the data your Game Details page needs in one call:
 * - Game record
 * - Deck: total/used/available card counts
 * - Actors in the game
 * - Agreements in the game
 */
export interface GameContext {
  game: Game;
  totalCards: number;
  usedCards: number;
  availableCards: CardWithPosition[];
  availableCardsCount: number;
  actors: ActorWithCard[];
  agreements: AgreementWithPosition[];
}

export async function getGameContext(
  gameId: string,
): Promise<GameContext | null> {
  try {
    // Fetch the game
    const game = await getGame(gameId);
    console.log(`[Debug] getGameContext: Game for ${gameId}:`, game);
    if (!game) {
      console.log(`[Debug] getGameContext: Game ${gameId} not found`);
      return null;
    }

    // Fetch actors, cards, and agreements concurrently
    const [actors, availableCards, agreements] = await Promise.all([
      getGameActors(gameId),
      getAvailableCardsForGame(gameId, true),
      getAvailableAgreementsForGame(gameId),
    ]);
    console.log(`[Debug] getGameContext: Actors for ${gameId}:`, actors);
    console.log(
      `[Debug] getGameContext: Available cards for ${gameId}:`,
      availableCards,
    );
    console.log(
      `[Debug] getGameContext: Agreements for ${gameId}:`,
      agreements,
    );

    // Calculate card counts
    const deckId = game.deck_ref;
    let totalCards = 0;
    let usedCards = 0;
    if (deckId) {
      const deck = await get<any>(`${nodes.decks}/${deckId}`);
      console.log(`[Debug] getGameContext: Deck for ${deckId}:`, deck);
      totalCards =
        deck && deck.cards_ref ? Object.keys(deck.cards_ref).length : 0;
      usedCards = actors.filter(
        (actor) => actor.cards_by_game?.[gameId],
      ).length;
    } else {
      console.log(`[Debug] getGameContext: No deck found for game ${gameId}`);
    }
    const availableCardsCount = totalCards - usedCards;

    console.log(
      `[Debug] getGameContext: Card counts - Total: ${totalCards}, Used: ${usedCards}, Available: ${availableCardsCount}`,
    );

    return {
      game,
      totalCards,
      usedCards,
      availableCards: availableCards || [],
      availableCardsCount,
      actors: actors || [],
      agreements: agreements || [],
    };
  } catch (error) {
    console.error(
      `[Debug] getGameContext: Error loading game context for ${gameId}:`,
      error,
    );
    return null;
  }
}

/**
 * Fix game relationships for visualization
 * @returns Success status and number of games fixed
 */
export async function fixGameRelationships(): Promise<{
  success: boolean;
  gamesFixed: number;
}> {
  log("Fixing game relationships for visualization");
  const gun = getGun();
  if (!gun) {
    logError("Gun not initialized");
    return { success: false, gamesFixed: 0 };
  }

  const allGames = await getAllGames();
  let gamesFixed = 0;

  for (const game of allGames) {
    const promises: Promise<any>[] = [];
    if (game.creator_ref) {
      promises.push(
        createRelationship(
          `${nodes.users}/${game.creator_ref}`,
          "games_ref",
          `${nodes.games}/${game.game_id}`,
        ),
      );
    }

    if (game.deck_ref) {
      promises.push(
        createRelationship(
          `${nodes.games}/${game.game_id}`,
          "deck_ref",
          `${nodes.decks}/${game.deck_ref}`,
        ),
      );
    }

    for (const playerId of Object.keys(game.players)) {
      if (playerId !== "_") {
        promises.push(
          createRelationship(
            `${nodes.users}/${playerId}`,
            "games_ref",
            `${nodes.games}/${game.game_id}`,
          ),
        );
        promises.push(
          createRelationship(
            `${nodes.games}/${game.game_id}`,
            "players",
            `${nodes.users}/${playerId}`,
          ),
        );
      }
    }

    for (const actorId of Object.keys(game.actors_ref)) {
      promises.push(
        createRelationship(
          `${nodes.games}/${game.game_id}`,
          "actors_ref",
          `${nodes.actors}/${actorId}`,
        ),
      );
      promises.push(
        createRelationship(
          `${nodes.actors}/${actorId}`,
          "games_ref",
          `${nodes.games}/${game.game_id}`,
        ),
      );
    }

    await Promise.all(promises);
    gamesFixed++;
  }

  log(`Fixed relationships for ${gamesFixed} games`);
  return { success: true, gamesFixed };
}
