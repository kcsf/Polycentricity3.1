<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as icons from 'svelte-lucide';
  import { browser } from '$app/environment';
  import { getGun, nodes as gunNodes } from '$lib/services/gunService';
  import FallbackGraph from '$lib/components/admin/FallbackGraph.svelte';
  
  // For visualization
  let isG6Loading = false;
  let g6Error: string | null = null;
  let graphData = { nodes: [], edges: [] };
  // No longer needed with the G6Graph component
  // let graphContainer: HTMLElement;
  
  // State variables
  let isMounted = false;
  let isLoading = true;
  let error: string | null = null;
  let databaseNodes: any[] = [];
  let nodeCount = 0;
  let activeTab = 'overview';
  
  // Simplified visualization loading
  function loadGraphVisualization() {
    isG6Loading = true;
    g6Error = null;
    
    try {
      // Prepare graph data
      prepareGraphData();
      isG6Loading = false;
    } catch (err) {
      console.error('Error preparing graph data:', err);
      g6Error = `Failed to prepare graph data: ${err}`;
      isG6Loading = false;
    }
  }
  
  // Get color for node type
  function getColorForNodeType(type: string): string {
    return COLOR_MAP.get(type) || '#5B8FF9';
  }
  
  // Color mapping for different node types
  const COLOR_MAP = new Map<string, string>([
    ['users', '#5B8FF9'],
    ['games', '#5AD8A6'],
    ['actors', '#5D7092'],
    ['chat', '#F6BD16'],
    ['agreements', '#E8684A'],
    ['obligations', '#6DC8EC'],
    ['benefits', '#9270CA'],
    ['node_positions', '#FF9D4D']
  ]);
  
  // Prepare graph data from the database nodes
  function prepareGraphData() {
    const nodes: any[] = [];
    const edges: any[] = [];
    
    // Use the color map for consistency
    const colorMap = COLOR_MAP;
    
    // Process each node type
    databaseNodes.forEach(nodeType => {
      const color = colorMap.get(nodeType.type) || '#5B8FF9';
      
      // Add nodes
      nodeType.nodes.forEach(node => {
        nodes.push({
          id: `${nodeType.type}_${node.id}`,
          nodeId: node.id,
          type: nodeType.type,
          label: getLabelForNode(node, nodeType.type),
          style: {
            fill: color,
            stroke: color
          },
          data: node.data
        });
      });
    });
    
    // Create edges between related nodes
    databaseNodes.forEach(nodeType => {
      nodeType.nodes.forEach(node => {
        if (typeof node.data === 'object') {
          // Process properties that might be references
          Object.entries(node.data).forEach(([key, value]) => {
            if (key === '_' || key === '#' || key === 'id') return;
            
            // Handle string references
            if (typeof value === 'string' && value.length > 8) {
              const targetNode = findNodeById(nodes, value);
              if (targetNode) {
                edges.push({
                  id: `edge_${nodeType.type}_${node.id}_${targetNode.type}_${targetNode.nodeId}`,
                  source: `${nodeType.type}_${node.id}`,
                  target: `${targetNode.type}_${targetNode.nodeId}`,
                  label: key
                });
              }
            }
            
            // Handle objects with references (Gun.js {id: true} pattern)
            if (value && typeof value === 'object') {
              Object.keys(value).forEach(refKey => {
                if (value[refKey] === true) {
                  const targetNode = findNodeById(nodes, refKey);
                  if (targetNode) {
                    edges.push({
                      id: `edge_${nodeType.type}_${node.id}_${targetNode.type}_${targetNode.nodeId}_${key}`,
                      source: `${nodeType.type}_${node.id}`,
                      target: `${targetNode.type}_${targetNode.nodeId}`,
                      label: key
                    });
                  }
                }
              });
            }
          });
        }
      });
    });
    
    graphData = { nodes, edges };
    console.log('Graph data prepared:', graphData);
  }
  
  // Helper functions for graph data preparation
  function getLabelForNode(node: any, nodeType: string): string {
    if (typeof node.data !== 'object') {
      return node.id.substring(0, 8);
    }
    
    // Try to find a good property to use as label based on node type
    switch (nodeType) {
      case 'users':
        return node.data.name || node.data.email || node.id.substring(0, 8);
      case 'games':
        return node.data.name || `Game ${node.id.substring(0, 6)}`;
      case 'actors':
        return node.data.role_title || `Actor ${node.id.substring(0, 6)}`;
      case 'chat':
        return `Chat ${node.id.substring(0, 6)}`;
      default:
        return `${nodeType} ${node.id.substring(0, 6)}`;
    }
  }
  
  function findNodeById(nodes: any[], id: string): any {
    return nodes.find(n => n.nodeId === id);
  }
  
  // Tab switching
  function handleTabChange(tab: string) {
    activeTab = tab;
    
    if (tab === 'visualize' && typeof window !== 'undefined') {
      // Prepare graph data when switching to visualization tab
      loadGraphVisualization();
    }
  }
  
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
      <button 
        class="tab {activeTab === 'overview' ? 'variant-filled-primary' : 'variant-ghost'}" 
        on:click={() => handleTabChange('overview')}
      >
        Database Overview
      </button>
      <button 
        class="tab {activeTab === 'visualize' ? 'variant-filled-primary' : 'variant-ghost'}" 
        on:click={() => handleTabChange('visualize')}
      >
        Visualize
      </button>
    </div>
    
    <div class="tab-content">
      {#if activeTab === 'visualize'}
        <div class="p-2">
          <div class="card p-4 bg-surface-100-800-token mb-4">
            <div class="flex items-center space-x-4">
              <svelte:component this={icons.Network} class="text-primary-500" />
              <div>
                <h3 class="h4">Database Visualization</h3>
                <p class="text-sm">This interactive graph shows the nodes and relationships in your Gun.js database.</p>
              </div>
            </div>
          </div>
          
          {#if isG6Loading}
            <div class="flex items-center justify-center p-10">
              <div class="spinner-third w-8 h-8"></div>
              <span class="ml-3">Loading Graph Visualization...</span>
            </div>
          {:else if g6Error}
            <div class="alert variant-filled-error">
              <svelte:component this={icons.AlertTriangle} class="w-5 h-5" />
              <div class="alert-message">
                <h3 class="h4">Error</h3>
                <p>{g6Error}</p>
              </div>
              <div class="alert-actions">
                <button class="btn variant-filled" on:click={loadGraphVisualization}>Retry</button>
              </div>
            </div>
          {:else}
            <div class="card p-4 bg-surface-50-900-token">
              <div class="visualization-section">
                <div class="mb-4 p-4 bg-surface-100-800-token rounded">
                  <p class="text-sm">
                    Visualizing {graphData.nodes.length} nodes and {graphData.edges.length} edges with G6.
                  </p>
                </div>
                
                <FallbackGraph nodes={graphData.nodes} edges={graphData.edges} />
                
                <div class="graph-stats mt-4 p-4 bg-surface-100-800-token rounded">
                  <h4 class="font-semibold mb-2">Database Overview</h4>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="p-3 rounded bg-surface-50-900-token">
                      <h5 class="text-sm font-semibold">Most Connected Nodes</h5>
                      <ul class="mt-2 space-y-1 text-sm">
                        {#each graphData.nodes.slice(0, 5) as node}
                          <li class="flex items-center">
                            <span class="w-2 h-2 mr-2 rounded-full" style="background-color: {node.style?.fill || '#5B8FF9'}"></span>
                            <span class="truncate">{node.label || node.id.substring(0, 10)}</span>
                          </li>
                        {/each}
                      </ul>
                    </div>
                    <div class="p-3 rounded bg-surface-50-900-token">
                      <h5 class="text-sm font-semibold">Node Type Distribution</h5>
                      <ul class="mt-2 space-y-1 text-sm">
                        {#each databaseNodes as nodeType}
                          <li class="flex items-center justify-between">
                            <div class="flex items-center">
                              <span class="w-2 h-2 mr-2 rounded-full" style="background-color: {getColorForNodeType(nodeType.type)}"></span>
                              <span>{nodeType.type}</span>
                            </div>
                            <span class="font-mono">{nodeType.count}</span>
                          </li>
                        {/each}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="graph-legend mt-4 p-3 bg-surface-100-800-token rounded-lg">
                <h5 class="font-semibold mb-2">Node Types</h5>
                <div class="flex flex-wrap gap-3">
                  <div class="flex items-center">
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#5B8FF9]"></span>
                    <span class="text-sm">Users</span>
                  </div>
                  <div class="flex items-center">
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#5AD8A6]"></span>
                    <span class="text-sm">Games</span>
                  </div>
                  <div class="flex items-center">
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#5D7092]"></span>
                    <span class="text-sm">Actors</span>
                  </div>
                  <div class="flex items-center">
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#F6BD16]"></span>
                    <span class="text-sm">Chat</span>
                  </div>
                  <div class="flex items-center">
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#E8684A]"></span>
                    <span class="text-sm">Agreements</span>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {:else}
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
      {/if}
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