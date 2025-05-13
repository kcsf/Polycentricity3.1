<script lang="ts">
  import type { SvelteComponent } from 'svelte';
  import * as d3 from 'd3';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import {
    getGameContext,
    subscribeToGame,
  } from '$lib/services/gameService';
  import type {
    Card,
    ActorWithCard,
    D3Node,
    D3Link,
    CardWithPosition,
    AgreementWithPosition,
  } from '$lib/types';
  import CardDetailsPopover from './CardDetailsPopover.svelte';
  import {
    createCardIcon,
    initializeD3Graph,
    addDonutRings,
  } from '$lib/utils/d3index';

  const { gameId, activeActorId = undefined } = $props<{
    gameId: string;
    activeActorId?: string;
  }>();

  // UI state
  let svgElement = $state<SVGSVGElement | null>(null);
  let width = $state(800);
  let height = $state(600);
  let simulation = $state<d3.Simulation<D3Node, undefined> | null>(null);
  // note: nodeElements is a group <g> selection, not the SVG root
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

    const assigned = ctx.actors
      .filter(a => !!a.card)
      .map(a => ({
        ...a.card!,
        actor_id: a.actor_id,
        position: a.position || { x: Math.random() * width, y: Math.random() * height },
      }));

    const availableWithPos = (ctx.availableCards || []).map(c => ({
      ...c,
      position: { x: Math.random() * width, y: Math.random() * height },
    }));

    return {
      cards: [...assigned, ...availableWithPos],
      agreements: ctx.agreements || [],
      actors: ctx.actors || [],
    };
  }

  async function initializeVisualization() {
    console.log('[D3CardBoard] Initializing');
    if (!svgElement) return;

    const { cards, agreements: loadedAgreements, actors: loadedActors } = await loadGameData();
    cardsWithPosition = cards;
    agreements = loadedAgreements;
    actors = loadedActors;

    if (activeActorId) {
      const actor = actors.find(a => a.actor_id === activeActorId);
      if (actor?.card) activeCardId = actor.card.card_id;
    }

    actorCardMap.clear();
    actors.forEach(a => {
      if (a.card) actorCardMap.set(a.actor_id, a.card.card_id);
    });

    if (!cardsWithPosition.length) return;

    const graphState = initializeD3Graph(
      svgElement,
      cardsWithPosition,
      agreements,
      width,
      height,
      activeCardId,
      node => (selectedNode = node),
      actorCardMap,
    );

    simulation = graphState.simulation;
    nodeElements = graphState.nodeElements;

    // use the same type signature as in donutRings.ts
    if (nodeElements) addDonutRings(nodeElements as unknown as d3.Selection<SVGElement, D3Node, SVGSVGElement, unknown>, activeCardId);

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
      }),
    );
  }

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
  :global(.node.active circle) {
    stroke: var(--color-green-400-500);
    stroke-width: 3px;
  }
</style>
