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
        // Handle both ESM and CommonJS exports
        G6 = g6Module.default || g6Module;
        
        if (!G6 || !G6.Graph) {
          console.error('G6 Graph class is not available!', g6Module);
          return;
        }
        
        console.log('G6 loaded:', G6);
        console.log('G6 Graph class methods:', Object.getOwnPropertyNames(G6.Graph.prototype));
        
        if (!G6 || !container) {
          console.error('G6 or container not available');
          return;
        }
        
        console.log('Graph constructor:', G6.Graph);

        // Initialize graph
        try {
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
        } catch (err) {
          console.error('Error creating G6 graph instance:', err);
        }
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
    
    // Use the correct method based on the found API
    try {
      console.log('Graph prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(graph)));
      
      if (typeof graph.setData === 'function') {
        console.log('Using graph.setData() method');
        graph.setData(data);
      } else if (typeof graph.data === 'function') {
        console.log('Using graph.data() method');
        graph.data(data);
      } else {
        console.error('No compatible method found to set graph data');
      }
      
      graph.render();
    } catch (error) {
      console.error('Error rendering graph:', error);
    }
    
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