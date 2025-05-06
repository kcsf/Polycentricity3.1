<script lang="ts">
  import type { SvelteComponent } from 'svelte';
  import * as d3 from 'd3';
  import { User } from '@lucide/svelte';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import { getGun, nodes } from '$lib/services/gunService';
  import { 
    getGameContext,
    subscribeToGame
  } from '$lib/services/gameService';
  
  // Import directly for debugging access to values & capabilities
  import { getValue } from '$lib/services/valueService';
  import { getCapability } from '$lib/services/capabilityService';
  import type { Card, Value, Capability, Actor, Agreement, GameContext, ActorWithCard } from '$lib/types';
  import { GameStatus } from '$lib/types';
  import CardDetailsPopover from './CardDetailsPopover.svelte';
  import {
    createNodes,
    createLinks,
    setupInteractions,
    createCardIcon,
    updateForces,
    initializeD3Graph,
    addDonutRings,
    type D3Node,
    type D3Link,
    type CardWithPosition,
    type AgreementWithPosition
  } from '$lib/utils/d3GraphUtils';
  
  // Enhanced logging utility for debugging with proper $state handling for Svelte 5 Runes
  const isDev = process.env.NODE_ENV !== 'production';
  const log = (...args: any[]) => {
    if (!isDev) return;
  
    try {
      // Process args to handle $state variables safely
      const processedArgs = args.map(arg => {
        if (arg && typeof arg === 'object') {
          try {
            // For Svelte 5 Runes state objects that need snapshots
            if ('$state' in globalThis && arg.$state) {
              return arg.$state.snapshot();
            }
            
            // Special handling for Gun data which might have circular references
            if (arg._?.$ || arg['#']) {
              return `[Gun:${typeof arg}]`;
            }
            
            // Clone other objects to avoid reactive binding issues
            return structuredClone(arg);
          } catch (e) {
            // If not serializable, return a string representation
            return `[Object:${typeof arg}]`;
          }
        }
        return arg;
      });
      
      console.log('[D3CardBoard]', ...processedArgs);
    } catch (err) {
      // Failsafe for any unexpected errors in logging
      console.log('[D3CardBoard] Error in logging:', String(err));
    }
  };
  
  const { gameId, activeActorId = undefined, cards = undefined } = $props<{
    gameId: string;
    activeActorId?: string;
    cards?: Card[];
  }>();

  // UI state variables
  let svgElement = $state<SVGSVGElement | null>(null);
  let width = $state(800);
  let height = $state(600);
  let simulation = $state<d3.Simulation<D3Node, undefined> | null>(null);
  let nodeElements = $state<d3.Selection<SVGGElement, D3Node, null, undefined> | null>(null);
  let cardsWithPosition = $state<CardWithPosition[]>([]);
  let agreements = $state<AgreementWithPosition[]>([]);
  let actors = $state<Actor[]>([]);
  let actorCardMap = $state(new Map<string, string>());
  let selectedNode = $state<D3Node | null>(null);
  let activeCardId = $state<string | null>(null);
  let unsubscribe = $state<(() => void)[]>([]);

  // Update dimensions when parent element resizes
  $effect(() => {
    if (svgElement && svgElement.parentElement) {
      const rect = svgElement.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }
  });

  /** 
   * Replaces the old loadCardData/loadAgreementData/loadGameData
   * with one single call to getGameContext.
   */
  async function loadGameData(): Promise<{
    cards: CardWithPosition[];
    agreements: AgreementWithPosition[];
    actors: ActorWithCard[];
  }> {
    console.log('[DEBUGGING] Starting loadGameData for game:', gameId);
    const ctx = await getGameContext(gameId);
    
    // Log the raw context to debug what's returned from gameService
    console.log('[DEBUGGING] Raw game context received:', JSON.stringify(ctx, (key, value) => {
      // Filter out circular references
      if (key === '_' || key === '#') return undefined;
      return value;
    }, 2).substring(0, 1000) + '...');  // Limit size for readability
    
    if (!ctx) {
      console.error('[DEBUGGING] No context returned from getGameContext!');
      return { cards: [], agreements: [], actors: [] };
    }
    
    // Debug log to see what we're getting from the context
    console.log('[DEBUGGING] Game context has:', {
      actorsCount: ctx.actors?.length || 0,
      agreementsCount: ctx.agreements?.length || 0,
      availableCardsCount: ctx.availableCards?.length || 0,
      valuesCount: ctx.values?.length || 0,
      capabilitiesCount: ctx.capabilities?.length || 0
    });
    
    // Check if we have sample data for values & capabilities
    if (ctx.actors && ctx.actors.length > 0) {
      const sampleCard = ctx.actors.find(a => a.card)?.card;
      if (sampleCard) {
        console.log('[DEBUGGING] Sample card data:', {
          card_id: sampleCard.card_id,
          role_title: sampleCard.role_title,
          hasValueNames: !!sampleCard._valueNames,
          valueNamesLength: sampleCard._valueNames?.length,
          hasCapabilityNames: !!sampleCard._capabilityNames,
          capabilityNamesLength: sampleCard._capabilityNames?.length,
          hasValuesRef: !!sampleCard.values_ref,
          valuesRefSize: Object.keys(sampleCard.values_ref || {}).filter(k => k !== '#' && k !== '_').length,
          hasCapabilitiesRef: !!sampleCard.capabilities_ref,
          capabilitiesRefSize: Object.keys(sampleCard.capabilities_ref || {}).filter(k => k !== '#' && k !== '_').length
        });
        
        // Log any values_ref and capabilities_ref keys
        if (sampleCard.values_ref) {
          console.log('[DEBUGGING] Values reference keys:', 
            Object.keys(sampleCard.values_ref).filter(k => k !== '#' && k !== '_'));
        }
        if (sampleCard.capabilities_ref) {
          console.log('[DEBUGGING] Capabilities reference keys:', 
            Object.keys(sampleCard.capabilities_ref).filter(k => k !== '#' && k !== '_'));
        }
      } else {
        console.warn('[DEBUGGING] No cards found in actors array!');
      }
    }
    
    // Helper function to directly access the Gun.js data
    async function getCardMetadata(card: Card) {
      // Get Gun instance
      const gun = getGun();
      console.log('[DEBUGGING] Accessing direct Gun data for card:', card.card_id);
      
      // Access values directly from Gun
      let valueNamesPromise = Promise.resolve([] as string[]);
      if (card.values_ref && typeof card.values_ref === 'object') {
        console.log('[DEBUGGING] Card has values_ref:', card.values_ref);
        
        // Read the gun reference directly to get the full values data
        const valuesRef = card.values_ref;
        
        // Check if we have a valid Gun.js reference with a hash
        if (valuesRef['#']) {
          console.log('[DEBUGGING] Got valid values_ref hash:', valuesRef['#']);
          
          // Use direct Gun access to read the reference
          valueNamesPromise = new Promise((resolve) => {
            const path = valuesRef['#'] as string;
            const gun = getGun();
            
            console.log(`[DEBUGGING] Accessing Gun path: ${path}`);
            gun.get(path).once((data: any) => {
              console.log(`[DEBUGGING] Direct Gun read of values_ref returned:`, data);
              
              if (!data) {
                console.log('[DEBUGGING] No data found at values_ref path');
                resolve([]);
                return;
              }
              
              // Filter out gun metadata
              const valueKeys = Object.keys(data).filter(k => k !== '#' && k !== '_' && k !== '');
              console.log('[DEBUGGING] Extracted value keys:', valueKeys);
              
              // If we have values in the direct reference
              if (valueKeys.length > 0) {
                // Convert keys to readable names
                const valueNames = valueKeys.map(key => 
                  key.startsWith('value_') ? key.substring(6).replace(/-/g, ' ') : key
                );
                console.log('[DEBUGGING] Extracted value names:', valueNames);
                resolve(valueNames);
              } else {
                console.log('[DEBUGGING] No value keys found in direct Gun access');
                resolve([]);
              }
            });
          });
        } else {
          // Fallback to the old approach if no hash reference is available
          valueNamesPromise = new Promise((resolve) => {
            const valueNames: string[] = [];
            let valueKeysProcessed = 0;
            const valueKeys = Object.keys(card.values_ref || {}).filter(k => k !== '#' && k !== '_');
            console.log('[DEBUGGING] Processing value keys with old method:', valueKeys);
            
            // No values found, resolve empty array
            if (valueKeys.length === 0) {
              console.log('[DEBUGGING] No value keys found in values_ref');
              resolve([]);
              return;
            }
            
            // Process each value reference
            valueKeys.forEach(valueId => {
              console.log('[DEBUGGING] Looking up value:', valueId);
              getValue(valueId).then(value => {
                if (value && value.name) {
                  console.log(`[DEBUGGING] Found value name for ${valueId}:`, value.name);
                  valueNames.push(value.name);
                } else {
                  console.log(`[DEBUGGING] No value data found for ${valueId}`);
                  // If no name, use the ID with formatting
                  valueNames.push(valueId.startsWith('value_') 
                    ? valueId.substring(6).replace(/-/g, ' ') 
                    : valueId);
                }
                
                valueKeysProcessed++;
                if (valueKeysProcessed === valueKeys.length) {
                  console.log('[DEBUGGING] All value keys processed, returning:', valueNames);
                  resolve(valueNames);
                }
              });
            });
          });
        }
      } else {
        console.log('[DEBUGGING] Card has no values_ref or it is not an object');
      }
      
      // Access capabilities directly from Gun
      let capabilityNamesPromise = Promise.resolve([] as string[]);
      if (card.capabilities_ref && typeof card.capabilities_ref === 'object') {
        console.log('[DEBUGGING] Card has capabilities_ref:', card.capabilities_ref);
        
        // Read the gun reference directly to get the full capabilities data
        const capabilitiesRef = card.capabilities_ref;
        
        // Check if we have a valid Gun.js reference with a hash
        if (capabilitiesRef['#']) {
          console.log('[DEBUGGING] Got valid capabilities_ref hash:', capabilitiesRef['#']);
          
          // Use direct Gun access to read the reference
          capabilityNamesPromise = new Promise((resolve) => {
            const path = capabilitiesRef['#'] as string;
            const gun = getGun();
            
            console.log(`[DEBUGGING] Accessing Gun path: ${path}`);
            gun.get(path).once((data: any) => {
              console.log(`[DEBUGGING] Direct Gun read of capabilities_ref returned:`, data);
              
              if (!data) {
                console.log('[DEBUGGING] No data found at capabilities_ref path');
                resolve([]);
                return;
              }
              
              // Filter out gun metadata
              const capKeys = Object.keys(data).filter(k => k !== '#' && k !== '_' && k !== '');
              console.log('[DEBUGGING] Extracted capability keys:', capKeys);
              
              // If we have capabilities in the direct reference
              if (capKeys.length > 0) {
                // Convert keys to readable names
                const capabilityNames = capKeys.map(key => 
                  key.startsWith('capability_') ? key.substring(11).replace(/-/g, ' ') : key
                );
                console.log('[DEBUGGING] Extracted capability names:', capabilityNames);
                resolve(capabilityNames);
              } else {
                console.log('[DEBUGGING] No capability keys found in direct Gun access');
                resolve([]);
              }
            });
          });
        } else {
          // Fallback to the old approach if no hash reference is available
          capabilityNamesPromise = new Promise((resolve) => {
            const capabilityNames: string[] = [];
            let capKeysProcessed = 0;
            const capKeys = Object.keys(card.capabilities_ref || {}).filter(k => k !== '#' && k !== '_');
            console.log('[DEBUGGING] Processing capability keys with old method:', capKeys);
            
            // No capabilities found, resolve empty array
            if (capKeys.length === 0) {
              console.log('[DEBUGGING] No capability keys found in capabilities_ref');
              resolve([]);
              return;
            }
            
            // Process each capability reference
            capKeys.forEach(capId => {
              console.log('[DEBUGGING] Looking up capability:', capId);
              getCapability(capId).then(capability => {
                if (capability && capability.name) {
                  console.log(`[DEBUGGING] Found capability name for ${capId}:`, capability.name);
                  capabilityNames.push(capability.name);
                } else {
                  console.log(`[DEBUGGING] No capability data found for ${capId}`);
                  // If no name, use the ID with formatting
                  capabilityNames.push(capId.startsWith('capability_') 
                    ? capId.substring(11).replace(/-/g, ' ') 
                    : capId);
                }
                
                capKeysProcessed++;
                if (capKeysProcessed === capKeys.length) {
                  console.log('[DEBUGGING] All capability keys processed, returning:', capabilityNames);
                  resolve(capabilityNames);
                }
              });
            });
          });
        }
      } else {
        console.log('[DEBUGGING] Card has no capabilities_ref or it is not an object');
      }
      
      // Wait for both promises to resolve
      const [valueNames, capabilityNames] = await Promise.all([valueNamesPromise, capabilityNamesPromise]);
      return { valueNames, capabilityNames };
    }
    
    // Extract all assigned cards - cards already have _valueNames and _capabilityNames from getGameContext
    const assigned: CardWithPosition[] = [];
    
    // Process actors sequentially to avoid overloading the Gun.js instance
    for (const a of ctx.actors.filter(a => !!a.card)) {
      try {
        console.log(`[DEBUGGING] Processing actor ${a.actor_id} with card ${a.card?.card_id}`);
        
        // Get direct metadata from Gun if needed
        let valueNames = a.card!._valueNames || [];
        let capabilityNames = a.card!._capabilityNames || [];
        
        // If we don't have values or capabilities, try to get them directly from Gun
        if ((valueNames.length === 0 || capabilityNames.length === 0) && 
            (a.card!.values_ref || a.card!.capabilities_ref)) {
          console.log(`[DEBUGGING] Card ${a.card!.card_id} missing metadata, fetching directly`);
          const metadata = await getCardMetadata(a.card!);
          valueNames = metadata.valueNames;
          capabilityNames = metadata.capabilityNames;
          console.log(`[DEBUGGING] Retrieved metadata for card ${a.card!.card_id}:`, metadata);
        }
        
        const cardWithPosition = {
          ...a.card!,
          actor_id: a.actor_id,
          position: a.position || { x: Math.random() * width, y: Math.random() * height },
          _valueNames: valueNames,
          _capabilityNames: capabilityNames
        };
        
        console.log(`[DEBUGGING] Card ${cardWithPosition.card_id} processed with:`, {
          valueNames: cardWithPosition._valueNames,
          capabilityNames: cardWithPosition._capabilityNames
        });
        
        assigned.push(cardWithPosition);
      } catch (error) {
        console.error(`[DEBUGGING] Error processing card for actor ${a.actor_id}:`, error);
      }
    }
    
    // Log the processed assigned cards
    console.log(`[DEBUGGING] Processed ${assigned.length} assigned cards`);

    // Append the "available" cards with position data
    const availableWithPos: CardWithPosition[] = [];
    
    // Process available cards sequentially the same way as assigned cards
    for (const c of (ctx.availableCards || [])) {
      try {
        console.log(`[DEBUGGING] Processing available card ${c.card_id}`);
        
        // Get direct metadata from Gun if needed
        let valueNames = c._valueNames || [];
        let capabilityNames = c._capabilityNames || [];
        
        // If we don't have values or capabilities, try to get them directly from Gun
        if ((valueNames.length === 0 || capabilityNames.length === 0) && 
            (c.values_ref || c.capabilities_ref)) {
          console.log(`[DEBUGGING] Available card ${c.card_id} missing metadata, fetching directly`);
          const metadata = await getCardMetadata(c);
          valueNames = metadata.valueNames;
          capabilityNames = metadata.capabilityNames;
          console.log(`[DEBUGGING] Retrieved metadata for available card ${c.card_id}:`, metadata);
        }
        
        const cardWithPosition = {
          ...c,
          position: { x: Math.random() * width, y: Math.random() * height },
          _valueNames: valueNames,
          _capabilityNames: capabilityNames
        };
        
        console.log(`[DEBUGGING] Available card ${cardWithPosition.card_id} processed with:`, {
          valueNames: cardWithPosition._valueNames,
          capabilityNames: cardWithPosition._capabilityNames
        });
        
        availableWithPos.push(cardWithPosition);
      } catch (error) {
        console.error(`[DEBUGGING] Error processing available card ${c.card_id}:`, error);
      }
    }
    
    console.log(`[DEBUGGING] Processed ${availableWithPos.length} available cards`);

    const allCards = [ ...assigned, ...availableWithPos ];

    return {
      cards: allCards,
      agreements: ctx.agreements || [],
      actors: ctx.actors || []
    };
  }

  /** 
   * One function that replaces the entire old initializeVisualization 
   * + subscription logic — it pulls everything in one go and then
   * boots D3.
   */
  async function initializeVisualization() {
    log('[D3CardBoard] Starting visualization initialization');
    if (!svgElement) {
      console.error('[D3CardBoard] SVG element not available');
      return;
    }

    try {
      // Load everything in parallel from the game context
      const { cards, agreements: loadedAgreements, actors: loadedActors } = await loadGameData();
      
      // Update our component state
      cardsWithPosition = cards;
      agreements = loadedAgreements;
      actors = loadedActors;
      
      log(`[D3CardBoard] Loaded ${cards.length} cards, ${loadedAgreements.length} agreements, ${loadedActors.length} actors`);

      // If we have an active actor, set their card as active
      if (activeActorId) {
        const actor = actors.find(a => a.actor_id === activeActorId);
        if (actor && actor.card_id) {
          activeCardId = actor.card_id;
          log(`[D3CardBoard] Set active card to ${activeCardId} for actor ${activeActorId}`);
        }
      }

      // Build the map from actor → card
      actorCardMap.clear();
      actors.forEach(a => {
        if (a.card_id) {
          actorCardMap.set(a.actor_id, a.card_id);
          log(`[D3CardBoard] Mapped actor ${a.actor_id} to card ${a.card_id}`);
        }
      });

      // Skip initialization if no cards are available
      if (cardsWithPosition.length === 0) {
        log('[D3CardBoard] No cards available, skipping graph initialization');
        return;
      }

      // Initialize the D3 graph visualization
      log('[D3CardBoard] Initializing D3 graph with cards:', cardsWithPosition.length);
      const graphState = initializeD3Graph(
        svgElement,
        cardsWithPosition,
        agreements,
        width,
        height,
        activeCardId,
        (node) => (selectedNode = node),
        actorCardMap
      );

      // Check if we got valid results back
      if (!graphState || !graphState.simulation || !graphState.nodeElements) {
        throw new Error('D3 graph initialization returned invalid state');
      }

      simulation = graphState.simulation;
      nodeElements = graphState.nodeElements;
      log('[D3CardBoard] D3 graph initialized successfully');

      // Add donut rings for values and capabilities
      if (nodeElements) {
        try {
          addDonutRings(nodeElements, activeCardId);
          log('[D3CardBoard] Added donut rings to nodes');
        } catch (donutError) {
          console.error('[D3CardBoard] Error adding donut rings:', donutError);
          // Continue anyway, donut rings are visual enhancements only
        }
      }

      // Get unique icon names from cards and preload them
      const iconNames = cardsWithPosition
        .map((card) => card.icon || 'user')
        .filter((value, index, self) => self.indexOf(value) === index);
      
      try {
        await loadIcons(iconNames);
        log(`[D3CardBoard] Successfully loaded ${iconNames.length} icons`);
      } catch (iconError) {
        log(`[D3CardBoard] Error loading icons: ${iconError}`);
        // Continue anyway - our createCardIcon function has fallbacks
      }

      // Add icons to nodes
      if (nodeElements) {
        try {
          nodeElements.each(function (node: D3Node) {
            if (node.type === 'actor') {
              const centerGroup = d3.select(this).append('g').attr('class', 'center-group center-icon-container');
              const iconContainer = document.createElement('div');
              iconContainer.className = 'icon-container';
              const card = node.data as Card;
              if (!card) return;

              // Use the icon name directly from the card data
              const iconName = card.icon || 'user';
              const isActive = node.id === activeCardId;
              const iconSize = isActive ? 36 : 24;
              
              // Create and position the icon
              createCardIcon(iconName, iconSize, iconContainer, card.role_title || 'Card');
              const foreignObject = centerGroup
                .append('foreignObject')
                .attr('width', iconSize)
                .attr('height', iconSize)
                .attr('x', -iconSize/2)
                .attr('y', -iconSize/2)
                .attr('class', 'card-icon-container')
                .style('pointer-events', 'none')
                .style('overflow', 'visible');
              
              foreignObject.node()?.appendChild(iconContainer);
            }
          });
          log('[D3CardBoard] Added icons to nodes');
        } catch (nodeError) {
          console.error('[D3CardBoard] Error rendering node icons:', nodeError);
        }
      }

      // Set up subscriptions to game data updates
      subscribeToGameData();
      log('[D3CardBoard] Graph visualization setup complete');
    } catch (error) {
      console.error('[D3CardBoard] Error initializing visualization:', error);
    }
  }

  // Set up data subscriptions
  function subscribeToGameData() {
    // Clean up any existing subscriptions
    unsubscribe.forEach(unsub => unsub());
    unsubscribe = [];
    
    log(`[D3CardBoard] Setting up game data subscriptions for ${gameId}`);

    // Track last update time to prevent update storms
    let lastUpdateTime = Date.now();
    let updateTimer: number | null = null;
    
    // Subscribe to game updates - this will capture all changes including actors
    unsubscribe.push(
      subscribeToGame(gameId, () => {
        const now = Date.now();
        
        // Debounce updates with a 5-second buffer to prevent infinite loops
        if (now - lastUpdateTime < 5000) {
          log('[D3CardBoard] Skipping rapid update (debounced)');
          return;
        }
        
        // Clear any pending update timer
        if (updateTimer !== null) {
          clearTimeout(updateTimer);
        }
        
        // Set a new timer to prevent clustering of updates
        updateTimer = setTimeout(() => {
          lastUpdateTime = Date.now();
          log('[D3CardBoard] Game update detected, refreshing visualization');
          updateTimer = null;
          initializeVisualization();
        }, 500) as unknown as number;
      })
    );
  }

  // Component initialization and cleanup with $effect
  $effect(() => {
    log('[D3CardBoard] Component mounted');
    
    // Initialize with a slight delay to avoid immediate re-renders
    setTimeout(() => {
      initializeVisualization();
    }, 300);
    
    // Return cleanup function to run when component is destroyed
    return () => {
      log('[D3CardBoard] Component cleanup');
      if (simulation) simulation.stop();
      
      // Clean up all subscriptions
      unsubscribe.forEach((unsub) => {
        try {
          if (typeof unsub === 'function') unsub();
        } catch (e) {
          console.error('[D3CardBoard] Error during unsubscribe:', e);
        }
      });
      
      // Clear the subscriptions array
      unsubscribe = [];
    };
  });
</script>

<div class="w-full h-full relative overflow-hidden">
  <svg bind:this={svgElement} width="100%" height="100%" class="d3-graph"></svg>
  {#if selectedNode}
    <div class="absolute bottom-4 left-4">
      <CardDetailsPopover 
        node={selectedNode} 
        onClose={() => selectedNode = null} 
      />
    </div>
  {/if}
</div>

<style>
  :global(.icon-container) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
  
  :global(.link.obligation) {
    stroke: #4f46e5; /* indigo-600 */
  }
  
  :global(.link.benefit) {
    stroke: #10b981; /* emerald-500 */
    stroke-dasharray: 4 2;
  }
  
  :global(.node.active circle) {
    stroke: #4ade80; /* green-400 */
    stroke-width: 3px;
  }
</style>