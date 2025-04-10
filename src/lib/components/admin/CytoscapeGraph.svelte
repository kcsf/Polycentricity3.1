<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  
  // Define props
  export let nodes = [];
  export let edges = [];
  
  // DOM reference to our container
  let container;
  
  // Hold the graph instance
  let cy;
  
  // Status flags
  let loading = true;
  let error = null;

  // Process graph data for Cytoscape format
  function processCytoscapeData() {
    try {
      const elements = [];

      // Process nodes
      for (const node of nodes) {
        elements.push({
          data: {
            id: node.id,
            displayName: node.label || node.id.substring(0, 10),
            kind: node.type || 'default',
            alarmSeverity: 'normal',
            operationalState: 'up',
            _hidden: '',
            // Store the original data for reference
            originalData: node
          },
          classes: 'nodeIcon'
        });
      }

      // Process edges
      for (const edge of edges) {
        elements.push({
          data: {
            id: edge.id || `edge-${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            label: edge.label || '',
            // Store the original data for reference
            originalData: edge
          }
        });
      }

      return elements;
    } catch (err) {
      console.error('Error processing data for Cytoscape:', err);
      error = `Error processing graph data: ${err.message}`;
      return [];
    }
  }

  // Initialize the Cytoscape graph
  async function initializeCytoscape() {
    if (!browser || !container) return;
    
    try {
      loading = true;
      error = null;
      
      // We need to dynamically import Cytoscape and its extensions to avoid SSR issues
      const [
        cytoscape, 
        dagre, 
        nodeHtmlLabel, 
        contextMenus
      ] = await Promise.all([
        import('cytoscape'),
        import('cytoscape-dagre'),
        import('cytoscape-node-html-label'),
        import('cytoscape-context-menus')
      ]);
      
      // Get the default exports
      const cytoscapeCore = cytoscape.default;
      const dagreLayout = dagre.default;
      const nodeHtmlLabelExt = nodeHtmlLabel.default || nodeHtmlLabel;
      const contextMenusExt = contextMenus.default || contextMenus;
      
      // Register the extensions
      cytoscapeCore.use(dagreLayout);
      
      if (typeof cytoscapeCore("core", "nodeHtmlLabel") === "undefined") {
        nodeHtmlLabelExt(cytoscapeCore);
      }
      
      if (typeof cytoscapeCore("core", "contextMenus") === "undefined") {
        contextMenusExt(cytoscapeCore);
      }
      
      // Define context menu options
      const contextMenuOptions = {
        evtType: ["cxttap"], // Context menu on right click
        menuItems: [
          {
            id: "details",
            content: "View Details...",
            tooltipText: "View Details",
            selector: "node",
            onClickFunction: function (event) {
              const node = event.target.data();
              console.log('View details for:', node);
              // TODO: Show node details in a modal or panel
            },
            hasTrailingDivider: true
          },
          {
            id: "edit",
            content: "Edit",
            selector: "node",
            onClickFunction: function (event) {
              const node = event.target.data();
              console.log('Edit node:', node);
              // TODO: Show edit interface
            },
            hasTrailingDivider: true
          }
        ],
        menuItemClasses: ["context-menu-item"],
        contextMenuClasses: ["context-menu"]
      };
      
      // Process data for Cytoscape
      const elements = processCytoscapeData();
      
      // Create the Cytoscape instance
      cy = cytoscapeCore({
        container: container,
        elements: elements,
        style: [
          //CORE
          {
            selector: "core",
            css: {
              "active-bg-size": 0 // The size of the active background indicator
            }
          },
          //NODE
          {
            selector: "node",
            css: {
              width: "50px",
              height: "50px",
              "font-family": "sans-serif",
              "background-color": "#5B8FF9",
              "background-opacity": "0.2"
            }
          },
          // Different node types with different colors
          {
            selector: 'node[kind = "users"]',
            css: {
              "background-color": "#5B8FF9"
            }
          },
          {
            selector: 'node[kind = "games"]',
            css: {
              "background-color": "#5AD8A6"
            }
          },
          {
            selector: 'node[kind = "actors"]',
            css: {
              "background-color": "#5D7092"
            }
          },
          {
            selector: 'node[kind = "chat"]',
            css: {
              "background-color": "#F6BD16"
            }
          },
          {
            selector: 'node[kind = "agreements"]',
            css: {
              "background-color": "#E8684A"
            }
          },
          // State styling
          {
            selector: 'node.hover',
            css: {
              "background-opacity": "0.5",
              "border-width": "2px",
              "border-color": "#666"
            }
          },
          {
            selector: 'node:selected',
            css: {
              "background-opacity": "0.8",
              "border-width": "3px",
              "border-color": "#333"
            }
          },
          //EDGE
          {
            selector: "edge",
            css: {
              width: 1,
              "line-color": "#b8b8b8",
              "curve-style": "bezier",
              "target-arrow-color": "#ccc",
              "target-arrow-shape": "triangle",
              "label": "data(label)",
              "font-size": "10px",
              "color": "#777"
            }
          }
        ],
        layout: {
          name: "dagre",
          padding: 50,
          spacingFactor: 1.25,
          nodeDimensionsIncludeLabels: true
        },
        zoomingEnabled: true,
        userZoomingEnabled: true,
        autoungrabify: false
      });
      
      // Apply context menus
      cy.contextMenus(contextMenuOptions);
      
      // Set up node events
      cy.on("mouseover", "node", function (e) {
        e.target.addClass("hover");
      });
      
      cy.on("mouseout", "node", function (e) {
        e.target.removeClass("hover");
      });
      
      cy.on("click", "node", function (e) {
        const nodeData = this.data();
        console.log("Node clicked:", nodeData);
        // TODO: Show node details or highlight related nodes
      });
      
      // Apply HTML labels to nodes
      cy.nodeHtmlLabel([
        {
          query: ".nodeIcon",
          halign: "center",
          valign: "center",
          halignBox: "center",
          valignBox: "center",
          tpl: function (data) {
            const iconClass = data.kind || 'default';
            const color = 
              iconClass === 'users' ? '#5B8FF9' : 
              iconClass === 'games' ? '#5AD8A6' : 
              iconClass === 'actors' ? '#5D7092' :
              iconClass === 'chat' ? '#F6BD16' :
              iconClass === 'agreements' ? '#E8684A' : '#999';
            
            return `<div class="node-content">
                    <div class="node-icon" style="background-color: ${color}">
                      <span class="icon-text">${iconClass.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="node-label">${data.displayName}</div>
                  </div>`;
          }
        },
        {
          query: ".nodeIcon.hover",
          tpl: function (data) {
            const iconClass = data.kind || 'default';
            const color = 
              iconClass === 'users' ? '#5B8FF9' : 
              iconClass === 'games' ? '#5AD8A6' : 
              iconClass === 'actors' ? '#5D7092' :
              iconClass === 'chat' ? '#F6BD16' :
              iconClass === 'agreements' ? '#E8684A' : '#999';
            
            return `<div class="node-content hover">
                    <div class="node-icon" style="background-color: ${color}">
                      <span class="icon-text">${iconClass.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="node-label">${data.displayName}</div>
                  </div>`;
          }
        },
        {
          query: ".nodeIcon:selected",
          tpl: function (data) {
            const iconClass = data.kind || 'default';
            const color = 
              iconClass === 'users' ? '#5B8FF9' : 
              iconClass === 'games' ? '#5AD8A6' : 
              iconClass === 'actors' ? '#5D7092' :
              iconClass === 'chat' ? '#F6BD16' :
              iconClass === 'agreements' ? '#E8684A' : '#999';
            
            return `<div class="node-content selected">
                    <div class="node-icon" style="background-color: ${color}">
                      <span class="icon-text">${iconClass.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="node-label">${data.displayName}</div>
                  </div>`;
          }
        }
      ]);
      
      // Fit the graph to the viewport
      setTimeout(() => {
        cy.fit();
        cy.center();
      }, 100);
      
      // Add resize handler
      const resizeHandler = () => {
        cy.resize();
        cy.fit();
      };
      
      window.addEventListener('resize', resizeHandler);
      
      // Set up cleanup function
      onDestroy(() => {
        window.removeEventListener('resize', resizeHandler);
        if (cy) {
          cy.destroy();
        }
      });
      
      loading = false;
    } catch (err) {
      console.error('Error initializing Cytoscape:', err);
      error = `Failed to initialize graph: ${err.message}`;
      loading = false;
    }
  }
  
  // Initialize on mount
  onMount(() => {
    initializeCytoscape();
  });
  
  // Update graph when data changes
  $: if (cy && nodes && edges) {
    try {
      const elements = processCytoscapeData();
      cy.json({ elements });
      cy.layout({ name: 'dagre', padding: 50 }).run();
      cy.fit();
    } catch (err) {
      console.error('Error updating graph data:', err);
    }
  }
</script>

<div class="cytoscape-container" bind:this={container}>
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
  .cytoscape-container {
    width: 100%;
    height: 600px;
    background-color: #f8f9fa;
    border-radius: 8px;
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
  
  /* Node styling for HTML labels */
  :global(.node-content) {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 80px;
  }
  
  :global(.node-icon) {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    margin-bottom: 4px;
  }
  
  :global(.node-label) {
    font-size: 10px;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    color: #333;
  }
  
  :global(.node-content.hover .node-icon) {
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.2);
    transform: scale(1.05);
  }
  
  :global(.node-content.selected .node-icon) {
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.3);
    transform: scale(1.1);
  }
  
  /* Context menu styling */
  :global(.context-menu) {
    background-color: white;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    padding: 5px 0;
  }
  
  :global(.context-menu-item) {
    padding: 6px 15px;
    cursor: pointer;
    font-size: 14px;
  }
  
  :global(.context-menu-item:hover) {
    background-color: #f0f0f0;
  }
</style>