<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  
  export let nodes = [];
  export let edges = [];
  
  let container;
  let cy;
  let loading = true;
  let error = null;

  onMount(async () => {
    if (!browser || !container) return;
    
    try {
      loading = true;
      error = null;
      
      // Dynamically import cytoscape and cise layout to avoid SSR issues
      const [cytoscape, ciseLayout] = await Promise.all([
        import('cytoscape'),
        import('cytoscape-cise')
      ]);
      
      const cytoscapeCore = cytoscape.default || cytoscape;
      const cise = ciseLayout.default || ciseLayout;
      
      // Register the cise layout
      cytoscapeCore.use(cise);
      
      // Process data for cytoscape format
      const elements = [];
      
      // Add nodes
      nodes.forEach(node => {
        const nodeColor = 
          node.type === 'users' ? '#5B8FF9' : 
          node.type === 'games' ? '#5AD8A6' : 
          node.type === 'actors' ? '#5D7092' :
          node.type === 'chat' ? '#F6BD16' :
          node.type === 'agreements' ? '#E8684A' : '#999';
          
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
      edges.forEach(edge => {
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
        ],
        layout: {
          // Use CISE layout - Circular / Spring Embedder specifically for clustered graphs
          name: 'cise',
          
          // CLUSTERING OPTIONS
          // Define clusters based on node type
          clusters: (function() {
            const clusterMap = {};
            nodes.forEach(node => {
              if (node.type) {
                if (!clusterMap[node.type]) {
                  clusterMap[node.type] = [];
                }
                clusterMap[node.type].push(node.id);
              }
            });
            return Object.values(clusterMap);
          })(),
          
          // LAYOUT OPTIONS
          // Circular layout of clusters
          allowNodesInsideCircle: false,
          // Quality vs performance (0.0 - 1.0)
          quality: 0.8,
          // Make clusters more compact
          nodeSeparation: 20,
          // Animation
          animate: true,
          animationDuration: 500,
          // Physics parameters
          gravity: 0.4,
          gravityRange: 3.8,
          // Prevent overlapping
          idealInterClusterEdgeLengthCoefficient: 1.5,
          // Other parameters
          refresh: 10,
          fit: true,
          padding: 30,
          // Show cluster circles (boundaries)
          // Disabled because it conflicts with our styling
          showClusters: false
        }
      });
      
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
      });
      
      // Reset highlighting when clicking on background
      cy.on('tap', function(evt){
        if (evt.target === cy) {
          cy.elements().removeClass('highlighted related faded');
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
    background-color: #f8f9fa;
    border-radius: 8px;
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
    border-top-color: #5B8FF9;
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
</style>