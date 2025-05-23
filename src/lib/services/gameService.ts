import {
  get,
  getCollection,
  getField,
  getMap,
  createRelationship,
  getSet,
  getRefMap,
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
  GameContext,
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

function notNull<T>(x: T | null | undefined): x is T {
  return x != null;
}

// ─────────────────────────────────────────────────────────────────────────────
// caches for value & capability names (lazy init)
// ─────────────────────────────────────────────────────────────────────────────
let _valueNameMap: Map<string, string> | null = null;
let _capNameMap: Map<string, string> | null = null;

async function initNameCaches() {
  if (_valueNameMap && _capNameMap) return;
  const valuesRaw = (await getCollection(nodes.values)) as Value[];
  const capsRaw = (await getCollection(nodes.capabilities)) as Capability[];
  _valueNameMap = new Map(valuesRaw.map((v) => [v.value_id, v.name]));
  _capNameMap = new Map(capsRaw.map((c) => [c.capability_id, c.name]));
}

async function resolveNamesCached(
  ids: string[],
  nodeRoot: typeof nodes.values | typeof nodes.capabilities,
): Promise<string[]> {
  await initNameCaches();
  const map = nodeRoot === nodes.values ? _valueNameMap! : _capNameMap!;
  return ids.map((id) => map.get(id) ?? id);
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
      .put(null, (ack: any) => {
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

/**
 * Read a boolean map at path/key, falling back to pointer‐edges if empty.
 */
async function readMapOrSet(
  path: string,
  key: string,
): Promise<Record<string, boolean>> {
  // 1️⃣ Try the plain boolean map
  const m = (await getField<Record<string, boolean>>(path, key)) || {};
  const clean = Object.fromEntries(
    Object.entries(m).filter(([k, v]) => k !== "_" && k !== "#" && Boolean(v)),
  );
  if (Object.keys(clean).length > 0) {
    return clean;
  }
  // 2️⃣ Fallback: maybe you wrote edges via .set()
  const ids = await getSet(path, key);
  const cleaned = ids
    .filter((id) => id !== "#" && !id.startsWith("#"))
    .map((id) => (id.includes("/") ? id.split("/").pop()! : id));
  return Object.fromEntries(cleaned.map((id) => [id, true]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listen for any new or changed Game under the `games` node.
 * Calls `callback` with the raw Game object whenever anything changes.
 */
export function subscribeToGames(callback: (g: Game) => void): () => void {
  // subscribe<T> takes (path, (data) => void) and returns an unsubscribe fn
  return subscribe<Game>(nodes.games, (raw) => {
    if (raw && raw.game_id) {
      callback(raw);
    }
  });
}

/**
 * Listen for changes to a single Game by ID.
 * When the root Game changes, re‐resolve its `players` map and emit
 * an enriched Game object to `callback`.
 */
export function subscribeToGame(
  gameId: string,
  onGame: (g: Game) => void
): () => void {
  const gun = getGun();
  if (!gun) return () => {};

  // Point at games/<gameId>/game
  const gameNode = gun.get(`${nodes.games}/${gameId}`).get("game");

  // Handler casts partial data into Game
  const handler = (raw: Partial<Game> | undefined) => {
    if (!raw) return;
    // raw may be missing fields—fill in game_id explicitly
    onGame({ ...raw as Game, game_id: gameId });
  };

  // Subscribe
  gameNode.on(handler);

  // Unsubscribe by off(handler)
  return () => {
    gameNode.off(handler);
  };
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
      const actors_ref = await getRefMap(
        `${nodes.games}/${game.game_id}`,
        "actors_ref",
      );
      // Resolve player_actor_map (Record<string, string | null>)
      const player_actor_map_raw =
        (await getField<Record<string, string | null>>(
          `${nodes.games}/${game.game_id}`,
          "player_actor_map",
        )) || {};
      const player_actor_map = Object.fromEntries(
        Object.entries(player_actor_map_raw).filter(
          ([k]) => k !== "#" && !k.startsWith("#") && k !== "actors/null",
        ),
      );
      // Resolve players (Record<string, boolean>)
      const players = await readMapOrSet(
        `${nodes.games}/${game.game_id}`,
        "players",
      );

      return {
        ...game,
        actors_ref,
        player_actor_map,
        players,
      };
    }),
  );

  console.log("[getAllGames] Returned games:", gamesWithResolvedRefs);
  return gamesWithResolvedRefs;
}

export async function getGame(gameId: string): Promise<Game | null> {
  // 1️⃣ load the raw Game object
  const data = await get<Game>(`${nodes.games}/${gameId}`);
  if (!data) return null;

  // 2️⃣ in parallel resolve all of the maps and refs
  const [
    rawPlayers,
    actors_ref,
    creator_ref_map,
    deck_ref_map,
    player_actor_map_raw,
  ] = await Promise.all([
    getSet(`${nodes.games}/${gameId}`, "players"),
    getRefMap(`${nodes.games}/${gameId}`, "actors_ref"),
    getRefMap(`${nodes.games}/${gameId}`, "creator_ref"),
    getRefMap(`${nodes.games}/${gameId}`, "deck_ref"),
    getField<Record<string, string | null>>(
      `${nodes.games}/${gameId}`,
      "player_actor_map",
    ),
  ]);

  // 3️⃣ build the simple boolean‐map of players
  const players = await readMapOrSet(`${nodes.games}/${gameId}`, "players");

  // 4️⃣ pick the single creator and deck out of their ref‐maps
  const creator_ref = Object.keys(creator_ref_map)[0] || "";
  const deck_ref = Object.keys(deck_ref_map)[0] || "";

  // 5️⃣ clean up the incoming raw player→actor map
  const player_actor_map = Object.fromEntries(
    Object.entries(player_actor_map_raw || {}).filter(
      ([k]) => k !== "#" && !k.startsWith("#") && k !== "actors/null",
    ),
  );

  // 6️⃣ return the enriched Game
  return {
    ...data,
    game_id: gameId,
    players,
    actors_ref,
    creator_ref,
    deck_ref,
    player_actor_map,
  };
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

  // 1️⃣ Generate a new sequential game_id
  const existing = await getCollection<Game>(nodes.games);
  let maxNum = 0;
  for (const g of existing) {
    const m = g.game_id.match(/^g_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const gameId = `g_${maxNum + 1}`;
  const now = Date.now();
  const normalizedMax = maxPlayers && maxPlayers > 0 ? maxPlayers : undefined;

  // 2️⃣ Fetch deck name for display
  const deckRec = await get<Deck>(`${nodes.decks}/${deckRef}`);
  const deckType = deckRec?.name ?? deckRef;

  // 3️⃣ Write the root game object (strings + primitives only)
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
    deck_ref: deckRef,
    deck_type: deckType,
    role_assignment_type: roleAssignmentType,
    status: GameStatus.ACTIVE,
    created_at: now,
    updated_at: now,
    max_players: normalizedMax,
  };
  await write(nodes.games, gameId, gameRoot);

  // 4️⃣ Initialize all the nested boolean‐maps
  await Promise.all([
    write(`${nodes.games}/${gameId}`, "players", { [user.user_id]: true }),
    write(`${nodes.games}/${gameId}`, "player_actor_map", {}),
    write(`${nodes.games}/${gameId}`, "actors_ref", {}),
    // write(`${nodes.games}/${gameId}`, "agreements_ref", {}),
    write(`${nodes.games}/${gameId}`, "chat_rooms_ref", {}),
  ]);

  // 5️⃣ Seed the local store
  currentGameStore.set({
    ...gameRoot,
    players: { [user.user_id]: true },
    player_actor_map: {},
    actors_ref: {},
    agreements_ref: {},
    chat_rooms_ref: {},
    max_players: normalizedMax,
  });

  // 6️⃣ Create the new meta‐edges under a single `ref_set`
  //     (we keep the string fields `creator_ref` and `deck_ref` too)
  await createRelationship(
    `${nodes.games}/${gameId}`,
    "ref_set",
    `${nodes.users}/${user.user_id}`,
    { role: "creator" },
  );
  await createRelationship(
    `${nodes.games}/${gameId}`,
    "ref_set",
    `${nodes.decks}/${deckRef}`,
    { role: "deck" },
  );

  // 7️⃣ Return the freshly‐written & resolved Game
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

  // 2️⃣ Create pointer-edge for user-games_ref only ((Don't do this it conflicts with maps, create new key for each, ie. ref_set))
  // await createRelationship(
  //   `${nodes.users}/${user.user_id}`,
  //   "games_ref",
  //   `${nodes.games}/${gameId}`,
  // );

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

// ───────────────────────────────────────────────────_��─────────────────────────
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
    // guard against undefined actor_id; fallback to Gun’s raw key (`a.id`)
    const idStr =
      typeof a.actor_id === "string"
        ? a.actor_id
        : // @ts-ignore
          a.id;
    if (!idStr) continue;
    const m = idStr.match(/^actor_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
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

  // *Removed: Wire pointer-edges

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

  // 6️⃣ *Removed Wire pointer-edges

  // 7️⃣ Return updated actor
  return {
    ...actorRaw,
    cards_by_game: cardsByGame,
    games_ref: { ...(actorRaw.games_ref || {}), [gameId]: true },
  };
}

/**
 * Remove an actor and all its relationships.
 */
export async function deleteActor(actorId: string): Promise<boolean> {
  console.log(`[gameService] ▶ deleteActor(${actorId})`);

  // 1️⃣ Load the root actor
  const act = await get<Actor>(`${nodes.actors}/${actorId}`);
  if (!act) {
    console.warn(`[gameService] Actor not found: ${actorId}`);
    return false;
  }

  // 2️⃣ Load nested maps
  const gamesMap =
    (await getField<Record<string, boolean>>(
      `${nodes.actors}/${actorId}`,
      "games_ref",
    )) || {};
  const cardsMap =
    (await getField<Record<string, string | null>>(
      `${nodes.actors}/${actorId}`,
      "cards_by_game",
    )) || {};
  const userId = act.user_ref || "";

  console.log("[gameService] fetched actor:", act);
  console.log("[gameService] loaded gamesMap:", gamesMap);
  console.log("[gameService] loaded cardsMap:", cardsMap);

  // 3️⃣ Remove nested‐map entries and any set‐edges
  console.log("[gameService] unsetting edges...");
  await Promise.all([
    // For each game this actor sat in:
    ...Object.keys(gamesMap).flatMap((gameId) => [
      // remove from game.players→actors_ref
      deleteKey(`${nodes.games}/${gameId}/actors_ref`, actorId),
      deleteKey(
        `${nodes.games}/${gameId}/actors_ref`,
        `${nodes.actors}/${actorId}`,
      ),
      // remove from game.player_actor_map
      deleteKey(`${nodes.games}/${gameId}/player_actor_map`, userId),
      deleteKey(
        `${nodes.games}/${gameId}/player_actor_map`,
        `${nodes.actors}/${actorId}`,
      ),
      // cleanup any set‐based edges (if you ever wired them)
      removeEdges(`${nodes.games}/${gameId}`, "actors_ref"),
      removeEdges(`${nodes.games}/${gameId}`, "player_actor_map"),
    ]),
    // cleanup from the actor node itself
    removeEdges(`${nodes.actors}/${actorId}`, "agreements_ref"),
    // cleanup from the user node (if you ever wired a set‐edge)
    removeEdges(`${nodes.users}/${userId}`, "actors_ref"),
  ]);

  console.log("[gameService] all edges removed, deleting node");

  // 4️⃣ Delete the actor node and its nested maps
  await write(nodes.actors, actorId, null);
  await Promise.all([
    write(`${nodes.actors}/${actorId}`, "games_ref", null),
    write(`${nodes.actors}/${actorId}`, "cards_by_game", null),
    write(`${nodes.actors}/${actorId}`, "agreements_ref", null),
  ]);

  console.log(`[gameService] ✅ deleteActor complete for ${actorId}`);
  return true;
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
  const existingRaw = await getCollection<Agreement>(nodes.agreements);
  // filter out any entries without a string agreement_id
  const existing = existingRaw.filter(
    (a) => typeof a.agreement_id === "string",
  );
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

  // 6️⃣ Wire up your edges  ((Don't do this it conflicts with maps, create new key for each, ie. ref_set))
  await Promise.all([
    createRelationship(
      `${nodes.games}/${gameId}`,
      "agreements_ref",
      `${nodes.agreements}/${agreementId}`,
    ),
    // createRelationship(
    //   `${nodes.users}/${user.user_id}`,
    //   "agreements_ref",
    //   `${nodes.agreements}/${agreementId}`,
    // ),
    // // actors → agreement
    // ...Object.keys(partiesRecord).map((aid) =>
    //   createRelationship(
    //     `${nodes.actors}/${aid}`,
    //     "agreements_ref",
    //     `${nodes.agreements}/${agreementId}`,
    //   ),
    // ),
    // // cards → agreement
    // ...Object.values(partiesRecord).map((p) =>
    //   createRelationship(
    //     `${nodes.cards}/${p.card_ref}`,
    //     "agreements_ref",
    //     `${nodes.agreements}/${agreementId}`,
    //   ),
    // ),
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

// helper: remove every set-edge under `fromSoul/field`
async function removeEdges(fromSoul: string, field: string) {
  const g = getGun();
  if (!g) throw new Error("[gameService] Gun not initialized");
  await new Promise<void>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 1000);

    g.get(fromSoul)
      .get(field)
      .map()
      .once((edgeValue: any) => {
        if (done) return;
        g.get(fromSoul)
          .get(field)
          .unset(edgeValue, () => {
            if (!done) {
              clearTimeout(timer);
              done = true;
              resolve();
            }
          });
      });
  });
}

/**
 * Remove an agreement and all its relationships.
 */
export async function deleteAgreement(agreementId: string): Promise<boolean> {
  console.log(`[gameService] ▶ deleteAgreement(${agreementId})`);

  // 1️⃣ Load the root agreement
  const agr = await get<Agreement>(`${nodes.agreements}/${agreementId}`);
  if (!agr) {
    console.warn(`[gameService] Agreement not found: ${agreementId}`);
    return false;
  }

  // 2️⃣ Load nested maps
  const partiesRecord =
    (await getField<Record<string, { card_ref: string }>>(
      `${nodes.agreements}/${agreementId}`,
      "parties",
    )) || {};
  const gameId =
    agr.game_ref ||
    (await getField<string>(
      `${nodes.agreements}/${agreementId}`,
      "game_ref",
    )) ||
    "";
  const creatorId =
    agr.creator_ref ||
    (await getField<string>(
      `${nodes.agreements}/${agreementId}`,
      "creator_ref",
    )) ||
    "";

  console.log("[gameService] fetched agreement:", agr);
  console.log("[gameService] loaded partiesRecord:", partiesRecord);

  // 3️⃣ Remove edges
  console.log("[gameService] unsetting edges...");
  await Promise.all([
    removeEdges(`${nodes.games}/${gameId}`, "agreements_ref"),
    removeEdges(`${nodes.users}/${creatorId}`, "agreements_ref"),
    ...Object.keys(partiesRecord).map((actorId) =>
      removeEdges(`${nodes.actors}/${actorId}`, "agreements_ref"),
    ),
    ...Object.values(partiesRecord).map(({ card_ref }) =>
      removeEdges(`${nodes.cards}/${card_ref}`, "agreements_ref"),
    ),
  ]);

  console.log("[gameService] all edges removed, deleting node");

  // 4️⃣ Delete the node and its nested maps
  await write(nodes.agreements, agreementId, null);
  await Promise.all([
    write(`${nodes.agreements}/${agreementId}`, "parties", null),
    write(`${nodes.agreements}/${agreementId}`, "cards_ref", null),
    write(`${nodes.agreements}/${agreementId}`, "votes", null),
    write(`${nodes.agreements}/${agreementId}`, "game_ref", null),
    write(`${nodes.agreements}/${agreementId}`, "creator_ref", null),
  ]);

  console.log(`[gameService] ✅ deleteAgreement complete for ${agreementId}`);

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

  // 5️⃣ pointer‐edges deck<→>card ((Don't do this it conflicts with maps, create new key for each, ie. ref_set))
  // await Promise.all([
  //   createRelationship(
  //     `${nodes.decks}/${deckId}`,
  //     "cards_ref",
  //     `${nodes.cards}/${cardId}`,
  //   ),
  //   createRelationship(
  //     `${nodes.cards}/${cardId}`,
  //     "decks_ref",
  //     `${nodes.decks}/${deckId}`,
  //   ),
  // ]);

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
export async function getGameContext(
  gameId: string,
): Promise<GameContext | null> {
  try {
    // 0️⃣ init caches once
    await initNameCaches();

    // 1️⃣ raw game
    const rawGame = await get<Game>(`${nodes.games}/${gameId}`);
    if (!rawGame) return null;

    // 2️⃣ parallel fetch of boolean‐maps & nested refs
    const [
      playersMap,
      actorRefMap,
      agreementRefMap,
      playerActorRaw,
      deckCardMap,
    ] = await Promise.all([
      readMapOrSet(`${nodes.games}/${gameId}`, "players"),
      getRefMap(`${nodes.games}/${gameId}`, "actors_ref"),
      getRefMap(`${nodes.games}/${gameId}`, "agreements_ref"),
      getField<Record<string, string>>(
        `${nodes.games}/${gameId}`,
        "player_actor_map",
      ),
      getRefMap(`${nodes.decks}/${rawGame.deck_ref}`, "cards_ref"),
    ]);

    // clean player→actor map
    const playerActorMap = Object.fromEntries(
      Object.entries(playerActorRaw || {}).filter(
        ([k]) => k !== "#" && !k.startsWith("#"),
      ),
    );

    // enriched game object
    const gameWithPlayers: Game = {
      ...rawGame,
      game_id: gameId,
      players: playersMap,
      actors_ref: actorRefMap,
      player_actor_map: playerActorMap,
    };

    // 3️⃣ deck info
    const deckId = rawGame.deck_ref;
    const totalCards = Object.keys(deckCardMap).length;

    // 4️⃣ fetch only this deck’s cards
    const deckCardIds = Object.keys(deckCardMap);
    const deckCards = (
      await Promise.all(
        deckCardIds.map((cardId) => get<Card>(`${nodes.cards}/${cardId}`)),
      )
    ).filter((c): c is Card => Boolean(c));

    // 5️⃣ resolve each actor + their assigned card
    const usedSet = new Set<string>();
    const actors: ActorWithCard[] = [];

    await Promise.all(
      Object.keys(actorRefMap).map(async (aid) => {
        const [actor, cardsByGame] = await Promise.all([
          get<Actor>(`${nodes.actors}/${aid}`),
          getMap(`${nodes.actors}/${aid}`, "cards_by_game"),
        ]);
        if (!actor) return;

        const cardId = cardsByGame[gameId];
        let card: CardWithPosition | undefined;

        if (cardId) {
          usedSet.add(cardId);
          const rawCard = deckCards.find((c) => c.card_id === cardId);
          if (rawCard) {
            const [valMap, capMap] = await Promise.all([
              getRefMap(`${nodes.cards}/${cardId}`, "values_ref"),
              getRefMap(`${nodes.cards}/${cardId}`, "capabilities_ref"),
            ]);
            const [valueNames, capabilityNames] = await Promise.all([
              resolveNamesCached(Object.keys(valMap), nodes.values),
              resolveNamesCached(Object.keys(capMap), nodes.capabilities),
            ]);
            card = {
              ...rawCard,
              position: randomPos(),
              _valueNames: valueNames,
              _capabilityNames: capabilityNames,
            };
          }
        }

        actors.push({
          ...actor,
          cards_by_game: cardsByGame,
          card,
          position: randomPos(),
        } as ActorWithCard);
      }),
    );

    // 6️⃣ the leftover “available” cards
    const availableCards: CardWithPosition[] = await Promise.all(
      deckCards
        .filter((c) => !usedSet.has(c.card_id))
        .map(async (rawCard) => {
          const [valMap, capMap] = await Promise.all([
            getRefMap(`${nodes.cards}/${rawCard.card_id}`, "values_ref"),
            getRefMap(`${nodes.cards}/${rawCard.card_id}`, "capabilities_ref"),
          ]);
          const [valueNames, capabilityNames] = await Promise.all([
            resolveNamesCached(Object.keys(valMap), nodes.values),
            resolveNamesCached(Object.keys(capMap), nodes.capabilities),
          ]);
          return {
            ...rawCard,
            position: randomPos(),
            _valueNames: valueNames,
            _capabilityNames: capabilityNames,
          } as CardWithPosition;
        }),
    );

    // 7️⃣ agreements for this game — now correctly fetch obligation & benefit
  const rawAgs = await getCollection<Agreement>(nodes.agreements);
    const agreements: AgreementWithPosition[] = await Promise.all(
      rawAgs
        .filter((ag) => ag.game_ref === gameId)
        .map(async (ag) => {
const partiesRef =
  (await getRefMap(
    `${nodes.agreements}/${ag.agreement_id}`,
    "parties"
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

    // 8️⃣ deck display name
    const deckRec = await get<Deck>(`${nodes.decks}/${deckId}`);
    const deckName = deckRec?.name ?? rawGame.deck_type;

    const result: GameContext = {
      game: gameWithPlayers,
      actors,
      totalCards,
      usedCards: usedSet.size,
      availableCards,
      availableCardsCount: availableCards.length,
      agreements,
      deckName,
    };

    // dev‐only log
    // if (import.meta.env.DEV) {
    //   console.log(
    //     `[gameService] getGameContext full context for ${gameId}:`,
    //     result,
    //   );
    // }

    // always log
    console.log(
      `[gameService] getGameContext full context for ${gameId}:`,
      result,
    );

    return result;
  } catch (e) {
    console.error(`[gameService] getGameContext error for ${gameId}:`, e);
    return null;
  }
}




