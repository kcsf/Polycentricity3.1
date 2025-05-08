<script lang="ts">
  import * as d3 from 'd3';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import { getGameContext, subscribeToGame } from '$lib/services/gameService';
  import type { Card, ActorWithCard, D3Node, CardWithPosition, AgreementWithPosition, ObligationItem, BenefitItem} from '$lib/types';
  import CardDetailsPopover from './CardDetailsPopover.svelte';
  import {
    createCardIcon,
    initializeD3Graph,
    addDonutRings,
  } from '$lib/utils/d3GraphUtils';

  const { gameId, activeActorId = undefined } = $props<{
    gameId: string;
    activeActorId?: string;
    cards?: Card[];
  }>();

  // UI state
  let svgElement = $state<SVGSVGElement | null>(null);
  let width = $state(800);
  let height = $state(600);
  let simulation = $state<d3.Simulation<D3Node, undefined> | null>(null);
  let nodeElements = $state<d3.Selection<SVGGElement, D3Node, SVGGElement, unknown> | null>(null);
  let cardsWithPosition = $state<CardWithPosition[]>([]);
  let agreements = $state<AgreementWithPosition[]>([]);
  let actors = $state<ActorWithCard[]>([]);
  let actorCardMap = $state(new Map<string, string>());
  let selectedNode = $state<D3Node | null>(null);
  let activeCardId = $state<string | null>(null);
  let unsubscribe = $state<(() => void)[]>([]);

  // Resize observer
  $effect(() => {
    if (svgElement?.parentElement) {
      const rect = svgElement.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }
  });

  /** Load and map game context to D3 types */
  async function loadGameData(): Promise<{
    cards: CardWithPosition[];
    agreements: AgreementWithPosition[];
    actors: ActorWithCard[];
  }> {
    const ctx = await getGameContext(gameId);
    if (!ctx) {
      console.error('[D3CardBoard] No context returned');
      return { cards: [], agreements: [], actors: [] };
    }

    // Assigned cards with positions
    const assigned = ctx.actors
      .filter(a => !!a.card)
      .map(a => ({
        ...a.card!,
        actor_id: a.actor_id,
        position: a.position || { x: Math.random() * width, y: Math.random() * height }
      }));

    // Available cards with random positions
    const availableWithPos = (ctx.availableCards || []).map(c => ({
      ...c,
      position: { x: Math.random() * width, y: Math.random() * height }
    }));

    const allCards = [...assigned, ...availableWithPos];

    // Map agreements to include obligations & benefits objects, and boolean parties
    const d3Agreements: AgreementWithPosition[] = ctx.agreements || [];

    return { cards: allCards, agreements: d3Agreements, actors: ctx.actors || [] };
  }

  /** Initialize and render D3 graph */
  async function initializeVisualization() {
    console.log('[D3CardBoard] Initializing');
    if (!svgElement) return;

    const { cards, agreements: loadedAgreements, actors: loadedActors } = await loadGameData();
    cardsWithPosition = cards;
    agreements = loadedAgreements;
    actors = loadedActors;

    // Active card for highlighting
    if (activeActorId) {
      const actor = actors.find(a => a.actor_id === activeActorId);
      if (actor?.card) activeCardId = actor.card.card_id;
    }

    // Build actor→card map
    actorCardMap.clear();
    actors.forEach(a => {
      if (a.card) actorCardMap.set(a.actor_id, a.card.card_id);
    });

    if (!cardsWithPosition.length) return;

    // Create force graph
    const graphState = initializeD3Graph(
      svgElement,
      cardsWithPosition,
      agreements,
      width,
      height,
      activeCardId,
      node => (selectedNode = node),
      actorCardMap
    );

    simulation = graphState.simulation;
    nodeElements = graphState.nodeElements;

    // Add donut rings
    if (nodeElements) addDonutRings(nodeElements, activeCardId);

    // Preload and render icons
    const iconNames = cardsWithPosition
      .map(c => c.icon || 'user')
      .filter((v, i, a) => a.indexOf(v) === i);
    await loadIcons(iconNames);

    if (nodeElements) {
      nodeElements.each(function (node: D3Node) {
        if (node.type === 'actor') {
          const centerGroup = d3
            .select(this)
            .append('g')
            .attr('class', 'center-group center-icon-container');

          const iconContainer = document.createElement('div');
          iconContainer.className = 'icon-container';
          const card = node.data as Card;
          if (!card) return;

          const iconName = card.icon || 'user';
          const isActive = node.id === activeCardId;
          const iconSize = isActive ? 36 : 24;

          createCardIcon(iconName, iconSize, iconContainer, card.role_title || 'Card');

          const foreignObj = centerGroup
            .append('foreignObject')
            .attr('width', iconSize)
            .attr('height', iconSize)
            .attr('x', -iconSize / 2)
            .attr('y', -iconSize / 2)
            .attr('class', 'card-icon-container')
            .style('pointer-events', 'none')
            .style('overflow', 'visible');

          foreignObj.node()?.appendChild(iconContainer);
        }
      });
    }

    subscribeToGameData();
    console.log('[D3CardBoard] Render complete');
  }

  // Subscribe to live updates
  function subscribeToGameData() {
    unsubscribe.forEach(fn => fn());
    unsubscribe = [];
    let last = Date.now();
    let timer: number | null = null;

    unsubscribe.push(
      subscribeToGame(gameId, () => {
        const now = Date.now();
        if (now - last < 5000) return;
        if (timer) clearTimeout(timer);
        timer = window.setTimeout(() => {
          last = Date.now();
          initializeVisualization();
        }, 500);
      })
    );
  }

  // Mount & cleanup
  $effect(() => {
    setTimeout(initializeVisualization, 300);
    return () => {
      simulation?.stop();
      unsubscribe.forEach(fn => fn());
    };
  });
</script>

<div class="w-full h-full relative overflow-hidden">
  <svg
    bind:this={svgElement}
    width="100%"
    height="100%"
    class="d3-graph bg-surface-50-950"
  ></svg>
  {#if selectedNode}
    <div class="absolute bottom-4 right-4">
      <CardDetailsPopover
        node={selectedNode}
        cards={cardsWithPosition}
        onClose={() => (selectedNode = null)}
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
  :global(.center-icon-container) {
    pointer-events: none;
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