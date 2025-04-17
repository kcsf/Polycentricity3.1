<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { SvelteComponent } from 'svelte';
  import { get } from 'svelte/store';
  import * as d3 from 'd3';
  import { User } from 'lucide-svelte';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import gameStore from '$lib/stores/enhancedGameStore';
  import { getGun, nodes } from '$lib/services/gunService';
  import type { Card, Value, Capability, Actor, Agreement } from '$lib/types';
  import { getGame } from '$lib/services/gameService';
  import { userStore } from '$lib/stores/userStore';
  import { 
    createNodes, 
    createLinks, 
    setupInteractions, 
    createCardIcon, 
    updateForces,
    initializeD3Graph,
    addDonutRings,
    categoryColors,
    type D3Node,
    type D3Link,
    type SubItem,
    type CardWithPosition,
    type ObligationItem,
    type BenefitItem,
    type AgreementWithPosition,
    type D3NodeWithRelationships
  } from '$lib/utils/d3GraphUtils';
  
  // Props
  export let gameId: string;
  export let activeActorId: string | undefined = undefined;
  export let cards: Card[] = [];
  
  // References and constants
  let svgElement: SVGSVGElement;
  let containerElement: HTMLDivElement;
  let width = 800;
  let height = 600;
  let simulation: d3.Simulation<D3Node, undefined> | null = null;
  let nodeElements: d3.Selection<SVGGElement, D3Node, null, undefined>;
  
  // Data state
  let cardsWithPosition: CardWithPosition[] = [];
  let agreements: AgreementWithPosition[] = [];
  let actors: Actor[] = [];
  let valueCache: Map<string, Value> = new Map();
  let capabilityCache: Map<string, Capability> = new Map();
  let actorCardMap: Map<string, string> = new Map(); // Maps actor_id to card_id
  let activeCardId: string | null = null;
  
  // Selected node for detail display
  let selectedNode: D3Node | null = null;
  
  // Graph state
  let graphState: {
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    nodes: D3Node[];
    links: D3Link[];
    simulation: d3.Simulation<D3Node, undefined>;
  } | null = null;
  
  // Track initialization status
  let initialDataFetched = false;
  let cardsData = cards;
  
  // Export a refresh method that can be called by parent components
  export function refreshVisualization() {
    console.log("D3CardBoard: Refreshing visualization");
    
    // Clear existing visualization
    if (graphState && graphState.svg) {
      graphState.svg.selectAll("*").remove();
    }
    
    // Reset state to force data reload
    initialDataFetched = false;
    cardsWithPosition = [];
    agreements = [];
    actorCardMap = new Map();
    valueCache = new Map();
    capabilityCache = new Map();
    
    // Restart the visualization
    initializeVisualization();
  }
  
  // Main function to initialize the D3 visualization
  async function initializeVisualization() {
    console.log("D3CardBoard: Starting initialization");
    
    if (!svgElement) {
      console.error("D3CardBoard: SVG element is not available");
      return;
    }
    
    try {
      // Set size based on container
      const containerRect = svgElement.parentElement?.getBoundingClientRect();
      if (containerRect) {
        width = containerRect.width;
        height = containerRect.height;
      }
      
      // Set active card ID based on active actor ID
      if (activeActorId) {
        const cardWithActor = cards.find(c => c.actor_id === activeActorId);
        if (cardWithActor) {
          activeCardId = cardWithActor.card_id;
        }
      }
      
      // Get the game data to find agreements
      const game = await getGame(gameId);
      
      if (!game) {
        console.error(`D3CardBoard: Game ${gameId} not found`);
        return;
      }
      
      // Map card positions for visualization
      cardsWithPosition = cards.map(card => {
        return {
          ...card,
          position: card.position || {
            x: Math.random() * width,
            y: Math.random() * height
          }
        };
      });
      
      // Set up actor to card mapping
      // Map actors to cards - this is critical for agreement links
      cardsWithPosition.forEach(card => {
        if (card.actor_id) {
          // Set the actor_id -> card_id mapping
          actorCardMap.set(card.actor_id, card.card_id);
          console.log(`D3CardBoard: Mapped actor ${card.actor_id} to card ${card.card_id}`);
        } else {
          // Try to find the actor ID from the card properties - hackish fix
          if (card.role_title) {
            // Check if this card is tied to an actor in this game
            getGun().get(nodes.actors).map().once((actorData) => {
              if (actorData && actorData.name === card.role_title) {
                const actorId = actorData?.actor_id;
                if (actorId) {
                  actorCardMap.set(actorId, card.card_id);
                  console.log(`D3CardBoard: Mapped actor ${actorId} to card ${card.card_id} by role title`);
                }
              }
            });
          }
        }
      });
      
      // Load agreements for this game
      agreements = [];
      
      // Check if the game has agreements
      if (game.agreements) {
        console.log("D3CardBoard: Game has agreements, loading...");
        
        // Get agreement ids from the game's agreements object
        const agreementIds = Object.keys(game.agreements);
        console.log(`D3CardBoard: Found ${agreementIds.length} agreement IDs in game`);
        
        if (agreementIds.length > 0) {
          // Create a promise for each agreement to load
          const agreementPromises = agreementIds.map(agreementId => {
            if (agreementId === '#') return Promise.resolve(null); // Skip Gun.js reference edges
            
            return new Promise<AgreementWithPosition>(resolve => {
              // Query the agreement from Gun
              getGun().get(nodes.agreements).get(agreementId).once((agreementData: Agreement) => {
                if (agreementData && agreementData.agreement_id) {
                  console.log(`D3CardBoard: Loaded agreement ${agreementId}:`, agreementData);
                  
                  // Add position for visualization
                  const agreementWithPosition: AgreementWithPosition = {
                    ...agreementData,
                    position: {
                      x: width / 2 + (Math.random() * 100 - 50),
                      y: height / 2 + (Math.random() * 100 - 50)
                    }
                  };
                  
                  resolve(agreementWithPosition);
                } else {
                  console.warn(`D3CardBoard: Agreement ${agreementId} not found or invalid`);
                  resolve(null);
                }
              });
            });
          });
          
          // Wait for all agreements to load
          const loadedAgreements = await Promise.all(agreementPromises);
          
          // Filter out null values and add to agreements array
          agreements = loadedAgreements.filter(a => a !== null);
          console.log(`D3CardBoard: Successfully loaded ${agreements.length} agreements`);
          
          // If no agreements were loaded but we know they exist in the game,
          // there might be a timing issue or data consistency problem
          if (agreements.length === 0 && agreementIds.length > 0) {
            console.warn(`D3CardBoard: Failed to load any agreements, but game has ${agreementIds.length} agreement IDs.`);
            
            // Create fallback agreements with fixed ids for immediate display
            for (const agreementId of agreementIds) {
              if (agreementId === '#') continue;
              
              // Create a basic fallback agreement
              const fallbackAgreement: AgreementWithPosition = {
                agreement_id: agreementId,
                title: `Agreement ${agreementId}`,
                summary: "Agreement details loading...",
                parties: { "actor1": true, "actor2": true }, // Add dummy parties for visualization
                obligations: { "actor1": "Obligation placeholder" }, // Object format as expected by Gun.js
                benefits: { "actor2": "Benefit placeholder" }, // Object format as expected by Gun.js
                created_at: Date.now(),
                created_by: "system",
                game_id: gameId,
                status: "accepted",
                type: "symmetric",
                position: {
                  x: width / 2 + (Math.random() * 200 - 100),
                  y: height / 2 + (Math.random() * 200 - 100)
                }
              };
              
              // Add to the agreements array
              agreements.push(fallbackAgreement);
              console.log(`D3CardBoard: Added fallback agreement for ${agreementId}`);
            }
            
            // Also try direct load for debugging
            const gun = getGun();
            agreementIds.forEach(agreementId => {
              if (agreementId === '#') return;
              
              gun.get(nodes.agreements).get(agreementId).once((data) => {
                console.log(`DIRECT LOAD: Agreement ${agreementId}:`, data);
              });
            });
          }
        }
      }
      
      console.log("D3CardBoard: Setup data", {
        cardsCount: cardsWithPosition.length,
        agreementsCount: agreements.length,
        actorCardMapSize: actorCardMap.size
      });
      
      // Get actor-card map size for logging
      const actorCardMapEntries = Array.from(actorCardMap.entries());
      console.log("D3CardBoard: Passing actor-card map to initializeD3Graph:", {
        mapSize: actorCardMap.size,
        entries: actorCardMapEntries
      });
      
      // Initialize the D3 graph with our data
      graphState = initializeD3Graph(
        svgElement,
        cardsWithPosition,
        agreements,
        width,
        height,
        selectedNode,
        handleNodeClick,
        (newNode) => {
          selectedNode = newNode;
        },
        activeCardId,
        actorCardMap // Pass the actor-card map to the initializer
      );
      
      if (graphState) {
        console.log("D3CardBoard: D3 graph initialized successfully");
        
        // Add donut rings to show values and capabilities
        console.log("D3CardBoard: Adding donut rings to nodes");
        
        // Get the node elements once they're created
        nodeElements = d3.select(svgElement).selectAll<SVGGElement, D3Node>('.node');
        
        // Log some info about this operation
        console.log("D3CardBoard: Adding donut rings with:", {
          nodeElementsCount: nodeElements.size(),
          activeCardId,
          valueCacheSize: valueCache.size,
          capabilityCacheSize: capabilityCache.size
        });
        
        // Add the donut rings to nodes
        addDonutRings(
          nodeElements,
          activeCardId,
          valueCache,
          capabilityCache
        );
        console.log("D3CardBoard: Donut rings added successfully");
        
        // Add center icons to nodes
        console.log("D3CardBoard: Adding center icons to nodes");
        
        // Find all actor nodes and add icons to them
        const nodeActors = d3.select(svgElement).selectAll<SVGGElement, D3Node>('.node-actor');
        
        nodeActors.each(async function(d: D3Node) {
          const node = d3.select(this);
          const iconContainer = node.select('.icon-container');
          
          if (iconContainer.size() > 0) {
            // Find card data for this node
            const cardData = cardsWithPosition.find(c => c.card_id === d.id);
            if (cardData) {
              try {
                const iconName = cardData.icon || cardData.type;
                if (iconName) {
                  const IconComponent = await getLucideIcon(iconName);
                  console.log(`Successfully created icon component for ${cardData.role_title}`);
                  
                  // Create a new div for the icon and mount the component to it
                  const iconDiv = document.createElement('div');
                  iconContainer.node()?.appendChild(iconDiv);
                  
                  if (typeof IconComponent === 'function') {
                    new IconComponent({
                      target: iconDiv,
                      props: {
                        size: 16,
                        strokeWidth: 2,
                        class: "text-surface-700-200-token"
                      }
                    });
                    console.log(`Successfully rendered icon for ${cardData.role_title}`);
                  }
                }
              } catch (iconError) {
                console.error(`Failed to create icon for ${cardData.role_title}:`, iconError);
              }
            }
          }
        });
        console.log("D3CardBoard: Center icons added successfully");
      } else {
        console.error("D3CardBoard: Failed to initialize D3 graph:", initError);
      }
      
      // Update the state
      initialDataFetched = true;
      
      // After the graph is initialized, we can add donut segments to the nodes
      if (selectedNode) {
        selectNode(selectedNode);
      }
      
    } catch (error) {
      console.error("Error in initializeVisualization:", error);
    }
  }
  
  // Icon helper function
  async function getLucideIcon(iconName: string | undefined): Promise<SvelteComponent | typeof User> {
    if (!iconName) return User;
    
    // Try to get from the iconStore first
    const iconMap = get(iconStore);
    const iconData = iconMap.get(iconName);
    if (iconData && iconData.component) return iconData.component;
    
    // Normalize name for Lucide format
    let normalizedName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
    
    // Common icon mappings
    const iconMappings: Record<string, string> = {
      'CircleDollarSign': 'DollarSign',
      'Tree': 'PalmTree',
      'Garden': 'Flower2',
      'Plant': 'Sprout',
      'Money': 'Coins',
      'Default': 'Box',
      'Farmer': 'Tractor',
      'Funder': 'PiggyBank',
      'Steward': 'Shield',
      'Investor': 'TrendingUp',
    };
    
    if (iconMappings[normalizedName]) {
      normalizedName = iconMappings[normalizedName];
    }
    
    try {
      const icons = await import('lucide-svelte');
      if (icons[normalizedName]) {
        return icons[normalizedName];
      }
    } catch (error) {
      console.error(`Error loading icon: ${error}`);
    }
    
    console.log(`Using fallback icon for ${iconName}`);
    return User;
  }
  
  // Handle node click
  function handleNodeClick(node: D3Node) {
    console.log("Node clicked:", node);
    selectedNode = node;
    selectNode(node);
  }
  
  // Handle node selection
  function selectNode(node: D3Node) {
    if (graphState && node) {
      // Highlight the selected node
      graphState.svg.selectAll('.node').classed('active', false);
      graphState.svg.select(`.node[data-id="${node.id}"]`).classed('active', true);
    }
  }
  
  // Highlight active node (based on activeActorId)
  function highlightActiveNode(actorId: string) {
    if (!graphState || !actorId) return;
    
    // Find the card ID for this actor
    const cardId = actorCardMap.get(actorId);
    if (!cardId) return;
    
    // Remove active class from all nodes first
    graphState.svg.selectAll('.node').classed('active', false);
    
    // Add active class to the matching node
    graphState.svg.select(`.node[data-id="${cardId}"]`).classed('active', true);
  }
  
  // Reactive statements
  $: if (cards && cards.length > 0 && !initialDataFetched) {
    console.log(`D3CardBoard: Cards data changed - ${cards.length} cards available`);
    cardsData = cards;
  }
  
  // When active card changes, update the visualization
  $: if (activeActorId && graphState) {
    highlightActiveNode(activeActorId);
  }
  
  onMount(async () => {
    console.log("D3CardBoard: Component mounted");
    
    // Load icons first
    try {
      await loadIcons();
    } catch (iconError) {
      console.warn("D3CardBoard: Failed to load icons:", iconError);
    }
    
    // Initialize the visualization
    initializeVisualization();
    
    console.log("D3 graph fully initialized with utility function");
  });
  
  onDestroy(() => {
    // Clean up listeners
    if (simulation) {
      simulation.stop();
    }
  });
</script>

<div class="component-container w-full h-full" bind:this={containerElement}>
  <svg class="w-full h-full" bind:this={svgElement}></svg>
  
  {#if selectedNode}
    <div class="node-details absolute top-5 right-5 bg-surface-100 dark:bg-surface-800 p-4 rounded-lg shadow-lg max-w-72 z-10">
      <h3 class="text-lg font-bold mb-2">{selectedNode.name}</h3>
      <div class="flex gap-1 text-xs items-center mb-2">
        <span class="badge bg-primary-500 text-white px-2 py-0.5 rounded-full">
          {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
        </span>
      </div>
      <button class="btn btn-sm variant-soft-surface absolute top-2 right-2" onclick={() => selectedNode = null}>×</button>
      
      {#if selectedNode.type === 'actor'}
        {#if selectedNode.data.backstory}
          <div class="mb-2">
            <h4 class="text-sm font-semibold">Backstory</h4>
            <p class="text-xs">{selectedNode.data.backstory}</p>
          </div>
        {/if}
        
        {#if selectedNode.data.values && Object.keys(selectedNode.data.values).length > 0}
          <div class="mb-2">
            <h4 class="text-sm font-semibold flex items-center">
              <span class="w-3 h-3 rounded-full bg-[var(--values-color)] mr-1"></span>
              Values
            </h4>
            <ul class="text-xs list-disc pl-4">
              {#each Object.keys(selectedNode.data.values) as valueId}
                <li>{valueId}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        {#if selectedNode.data.capabilities && Object.keys(selectedNode.data.capabilities).length > 0}
          <div class="mb-2">
            <h4 class="text-sm font-semibold flex items-center">
              <span class="w-3 h-3 rounded-full bg-[var(--capabilities-color)] mr-1"></span>
              Capabilities
            </h4>
            <ul class="text-xs list-disc pl-4">
              {#each Object.keys(selectedNode.data.capabilities) as capabilityId}
                <li>{capabilityId}</li>
              {/each}
            </ul>
          </div>
        {/if}
      {:else if selectedNode.type === 'agreement'}
        <div class="mb-2">
          <h4 class="text-sm font-semibold">Description</h4>
          <p class="text-xs">{selectedNode.data.summary || 'No description'}</p>
        </div>
        
        {#if selectedNode.data.parties && Object.keys(selectedNode.data.parties).length > 0}
          <div class="mb-2">
            <h4 class="text-sm font-semibold">Parties</h4>
            <div class="grid grid-cols-2 gap-1 text-xs mt-1">
              {#each Object.keys(selectedNode.data.parties) as partyId}
                <div class="bg-surface-200 dark:bg-surface-700 rounded px-2 py-1">
                  {partyId}
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        {#if selectedNode.data.obligations && Object.keys(selectedNode.data.obligations).length > 0}
          <div class="mb-2">
            <h4 class="text-sm font-semibold">Obligations</h4>
            <ul class="text-xs list-disc pl-4">
              {#each Object.entries(selectedNode.data.obligations) as [partyId, obligation]}
                <li>
                  <span class="font-semibold">{partyId}:</span> {obligation}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        
        {#if selectedNode.data.benefits && Object.keys(selectedNode.data.benefits).length > 0}
          <div class="mb-2">
            <h4 class="text-sm font-semibold">Benefits</h4>
            <ul class="text-xs list-disc pl-4">
              {#each Object.entries(selectedNode.data.benefits) as [partyId, benefit]}
                <li>
                  <span class="font-semibold">{partyId}:</span> {benefit}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .component-container {
    position: relative;
    overflow: hidden;
  }
  
  /* Node styling */
  :global(.node text) {
    font-family: var(--theme-font-family-base);
    fill: var(--color-surface-900);
    font-size: 0.75rem;
    text-anchor: middle;
  }
  
  :global(.node-actor .actor-circle) {
    fill: #fff;
    stroke: #e5e5e5;
    stroke-width: 1px;
  }
  
  :global(.node-actor.active .actor-circle) {
    stroke: #2563eb;
    stroke-width: 2px;
  }
  
  :global(.node-agreement .agreement-circle) {
    fill: #f9fafb;
    stroke: #d1d5db;
    stroke-width: 1px;
  }
  
  :global(.node-agreement.active .agreement-circle) {
    stroke: #2563eb;
    stroke-width: 2px;
  }
  
  /* Icon container styling */
  :global(.icon-container) {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }
  
  /* Segment styling for donut rings */
  :global(.segment-values) {
    fill: var(--values-color, #A7C731);
  }
  
  :global(.segment-capabilities) {
    fill: var(--capabilities-color, #9BC23D);
  }
  
  :global(.segment-goals) {
    fill: var(--goals-color, #8FBC49);
  }
  
  /* Link styling */
  :global(.link) {
    stroke-width: 1.5px;
    stroke-opacity: 0.6;
  }
  
  :global(.link-obligation) {
    stroke: #4f46e5; /* Indigo */
  }
  
  :global(.link-benefit) {
    stroke: #059669; /* Emerald */
    stroke-dasharray: 5, 5;
  }
  
  /* Node label styling */
  :global(.node-label) {
    font-size: 10px;
    fill: #374151;
    text-anchor: middle;
    pointer-events: none;
  }
  
  :global(.node-agreement .node-label) {
    font-size: 8px;
    fill: #4b5563;
  }
</style>