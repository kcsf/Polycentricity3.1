<script>
  import { onMount, onDestroy } from 'svelte';
  // Import the G6 module
  let G6: any;
  
  // We'll load G6 dynamically to avoid SSR issues

  export let nodes = [];
  export let edges = [];

  let container;
  let graph;

  onMount(() => {
    if (typeof window !== 'undefined' && container) {
      try {
        const simpleNodes = nodes.map(node => ({
          id: node.id,
          label: node.label || (typeof node.id === 'string' ? node.id.substring(0, 8) : 'Node'),
          size: 30,
          style: {
            fill: node.style?.fill || '#5B8FF9',
            stroke: node.style?.stroke || '#5B8FF9'
          }
        }));
        
        const simpleEdges = edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          label: edge.label || ''
        }));
        
        const data = {
          nodes: simpleNodes,
          edges: simpleEdges
        };
        
        // Initialize graph with data directly
        graph = new G6.Graph({
          container,
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
          },
          data: data
        });
        
        graph.render();
        graph.fitView();
        
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
      }
    }
  });
</script>

<div class="graph-container" bind:this={container} style="width: 100%; height: 600px; background: #f8f9fa; border-radius: 8px;"></div>

<style>
  .graph-container {
    position: relative;
    overflow: hidden;
  }
</style>