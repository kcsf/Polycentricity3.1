<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import G6 from '@antv/g6';
  import { getGun, nodes as gunNodes } from '$lib/services/gunService';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let width = '100%';
  export let height = '700px';
  export let showControls = true;
  
  // Local variables
  let container: HTMLElement;
  let graph: any = null;
  let data: any = {
    nodes: [],
    edges: []
  };
  let loading = true;
  let error: string | null = null;
  let nodeGroups: Map<string, any[]> = new Map();
  let colorMap: Map<string, string> = new Map();
  
  // Function to generate colors for node types
  function getColor(nodeType: string): string {
    if (colorMap.has(nodeType)) {
      return colorMap.get(nodeType)!;
    }
    
    // Generate a deterministic color based on node type
    const colors = [
      '#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', 
      '#E8684A', '#6DC8EC', '#9270CA', '#FF9D4D',
      '#269A99', '#FF99C3'
    ];
    
    const index = colorMap.size % colors.length;
    const color = colors[index];
    colorMap.set(nodeType, color);
    return color;
  }
  
  // Function to fetch all data from Gun.js
  async function fetchGunData() {
    console.log('Starting Gun.js data fetch');
    const gun = getGun();
    if (!gun) {
      console.error('Gun instance not initialized');
      error = 'Gun instance not initialized';
      loading = false;
      return;
    }
    
    console.log('Gun nodes available:', gunNodes);
    loading = true;
    
    try {
      // Clear existing data
      data = {
        nodes: [],
        edges: []
      };
      nodeGroups.clear();
      
      // Helper function to process each node type
      const processNodeType = (nodeName: string) => {
        return new Promise<void>((resolve) => {
          console.log(`Processing node type: ${nodeName}`);
          const nodeGroup: any[] = [];
          
          try {
            gun.get(nodeName).map().once((nodeData: any, nodeId: string) => {
              console.log(`Found node in ${nodeName}:`, nodeId, nodeData);
              
              if (!nodeData) {
                console.log(`Skipping null/undefined node data for ${nodeId}`);
                return;
              }
              
              try {
                // Create a node
                const nodeLabel = nodeData.name || nodeData.title || nodeData.role_title || 
                                  (nodeId && nodeId.substring ? nodeId.substring(0, 8) : 'Unknown');
                
                const node = {
                  id: `${nodeName}_${nodeId}`,
                  nodeId: nodeId,
                  label: nodeLabel,
                  type: nodeName,
                  style: {
                    fill: getColor(nodeName),
                    stroke: getColor(nodeName)
                  },
                  data: nodeData
                };
                
                nodeGroup.push(node);
                console.log(`Added node: ${node.label}`);
              } catch (nodeErr) {
                console.error(`Error processing node ${nodeId}:`, nodeErr);
              }
            });
          } catch (mapErr) {
            console.error(`Error mapping over ${nodeName}:`, mapErr);
          }
          
          // We need to wait a bit for Gun to process the map
          setTimeout(() => {
            console.log(`Node group for ${nodeName} has ${nodeGroup.length} nodes`);
            if (nodeGroup.length > 0) {
              nodeGroups.set(nodeName, nodeGroup);
            }
            resolve();
          }, 300);
        });
      };
      
      // Process all node types
      const nodeTypePromises = Object.values(gunNodes).map(processNodeType);
      await Promise.all(nodeTypePromises);
      
      // Build the actual nodes and edges
      buildGraphData();
      loading = false;
      
      // Initialize the graph
      initializeGraph();
    } catch (err) {
      console.error('Error fetching Gun data:', err);
      error = `Failed to load data: ${err}`;
      loading = false;
    }
  }
  
  // Build the graph data structure
  function buildGraphData() {
    console.log('Building graph data from node groups:', nodeGroups);
    const nodes: any[] = [];
    const edges: any[] = [];
    
    // Add all nodes from all groups
    nodeGroups.forEach((group, groupName) => {
      console.log(`Adding ${group.length} nodes from ${groupName}`);
      nodes.push(...group);
    });
    
    // Add edges between related nodes
    nodeGroups.forEach((group, groupName) => {
      group.forEach(node => {
        const nodeData = node.data;
        
        // Look for properties that reference other nodes
        Object.entries(nodeData).forEach(([key, value]) => {
          if (key === 'id' || key === '_' || key === '#') return;
          
          // If it's a reference to another node
          if (typeof value === 'string' && value.length > 8) {
            // Try to find the target node
            for (const [targetGroup, targetNodes] of nodeGroups.entries()) {
              const targetNode = targetNodes.find(n => n.nodeId === value);
              if (targetNode) {
                edges.push({
                  id: `edge_${node.id}_${targetNode.id}`,
                  source: node.id,
                  target: targetNode.id,
                  label: key,
                  style: {
                    stroke: '#aaa',
                    lineWidth: 2,
                    endArrow: true
                  }
                });
                break;
              }
            }
          }
          
          // Special handling for arrays and objects that contain references
          if (Array.isArray(value)) {
            value.forEach((item: any) => {
              if (typeof item === 'string' && item.length > 8) {
                // Try to find the target node
                for (const [targetGroup, targetNodes] of nodeGroups.entries()) {
                  const targetNode = targetNodes.find(n => n.nodeId === item);
                  if (targetNode) {
                    edges.push({
                      id: `edge_${node.id}_${targetNode.id}_${key}`,
                      source: node.id,
                      target: targetNode.id,
                      label: key,
                      style: {
                        stroke: '#aaa',
                        lineWidth: 2,
                        endArrow: true
                      }
                    });
                    break;
                  }
                }
              }
            });
          } else if (typeof value === 'object' && value !== null) {
            // Looking for special Gun.js format with references (keys with value 'true')
            Object.entries(value).forEach(([refKey, refValue]) => {
              if (refValue === true) {
                // Try to find the target node
                for (const [targetGroup, targetNodes] of nodeGroups.entries()) {
                  const targetNode = targetNodes.find(n => n.nodeId === refKey);
                  if (targetNode) {
                    edges.push({
                      id: `edge_${node.id}_${targetNode.id}_${key}`,
                      source: node.id,
                      target: targetNode.id,
                      label: key,
                      style: {
                        stroke: '#aaa',
                        lineWidth: 2,
                        endArrow: true
                      }
                    });
                    break;
                  }
                }
              }
            });
          }
        });
      });
    });
    
    // Set the graph data
    data = {
      nodes,
      edges
    };
  }
  
  // Initialize G6 graph
  function initializeGraph() {
    if (graph) {
      graph.destroy();
    }
    
    if (!container) return;
    
    // Configure plugins
    const plugins = [];
    
    if (showControls) {
      const toolbar = new G6.ToolBar({
        position: { x: 10, y: 10 }
      });
      
      const minimap = new G6.Minimap({
        size: [150, 100],
        className: 'g6-minimap',
        type: 'delegate'
      });
      
      plugins.push(toolbar);
      plugins.push(minimap);
    }
    
    // Configure node and edge styles
    const defaultNodeStyle = {
      size: 30,
      labelCfg: {
        style: {
          fill: '#000',
          fontSize: 12
        }
      },
      style: {
        fill: '#5B8FF9',
        stroke: '#5B8FF9',
        lineWidth: 2
      }
    };
    
    const defaultEdgeStyle = {
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
    };
    
    // Initialize the graph
    graph = new G6.Graph({
      container,
      width: container.clientWidth,
      height: parseInt(height),
      plugins,
      modes: {
        default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'],
      },
      layout: {
        type: 'force',
        preventOverlap: true,
        linkDistance: 200,
        nodeStrength: -100,
        alphaDecay: 0.01
      },
      defaultNode: defaultNodeStyle,
      defaultEdge: defaultEdgeStyle,
      nodeStateStyles: {
        selected: {
          stroke: '#000',
          lineWidth: 3
        },
        hover: {
          stroke: '#666',
          lineWidth: 3
        }
      }
    });
    
    // Register node and edge events
    graph.on('node:click', (evt: any) => {
      const nodeItem = evt.item;
      const model = nodeItem.getModel();
      console.log('Node clicked:', model);
      
      // Dispatch the node click event
      dispatch('nodeClick', { 
        node: {
          id: model.id,
          nodeId: model.nodeId,
          label: model.label,
          type: model.type,
          data: model.data
        }
      });
    });
    
    graph.on('node:mouseenter', (evt: any) => {
      const nodeItem = evt.item;
      graph.setItemState(nodeItem, 'hover', true);
    });
    
    graph.on('node:mouseleave', (evt: any) => {
      const nodeItem = evt.item;
      graph.setItemState(nodeItem, 'hover', false);
    });
    
    // Render the graph
    graph.data(data);
    graph.render();
    
    // Auto fit view after rendering
    setTimeout(() => {
      graph.fitView();
    }, 500);
  }
  
  // Handle window resize
  function handleResize() {
    if (graph && container) {
      graph.changeSize(container.clientWidth, parseInt(height));
      graph.fitView();
    }
  }
  
  // Component lifecycle
  onMount(() => {
    // Make sure we're in the browser environment
    if (typeof window !== 'undefined' && container) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        fetchGunData();
        window.addEventListener('resize', handleResize);
      }, 100);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
        if (graph) {
          graph.destroy();
        }
      }
    };
  });
  
  onDestroy(() => {
    if (typeof window !== 'undefined' && graph) {
      graph.destroy();
    }
  });
  
  // Function to refresh the data
  export function refreshData() {
    fetchGunData();
  }
</script>

<div class="g6-graph-container" style="width: {width}; height: {height}">
  {#if loading}
    <div class="loading-overlay flex items-center justify-center">
      <div class="spinner-third w-8 h-8"></div>
      <span class="ml-3">Loading Graph Data...</span>
    </div>
  {/if}
  
  {#if error}
    <div class="error-message">
      <p class="text-error-500">{error}</p>
    </div>
  {/if}
  
  <div class="graph-wrapper" bind:this={container}></div>
  
  {#if showControls}
    <div class="graph-legend">
      <h4 class="text-sm font-semibold mb-2">Node Types</h4>
      <div class="legend-items">
        {#each Array.from(colorMap.entries()) as [nodeType, color]}
          <div class="legend-item flex items-center mb-1">
            <span class="color-box" style="background-color: {color}"></span>
            <span class="text-xs">{nodeType}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .g6-graph-container {
    position: relative;
    background-color: #f5f5f5;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .graph-wrapper {
    width: 100%;
    height: 100%;
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.7);
    z-index: 10;
  }
  
  .error-message {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 10px;
    background-color: #fff4f4;
    border: 1px solid #ffcdd2;
    border-radius: 4px;
    z-index: 10;
  }
  
  .graph-legend {
    position: absolute;
    bottom: 20px;
    right: 20px;
    padding: 10px;
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    z-index: 5;
    max-width: 200px;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
  }
  
  .color-box {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    margin-right: 6px;
  }
  
  /* G6 custom styles */
  :global(.g6-tooltip) {
    border: 1px solid #e2e2e2;
    border-radius: 4px;
    font-size: 12px;
    color: #545454;
    background-color: rgba(255, 255, 255, 0.9);
    padding: 10px;
    box-shadow: rgb(174, 174, 174) 0px 0px 10px;
  }
  
  :global(.g6-minimap) {
    position: absolute;
    bottom: 0;
    right: 0;
    border: 1px solid #e2e2e2;
    border-radius: 2px;
  }
</style>