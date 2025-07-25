// @ts-nocheck
/**
 * Gun.js database setup for Polycentricity3, following Vite/SvelteKit recommendations
 * Based on https://github.com/amark/gun/wiki/Vite
 *
 * Initializes a single Gun instance with localStorage for persistence, guarded for SSR safety
 *
 * Features:
 * - Browser-only initialization to prevent SSR errors
 * - Silent mode to reduce console noise
 * - Storage limits to prevent localStorage bloat
 * - Peer relays moved to .env for development
 */

import { browser } from "$app/environment";
import Gun from "gun";
// we no longer import Radisk or Rindexed:
// import "gun/lib/radix";
// import "gun/lib/radisk";
// import "gun/lib/store";
// import "gun/lib/rindexed";
import "gun/sea";
import "gun/lib/unset.js";
import { env } from '$env/dynamic/public';

/** @type {any} */
let db;
if (browser) {
  // Silence Gun's welcome message before initializing
  if (window.Gun) {
    window.Gun.log.once = () => {};
  }

  // Split GUN_PEERS if it exists and contains commas, otherwise use as-is or empty array
const peers = env.PUBLIC_GUN_PEERS
  ? env.PUBLIC_GUN_PEERS.includes(",")
    ? env.PUBLIC_GUN_PEERS.split(",")
    : [env.PUBLIC_GUN_PEERS]
  : undefined;

  const gunOptions = {
    ...(peers && { peers }), // Gun Peer Relays from environment variable - only include peers if defined
    localStorage: true, // ← use built-in localStorage, no Radisk
    silent: true, // reduce Gun logs
    quiet: true, // reduce SEA logs
    super: true, // extra silence
    axe: false, // disable local network announcements
    multicast: false, // disable multicast
    // if you need a size cap, you can still use opt.store for localStorage
    opt: { store: { max: 10 * 1024 * 1024 } }, // e.g. 10MB
  };

  db = Gun(gunOptions);

    // 👇 Expose for browser devtools
  window.gun = db;

  // Debug node to verify initialization
  db.get("users/debug").put({
    status: `Initialized at ${new Date().toISOString()}`,
    viteCompatible: true,
    schema: "Polycentricity3",
  });
}

export default db;
