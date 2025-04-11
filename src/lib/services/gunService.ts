/* gunService.ts - Guaranteed Radisk initialization for Gun.js
 * CRITICAL: This module ensures proper initialization order:
 * 1. Radisk adapter MUST load before any Gun instance is created
 * 2. localStorage is explicitly disabled (using IndexedDB instead)
 * 3. Single initialization point for the entire application
 */

// IMPORTANT: This import order is critical for Radisk to work correctly
console.log("[Gun Imports] Loading modules in the proper order for Radisk support");

// FIRST: Import Radisk adapter from our separate file
// This ensures the adapter loads before any Gun constructor
import { radiskLoaded } from './gunRadiskAdapter'; 
console.log("[Gun Imports] Radisk pre-loaded:", radiskLoaded);

// SECOND: Now import Gun core - this should see the Radisk adapter
import Gun from "gun";
console.log("[Gun Imports] Gun core module loaded");

// THIRD: Import the remaining Gun modules
import "gun/sea";
console.log("[Gun Imports] SEA authentication loaded");
import "gun/lib/radix";
console.log("[Gun Imports] Radix search plugin loaded");

// Finally, import environment
import { browser } from "$app/environment";
import type { IGunInstance, IGunUserInstance } from "gun";

// Check if Gun has the expected properties
// Using type assertion to access non-standard properties
const GunAny = Gun as any;

// Verify Radisk is available
if (GunAny.RAD) {
  console.log("[Gun Imports] ✓ SUCCESS: Gun.RAD adapter is properly registered");
} else {
  console.warn("[Gun Imports] ⚠️ WARNING: Gun.RAD adapter is NOT registered!");
  console.warn("[Gun Imports] Local database will use in-memory storage only!");
}

// Check if essential Gun components are available 
console.log("[Gun Imports] Gun chain available:", !!GunAny.chain);
console.log("[Gun Imports] Gun.on available:", typeof Gun.on === 'function');

/* ───────────────────────────── basics ───────────────────────────── */

// Global singleton Gun instance - shared across the application
let gun: IGunInstance | undefined;
const PEERS: string[] = [];       // add peer URLs if you have them
let isInitializing = false;       // Flag to prevent multiple initializations
let isInitialized = false;        // Flag to track if Gun is ready

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
 * This should only be called once at application startup.
 */
export function initializeGun(): IGunInstance | undefined {
  // Skip if not in browser or already initialized or currently initializing
  if (!browser || isInitialized || isInitializing) {
    console.log("[initializeGun] Skipping initialization - already initialized:", isInitialized, "or initializing:", isInitializing);
    return gun;
  }
  
  // Set flag to prevent concurrent initializations
  isInitializing = true;
  console.log("[initializeGun] Starting Gun.js initialization");
  
  // Check if Gun global object has the expected methods
  console.log("[initializeGun] Gun constructor available:", typeof Gun === 'function');
  console.log("[initializeGun] Gun.on available:", typeof Gun.on === 'function');
  console.log("[initializeGun] Gun.chain available:", !!(Gun as any).chain);
  
  // Critical - check if Radisk is registered with Gun
  // Use any type assertion to access Gun.RAD which TypeScript doesn't know about
  const radiskRegistered = !!((Gun as any).RAD && Gun.on && (Gun as any).chain);
  console.log("[initializeGun] *** RADISK ADAPTER REGISTERED:", radiskRegistered, "***");
  
  if (!radiskRegistered) {
    console.warn("[initializeGun] WARNING: Radisk adapter may not be properly registered");
    console.warn("[initializeGun] Gun.RAD:", !!(Gun as any).RAD, "- This must be true for IndexedDB to work");
  }
  
  try {
    console.log("[initializeGun] Initializing Gun.js with peers:", PEERS);
    
    // Create the Gun instance with explicit options
    const gunOpts = {
      radisk: true,        // Enable IndexedDB (Radisk)
      localStorage: false, // Disable localStorage (slower & blocking)
      peers: PEERS,        // Optional peer connections
    };
    
    console.log("[initializeGun] Gun options:", gunOpts);
    gun = Gun(gunOpts);
    
    if (!gun) {
      console.error("[initializeGun] Failed to create Gun instance - returned undefined");
      isInitializing = false;
      return undefined;
    }
    
    // Verify the Gun instance has expected methods
    console.log("[initializeGun] Gun instance created with get:", typeof gun.get === 'function');
    console.log("[initializeGun] Gun instance with put:", typeof gun.put === 'function');
    
    // Set initialization flags
    isInitialized = true;
    console.log("[initializeGun] Gun initialized successfully");
    
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
