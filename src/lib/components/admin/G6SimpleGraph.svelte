<script>
  import { onMount, onDestroy } from 'svelte';
  // Use dynamic import for G6 to avoid SSR issues
  import * as g6Module from '@antv/g6';

  export let nodes = [];
  export let edges = [];

  let container;
  let graph;
  let loading = true;
  let error = null;

  onMount(async () => {
    if (typeof window !== 'undefined' && container) {
      try {
        const Graph = g6Module.Graph || g6Module.default?.Graph;
        
        if (!Graph) {
          console.error('G6 Graph not found in module:', g6Module);
          error = 'G6 Graph component not available';
          loading = false;
          return;
        }

        console.log('G6 loaded successfully, creating graph...');
        
        // Process nodes for visualization
        const simpleNodes = nodes.map(node => ({
          id: node.id,
          label: node.label || (typeof node.id === 'string' ? node.id.substring(0, 8) : 'Node'),
          size: 30,
          style: {
            fill: node.style?.fill || '#5B8FF9',
            stroke: node.style?.stroke || '#5B8FF9'
          }
        }));
        
        // Process edges for visualization
        const simpleEdges = edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          label: edge.label || ''
        }));
        
        const data = {
          nodes: simpleNodes,
          edges: simpleEdges
        };
        
        console.log('Initializing graph with data:', data);
        
        // Initialize graph with data directly
        graph = new Graph({
          container: container,
          width: container.clientWidth || 800,
          height: 600,
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 100
          },
          defaultNode: {
            size: 30,
            style: {
              fill: '#5B8FF9',
              stroke: '#5B8FF9',
              lineWidth: 2
            },
            labelCfg: {
              style: {
                fill: '#000',
                fontSize: 12
              }
            }
          },
          defaultEdge: {
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
          },
          modes: {
            default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select']
          }
        });
        
        // Set data and render
        graph.data(data);
        graph.render();
        
        setTimeout(() => {
          try {
            graph.fitView();
          } catch (e) {
            console.error('Error in fitView:', e);
          }
        }, 300);
        
        // Simple resize handler
        const handleResize = () => {
          if (graph && container) {
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
        
        return () => {
          window.removeEventListener('resize', handleResize);
          if (graph) {
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