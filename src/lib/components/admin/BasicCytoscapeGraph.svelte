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
      
      // Dynamically import cytoscape to avoid SSR issues
      const cytoscape = await import('cytoscape');
      const cytoscapeCore = cytoscape.default || cytoscape;
      
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
          name: 'grid',
          rows: Math.ceil(Math.sqrt(nodes.length)),
          animate: false
        }
      });
      
      // Add basic interactivity
      cy.on('tap', 'node', function(evt){
        console.log('Node clicked: ' + evt.target.id());
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