/**
 * This utility silences Gun.js messages in the console
 * Add this line in global.d.ts if TypeScript errors occur:
 * interface Window { Gun: any; }
 */

// Run this on browser-only code
export function silenceGunMessages() {
  if (typeof window !== 'undefined') {
    // Capture original console functions
    const originalLog = console.log;
    const originalDebug = console.debug;
    
    // Filter Gun's welcome message
    console.log = function(...args) {
      // Skip the welcome message
      if (args[0] === 'Hello wonderful person! :)' || 
          (typeof args[0] === 'string' && args[0].includes('Thanks for using GUN'))) {
        return;
      }
      
      // Skip "No authenticated user found" message
      if (args[0] === 'No authenticated user found in session') {
        return;
      }
      
      // Apply original function
      return originalLog.apply(console, args);
    };
    
    // Filter out any Gun debug messages
    console.debug = function(...args) {
      // Skip vite connecting messages
      if (args[0] === '[vite] connecting...' || args[0] === '[vite] connected.') {
        return;
      }
      
      // Apply original function
      return originalDebug.apply(console, args);
    };
    
    // Try to silence Gun directly if it's already loaded
    if (window.Gun) {
      try {
        window.Gun.log.once = () => {};
        window.Gun.log.off = true;
        window.Gun.DEBUG = false;
      } catch (e) {
        // Ignore errors when trying to silence Gun
      }
    }
  }
}

// Export a simple function to reset the console functions (for debugging)
export function resetConsole() {
  if (typeof window !== 'undefined') {
    console.log = window.console.log;
    console.debug = window.console.debug;
  }
}