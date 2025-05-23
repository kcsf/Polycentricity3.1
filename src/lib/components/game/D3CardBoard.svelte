<script lang="ts">
  import { mount } from 'svelte';
  import * as d3 from 'd3';
  import { getIconComponent } from '$lib/utils/iconUtils';
  import { getGameContext } from '$lib/services/gameService';
  import type {
    Card,
    ActorWithCard,
    D3Node,
    D3Link,
    CardWithPosition,
    AgreementWithPosition,
    GameContext
  } from '$lib/types';
  import CardDetailsPopover from './CardDetailsPopover.svelte';
  import { initializeD3Graph, addDonutRings } from '$lib/utils/d3index';

  interface Props {
    gameId: string;
    gameContext: GameContext;
    activeActorId?: string;
  }
  // Provide Props type to $props
  const { gameId, gameContext, activeActorId = undefined } = $props();

  // UI state
  let svgElement = $state<SVGSVGElement | null>(null);
  let width = $state(800);
  let height = $state(600);
  let simulation = $state<d3.Simulation<D3Node, D3Link> | null>(null);
  let nodeElements = $state<d3.Selection<SVGGElement, D3Node, SVGGElement, unknown> | null>(null);
  let cardsWithPosition = $state<CardWithPosition[]>([]);
  let agreements = $state<AgreementWithPosition[]>([]);
  let actors = $state<ActorWithCard[]>([]);
  let actorCardMap = $state(new Map<string, string>());
  let selectedNode = $state<D3Node | null>(null);
  let activeCardId = $state<string | null>(null);

  console.log("🔍 D3CardBoard received props:", { gameId, gameContext, activeActorId });

  // Resize observer
  $effect(() => {
    if (svgElement?.parentElement) {
      const rect = svgElement.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }
  });

  // Fetch and partition game data
  async function loadGameData(): Promise<{
    cards: CardWithPosition[];
    agreements: AgreementWithPosition[];
    actors: ActorWithCard[];
  }> {
    const ctx = gameContext;
    if (!ctx) {
      console.error('[D3CardBoard] No context provided');
      return { cards: [], agreements: [], actors: [] };
    }

    const assigned = ctx.actors
      .filter((a: ActorWithCard) => !!a.card)
      .map((a: ActorWithCard) => ({
        ...a.card!,
        actor_id: a.actor_id,
        position: a.position ?? { x: Math.random() * width, y: Math.random() * height }
      }));

    const availableWithPos = (ctx.availableCards || []).map((c: CardWithPosition) => ({
      ...c,
      position: { x: Math.random() * width, y: Math.random() * height }
    }));

    return {
      cards: [
        ...assigned, 
        ...availableWithPos
      ],
      agreements: ctx.agreements || [],
      actors: ctx.actors || []
    };
  }

  // Initialize D3 graph and mount icons
  async function initializeVisualization() {
    console.log('[D3CardBoard] Initializing');
    if (!svgElement) return;

    // 1️⃣ Load data
    const { cards, agreements: loadedAgreements, actors: loadedActors } = await loadGameData();
    cardsWithPosition = cards.filter(c => c.actor_id);
    agreements = loadedAgreements;
    actors = loadedActors;

    // 2️⃣ Track active card
    if (activeActorId) {
      const actor = actors.find(a => a.actor_id === activeActorId);
      if (actor?.card) activeCardId = actor.card.card_id;
    }

    actorCardMap.clear();
    actors.forEach(a => {
      if (a.card) actorCardMap.set(a.actor_id, a.card.card_id);
    });

    if (!cardsWithPosition.length) return;

    // 3️⃣ Build graph
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

    // 4️⃣ Add donut rings
    if (nodeElements) {
      addDonutRings(
        nodeElements as unknown as d3.Selection<SVGElement, D3Node, SVGSVGElement, unknown>,
        activeCardId
      );
    }

    // 5️⃣ Mount icons inside each actor node
    if (nodeElements) {
      nodeElements.each(function (node: D3Node) {
        if (node.type !== 'actor') return;

        const centerGroup = d3
          .select(this)
          .append('g')
          .attr('class', 'center-group center-icon-container');

        const card = node.data as Card;
        if (!card) return;

        const isActive = node.id === activeCardId;
        const iconSize = isActive ? 36 : 24;

        // Create centered <foreignObject>
        const fo = centerGroup
          .append('foreignObject')
          .attr('width', iconSize)
          .attr('height', iconSize)
          .attr('x', -iconSize / 2)
          .attr('y', -iconSize / 2)
          .attr('class', 'card-icon-container')
          .style('pointer-events', 'none')
          .style('overflow', 'visible')
          .node() as SVGForeignObjectElement;

        // Mount with mount()
        const container = document.createElement('div');
        container.className = 'icon-container';
        const Icon = getIconComponent(card.icon);
        mount(Icon, { target: container, props: { size: iconSize, stroke: '#555555' } });
        fo.appendChild(container);
      });
    }

    console.log('[D3CardBoard] Render complete');
  }


  // Kick off visualization on mount AND whenever gameContext changes
  $effect(() => {
    // if for some reason the prop isn’t set yet, bail
    if (!gameContext) return;

    // stop any existing force simulation
    simulation?.stop();

    // debounce to let layout settle
    const handle = setTimeout(() => {
      initializeVisualization();
    }, 300);

    return () => {
      clearTimeout(handle);
      simulation?.stop();
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
