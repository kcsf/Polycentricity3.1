<script>
  import { onMount, onDestroy } from 'svelte';
  
  export let nodes = [];
  export let edges = [];
  
  let container;
  let graph;
  let G6;
  
  onMount(async () => {
    if (typeof window !== 'undefined') {
      try {
        // Import G6 only in browser
        const g6Module = await import('@antv/g6');
        G6 = g6Module;
        
        console.log('G6 loaded:', G6);
        
        if (!G6 || !container) {
          console.error('G6 or container not available');
          return;
        }
        
        // Initialize graph
        graph = new G6.Graph({
          container,
          width: container.clientWidth,
          height: 600,
          modes: {
            default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'],
          },
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 200,
            nodeStrength: -100
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
          }
        });
        
        // Add event listeners
        graph.on('node:mouseenter', (evt) => {
          const nodeItem = evt.item;
          graph.setItemState(nodeItem, 'hover', true);
        });
        
        graph.on('node:mouseleave', (evt) => {
          const nodeItem = evt.item;
          graph.setItemState(nodeItem, 'hover', false);
        });
        
        graph.on('node:click', (evt) => {
          const node = evt.item.getModel();
          console.log('Node clicked:', node);
        });
        
        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
          if (graph && !graph.get('destroyed')) {
            graph.changeSize(container.clientWidth, 600);
            graph.fitView();
          }
        });
        
        resizeObserver.observe(container);
        
        // Initial render
        updateGraph();
        
        // Cleanup
        return () => {
          resizeObserver.disconnect();
          if (graph && !graph.get('destroyed')) {
            graph.destroy();
          }
        };
      } catch (error) {
        console.error('Error initializing G6:', error);
      }
    }
  });
  
  $: if (graph && nodes && edges) {
    updateGraph();
  }
  
  function updateGraph() {
    if (!graph || !nodes || !edges) return;
    
    const data = {
      nodes: nodes.map(node => ({
        ...node,
        type: 'circle',
        size: 30
      })),
      edges: edges.map(edge => ({
        ...edge,
        type: 'line'
      }))
    };
    
    console.log('Updating graph with data:', data);
    
    graph.data(data);
    graph.render();
    
    setTimeout(() => {
      graph.fitView();
    }, 300);
  }
  
  onDestroy(() => {
    if (graph && !graph.get('destroyed')) {
      graph.destroy();
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