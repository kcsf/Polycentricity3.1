<script lang="ts">
  import { tick } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';
  import { getGun, nodes as gunNodes } from '$lib/services/gunService';
  import BasicCytoscapeGraph from '$lib/components/admin/BasicCytoscapeGraph.svelte';
  import DeckManager from '$lib/components/admin/DeckManager.svelte';
  import DeckBrowser from '$lib/components/admin/DeckBrowser.svelte';
  import DecksDataTable from '$lib/components/admin/DecksDataTable.svelte';
  import GamesDataTable from '$lib/components/admin/GamesDataTable.svelte';
  import DatabaseMaintenance from '$lib/components/admin/DatabaseMaintenance.svelte';
  import DatabaseTools from '$lib/components/admin/DatabaseTools.svelte';
  import AdminTools from '$lib/components/admin/AdminTools.svelte';
  import { cleanupUsers, removeUser, cleanupAllUsers } from '$lib/services/cleanupService';
  import { getCurrentUser } from '$lib/services/authService';
  import { deleteAgreement } from '$lib/services/gameService';

  // Define interfaces for type safety
  interface NodeData {
    id: string;
    type: string;
    data: Record<string, any>;
  }

  interface DatabaseNodeGroup {
    type: string;
    count: number;
    nodes: NodeData[];
  }

  interface EdgeStyle {
    stroke?: string;
    lineWidth?: number;
  }

  interface GraphNode {
    id: string;
    nodeId: string;
    type: string;
    label: string;
    style: { fill: string; stroke: string };
    data: Record<string, any>;
  }

  interface GraphEdge {
    id: string;
    source: string;
    target: string;
    label: string;
    style: EdgeStyle;
  }

  // State variables with explicit types
  let isG6Loading = $state<boolean>(false);
  let g6Error = $state<string | null>(null);
  let graphData = $state<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  let isMounted = $state<boolean>(false);
  let isLoading = $state<boolean>(true);
  let error = $state<string | null>(null);
  let databaseNodes = $state<DatabaseNodeGroup[]>([]);
  let nodeCount = $state<number>(0);
  let activeTab = $state<string>('overview');
  let activeDataTab = $state<string>('users');
  let isCleanupLoading = $state<boolean>(false);
  let cleanupError = $state<string | null>(null);
  let cleanupSuccess = $state<boolean>(false);
  let cleanupResult = $state<{ success: boolean; removed: number; error?: string } | null>(null);
  let currentUser = $state<any>(null);

  // Load graph visualization
  function loadGraphVisualization() {
    isG6Loading = true;
    g6Error = null;
    try {
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

  // Color mappings
  const COLOR_MAP = new Map<string, string>([
    ['users', '#5B8FF9'],
    ['games', '#5AD8A6'],
    ['cards', '#F6BD16'],
    ['decks', '#E8684A'],
    ['actors', '#5D7092'],
    ['chat', '#F6BD16'],
    ['agreements', '#E8684A'],
    ['node_positions', '#FF9D4D'],
    ['values', '#9254DE'],
    ['capabilities', '#36CFC9'],
  ]);

  const EDGE_COLOR_MAP = new Map<string, string>([
    ['contains', '#E8684A'],
    ['default', '#b8b8b8'],
  ]);

  // Prepare graph data
  function prepareGraphData() {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    databaseNodes.forEach((nodeType) => {
      const color = COLOR_MAP.get(nodeType.type) || '#5B8FF9';
      nodeType.nodes.forEach((node: NodeData) => {
        nodes.push({
          id: `${nodeType.type}_${node.id}`,
          nodeId: node.id,
          type: nodeType.type,
          label: getLabelForNode(node, nodeType.type),
          style: { fill: color, stroke: color },
          data: node.data,
        });
      });
    });

    databaseNodes.forEach((nodeType) => {
      nodeType.nodes.forEach((node: NodeData) => {
        if (typeof node.data === 'object') {
          Object.entries(node.data).forEach(([key, value]) => {
            const skipFields = ['_', '#', 'created_at', 'updated_at', 'creator'];
            if (skipFields.includes(key)) return;

            if (typeof value === 'string' && value.length > 8 && !key.endsWith('_id')) {
              const targetNode = findNodeById(nodes, value);
              if (targetNode) {
                const edgeStyle: EdgeStyle = {
                  stroke: EDGE_COLOR_MAP.get('default'),
                };
                if (nodeType.type === 'cards' && targetNode.type === 'values') {
                  edgeStyle.stroke = '#9254DE';
                  edgeStyle.lineWidth = 2;
                } else if (nodeType.type === 'cards' && targetNode.type === 'capabilities') {
                  edgeStyle.stroke = '#36CFC9';
                  edgeStyle.lineWidth = 2;
                }
                edges.push({
                  id: `edge_${nodeType.type}_${node.id}_${targetNode.type}_${targetNode.nodeId}`,
                  source: `${nodeType.type}_${node.id}`,
                  target: `${targetNode.type}_${targetNode.nodeId}`,
                  label: key,
                  style: edgeStyle,
                });
              }
            }

            if (value && typeof value === 'object' && '#' in value) {
              console.log(`${nodeType.type} ${node.id} has ${key} reference with soul: ${value['#']}`);
              if (nodeType.type === 'values' && key === 'cards') {
                databaseNodes.forEach((cardNodeType) => {
                  if (cardNodeType.type === 'cards') {
                    cardNodeType.nodes.forEach((cardNode: NodeData) => {
                      edges.push({
                        id: `edge_value_${node.id}_card_${cardNode.id}`,
                        source: `${nodeType.type}_${node.id}`,
                        target: `${cardNodeType.type}_${cardNode.id}`,
                        label: 'used by',
                        style: { stroke: '#9254DE', lineWidth: 2 },
                      });
                    });
                  }
                });
              } else if (nodeType.type === 'capabilities' && key === 'cards') {
                databaseNodes.forEach((cardNodeType) => {
                  if (cardNodeType.type === 'cards') {
                    cardNodeType.nodes.forEach((cardNode: NodeData) => {
                      edges.push({
                        id: `edge_capability_${node.id}_card_${cardNode.id}`,
                        source: `${nodeType.type}_${node.id}`,
                        target: `${cardNodeType.type}_${cardNode.id}`,
                        label: 'enabled by',
                        style: { stroke: '#36CFC9', lineWidth: 2 },
                      });
                    });
                  }
                });
              } else if (nodeType.type === 'decks' && key === 'cards') {
                databaseNodes.forEach((cardNodeType) => {
                  if (cardNodeType.type === 'cards') {
                    cardNodeType.nodes.forEach((cardNode: NodeData) => {
                      edges.push({
                        id: `edge_deck_${node.id}_card_${cardNode.id}`,
                        source: `${nodeType.type}_${node.id}`,
                        target: `${cardNodeType.type}_${cardNode.id}`,
                        label: 'contains',
                        style: { stroke: '#E8684A', lineWidth: 2 },
                      });
                    });
                  }
                });
              } else if (nodeType.type === 'games' && (key === 'player_refs' || key === 'creator_ref')) {
                databaseNodes.forEach((userNodeType) => {
                  if (userNodeType.type === 'users') {
                    userNodeType.nodes.forEach((userNode: NodeData) => {
                      edges.push({
                        id: `edge_game_${node.id}_user_${userNode.id}_${key}`,
                        source: `${nodeType.type}_${node.id}`,
                        target: `${userNodeType.type}_${userNode.id}`,
                        label: key === 'creator_ref' ? 'created by' : 'played by',
                        style: { stroke: '#5B8FF9', lineWidth: 2 },
                      });
                    });
                  }
                });
              } else if (nodeType.type === 'games' && key === 'actor_refs') {
                databaseNodes.forEach((actorNodeType) => {
                  if (actorNodeType.type === 'actors') {
                    actorNodeType.nodes.forEach((actorNode: NodeData) => {
                      edges.push({
                        id: `edge_game_${node.id}_actor_${actorNode.id}`,
                        source: `${nodeType.type}_${node.id}`,
                        target: `${actorNodeType.type}_${actorNode.id}`,
                        label: 'has role',
                        style: { stroke: '#5D7092', lineWidth: 2 },
                      });
                    });
                  }
                });
              } else if (nodeType.type === 'cards' && key === 'values') {
                databaseNodes.forEach((valueNodeType) => {
                  if (valueNodeType.type === 'values') {
                    valueNodeType.nodes.forEach((valueNode: NodeData) => {
                      edges.push({
                        id: `edge_card_${node.id}_value_${valueNode.id}`,
                        source: `${nodeType.type}_${node.id}`,
                        target: `${valueNodeType.type}_${valueNode.id}`,
                        label: 'has value',
                        style: { stroke: '#9254DE', lineWidth: 2 },
                      });
                    });
                  }
                });
              } else if (nodeType.type === 'users' && key === 'decks') {
                databaseNodes.forEach((deckNodeType) => {
                  if (deckNodeType.type === 'decks') {
                    deckNodeType.nodes.forEach((deckNode: NodeData) => {
                      edges.push({
                        id: `edge_user_${node.id}_deck_${deckNode.id}`,
                        source: `${nodeType.type}_${node.id}`,
                        target: `${deckNodeType.type}_${deckNode.id}`,
                        label: 'created deck',
                        style: { stroke: '#5B8FF9', lineWidth: 2 },
                      });
                    });
                  }
                });
              } else if (nodeType.type === 'cards' && key === 'capabilities') {
                databaseNodes.forEach((capNodeType) => {
                  if (capNodeType.type === 'capabilities') {
                    capNodeType.nodes.forEach((capNode: NodeData) => {
                      edges.push({
                        id: `edge_card_${node.id}_capability_${capNode.id}`,
                        source: `${nodeType.type}_${node.id}`,
                        target: `${capNodeType.type}_${capNode.id}`,
                        label: 'has capability',
                        style: { stroke: '#36CFC9', lineWidth: 2 },
                      });
                    });
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

  // Helper functions
  function getLabelForNode(node: NodeData, nodeType: string): string {
    if (typeof node.data !== 'object') return node.id.substring(0, 8);
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

  function findNodeById(nodes: GraphNode[], id: string): GraphNode | undefined {
    return nodes.find((n) => n.nodeId === id);
  }

  // Delete node
  async function deleteNode(nodeType: string, nodeId: string) {
    try {
      const gun = getGun();
      if (!gun) {
        error = 'Gun not initialized';
        return;
      }
      gun.get(nodeType).get(nodeId).put(null, async (ack: any) => {
        if (ack.err) {
          console.error(`Error deleting ${nodeType} node:`, ack.err);
          error = `Failed to delete ${nodeType} node: ${ack.err}`;
        } else {
          console.log(`Deleted ${nodeType} node: ${nodeId}`);
          await tick();
          fetchDatabaseStats();
        }
      });
    } catch (err) {
      console.error(`Delete ${nodeType} node error:`, err);
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // Delete agreement using gameService function
  async function handleDeleteAgreement(agreementId: string) {
    try {
      const success = await deleteAgreement(agreementId);
      if (success) {
        console.log(`Successfully deleted agreement: ${agreementId}`);
        await tick();
        fetchDatabaseStats();
      } else {
        error = `Failed to delete agreement: ${agreementId}`;
      }
    } catch (err) {
      console.error(`Delete agreement error:`, err);
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // Tab handling
  function handleTabChange(tab: string) {
    activeTab = tab;
    if (tab === 'visualize' && typeof window !== 'undefined') loadGraphVisualization();
    if (browser) {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('tab', tab);
      replaceState(`${window.location.pathname}?${urlParams.toString()}`, {});
    }
  }

  function handleDataTabChange(tab: string) {
    activeDataTab = tab;
  }

  // Cleanup functions
  async function performCleanup() {
    if (!confirm('WARNING: This action will permanently remove all user nodes except your own. Are you sure?')) return;
    isCleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    cleanupResult = null;
    try {
      const result = await cleanupUsers();
      cleanupResult = result;
      cleanupSuccess = result.success;
      if (!result.success) cleanupError = result.error || 'Unknown error during cleanup';
    } catch (err) {
      console.error('Error cleaning up users:', err);
      cleanupError = err instanceof Error ? err.message : String(err);
      cleanupSuccess = false;
    } finally {
      isCleanupLoading = false;
      fetchDatabaseStats();
    }
  }

  async function removeSpecificUser(userId: string) {
    if (!confirm(`Are you sure you want to remove user ${userId}?`)) return;
    try {
      const result = await removeUser(userId);
      if (result.success) fetchDatabaseStats();
      else alert(`Error removing user: ${result.error}`);
    } catch (err) {
      console.error('Error removing user:', err);
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function performCleanupAllUsers() {
    if (!confirm('WARNING: This will remove ALL user nodes. Are you sure?')) return;
    isCleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    cleanupResult = null;
    try {
      const result = await cleanupAllUsers();
      cleanupResult = result;
      cleanupSuccess = result.success;
      if (!result.success) cleanupError = result.error || 'Unknown error during cleanup';
    } catch (err) {
      console.error('Error cleaning up all users:', err);
      cleanupError = err instanceof Error ? err.message : String(err);
      cleanupSuccess = false;
    } finally {
      isCleanupLoading = false;
      fetchDatabaseStats();
    }
  }

  // Fetch database stats
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
    databaseNodes = [];
    nodeCount = 0;
    const nodeTypes = Object.values(gunNodes);
    for (const nodeType of nodeTypes) {
      const typeNodes: NodeData[] = [];
      await new Promise<void>((resolve) => {
        try {
          gun.get(nodeType).map().once((data: any, id: string) => {
            if (data) typeNodes.push({ id, type: nodeType, data });
          });
          setTimeout(() => {
            console.log(`Found ${typeNodes.length} nodes of type ${nodeType}`);
            databaseNodes.push({ type: nodeType, count: typeNodes.length, nodes: typeNodes });
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

  // Initialization effect
  $effect(() => {
    isMounted = true;
    async function initializeApp() {
      if (typeof window !== 'undefined') {
        try {
          await fetchDatabaseStats();
          if (browser) {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            const deckIdParam = urlParams.get('deckId');
            if (deckIdParam) activeTab = 'overview';
            else if (tabParam) activeTab = tabParam;
            if (activeTab === 'visualize') loadGraphVisualization();
          }
        } catch (err) {
          console.error('Error loading database stats:', err);
          error = 'Failed to load database information.';
        } finally {
          isLoading = false;
        }
      }
    }
    initializeApp();
  });
</script>

<div class="admin-dashboard p-4 h-full">
  <header class="mb-4">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold">Admin Dashboard</h1>
      <div class="flex space-x-2">
        <button class="btn variant-filled-primary" onclick={fetchDatabaseStats}>
          <icons.RefreshCcw class="w-4 h-4 mr-2" />
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
        onclick={() => handleTabChange('overview')}
      >
        <icons.Eye class="w-4 h-4 mr-2" />
        Overview
      </button>
      <button 
        class="admin-tab {activeTab === 'data' ? 'active' : ''}" 
        onclick={() => handleTabChange('data')}
      >
        <icons.Database class="w-4 h-4 mr-2" />
        Data
      </button>
      <button 
        class="admin-tab {activeTab === 'decks' ? 'active' : ''}" 
        onclick={() => handleTabChange('decks')}
      >
        <icons.CreditCard class="w-4 h-4 mr-2" />
        Decks
      </button>
      <button 
        class="admin-tab {activeTab === 'visualize' ? 'active' : ''}" 
        onclick={() => handleTabChange('visualize')}
      >
        <icons.Network class="w-4 h-4 mr-2" />
        Visualize
      </button>
      <button 
        class="admin-tab {activeTab === 'maintenance' ? 'active' : ''}" 
        onclick={() => handleTabChange('maintenance')}
      >
        <icons.Wrench class="w-4 h-4 mr-2" />
        Maintenance
      </button>
      <button 
        class="admin-tab {activeTab === 'dev' ? 'active' : ''}" 
        onclick={() => handleTabChange('dev')}
      >
        <icons.Settings class="w-4 h-4 mr-2" />
        Dev
      </button>
    </div>
    
    <div class="p-4">
    
    <div class="tab-content">
      {#if activeTab === 'visualize'}
        <div class="p-2">
          <div class="card p-4 bg-surface-100-800 border border-surface-300-600 mb-4">
            <div class="flex items-center space-x-4">
              <icons.Network class="text-primary-500" />
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
              <icons.AlertTriangle class="w-5 h-5" />
              <div class="alert-message">
                <h3 class="h4">Error</h3>
                <p>{g6Error}</p>
              </div>
              <div class="alert-actions">
                <button class="btn variant-filled" onclick={loadGraphVisualization}>Retry</button>
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
      {:else if activeTab === 'dev'}
        <div class="p-2">
          <!-- Database Explorer Link -->
          <div class="card p-4 bg-surface-100-800-token border border-surface-300-600 mb-4">
            <div class="flex items-center space-x-4">
              <icons.Database class="text-primary-500" />
              <div>
                <h3 class="h4">Database Explorer</h3>
                <p class="text-sm mb-4">Use this tool to explore the Gun.js database structure and data.</p>
                <a href="/db-explorer" class="btn variant-filled-primary">
                  Open DB Explorer
                </a>
              </div>
            </div>
          </div>
        </div>
      {:else if activeTab === 'data'}
        <div class="p-2">
          <div class="card p-4 bg-surface-100-800 border border-surface-300-600 mb-4">
            <div class="flex items-center space-x-4">
              <icons.Database class="text-primary-500" />
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
              <icons.AlertTriangle class="w-5 h-5" />
              <div class="alert-message">
                <h3 class="h4">Error</h3>
                <p>{error}</p>
              </div>
              <div class="alert-actions">
                <button class="btn variant-filled" onclick={fetchDatabaseStats}>Retry</button>
              </div>
            </div>
          {:else}
            <!-- Inner tabs for data types -->
            <div class="card p-4 bg-surface-200-800 border border-surface-300-600">
              <div class="data-tabs mb-4">
                {#each databaseNodes as nodeType}
                  <button 
                    class="data-tab {activeDataTab === nodeType.type ? 'active' : ''}" 
                    onclick={() => handleDataTabChange(nodeType.type)}
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
              {:else if activeDataTab === 'games'}
                <!-- Special handling for games with our enhanced component -->
                <GamesDataTable refreshTrigger={nodeCount} />
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
                                  onclick={() => {
                                    if (confirm(`Are you sure you want to delete this ${nodeType.type.slice(0, -1)} with ID "${node.id}"? This cannot be undone.`)) {
                                      if (nodeType.type === 'agreements') {
                                        handleDeleteAgreement(node.id);
                                      } else {
                                        deleteNode(nodeType.type, node.id);
                                      }
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
              <icons.Info class="text-primary-500" />
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
              <icons.AlertTriangle class="w-5 h-5" />
              <div class="alert-message">
                <h3 class="h4">Error</h3>
                <p>{error}</p>
              </div>
              <div class="alert-actions">
                <button class="btn variant-filled" onclick={fetchDatabaseStats}>Retry</button>
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
                <icons.Database class="w-16 h-16 mx-auto mb-4 text-surface-500" />
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