<script>
  import { onMount, onDestroy } from 'svelte';
  import { Graph } from '@antv/g6'; // Named import for Graph

  export let nodes = [];
  export let edges = [];

  let container;
  let graph;

  onMount(async () => {
    if (typeof window !== 'undefined') {
      try {
        // Initialize graph
        graph = new Graph({
          container,
          width: container.clientWidth,
          height: 600,
          plugins: ['toolbar'], // Use string name for ToolBar
          modes: {
            default: ['drag-element-force', 'zoom-canvas', 'click-select'],
          },
          layout: {
            type: 'd3-force',
            link: {
              distance: (d) => {
                if (d.source.id === 'node0') {
                  return 100;
                }
                return 30;
              },
              strength: (d) => {
                if (['node1', 'node2', 'node3'].includes(d.source.id)) {
                  return 0.7;
                }
                return 0.1;
              },
            },
            manyBody: {
              strength: (d) => {
                if (d.isLeaf) {
                  return -50;
                }
                return -10;
              },
            },
          },
          node: {
            style: {
              size: (d) => d.size || 30,
              fill: '#5B8FF9',
              stroke: '#5B8FF9',
              lineWidth: 2,
            },
            labelCfg: {
              position: 'bottom',
              style: {
                fill: '#000',
                fontSize: 12,
              },
            },
          },
          edge: {
            style: {
              stroke: '#aaa',
              lineWidth: 1,
              endArrow: true,
            },
            labelCfg: {
              style: {
                fill: '#666',
                fontSize: 10,
              },
            },
          },
        });

        // Add event listeners for interactivity
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
          if (graph) {
            try {
              // Check if graph is destroyed using try/catch instead of get method
              const destroyed = graph.destroyed || false;
              if (!destroyed) {
                graph.changeSize(container.clientWidth, 600);
                graph.fitView();
              }
            } catch (err) {
              console.error('Error in resize handler:', err);
            }
          }
        });

        resizeObserver.observe(container);

        // Initial render
        updateGraph();

        // Cleanup
        return () => {
          resizeObserver.disconnect();
          if (graph) {
            try {
              graph.destroy();
            } catch (err) {
              console.error('Error in cleanup function:', err);
            }
          }
        };
      } catch (err) {
        console.error('Error creating G6 graph instance:', err);
      }
    }
  });

  $: if (graph && nodes && edges) {
    updateGraph();
  }

  function updateGraph() {
    if (!graph || !nodes || !edges) return;

    // Create a clean data structure with only the properties G6 expects
    const cleanNodes = nodes.map((node) => {
      return {
        id: node.id,
        label: node.label || (typeof node.id === 'string' ? node.id.substring(0, 8) : 'Node'),
        size: 30,
        isLeaf: false,
        style: {
          fill: node.style?.fill || '#5B8FF9',
          stroke: node.style?.stroke || '#5B8FF9'
        }
      };
    });
    
    const cleanEdges = edges.map((edge) => {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label || '',
        type: 'line'
      };
    });
    
    // Create the data object
    const data = {
      nodes: cleanNodes,
      edges: cleanEdges
    };

    console.log('Updating graph with clean data:', data);

    try {
      // Clear previous data first
      graph.clear();
      // Then set new data
      graph.data(data);
      graph.render();
    } catch (error) {
      console.error('Error rendering graph:', error);
      console.error('Error details:', error.message, error.stack);
    }

    setTimeout(() => {
      graph.fitView();
    }, 300);
  }

  onDestroy(() => {
    if (graph) {
      try {
        graph.destroy();
      } catch (err) {
        console.error('Error destroying graph:', err);
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