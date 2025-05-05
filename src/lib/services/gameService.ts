// src/lib/services/gameService.ts

import {
  get,
  putSigned,
  getCollection,
  createRelationship,
  buildShardedPath,
  generateId,
  getSet,
  getGun,
  subscribe,
  nodes,
} from "./gunService";
import { getCurrentUser } from "./authService";
import { currentGameStore } from "../stores/gameStore";
import type {
  User,
  Game,
  Actor,
  ActorWithCard,
  Card,
  CardWithPosition,
  Agreement,
  AgreementWithPosition,
  NodePosition,
  Deck,
  Value,
  Capability,  
  ChatRoom,
  ChatMessage,
} from "$lib/types";
import { GameStatus, AgreementStatus } from "$lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: signed writes with retry
// ─────────────────────────────────────────────────────────────────────────────
// Update the function signature to constrain T to a specific set of types
async function signedPutOrRetry<T extends Game | User | Actor | Agreement | ChatRoom | ChatMessage | Card | Deck | Value | Capability | NodePosition | null>(
  collection: string,
  id: string,
  data: T,
  timeoutMs: number = 800,
): Promise<void> {
  await new Promise<void>((resolve) => {
    const writeTimeout = setTimeout(() => {
      console.log(`Write to ${collection}/${id} timed out, proceeding anyway`);
      resolve();
    }, timeoutMs);
    putSigned(`${collection}/${id}`, data).then((ack) => {
      clearTimeout(writeTimeout);
      if (ack.err) console.error(`Write to ${collection}/${id} error: ${ack.err}`);
      else console.log(`Write to ${collection}/${id} completed`);
      resolve();
    });
  });

  // verify and retry if needed
  setTimeout(async () => {
    const saved = await get<T>(`${collection}/${id}`);
    if (!saved) {
      console.error(`Data at ${collection}/${id} not saved, retrying`);
      await putSigned(`${collection}/${id}`, data);
    }
  }, 500);
}

function randomPos(): { x: number; y: number } {
  return { x: Math.random() * 800, y: Math.random() * 600 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Game flows
// ─────────────────────────────────────────────────────────────────────────────
export async function createGame(
  name: string,
  deckType: string,
  roleAssignmentType: "player-choice" | "random" = "random",
  maxPlayers?: number,
): Promise<Game | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const gameId = generateId();
  const normalizedMax = maxPlayers && maxPlayers > 0 ? maxPlayers : undefined;

  const gameData: Game = {
    game_id:         gameId,
    name,
    description:     "",
    creator_ref:     user.user_id,
    deck_ref:        deckType === "eco-village" ? "d_1" : "d_2",
    deck_type:       deckType,
    role_assignment_type: roleAssignmentType,
    status:          GameStatus.ACTIVE,
    created_at:      Date.now(),
    updated_at:      Date.now(),
    players:         { [user.user_id]: true },
    player_actor_map:{},
    actors_ref:      {},
    agreements_ref:  {},
    chat_rooms_ref:  {},
    max_players:     normalizedMax,
  };

  currentGameStore.set(gameData);
  await signedPutOrRetry(nodes.games, gameId, gameData);

  // Link relationships
  createRelationship(
    `${nodes.games}/${gameId}`,
    "creator_ref",
    `${nodes.users}/${user.user_id}`,
  );
  createRelationship(
    `${nodes.users}/${user.user_id}`,
    "games_ref",
    `${nodes.games}/${gameId}`,
  );
  createRelationship(
    `${nodes.games}/${gameId}`,
    "deck_ref",
    `${nodes.decks}/${gameData.deck_ref}`,
  );

  return gameData;
}

export async function getGame(gameId: string): Promise<Game | null> {
  const data = await get<Game>(`${nodes.games}/${gameId}`);
  console.log(`[GameService] Fetched game ${gameId}:`, data);
  return data ? { ...data, game_id: gameId } : null;
}

export async function getAllGames(): Promise<Game[]> {
  const raw = await getCollection<Game>(nodes.games);
  return raw.map((g) => ({ ...g, game_id: g.game_id }));
}

export function subscribeToGames(callback: (g: Game) => void): () => void {
  return getGun()
    .get(nodes.games)
    .map()
    .on((data: any, id: string) => {
      if (data) callback({ ...(data as Game), game_id: id });
    });
}

export function subscribeToGame(
  gameId: string,
  callback: (g: Game) => void,
): () => void {
  return subscribe<Omit<Game, "game_id">>(
    `${nodes.games}/${gameId}`,
    (data) => data && callback({ ...(data as any), game_id: gameId }),
  );
}

export async function updateGame(
  gameId: string,
  updates: Partial<Game>,
): Promise<boolean> {
  updates.updated_at = Date.now();
  await signedPutOrRetry(nodes.games, gameId, updates as any);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actor flows
// ─────────────────────────────────────────────────────────────────────────────
export async function createActor(
  gameId: string,
  cardId: string,
  actorType: Actor["actor_type"],
  customName?: string,
): Promise<Actor | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const actorId = generateId();
  const now     = Date.now();

  // 1️⃣ Build the full actor record
  const actor: Actor = {
    actor_id:       actorId,
    user_ref:       user.user_id,
    actor_type:     actorType,
    custom_name:    customName,
    status:         "active",
    created_at:     now,
    updated_at:     now,
    games_ref:      { [gameId]: true },
    cards_by_game:  { [gameId]: cardId },
    agreements_ref: {},
  };

  // 2️⃣ Write the root actor node (without nested maps)
  const { games_ref, cards_by_game, agreements_ref, ...root } = actor;
  await signedPutOrRetry(nodes.actors, actorId, root as any);

  // 3️⃣ Write each nested map
  await signedPutOrRetry(
    `${nodes.actors}/${actorId}`,
    "games_ref",
    games_ref
  );
  await signedPutOrRetry(
    `${nodes.actors}/${actorId}`,
    "cards_by_game",
    cards_by_game
  );
  await signedPutOrRetry(
    `${nodes.actors}/${actorId}`,
    "agreements_ref",
    agreements_ref
  );

  // 4️⃣ Wire up edges exactly like sampleDataService
  createRelationship(
    `${nodes.users}/${user.user_id}`,
    "actors_ref",
    `${nodes.actors}/${actorId}`,
  );
  createRelationship(
    `${nodes.games}/${gameId}`,
    "actors_ref",
    `${nodes.actors}/${actorId}`,
  );
  createRelationship(
    `${nodes.games}/${gameId}`,
    "player_actor_map",
    `${nodes.actors}/${actorId}`,
  );
  createRelationship(
    `${nodes.actors}/${actorId}`,
    "cards_by_game",
    `${nodes.cards}/${cardId}`,
  );

  return actor;
}

/**
 * Add a user+actor to the game’s players & player_actor_map
 */
export async function joinWithActor(
  gameId: string,
  actorId: string,
): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  try {
    // Fetch the complete game object
    const game = await get<Game>(`${nodes.games}/${gameId}`);
    if (!game) return false;

    // Validate actor exists and isn't already assigned
    const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
    if (!actor) return false;

    // Update game data 
    const updates = {
      players: { ...(game.players || {}), [user.user_id]: true },
      player_actor_map: { ...(game.player_actor_map || {}), [user.user_id]: actorId },
      updated_at: Date.now()
    };

    // Write updates
    await signedPutOrRetry(nodes.games, gameId, updates);

    // Create relationships
    await Promise.all([
      createRelationship(
        `${nodes.games}/${gameId}`,
        "players",
        `${nodes.users}/${user.user_id}`,
      ),
      createRelationship(
        `${nodes.users}/${user.user_id}`,
        "games_ref",
        `${nodes.games}/${gameId}`,
      )
    ]);

    return true;
  } catch (error) {
    console.error('Error joining game:', error);
    return false;
  }
}

// (Optionally keep old joinGame for backward‐compatibility)
export { joinWithActor as joinGame };

// ─────────────────────────────────────────────────────────────────────────────
// Agreement flows
// ─────────────────────────────────────────────────────────────────────────────
export async function createAgreement(
  gameId: string,
  title: string,
  description: string,
  parties: string[],
  terms: Record<string, { obligations: string[]; benefits: string[] }>,
): Promise<AgreementWithPosition | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const agreementId = generateId();
  const now         = Date.now();
  const partiesRecord: Record<string, any> = {};

  for (const actorId of parties) {
    const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
    if (actor && actor.cards_by_game[gameId]) {
      partiesRecord[actorId] = {
        card_ref: actor.cards_by_game[gameId],
        obligation: (terms[actorId]?.obligations || []).join("; "),
        benefit:    (terms[actorId]?.benefits  || []).join("; "),
      };
    }
  }

  const agreement: Agreement = {
    agreement_id: agreementId,
    game_ref:     gameId,
    creator_ref:  user.user_id,
    title,
    summary:      description,
    type:         "asymmetric",
    status:       AgreementStatus.PROPOSED,
    parties:      partiesRecord,
    cards_ref:    Object.fromEntries(
      Object.values(partiesRecord).map((p: any) => [p.card_ref, true])
    ),
    created_at:   now,
    updated_at:   now,
  };

  await signedPutOrRetry(nodes.agreements, agreementId, agreement);

  // Link relationships
  createRelationship(
    `${nodes.agreements}/${agreementId}`,
    "creator_ref",
    `${nodes.users}/${user.user_id}`,
  );
  createRelationship(
    `${nodes.games}/${gameId}`,
    "agreements_ref",
    `${nodes.agreements}/${agreementId}`,
  );
  for (const actorId of parties) {
    createRelationship(
      `${nodes.agreements}/${agreementId}`,
      "parties",
      `${nodes.actors}/${actorId}`,
    );
    createRelationship(
      `${nodes.actors}/${actorId}`,
      "agreements_ref",
      `${nodes.agreements}/${agreementId}`,
    );
  }
  for (const cardId of Object.keys(agreement.cards_ref)) {
    createRelationship(
      `${nodes.agreements}/${agreementId}`,
      "cards_ref",
      `${nodes.cards}/${cardId}`,
    );
  }

  return { ...agreement, position: randomPos() };
}

export async function updateAgreement(
  agreementId: string,
  updateData: Partial<Agreement>,
): Promise<boolean> {
  updateData.updated_at = Date.now();
  await signedPutOrRetry(nodes.agreements, agreementId, updateData as any);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk‐fetch for Game Details page
// ─────────────────────────────────────────────────────────────────────────────
export interface GameContext {
  game: Game;
  actors: ActorWithCard[];
  totalCards: number;
  usedCards: number;
  availableCards: CardWithPosition[];
  availableCardsCount: number;
  agreements: AgreementWithPosition[];
  deckName: string;
}

export async function getGameContext(
  gameId: string,
): Promise<GameContext | null> {
  try {
    // 0️⃣ load game
    const game = await get<Game>(`${nodes.games}/${gameId}`);
    if (!game) {
      console.error(`[GameService] Game ${gameId} not found`);
      return null;
    }

    // 1️⃣ deck ID
    const deckRefs = await getSet(`${nodes.games}/${gameId}`, "deck_ref");
    const deckId   = deckRefs.length ? deckRefs[0].split("/").pop()! : undefined;

    // 2️⃣ deck + cards
    const deck: Deck | null = deckId
      ? await get<Deck>(`${nodes.decks}/${deckId}`)
      : null;
    const deckCardIds = deckId
      ? await getSet(`${nodes.decks}/${deckId}`, "cards_ref")
      : [];
    const totalCards = deckCardIds.length;

    // 3️⃣ actors
    const rawActorRefs = await getSet(
      `${nodes.games}/${gameId}`,
      "actors_ref"
    );
    const actorIds = Array.from(
      new Set(
        rawActorRefs.map((r) => r.includes("/") ? r.split("/").pop()! : r)
      )
    );
    const actors: ActorWithCard[] = [];
    const usedSet = new Set<string>();
    for (const aid of actorIds) {
      const a = await get<Actor>(`${nodes.actors}/${aid}`);
      if (!a) continue;
      const cardsByGame = await get<Record<string,string>>(
        `${nodes.actors}/${aid}/cards_by_game`
      );
      const cid = cardsByGame?.[gameId];
      let card: CardWithPosition | undefined;
      if (cid) {
        usedSet.add(cid);
        const raw = await get<Card>(`${nodes.cards}/${cid}`);
        if (raw) card = { ...raw, position: randomPos() };
      }
      const pos = await get<NodePosition>(
        buildShardedPath(nodes.node_positions, gameId, aid)
      );
      actors.push({...a, card, position: pos ?? randomPos()});
    }

    // 4️⃣ available cards
    const availableCards = (
      await Promise.all(
        deckCardIds
          .filter((id) => !usedSet.has(id))
          .map(async (id) => {
            const raw = await get<Card>(`${nodes.cards}/${id}`);
            return raw ? { ...raw, position: randomPos() } : null;
          })
      )
    ).filter((c): c is CardWithPosition => !!c);
    const availableCardsCount = availableCards.length;

    // 5️⃣ agreements
    const allAgreements = await getCollection<Agreement>(nodes.agreements);
    const agreements: AgreementWithPosition[] = allAgreements
      .filter((ag) => ag.game_ref === gameId)
      .map((ag) => ({ ...ag, position: randomPos() }));

    // 6️⃣ fix players map
    game.players = actors.reduce<Record<string,true>>((acc,a)=>{
      if(a.user_ref) acc[a.user_ref] = true;
      return acc;
    },{});

    // 7️⃣ assemble
    const ctx: GameContext = {
      game,
      actors,
      totalCards,
      usedCards: usedSet.size,
      availableCards,
      availableCardsCount,
      agreements,
      deckName: deck?.name ?? game.deck_type,
    };

    console.log(`[GameService] Context for ${gameId}:`, ctx);
    return ctx;

  } catch (err) {
    console.error(`[GameService] getGameContext error for ${gameId}:`, err);
    return null;
  }
}