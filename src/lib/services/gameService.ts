import {
  getGun,
  nodes,
  getCollection,
  putSigned,
  createRelationship,
  buildShardedPath,
  generateId,
  get,
} from "./gunService";
import { getCurrentUser } from "./authService";
import { currentGameStore } from "../stores/gameStore";
import type {
  Game,
  Actor,
  ActorWithCard,
  Card,
  CardWithPosition,
  Agreement,
  AgreementWithPosition,
  NodePosition,
} from "$lib/types";
import { GameStatus, AgreementStatus } from "$lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: read/write a single record from a collection
// ─────────────────────────────────────────────────────────────────────────────

// Wrapper for putSigned with retry logic
async function signedPutOrRetry<T>(
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
      if (ack.err)
        console.error(`Write to ${collection}/${id} error: ${ack.err}`);
      else console.log(`Write to ${collection}/${id} completed`);
      resolve();
    });
  });

  setTimeout(async () => {
    const savedData = await get<T>(`${collection}/${id}`);
    if (!savedData) {
      console.error(`Data at ${collection}/${id} not saved, retrying`);
      await putSigned(`${collection}/${id}`, data);
    }
  }, 500);
}

// Utility for random position (for D3 visualizations)
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
    game_id: gameId,
    name,
    description: "",
    creator_ref: user.user_id,
    deck_ref: deckType === "eco-village" ? "d1" : "d2",
    deck_type: deckType,
    role_assignment_type: roleAssignmentType,
    status: GameStatus.ACTIVE,
    created_at: Date.now(),
    players: { [user.user_id]: true },
    player_actor_map: { [user.user_id]: null },
    actors_ref: {},
    agreements_ref: {},
    chat_rooms_ref: {},
    max_players: normalizedMax,
  };

  currentGameStore.set(gameData);
  await signedPutOrRetry(nodes.games, gameId, gameData);

  // Link into user & deck
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
  return data ? { ...data, game_id: gameId } : null;
}

export async function getAllGames(): Promise<Game[]> {
  const raw = await getCollection<Game>(nodes.games);
  return raw.map((g) => ({ ...g, game_id: g.game_id }));
}

export function subscribeToGames(callback: (g: Game) => void): () => void {
  const gun = getGun();
  if (!gun) return () => {};
  const sub = gun
    .get(nodes.games)
    .map()
    .on((data: any, key: string) => {
      if (key && key !== "_" && data) {
        callback({ ...data, game_id: key });
      }
    });
  return () => sub.off();
}

export function subscribeToGame(
  gameId: string,
  callback: (g: Game) => void,
): () => void {
  const gun = getGun();
  if (!gun) {
    return () => {};
  }
  const sub = gun
    .get(nodes.games)
    .get(gameId)
    .on((data: any) => {
      if (data) callback({ ...data, game_id: gameId });
    });
  return () => sub.off();
}

export async function updateGame(
  gameId: string,
  updates: Partial<Game>,
): Promise<boolean> {
  updates.updated_at = Date.now();
  await signedPutOrRetry(nodes.games, gameId, updates);
  return true;
}

export async function joinGame(gameId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;
  const game = await getGame(gameId);
  if (!game) return false;
  const players = { ...(game.players || {}), [user.user_id]: true };
  await signedPutOrRetry(nodes.games, gameId, { players });
  return true;
}

export async function leaveGame(gameId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;
  const game = await getGame(gameId);
  if (!game) return false;
  const { [user.user_id]: _, ...players } = game.players || {};
  await signedPutOrRetry(nodes.games, gameId, { players });
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
  const actor: Actor = {
    actor_id: actorId,
    user_ref: user.user_id,
    games_ref: { [gameId]: true },
    cards_by_game: { [gameId]: cardId },
    actor_type: actorType,
    custom_name: customName,
    status: "active",
    agreements_ref: {},
    created_at: Date.now(),
  };

  await signedPutOrRetry(nodes.actors, actorId, actor);
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
  return actor;
}

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
  const now = Date.now();

  const partiesRecord: Record<string, any> = {};
  for (const actorId of parties) {
    const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
    if (actor && actor.cards_by_game[gameId]) {
      partiesRecord[actorId] = {
        card_ref: actor.cards_by_game[gameId],
        obligation: (terms[actorId]?.obligations || []).join("; "),
        benefit: (terms[actorId]?.benefits || []).join("; "),
      };
    }
  }

  const agreement: Agreement = {
    agreement_id: agreementId,
    game_ref: gameId,
    creator_ref: user.user_id,
    title,
    summary: description,
    type: "asymmetric",
    status: AgreementStatus.PROPOSED,
    parties: partiesRecord,
    cards_ref: Object.fromEntries(
      Object.values(partiesRecord).map((p: any) => [p.card_ref, true]),
    ),
    created_at: now,
    updated_at: now,
  };

  await signedPutOrRetry(nodes.agreements, agreementId, agreement);
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

  return { ...agreement, position: randomPos() };
}

export async function updateAgreement(
  agreementId: string,
  updateData: Partial<Agreement>,
): Promise<boolean> {
  updateData.updated_at = Date.now();
  await signedPutOrRetry(nodes.agreements, agreementId, updateData);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk-fetch everything your Game Details page needs (with caching)
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

const _contextCache = new Map<string, Promise<GameContext | null>>();

export async function getGameContext(
  gameId: string,
): Promise<GameContext | null> {
  if (_contextCache.has(gameId)) {
    return _contextCache.get(gameId)!;
  }

  const promise = (async (): Promise<GameContext | null> => {
    try {
      const game = await getGame(gameId);
      if (!game) return null;

      // Compute deckName from game.deck_type
      const deckName =
        (
          {
            "eco-village": "Eco-Village",
            "community-garden": "Community Garden",
            custom: "Custom Deck",
          } as Record<string, string>
        )[game.deck_type] || game.deck_type;

      // 1) Actors and their cards - Fetch explicitly using actors_ref
      const actors: ActorWithCard[] = [];
      const actorRefs = game.actors_ref || {};
      console.log(
        `[GameService] Raw actor refs for game ${gameId}:`,
        actorRefs,
      );

      // Extract actor IDs from both boolean values and nested objects
      const actorIds = Object.keys(actorRefs)
        .filter((key) => {
          if (typeof actorRefs[key] === "boolean" && actorRefs[key])
            return true;
          if (typeof actorRefs[key] === "object" && key.startsWith("actors/"))
            return true;
          return false;
        })
        .map((key) => {
          if (key.startsWith("actors/")) return key.split("/")[1];
          return key;
        });

      console.log(
        `[GameService] Extracted actor IDs for game ${gameId}:`,
        actorIds,
      );

      for (const actorId of actorIds) {
        const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
        if (actor) {
          const pos = await get<NodePosition>(
            buildShardedPath(nodes.node_positions, gameId, actor.actor_id),
          );
          const cardId = actor.cards_by_game?.[gameId];
          let card: CardWithPosition | undefined;
          if (cardId) {
            const rawCard = await get<Card>(`${nodes.cards}/${cardId}`);
            if (rawCard) {
              card = { ...rawCard, position: randomPos() };
            }
          }
          actors.push({ ...actor, card, position: pos || randomPos() });
        }
      }
      console.log(`[GameService] Loaded actors for game ${gameId}:`, actors);

      // 2) Cards
      const deck = await get<any>(`${nodes.decks}/${game.deck_ref}`);
      console.log(
        `[GameService] Raw deck ${game.deck_ref} for game ${gameId}:`,
        deck,
      );

      // Ensure deck.cards_ref is a flat object of card IDs
      const deckCardsRef = deck?.cards_ref || {};
      const cardIds = Object.keys(deckCardsRef).filter(
        (key) => deckCardsRef[key] === true,
      );
      const total = cardIds.length;
      console.log(`[GameService] Deck card IDs for game ${gameId}:`, cardIds);

      const used = actors.filter((a) => a.cards_by_game?.[gameId]).length;
      const usedSet = new Set(
        actors.map((a) => a.cards_by_game?.[gameId]).filter(Boolean),
      );
      const allCards = await getCollection<Card>(nodes.cards);
      console.log(`[GameService] All cards:`, allCards);
      const availableCards = allCards
        .filter((c) => c.decks_ref?.[game.deck_ref] && !usedSet.has(c.card_id))
        .map((c) => ({ ...c, position: randomPos() }));
      const availableCardsCount = availableCards.length;

      // 3) Agreements
      const allAg = await getCollection<Agreement>(nodes.agreements);
      const agreements = allAg
        .filter((ag) => ag.game_ref === gameId)
        .map((ag) => ({ ...ag, position: randomPos() }));

      return {
        game,
        actors,
        totalCards: total,
        usedCards: used,
        availableCards,
        availableCardsCount,
        agreements,
        deckName,
      };
    } catch (err) {
      console.error(
        `[GameService] Error in getGameContext for gameId ${gameId}:`,
        err,
      );
      return null;
    }
  })();

  _contextCache.set(gameId, promise);
  return promise;
}
