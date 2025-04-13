<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import * as icons from 'svelte-lucide';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { getGun, nodes as gunNodes } from '$lib/services/gunService';
  import BasicCytoscapeGraph from '$lib/components/admin/BasicCytoscapeGraph.svelte';
  import DeckManager from '$lib/components/admin/DeckManager.svelte';
  import DeckBrowser from '$lib/components/admin/DeckBrowser.svelte';
  import DecksDataTable from '$lib/components/admin/DecksDataTable.svelte';
  import DatabaseMaintenance from '$lib/components/admin/DatabaseMaintenance.svelte';
  import DatabaseTools from '$lib/components/admin/DatabaseTools.svelte';
  import { cleanupUsers, removeUser, cleanupAllUsers } from '$lib/services/cleanupService';
  import { getCurrentUser } from '$lib/services/authService';
  
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
  let activeDataTab = 'users';
  
  // Cleanup variables
  let isCleanupLoading = false;
  let cleanupError: string | null = null;
  let cleanupSuccess: boolean = false;
  let cleanupResult: { success: boolean; removed: number; error?: string } | null = null;
  let currentUser = null;
  
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
    ['users', '#5B8FF9'],      // Blue
    ['games', '#5AD8A6'],      // Green
    ['cards', '#F6BD16'],      // Yellow
    ['decks', '#E8684A'],      // Red
    ['actors', '#5D7092'],     // Purple
    ['chat', '#F6BD16'],       // Yellow
    ['agreements', '#E8684A'], // Red
    ['node_positions', '#FF9D4D'], // Orange
    ['values', '#9254DE'],     // Purple
    ['capabilities', '#36CFC9'] // Teal
  ]);
  
  // Color mapping for edge types
  const EDGE_COLOR_MAP = new Map<string, string>([
    ['contains', '#E8684A'],   // Red (for deck-card relationships)
    ['default', '#b8b8b8']     // Gray (default)
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
    
    // Create edges between related nodes - more comprehensive edge detection
    databaseNodes.forEach(nodeType => {
      nodeType.nodes.forEach(node => {
        if (typeof node.data === 'object') {
          // Process properties that might be references
          Object.entries(node.data).forEach(([key, value]) => {
            // These are internal Gun.js properties or metadata fields we want to skip
            const skipFields = ['_', '#', 'created_at', 'updated_at', 'creator'];
            
            // Skip certain fields, but include more potential reference fields
            if (skipFields.includes(key)) return;
            
            // Handle string references that are actual references (not just the ID field with same name)
            if (typeof value === 'string' && value.length > 8 && !key.endsWith('_id')) {
              const targetNode = findNodeById(nodes, value);
              if (targetNode) {
                // Apply styling for edges based on node relationships
                const edgeStyle = {};
                
                // Apply special colors for certain relationships
                if (nodeType.type === 'cards' && targetNode.type === 'values') {
                  edgeStyle.stroke = '#9254DE'; // Purple for card-value relations
                  edgeStyle.lineWidth = 2;
                } else if (nodeType.type === 'cards' && targetNode.type === 'capabilities') {
                  edgeStyle.stroke = '#36CFC9'; // Teal for card-capability relations
                  edgeStyle.lineWidth = 2;
                } else {
                  edgeStyle.stroke = EDGE_COLOR_MAP.get('default'); // Default gray
                }
                
                edges.push({
                  id: `edge_${nodeType.type}_${node.id}_${targetNode.type}_${targetNode.nodeId}`,
                  source: `${nodeType.type}_${node.id}`,
                  target: `${targetNode.type}_${targetNode.nodeId}`,
                  label: key,
                  style: edgeStyle
                });
              }
            }
            
            // Handle objects with references (Gun.js {id: true} pattern)
            if (value && typeof value === 'object') {
              // Handle Gun.js soul references (#)
              if (value['#']) {
                console.log(`${nodeType.type} ${node.id} has ${key} reference with soul: ${value['#']}`);
                
                // Special case for cards <-> values relationship
                if (nodeType.type === 'values' && key === 'cards') {
                  // Find all cards and create edges to this value
                  databaseNodes.forEach(cardNodeType => {
                    if (cardNodeType.type === 'cards') {
                      cardNodeType.nodes.forEach(cardNode => {
                        // Create an edge from value to card
                        edges.push({
                          id: `edge_value_${node.id}_card_${cardNode.id}`,
                          source: `${nodeType.type}_${node.id}`,
                          target: `${cardNodeType.type}_${cardNode.id}`,
                          label: 'used by',
                          style: {
                            stroke: '#9254DE', // Purple for value-card relationship
                            lineWidth: 2
                          }
                        });
                      });
                    }
                  });
                }
                
                // Special case for cards <-> capabilities relationship
                else if (nodeType.type === 'capabilities' && key === 'cards') {
                  // Find all cards and create edges to this capability
                  databaseNodes.forEach(cardNodeType => {
                    if (cardNodeType.type === 'cards') {
                      cardNodeType.nodes.forEach(cardNode => {
                        // Create an edge from capability to card
                        edges.push({
                          id: `edge_capability_${node.id}_card_${cardNode.id}`,
                          source: `${nodeType.type}_${node.id}`,
                          target: `${cardNodeType.type}_${cardNode.id}`,
                          label: 'enabled by',
                          style: {
                            stroke: '#36CFC9', // Teal for capability-card relationship
                            lineWidth: 2
                          }
                        });
                      });
                    }
                  });
                }
                
                // Special case for decks <-> cards relationship
                else if (nodeType.type === 'decks' && key === 'cards') {
                  // Find all cards and create edges to this deck
                  databaseNodes.forEach(cardNodeType => {
                    if (cardNodeType.type === 'cards') {
                      cardNodeType.nodes.forEach(cardNode => {
                        // Create an edge from deck to card
                        edges.push({
                          id: `edge_deck_${node.id}_card_${cardNode.id}`,
                          source: `${nodeType.type}_${node.id}`,
                          target: `${cardNodeType.type}_${cardNode.id}`,
                          label: 'contains',
                          style: {
                            stroke: '#E8684A', // Red for deck-card relationship
                            lineWidth: 2
                          }
                        });
                      });
                    }
                  });
                }
                
                // Special case for cards <-> values relationship (from card side)
                else if (nodeType.type === 'cards' && key === 'values') {
                  // Find all values and create edges from this card
                  databaseNodes.forEach(valueNodeType => {
                    if (valueNodeType.type === 'values') {
                      valueNodeType.nodes.forEach(valueNode => {
                        // Create an edge from card to value
                        edges.push({
                          id: `edge_card_${node.id}_value_${valueNode.id}`,
                          source: `${nodeType.type}_${node.id}`,
                          target: `${valueNodeType.type}_${valueNode.id}`,
                          label: 'has value',
                          style: {
                            stroke: '#9254DE', // Purple for card-value relationship
                            lineWidth: 2
                          }
                        });
                      });
                    }
                  });
                }
                
                // Special case for users > decks relationships
                else if (nodeType.type === 'users' && key === 'decks') {
                  // Find all decks and create edges from this user
                  databaseNodes.forEach(deckNodeType => {
                    if (deckNodeType.type === 'decks') {
                      deckNodeType.nodes.forEach(deckNode => {
                        // Create an edge from user to deck
                        edges.push({
                          id: `edge_user_${node.id}_deck_${deckNode.id}`,
                          source: `${nodeType.type}_${node.id}`,
                          target: `${deckNodeType.type}_${deckNode.id}`,
                          label: 'created deck',
                          style: {
                            stroke: '#5B8FF9', // Blue for user-deck relationship
                            lineWidth: 2
                          }
                        });
                      });
                    }
                  });
                }
                
                // Special case for cards <-> capabilities relationship (from card side)
                else if (nodeType.type === 'cards' && key === 'capabilities') {
                  // Find all capabilities and create edges from this card
                  databaseNodes.forEach(capNodeType => {
                    if (capNodeType.type === 'capabilities') {
                      capNodeType.nodes.forEach(capNode => {
                        // Create an edge from card to capability
                        edges.push({
                          id: `edge_card_${node.id}_capability_${capNode.id}`,
                          source: `${nodeType.type}_${node.id}`,
                          target: `${capNodeType.type}_${capNode.id}`,
                          label: 'has capability',
                          style: {
                            stroke: '#36CFC9', // Teal for card-capability relationship
                            lineWidth: 2
                          }
                        });
                      });
                    }
                  });
                }
              } 
              // Standard object with key-value pairs
              else {
                Object.keys(value).forEach(refKey => {
                  // Handle special case for decks with cards as direct references
                  if (nodeType.type === 'decks' && key === 'cards') {
                    // Look for card with this ID
                    databaseNodes.forEach(cardNodeType => {
                      if (cardNodeType.type === 'cards') {
                        const matchingCard = cardNodeType.nodes.find(cardNode => cardNode.id === refKey);
                        if (matchingCard) {
                          // Create an edge from deck to card
                          edges.push({
                            id: `edge_deck_${node.id}_card_${refKey}`,
                            source: `${nodeType.type}_${node.id}`,
                            target: `${cardNodeType.type}_${refKey}`,
                            label: 'contains',
                            style: {
                              stroke: '#E8684A', // Color for deck-card relationship
                              lineWidth: 2
                            }
                          });
                        }
                      }
                    });
                  }
                  // Standard reference handling
                  else if (value[refKey] === true) {
                    const targetNode = findNodeById(nodes, refKey);
                    if (targetNode) {
                      // Apply styling for edges based on node relationships
                      const edgeStyle = {};
                      
                      // Apply special colors for certain relationships
                      if (nodeType.type === 'cards' && targetNode.type === 'values') {
                        edgeStyle.stroke = '#9254DE'; // Purple for card-value relations
                        edgeStyle.lineWidth = 2;
                      } else if (nodeType.type === 'cards' && targetNode.type === 'capabilities') {
                        edgeStyle.stroke = '#36CFC9'; // Teal for card-capability relations
                        edgeStyle.lineWidth = 2;
                      } else if (nodeType.type === 'decks' && key === 'cards') {
                        edgeStyle.stroke = '#E8684A'; // Red for deck-card relations
                        edgeStyle.lineWidth = 2;
                      } else {
                        edgeStyle.stroke = EDGE_COLOR_MAP.get('default'); // Default gray
                      }
                      
                      edges.push({
                        id: `edge_${nodeType.type}_${node.id}_${targetNode.type}_${targetNode.nodeId}_${key}`,
                        source: `${nodeType.type}_${node.id}`,
                        target: `${targetNode.type}_${targetNode.nodeId}`,
                        label: key,
                        style: edgeStyle
                      });
                    }
                  }
                });
              }
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
      case 'values':
        return node.data.name || `Value ${node.id.substring(0, 6)}`;
      case 'capabilities':
        return node.data.name || `Capability ${node.id.substring(0, 6)}`;
      case 'cards':
        return node.data.role_title || `Card ${node.id.substring(0, 6)}`;
      default:
        return `${nodeType} ${node.id.substring(0, 6)}`;
    }
  }
  
  function findNodeById(nodes: any[], id: string): any {
    return nodes.find(n => n.nodeId === id);
  }
  
  // Delete a node from the database
  async function deleteNode(nodeType: string, nodeId: string) {
    try {
      const gun = getGun();
      
      if (!gun) {
        error = 'Gun not initialized';
        return;
      }
      
      // Set the node to null to delete it
      gun.get(nodeType).get(nodeId).put(null, async (ack: any) => {
        if (ack.err) {
          console.error(`Error deleting ${nodeType} node:`, ack.err);
          error = `Failed to delete ${nodeType} node: ${ack.err}`;
        } else {
          console.log(`Deleted ${nodeType} node: ${nodeId}`);
          // Wait a moment then refresh the database stats
          await tick();
          fetchDatabaseStats();
        }
      });
    } catch (err) {
      console.error(`Delete ${nodeType} node error:`, err);
      error = err instanceof Error ? err.message : String(err);
    }
  }
  
  // Tab switching
  function handleTabChange(tab: string) {
    activeTab = tab;
    
    if (tab === 'visualize' && typeof window !== 'undefined') {
      // Prepare graph data when switching to visualization tab
      loadGraphVisualization();
    }
    
    // Update URL with tab parameter
    if (browser) {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('tab', tab);
      const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }
  
  function handleDataTabChange(tab: string) {
    activeDataTab = tab;
  }
  
  // Database cleanup functions
  async function performCleanup() {
    if (!confirm('WARNING: This action will permanently remove all user nodes from the database except your own. This cannot be undone. Are you sure you want to continue?')) {
      return;
    }
    
    isCleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    cleanupResult = null;
    
    try {
      const result = await cleanupUsers();
      cleanupResult = result;
      cleanupSuccess = result.success;
      if (!result.success) {
        cleanupError = result.error || 'Unknown error during cleanup';
      }
    } catch (err) {
      console.error('Error cleaning up users:', err);
      cleanupError = err instanceof Error ? err.message : String(err);
      cleanupSuccess = false;
    } finally {
      isCleanupLoading = false;
      // Refresh stats after cleanup
      fetchDatabaseStats();
    }
  }
  
  async function removeSpecificUser(userId: string) {
    if (!confirm(`Are you sure you want to remove user ${userId}? This cannot be undone.`)) {
      return;
    }
    
    try {
      const result = await removeUser(userId);
      if (result.success) {
        // Refresh stats after removing user
        fetchDatabaseStats();
      } else {
        alert(`Error removing user: ${result.error}`);
      }
    } catch (err) {
      console.error('Error removing user:', err);
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Function to remove all users (no login required)
  async function performCleanupAllUsers() {
    if (!confirm('WARNING: This action will permanently remove ALL user nodes from the database. This is an admin function that does not require login. This cannot be undone. Are you sure you want to continue?')) {
      return;
    }
    
    isCleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    cleanupResult = null;
    
    try {
      const result = await cleanupAllUsers();
      cleanupResult = result;
      cleanupSuccess = result.success;
      if (!result.success) {
        cleanupError = result.error || 'Unknown error during cleanup';
      }
    } catch (err) {
      console.error('Error cleaning up all users:', err);
      cleanupError = err instanceof Error ? err.message : String(err);
      cleanupSuccess = false;
    } finally {
      isCleanupLoading = false;
      // Refresh stats after cleanup
      fetchDatabaseStats();
    }
  }
  
  onMount(async () => {
    isMounted = true;
    
    // Fetch basic Gun.js database stats
    if (typeof window !== 'undefined') {
      try {
        await fetchDatabaseStats();
        
        // Check for URL parameters to set initial tab
        if (browser) {
          const urlParams = new URLSearchParams(window.location.search);
          const tabParam = urlParams.get('tab');
          const deckIdParam = urlParams.get('deckId');
          
          // If deckId is present, switch to overview tab
          if (deckIdParam) {
            activeTab = 'overview';
          } 
          // Otherwise use the tab parameter if present
          else if (tabParam) {
            activeTab = tabParam;
          }
          
          // Initialize visualization if needed
          if (activeTab === 'visualize') {
            loadGraphVisualization();
          }
        }
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
  
  <div class="card p-0 bg-surface-50-900 shadow rounded-lg overflow-hidden border border-surface-300-600">
    <div class="admin-tabs">
      <button 
        class="admin-tab {activeTab === 'overview' ? 'active' : ''}" 
        on:click={() => handleTabChange('overview')}
      >
        <svelte:component this={icons.Eye} class="w-4 h-4 mr-2" />
        Overview
      </button>
      <button 
        class="admin-tab {activeTab === 'data' ? 'active' : ''}" 
        on:click={() => handleTabChange('data')}
      >
        <svelte:component this={icons.Database} class="w-4 h-4 mr-2" />
        Data
      </button>
      <button 
        class="admin-tab {activeTab === 'decks' ? 'active' : ''}" 
        on:click={() => handleTabChange('decks')}
      >
        <svelte:component this={icons.Cards} class="w-4 h-4 mr-2" />
        Decks
      </button>
      <button 
        class="admin-tab {activeTab === 'visualize' ? 'active' : ''}" 
        on:click={() => handleTabChange('visualize')}
      >
        <svelte:component this={icons.Network} class="w-4 h-4 mr-2" />
        Visualize
      </button>
      <button 
        class="admin-tab {activeTab === 'maintenance' ? 'active' : ''}" 
        on:click={() => handleTabChange('maintenance')}
      >
        <svelte:component this={icons.Wrench} class="w-4 h-4 mr-2" />
        Maintenance
      </button>
    </div>
    
    <div class="p-4">
    
    <div class="tab-content">
      {#if activeTab === 'visualize'}
        <div class="p-2">
          <div class="card p-4 bg-surface-100-800 border border-surface-300-600 mb-4">
            <div class="flex items-center space-x-4">
              <svelte:component this={icons.Network} class="text-primary-500" />
              <div>
                <h3 class="h4 text-surface-900-50">Database Visualization</h3>
                <p class="text-sm text-surface-700-300">This interactive graph shows the nodes and relationships in your Gun.js database.</p>
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
            <div class="card p-4 bg-surface-200-800 border border-surface-300-600">
              <div class="visualization-section">
                <div class="mb-4 p-4 bg-surface-100-800 border border-surface-300-600 rounded">
                  <p class="text-sm text-surface-700-300">
                    Visualizing {graphData.nodes.length} nodes and {graphData.edges.length} edges with Cytoscape.
                  </p>
                </div>
                
                <BasicCytoscapeGraph nodes={graphData.nodes} edges={graphData.edges} />
                
                <div class="graph-stats mt-4 p-4 bg-surface-100-800 border border-surface-300-600 rounded">
                  <h4 class="font-semibold mb-2 text-surface-900-50">Database Overview</h4>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="p-3 rounded bg-surface-50-900 border border-surface-300-600">
                      <h5 class="text-sm font-semibold text-surface-900-50">Most Connected Nodes</h5>
                      <ul class="mt-2 space-y-1 text-sm">
                        {#each graphData.nodes.slice(0, 5) as node}
                          <li class="flex items-center">
                            <span class="w-2 h-2 mr-2 rounded-full" style="background-color: {node.style?.fill || '#5B8FF9'}"></span>
                            <span class="truncate">{node.label || node.id.substring(0, 10)}</span>
                          </li>
                        {/each}
                      </ul>
                    </div>
                    <div class="p-3 rounded bg-surface-50-900 border border-surface-300-600">
                      <h5 class="text-sm font-semibold text-surface-900-50">Node Type Distribution</h5>
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
              
              <div class="graph-legend mt-4 p-3 bg-surface-100-800 border border-surface-300-600 rounded-lg">
                <h5 class="font-semibold mb-2 text-surface-900-50">Node Types</h5>
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
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#F6BD16]"></span>
                    <span class="text-sm">Cards</span>
                  </div>
                  <div class="flex items-center">
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#E8684A]"></span>
                    <span class="text-sm">Decks</span>
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
                  <div class="flex items-center">
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#FF9D4D]"></span>
                    <span class="text-sm">Node Positions</span>
                  </div>
                  <div class="flex items-center">
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#9254DE]"></span>
                    <span class="text-sm">Values</span>
                  </div>
                  <div class="flex items-center">
                    <span class="w-3 h-3 mr-2 rounded-full bg-[#36CFC9]"></span>
                    <span class="text-sm">Capabilities</span>
                  </div>
                </div>
                
                <h5 class="font-semibold mb-2 mt-4">Relationship Types</h5>
                <div class="flex flex-wrap gap-3">
                  <div class="flex items-center">
                    <div class="w-8 h-0.5 mr-2 bg-[#b8b8b8]"></div>
                    <span class="text-sm">Standard Relationship</span>
                  </div>
                  <div class="flex items-center">
                    <div class="w-8 h-1 mr-2 bg-[#E8684A]"></div>
                    <span class="text-sm">Deck Contains Card</span>
                  </div>
                  <div class="flex items-center">
                    <div class="w-8 h-1 mr-2 bg-[#9254DE]"></div>
                    <span class="text-sm">Card Has Value</span>
                  </div>
                  <div class="flex items-center">
                    <div class="w-8 h-1 mr-2 bg-[#36CFC9]"></div>
                    <span class="text-sm">Card Has Capability</span>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      
      {:else if activeTab === 'decks'}
        <div class="p-2">
          <!-- Render the DeckBrowser component -->
          <DeckBrowser />
        </div>
      {:else if activeTab === 'maintenance'}
        <!-- Render the DatabaseMaintenance component -->
        <DatabaseMaintenance />
      {:else if activeTab === 'data'}
        <div class="p-2">
          <div class="card p-4 bg-surface-100-800 border border-surface-300-600 mb-4">
            <div class="flex items-center space-x-4">
              <svelte:component this={icons.Database} class="text-primary-500" />
              <div>
                <h3 class="h4 text-surface-900-50">Database Data</h3>
                <p class="text-sm text-surface-700-300">Browse and explore the raw data stored in your Gun.js database.</p>
              </div>
            </div>
          </div>
          
          {#if isLoading}
            <div class="flex items-center justify-center p-10">
              <div class="spinner-third w-8 h-8"></div>
              <span class="ml-3">Loading Database Data...</span>
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
            <!-- Inner tabs for data types -->
            <div class="card p-4 bg-surface-200-800 border border-surface-300-600">
              <div class="data-tabs mb-4">
                {#each databaseNodes as nodeType}
                  <button 
                    class="data-tab {activeDataTab === nodeType.type ? 'active' : ''}" 
                    on:click={() => handleDataTabChange(nodeType.type)}
                  >
                    <span class="w-3 h-3 mr-2 rounded-full" style="background-color: {getColorForNodeType(nodeType.type)}"></span>
                    {nodeType.type}
                    <span class="badge ml-2">{nodeType.count}</span>
                  </button>
                {/each}
              </div>
              
              <!-- Data table for the selected type -->
              {#if databaseNodes.length === 0}
                <div class="p-8 text-center">
                  <p class="text-surface-500">No data available</p>
                </div>
              {:else if activeDataTab === 'decks'}
                <!-- Special handling for decks with our enhanced component -->
                <DecksDataTable refreshTrigger={nodeCount} />
              {:else}
                {#each databaseNodes.filter(n => n.type === activeDataTab) as nodeType}
                  {#if nodeType.count === 0}
                    <div class="p-8 text-center">
                      <p class="text-surface-500">No {nodeType.type} nodes found</p>
                    </div>
                  {:else}
                    <div class="table-container">
                      <table class="table table-compact table-hover table-interactive">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Properties</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each nodeType.nodes as node}
                            <tr>
                              <td class="font-mono text-xs">{node.id.substring(0, 12)}...</td>
                              <td>
                                <div class="max-h-32 overflow-y-auto text-xs">
                                  {#if typeof node.data === 'object'}
                                    {#each Object.entries(node.data).filter(([key]) => !['_', '#'].includes(key)) as [key, value]}
                                      <div class="mb-1">
                                        <span class="font-semibold">{key}:</span> 
                                        {#if typeof value === 'object'}
                                          {JSON.stringify(value)}
                                        {:else}
                                          {String(value)}
                                        {/if}
                                      </div>
                                    {/each}
                                  {:else}
                                    <span class="text-surface-500">No structured data</span>
                                  {/if}
                                </div>
                              </td>
                              <td>
                                {#if node.data?.created_at}
                                  {new Date(node.data.created_at).toLocaleDateString()}
                                {:else}
                                  -
                                {/if}
                              </td>
                              <td>
                                <button 
                                  class="delete-button"
                                  on:click={() => {
                                    if (confirm(`Are you sure you want to delete this ${nodeType.type.slice(0, -1)} with ID "${node.id}"? This cannot be undone.`)) {
                                      deleteNode(nodeType.type, node.id);
                                    }
                                  }}
                                  title="Delete {nodeType.type.slice(0, -1)}"
                                >
                                  <span>❌</span>
                                </button>
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  {/if}
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <div class="p-2">
          <div class="card p-4 bg-surface-100-800 border border-surface-300-600 mb-4">
            <div class="flex items-center space-x-4">
              <svelte:component this={icons.Info} class="text-primary-500" />
              <div>
                <h3 class="h4 text-surface-900-50">Database Information</h3>
                <p class="text-sm text-surface-700-300">This dashboard allows you to view and manage your Gun.js database.</p>
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
            
            <!-- Database tools moved to Maintenance tab -->
            
            <h3 class="h3 mb-4">Database Structure</h3>
            
            {#if databaseNodes.length === 0}
              <div class="card p-8 bg-surface-200-800 border border-surface-300-600 text-center">
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
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#each databaseNodes as nodeType}
                  <div class="card p-4 bg-surface-200-800 border border-surface-300-600">
                    <div class="flex justify-between items-center mb-3">
                      <h4 class="font-semibold flex items-center">
                        <span class="w-3 h-3 mr-2 rounded-full" style="background-color: {getColorForNodeType(nodeType.type)}"></span>
                        {nodeType.type}
                      </h4>
                      <span class="badge variant-filled">{nodeType.count} nodes</span>
                    </div>
                    
                    <div class="mb-2">
                      <h5 class="text-sm font-semibold mb-1 text-surface-900-50">Schema Structure</h5>
                      <div class="bg-surface-100-800 border border-surface-300-600 p-2 rounded font-mono text-xs">
                        {#if nodeType.count > 0 && nodeType.nodes[0].data}
                          {#each Object.keys(typeof nodeType.nodes[0].data === 'object' ? nodeType.nodes[0].data : {}) as key}
                            <div><span class="text-primary-500">{key}</span>: {typeof nodeType.nodes[0].data[key]}</div>
                          {/each}
                        {:else}
                          <div class="text-surface-500">No schema information available</div>
                        {/if}
                      </div>
                    </div>
                    
                    <div>
                      <h5 class="text-sm font-semibold mb-1 text-surface-900-50">Relationships</h5>
                      <div class="bg-surface-100-800 border border-surface-300-600 p-2 rounded">
                        {#if nodeType.type === 'users'}
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-[#5AD8A6]"></span>
                            <span class="text-xs">User belongs to many Games</span>
                          </div>
                        {:else if nodeType.type === 'games'}
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-[#5B8FF9]"></span>
                            <span class="text-xs">Game has many Users</span>
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="w-2 h-2 rounded-full bg-[#5D7092]"></span>
                            <span class="text-xs">Game has many Actors</span>
                          </div>
                        {:else if nodeType.type === 'chat'}
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-[#5B8FF9]"></span>
                            <span class="text-xs">Chat belongs to Users</span>
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="w-2 h-2 rounded-full bg-[#5AD8A6]"></span>
                            <span class="text-xs">Chat belongs to Game</span>
                          </div>
                        {:else if nodeType.type === 'actors'}
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-[#5AD8A6]"></span>
                            <span class="text-xs">Actor belongs to Game</span>
                          </div>
                        {:else if nodeType.type === 'agreements'}
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-[#5AD8A6]"></span>
                            <span class="text-xs">Agreement belongs to Game</span>
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="w-2 h-2 rounded-full bg-[#5D7092]"></span>
                            <span class="text-xs">Agreement involves Actors</span>
                          </div>
                        {:else if nodeType.type === 'cards'}
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-[#E8684A]"></span>
                            <span class="text-xs">Card belongs to Decks</span>
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="w-2 h-2 rounded-full bg-[#9254DE]"></span>
                            <span class="text-xs">Card has Values</span>
                          </div>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="w-2 h-2 rounded-full bg-[#36CFC9]"></span>
                            <span class="text-xs">Card has Capabilities</span>
                          </div>
                        {:else if nodeType.type === 'decks'}
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-[#F6BD16]"></span>
                            <span class="text-xs">Deck contains Cards</span>
                          </div>
                        {:else}
                          <div class="text-surface-500 text-xs">No defined relationships</div>
                        {/if}
                      </div>
                    </div>
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
</div>

<style>
  .admin-dashboard {
    min-height: calc(100vh - 80px);
  }
  
  .table-container {
    overflow-x: auto;
    max-width: 100%;
  }
  
  .table-container td {
    vertical-align: top;
    max-width: 500px;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
  }
  
  .admin-tabs {
    display: flex;
    background: var(--color-surface-200-700);
    position: relative;
    border-bottom: 1px solid var(--color-surface-300-600);
  }
  
  .admin-tab {
    display: flex;
    align-items: center;
    padding: 0.75rem 1.25rem;
    font-weight: 500;
    position: relative;
    transition: all 0.2s ease-in-out;
    border-right: 1px solid var(--color-surface-300-600);
    color: var(--color-surface-700-300);
    background: transparent;
    border-radius: 0;
  }
  
  .admin-tab:hover {
    color: var(--color-primary-500);
    background-color: var(--color-surface-100-800);
  }
  
  .admin-tab.active {
    color: var(--color-primary-500);
    background-color: var(--color-surface-50-900);
    border-top: 3px solid var(--color-primary-500);
    padding-top: calc(0.75rem - 3px);
  }
  
  .admin-tab.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 1px;
    background-color: var(--color-surface-50-900);
  }
  
  /* Data tab styles */
  .data-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-bottom: 1px solid var(--color-surface-300-600);
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .data-tab {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
    background-color: var(--color-surface-200-700);
    color: var(--color-surface-700-300);
  }
  
  .data-tab:hover {
    background-color: var(--color-surface-300-600);
  }
  
  .data-tab.active {
    color: white;
    background-color: var(--color-primary-500);
  }
  
  .data-tab.active .badge {
    background-color: rgba(255, 255, 255, 0.3);
    color: white;
  }
  
  .delete-button {
    background-color: #ef4444;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }
  
  .delete-button:hover {
    background-color: #dc2626;
  }
</style>