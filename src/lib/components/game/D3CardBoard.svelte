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
  import RoleCard from '$lib/components/RoleCard.svelte';
  
  // Props
  export let gameId: string;
  export let activeActorId: string | undefined = undefined;
  export let cards: Card[] = [];
  
  // Local state variables
  let svgElement: SVGSVGElement;
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
    console.log(`Node clicked: ${node.id}`, node);
    selectedNode = node;
  }
  
  // Get data for card values from Gun.js database
  async function getValueForCard(valueId: string): Promise<Value | null> {
    // First check our cache
    if (valueCache.has(valueId)) {
      return valueCache.get(valueId) || null;
    }
    
    try {
      return new Promise<Value | null>((resolve) => {
        const gun = getGun();
        gun.get(nodes.values).get(valueId).once((valueData: Value) => {
          if (valueData) {
            valueCache.set(valueId, valueData);
            resolve(valueData);
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error(`Error fetching value ${valueId}:`, error);
      return null;
    }
  }
  
  // Get data for capability from Gun.js database
  async function getCapabilityForCard(capabilityId: string): Promise<Capability | null> {
    // First check our cache
    if (capabilityCache.has(capabilityId)) {
      return capabilityCache.get(capabilityId) || null;
    }
    
    try {
      return new Promise<Capability | null>((resolve) => {
        const gun = getGun();
        gun.get(nodes.capabilities).get(capabilityId).once((capabilityData: Capability) => {
          if (capabilityData) {
            capabilityCache.set(capabilityId, capabilityData);
            resolve(capabilityData);
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error(`Error fetching capability ${capabilityId}:`, error);
      return null;
    }
  }
  
  // Getting value names for a card
  async function getCardValueNamesLocal(card: Card): Promise<string[]> {
    if (!card.values) return [];
    
    try {
      // Extract value IDs from the card
      const valueIds = Object.keys(card.values);
      
      // Map each value ID to its name by fetching from Gun
      const valuePromises = valueIds.map(async (valueId) => {
        // If it's a direct string rather than an ID reference
        if (!valueId.startsWith('value_')) {
          return valueId.replace(/-/g, ' ');
        }
        
        const valueData = await getValueForCard(valueId);
        if (valueData && valueData.name) {
          return valueData.name;
        }
        // Just return the ID as a fallback
        return valueId.replace('value_', '').replace(/-/g, ' ');
      });
      
      // Wait for all promises to resolve
      const valueNames = await Promise.all(valuePromises);
      return valueNames;
    } catch (error) {
      console.warn(`Failed to retrieve values for card: ${card.card_id}`);
      return [];
    }
  }
  
  // Getting capability names for a card
  async function getCardCapabilityNamesLocal(card: Card): Promise<string[]> {
    if (!card.capabilities) return [];
    
    try {
      // Extract capability IDs from the card
      const capabilityIds = Object.keys(card.capabilities);
      
      // Map each capability ID to its name by fetching from Gun
      const capabilityPromises = capabilityIds.map(async (capabilityId) => {
        // If it's a direct string rather than an ID reference
        if (!capabilityId.startsWith('capability_')) {
          return capabilityId.replace(/-/g, ' ');
        }
        
        const capabilityData = await getCapabilityForCard(capabilityId);
        if (capabilityData && capabilityData.name) {
          return capabilityData.name;
        }
        // Just return the ID as a fallback
        return capabilityId.replace('capability_', '').replace(/-/g, ' ');
      });
      
      // Wait for all promises to resolve
      const capabilityNames = await Promise.all(capabilityPromises);
      return capabilityNames;
    } catch (error) {
      console.warn(`Failed to retrieve capabilities for card: ${card.card_id}`);
      return [];
    }
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
      cardsWithPosition.forEach(card => {
        if (card.actor_id) {
          actorCardMap.set(card.actor_id, card.card_id);
        }
      });
      
      // Load agreements from the game
      agreements = (game.agreements || []).map(agreement => {
        return {
          ...agreement,
          position: agreement.position || {
            x: Math.random() * width,
            y: Math.random() * height
          }
        };
      });
      
      // Check if we have agreements - if not, create test agreements between cards
      if (agreements.length === 0 && cardsWithPosition.length >= 2) {
        console.log("D3CardBoard: No agreements found in game, creating test agreements for visualization");
        
        // Create test agreements between cards
        for (let i = 0; i < Math.min(3, cardsWithPosition.length - 1); i++) {
          const card1 = cardsWithPosition[i];
          const card2 = cardsWithPosition[(i + 1) % cardsWithPosition.length];
          
          // Create synthetic actor IDs if cards don't have them
          const actorId1 = card1.actor_id || `actor_${card1.card_id}`;
          const actorId2 = card2.actor_id || `actor_${card2.card_id}`;
          
          // Add to actor-card map if not already there
          if (!actorCardMap.has(actorId1)) {
            actorCardMap.set(actorId1, card1.card_id);
          }
          if (!actorCardMap.has(actorId2)) {
            actorCardMap.set(actorId2, card2.card_id);
          }
          
          // Create a test agreement
          const testAgreement: AgreementWithPosition = {
            agreement_id: `agreement_${i + 1}`,
            title: `Agreement ${i + 1}`,
            description: "Test agreement for visualization",
            obligations: [
              {
                id: `ob${i + 1}`,
                fromActorId: actorId1,
                toActorId: actorId2,
                text: `Obligation from ${card1.role_title} to ${card2.role_title}`
              }
            ],
            benefits: [
              {
                id: `ben${i + 1}`,
                fromActorId: actorId2,
                toActorId: actorId1,
                text: `Benefit from ${card2.role_title} to ${card1.role_title}`
              }
            ],
            parties: {
              [actorId1]: true,
              [actorId2]: true
            },
            position: {
              x: ((card1.position?.x || 0) + (card2.position?.x || 0)) / 2,
              y: ((card1.position?.y || 0) + (card2.position?.y || 0)) / 2
            }
          };
          
          agreements.push(testAgreement);
        }
      }
      
      console.log("D3CardBoard: Setup data", {
        cardsCount: cardsWithPosition.length,
        agreementsCount: agreements.length,
        actorCardMapSize: actorCardMap.size
      });
      
      // Extend cards with value and capability names
      for (const card of cardsWithPosition) {
        try {
          // Get value and capability names
          const valueNames = await getCardValueNamesLocal(card);
          const capabilityNames = await getCardCapabilityNamesLocal(card);
          
          // Store them on the card object for visualization
          (card as any)._valueNames = valueNames;
          (card as any)._capabilityNames = capabilityNames;
        } catch (error) {
          console.error(`Error getting names for card ${card.card_id}:`, error);
        }
      }
      
      // Initialize D3 graph
      let graphState;
      try {
        // Log the actor-card map we'll be passing to initializeD3Graph
        console.log("D3CardBoard: Passing actor-card map to initializeD3Graph:", {
          mapSize: actorCardMap.size,
          entries: Array.from(actorCardMap.entries())
        });

        graphState = initializeD3Graph(
          svgElement,
          cardsWithPosition,
          agreements,
          width,
          height,
          activeCardId,
          handleNodeClick,
          actorCardMap // Pass the actor-card map to the initializer
        );
        console.log("D3CardBoard: D3 graph initialized successfully");
      } catch (initError) {
        console.error("D3CardBoard: Failed to initialize D3 graph:", initError);
        throw initError;
      }
      
      // Store references to the graph elements for later use
      simulation = graphState.simulation;
      nodeElements = graphState.nodeElements;
      
      console.log("D3CardBoard: Adding donut rings to nodes");
      
      // After the graph is initialized, we can add donut segments to the nodes
      try {
        console.log("D3CardBoard: Adding donut rings with:", {
          nodeElementsCount: nodeElements.size(),
          activeCardId,
          valueCacheSize: valueCache?.size,
          capabilityCacheSize: capabilityCache?.size
        });
        
        // Use our utility function to add the donut rings
        addDonutRings(nodeElements, activeCardId, valueCache, capabilityCache);
        console.log("D3CardBoard: Donut rings added successfully");
      } catch (donutError) {
        console.error("D3CardBoard: Failed to add donut rings:", donutError);
      }
      
      console.log("D3CardBoard: Adding center icons to nodes");
      
      // Add center icons to the nodes
      try {
        nodeElements.each(function(node) {
          try {
            if (node.type === 'actor') {
              const centerGroup = d3.select(this).append("g")
                .attr("class", "center-group center-icon-container");
              
              // Create a container div for the icon
              const iconContainer = document.createElement('div');
              iconContainer.className = 'icon-container';
              
              // Get the card data
              const card = node.data as Card;
              if (!card) {
                console.warn("D3CardBoard: Card data is missing for node:", node);
                return;
              }
              
              // Get the icon name from the card data with fallback
              const iconName = card.icon || 'user';
              
              // Determine size based on active status
              const isActive = node.id === activeCardId;
              const iconSize = isActive ? 36 : 24;
              const offset = isActive ? -18 : -12;
              
              // Create the icon using our utility function
              try {
                // Use larger icons for active nodes
                createCardIcon(iconName, iconSize, iconContainer, card.role_title || 'Card');
                console.log(`Successfully rendered icon for ${card.role_title || 'Card'}`);
              } catch (iconError) {
                console.error("D3CardBoard: Failed to create icon:", iconError);
              }
              
              // Convert the div container to a foreignObject in the SVG with proper positioning
              // Position exactly in the center of the node
              const foreignObject = centerGroup.append('foreignObject')
                .attr('width', iconSize)
                .attr('height', iconSize)
                .attr('x', offset)
                .attr('y', offset)
                .attr('class', 'icon-container')
                .style('pointer-events', 'none');
                
              // Append the icon container to the foreignObject
              if (foreignObject.node()) {
                foreignObject.node()?.appendChild(iconContainer);
              } else {
                console.warn("D3CardBoard: Foreign object node is null");
              }
            }
          } catch (nodeError) {
            console.error("D3CardBoard: Error processing node:", nodeError, node);
          }
        });
        console.log("D3CardBoard: Center icons added successfully");
      } catch (iconsError) {
        console.error("D3CardBoard: Failed to add center icons:", iconsError);
      }
      
      console.log("D3 graph fully initialized with utility function");
    } catch (error) {
      console.error("Error initializing D3 graph:", error);
      // Show more detailed error information
      if (error instanceof ReferenceError) {
        console.error("Reference error details:", error.message, error.stack);
      }
      if (error instanceof TypeError) {
        console.error("Type error details:", error.message, error.stack);
      }
    }
  }
  
  // Initialize on mount
  onMount(async () => {
    console.log("D3CardBoard: Component mounted");
    
    // Load icons first
    try {
      await loadIcons();
      console.log("D3CardBoard: Icons loaded");
    } catch (error) {
      console.warn("D3CardBoard: Failed to load icons:", error);
    }
    
    // Add a slight delay to ensure the DOM is ready
    // This helps with calculating dimensions correctly
    setTimeout(() => {
      initializeVisualization();
    }, 100);
    
    return () => {
      // Clean up simulations on unmount
      if (simulation) {
        simulation.stop();
      }
    };
  });
  
  // Test color scheme - useful for debugging
  console.log("Testing d3GraphUtils categoryColors:", categoryColors);
</script>

<style>
  /* D3 graph styling */
  :global(.nodes circle) {
    fill: var(--color-surface-100);
    stroke: var(--color-surface-300);
    stroke-width: 1px;
  }
  
  :global(.nodes circle.active) {
    stroke: var(--color-primary-500);
    stroke-width: 2px;
  }
  
  /* Links styling */
  :global(.link-obligation) {
    stroke: var(--color-indigo-500);
  }
  
  :global(.link-benefit) {
    stroke: var(--color-emerald-500);
    stroke-dasharray: 4, 2;
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
</style>

<div class="w-full h-full relative overflow-hidden">
  <svg bind:this={svgElement} width="100%" height="100%" class="d3-graph"></svg>
  
  {#if selectedNode}
    <div class="absolute bottom-4 left-4 p-4 bg-surface-100 rounded-xl shadow-lg max-w-lg">
      {#if selectedNode.type === 'actor'}
        <h3 class="text-lg font-semibold mb-2">{selectedNode.name}</h3>
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          {#if selectedNode._valueNames && selectedNode._valueNames.length > 0}
            <div>
              <h4 class="text-sm font-medium text-primary-700">Values</h4>
              <ul class="list-disc pl-5 text-sm">
                {#each selectedNode._valueNames as value}
                  <li>{value}</li>
                {/each}
              </ul>
            </div>
          {/if}
          
          {#if selectedNode._capabilityNames && selectedNode._capabilityNames.length > 0}
            <div>
              <h4 class="text-sm font-medium text-primary-700">Capabilities</h4>
              <ul class="list-disc pl-5 text-sm">
                {#each selectedNode._capabilityNames as capability}
                  <li>{capability}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {:else if selectedNode.type === 'agreement'}
        <h3 class="text-lg font-semibold mb-2">{selectedNode.name}</h3>
        <div class="grid grid-cols-1 gap-2">
          {#if selectedNode.data?.obligations && selectedNode.data.obligations.length > 0}
            <div>
              <h4 class="text-sm font-medium text-indigo-700">Obligations</h4>
              <ul class="list-disc pl-5 text-sm">
                {#each selectedNode.data.obligations as obligation}
                  <li>{obligation.text}</li>
                {/each}
              </ul>
            </div>
          {/if}
          
          {#if selectedNode.data?.benefits && selectedNode.data.benefits.length > 0}
            <div>
              <h4 class="text-sm font-medium text-emerald-700">Benefits</h4>
              <ul class="list-disc pl-5 text-sm">
                {#each selectedNode.data.benefits as benefit}
                  <li>{benefit.text}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
      <button 
        class="mt-2 px-2 py-1 text-xs bg-surface-200 rounded hover:bg-surface-300"
        on:click={() => selectedNode = null}>
        Close
      </button>
    </div>
  {/if}
</div>