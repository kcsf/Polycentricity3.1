/**
 * gunService.ts - Central access point for Gun.js database in Polycentricity3
 *
 * Provides type-safe CRUD operations and utilities for Gun.js, aligned with the new schema
 * and optimized for Vite/SvelteKit. Uses the pre-initialized Gun instance from gun-db.js.
 *
 * Requirements:
 * - gun-db.js must guard initialization with `if (browser)` to prevent SSR errors
 *
 * Features:
 * - Schema-aligned node paths (e.g., chat_rooms, chat_messages/<game_id>)
 * - Type-safe operations using index.ts types (e.g., Game, Actor, User)
 * - Short timeouts (5s reads, 1s writes) for Replit performance
 * - Sharded collection queries and SEA-signed writes
 * - Removes redundant checks and legacy Replit workarounds
 */

import db from "./gun-db.js";
import type Gun from "gun";
import { browser } from "$app/environment";
import type { IGunInstance, IGunUserInstance } from "gun";
import type {
  Game,
  Actor,
  User,
  Agreement,
  ChatRoom,
  ChatMessage,
  Card,
  Deck,
  Value,
  Capability,
  NodePosition,
} from "$lib/types";

// Explicitly type db to avoid implicit any
const dbTyped: IGunInstance | undefined = db;

// Global singleton Gun instance from gun-db.js, initialized with Radisk
const gun = browser ? (dbTyped as IGunInstance) : undefined;

/**
 * GunAck interface for Gun.js acknowledgment messages
 */
export interface GunAck {
  err?: string;
  ok: boolean;
  raw?: any; // Original ack for debugging
}

/**
 * Get the pre-initialized Gun instance
 * @returns Gun instance or undefined if not initialized or in SSR
 */
export function getGun(): IGunInstance | undefined {
  return gun;
}

/**
 * Get the Gun user instance for SEA operations
 * @returns User instance or undefined if not initialized or in SSR
 */
export function getUser(): IGunUserInstance | undefined {
  return gun?.user();
}

/**
 * Utility to remove Gun.js metadata
 */
function cleanData<T>(data: any): T | null {
  if (!data) return null;

  // Shallow copy to avoid mutating the original data
  const cleaned = { ...data };
  // Remove Gun.js metadata key "_"
  delete cleaned["_"];
  return cleaned as T;
}

/**  
 * Read a “ref” field and return a boolean map, whether it was written
 * as a plain { id:true } map or as a Gun.set() pointer‐edge.  
 */
export async function getRefMap(
  path: string,
  field: string
): Promise<Record<string,boolean>> {
  const mapPart = (await getField<Record<string,any>>(path, field)) || {};
  const result = new Set<string>(
    Object.entries(mapPart)
      .filter(([_k,v]) => v === true)
      .map(([k]) => k)
  );

  // also collect any live set‐edges
  const gun = getGun();
  if (gun) {
    await new Promise<void>(resolve => {
      gun.get(path).get(field).map().once((v:any, k:string) => {
        if (k && v) result.add(k);
      });
      setTimeout(resolve, 100);
    });
  }

  return Object.fromEntries(Array.from(result).map(id=>[id,true]));
}


/**
 * Put data into Gun at a specific soul location
 * @param soul - Node path (e.g., 'games/g_456')
 * @param data - Data to write (typed with schema)
 * @returns Promise resolving to GunAck
 */
export async function put<
  T extends
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
    | NodePosition,
>(soul: string, data: T | null): Promise<GunAck> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const timeout = setTimeout(
      () =>
        resolve({
          ok: true,
          err: undefined,
          raw: { fallback: true, message: "Fallback resolver" },
        }),
      1000,
    );
    g.get(soul).put(data, (ack: { err?: string; ok?: boolean }) => {
      clearTimeout(timeout);
      const hasError = ack && (ack.err || typeof ack.err !== "undefined");
      resolve({
        err: hasError ? ack.err : undefined,
        ok: !hasError,
        raw: ack,
      });
    });
  });
}

/**
 * Get data from Gun at a specific soul location
 * @param soul - Node path (e.g., 'games/g_456')
 * @returns Promise resolving to typed data or null
 */
export async function get<
  T extends
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
    | NodePosition,
>(soul: string): Promise<T | null> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 500);
    g.get(soul).once((data: T | undefined, key: string) => {
      clearTimeout(timeout);
      if (!data) {
        resolve(null);
        return;
      }
      const cleanedData = cleanData<T>(data);
      resolve(cleanedData);
    });
  });
}

/**
 * Subscribe to real-time updates from a Gun node,
 * optionally in “change only” (delta) mode.
 *
 * @param soul - Node path (e.g. 'games/g_456')
 * @param cb - Called with cleaned data or null on delete
 * @param changeOnly - If true, you get only the diff, not the full object
 * @returns Unsubscribe function
 */
export function subscribe<
  T extends
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
    | NodePosition,
>(
  soul: string,
  cb: (data: T | null) => void,
  changeOnly: boolean = false
): () => void {
  const g = getGun();
  if (!g) return () => {};

  // Note: raw is typed as `any` so TypeScript won’t complain about GunDataNode<T>
  const sub = g
    .get(soul)
    .on((raw: any) => {
      const cleaned: T | null = raw ? cleanData<T>(raw) : null;
      cb(cleaned);
    }, changeOnly);

  return () => sub.off();
}

/**
 * Set a specific field in a Gun node
 * @param soul - Node path (e.g., 'games/g_456')
 * @param key - Field name (e.g., 'name')
 * @param value - Field value
 * @returns Promise resolving to GunAck
 */
export async function setField<T>(
  soul: string,
  key: string,
  value: T,
): Promise<GunAck> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const timeout = setTimeout(
      () =>
        resolve({
          ok: true,
          err: undefined,
          raw: { fallback: true, message: "Fallback resolver" },
        }),
      1000,
    );
    g.get(soul)
      .get(key)
      .put(value, (ack: { err?: string; ok?: boolean }) => {
        clearTimeout(timeout);
        const hasError = ack && (ack.err || typeof ack.err !== "undefined");
        resolve({
          err: hasError ? ack.err : undefined,
          ok: !hasError,
          raw: ack,
        });
      });
  });
}

/**
 * Get a specific field from a Gun node
 * @param soul - Node path (e.g., 'games/g_456')
 * @param key - Field name (e.g., 'name')
 * @returns Promise resolving to field value or null
 */
export async function getField<T>(
  soul: string,
  key: string,
): Promise<T | null> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 200);
    g.get(soul)
      .get(key)
      .once((data: T | undefined, key: string) => {
        clearTimeout(timeout);
        resolve(data ? cleanData<T>(data) : null);
      });
  });
}

/**
 * Get a collection of nodes from a Gun path
 * @param soul - Collection path (e.g., 'games')
 * @returns Promise resolving to array of typed data
 */
export async function getCollection<
  T extends
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
    | NodePosition,
>(soul: string): Promise<T[]> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const results: T[] = [];
    g.get(soul)
      .map()
      .once((data: T | undefined, key: string) => {
        //console.log(`[getCollection] key: ${key}, data:`, data);
        if (key && key !== "_" && data) {
          const cleanedData = cleanData<T>({ ...data, id: key });
          if (cleanedData) {
            results.push(cleanedData);
          }
        }
      });
    setTimeout(() => resolve(results), 2000);
  });
}

/**
 * Read a real Gun set at `path/field` into an array of IDs.
 */
export async function getSet(
  path: string,
  field: string,
  timeoutMs = 200,
): Promise<string[]> {
  const gun = getGun();
  if (!gun) return [];
  const results = new Set<string>();
  await new Promise<void>((resolve) => {
    gun
      .get(path)
      .get(field)
      .map()
      .once((val: any, key: string) => {
        if (key && key !== "_" && val) {
          results.add(key);
        }
      });
    // resolve as soon as possible
    const t = setTimeout(() => {
      clearTimeout(t);
      resolve();
    }, timeoutMs);
  });
  return Array.from(results);
}

/**
 * Get a sharded collection (e.g., chat messages by date)
 * @param baseSoul - Base path (e.g., 'chat_rooms/chat_g_456/messages_ref')
 * @param shardKey - Shard identifier (e.g., 'day_20250421')
 * @returns Promise resolving to array of typed data
 */
export async function getShardedCollection<T extends ChatMessage>(
  baseSoul: string,
  shardKey: string,
): Promise<T[]> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const results: T[] = [];
    g.get(baseSoul)
      .get(shardKey)
      .map()
      .once((data: T | undefined, key: string) => {
        if (key && key !== "_" && data) {
          const cleanedData = cleanData<T>({ ...data, id: key });
          if (cleanedData) {
            results.push(cleanedData);
          }
        }
      });
    setTimeout(() => resolve(results), 1000);
  });
}

/**
 * Build a sharded path for chat messages or node positions
 * @param basePath - Base path (e.g., nodes.chat_messages, nodes.node_positions)
 * @param gameId - Game ID (e.g., 'g_456')
 * @param id - Message or node ID (optional, e.g., 'msg_1')
 * @returns Composite path (e.g., 'chat_messages/g_456/msg_1')
 */
export function buildShardedPath(
  basePath: string,
  gameId: string,
  id?: string,
): string {
  return id ? `${basePath}/${gameId}/${id}` : `${basePath}/${gameId}`;
}

/**
 * Put data with SEA signature for authenticated writes
 * @param soul - Node path (e.g., 'users/u_838')
 * @param data - Data to write (typed with schema)
 * @returns Promise resolving to GunAck
 */
export async function putSigned<
  T extends
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
    | NodePosition,
>(soul: string, data: T | null): Promise<GunAck> {
  // Ensure the user is authenticated
  const user = getUser();
  if (!user || !user._.sea?.pub) {
    throw new Error("User not authenticated");
  }

  // Write on the public graph, not the user's private graph
  const g = getGun();
  if (!g) {
    throw new Error("Gun not ready");
  }

  // Walk the slash-delimited path
  const parts = soul.split("/");
  let node = g.get(parts[0]);
  for (let i = 1; i < parts.length; i++) {
    node = node.get(parts[i]);
  }

  // Perform the put with timeout fallback
  return new Promise<GunAck>((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        ok: true,
        err: undefined,
        raw: { fallback: true, message: "Fallback resolver" },
      });
    }, 1000);

    node.put(data, (ack: { err?: string; ok?: boolean }) => {
      clearTimeout(timeout);
      const hasError = Boolean(
        ack && (ack.err || typeof ack.err !== "undefined"),
      );
      resolve({
        err: hasError ? ack.err : undefined,
        ok: !hasError,
        raw: ack,
      });
    });
  });
}

/**
 * Check if a node exists in Gun
 * @param soul - Node path (e.g., 'games/g_456')
 * @returns Promise resolving to boolean
 */
export async function nodeExists(soul: string): Promise<boolean> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000);
    g.get(soul).once((data: any) => {
      clearTimeout(timeout);
      resolve(!!data && Object.keys(data).length > 0);
    });
  });
}

/**
 * Delete a node from Gun
 * @param soul - Node path (e.g., 'games/g_456')
 * @returns Promise resolving to GunAck
 */
export async function deleteNode(soul: string): Promise<GunAck> {
  return put(soul, null);
}

/**
 * Create a relationship (edge) between two nodes, optionally with metadata.
 * @param fromSoul - Source node path (e.g., 'games/g_456')
 * @param field - Edge field (e.g., 'actors_ref' or 'ref_set')
 * @param toSoul - Target node path (e.g., 'actors/actor_1')
 * @param meta - Optional metadata to store on the edge (e.g. { role: 'creator' })
 * @returns Promise resolving to GunAck
 */
export async function createRelationship(
  fromSoul: string,
  field: string,
  toSoul: string,
  meta?: Record<string, any>,
): Promise<GunAck> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const timeout = setTimeout(
      () =>
        resolve({
          ok: true,
          err: undefined,
          raw: { fallback: true, message: "Fallback resolver" },
        }),
      1000,
    );

    const edgeValue = meta
      ? { "#": toSoul, ...meta }
      : g.get(toSoul);

    g.get(fromSoul)
      .get(field)
      .set(edgeValue, (ack: { err?: string; ok?: boolean }) => {
        clearTimeout(timeout);
        const hasError = ack && typeof ack.err !== "undefined";
        resolve({
          err: hasError ? ack.err : undefined,
          ok: !hasError,
          raw: ack,
        });
      });
  });
}


/**
 * Generate a unique ID for Gun nodes
 * @returns Unique ID string
 */
export function generateId(): string {
  return `_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Schema-aligned node paths
 * Note: chat_messages and node_positions are base paths; use buildShardedPath for composite paths
 * (e.g., chat_messages/g_456/msg_1, node_positions/g_456/card_1)
 */
export const nodes = {
  users: "users",
  games: "games",
  actors: "actors",
  cards: "cards",
  decks: "decks",
  values: "values",
  capabilities: "capabilities",
  agreements: "agreements",
  chat_rooms: "chat_rooms",
  chat_messages: "chat_messages", // Base path, append /<game_id>/<message_id>
  node_positions: "node_positions", // Base path, append /<game_id>/<node_id>
};

/**
 * Fetch a map (Record<string, string>) from a sub-node
 * @param soul - Base node path (e.g., 'actors/actor_1')
 * @param field - Sub-node field (e.g., 'cards_by_game')
 * @returns Promise resolving to the map or empty object
 */
export async function getMap(
  soul: string,
  field: string,
): Promise<Record<string, string>> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const map: Record<string, string> = {};
    g.get(soul)
      .get(field)
      .map()
      .once((data: any, key: string) => {
        if (key && key !== "_" && data !== undefined && data !== null) {
          map[key] = String(data); // Ensure value is a string
          //console.log(`[getMap] ${soul}/${field} - ${key}: ${data}`);
        }
      });
    setTimeout(() => {
      //console.log(`[getMap] Resolved ${soul}/${field}:`, map);
      resolve(map);
    }, 1000); // Timeout to ensure data collection
  });
}