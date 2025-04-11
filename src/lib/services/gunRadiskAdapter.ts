/**
 * Gun.js Adapter for Vite
 * 
 * This file initializes Gun.js with Radisk adapter support for Vite/SvelteKit.
 * Following the recommended approach from: https://github.com/amark/gun/wiki/Vite
 * 
 * The key issue is that Vite's ESM bundling doesn't work well with Gun.js's
 * CommonJS module pattern and global registrations. This adapter ensures
 * everything is loaded in the correct order.
 */

// First import Gun directly to ensure it's available in global scope
import Gun from 'gun';

// Signal start of adapter initialization
console.log('[GUN RADISK] Initializing Gun.js with Radisk adapter for Vite...');

// Import Gun modules in the correct order according to the Vite wiki docs
// The order is critical for Radisk to register properly
// Manually load the modules individually
import 'gun/lib/radix';
import 'gun/lib/radisk';
import 'gun/lib/store';
import 'gun/lib/rindexed';

// Import SEA authentication module
import 'gun/sea';

// Standard interface for our application
let radiskLoaded = false;

try {
  // Validate Gun.js is properly loaded
  if (typeof Gun !== 'function') {
    console.error('[GUN RADISK] Gun failed to load properly - not a function');
  } else {
    console.log('[GUN RADISK] Gun constructor loaded successfully');
    
    // Check for specific Gun properties that indicate successful initialization
    // Gun.window is added by imports on browser, Gun.RAD is added by radisk
    const hasWindow = typeof (Gun as any).window !== 'undefined';
    const hasRAD = hasWindow && (Gun as any).window.RAD === true;
    
    // In the browser with Vite, the RAD property might be on Gun directly
    const hasDirectRAD = typeof (Gun as any).RAD === 'boolean' && (Gun as any).RAD === true;
    
    // Check Gun.chain and Gun.on to verify core functionality
    const hasChain = typeof (Gun as any).chain === 'object';
    const hasOn = typeof Gun.on === 'function';
    
    // Set radiskLoaded based on all checks
    radiskLoaded = (hasRAD || hasDirectRAD) && hasChain && hasOn;
    
    // Log detailed status
    console.log('[GUN RADISK] Status check:', {
      hasWindow,
      hasRAD: hasRAD || hasDirectRAD,
      hasChain,
      hasOn,
      radiskLoaded
    });
    
    if (radiskLoaded) {
      console.log('[GUN RADISK] Radisk adapter loaded and registered successfully ✓');
    } else {
      console.warn('[GUN RADISK] Radisk loaded but not registered properly.',
                 'Gun.window.RAD =', hasWindow ? ((Gun as any).window?.RAD || false) : 'N/A', 
                 'Gun.RAD =', (Gun as any).RAD || false);
    }
  }
} catch (error) {
  console.error('[GUN RADISK] Error checking Radisk status:', error);
}

// Export the initialized Gun and radisk status
export { Gun, radiskLoaded };