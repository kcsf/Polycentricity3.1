/**
 * Utility to completely reset and clear all Gun.js database data
 * This includes:
 * - IndexedDB databases (radisk, gun, radata)
 * - localStorage entries related to Gun
 * - SessionStorage entries
 */

/**
 * Completely wipe all Gun.js data from the browser
 * @returns A promise that resolves when all operations are complete
 */
export async function resetGunDatabase(): Promise<string> {
  let log = '';
  
  try {
    // 1. Delete all IndexedDB databases that might be used by Gun
    const dbNames = ['radisk', 'gun', 'radata'];
    const dbPromises = dbNames.map(dbName => {
      return new Promise<void>((resolve) => {
        try {
          log += `Attempting to delete '${dbName}' database...\n`;
          const request = indexedDB.deleteDatabase(dbName);
          
          request.onsuccess = () => {
            log += `✓ Successfully deleted '${dbName}' database\n`;
            resolve();
          };
          
          request.onerror = (event) => {
            log += `⚠️ Error deleting '${dbName}' database: ${(event.target as any)?.error || 'Unknown error'}\n`;
            resolve(); // Continue even if there's an error
          };
        } catch (err) {
          log += `⚠️ Exception trying to delete '${dbName}': ${err}\n`;
          resolve(); // Continue even if there's an exception
        }
      });
    });
    
    // 2. Clear all localStorage entries related to Gun
    log += 'Clearing localStorage entries...\n';
    
    // Known Gun keys and patterns
    const knownPatterns = [
      'gun/', 'gun', 'sea', '~', 'iris.', 'PEER', 'ALLOW',
      'graph', 'user', 'auth', 'node_', 'alias', 'keys'
    ];
    
    // Find all keys that might be related to Gun
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (knownPatterns.some(pattern => key.includes(pattern))) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all identified Gun keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
    log += `✓ Removed ${keysToRemove.length} Gun-related items from localStorage\n`;
    
    // 3. Clear session storage completely
    sessionStorage.clear();
    log += '✓ Cleared session storage\n';
    
    // Wait for all DB deletions to complete
    await Promise.all(dbPromises);
    
    // 4. Verify IndexedDB is empty of Gun databases
    const checkDBs = await checkExistingDBs();
    log += `\nVerification: ${checkDBs}\n`;
    
    log += '\nDatabase reset complete! Page will reload in 3 seconds...\n';
    return log;
  } catch (error) {
    log += `Error during reset: ${error}\n`;
    return log;
  }
}

/**
 * Check if any Gun-related IndexedDB databases still exist
 */
async function checkExistingDBs(): Promise<string> {
  return new Promise<string>((resolve) => {
    try {
      // Check if the databases method exists (not all browsers support it)
      if (typeof indexedDB.databases !== 'function') {
        resolve('Browser does not support checking existing databases');
        return;
      }
      
      // Use the databases API with proper typing
      indexedDB.databases().then((databases) => {
        // Filter for Gun-related databases
        const gunDBs = databases.filter((db: IDBDatabaseInfo) => 
          ['radisk', 'gun', 'radata'].includes(db.name || '')
        );
        
        if (gunDBs.length > 0) {
          resolve(`Found ${gunDBs.length} Gun databases still present: ${gunDBs.map((db: IDBDatabaseInfo) => db.name).join(', ')}`);
        } else {
          resolve('No Gun databases detected - clean state achieved');
        }
      }).catch((error) => {
        resolve(`Error checking databases: ${error}`);
      });
    } catch (error) {
      // Fallback for any unexpected errors
      resolve(`Could not check for existing databases: ${error}`);
    }
  });
}