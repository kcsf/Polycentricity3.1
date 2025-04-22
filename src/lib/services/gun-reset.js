/**
 * Utility script for resetting Gun databases from the browser console
 * 
 * This is a helper script that you can copy/paste directly into your browser console
 * to help troubleshoot and clear Gun database issues.
 * 
 * Usage:
 * 1. Open your browser developer tools (F12 or right-click > Inspect)
 * 2. Go to the Console tab
 * 3. Copy/paste this entire script and press Enter
 * 4. Run resetGunCompletely() to clear all data
 */

async function resetGunCompletely() {
  console.log("Starting complete Gun.js database reset...");
  
  // 1. Drop all IndexedDB databases
  const dbNames = ['radisk', 'gun', 'radata'];
  for (const dbName of dbNames) {
    await new Promise(resolve => {
      console.log(`Attempting to delete '${dbName}' database...`);
      const request = indexedDB.deleteDatabase(dbName);
      
      request.onsuccess = () => {
        console.log(`✓ Successfully deleted '${dbName}' database`);
        resolve();
      };
      
      request.onerror = (event) => {
        console.warn(`⚠️ Error deleting '${dbName}' database:`, event.target.error);
        resolve(); // Continue anyway
      };
    });
  }
  
  // 2. Clear localStorage
  console.log("Clearing localStorage...");
  
  // Known Gun.js related patterns
  const gunPatterns = [
    'gun/', 'gun', 'sea', '~', 'iris.', 'PEER', 'ALLOW',
    'graph', 'user', 'auth', 'node_', 'alias', 'keys'
  ];
  
  let count = 0;
  // Clear all Gun related items
  Object.keys(localStorage).forEach(key => {
    if (gunPatterns.some(pattern => key.includes(pattern))) {
      console.log(`Removing localStorage key: ${key}`);
      localStorage.removeItem(key);
      count++;
    }
  });
  console.log(`✓ Removed ${count} items from localStorage`);
  
  // 3. Clear sessionStorage
  console.log("Clearing sessionStorage...");
  sessionStorage.clear();
  console.log("✓ Session storage cleared");
  
  // 4. Report status
  console.log("\n✅ Gun.js data reset complete!");
  console.log("Please reload the page to start with a fresh database.");
}

// Make the function available in global scope
window.resetGunCompletely = resetGunCompletely;

console.log("Gun.js reset utility loaded!");
console.log("Run window.resetGunCompletely() to reset all Gun data.");