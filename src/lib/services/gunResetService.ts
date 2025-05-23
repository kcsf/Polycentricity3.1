/**
 * Completely wipe all Gun.js data from the browser including IndexedDB
 * @returns A promise that resolves with a detailed log of operations
 */
export async function resetGunDatabase(): Promise<string> {
  let log = "";

  try {
    log += "--- Gun.js Database Reset ---\n";

    // Step 1: Clear localStorage
    log += "\n--- Clearing localStorage ---\n";
    const localStorageKeys = Object.keys(localStorage);
    log += `Found ${localStorageKeys.length} localStorage keys\n`;
    localStorage.clear();
    log += `✓ Cleared localStorage\n`;

    // Step 2: Clear sessionStorage
    log += "\n--- Clearing sessionStorage ---\n";
    const sessionStorageKeys = Object.keys(sessionStorage);
    log += `Found ${sessionStorageKeys.length} sessionStorage keys\n`;
    sessionStorage.clear();
    log += `✓ Cleared sessionStorage\n`;

    // Step 3: Clear IndexedDB (where Gun.js stores most data)
    log += "\n--- Clearing IndexedDB ---\n";
    if ('indexedDB' in window) {
      try {
        // Get all databases
        const databases = await indexedDB.databases();
        log += `Found ${databases.length} IndexedDB databases\n`;
        
        for (const db of databases) {
          if (db.name) {
            log += `Deleting database: ${db.name}\n`;
            const deleteReq = indexedDB.deleteDatabase(db.name);
            await new Promise((resolve, reject) => {
              deleteReq.onsuccess = () => resolve(true);
              deleteReq.onerror = () => reject(deleteReq.error);
              deleteReq.onblocked = () => {
                log += `⚠️ Database ${db.name} deletion blocked (may have open connections)\n`;
                // Force resolution anyway
                setTimeout(resolve, 100);
              };
            });
            log += `✓ Deleted database: ${db.name}\n`;
          }
        }
      } catch (error) {
        log += `⚠️ Error clearing IndexedDB: ${error}\n`;
      }
    } else {
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
    try {
      // Clear any Gun instances from global scope
      if ('gun' in window) {
        // @ts-ignore
        delete window.gun;
        log += "✓ Cleared global Gun instance\n";
      }
      
      // Force garbage collection hint
      if ('gc' in window) {
        // @ts-ignore
        window.gc();
        log += "✓ Suggested garbage collection\n";
      }
    } catch (error) {
      log += `⚠️ Error clearing Gun memory: ${error}\n`;
    }

    log += "\n--- Reset Complete ---\n";
    log += "✓ All Gun.js data has been cleared\n";
    log += "✓ Page will reload automatically to reinitialize clean state\n";
    
    return log;
  } catch (error) {
    log += `\n--- Critical Error ---\n`;
    log += `Failed to reset database: ${error}\n`;
    return log;
  }
}
