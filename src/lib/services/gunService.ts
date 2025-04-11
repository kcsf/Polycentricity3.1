/* gunService.ts - Central access point for Gun.js database
 * This module ensures proper Gun.js initialization and usage.
 * 
 * Uses the Vite-compatible approach from https://github.com/amark/gun/wiki/Vite
 * We import directly from gun-db.js which initializes Gun.js properly for Vite
 */

// Import the pre-initialized Gun instance from gun-db.js
// This instance is already properly configured for Vite
import db from './gun-db.js';
import type Gun from 'gun';

// Import environment
import { browser } from "$app/environment";
import type { IGunInstance, IGunUserInstance } from "gun";

// Check if the db instance is a valid Gun instance
const isPersistentStorage = db && (db as any).opt?.radisk === true;
console.log("[gunService] Gun db instance loaded:", !!db);
console.log("[gunService] Using persistent storage:", isPersistentStorage);

/* ───────────────────────────── basics ───────────────────────────── */

// Global singleton Gun instance reference from our gun-db.js
// This is already initialized and shared across the application
const gun = db as unknown as IGunInstance;

/**
 * GunAck interface defining the expected structure of Gun.js acknowledgment messages
 * This is a more permissive interface to handle the inconsistent Gun.js ack format
 */
export interface GunAck {
  err?: string | any;  // Error message, could be string or object
  ok?: boolean | any;  // Success flag, could be boolean or object like {'':{}}
  [k: string]: any;    // Allow any other properties
}

/**
 * Initialize the Gun.js database with Radisk adapter.
 * This is now just a reference method that returns the pre-initialized Gun instance.
 */
export function initializeGun(): IGunInstance | undefined {
  // Just return the pre-initialized Gun instance from gun-db.js
  console.log("[initializeGun] Using pre-initialized Gun instance from gun-db.js");
  return gun;
}

/**
 * Get the Gun instance, already initialized.
 * This is the only way to access Gun throughout the application.
 */
export function getGun(): IGunInstance | undefined {
  console.log("[getGun] ✓ Gun instance available from gun-db.js");
  return gun;
}

export function getUser(): IGunUserInstance | undefined {
  return getGun()?.user();
}

/* ───────────────────────── timeout helper ───────────────────────── */

function timeout<T>(ms: number, fallback: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(fallback), ms));
}

/* ──────────────────────────── CRUD ops ──────────────────────────── */

/**
 * Put data into Gun at a specific soul location.
 * Handles Gun.js's acknowledgment format safely.
 */
export function put<T>(
  soul: string,
  data: T,
  cb?: (ack: any) => void,
): Promise<GunAck> {
  const g = getGun();
  if (!g) return Promise.reject(new Error("Gun not ready"));

  return Promise.race([
    timeout(30000, { err: "timeout", ok: false }),
    new Promise<GunAck>((res) => {
      // Use any type for ack to avoid TypeScript errors with Gun's inconsistent format
      g.get(soul).put(data, (ack: any) => {
        // Call the original callback if provided
        if (cb) cb(ack);
        
        // Safely extract error and create a consistent GunAck response
        const hasError = ack && (ack.err || (typeof ack.err !== 'undefined'));
        res({ 
          err: hasError ? ack.err : undefined, 
          ok: !hasError,
          raw: ack // Keep the original ack for debugging
        });
      });
    }),
  ]);
}

export function get<T>(soul: string): Promise<T | null> {
  const g = getGun();
  if (!g) return Promise.reject(new Error("Gun not ready"));

  return new Promise((res) => {
    const t = setTimeout(() => res(null), 5000);
    g.get(soul).once((d: any) => {
      clearTimeout(t);
      res(d ? ({ ...d, _: undefined } as T) : null);
    });
  });
}

export function subscribe<T>(
  soul: string,
  cb: (d: T) => void,
): () => void {
  const g = getGun();
  if (!g) return () => {};

  const sub = g.get(soul).on((d: any) => cb({ ...d, _: undefined } as T));
  return () => sub.off();
}

/**
 * Set a specific field in a Gun node
 */
export function setField<T>(
  soul: string,
  key: string,
  val: T,
): Promise<GunAck> {
  const g = getGun();
  if (!g) return Promise.reject(new Error("Gun not ready"));

  return Promise.race([
    timeout(30000, { err: "timeout", ok: false }),
    new Promise<GunAck>((res) => {
      // Use any type for ack to avoid TypeScript errors with Gun's inconsistent format
      g.get(soul).get(key).put(val, (ack: any) => {
        // Safely extract error and create a consistent GunAck response
        const hasError = ack && (ack.err || (typeof ack.err !== 'undefined'));
        res({ 
          err: hasError ? ack.err : undefined, 
          ok: !hasError,
          raw: ack // Keep the original ack for debugging
        });
      });
    }),
  ]);
}

export function getField<T>(
  soul: string,
  key: string,
): Promise<T | null> {
  const g = getGun();
  if (!g) return Promise.reject(new Error("Gun not ready"));

  return new Promise((res) => {
    const t = setTimeout(() => res(null), 5000);
    g.get(soul).get(key).once((d: any) => {
      clearTimeout(t);
      res(d ? ({ ...d, _: undefined } as T) : null);
    });
  });
}

export function getCollection<T>(soul: string): Promise<T[]> {
  const g = getGun();
  if (!g) return Promise.reject(new Error("Gun not ready"));

  return new Promise((res) => {
    const out: T[] = [];
    g.get(soul)
      .map()
      .once((d: any, k: string) => {
        if (k && k !== "_") out.push({ ...d, _: undefined, id: k } as T);
      });
    setTimeout(() => res(out), 800);
  });
}

export function nodeExists(soul: string): Promise<boolean> {
  const g = getGun();
  if (!g) return Promise.reject(new Error("Gun not ready"));

  return new Promise((res) => {
    const t = setTimeout(() => res(false), 5000);
    g.get(soul).once((d: any) => {
      clearTimeout(t);
      res(!!d && Object.keys(d).length > 0);
    });
  });
}

export function deleteNode(soul: string): Promise<GunAck> {
  return put(soul, null);
}

/* ──────────────────────── relationship helpers ─────────────────── */

/**
 * Create a relationship (edge) between two nodes
 */
export function createRelationship(
  fromSoul: string,
  field: string,
  toSoul: string,
): Promise<GunAck> {
  const g = getGun();
  if (!g) return Promise.reject(new Error("Gun not ready"));

  return Promise.race([
    timeout(30000, { err: "timeout", ok: false }),
    new Promise<GunAck>((res) => {
      g.get(fromSoul).get(field).set(g.get(toSoul), (ack: any) => {
        // Safely extract error and create a consistent GunAck response
        const hasError = ack && (ack.err || (typeof ack.err !== 'undefined'));
        res({ 
          err: hasError ? ack.err : undefined, 
          ok: !hasError,
          raw: ack // Keep the original ack for debugging
        });
      });
    }),
  ]);
}

/* ───────────────────────── util / constants ────────────────────── */

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const nodes = {
  values: "values",
  capabilities: "capabilities",
  users: "users",
  games: "games",
  cards: "cards",
  decks: "decks",
  actors: "actors",
  chat: "chat",
  agreements: "agreements",
  positions: "node_positions",
};
