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
  
  // Props using Svelte 5 RUNES syntax
  const { gameId, activeActorId = undefined, cards = [] } = $props<{
    gameId: string;
    activeActorId?: string;
    cards?: Card[];
  }>();
  
  // Local state variables using Svelte 5 RUNES mode
  let svgElement: SVGSVGElement;
  let width = $state(800);
  let height = $state(600);
  let simulation = $state<d3.Simulation<D3Node, undefined> | null>(null);
  let nodeElements = $state<d3.Selection<SVGGElement, D3Node, null, undefined> | null>(null);
  
  // Data state using Svelte 5 RUNES mode
  let cardsWithPosition = $state<CardWithPosition[]>([]);
  let agreements = $state<AgreementWithPosition[]>([]);
  let actors = $state<Actor[]>([]);
  let valueCache = $state(new Map<string, Value>());
  let capabilityCache = $state(new Map<string, Capability>());
  
  // Actor to card mapping
  let actorCardMap = $state(new Map<string, string>());
  
  // Selected node for detail view
  let selectedNode = $state<D3Node | null>(null);
  let activeCardId = $state<string | null>(null);
  
  /**
   * Load agreement data from a Gun.js reference
   * @param agreementId - The agreement ID to load
   * @returns Promise with the agreement data
   */
  async function loadAgreementData(agreementId: string): Promise<Agreement | null> {
    try {
      console.log(`D3CardBoard: Loading agreement data for ${agreementId}`);
      
      return new Promise((resolve) => {
        const gun = getGun();
        
        gun.get(nodes.agreements).get(agreementId).once((agreement: Agreement) => {
          if (!agreement) {
            console.warn(`D3CardBoard: No agreement data found for ${agreementId}`);
            resolve(null);
            return;
          }
          
          console.log(`D3CardBoard: Loaded agreement data for ${agreementId}:`, agreement);
          resolve(agreement);
        });
      });
    } catch (error) {
      console.error(`D3CardBoard: Error loading agreement data for ${agreementId}:`, error);
      return null;
    }
  }
  
  /**
   * Load all agreements for a game
   * @param game - The game object containing agreement references
   * @returns Promise with array of agreements with position data
   */
  async function loadGameAgreements(game: any): Promise<AgreementWithPosition[]> {
    try {
      const loadedAgreements: AgreementWithPosition[] = [];
      
      // Check if game has agreement_ids field (expected format)
      if (game.agreement_ids && Array.isArray(game.agreement_ids)) {
        console.log(`D3CardBoard: Found ${game.agreement_ids.length} agreement IDs in game`);
        
        // Load each agreement in parallel
        const agreementPromises = game.agreement_ids.map(async (agreementId: string) => {
          const agreement = await loadAgreementData(agreementId);
          
          if (agreement) {
            // Add position data for visualization
            const agreementWithPosition: AgreementWithPosition = {
              ...agreement,
              position: {
                x: Math.random() * width,
                y: Math.random() * height
              }
            };
            
            loadedAgreements.push(agreementWithPosition);
          }
        });
        
        await Promise.all(agreementPromises);
        
        console.log(`D3CardBoard: Successfully loaded ${loadedAgreements.length} agreements`);
      } 
      // Some games may not have agreements yet, which is normal behavior
      // No warning needed
      
      return loadedAgreements;
    } catch (error) {
      console.error(`D3CardBoard: Error loading game agreements:`, error);
      return [];
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
      
      // Load agreements from the game using our helper method
      console.log("D3CardBoard: Loading agreements for game:", gameId);
      agreements = await loadGameAgreements(game);
      console.log(`D3CardBoard: Loaded ${agreements.length} agreements for game:`, gameId);
      
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
        
        // Import and apply the label fix
        import { fixDonutRingLabels } from '$lib/utils/radialLabelFix';
        
        // Apply our label fix to position text correctly with 10% gap and 8px font
        fixDonutRingLabels();
        console.log("D3CardBoard: Applied donut ring label fixes");
      } catch (donutError) {
        console.error("D3CardBoard: Failed to add donut rings:", donutError);
      }
      
      // Add center icons to nodes - preload icons first
      try {
        // Get all unique icon names from cards
        const iconNames = cardsWithPosition
          .map(card => card.icon || 'user')
          .filter((value, index, self) => self.indexOf(value) === index); // Get unique values
        
        // Preload all icons before rendering (silent mode)
        await loadIcons(iconNames);
      } catch (preloadError) {
        console.warn("D3CardBoard: Failed to preload icons", preloadError instanceof Error ? preloadError.message : '');
      }
      
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
                // Icon successfully created - no need to log
              } catch (iconError) {
                console.warn(`D3CardBoard: Failed to create icon for ${card.role_title || 'Card'} with icon ${iconName}`);
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
        // Center icons successfully added
      } catch (iconsError) {
        console.error("D3CardBoard: Failed to add center icons:", iconsError);
      }
      
      // Graph initialization complete
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
    
    // Load basic icons first - default set for cards
    try {
      const defaultIcons = ['user', 'users', 'sun', 'link', 'lock', 'Hammer', 'CircleDollarSign'];
      await loadIcons(defaultIcons);
    } catch (error) {
      // Silently catch errors - we'll try again during visualization
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
</script>

<!-- 
  D3-specific styles moved to app.css
  These styles can't be converted to Tailwind as they target 
  SVG elements dynamically generated by D3.js 
-->

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
        onclick={() => selectedNode = null}>
        Close
      </button>
    </div>
  {/if}
</div>