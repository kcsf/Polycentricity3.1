/**
 * IMPORTANT: This file exists solely to ensure Radisk adapter is loaded
 * before any other Gun.js imports.
 * 
 * The Radisk adapter MUST be registered before Gun constructor is accessed
 * so this file should be imported first in gunService.ts
 */

console.log('[GUN RADISK] Loading Radisk adapter first...');

// The actual import that registers Radisk with Gun
import 'gun/lib/radisk';

// Export a flag to verify the import
export const radiskLoaded = true;

console.log('[GUN RADISK] Radisk adapter loaded ✓');