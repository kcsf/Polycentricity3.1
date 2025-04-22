<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let result = $state('');
  let isResetting = $state(false);

  function resetGunDB() {
    isResetting = true;
    result = '';
    
    try {
      // 1. Drop Radisk / Gun IndexedDB stores
      result += "Attempting to delete IndexedDB databases...\n";
      
      const deleteRadiskPromise = new Promise<void>((resolve) => {
        const radiskRequest = indexedDB.deleteDatabase('radisk');
        radiskRequest.onsuccess = () => {
          result += "✓ Successfully deleted 'radisk' database\n";
          resolve();
        };
        radiskRequest.onerror = () => {
          result += "⚠️ Error deleting 'radisk' database\n";
          resolve();
        };
      });
      
      const deleteGunPromise = new Promise<void>((resolve) => {
        const gunRequest = indexedDB.deleteDatabase('gun');
        gunRequest.onsuccess = () => {
          result += "✓ Successfully deleted 'gun' database\n";
          resolve();
        };
        gunRequest.onerror = () => {
          result += "⚠️ Error deleting 'gun' database\n";
          resolve();
        };
      });
      
      // 2. Clear localStorage entries related to Gun
      result += "Clearing localStorage entries...\n";
      localStorage.removeItem('gun'); // default Gun cache key
      localStorage.removeItem('gun/user'); // stored user session
      
      // Clear any Gun-related entries
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('gun/') || 
          key.includes('sea') || 
          key.startsWith('~@') || 
          key.startsWith('~')
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      result += `✓ Removed ${keysToRemove.length} Gun-related items from localStorage\n`;
      
      // Clear session storage
      sessionStorage.clear();
      result += "✓ Cleared session storage\n";
      
      // Wait for IndexedDB operations to complete
      Promise.all([deleteRadiskPromise, deleteGunPromise]).then(() => {
        result += "\nDatabase reset complete! Page will reload in 3 seconds...\n";
        
        setTimeout(() => {
          // 3. Reload the page to start fresh
          window.location.reload();
        }, 3000);
      });
    } catch (error) {
      result += `Error during reset: ${error}\n`;
      isResetting = false;
    }
  }
</script>

<div class="container mx-auto py-10 px-4">
  <div class="card p-6 max-w-3xl mx-auto">
    <header class="card-header">
      <h1 class="h1 text-center mb-2">Reset Gun.js Database</h1>
      <p class="text-center opacity-70">This will completely reset the Gun.js database and clear all stored data</p>
    </header>
    
    <section class="p-4">
      <div class="flex flex-col items-center space-y-6">
        <div class="alert variant-ghost-warning w-full">
          <div class="alert-message">
            <p><strong>Warning:</strong> This operation will delete all data stored in Gun.js, including user accounts and application data. This action cannot be undone!</p>
          </div>
        </div>
        
        <div class="flex gap-4">
          <button 
            class="btn variant-filled-error"
            disabled={isResetting} 
            onclick={resetGunDB}
          >
            {isResetting ? 'Resetting...' : 'Reset Database'}
          </button>
          
          <a href="/" class="btn variant-ghost-surface">
            Cancel
          </a>
        </div>
        
        {#if result}
          <div class="card p-4 w-full">
            <h3 class="h4">Results</h3>
            <pre class="bg-surface-700 p-4 rounded whitespace-pre-wrap mt-2">{result}</pre>
          </div>
        {/if}
      </div>
    </section>
  </div>
</div>