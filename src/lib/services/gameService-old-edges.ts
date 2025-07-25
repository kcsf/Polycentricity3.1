import {
  get,
  getCollection,
  getField,
  getMap,
  createRelationship,
  getSet,
  getGun,
  subscribe,
  nodes,
  put,
  putSigned,
  setField,
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
  Deck,
  User,
  ChatRoom,
  ChatMessage,
  Value,
  Capability,
  PartyItem,
} from "$lib/types";
import { GameStatus, AgreementStatus } from "$lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
type SchemaType =
  | User
  | Game
  | Actor
  | Agreement
  | ChatRoom
  | ChatMessage
  | Card
  | Deck
  | Value
  | Capability
  | NodePosition;

function randomPos(): { x: number; y: number } {
  return { x: Math.random() * 800, y: Math.random() * 600 };
}
async function write(path: string, key: string, data: any): Promise<void> {
  const gun = getGun();
  if (!gun) throw new Error("[gameService] Gun not initialized");
  if (data === undefined) {
    console.warn(
      `[gameService] Skipping write for undefined/null data at ${path}/${key}`,
    );
    return;
  }
  await new Promise<void>((resolve) => {
    let done = false;
    gun
      .get(path)
      .get(key)
      .put(data, (ack: any) => {
        if (done) return;
        done = true;
        if (ack?.err) console.error(ack.err);
        resolve();
      });
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 500);
  });
}

async function resolveNames(
  ids: string[],
  nodeRoot: typeof nodes.values,
): Promise<string[]>;
async function resolveNames(
  ids: string[],
  nodeRoot: typeof nodes.capabilities,
): Promise<string[]>;
async function resolveNames(
  ids: string[],
  nodeRoot: string,
): Promise<string[]> {
  return Promise.all(
    ids.map(async (id) => {
      if (nodeRoot === nodes.values) {
        const rec = await get<Value>(`${nodes.values}/${id}`);
        return rec?.name ?? id;
      } else {
        const rec = await get<Capability>(`${nodes.capabilities}/${id}`);
        return rec?.name ?? id;
      }
    }),
  );
}

// Helper to delete a key by putting null (doesn't skip nulls)
async function deleteKey(path: string, key: string): Promise<void> {
  const gun = getGun();
  if (!gun) throw new Error("[gameService] Gun not initialized");
  await new Promise<void>((resolve) => {
    let done = false;
    gun
      .get(path)
      .get(key)
      .put(null, (ack) => {
        if (done) return;
        done = true;
        if (ack?.err) console.error(ack.err);
        resolve();
      });
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 500);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Game flows (fixed)
// ─────────────────────────────────────────────────────────────────────────────

// Update User Role
export async function updateUserRole(userId: string, role: User["role"]) {
  const soul = `${nodes.users}/${userId}`;
  const existing = await get<User>(soul);
  if (!existing) throw new Error("User not found");
  // full-object rewrite:
  await put(soul, { ...existing, role, updated_at: Date.now() });
  // —or— only update the full object:
  // await put(soul, { ...existing, role, updated_at: Date.now() });
  // await setField(soul, "role", role);
  // await setField(soul, "updated_at", Date.now());
}

export async function getAllGames(): Promise<Game[]> {
  const games = await getCollection<Game>(nodes.games);
  const gamesWithResolvedRefs = await Promise.all(
    games.map(async (game) => {
      // Resolve actors_ref (Record<string, boolean>)
      const actorRefs = await getSet(
        `${nodes.games}/${game.game_id}`,
        "actors_ref",
      );
      // Filter out "#" and clean duplicates (e.g., "actors/actor_1" -> "actor_1")
      const cleanedActorRefs = actorRefs
        .filter((id) => id !== "#" && !id.startsWith("#"))
        .map((id) => (id.includes("/") ? id.split("/").pop()! : id));
      const actorsRefMap = Object.fromEntries(
        cleanedActorRefs.map((id) => [id, true]),
      );

      // Resolve creator_ref (string)
      const creatorRefs = await getSet(
        `${nodes.games}/${game.game_id}`,
        "creator_ref",
      );
      const creatorRef = creatorRefs[0]?.split("/").pop() || "";

      // Resolve deck_ref (string)
      const deckRefs = await getSet(
        `${nodes.games}/${game.game_id}`,
        "deck_ref",
      );
      const deckRef = deckRefs[0]?.split("/").pop() || "";

      // Resolve player_actor_map (Record<string, string | null>)
      const playerActorMapRaw =
        (await getField<Record<string, string | null>>(
          `${nodes.games}/${game.game_id}`,
          "player_actor_map",
        )) || {};
      // Remove "#" key and clean invalid entries
      const playerActorMap = Object.fromEntries(
        Object.entries(playerActorMapRaw).filter(
          ([key]) =>
            key !== "#" && !key.startsWith("#") && key !== "actors/null",
        ),
      );

      // Resolve players (Record<string, boolean>)
      const playerRefs = await getSet(
        `${nodes.games}/${game.game_id}`,
        "players",
      );
      // Filter out "#"
      const cleanedPlayerRefs = playerRefs.filter(
        (id) => id !== "#" && !id.startsWith("#"),
      );
      const playersMap = Object.fromEntries(
        cleanedPlayerRefs.map((id) => [id, true]),
      );

      return {
        ...game,
        actors_ref: actorsRefMap,
        creator_ref: creatorRef,
        deck_ref: deckRef,
        player_actor_map: playerActorMap,
        players: playersMap,
      };
    }),
  );
  console.log("[getAllGames] Returned games:", gamesWithResolvedRefs);
  return gamesWithResolvedRefs;
}

export function subscribeToGames(callback: (g: Game) => void): () => void {
  const gun = getGun();
  if (!gun) return () => {};
  const sub = gun
    .get(nodes.games)
    .map()
    .on((raw: any) => {
      if (raw && raw.game_id) callback(raw as Game);
    });
  return () => sub.off();
}

export function subscribeToGame(
  gameId: string,
  callback: (g: Game) => void,
): () => void {
  return subscribe<Game>(`${nodes.games}/${gameId}`, async (data) => {
    if (data) {
      // Resolve players (Record<string, boolean>)
      const playerRefs = await getSet(`${nodes.games}/${gameId}`, "players");
      const cleanedPlayerRefs = playerRefs.filter(
        (id) => id !== "#" && !id.startsWith("#"),
      );
      const playersMap = Object.fromEntries(
        cleanedPlayerRefs.map((id) => [id, true]),
      );
      callback({ ...data, game_id: gameId, players: playersMap });
    }
  });
}

export async function getGame(gameId: string): Promise<Game | null> {
  const data = await get<Game>(`${nodes.games}/${gameId}`);
  return data ? { ...data, game_id: gameId } : null;
}

export async function updateGame(
  gameId: string,
  updates: Partial<Game>,
): Promise<boolean> {
  updates.updated_at = Date.now();
  await write(`${nodes.games}`, gameId, updates);
  return true;
}

export async function createGame(
  name: string,
  deckRef: string, // Changed from deckType to deckRef
  roleAssignmentType: "player-choice" | "random" = "random",
  maxPlayers?: number,
): Promise<Game | null> {
  const user = getCurrentUser();
  if (!user) return null;

  // 📊 1️⃣ Find max existing game number
  const existing = await getCollection<Game>(nodes.games);
  let maxNum = 0;
  for (const g of existing) {
    const m = g.game_id.match(/^g_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const nextNum = maxNum + 1;
  const gameId = `g_${nextNum}`;

  const now = Date.now();
  const normalizedMax = maxPlayers && maxPlayers > 0 ? maxPlayers : undefined;

  // Fetch the deck to get its description or type (optional)
  const deck = await get<Deck>(`${nodes.decks}/${deckRef}`);
  const deckType = deck?.name || deckRef; // Fallback to deckRef if description is unavailable

  // 2️⃣ Write the root game object (omit nested maps)
  const gameRoot: Omit<
    Game,
    | "players"
    | "player_actor_map"
    | "actors_ref"
    | "agreements_ref"
    | "chat_rooms_ref"
  > = {
    game_id: gameId,
    name,
    description: "",
    creator_ref: user.user_id,
    deck_ref: deckRef, // Use the provided deckRef directly
    deck_type: deckType, // Set deck_type based on deck description
    role_assignment_type: roleAssignmentType,
    status: GameStatus.ACTIVE,
    created_at: now,
    updated_at: now,
    max_players: normalizedMax,
  };
  await write(nodes.games, gameId, gameRoot);

  // 3️⃣ Nested maps under games/<gameId>/
  await Promise.all([
    write(`${nodes.games}/${gameId}`, "players", { [user.user_id]: true }),
    write(`${nodes.games}/${gameId}`, "player_actor_map", {}),
    write(`${nodes.games}/${gameId}`, "actors_ref", {}),
    write(`${nodes.games}/${gameId}`, "agreements_ref", {}),
    write(`${nodes.games}/${gameId}`, "chat_rooms_ref", {}),
  ]);

  // 4️⃣ Seed our store
  currentGameStore.set({
    ...gameRoot,
    players: { [user.user_id]: true },
    player_actor_map: {},
    actors_ref: {},
    agreements_ref: {},
    chat_rooms_ref: {},
    max_players: normalizedMax,
  });

  // 5️⃣ Pointer-edges
  await Promise.all([
    createRelationship(
      `${nodes.games}/${gameId}`,
      "creator_ref",
      `${nodes.users}/${user.user_id}`,
    ),
    createRelationship(
      `${nodes.users}/${user.user_id}`,
      "games_ref",
      `${nodes.games}/${gameId}`,
    ),
    createRelationship(
      `${nodes.games}/${gameId}`,
      "deck_ref",
      `${nodes.decks}/${deckRef}`, // Use deckRef directly
    ),
  ]);

  // 6️⃣ Return freshly-read object
  return await getGame(gameId);
}

export async function joinGame(gameId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  const game = await getGame(gameId);
  if (!game) return false;

  // 1️⃣ Update the “players” map with raw user_id
  const playersMap = { ...(game.players || {}), [user.user_id]: true };
  await write(`${nodes.games}/${gameId}`, "players", playersMap);

  // 2️⃣ Create pointer-edge for user-games_ref only
  await createRelationship(
    `${nodes.users}/${user.user_id}`,
    "games_ref",
    `${nodes.games}/${gameId}`,
  );

  return true;
}

export async function leaveGame(gameId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) {
    console.warn("[gameService] No authenticated user");
    return false;
  }
  const game = await getGame(gameId);
  if (!game) {
    console.warn(`[gameService] Game ${gameId} not found`);
    return false;
  }

  try {
    // 1️⃣ Read player_actor_map to see if they joined with an actor
    const pam =
      (await getField<Record<string, string>>(
        `${nodes.games}/${gameId}`,
        "player_actor_map",
      )) || {};
    const actorId = pam[user.user_id];

    // 2️⃣ Remove user pointers (simple & full-path)
    await Promise.all([
      deleteKey(`${nodes.games}/${gameId}/players`, user.user_id),
      deleteKey(
        `${nodes.games}/${gameId}/players`,
        `${nodes.users}/${user.user_id}`,
      ),

      deleteKey(`${nodes.games}/${gameId}/player_actor_map`, user.user_id),

      deleteKey(`${nodes.users}/${user.user_id}/games_ref`, gameId),
      deleteKey(
        `${nodes.users}/${user.user_id}/games_ref`,
        `${nodes.games}/${gameId}`,
      ),
    ]);

    // 3️⃣ If they had an actor in this game, clean up those refs too
    if (actorId) {
      await Promise.all([
        deleteKey(
          `${nodes.games}/${gameId}/player_actor_map`,
          `${nodes.actors}/${actorId}`,
        ),

        deleteKey(`${nodes.games}/${gameId}/actors_ref`, actorId),
        deleteKey(
          `${nodes.games}/${gameId}/actors_ref`,
          `${nodes.actors}/${actorId}`,
        ),

        deleteKey(`${nodes.actors}/${actorId}/games_ref`, gameId),
        deleteKey(
          `${nodes.actors}/${actorId}/games_ref`,
          `${nodes.games}/${gameId}`,
        ),

        deleteKey(`${nodes.actors}/${actorId}/cards_by_game`, gameId),
        deleteKey(
          `${nodes.actors}/${actorId}/cards_by_game`,
          `${nodes.games}/${gameId}`,
        ),
      ]);
    }

    // 4️⃣ Self-test logs (optional)
    const playersAfter = await getField(`${nodes.games}/${gameId}`, "players");
    console.log("🏷 players map now:", playersAfter);
    const pamAfter = await getField(
      `${nodes.games}/${gameId}`,
      "player_actor_map",
    );
    console.log("🏷 player_actor_map now:", pamAfter);
    const myGamesAfter = await getField(
      `${nodes.users}/${user.user_id}`,
      "games_ref",
    );
    console.log("🏷 my games_ref now:", myGamesAfter);
    if (actorId) {
      const actorsRefAfter = await getField(
        `${nodes.games}/${gameId}`,
        "actors_ref",
      );
      console.log("🏷 actors_ref now:", actorsRefAfter);
    }

    console.log(`[gameService] leaveGame finished for ${gameId}`);
    return true;
  } catch (e) {
    console.error(`[gameService] Error in leaveGame:`, e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actor flows
// ────────────────────────────────────────────────���────────────────────────────
export async function createActor(
  gameId: string,
  cardId: string,
  actorType: Actor["actor_type"],
  customName?: string,
): Promise<Actor | null> {
  const user = getCurrentUser();
  if (!user) return null;

  // Validate game and card exist
  const [game, card] = await Promise.all([
    get<Game>(`${nodes.games}/${gameId}`),
    get<Card>(`${nodes.cards}/${cardId}`),
  ]);
  if (!game || !card) return null;

  // Generate sequential actor_<n>
  const existing = await getCollection<Actor>(nodes.actors);
  let max = 0;
  for (const a of existing) {
    const m = a.actor_id.match(/^actor_(\d+)$/);
    if (m) max = Math.max(max, +m[1]);
  }
  const actorId = `actor_${max + 1}`;
  const now = Date.now();

  // Base actor node
  const actorData: Actor = {
    actor_id: actorId,
    user_ref: user.user_id,
    actor_type: actorType,
    custom_name: customName || "",
    status: "active",
    created_at: now,
    updated_at: now,
    games_ref: { [gameId]: true },
    cards_by_game: { [gameId]: cardId },
    agreements_ref: {},
  };
  await write(nodes.actors, actorId, actorData);

  // Nested maps
  await Promise.all([
    write(`${nodes.actors}/${actorId}`, "games_ref", { [gameId]: true }),
    write(`${nodes.actors}/${actorId}`, "cards_by_game", { [gameId]: cardId }),
  ]);

  // Wire pointer-edges
  await Promise.all([
    createRelationship(
      `${nodes.users}/${user.user_id}`,
      "actors_ref",
      `${nodes.actors}/${actorId}`,
    ),
    createRelationship(
      `${nodes.actors}/${actorId}`,
      "games_ref",
      `${nodes.games}/${gameId}`,
    ),
    createRelationship(
      `${nodes.games}/${gameId}`,
      "actors_ref",
      `${nodes.actors}/${actorId}`,
    ),
    createRelationship(
      `${nodes.actors}/${actorId}`,
      "cards_by_game",
      `${nodes.cards}/${cardId}`,
    ),
  ]);

  return actorData;
}

// --- Join game with existing actor ------------------
export async function joinWithActor(
  gameId: string,
  actorId: string,
  cardId?: string,
): Promise<Actor | null> {
  const user = getCurrentUser();
  if (!user) return null;

  // 1️⃣ Load game and actor existence
  const game = await getGame(gameId);
  if (!game) return null;
  const actorRaw = await get<Actor>(`${nodes.actors}/${actorId}`);
  if (!actorRaw) return null;

  // 2️⃣ Join the game (adds user to players)
  const joined = await joinGame(gameId);
  if (!joined) return null;

  // 3️⃣ Update nested maps on game with raw IDs
  const pamMap = { ...(game.player_actor_map || {}), [user.user_id]: actorId };
  const actorsRef = { ...(game.actors_ref || {}), [actorId]: true };

  await Promise.all([
    write(`${nodes.games}/${gameId}`, "player_actor_map", pamMap),
    write(`${nodes.games}/${gameId}`, "actors_ref", actorsRef),
  ]);

  // 4️⃣ Load existing cards_by_game map
  const existingCards =
    (await getField<Record<string, string | null>>(
      `${nodes.actors}/${actorId}`,
      "cards_by_game",
    )) || {};

  // 5️⃣ Update cards_by_game with cardId or null
  const cardsByGame = { ...existingCards, [gameId]: cardId || null };
  await write(`${nodes.actors}/${actorId}`, "cards_by_game", cardsByGame);

  // 6️⃣ Wire pointer-edges (only for cardId if provided)
  await Promise.all([
    createRelationship(
      `${nodes.games}/${gameId}`,
      "actors_ref",
      `${nodes.actors}/${actorId}`,
    ),
    createRelationship(
      `${nodes.actors}/${actorId}`,
      "games_ref",
      `${nodes.games}/${gameId}`,
    ),
    ...(cardId
      ? [
          createRelationship(
            `${nodes.actors}/${actorId}`,
            "cards_by_game",
            `${nodes.cards}/${cardId}`,
          ),
        ]
      : []),
  ]);

  // 7️⃣ Return updated actor
  return {
    ...actorRaw,
    cards_by_game: cardsByGame,
    games_ref: { ...(actorRaw.games_ref || {}), [gameId]: true },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agreement flows (updated)
// ─────────────────────────────────────────────────────────────────────────────

export async function createAgreement(
  gameId: string,
  title: string,
  description: string,
  parties: string[],
  terms: Record<
    string,
    {
      obligations: string[];
      benefits: string[];
    }
  >,
): Promise<AgreementWithPosition | null> {
  const user = getCurrentUser();
  if (!user) return null;

  // 1️⃣ Next ag_<n>
  const existing = await getCollection<Agreement>(nodes.agreements);
  let max = 0;
  for (const ag of existing) {
    const m = ag.agreement_id.match(/^ag_(\d+)$/);
    if (m) max = Math.max(max, +m[1]);
  }
  const agreementId = `ag_${max + 1}`;
  const now = Date.now();

  // 2️⃣ Build minimal partiesRecord
  const partiesRecord: Record<
    string,
    {
      card_ref: string;
      obligation: string;
      benefit: string;
    }
  > = {};
  for (const aid of parties) {
    const map = await getField<Record<string, string>>(
      `${nodes.actors}/${aid}`,
      "cards_by_game",
    );
    const cardRef = map?.[gameId];
    if (!cardRef) continue;
    partiesRecord[aid] = {
      card_ref: cardRef,
      obligation: terms[aid]?.obligations.join("; ") ?? "",
      benefit: terms[aid]?.benefits.join("; ") ?? "",
    };
  }

  // 3️⃣ Minimal cards_ref & votes
  const cards_ref = Object.fromEntries(
    Object.values(partiesRecord).map((p) => [p.card_ref, true]),
  );
  const votes = Object.fromEntries(
    Object.keys(partiesRecord).map((aid) => [aid, "pending"] as const),
  );

  // 4️⃣ Shallow root write
  const root: Omit<Agreement, "parties" | "cards_ref" | "votes"> = {
    agreement_id: agreementId,
    game_ref: gameId,
    creator_ref: user.user_id,
    title,
    summary: description,
    type: "asymmetric",
    status: AgreementStatus.PROPOSED,
    created_at: now,
    updated_at: now,
  };
  await write(nodes.agreements, agreementId, root);

  // 5️⃣ Seed ONLY these minimal maps
  await Promise.all([
    write(`${nodes.agreements}/${agreementId}`, "cards_ref", cards_ref),
    write(`${nodes.agreements}/${agreementId}`, "parties", partiesRecord),
    write(`${nodes.agreements}/${agreementId}`, "votes", votes),
  ]);

  // 6️⃣ Wire up your edges
  await Promise.all([
    createRelationship(
      `${nodes.games}/${gameId}`,
      "agreements_ref",
      `${nodes.agreements}/${agreementId}`,
    ),
    createRelationship(
      `${nodes.users}/${user.user_id}`,
      "agreements_ref",
      `${nodes.agreements}/${agreementId}`,
    ),
    // actors → agreement
    ...Object.keys(partiesRecord).map((aid) =>
      createRelationship(
        `${nodes.actors}/${aid}`,
        "agreements_ref",
        `${nodes.agreements}/${agreementId}`,
      ),
    ),
    // cards → agreement
    ...Object.values(partiesRecord).map((p) =>
      createRelationship(
        `${nodes.cards}/${p.card_ref}`,
        "agreements_ref",
        `${nodes.agreements}/${agreementId}`,
      ),
    ),
  ]);

  // 7️⃣ Return for UI
  return {
    ...root,
    parties: partiesRecord,
    cards_ref,
    votes,
    position: randomPos(),
  };
}

export async function updateAgreement(
  agreementId: string,
  updateData: Partial<Agreement>,
): Promise<boolean> {
  updateData.updated_at = Date.now();
  // write partial fields directly under the agreement node
  await Promise.all(
    Object.entries(updateData).map(([k, v]) =>
      write(`${nodes.agreements}/${agreementId}`, k, v),
    ),
  );
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deck flows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new deck with a sequential ID (d_1, d_2, …)
 */
export async function createDeck(
  name: string,
  description: string,
  isPublic: boolean = false,
): Promise<Deck | null> {
  const user = getCurrentUser();
  if (!user) return null;

  // 1️⃣ find highest existing d_<num>
  const existing = await getCollection<Deck>(nodes.decks);
  let maxNum = 0;
  for (const d of existing) {
    const m = d.deck_id.match(/^d_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }

  // 2️⃣ pick next
  const deckId = `d_${maxNum + 1}`;
  const now = Date.now();

  // 3️⃣ write root deck
  await write(nodes.decks, deckId, {
    deck_id: deckId,
    name,
    description,
    creator_ref: user.user_id,
    is_public: isPublic,
    created_at: now,
    updated_at: now,
  });

  // 4️⃣ init empty cards_ref map
  await write(`${nodes.decks}/${deckId}`, "cards_ref", {});

  return {
    deck_id: deckId,
    name,
    description,
    creator_ref: user.user_id,
    is_public: isPublic,
    cards_ref: {},
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update any top‐level Deck fields (name, description, is_public, updated_at, etc.)
 */
export async function updateDeck(
  deckId: string,
  updates: Partial<Deck>,
): Promise<boolean> {
  updates.updated_at = Date.now();
  // write each field under decks/<deckId>/
  await Promise.all(
    Object.entries(updates).map(([k, v]) =>
      write(`${nodes.decks}/${deckId}`, k, v),
    ),
  );
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card flows
// ────────────────────────────────────────────────────────────────so�────────────

/**
 * Create a new Card with a sequential ID (card_1, card_2, …) and attach it to a deck.
 * Nested maps (values_ref, capabilities_ref, agreements_ref) all start empty.
 */
export async function createCard(
  deckId: string,
  data: {
    card_number: number;
    role_title: string;
    backstory: string;
    goals: string;
    obligations: string;
    intellectual_property: string;
    resources: string;
    card_category: string;
    type: string;
    icon: string;
  },
): Promise<Card | null> {
  const user = getCurrentUser();
  if (!user) return null;

  // 1️⃣ find highest existing card_<num>
  const existing = await getCollection<Card>(nodes.cards);
  let maxNum = 0;
  for (const c of existing) {
    const m = c.card_id.match(/^card_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }

  // 2️⃣ assign new id
  const cardId = `card_${maxNum + 1}`;
  const now = Date.now();

  // 3️⃣ write root card node
  await write(nodes.cards, cardId, {
    card_id: cardId,
    card_number: data.card_number,
    role_title: data.role_title,
    backstory: data.backstory,
    goals: data.goals,
    obligations: data.obligations,
    intellectual_property: data.intellectual_property,
    resources: data.resources,
    card_category: data.card_category,
    type: data.type,
    icon: data.icon,
    creator_ref: user.user_id,
    created_at: now,
    updated_at: now,
  });

  // 4️⃣ nested refs under cards/<cardId>/
  await Promise.all([
    write(`${nodes.cards}/${cardId}`, "values_ref", {}),
    write(`${nodes.cards}/${cardId}`, "capabilities_ref", {}),
    write(`${nodes.cards}/${cardId}`, "agreements_ref", {}),
    write(`${nodes.cards}/${cardId}`, "decks_ref", { [deckId]: true }),
  ]);

  // 5️⃣ pointer‐edges deck<→>card
  await Promise.all([
    createRelationship(
      `${nodes.decks}/${deckId}`,
      "cards_ref",
      `${nodes.cards}/${cardId}`,
    ),
    createRelationship(
      `${nodes.cards}/${cardId}`,
      "decks_ref",
      `${nodes.decks}/${deckId}`,
    ),
  ]);

  // 6️⃣ return full Card
  return {
    card_id: cardId,
    card_number: data.card_number,
    role_title: data.role_title,
    backstory: data.backstory,
    goals: data.goals,
    obligations: data.obligations,
    intellectual_property: data.intellectual_property,
    resources: data.resources,
    card_category: data.card_category,
    type: data.type,
    icon: data.icon,
    creator_ref: user.user_id,
    values_ref: {},
    capabilities_ref: {},
    agreements_ref: {},
    decks_ref: { [deckId]: true },
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update any top‐level Card fields (role_title, backstory, etc.) or nested maps.
 * Pass in partials; any field you include will be written under cards/<cardId>/.
 */
export async function updateCard(
  cardId: string,
  updates: Partial<Card>,
): Promise<boolean> {
  updates.updated_at = Date.now();
  // write each field (nested or root) under cards/<cardId>/
  await Promise.all(
    Object.entries(updates).map(([k, v]) =>
      write(`${nodes.cards}/${cardId}`, k, v),
    ),
  );
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk-fetch for Game Details page
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
    // 1️⃣ Load the base game
    const game = await get<Game>(`${nodes.games}/${gameId}`);
    if (!game) return null;

    // Resolve players (Record<string, boolean>)
    const playerRefs = await getSet(`${nodes.games}/${gameId}`, "players");
    const cleanedPlayerRefs = playerRefs.filter(
      (id) => id !== "#" && !id.startsWith("#"),
    );
    const playersMap = Object.fromEntries(
      cleanedPlayerRefs.map((id) => [id, true]),
    );

    // Update game with resolved players
    const gameWithPlayers = { ...game, players: playersMap };

    // 2️⃣ Find its deck and card IDs in parallel
    const deckRefs = await getSet(`${nodes.games}/${gameId}`, "deck_ref");
    const deckId = deckRefs[0]?.split("/").pop();
    const [deck, deckCardIds] = await Promise.all([
      deckId ? get<Deck>(`${nodes.decks}/${deckId}`) : Promise.resolve(null),
      deckId
        ? getSet(`${nodes.decks}/${deckId}`, "cards_ref")
        : Promise.resolve([]),
    ]);
    const totalCards = deckCardIds.length;

    // 3️⃣ Gather all actor IDs in this game
    const rawActorRefs = await getSet(`${nodes.games}/${gameId}`, "actors_ref");
    const actorIds = Array.from(
      new Set(
        rawActorRefs.map((r) => (r.includes("/") ? r.split("/").pop()! : r)),
      ),
    );

// 4️⃣ Batch-fetch each actor + their cards_by_game map + assigned card + resolve names (in parallel)
const usedSet = new Set<string>();
const actorResults = await Promise.all(
  actorIds.map(async (aid) => {
    const [a, cardsByGame] = await Promise.all([
      get<Actor>(`${nodes.actors}/${aid}`),
      getMap(`${nodes.actors}/${aid}`, "cards_by_game"),
    ]);
    if (!a) return null;

    console.log(`[getGameContext] Actor ${aid} cards_by_game:`, cardsByGame);

    const cardId = cardsByGame[gameId];
    let card: CardWithPosition | undefined;

    if (cardId) {
      usedSet.add(cardId);
      const raw = await get<Card>(`${nodes.cards}/${cardId}`);
      if (raw) {
        const [valueRefs, capRefs] = await Promise.all([
          getSet(`${nodes.cards}/${cardId}`, "values_ref"),
          getSet(`${nodes.cards}/${cardId}`, "capabilities_ref"),
        ]);
        const valueIds = valueRefs
          .map((p) => p.split("/").pop()!)
          .filter((id) => !id.startsWith("#") && !id.startsWith("_"));
        const capIds = capRefs
          .map((p) => p.split("/").pop()!)
          .filter((id) => !id.startsWith("#") && !id.startsWith("_"));

        const [valueNames, capabilityNames] = await Promise.all([
          resolveNames(valueIds, nodes.values),
          resolveNames(capIds, nodes.capabilities),
        ]);

        card = {
          ...raw,
          position: randomPos(),
          _valueNames: valueNames,
          _capabilityNames: capabilityNames,
        };
      } else {
        console.warn(`[getGameContext] Card ${cardId} not found for actor ${aid}`);
      }
    } else {
      console.warn(`[getGameContext] No cardId for actor ${aid} in game ${gameId}`);
    }

    return {
      ...a,
      cards_by_game: cardsByGame,
      card,
      position: randomPos(),
    } as ActorWithCard;
  }),
);
const actors = actorResults.filter((a) => a != null) as ActorWithCard[];

// Log usedSet for debugging
console.log(`[getGameContext] Used cards:`, Array.from(usedSet));

    // 5️⃣ Batch-fetch the remaining deck cards + resolve names
    const rawAvail = await Promise.all(
      deckCardIds
        .filter((id) => !usedSet.has(id))
        .map(async (id) => {
          const raw = await get<Card>(`${nodes.cards}/${id}`);
          if (!raw) return null;

          const valueRefs = await getSet(`${nodes.cards}/${id}`, "values_ref");
          const capRefs = await getSet(
            `${nodes.cards}/${id}`,
            "capabilities_ref",
          );
          const valueIds = valueRefs
            .map((p) => p.split("/").pop()!)
            .filter((i) => !i.startsWith("#") && !i.startsWith("_"));
          const capIds = capRefs
            .map((p) => p.split("/").pop()!)
            .filter((i) => !i.startsWith("#") && !i.startsWith("_"));

          const [valueNames, capabilityNames] = await Promise.all([
            resolveNames(valueIds, nodes.values),
            resolveNames(capIds, nodes.capabilities),
          ]);

          return {
            ...raw,
            position: randomPos(),
            _valueNames: valueNames,
            _capabilityNames: capabilityNames,
          };
        }),
    );
    const availableCards = rawAvail.filter(
      (c) => c != null,
    ) as CardWithPosition[];

    // 6️⃣ Fetch and fully resolve all agreements for this game
    const rawAgs = await getCollection<Agreement>(nodes.agreements);
    const agreements: AgreementWithPosition[] = await Promise.all(
      rawAgs
        .filter((ag) => ag.game_ref === gameId)
        .map(async (ag) => {
          const partiesRef =
            (await getField<Record<string, { "#": string }>>(
              `${nodes.agreements}/${ag.agreement_id}`,
              "parties",
            )) ?? {};

          const partyItems: PartyItem[] = await Promise.all(
            Object.keys(partiesRef).map(async (actorId) => {
              const pd = (await getField<{
                card_ref: string;
                obligation: string;
                benefit: string;
              }>(
                `${nodes.agreements}/${ag.agreement_id}/parties`,
                actorId,
              )) ?? {
                card_ref: "",
                obligation: "",
                benefit: "",
              };

              const actor = actors.find((a) => a.actor_id === actorId);
              if (!actor?.card) {
                console.warn(
                  `Agreement ${ag.agreement_id} actor ${actorId} has no card`,
                );
                return null;
              }

              return {
                actorId,
                card: actor.card,
                obligation: pd.obligation,
                benefit: pd.benefit,
              } as PartyItem;
            }),
          ).then((arr) => arr.filter((x): x is PartyItem => Boolean(x)));

          return {
            ...ag,
            partyItems,
            position: randomPos(),
          };
        }),
    );

    return {
      game: gameWithPlayers,
      actors,
      totalCards,
      usedCards: usedSet.size,
      availableCards,
      availableCardsCount: availableCards.length,
      agreements,
      deckName: deck?.name ?? game.deck_type,
    };
  } catch (e) {
    console.error(`[gameService] getGameContext error for ${gameId}:`, e);
    return null;
  }
}
