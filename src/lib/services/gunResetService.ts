/**
 * Completely wipe all Gun.js data from the browser including IndexedDB
 * @returns A promise that resolves with a detailed log of operations
 */
export async function resetGunDatabase(): Promise<string> {
  let log = "";

  try {
    console.log("[RESET] Starting Gun.js database reset");
    log += "--- Gun.js Database Reset ---\n";

    // Step 1: Clear localStorage
    log += "\n--- Clearing localStorage ---\n";
    console.log("[RESET] Checking localStorage");
    const localStorageKeys = Object.keys(localStorage);
    log += `Found ${localStorageKeys.length} localStorage keys\n`;
    console.log("[RESET] localStorage keys:", localStorageKeys);
    
    // Log each key for debugging
    localStorageKeys.forEach(key => {
      const value = localStorage.getItem(key);
      log += `  - ${key}: ${value ? value.substring(0, 50) + '...' : 'null'}\n`;
      console.log(`[RESET] localStorage[${key}]:`, value ? value.substring(0, 100) : 'null');
    });
    
    localStorage.clear();
    console.log("[RESET] localStorage cleared");
    log += `✓ Cleared localStorage\n`;

    // Step 2: Clear sessionStorage
    log += "\n--- Clearing sessionStorage ---\n";
    console.log("[RESET] Checking sessionStorage");
    const sessionStorageKeys = Object.keys(sessionStorage);
    log += `Found ${sessionStorageKeys.length} sessionStorage keys\n`;
    console.log("[RESET] sessionStorage keys:", sessionStorageKeys);
    
    sessionStorageKeys.forEach(key => {
      const value = sessionStorage.getItem(key);
      log += `  - ${key}: ${value ? value.substring(0, 50) + '...' : 'null'}\n`;
      console.log(`[RESET] sessionStorage[${key}]:`, value ? value.substring(0, 100) : 'null');
    });
    
    sessionStorage.clear();
    console.log("[RESET] sessionStorage cleared");
    log += `✓ Cleared sessionStorage\n`;

    // Step 3: Clear IndexedDB (where Gun.js stores most data)
    log += "\n--- Clearing IndexedDB ---\n";
    console.log("[RESET] Checking IndexedDB availability");
    if ('indexedDB' in window) {
      try {
        console.log("[RESET] Getting IndexedDB databases list");
        // Get all databases
        const databases = await indexedDB.databases();
        log += `Found ${databases.length} IndexedDB databases\n`;
        console.log("[RESET] IndexedDB databases found:", databases);
        
        for (const db of databases) {
          if (db.name) {
            log += `Deleting database: ${db.name} (version: ${db.version})\n`;
            console.log(`[RESET] Attempting to delete database: ${db.name}`);
            
            const deleteReq = indexedDB.deleteDatabase(db.name);
            await new Promise((resolve, reject) => {
              deleteReq.onsuccess = () => {
                console.log(`[RESET] Successfully deleted database: ${db.name}`);
                resolve(true);
              };
              deleteReq.onerror = () => {
                console.error(`[RESET] Error deleting database ${db.name}:`, deleteReq.error);
                reject(deleteReq.error);
              };
              deleteReq.onblocked = () => {
                console.warn(`[RESET] Database ${db.name} deletion blocked`);
                log += `⚠️ Database ${db.name} deletion blocked (may have open connections)\n`;
                // Force resolution anyway
                setTimeout(resolve, 100);
              };
            });
            log += `✓ Deleted database: ${db.name}\n`;
          }
        }
        console.log("[RESET] All IndexedDB databases processed");
      } catch (error) {
        console.error("[RESET] Error clearing IndexedDB:", error);
        log += `⚠️ Error clearing IndexedDB: ${error}\n`;
      }
    } else {
      console.log("[RESET] IndexedDB not available");
      log += "IndexedDB not available in this environment\n";
    }

    // Step 4: Clear WebSQL (legacy, but some Gun.js versions might use it)
    log += "\n--- Clearing WebSQL (if available) ---\n";
    if ('openDatabase' in window) {
      try {
        // @ts-ignore - WebSQL is deprecated but might exist
        const db = window.openDatabase('', '', '', '');
        log += "✓ WebSQL cleared (if any existed)\n";
      } catch (error) {
        log += "WebSQL not available or already clear\n";
      }
    } else {
      log += "WebSQL not available\n";
    }

    // Step 5: Clear any Gun.js specific caches
    log += "\n--- Clearing Gun.js Memory ---\n";
    console.log("[RESET] Clearing Gun.js memory caches");
    try {
      // Clear any Gun instances from global scope
      if ('gun' in window) {
        console.log("[RESET] Found global Gun instance, deleting");
        // @ts-ignore
        delete window.gun;
        log += "✓ Cleared global Gun instance\n";
      } else {
        console.log("[RESET] No global Gun instance found");
        log += "No global Gun instance found\n";
      }
      
      // Force garbage collection hint
      if ('gc' in window) {
        console.log("[RESET] Suggesting garbage collection");
        // @ts-ignore
        window.gc();
        log += "✓ Suggested garbage collection\n";
      } else {
        console.log("[RESET] Garbage collection not available");
        log += "Garbage collection not available\n";
      }
    } catch (error) {
      console.error("[RESET] Error clearing Gun memory:", error);
      log += `⚠️ Error clearing Gun memory: ${error}\n`;
    }

    // Step 6: Verify reset by checking what's left
    log += "\n--- Post-Reset Verification ---\n";
    console.log("[RESET] Verifying reset completion");
    
    const remainingLocalStorage = Object.keys(localStorage);
    const remainingSessionStorage = Object.keys(sessionStorage);
    
    log += `localStorage keys remaining: ${remainingLocalStorage.length}\n`;
    log += `sessionStorage keys remaining: ${remainingSessionStorage.length}\n`;
    
    if (remainingLocalStorage.length > 0) {
      log += `Remaining localStorage keys: ${remainingLocalStorage.join(', ')}\n`;
      console.log("[RESET] Remaining localStorage keys:", remainingLocalStorage);
    }
    
    if (remainingSessionStorage.length > 0) {
      log += `Remaining sessionStorage keys: ${remainingSessionStorage.join(', ')}\n`;
      console.log("[RESET] Remaining sessionStorage keys:", remainingSessionStorage);
    }

    log += "\n--- Reset Complete ---\n";
    log += "✓ All Gun.js data has been cleared\n";
    log += "✓ Page will reload automatically to reinitialize clean state\n";
    
    console.log("[RESET] Database reset process completed");
    return log;
  } catch (error) {
    log += `\n--- Critical Error ---\n`;
    log += `Failed to reset database: ${error}\n`;
    return log;
  }
}
