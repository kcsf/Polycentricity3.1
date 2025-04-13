<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  
  export let nodes = [];
  export let edges = [];
  
  let container;
  let cy;
  let loading = true;
  let error = null;
  
  // Node and edge type filtering
  let availableNodeTypes = [];
  let selectedNodeTypes = [];
  let filteredNodes = [];
  let filteredEdges = [];
  
  // Edge type filtering
  let availableEdgeTypes = [];
  let selectedEdgeTypes = [];
  
  // Layout options
  const layouts = [
    { id: 'default', name: 'Default Hierarchy' },
    { id: 'cise', name: 'Circular Clusters (CISE)' },
    { id: 'concentric', name: 'Concentric' },
    { id: 'grid', name: 'Grid' },
    { id: 'breadthfirst', name: 'Tree / Hierarchy' },
    { id: 'cose', name: 'Force-Directed (CoSE)' },
    { id: 'dagre', name: 'Directed (DAG)' }
  ];
  let selectedLayout = layouts[0];
  
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
  
  function applyFilters() {
    // Filter nodes by selected types (if any selected)
    filteredNodes = selectedNodeTypes.length === 0 
      ? [...nodes] 
      : nodes.filter(node => selectedNodeTypes.includes(node.type));
    
    // First, filter edges based on node visibility
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    let nodeFilteredEdges = edges.filter(edge => 
      filteredNodeIds.has(edge.source) && 
      filteredNodeIds.has(edge.target)
    );
    
    // Then, filter edges based on edge type selection (if any selected)
    filteredEdges = selectedEdgeTypes.length === 0
      ? nodeFilteredEdges
      : nodeFilteredEdges.filter(edge => {
          const edgeType = getEdgeType(edge);
          return selectedEdgeTypes.includes(edgeType);
        });
    
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
    
    let layoutOptions = {};
    
    // Configure layout based on selection
    switch (selectedLayout.id) {
      // Our custom "Default" hierarchical layout that places nodes in exact rows:
      // Row 1: Users
      // Row 2: Decks
      // Row 3: Cards
      // Row 4: Values and Capabilities
      case 'default':
        layoutOptions = {
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
            
            // Get node counts for each type to spread them horizontally
            const nodeCounts = {};
            const nodeIndices = {};
            cy.nodes().forEach(n => {
              const type = n.data('type');
              if (!nodeCounts[type]) {
                nodeCounts[type] = 0;
                nodeIndices[type] = 0;
              }
              nodeCounts[type]++;
            });
            
            // Get node type
            const nodeType = node.data('type');
            
            // Calculate vertical position (y-coordinate) based on node type
            // This creates exactly 4 rows as requested
            let row = 0;
            if (nodeType === 'users') row = 0;
            else if (nodeType === 'decks') row = 1;
            else if (nodeType === 'cards') row = 2;
            else if (nodeType === 'values' || nodeType === 'capabilities') row = 3;
            else row = 4; // any other types go at the bottom
            
            // Initialize nodeIndices if not set
            if (nodeIndices[nodeType] === undefined) {
              nodeIndices[nodeType] = 0;
            }
            
            // Calculate horizontal spacing based on number of nodes in this row
            const horizSpacing = canvasWidth / (nodeCounts[nodeType] || 1);
            const xPos = (nodeIndices[nodeType] * horizSpacing) + (horizSpacing / 2);
            
            // Increment index for this node type
            nodeIndices[nodeType]++;
            
            // Calculate vertical position with even spacing
            const rowHeight = containerHeight / 5; // 5 possible rows total
            const yPos = (row * rowHeight) + (rowHeight / 2);
            
            return { x: xPos, y: yPos };
          }
        };
        break;
        
      case 'cise':
        layoutOptions = {
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
        };
        break;
        
      case 'concentric':
        layoutOptions = {
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
          rankDir: 'TB', // Top to bottom
          animate: true,
          padding: 30
        };
        break;
    }
    
    // Apply the selected layout
    const layout = cy.layout(layoutOptions);
    layout.run();
  }
  
  function handleLayoutChange() {
    if (cy) {
      applyLayout();
    }
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
      
      // Get unique node types and set them as available for filtering
      availableNodeTypes = [...new Set(nodes.map(node => node.type))].sort();
      selectedNodeTypes = [...availableNodeTypes]; // Select all by default
      
      // Get unique edge types (connections between node types)
      const edgeTypes = new Set();
      edges.forEach(edge => {
        const edgeType = getEdgeType(edge);
        if (edgeType !== 'unknown') {
          edgeTypes.add(edgeType);
        }
      });
      availableEdgeTypes = [...edgeTypes].sort();
      selectedEdgeTypes = [...availableEdgeTypes]; // Select all by default
      
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
                on:change={() => toggleNodeType(type)}
                class="checkbox checkbox-xs"
              />
              <span class="w-2 h-2 rounded-full" style="background-color: {getColorForNodeType(type)}"></span>
              <span class="truncate">{type}</span>
            </label>
          {/each}
        </div>
        <div class="flex gap-1 mt-1">
          <button class="btn btn-xs variant-ghost" on:click={selectAllNodeTypes}>All</button>
          <button class="btn btn-xs variant-ghost" on:click={clearNodeTypeSelection}>None</button>
        </div>
      </div>
      
      <!-- Layout Selector -->
      <div class="flex-none w-full md:w-48">
        <h3 class="text-sm font-semibold mb-1">Layout</h3>
        <select 
          class="select select-xs bg-surface-100-800 border border-surface-300-600 rounded w-full text-xs"
          bind:value={selectedLayout}
          on:change={handleLayoutChange}
        >
          {#each layouts as layout}
            <option value={layout}>{layout.name}</option>
          {/each}
        </select>
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
                on:change={() => toggleEdgeType(type)}
                class="checkbox checkbox-xs"
              />
              <span class="truncate">{type}</span>
            </label>
          {/each}
        </div>
        <div class="flex gap-1 mt-1">
          <button class="btn btn-xs variant-ghost" on:click={selectAllEdgeTypes}>All</button>
          <button class="btn btn-xs variant-ghost" on:click={clearEdgeTypeSelection}>None</button>
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