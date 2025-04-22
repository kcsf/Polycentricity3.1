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

// Global singleton Gun instance from gun-db.js, initialized with Radisk
const gun = browser ? (db as unknown as IGunInstance) : undefined;

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
    g.get(soul).put(data, (ack: any) => {
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
    const timeout = setTimeout(() => resolve(null), 5000);
    g.get(soul).once((data) => {
      clearTimeout(timeout);
      resolve(data ? ({ ...data, _: undefined } as T) : null);
    });
  });
}

/**
 * Subscribe to real-time updates from a Gun node
 * @param soul - Node path (e.g., 'games/g_456')
 * @param cb - Callback with typed data
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
>(soul: string, cb: (data: T | null) => void): () => void {
  const g = getGun();
  if (!g) return () => {};

  const sub = g
    .get(soul)
    .on((data) => cb(data ? ({ ...data, _: undefined } as T) : null));
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
      .put(value, (ack: any) => {
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
    const timeout = setTimeout(() => resolve(null), 5000);
    g.get(soul)
      .get(key)
      .once((data) => {
        clearTimeout(timeout);
        resolve(data ? ({ ...data, _: undefined } as T) : null);
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
      .once((data, key) => {
        if (key && key !== "_" && data) {
          results.push({ ...data, _: undefined, id: key } as T);
        }
      });
    setTimeout(() => resolve(results), 1000);
  });
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
      .once((data, key) => {
        if (key && key !== "_" && data) {
          results.push({ ...data, _: undefined, id: key } as T);
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
  const user = getUser();
  if (!user || !user._.sea?.pub) throw new Error("User not authenticated");

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
    user.get(soul).put(data, (ack: any) => {
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
 * Check if a node exists in Gun
 * @param soul - Node path (e.g., 'games/g_456')
 * @returns Promise resolving to boolean
 */
export async function nodeExists(soul: string): Promise<boolean> {
  const g = getGun();
  if (!g) throw new Error("Gun not ready");

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000);
    g.get(soul).once((data) => {
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
 * Create a relationship (edge) between two nodes
 * @param fromSoul - Source node path (e.g., 'games/g_456')
 * @param field - Edge field (e.g., 'actors_ref')
 * @param toSoul - Target node path (e.g., 'actors/actor_1')
 * @returns Promise resolving to GunAck
 */
export async function createRelationship(
  fromSoul: string,
  field: string,
  toSoul: string,
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
    g.get(fromSoul)
      .get(field)
      .set(g.get(toSoul), (ack: any) => {
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
