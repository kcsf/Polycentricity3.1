// @ts-nocheck
/**
 * Gun.js database setup for Polycentricity3, following Vite/SvelteKit recommendations
 * Based on https://github.com/amark/gun/wiki/Vite
 * 
 * Initializes a single Gun instance with Radisk for IndexedDB storage, guarded for SSR safety
 * 
 * Features:
 * - Browser-only initialization to prevent SSR errors
 * - Silent mode to reduce console noise
 * - Storage limits to prevent IndexedDB bloat
 * - Prepares for peer relays
 */

import { browser } from '$app/environment';
import Gun from 'gun';
import 'gun/lib/radix';
import 'gun/lib/radisk';
import 'gun/lib/store';
import 'gun/lib/rindexed';
import 'gun/sea';

/** @type {any} */
let db;
if (browser) {
  // Silence Gun's welcome message before initializing
  if (window.Gun) {
    window.Gun.log.once = () => {};
  }

  const gunOptions = {
    localStorage: false, // Disable local storage, use IndexedDB via Radisk
    radisk: true, // Enable Radisk for persistent storage
    silent: true, // Reduce debug logs
    quiet: true, // Additional silencing for SEA
    super: true, // More silence
    axe: false, // Disable network announcements
    multicast: false, // Disable multicast (local network discovery)
    opt: { store: { max: 100 * 1024 * 1024 } }, // 100MB in bytes
    peers: [] // Placeholder for future peer relays
  };

  db = Gun(gunOptions);

  // Set a debug node to verify initialization, using schema-aligned path
  db.get('users/debug').put({
    status: `Initialized at ${new Date().toISOString()}`,
    viteCompatible: true,
    schema: 'Polycentricity3'
  });
}

export default db;