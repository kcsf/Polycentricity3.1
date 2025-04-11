/* gunService.ts - Guaranteed Radisk initialization for Gun.js
 * CRITICAL: This module ensures proper initialization order:
 * 1. Radisk adapter MUST load before any Gun instance is created
 * 2. localStorage is explicitly disabled (using IndexedDB instead)
 * 3. Single initialization point for the entire application
 */

// IMPORTANT - Import order matters! Radisk must be first
import "gun/lib/radisk";          // IndexedDB adapter (MUST be first)
import Gun from "gun";            // Core Gun import (after radisk)
import "gun/sea";                 // SEA auth
import "gun/lib/radix";           // Radix search helper
import { browser } from "$app/environment";
import type { IGunInstance, IGunUserInstance } from "gun";

/* ───────────────────────────── basics ───────────────────────────── */

// Global singleton Gun instance - shared across the application
let gun: IGunInstance | undefined;
const PEERS: string[] = [];       // add peer URLs if you have them
let isInitializing = false;       // Flag to prevent multiple initializations
let isInitialized = false;        // Flag to track if Gun is ready

export interface GunAck {
  err?: string;
  ok?: boolean;
  [k: string]: any;
}

/**
 * Initialize the Gun.js database with Radisk adapter.
 * This should only be called once at application startup.
 */
export function initializeGun(): IGunInstance | undefined {
  // Skip if not in browser or already initialized or currently initializing
  if (!browser || isInitialized || isInitializing) {
    return gun;
  }
  
  // Set flag to prevent concurrent initializations
  isInitializing = true;
  
  try {
    console.log("[initializeGun] Initializing Gun.js with peers:", PEERS);
    
    // Create the Gun instance with explicit options
    gun = Gun({
      radisk: true,        // Enable IndexedDB (Radisk)
      localStorage: false, // Disable localStorage (slower & blocking)
      peers: PEERS,        // Optional peer connections
    });
    
    // Set initialization flags
    isInitialized = true;
    console.log("[initializeGun] Gun initialized");
    
  } catch (error) {
    console.error("[initializeGun] Error initializing Gun:", error);
  } finally {
    isInitializing = false;
  }
  
  return gun;
}

/**
 * Get the Gun instance, initializing if needed.
 * This is the only way to access Gun throughout the application.
 */
export function getGun(): IGunInstance | undefined {
  if (!gun && browser && !isInitializing) {
    initializeGun();
  }
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

export function put<T>(
  soul: string,
  data: T,
  cb?: (ack: GunAck) => void,
): Promise<GunAck> {
  const g = getGun();
  if (!g) return Promise.reject(new Error("Gun not ready"));

  return Promise.race([
    timeout(30000, { err: "timeout", ok: false }),
    new Promise<GunAck>((res) => {
      g.get(soul).put(data, (ack) => {
        cb?.(ack);
        res({ err: ack.err, ok: !ack.err });
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
      g.get(soul).get(key).put(val, (ack) => res({ err: ack.err, ok: !ack.err }));
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
      g.get(fromSoul).get(field).set(g.get(toSoul), (ack) =>
        res({ err: ack.err, ok: !ack.err }),
      );
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
