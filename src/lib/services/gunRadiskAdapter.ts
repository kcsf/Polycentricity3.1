/**
 * CRITICAL: This file MUST be imported before any Gun.js usage.
 * 
 * It ensures the Radisk adapter is registered properly before Gun is
 * accessed. According to Gun.js docs, the correct order is:
 * 1. Load gun/lib/radix
 * 2. Load gun/lib/radisk
 * 3. Load gun/lib/store
 * 4. Load gun/lib/rindexed
 * 5. THEN load Gun core
 * 
 * Reference: https://gun.eco/docs/Radisk#radisk-storage-engine
 */

// This file is critically important for Gun.js initialization
console.log('[GUN RADISK] Loading Radisk adapter and required modules...');

// IMPORTANT: First import Gun to make it globally available
import Gun from 'gun';

// Then load Radisk dependencies in the specific order
import 'gun/lib/radix';
import 'gun/lib/radisk';
import 'gun/lib/store';
import 'gun/lib/rindexed';

// Finally import SEA for authentication
import 'gun/sea';

// Export Gun and radisk status
let radiskLoaded = false;

try {
  // Check if Gun is properly loaded
  if (!Gun) {
    console.error('[GUN RADISK] Gun failed to load properly');
  } else {
    console.log('[GUN RADISK] Gun loaded successfully');
    
    // Check for Gun.RAD to verify Radisk
    radiskLoaded = (Gun as any).RAD === true;
    
    if (radiskLoaded) {
      console.log('[GUN RADISK] Radisk adapter loaded and registered successfully ✓');
    } else {
      console.warn('[GUN RADISK] Radisk loaded but not registered properly. Gun.RAD =', 
                 (Gun as any).RAD || false);
    }
  }
} catch (error) {
  console.error('[GUN RADISK] Error checking Radisk status:', error);
}

export { Gun, radiskLoaded };