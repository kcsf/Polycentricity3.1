/**
 * Gun.js database setup following Vite/SvelteKit recommendations
 * Based on https://github.com/amark/gun/wiki/Vite
 */

// First, import Gun.js core
import Gun from 'gun';

// Then import modules in correct order
// Note: Using direct imports for each, not dynamic imports
import 'gun/lib/radix';
import 'gun/lib/radisk';
import 'gun/lib/store';
import 'gun/lib/rindexed';
import 'gun/sea';

// Create and export a single Gun instance without logging for performance
const gunOptions = {
  localStorage: false,  // Disable local storage (we'll use IndexedDB via radisk)
  radisk: true,         // Enable radisk for IndexedDB storage
};

// Create the Gun instance
const db = Gun(gunOptions);

// Set a root path to verify it's working
db.get('debug').put({
  status: 'Initialized at ' + new Date().toISOString(),
  viteCompatible: true,
});

export default db;