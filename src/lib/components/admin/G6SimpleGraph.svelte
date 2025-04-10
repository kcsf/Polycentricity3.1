<script>
  import { onMount, onDestroy } from 'svelte';
  import { Graph } from '@antv/g6'; // Use named import specifically for Graph

  export let nodes = [];
  export let edges = [];

  let container;
  let graph;
  let loading = true;
  let error = null;

  onMount(() => {
    if (typeof window !== 'undefined' && container) {
      try {
        console.log('Initializing G6 graph...');
        
        // Create the graph instance
        graph = new Graph({
          container, // Use the container element
          width: container.clientWidth || 800,
          height: 600,
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 100
          },
          modes: {
            default: ['drag-canvas', 'zoom-canvas', 'drag-node']
          },
          node: {
            style: {
              fill: '#5B8FF9',
              stroke: '#5B8FF9',
              lineWidth: 2
            },
            labelCfg: {
              position: 'bottom',
              style: {
                fill: '#000',
                fontSize: 12
              }
            }
          },
          edge: {
            style: {
              stroke: '#aaa',
              lineWidth: 1,
              endArrow: true
            },
            labelCfg: {
              style: {
                fill: '#666',
                fontSize: 10
              }
            }
          }
        });
        
        // Process nodes and edges for visualization
        const graphData = {
          nodes: nodes.map(node => ({
            id: node.id,
            label: node.label || (typeof node.id === 'string' ? node.id.substring(0, 8) : 'Node'),
            size: 30,
          })),
          edges: edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            label: edge.label || '',
            type: 'line' // Explicitly set the type
          }))
        };
        
        console.log('Setting graph data:', graphData);
        
        // Set the data and render
        graph.data(graphData);
        graph.render();
        
        // Add a timeout for fitView to make sure rendering is complete
        setTimeout(() => {
          try {
            graph.fitView();
          } catch (e) {
            console.error('Error in fitView:', e);
          }
        }, 500);
        
        // Add mouse interactions for better UX
        graph.on('node:mouseenter', (evt) => {
          const item = evt.item;
          graph.setItemState(item, 'hover', true);
        });
        
        graph.on('node:mouseleave', (evt) => {
          const item = evt.item;
          graph.setItemState(item, 'hover', false);
        });
        
        graph.on('node:click', (evt) => {
          try {
            const node = evt.item.getModel();
            console.log('Node clicked:', node);
          } catch (e) {
            console.error('Error in node click handler:', e);
          }
        });
        
        // Simple resize handler
        const handleResize = () => {
          if (graph && !graph.destroyed) {
            try {
              graph.changeSize(container.clientWidth || 800, 600);
              graph.fitView();
            } catch (e) {
              console.error('Error during resize:', e);
            }
          }
        };
        
        window.addEventListener('resize', handleResize);
        loading = false;
        
        // Cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
          if (graph && !graph.destroyed) {
            try {
              graph.destroy();
            } catch (e) {
              console.error('Error destroying graph:', e);
            }
          }
        };
      } catch (err) {
        console.error('Failed to create graph:', err);
        error = `Error: ${err.message || 'Failed to initialize graph'}`;
        loading = false;
      }
    }
  });
  
  // Update graph when nodes or edges change
  $: if (graph && nodes && edges && !loading) {
    try {
      const graphData = {
        nodes: nodes.map(node => ({
          id: node.id,
          label: node.label || (typeof node.id === 'string' ? node.id.substring(0, 8) : 'Node'),
          size: 30,
        })),
        edges: edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          label: edge.label || '',
          type: 'line'
        }))
      };
      
      graph.changeData(graphData);
      
      setTimeout(() => {
        try {
          graph.fitView();
        } catch (e) {
          console.error('Error in fitView after data change:', e);
        }
      }, 300);
    } catch (err) {
      console.error('Error updating graph data:', err);
    }
  }
</script>

<div class="graph-container" bind:this={container} style="width: 100%; height: 600px; background: #f8f9fa; border-radius: 8px;">
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
    position: relative;
    overflow: hidden;
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