<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { resetGunDatabase } from '$lib/services/gunResetService';

  let result = $state('');
  let isResetting = $state(false);

  async function resetGunDB() {
    isResetting = true;
    result = '';
    
    try {
      // Use the enhanced reset service
      result = await resetGunDatabase();
      
      // Wait 3 seconds then reload the page
      setTimeout(() => {
        window.location.reload();
      }, 3000);
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