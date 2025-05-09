<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import cytoscape from 'cytoscape';
  import type { Core } from 'cytoscape';

  // Define interfaces for nodes, edges, games, and layouts
  interface Node {
    id: string;
    type: string;
    label?: string;
  }

  interface Edge {
    id?: string;
    source: string;
    target: string;
    label?: string;
  }

  interface Game {
    id: string;
    name: string;
  }

  interface Layout {
    id: string;
    name: string;
  }

  // Props with type annotations
  const { nodes = [] as Node[], edges = [] as Edge[] } = $props();

  // State variables with explicit types
  let container = $state<HTMLElement | null>(null);
  let cy = $state<Core | null>(null);
  let loading = $state<boolean>(true);
  let error = $state<string | null>(null);

  // Node and edge type filtering
  let availableNodeTypes = $state<string[]>([]);
  let selectedNodeTypes = $state<string[]>([]);
  let filteredNodes = $state<Node[]>([]);
  let filteredEdges = $state<Edge[]>([]);

  // Edge type filtering
  let availableEdgeTypes = $state<string[]>([]);
  let selectedEdgeTypes = $state<string[]>([]);

  // Layout options
  const layouts: Layout[] = [
    { id: 'default', name: 'Deck Hierarchy' },
    { id: 'game-layout', name: 'Game Layout (CISE)' },
    { id: 'cise', name: 'Circular Clusters (CISE)' },
    { id: 'concentric', name: 'Concentric' },
    { id: 'grid', name: 'Grid' },
    { id: 'breadthfirst', name: 'Tree / Hierarchy' },
    { id: 'cose', name: 'Force-Directed (CoSE)' },
    { id: 'dagre', name: 'Directed (DAG)' }
  ];
  let selectedLayout = $state<Layout>(layouts[0]);

  // Game-specific layout options
  let availableGames = $state<Game[]>([]);
  let selectedGameId = $state<string>('');

  const dispatch = createEventDispatcher();

  // Find the relationship type from an edge
  function getEdgeType(edge: Edge): string {
    if (!edge.source || !edge.target) return 'unknown';
    const sourceType = edge.source.split('_')[0];
    const targetType = edge.target.split('_')[0];
    return `${sourceType}-${targetType}`;
  }

  // Helper function to update filteredNodes state
  function updateFilteredNodes(newNodes: Node[]): void {
    filteredNodes = [...newNodes];
  }

  // Helper function to update filteredEdges state
  function updateFilteredEdges(newEdges: Edge[]): void {
    filteredEdges = [...newEdges];
  }

  function applyFilters(): void {
    const newFilteredNodes =
      selectedNodeTypes.length === 0
        ? [...nodes]
        : nodes.filter((node) => selectedNodeTypes.includes(node.type));

    const filteredNodeIds = new Set(newFilteredNodes.map((node) => node.id));
    const nodeFilteredEdges = edges.filter(
      (edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );

    const newFilteredEdges =
      selectedEdgeTypes.length === 0
        ? nodeFilteredEdges
        : nodeFilteredEdges.filter((edge) => selectedEdgeTypes.includes(getEdgeType(edge)));

    updateFilteredNodes(newFilteredNodes);
    updateFilteredEdges(newFilteredEdges);

    if (cy) {
      updateGraph();
    }
  }

  function toggleEdgeType(type: string): void {
    const index = selectedEdgeTypes.indexOf(type);
    if (index === -1) {
      selectedEdgeTypes = [...selectedEdgeTypes, type];
    } else {
      selectedEdgeTypes = selectedEdgeTypes.filter((t) => t !== type);
    }
    applyFilters();
  }

  function selectAllEdgeTypes(): void {
    selectedEdgeTypes = [...availableEdgeTypes];
    applyFilters();
  }

  function clearEdgeTypeSelection(): void {
    selectedEdgeTypes = [];
    applyFilters();
  }

  function updateGraph(): void {
    if (!cy) return;

    cy.elements().remove();
    const elements: any[] = [];

    filteredNodes.forEach((node) => {
      const nodeColor = getColorForNodeType(node.type);
      elements.push({
        data: {
          id: node.id,
          label: node.label || node.id.substring(0, 10),
          type: node.type || 'unknown',
          color: nodeColor
        },
        style: {
          'background-color': nodeColor
        }
      });
    });

    filteredEdges.forEach((edge) => {
      elements.push({
        data: {
          id: edge.id || `edge-${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: edge.label || ''
        }
      });
    });

    cy.add(elements);
    applyLayout();
  }

  function getColorForNodeType(type: string): string {
    switch (type) {
      case 'users':
        return '#5B8FF9';
      case 'games':
        return '#5AD8A6';
      case 'actors':
        return '#5D7092';
      case 'chat':
        return '#F6BD16';
      case 'agreements':
        return '#E8684A';
      case 'values':
        return '#9254DE';
      case 'capabilities':
        return '#36CFC9';
      case 'cards':
        return '#F6BD16';
      case 'decks':
        return '#E8684A';
      default:
        return '#999';
    }
  }

  function applyLayout(): void {
    if (!cy) return;

    let layoutOptions: any = {};

    switch (selectedLayout.id) {
      case 'game-layout':
        layoutOptions = {
          name: 'preset',
          fit: true,
          padding: 40,
          animate: true,
          animationDuration: 400,
          animationEasing: 'ease',
          positions: function (node: any) {
            const canvasWidth = container!.clientWidth;
            const canvasHeight = 550;
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            const clusterRadius = Math.min(canvasWidth, canvasHeight) * 0.35;
            const nodeType = node.data('type');
            const typeMap: Record<string, { angle: number; radius: number; spreadFactor: number }> = {
              cards: { angle: 0, radius: clusterRadius, spreadFactor: 80 },
              values: { angle: Math.PI / 3, radius: clusterRadius, spreadFactor: 60 },
              capabilities: { angle: (2 * Math.PI) / 3, radius: clusterRadius, spreadFactor: 60 },
              users: { angle: Math.PI, radius: clusterRadius, spreadFactor: 50 },
              actors: { angle: (4 * Math.PI) / 3, radius: clusterRadius, spreadFactor: 60 },
              agreements: { angle: (5 * Math.PI) / 3, radius: clusterRadius, spreadFactor: 70 }
            };
            const position = { x: centerX, y: centerY };
            if (typeMap[nodeType]) {
              const nodeConfig = typeMap[nodeType];
              const nodesOfType = cy!.nodes().filter((n: any) => n.data('type') === nodeType);
              const totalNodes = nodesOfType.length;
              const nodeIndex = nodesOfType.toArray().findIndex((n: any) => n.id() === node.id());
              const clusterX = centerX + nodeConfig.radius * Math.cos(nodeConfig.angle);
              const clusterY = centerY + nodeConfig.radius * Math.sin(nodeConfig.angle);
              const spreadX = (nodeIndex % 3) * (nodeConfig.spreadFactor / 3);
              const spreadY = Math.floor(nodeIndex / 3) * (nodeConfig.spreadFactor / 3);
              position.x = clusterX + spreadX - nodeConfig.spreadFactor / 2;
              position.y = clusterY + spreadY - nodeConfig.spreadFactor / 2;
            }
            return position;
          }
        };
        break;

      case 'default':
        layoutOptions = {
          name: 'preset',
          fit: true,
          animate: true,
          animationDuration: 500,
          padding: 30,
          positions: function (node: any) {
            const canvasWidth = container!.clientWidth;
            const containerHeight = 550;
            const nodesByType: Record<string, string[]> = {
              users: [],
              games: [],
              decks: [],
              cards: [],
              values: [],
              capabilities: [],
              actors: [],
              other: []
            };
            cy!.nodes().forEach((n: any) => {
              const type = n.data('type');
              if (nodesByType[type]) {
                nodesByType[type].push(n.id());
              } else {
                nodesByType.other.push(n.id());
              }
            });
            const nodeType = node.data('type');
            let row = 4;
            let rowNodes: string[] = [];
            if (nodeType === 'users' || nodeType === 'games') {
              row = 0;
              rowNodes = nodeType === 'users' ? nodesByType.users : nodesByType.games;
            } else if (nodeType === 'decks') {
              row = 1;
              rowNodes = nodesByType.decks;
            } else if (nodeType === 'cards') {
              row = 2;
              rowNodes = nodesByType.cards;
            } else if (nodeType === 'values' || nodeType === 'capabilities') {
              row = 3;
              rowNodes = nodeType === 'values' ? nodesByType.values : nodesByType.capabilities;
            }
            const nodeIndex = rowNodes.indexOf(node.id());
            const nodeCount = rowNodes.length || 1;
            let xPos = canvasWidth / 2;
            if (nodeCount > 1) {
              const availableWidth = canvasWidth * 0.9;
              const spacing = availableWidth / (nodeCount - 1);
              xPos = canvasWidth * 0.05 + nodeIndex * spacing;
            }
            const rowSpacing = containerHeight / 4;
            const yPos = row * rowSpacing + rowSpacing / 2;
            return { x: xPos, y: yPos };
          }
        };
        break;

      case 'cise':
        layoutOptions = {
          name: 'cise',
          clusters: (function () {
            const clusterMap: Record<string, string[]> = {};
            filteredNodes.forEach((node) => {
              if (node.type) {
                clusterMap[node.type] = clusterMap[node.type] || [];
                clusterMap[node.type].push(node.id);
              }
            });
            return Object.values(clusterMap);
          })(),
          allowNodesInsideCircle: false,
          quality: 0.8,
          nodeSeparation: 20,
          animate: true,
          animationDuration: 500,
          gravity: 0.4,
          gravityRange: 3.8,
          idealInterClusterEdgeLengthCoefficient: 1.5,
          refresh: 10,
          fit: true,
          padding: 30,
          showClusters: false
        };
        break;

      case 'concentric':
        layoutOptions = {
          name: 'concentric',
          concentric: function (node: any) {
            const nodeType = node.data('type');
            switch (nodeType) {
              case 'values':
                return 5;
              case 'capabilities':
                return 5;
              case 'cards':
                return 4;
              case 'decks':
                return 3;
              case 'users':
                return 1;
              case 'games':
                return 2;
              default:
                return 0;
            }
          },
          levelWidth: function () {
            return 1;
          },
          animate: true,
          padding: 30
        };
        break;

      case 'grid':
        layoutOptions = {
          name: 'grid',
          rows: undefined,
          cols: undefined,
          fit: true,
          padding: 30,
          animate: true
        };
        break;

      case 'breadthfirst':
        layoutOptions = {
          name: 'breadthfirst',
          directed: true,
          padding: 30,
          animate: true
        };
        break;

      case 'cose':
        layoutOptions = {
          name: 'cose',
          animate: true,
          padding: 30,
          gravity: 1.5,
          nodeOverlap: 20,
          idealEdgeLength: 100
        };
        break;

      case 'dagre':
        layoutOptions = {
          name: 'dagre',
          rankDir: 'TB',
          animate: true,
          padding: 30
        };
        break;
    }

    const layout = cy.layout(layoutOptions);
    layout.run();
  }

  function handleLayoutChange(): void {
    if (!cy) return;

    const currentLayout = selectedLayout.id;
    if (currentLayout === 'game-layout') {
      if (availableGames.length === 0) {
        loadAvailableGames();
      }
      const gameViewNodeTypes = ['cards', 'actors', 'users', 'values', 'capabilities', 'agreements'];
      selectedNodeTypes = availableNodeTypes.filter(
        (type) => gameViewNodeTypes.includes(type) && !['games', 'decks', 'chat', 'node_positions'].includes(type)
      );
      applyFilters();
    } else {
      if (!selectedNodeTypes.includes('games')) selectedNodeTypes = [...selectedNodeTypes, 'games'];
      if (!selectedNodeTypes.includes('decks')) selectedNodeTypes = [...selectedNodeTypes, 'decks'];
      cy.elements().removeClass('highlighted related faded');
      applyFilters();
    }
    applyLayout();
  }

  function loadAvailableGames(): void {
    availableGames = nodes
      .filter((node) => node.type === 'games')
      .map((game) => ({
        id: game.id,
        name: game.label || game.id.replace('games_', '')
      }));

    if (availableGames.length > 0 && !selectedGameId) {
      selectedGameId = availableGames[0].id;
      filterNodesForSelectedGame();
    }
  }

  function filterNodesForSelectedGame(): void {
    if (!selectedGameId || selectedLayout.id !== 'game-layout' || !cy) return;

    const gameNode = cy.getElementById(selectedGameId);
    if (!gameNode.length) return;

    cy.elements().removeClass('highlighted related faded');
    const connectedNodes = gameNode.neighborhood().neighborhood().add(gameNode);
    const connectedNodeIds = new Set<string>();
    connectedNodes.forEach((node: any) => {
      if (node.isNode()) connectedNodeIds.add(node.id());
    });

    cy.nodes().forEach((node: any) => {
      if (connectedNodeIds.has(node.id())) {
        node.removeClass('faded').addClass('related');
      } else {
        node.removeClass('related').addClass('faded');
      }
    });

    cy.edges().forEach((edge: any) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      if (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)) {
        edge.removeClass('faded').addClass('related');
      } else {
        edge.removeClass('related').addClass('faded');
      }
    });
  }

  function handleGameChange(): void {
    filterNodesForSelectedGame();
    applyLayout();
  }

  function toggleNodeType(type: string): void {
    const index = selectedNodeTypes.indexOf(type);
    if (index === -1) {
      selectedEdgeTypes = [...selectedEdgeTypes, type];
    } else {
      selectedEdgeTypes = selectedEdgeTypes.filter((t) => t !== type);
    }
    applyFilters();
  }

  function selectAllNodeTypes(): void {
    selectedNodeTypes = [...availableNodeTypes];
    applyFilters();
  }

  function clearNodeTypeSelection(): void {
    selectedNodeTypes = [];
    applyFilters();
  }

  onMount(async () => {
    if (!browser || !container) return;

    try {
      loading = true;
      error = null;

      console.log("Starting with nodes:", nodes.length);

      availableNodeTypes = [...new Set(nodes.map((node) => node.type))].sort();
      console.log("Available node types:", availableNodeTypes);

      const essentialTypes = ['users', 'decks', 'cards', 'values', 'capabilities', 'games', 'actors'];
      essentialTypes.forEach((type: string) => {
        if (!availableNodeTypes.includes(type)) {
          availableNodeTypes.push(type);
        }
      });

      const relevantNodeTypes = ['users', 'decks', 'cards', 'values', 'capabilities', 'games', 'actors'];
      selectedNodeTypes = availableNodeTypes.filter((type: string) => relevantNodeTypes.includes(type));
      console.log("Selected node types:", selectedNodeTypes);

      const edgeTypes = new Set<string>();
      edges.forEach((edge) => {
        const edgeType = getEdgeType(edge);
        if (edgeType !== 'unknown') {
          edgeTypes.add(edgeType);
        }
      });
      availableEdgeTypes = [...edgeTypes].sort();

      const relevantEdgeTypes = [
        'decks-cards',
        'cards-values',
        'cards-capabilities',
        'values-cards',
        'capabilities-cards',
        'games-users',
        'users-games',
        'games-decks',
        'decks-games',
        'games-actors',
        'actors-games',
        'actors-agreements',
        'agreements-actors',
        'users-actors',
        'actors-users',
        'actors-cards',
        'cards-actors'
      ];
      selectedEdgeTypes = availableEdgeTypes.filter((type: string) => relevantEdgeTypes.includes(type));

      applyFilters();

      const [ciseLayout, dagreLayout] = await Promise.all([
        import('cytoscape-cise'),
        import('cytoscape-dagre')
      ]);

      cytoscape.use(ciseLayout.default || ciseLayout);
      cytoscape.use(dagreLayout.default || dagreLayout);

      const elements: any[] = [];
      filteredNodes.forEach((node) => {
        const nodeColor = getColorForNodeType(node.type);
        elements.push({
          data: {
            id: node.id,
            label: node.label || node.id.substring(0, 10),
            type: node.type || 'unknown',
            color: nodeColor
          },
          style: {
            'background-color': nodeColor
          }
        });
      });

      filteredEdges.forEach((edge) => {
        elements.push({
          data: {
            id: edge.id || `edge-${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            label: edge.label || ''
          }
        });
      });

      cy = cytoscape({
        container,
        elements,
        style: [
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'background-color': 'data(color)',
              'color': '#fff',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '10px',
              'width': 30,
              'height': 30,
              'text-wrap': 'wrap',
              'text-max-width': '80px',
              'text-outline-width': 1,
              'text-outline-color': '#555'
            }
          },
          { selector: 'node[type = "users"]', style: { shape: 'ellipse' } },
          { selector: 'node[type = "games"]', style: { shape: 'diamond' } },
          { selector: 'node[type = "actors"]', style: { shape: 'triangle' } },
          { selector: 'node[type = "chat"]', style: { shape: 'round-rectangle' } },
          { selector: 'node[type = "agreements"]', style: { shape: 'hexagon' } },
          { selector: 'node[type = "values"]', style: { shape: 'round-rectangle' } },
          { selector: 'node[type = "capabilities"]', style: { shape: 'round-triangle' } },
          { selector: 'node[type = "cards"]', style: { shape: 'rectangle' } },
          { selector: 'node[type = "decks"]', style: { shape: 'star' } },
          {
            selector: '.highlighted',
            style: {
              'background-color': '#FF5722',
              'border-width': 3,
              'border-color': '#FF5722',
              'border-opacity': 0.8,
              'width': 40,
              'height': 40,
              'font-size': '14px',
              'color': '#fff',
              'text-outline-width': 2,
              'text-outline-color': '#333',
              'z-index': 999
            }
          },
          {
            selector: '.related',
            style: {
              'background-color': 'data(color)',
              'border-width': 2,
              'border-color': '#FFC107',
              'border-opacity': 0.8,
              'width': 35,
              'height': 35,
              'font-size': '12px',
              'color': '#fff',
              'text-outline-width': 2,
              'text-outline-color': '#555',
              'z-index': 900
            }
          },
          {
            selector: 'edge.related',
            style: {
              'width': 3,
              'line-color': '#FFC107',
              'target-arrow-color': '#FFC107',
              'z-index': 900,
              'opacity': 1
            }
          },
          { selector: '.faded', style: { 'opacity': 0.3, 'z-index': 0 } },
          {
            selector: 'edge',
            style: {
              'width': 1,
              'curve-style': 'bezier',
              'line-color': '#ccc',
              'target-arrow-color': '#ccc',
              'target-arrow-shape': 'triangle',
              'label': 'data(label)',
              'font-size': '8px',
              'color': '#777',
              'text-rotation': 'autorotate'
            }
          }
        ]
      });

      loadAvailableGames();
      applyLayout();

      cy.on('tap', 'node', function (evt: any) {
        const node = evt.target;
        console.log('Node clicked: ' + node.id());
        cy!.elements().removeClass('highlighted related faded');
        node.addClass('highlighted');
        const connectedEdges = node.connectedEdges();
        const connectedNodes = node.neighborhood('node');
        connectedEdges.addClass('related');
        connectedNodes.addClass('related');
        cy!.elements().not(node).not(connectedEdges).not(connectedNodes).addClass('faded');
        dispatch('nodeSelected', {
          id: node.id(),
          type: node.data('type'),
          label: node.data('label')
        });
      });

      cy.on('tap', function (evt: any) {
        if (evt.target === cy) {
          cy!.elements().removeClass('highlighted related faded');
          dispatch('selectionCleared');
        }
      });

      cy.fit();
      cy.center();
      loading = false;
    } catch (err) {
      console.error('Error initializing Cytoscape:', err);
      error = `Error: ${err instanceof Error ? err.message : 'Could not initialize graph'}`;
      loading = false;
    }
  });

  onDestroy(() => {
    if (cy) {
      cy.destroy();
    }
  });
</script>

<div class="graph-controls mb-2 p-2 card bg-surface-200-800 border border-surface-300-600 shadow rounded-lg text-xs">
  <div class="flex flex-col gap-2">
    <!-- Compact Control Panels -->
    <div class="flex flex-col md:flex-row gap-2">
      <!-- Node Type Filter -->
      <div class="flex-1">
        <h3 class="text-sm font-semibold mb-1">Node Types</h3>
        <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
          {#each availableNodeTypes as type}
            <label
              class="flex items-center gap-1 p-1 rounded bg-surface-100-800 hover:bg-surface-200-700 cursor-pointer text-xs"
            >
              <input
                type="checkbox"
                checked={selectedNodeTypes.includes(type)}
                onchange={() => toggleNodeType(type)}
                class="checkbox checkbox-xs"
              />
              <span class="w-2 h-2 rounded-full" style="background-color: {getColorForNodeType(type)}"></span>
              <span class="truncate">{type}</span>
            </label>
          {/each}
        </div>
        <div class="flex gap-1 mt-1">
          <button class="btn btn-xs variant-ghost" onclick={selectAllNodeTypes}>All</button>
          <button class="btn btn-xs variant-ghost" onclick={clearNodeTypeSelection}>None</button>
        </div>
      </div>

      <!-- Layout Controls Column -->
      <div class="flex-none w-full md:w-48 flex flex-col gap-1">
        <!-- Layout Selector -->
        <div>
          <h3 class="text-sm font-semibold mb-1">Layout</h3>
          <select
            class="select select-xs bg-surface-100-800 border border-surface-300-600 rounded w-full text-xs"
            bind:value={selectedLayout}
            onchange={handleLayoutChange}
          >
            {#each layouts as layout}
              <option value={layout}>{layout.name}</option>
            {/each}
          </select>
        </div>

        <!-- Game Selector (compact version) -->
        {#if selectedLayout.id === 'game-layout' && availableGames.length > 0}
          <div class="mt-1">
            <h3 class="text-sm font-semibold mb-1">Game</h3>
            <div class="flex gap-1">
              <select
                class="select select-xs bg-surface-100-800 border border-surface-300-600 rounded w-full text-xs"
                bind:value={selectedGameId}
                onchange={handleGameChange}
              >
                {#each availableGames as game}
                  <option value={game.id}>{game.name}</option>
                {/each}
              </select>
              <button class="btn btn-xs variant-filled-primary" onclick={handleGameChange}>
                <span class="text-xs">Apply</span>
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Edge Type Filter -->
    {#if availableEdgeTypes.length > 0}
      <div>
        <h3 class="text-sm font-semibold mb-1">Edge Types</h3>
        <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1">
          {#each availableEdgeTypes as type}
            <label
              class="flex items-center gap-1 p-1 rounded bg-surface-100-800 hover:bg-surface-200-700 cursor-pointer text-xs"
            >
              <input
                type="checkbox"
                checked={selectedEdgeTypes.includes(type)}
                onchange={() => toggleEdgeType(type)}
                class="checkbox checkbox-xs"
              />
              <span class="truncate">{type}</span>
            </label>
          {/each}
        </div>
        <div class="flex gap-1 mt-1">
          <button class="btn btn-xs variant-ghost" onclick={selectAllEdgeTypes}>All</button>
          <button class="btn btn-xs variant-ghost" onclick={clearEdgeTypeSelection}>None</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<div class="graph-container" bind:this={container}>
  {#if loading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>Loading graph visualization...</span>
    </div>
  {/if}

  {#if error}
    <div class="error-message">
      <p class="text-error-500">{error}</p>
      <p class="text-sm">Please check the console for more details.</p>
    </div>
  {/if}
</div>

<style>
  .graph-container {
    width: 100%;
    height: 600px;
    background-color: var(--color-surface-100-800);
    border-radius: 8px;
    border: 1px solid var(--color-surface-300-600);
    position: relative;
  }

  .loading-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s ease-in-out infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    width: 80%;
  }

  .checkbox-xs {
    width: 0.75rem !important;
    height: 0.75rem !important;
    min-width: 0.75rem !important;
    min-height: 0.75rem !important;
    border-width: 1px !important;
  }

  .graph-controls {
    font-size: 0.7rem !important;
  }

  .graph-controls h3 {
    font-size: 0.75rem !important;
    margin-bottom: 0.25rem !important;
  }

  .graph-controls label {
    padding: 0.15rem 0.25rem !important;
  }

  .graph-controls button {
    font-size: 0.7rem !important;
    padding: 0.1rem 0.25rem !important;
    height: 1.25rem !important;
    min-height: unset !important;
  }

  .graph-controls select {
    height: 1.5rem !important;
    min-height: unset !important;
    padding: 0.1rem 0.25rem !important;
    font-size: 0.7rem !important;
  }
</style>