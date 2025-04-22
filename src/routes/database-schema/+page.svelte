<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeSampleData, verifySampleData, clearSampleData } from '$lib/services/sampleDataService';
  import { getGun, nodes } from '$lib/services/gunService';
  
  // Use proper Svelte 5 Runes reactive state
  let status = $state('Initializing...');
  let results = $state<Record<string, number>>({});
  let isLoading = $state(false);
  
  async function initializeData() {
    isLoading = true;
    status = 'Initializing sample data...';
    
    try {
      const result = await initializeSampleData();
      if (result.success) {
        status = 'Sample data initialized successfully.';
        await verifyData();
      } else {
        status = `Error initializing data: ${result.message}`;
      }
    } catch (error) {
      console.error('Error in initialization:', error);
      status = `Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }
  
  async function verifyData() {
    isLoading = true;
    status = 'Verifying data...';
    
    try {
      // This function will populate the console table
      const result = await verifySampleData();
      if (result.success) {
        // Fetch node counts again to display in UI
        results = await getCounts();
        
        // Check if we have proper counts and update status accordingly
        const totalNodes = Object.values(results).reduce((sum, count) => sum + count, 0);
        if (totalNodes === 0) {
          status = 'Database is empty. Click "Initialize Sample Data" to populate.';
        } else {
          status = `Data verification complete. Found ${totalNodes} total nodes.`;
        }
      } else {
        status = `Error verifying data: ${result.message}`;
      }
    } catch (error) {
      console.error('Error in verification:', error);
      status = `Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }
  
  async function clearData() {
    if (!confirm('Are you sure you want to clear all sample data? This cannot be undone.')) {
      return;
    }
    
    isLoading = true;
    status = 'Clearing sample data...';
    
    try {
      const result = await clearSampleData();
      if (result.success) {
        status = 'Sample data cleared successfully.';
        // Verify that data was cleared
        await verifyData();
      } else {
        status = `Error clearing data: ${result.message}`;
      }
    } catch (error) {
      console.error('Error in clearing data:', error);
      status = `Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }
  
  async function getCounts(): Promise<Record<string, number>> {
    const gun = getGun();
    if (!gun) {
      throw new Error('Gun not initialized');
    }
    
    // Count how many keys appear under each node
    async function count(soul: string): Promise<number> {
      return new Promise((resolve) => {
        let n = 0;
        gun?.get(soul).map().once((data, key) => {
          // Only count valid data (not null or empty)
          if (key && key !== '_' && data !== null && Object.keys(data).length > 0) {
            n++;
          }
        });
        // Use a longer timeout to ensure complete count
        setTimeout(() => resolve(n), 800);
      });
    }
    
    const nodeTypes = Object.values(nodes);
    const counts: Record<string, number> = {};
    
    for (const nodeType of nodeTypes) {
      counts[nodeType] = await count(nodeType);
    }
    
    return counts;
  }
  
  onMount(async () => {
    status = 'Ready. Click "Initialize" to populate the database.';
  });
</script>

<div class="container mx-auto p-4">
  <h1 class="text-3xl font-bold mb-6">Polycentricity Database Schema</h1>
  
  <div class="card p-4 mb-6 variant-soft">
    <h2 class="text-xl font-semibold mb-4">Gun.js Database Schema Test</h2>
    <p class="mb-4">This page initializes the optimized Gun.js schema for the Polycentricity application.</p>
    
    <div class="flex flex-wrap gap-4 mb-4">
      <button 
        class="btn variant-filled-primary" 
        onclick={initializeData} 
        disabled={isLoading && status.includes('Initializing')}>
        {isLoading && status.includes('Initializing') ? 'Initializing...' : 'Initialize Sample Data'}
      </button>
      
      <button 
        class="btn variant-filled-secondary" 
        onclick={verifyData} 
        disabled={isLoading && status.includes('Verifying')}>
        {isLoading && status.includes('Verifying') ? 'Verifying...' : 'Verify Data'}
      </button>
      
      <button 
        class="btn variant-filled-error" 
        onclick={clearData} 
        disabled={isLoading && status.includes('Clearing')}>
        {isLoading && status.includes('Clearing') ? 'Clearing...' : 'Clear All Data'}
      </button>
    </div>
    
    <div class="p-3 rounded {status.includes('Error') ? 'bg-error-500/20' : 'bg-surface-100-800-token'}">
      <p class="font-semibold">Status:</p>
      <p>{status}</p>
    </div>
  </div>
  
  {#if Object.keys(results).length > 0}
    <div class="card p-4 variant-ghost">
      <h2 class="text-xl font-semibold mb-4">Database Node Counts</h2>
      
      <div class="overflow-x-auto">
        <table class="table table-compact w-full">
          <thead>
            <tr>
              <th>Node Type</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {#each Object.entries(results) as [nodeType, count]}
              <tr>
                <td class="font-mono">{nodeType}</td>
                <td class="text-center">{count}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
  
  <div class="card p-4 mt-6 variant-ghost">
    <h2 class="text-xl font-semibold mb-4">Schema Documentation</h2>
    
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-semibold">Users</h3>
        <p class="text-sm">User accounts with roles (Guest/Member/Admin) and SEA support</p>
        <p class="text-xs text-surface-600-300-token">Path: users/&lt;user_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Values</h3>
        <p class="text-sm">Core principles like "Sustainability" or "Equity"</p>
        <p class="text-xs text-surface-600-300-token">Path: values/&lt;value_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Capabilities</h3>
        <p class="text-sm">Skills or expertise like "Permaculture Design"</p>
        <p class="text-xs text-surface-600-300-token">Path: capabilities/&lt;capability_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Cards</h3>
        <p class="text-sm">Role templates with values, capabilities, goals, etc.</p>
        <p class="text-xs text-surface-600-300-token">Path: cards/&lt;card_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Decks</h3>
        <p class="text-sm">Collections of cards for various scenarios</p>
        <p class="text-xs text-surface-600-300-token">Path: decks/&lt;deck_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Games</h3>
        <p class="text-sm">Active game sessions using a specific deck</p>
        <p class="text-xs text-surface-600-300-token">Path: games/&lt;game_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Actors</h3>
        <p class="text-sm">Instances of cards in a game, assigned to users</p>
        <p class="text-xs text-surface-600-300-token">Path: actors/&lt;actor_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Agreements</h3>
        <p class="text-sm">Formal commitments between actors with party obligations and benefits</p>
        <p class="text-xs text-surface-600-300-token">Path: agreements/&lt;agreement_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Chat Rooms</h3>
        <p class="text-sm">Group or private messaging rooms between participants</p>
        <p class="text-xs text-surface-600-300-token">Path: chat_rooms/&lt;chat_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Chat Messages</h3>
        <p class="text-sm">Individual messages exchanged in a chat room</p>
        <p class="text-xs text-surface-600-300-token">Path: chat_messages/&lt;game_id&gt;/&lt;message_id&gt;</p>
      </div>
      
      <div>
        <h3 class="text-lg font-semibold">Node Positions</h3>
        <p class="text-sm">Coordinates for graph visualization</p>
        <p class="text-xs text-surface-600-300-token">Path: node_positions/&lt;game_id&gt;/&lt;node_id&gt;</p>
      </div>
    </div>
  </div>
</div>