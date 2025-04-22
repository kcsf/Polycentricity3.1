<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  
  const { nodes = [], edges = [] } = $props();
  
  let container = $state();
  let cy = $state();
  let loading = $state(true);
  let error = $state(null);
  
  // Node and edge type filtering
  let availableNodeTypes = $state([]);
  let selectedNodeTypes = $state([]);
  let filteredNodes = $state([]);
  let filteredEdges = $state([]);
  
  // Edge type filtering
  let availableEdgeTypes = $state([]);
  let selectedEdgeTypes = $state([]);
  
  // Layout options
  const layouts = [
    { id: 'default', name: 'Deck Hierarchy' },
    { id: 'game-layout', name: 'Game Layout (CISE)' }, // Game-centric layout
    { id: 'cise', name: 'Circular Clusters (CISE)' },
    { id: 'concentric', name: 'Concentric' },
    { id: 'grid', name: 'Grid' },
    { id: 'breadthfirst', name: 'Tree / Hierarchy' },
    { id: 'cose', name: 'Force-Directed (CoSE)' },
    { id: 'dagre', name: 'Directed (DAG)' }
  ];
  let selectedLayout = $state(layouts[0]);
  
  // Game-specific layout options
  let availableGames = $state([]);
  let selectedGameId = $state('');
  
  const dispatch = createEventDispatcher();
  
  // Find the relationship type from an edge
  function getEdgeType(edge) {
    // Try to determine the edge type from source and target node types
    if (!edge.source || !edge.target) return 'unknown';
    
    // Extract node types from the source and target IDs
    const sourceType = edge.source.split('_')[0];
    const targetType = edge.target.split('_')[0];
    
    return `${sourceType}-${targetType}`;
  }
  
  // Helper function to update filteredNodes state
  function updateFilteredNodes(newNodes) {
    filteredNodes = [...newNodes]; // Create a new array to trigger reactivity
  }
  
  // Helper function to update filteredEdges state
  function updateFilteredEdges(newEdges) {
    filteredEdges = [...newEdges]; // Create a new array to trigger reactivity
  }
  
  function applyFilters() {
    // Filter nodes by selected types (if any selected)
    const newFilteredNodes = selectedNodeTypes.length === 0 
      ? [...nodes] 
      : nodes.filter(node => selectedNodeTypes.includes(node.type));
    
    // First, filter edges based on node visibility
    const filteredNodeIds = new Set(newFilteredNodes.map(node => node.id));
    const nodeFilteredEdges = edges.filter(edge => 
      filteredNodeIds.has(edge.source) && 
      filteredNodeIds.has(edge.target)
    );
    
    // Then, filter edges based on edge type selection (if any selected)
    const newFilteredEdges = selectedEdgeTypes.length === 0
      ? nodeFilteredEdges
      : nodeFilteredEdges.filter(edge => {
          const edgeType = getEdgeType(edge);
          return selectedEdgeTypes.includes(edgeType);
        });
    
    // Update state
    updateFilteredNodes(newFilteredNodes);
    updateFilteredEdges(newFilteredEdges);
    
    // If the graph is already initialized, update it
    if (cy) {
      updateGraph();
    }
  }
  
  function toggleEdgeType(type) {
    const index = selectedEdgeTypes.indexOf(type);
    if (index === -1) {
      selectedEdgeTypes = [...selectedEdgeTypes, type];
    } else {
      selectedEdgeTypes = selectedEdgeTypes.filter(t => t !== type);
    }
    applyFilters();
  }
  
  function selectAllEdgeTypes() {
    selectedEdgeTypes = [...availableEdgeTypes];
    applyFilters();
  }
  
  function clearEdgeTypeSelection() {
    selectedEdgeTypes = [];
    applyFilters();
  }
  
  function updateGraph() {
    // Remove existing elements
    cy.elements().remove();
    
    // Create elements array
    const elements = [];
    
    // Add filtered nodes
    filteredNodes.forEach(node => {
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
    
    // Add filtered edges
    filteredEdges.forEach(edge => {
      elements.push({
        data: {
          id: edge.id || `edge-${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: edge.label || ''
        }
      });
    });
    
    // Add elements
    cy.add(elements);
    
    // Apply the selected layout
    applyLayout();
  }
  
  function getColorForNodeType(type) {
    switch(type) {
      case 'users': return '#5B8FF9';
      case 'games': return '#5AD8A6';
      case 'actors': return '#5D7092';
      case 'chat': return '#F6BD16';
      case 'agreements': return '#E8684A';
      case 'values': return '#9254DE';
      case 'capabilities': return '#36CFC9';
      case 'cards': return '#F6BD16';
      case 'decks': return '#E8684A';
      default: return '#999';
    }
  }
  
  function applyLayout() {
    if (!cy) return;
    
    let layoutOptions = $state({});
    
    // Helper function to update layoutOptions
    function updateLayoutOptions(newOptions) {
      layoutOptions = { ...layoutOptions, ...newOptions };
    }
    
    // Configure layout based on selection
    switch (selectedLayout.id) {
      // Game-centric layout that uses CISE clustering centered around a specific game
      case 'game-layout':
        // Instead of using CISE for Game layout, now use a more stable preset approach
        // This eliminates jittering by positioning nodes in fixed cluster locations
        updateLayoutOptions({
          name: 'preset',
          fit: true,
          padding: 40,
          animate: true,
          animationDuration: 400,
          animationEasing: 'ease',
          
          // Custom positioning function that places nodes in specific circular clusters based on type
          positions: function(node) {
            // Get canvas dimensions
            const canvasWidth = container.clientWidth;
            const canvasHeight = 550; // approximate working height
            
            // Center point
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            
            // Cluster radius - distance from center to cluster center
            const clusterRadius = Math.min(canvasWidth, canvasHeight) * 0.35;
            
            // Node type determines which cluster it belongs to
            const nodeType = node.data('type');
            
            // Group nodes by type for clustering
            const typeMap = {
              'cards': { angle: 0, radius: clusterRadius, spreadFactor: 80 },
              'values': { angle: Math.PI / 3, radius: clusterRadius, spreadFactor: 60 },
              'capabilities': { angle: 2 * Math.PI / 3, radius: clusterRadius, spreadFactor: 60 },
              'users': { angle: Math.PI, radius: clusterRadius, spreadFactor: 50 },
              'actors': { angle: 4 * Math.PI / 3, radius: clusterRadius, spreadFactor: 60 },
              'agreements': { angle: 5 * Math.PI / 3, radius: clusterRadius, spreadFactor: 70 }
            };
            
            // Default to center if type not found
            const position = { x: centerX, y: centerY };
            
            if (typeMap[nodeType]) {
              const nodeConfig = typeMap[nodeType];
              
              // Find all nodes of this type to calculate position
              const nodesOfType = cy.nodes().filter(n => n.data('type') === nodeType);
              const totalNodes = nodesOfType.length;
              
              // Find position of this specific node in its type group
              const nodeIndex = nodesOfType.toArray().findIndex(n => n.id() === node.id());
              
              // Calculate cluster center
              const clusterX = centerX + nodeConfig.radius * Math.cos(nodeConfig.angle);
              const clusterY = centerY + nodeConfig.radius * Math.sin(nodeConfig.angle);
              
              // Calculate node position within cluster (small random offset for visual separation)
              // Use deterministic positioning based on nodeIndex to avoid jitter
              const spreadX = (nodeIndex % 3) * (nodeConfig.spreadFactor / 3);
              const spreadY = Math.floor(nodeIndex / 3) * (nodeConfig.spreadFactor / 3);
              
              // Apply offset from cluster center
              position.x = clusterX + spreadX - nodeConfig.spreadFactor / 2;
              position.y = clusterY + spreadY - nodeConfig.spreadFactor / 2;
            }
            
            return position;
          }
        });
        break;
        
      // Our custom "Default" hierarchical layout that places nodes in exact rows:
      // Row 1: Users
      // Row 2: Decks
      // Row 3: Cards
      // Row 4: Values and Capabilities
      case 'default':
        updateLayoutOptions({
          name: 'preset',
          fit: true,
          animate: true,
          animationDuration: 500,
          padding: 30,
          // Custom positioning function for our exact hierarchy
          positions: function(node) {
            // Get canvas dimensions
            const canvasWidth = container.clientWidth;
            const containerHeight = 550; // approximate working height
            
            // Collect all nodes by their types
            const nodesByType = {
              users: [],
              games: [],
              decks: [],
              cards: [],
              values: [],
              capabilities: [],
              actors: [],
              other: []
            };
            
            // First pass - classify all nodes
            cy.nodes().forEach(n => {
              const type = n.data('type');
              if (nodesByType[type]) {
                nodesByType[type].push(n.id());
              } else {
                nodesByType.other.push(n.id());
              }
            });
            
            // Get current node type
            const nodeType = node.data('type');
            
            // Determine row based on type (still maintaining 4 rows as requested)
            let row = $state(4); // default for any unexpected types
            let rowNodes = $state([]);
            
            // Helper functions to update row and rowNodes
            function updateRow(newRow) {
              row = newRow;
            }
            
            function updateRowNodes(newNodes) {
              rowNodes = newNodes;
            }
            
            if (nodeType === 'users' || nodeType === 'games') {
              updateRow(0);
              if (nodeType === 'users') {
                updateRowNodes(nodesByType.users);
              } else {
                updateRowNodes(nodesByType.games);
              }
            } else if (nodeType === 'decks') {
              updateRow(1);
              updateRowNodes(nodesByType.decks);
            } else if (nodeType === 'cards') {
              updateRow(2);
              updateRowNodes(nodesByType.cards);
            } else if (nodeType === 'values' || nodeType === 'capabilities') {
              updateRow(3);
              if (nodeType === 'values') {
                updateRowNodes(nodesByType.values);
              } else {
                updateRowNodes(nodesByType.capabilities);
              }
            }
            
            // Find this node's index within its type
            const typeNodes = rowNodes;
            const nodeIndex = typeNodes.indexOf(node.id());
            
            // Calculate horizontal spacing for this row
            const nodeCount = typeNodes.length || 1;
            
            // Ensure even if only one node, it's centered
            let xPos = $state(canvasWidth / 2);
            
            // Helper function to update xPos
            function updateXPos(newX) {
              xPos = newX;
            }
            
            if (nodeCount > 1) {
              const availableWidth = canvasWidth * 0.9; // leave some margin
              const spacing = availableWidth / (nodeCount - 1);
              updateXPos((canvasWidth * 0.05) + (nodeIndex * spacing));
            }
            
            // Vertical position calculation with equal row spacing
            const rowSpacing = containerHeight / 4; // exactly 4 rows
            const yPos = (row * rowSpacing) + (rowSpacing / 2);
            
            // Return the calculated position using the latest state values
            // Convert state variables to regular values for the return statement
            const currentXPos = xPos;
            const currentYPos = (row * rowSpacing) + (rowSpacing / 2);
            return { x: currentXPos, y: currentYPos };
          }
        });
        break;
        
      case 'cise':
        updateLayoutOptions({
          name: 'cise',
          clusters: (function() {
            const clusterMap = {};
            filteredNodes.forEach(node => {
              if (node.type) {
                if (!clusterMap[node.type]) {
                  clusterMap[node.type] = [];
                }
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
        });
        break;
        
      case 'concentric':
        updateLayoutOptions({
          name: 'concentric',
          concentric: function(node) {
            // Assign layers based on node type
            const nodeType = node.data('type');
            switch(nodeType) {
              case 'values': return 5;
              case 'capabilities': return 5;
              case 'cards': return 4;
              case 'decks': return 3;
              case 'users': return 1;
              case 'games': return 2;
              default: return 0;
            }
          },
          levelWidth: function() { return 1; },
          animate: true,
          padding: 30
        });
        break;
        
      case 'grid':
        updateLayoutOptions({
          name: 'grid',
          rows: undefined,
          cols: undefined,
          fit: true,
          padding: 30,
          animate: true
        });
        break;
        
      case 'breadthfirst':
        updateLayoutOptions({
          name: 'breadthfirst',
          directed: true,
          padding: 30,
          animate: true
        });
        break;
        
      case 'cose':
        updateLayoutOptions({
          name: 'cose',
          animate: true,
          padding: 30,
          gravity: 1.5,
          nodeOverlap: 20,
          idealEdgeLength: 100
        });
        break;
        
      case 'dagre':
        updateLayoutOptions({
          name: 'dagre',
          rankDir: 'TB', // Top to bottom
          animate: true,
          padding: 30
        });
        break;
    }
    
    // Apply the selected layout
    // Use a regular object for the layout options since Cytoscape doesn't need reactivity
    const currentLayoutOptions = { ...layoutOptions };
    const layout = cy.layout(currentLayoutOptions);
    layout.run();
  }
  
  function handleLayoutChange() {
    if (cy) {
      const currentLayout = selectedLayout.id;
      
      // If game layout is selected, configure special settings for it
      if (currentLayout === 'game-layout') {
        // Ensure games are loaded
        if (availableGames.length === 0) {
          loadAvailableGames();
        }
        
        // Set appropriate node types for game-centric view
        // Ensure we see cards, actors, users, values, capabilities, agreements
        // Hide games, decks, chat, node_positions
        const gameViewNodeTypes = ['cards', 'actors', 'users', 'values', 
                                  'capabilities', 'agreements'];
        const hideNodeTypes = ['games', 'decks', 'chat', 'node_positions'];
        
        // Update selectedNodeTypes to include only relevant node types
        selectedNodeTypes = availableNodeTypes.filter(type => 
          gameViewNodeTypes.includes(type) || 
          (type !== 'games' && type !== 'decks' && 
           type !== 'chat' && type !== 'node_positions')
        );
        
        // Apply filters with updated node type selection
        applyFilters();
      } else {
        // For other layouts, reset the node types to include essential ones
        if (!selectedNodeTypes.includes('games')) {
          selectedNodeTypes = [...selectedNodeTypes, 'games'];
        }
        if (!selectedNodeTypes.includes('decks')) {
          selectedNodeTypes = [...selectedNodeTypes, 'decks'];
        }
        
        // Reset game-related highlighting
        if (cy) {
          cy.elements().removeClass('highlighted related faded');
        }
        
        // Apply filters with updated node type selection
        applyFilters();
      }
      
      // Apply the layout
      applyLayout();
    }
  }
  
  // Load available games for the game-centric layout
  function loadAvailableGames() {
    // Find all game nodes from the original unfiltered data
    availableGames = nodes
      .filter(node => node.type === 'games')
      .map(game => ({
        id: game.id,
        name: game.label || game.id.replace('games_', '')
      }));
    
    // Set the first game as selected by default if available
    if (availableGames.length > 0 && !selectedGameId) {
      selectedGameId = availableGames[0].id;
      // If we have a game selection, apply filtering
      filterNodesForSelectedGame();
    }
  }
  
  // Filter nodes to only show those connected to the selected game
  function filterNodesForSelectedGame() {
    if (!selectedGameId || selectedLayout.id !== 'game-layout') return;
    
    // If no graph yet, return
    if (!cy) return;
    
    // Start with the game node
    const gameNode = cy.getElementById(selectedGameId);
    if (!gameNode.length) return;
    
    // Clear previous highlights
    cy.elements().removeClass('highlighted related faded');
    
    // Get all connected nodes up to 2 hops away
    const connectedNodes = gameNode.neighborhood().neighborhood().add(gameNode);
    const connectedNodeIds = new Set();
    
    connectedNodes.forEach(node => {
      if (node.isNode()) {
        connectedNodeIds.add(node.id());
      }
    });
    
    // Highlight connected nodes and fade others
    cy.nodes().forEach(node => {
      if (connectedNodeIds.has(node.id())) {
        node.removeClass('faded').addClass('related');
      } else {
        node.removeClass('related').addClass('faded');
      }
    });
    
    // Highlight edges between connected nodes
    cy.edges().forEach(edge => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      
      if (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)) {
        edge.removeClass('faded').addClass('related');
      } else {
        edge.removeClass('related').addClass('faded');
      }
    });
  }
  
  // Handle game selection change
  function handleGameChange() {
    filterNodesForSelectedGame();
    applyLayout();
  }
  
  function toggleNodeType(type) {
    const index = selectedNodeTypes.indexOf(type);
    if (index === -1) {
      selectedNodeTypes = [...selectedNodeTypes, type];
    } else {
      selectedNodeTypes = selectedNodeTypes.filter(t => t !== type);
    }
    applyFilters();
  }
  
  function selectAllNodeTypes() {
    selectedNodeTypes = [...availableNodeTypes];
    applyFilters();
  }
  
  function clearNodeTypeSelection() {
    selectedNodeTypes = [];
    applyFilters();
  }

  onMount(async () => {
    if (!browser || !container) return;
    
    try {
      loading = true;
      error = null;
      
      console.log("Starting with nodes:", nodes.length);
      
      // Get unique node types and set them as available for filtering
      availableNodeTypes = [...new Set(nodes.map(node => node.type))].sort();
      console.log("Available node types:", availableNodeTypes);
      
      // Ensure all node types are in the available list, even if not in the current data
      const essentialTypes = ['users', 'decks', 'cards', 'values', 'capabilities', 'games', 'actors'];
      essentialTypes.forEach(type => {
        if (!availableNodeTypes.includes(type)) {
          availableNodeTypes.push(type);
        }
      });
      
      // Only select the relevant node types by default as requested
      const relevantNodeTypes = ['users', 'decks', 'cards', 'values', 'capabilities', 'games', 'actors'];
      selectedNodeTypes = availableNodeTypes.filter(type => relevantNodeTypes.includes(type));
      console.log("Selected node types:", selectedNodeTypes);
      
      // Get unique edge types (connections between node types)
      const edgeTypes = new Set();
      edges.forEach(edge => {
        const edgeType = getEdgeType(edge);
        if (edgeType !== 'unknown') {
          edgeTypes.add(edgeType);
        }
      });
      availableEdgeTypes = [...edgeTypes].sort();
      
      // Only select the relevant edge types by default
      const relevantEdgeTypes = [
        // Core relationships
        'decks-cards', 'cards-values', 'cards-capabilities', 
        'values-cards', 'capabilities-cards',
        // Game relationships
        'games-users', 'users-games', 'games-decks', 'decks-games',
        'games-actors', 'actors-games',
        // Additional important relationships
        'actors-agreements', 'agreements-actors',
        'users-actors', 'actors-users',
        'actors-cards', 'cards-actors'
      ];
      selectedEdgeTypes = availableEdgeTypes.filter(type => relevantEdgeTypes.includes(type));
      
      // Initialize filtered nodes and edges
      applyFilters();
      
      // Dynamically import cytoscape, layouts, and extensions
      const [cytoscape, ciseLayout, dagreLayout] = await Promise.all([
        import('cytoscape'),
        import('cytoscape-cise'),
        import('cytoscape-dagre')
      ]);
      
      const cytoscapeCore = cytoscape.default || cytoscape;
      const cise = ciseLayout.default || ciseLayout;
      const dagre = dagreLayout.default || dagreLayout;
      
      // Register layouts and extensions
      cytoscapeCore.use(cise);
      cytoscapeCore.use(dagre);
      
      // Process data for cytoscape format
      const elements = [];
      
      // Add nodes
      filteredNodes.forEach(node => {
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
      
      // Add edges
      filteredEdges.forEach(edge => {
        elements.push({
          data: {
            id: edge.id || `edge-${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            label: edge.label || ''
          }
        });
      });
      
      // Create cytoscape instance
      cy = cytoscapeCore({
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
          // Different node shapes based on type
          {
            selector: 'node[type = "users"]',
            style: {
              'shape': 'ellipse'
            }
          },
          {
            selector: 'node[type = "games"]',
            style: {
              'shape': 'diamond'
            }
          },
          {
            selector: 'node[type = "actors"]',
            style: {
              'shape': 'triangle'
            }
          },
          {
            selector: 'node[type = "chat"]',
            style: {
              'shape': 'round-rectangle'
            }
          },
          {
            selector: 'node[type = "agreements"]',
            style: {
              'shape': 'hexagon'
            }
          },
          {
            selector: 'node[type = "values"]',
            style: {
              'shape': 'round-rectangle'
            }
          },
          {
            selector: 'node[type = "capabilities"]',
            style: {
              'shape': 'round-triangle'
            }
          },
          {
            selector: 'node[type = "cards"]',
            style: {
              'shape': 'rectangle'
            }
          },
          {
            selector: 'node[type = "decks"]',
            style: {
              'shape': 'star'
            }
          },
          // Highlighting styles
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
          {
            selector: '.faded',
            style: {
              'opacity': 0.3,
              'z-index': 0
            }
          },
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
      
      // Initialize game list for game layout option
      loadAvailableGames();
      
      // Apply initial layout
      applyLayout();
      
      // Add enhanced interactivity
      cy.on('tap', 'node', function(evt){
        const node = evt.target;
        console.log('Node clicked: ' + node.id());
        
        // Clear all previous highlighting
        cy.elements().removeClass('highlighted related faded');
        
        // Highlight the selected node
        node.addClass('highlighted');
        
        // Highlight connected nodes and edges
        const connectedEdges = node.connectedEdges();
        const connectedNodes = node.neighborhood('node');
        
        connectedEdges.addClass('related');
        connectedNodes.addClass('related');
        
        // Fade all other elements
        cy.elements().not(node).not(connectedEdges).not(connectedNodes).addClass('faded');
        
        // Dispatch the event for parent components
        dispatch('nodeSelected', {
          id: node.id(),
          type: node.data('type'),
          label: node.data('label')
        });
      });
      
      // Reset highlighting when clicking on background
      cy.on('tap', function(evt){
        if (evt.target === cy) {
          cy.elements().removeClass('highlighted related faded');
          dispatch('selectionCleared');
        }
      });
      
      // Fit the view to show all elements
      cy.fit();
      cy.center();
      
      loading = false;
    } catch (err) {
      console.error('Error initializing Cytoscape:', err);
      error = `Error: ${err.message || 'Could not initialize graph'}`;
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
            <label class="flex items-center gap-1 p-1 rounded bg-surface-100-800 hover:bg-surface-200-700 cursor-pointer text-xs">
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
            <label class="flex items-center gap-1 p-1 rounded bg-surface-100-800 hover:bg-surface-200-700 cursor-pointer text-xs">
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
  
  /* Super small checkboxes */
  .checkbox-xs {
    width: 0.75rem !important;
    height: 0.75rem !important;
    min-width: 0.75rem !important;
    min-height: 0.75rem !important;
    border-width: 1px !important;
  }
  
  /* Compact controls */
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