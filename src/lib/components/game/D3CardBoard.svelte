<script lang="ts">
  import type { SvelteComponent } from 'svelte';
  import * as d3 from 'd3';
  import { User } from '@lucide/svelte';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import { 
    getGameContext,
    subscribeToGame
  } from '$lib/services/gameService';
  import type { Card, Actor, Agreement, ActorWithCard } from '$lib/types';
  import { GameStatus } from '$lib/types';
  import CardDetailsPopover from './CardDetailsPopover.svelte';
  import {
    createCardIcon,
    initializeD3Graph,
    addDonutRings,
    type D3Node,
    type D3Link,
    type CardWithPosition,
    type AgreementWithPosition
  } from '$lib/utils/d3GraphUtils';
  
  const { gameId, activeActorId = undefined } = $props<{
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
   * Loads game data using getGameContext
   */
  async function loadGameData(): Promise<{
    cards: CardWithPosition[];
    agreements: AgreementWithPosition[];
    actors: ActorWithCard[];
  }> {
    // Get the full game context with all cards, values, capabilities, etc.
    const ctx = await getGameContext(gameId);
    
    if (!ctx) {
      console.error('[D3CardBoard] No context returned from getGameContext');
      return { cards: [], agreements: [], actors: [] };
    }
    
    // Extract all assigned cards and add position data
    const assigned: CardWithPosition[] = ctx.actors
      .filter(a => !!a.card)
      .map(a => ({
        ...a.card!,
        actor_id: a.actor_id,
        position: a.position || { x: Math.random() * width, y: Math.random() * height },
      }));

    // Add position data to unassigned cards
    const availableWithPos: CardWithPosition[] = (ctx.availableCards || []).map(c => ({
      ...c,
      position: { x: Math.random() * width, y: Math.random() * height },
    }));

    const allCards = [...assigned, ...availableWithPos];

    return {
      cards: allCards,
      agreements: ctx.agreements || [],
      actors: ctx.actors || []
    };
  }

  /** 
   * Initializes the D3 visualization with data from getGameContext
   */
  async function initializeVisualization() {
    console.log('[D3CardBoard] Starting visualization');
    if (!svgElement) {
      console.error('[D3CardBoard] SVG element not available');
      return;
    }

    try {
      // Load everything from the game context
      const { cards, agreements: loadedAgreements, actors: loadedActors } = await loadGameData();
      
      // Update component state
      cardsWithPosition = cards;
      agreements = loadedAgreements;
      actors = loadedActors;
      
      console.log(`[D3CardBoard] Loaded ${cards.length} cards, ${loadedAgreements.length} agreements, ${loadedActors.length} actors`);

      // If we have an active actor, set their card as active
      if (activeActorId) {
        const actor = actors.find(a => a.actor_id === activeActorId);
        if (actor && actor.card_id) {
          activeCardId = actor.card_id;
        }
      }

      // Build the map from actor → card
      actorCardMap.clear();
      actors.forEach(a => {
        if (a.card_id) {
          actorCardMap.set(a.actor_id, a.card_id);
        }
      });

      // Skip initialization if no cards are available
      if (cardsWithPosition.length === 0) {
        console.log('[D3CardBoard] No cards available, skipping graph initialization');
        return;
      }

      // Initialize the D3 graph visualization
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

      // Add donut rings for values and capabilities
      if (nodeElements) {
        try {
          addDonutRings(nodeElements, activeCardId);
        } catch (donutError) {
          console.error('[D3CardBoard] Error adding donut rings:', donutError);
        }
      }

      // Get unique icon names from cards and preload them
      const iconNames = cardsWithPosition
        .map((card) => card.icon || 'user')
        .filter((value, index, self) => self.indexOf(value) === index);
      
      try {
        await loadIcons(iconNames);
      } catch (iconError) {
        console.error('[D3CardBoard] Error loading icons:', iconError);
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
        } catch (nodeError) {
          console.error('[D3CardBoard] Error rendering node icons:', nodeError);
        }
      }

      // Set up subscriptions to game data updates
      subscribeToGameData();
      console.log('[D3CardBoard] Visualization complete');
    } catch (error) {
      console.error('[D3CardBoard] Error initializing visualization:', error);
    }
  }

  // Set up data subscriptions
  function subscribeToGameData() {
    // Clean up any existing subscriptions
    unsubscribe.forEach(unsub => unsub());
    unsubscribe = [];
    
    // Track last update time to prevent update storms
    let lastUpdateTime = Date.now();
    let updateTimer: number | null = null;
    
    // Subscribe to game updates - this will capture all changes including actors
    unsubscribe.push(
      subscribeToGame(gameId, () => {
        const now = Date.now();
        
        // Debounce updates with a 5-second buffer to prevent infinite loops
        if (now - lastUpdateTime < 5000) {
          return;
        }
        
        // Clear any pending update timer
        if (updateTimer !== null) {
          clearTimeout(updateTimer);
        }
        
        // Set a new timer to prevent clustering of updates
        updateTimer = setTimeout(() => {
          lastUpdateTime = Date.now();
          console.log('[D3CardBoard] Game update detected, refreshing');
          updateTimer = null;
          initializeVisualization();
        }, 500) as unknown as number;
      })
    );
  }

  // Component initialization and cleanup with $effect
  $effect(() => {
    console.log('[D3CardBoard] Component mounted');
    
    // Initialize with a slight delay to avoid immediate re-renders
    setTimeout(() => {
      initializeVisualization();
    }, 300);
    
    // Return cleanup function to run when component is destroyed
    return () => {
      console.log('[D3CardBoard] Component cleanup');
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
  <svg bind:this={svgElement} width="100%" height="100%" class="d3-graph bg-surface-50-950"></svg>
  {#if selectedNode}
    <div class="absolute bottom-4 right-4">
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
    stroke: var(--color-indigo-600-400);
  }
  
  :global(.link.benefit) {
    stroke: var(--color-emerald-500-400);
    stroke-dasharray: 4 2;
  }
  
  :global(.node.active circle) {
    stroke: var(--color-green-400-500);
    stroke-width: 3px;
  }
</style>