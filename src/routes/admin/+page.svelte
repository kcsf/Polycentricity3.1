<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from 'svelte-lucide';
  import { browser } from '$app/environment';
  import { getGun, nodes as gunNodes } from '$lib/services/gunService';
  
  // State variables
  let isMounted = false;
  let isLoading = true;
  let error: string | null = null;
  let databaseNodes: any[] = [];
  let nodeCount = 0;
  
  onMount(async () => {
    isMounted = true;
    
    // Fetch basic Gun.js database stats
    if (typeof window !== 'undefined') {
      try {
        await fetchDatabaseStats();
      } catch (err) {
        console.error('Error loading database stats:', err);
        error = 'Failed to load database information.';
      } finally {
        isLoading = false;
      }
    }
  });
  
  // Fetch basic database stats
  async function fetchDatabaseStats() {
    console.log('Fetching database stats...');
    isLoading = true;
    error = null;
    
    const gun = getGun();
    if (!gun) {
      console.error('Gun instance not initialized');
      error = 'Gun database is not initialized';
      isLoading = false;
      return;
    }
    
    // Track all nodes
    databaseNodes = [];
    nodeCount = 0;
    
    // Process each node type
    const nodeTypes = Object.values(gunNodes);
    console.log('Node types:', nodeTypes);
    
    for (const nodeType of nodeTypes) {
      console.log(`Processing node type: ${nodeType}`);
      const typeNodes: any[] = [];
      
      await new Promise<void>(resolve => {
        try {
          gun.get(nodeType).map().once((data: any, id: string) => {
            if (data) {
              typeNodes.push({
                id,
                type: nodeType,
                data
              });
            }
          });
          
          // Wait for Gun to process
          setTimeout(() => {
            console.log(`Found ${typeNodes.length} nodes of type ${nodeType}`);
            databaseNodes.push({
              type: nodeType,
              count: typeNodes.length,
              nodes: typeNodes
            });
            nodeCount += typeNodes.length;
            resolve();
          }, 500);
        } catch (err) {
          console.error(`Error processing node type ${nodeType}:`, err);
          resolve();
        }
      });
    }
    
    console.log('Database stats loaded:', databaseNodes);
    isLoading = false;
  }
</script>

<div class="admin-dashboard p-4 h-full">
  <header class="mb-4">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold">Admin Dashboard</h1>
      <div class="flex space-x-2">
        <button class="btn variant-filled-primary" on:click={fetchDatabaseStats}>
          <svelte:component this={icons.RefreshCcw} class="w-4 h-4 mr-2" />
          Refresh Data
        </button>
      </div>
    </div>
    <p class="text-surface-600 dark:text-surface-400 mt-1">
      View and manage the Gun.js database.
    </p>
  </header>
  
  <div class="card p-4 bg-white dark:bg-surface-800 shadow rounded-lg">
    <div class="tabs mb-4">
      <button class="tab variant-filled-primary">Database Overview</button>
      <button class="tab">Advanced Graph View</button>
    </div>
    
    <div class="tab-content">
      <div class="p-2">
        <div class="card p-4 bg-surface-100-800-token mb-4">
          <div class="flex items-center space-x-4">
            <svelte:component this={icons.Info} class="text-primary-500" />
            <div>
              <h3 class="h4">Database Information</h3>
              <p class="text-sm">This dashboard allows you to view and manage your Gun.js database.</p>
            </div>
          </div>
        </div>
        
        {#if isLoading}
          <div class="flex items-center justify-center p-10">
            <div class="spinner-third w-8 h-8"></div>
            <span class="ml-3">Loading Database Statistics...</span>
          </div>
        {:else if error}
          <div class="alert variant-filled-error">
            <svelte:component this={icons.AlertTriangle} class="w-5 h-5" />
            <div class="alert-message">
              <h3 class="h4">Error</h3>
              <p>{error}</p>
            </div>
            <div class="alert-actions">
              <button class="btn variant-filled" on:click={fetchDatabaseStats}>Retry</button>
            </div>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div class="card p-4 variant-filled-primary">
              <h3 class="h4 mb-2">Database Nodes</h3>
              <p class="text-4xl font-bold">{nodeCount}</p>
              <p class="text-sm opacity-80">Total nodes in database</p>
            </div>
            
            <div class="card p-4 variant-filled-secondary">
              <h3 class="h4 mb-2">Node Types</h3>
              <p class="text-4xl font-bold">{databaseNodes.length}</p>
              <p class="text-sm opacity-80">Different node types</p>
            </div>
            
            <div class="card p-4 variant-filled-tertiary">
              <h3 class="h4 mb-2">Database Status</h3>
              <p class="text-xl font-medium">
                {nodeCount > 0 ? 'Active' : 'Empty'}
              </p>
              <p class="text-sm opacity-80">
                {nodeCount > 0 ? 'Database contains data' : 'No data found in database'}
              </p>
            </div>
          </div>
          
          <h3 class="h3 mb-4">Database Structure</h3>
          
          {#if databaseNodes.length === 0}
            <div class="card p-8 variant-ghost-surface text-center">
              <svelte:component this={icons.Database} class="w-16 h-16 mx-auto mb-4 text-surface-500" />
              <h4 class="h4 mb-2">No Data Found</h4>
              <p class="text-sm max-w-lg mx-auto">
                There's no data in your Gun.js database yet. As you create games, users, and interact with 
                the application, data will start appearing here.
              </p>
              <div class="mt-4">
                <a href="/games" class="btn variant-filled-primary">Create a Game</a>
              </div>
            </div>
          {:else}
            <div class="space-y-4">
              {#each databaseNodes as nodeType}
                <div class="card p-4 variant-ghost-surface">
                  <div class="flex justify-between items-center">
                    <h4 class="font-semibold">{nodeType.type}</h4>
                    <span class="badge variant-filled">{nodeType.count} nodes</span>
                  </div>
                  
                  {#if nodeType.count > 0}
                    <div class="mt-2">
                      <div class="table-container">
                        <table class="table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each nodeType.nodes.slice(0, 5) as node}
                              <tr>
                                <td class="font-mono text-xs">{node.id.substring(0, 10)}...</td>
                                <td class="truncate max-w-md">
                                  {JSON.stringify(node.data).substring(0, 50)}...
                                </td>
                              </tr>
                            {/each}
                            {#if nodeType.nodes.length > 5}
                              <tr>
                                <td colspan="2" class="text-center text-sm text-surface-500">
                                  ...and {nodeType.nodes.length - 5} more
                                </td>
                              </tr>
                            {/if}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .admin-dashboard {
    min-height: calc(100vh - 80px);
  }
  
  .table-container {
    overflow-x: auto;
  }
</style>