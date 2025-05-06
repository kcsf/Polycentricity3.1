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
    const ctx = await getGameContext(gameId);
    if (!ctx) {
      return { cards: [], agreements: [], actors: [] };
    }

    // Extract all assigned cards (with their actor_id & position baked in)
    const assigned: CardWithPosition[] = ctx.actors
      .filter(a => !!a.card)
      .map(a => {
        // Extract values from values_ref if it exists
        const valueNames: string[] = a.card!.values_ref ? 
          Object.keys(a.card!.values_ref)
            .filter(key => key !== '#' && key !== '_')
            .map(key => key.startsWith('value_') ? key.substring(6).replace(/-/g, ' ') : key) 
          : [];
          
        // Extract capabilities from capabilities_ref if it exists
        const capabilityNames: string[] = a.card!.capabilities_ref ? 
          Object.keys(a.card!.capabilities_ref)
            .filter(key => key !== '#' && key !== '_')
            .map(key => key.startsWith('capability_') ? key.substring(11).replace(/-/g, ' ') : key)
          : [];
          
        return {
          ...a.card!,
          actor_id: a.actor_id,
          position: a.position || { x: Math.random() * width, y: Math.random() * height },
          // Use the extracted values and capabilities
          _valueNames: valueNames,
          _capabilityNames: capabilityNames
        };
      });

    // Append the "available" cards with position data
    const availableWithPos = (ctx.availableCards || []).map(card => {
      // Extract values from values_ref if it exists
      const valueNames: string[] = card.values_ref ? 
        Object.keys(card.values_ref)
          .filter(key => key !== '#' && key !== '_')
          .map(key => key.startsWith('value_') ? key.substring(6).replace(/-/g, ' ') : key) 
        : [];
        
      // Extract capabilities from capabilities_ref if it exists
      const capabilityNames: string[] = card.capabilities_ref ? 
        Object.keys(card.capabilities_ref)
          .filter(key => key !== '#' && key !== '_')
          .map(key => key.startsWith('capability_') ? key.substring(11).replace(/-/g, ' ') : key)
        : [];
      
      return {
        ...card,
        position: { x: Math.random() * width, y: Math.random() * height },
        // Use the extracted values and capabilities
        _valueNames: valueNames,
        _capabilityNames: capabilityNames
      };
    });

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