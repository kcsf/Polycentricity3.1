<script lang="ts">
  import { onMount } from 'svelte';
  import type { SvelteComponent } from 'svelte';
  import * as d3 from 'd3';
  import { User } from '@lucide/svelte';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import { getGun, nodes } from '$lib/services/gunService';
  import { getGameActors, getUserCard, subscribeToGame } from '$lib/services/gameService';
  import { getValue } from '$lib/services/valueService';
  import { getCapability } from '$lib/services/capabilityService';
  import type { Card, Value, Capability, Actor, Agreement } from '$lib/types';
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

  const { gameId, activeActorId = undefined } = $props<{
    gameId: string;
    activeActorId?: string;
  }>();

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

  const isDev = process.env.NODE_ENV !== 'production';
  const log = (...args: any[]) => isDev && console.log('[D3CardBoard]', ...args);

  $effect(() => {
    if (svgElement && svgElement.parentElement) {
      const rect = svgElement.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }
  });

  async function loadCardData(deckId: string): Promise<CardWithPosition[]> {
    log(`Loading cards for deck: ${deckId}`);
    const gun = getGun();
    const cards: CardWithPosition[] = [];
    await new Promise<void>((resolve) => {
      gun.get(deckId).get('cards').map().once((cardData, cardId) => {
        if (cardData && cardId.startsWith('cards/')) {
          const cardPath = `${nodes.cards}/${cardId.replace('cards/', '')}`;
          gun.get(cardPath).once((fullCardData: Card) => {
            if (fullCardData) {
              cards.push({
                ...fullCardData,
                position: { x: Math.random() * width, y: Math.random() * height }
              });
            }
          });
        }
      }).then(resolve);
    });
    return cards;
  }

  async function loadAgreementData(agreementId: string): Promise<AgreementWithPosition | null> {
    log(`Loading agreement: ${agreementId}`);
    const gun = getGun();
    return new Promise((resolve) => {
      gun.get(nodes.agreements).get(agreementId).once((agreement: Agreement) => {
        if (!agreement) resolve(null);
        else resolve({ ...agreement, position: { x: Math.random() * width, y: Math.random() * height } });
      });
    });
  }

  async function loadGameData(): Promise<{
    cards: CardWithPosition[];
    agreements: AgreementWithPosition[];
    actors: Actor[];
  }> {
    log(`Loading game data for: ${gameId}`);
    const gun = getGun();
    const gamePath = `${nodes.games}/${gameId}`;

    const [deckData, agreementIds, actors] = await Promise.all([
      new Promise<any>((resolve) => gun.get(gamePath).get('deck').once(resolve)),
      new Promise<any>((resolve) => gun.get(gamePath).get('agreement_ids').once(resolve)),
      getGameActors(gameId)
    ]);

    if (!deckData) throw new Error(`No deck found for game: ${gameId}`);
    const deckId = Object.keys(deckData).find((key) => key.startsWith('decks/'));
    if (!deckId) throw new Error(`Invalid deck reference for game: ${gameId}`);

    const [cards, agreementData] = await Promise.all([
      loadCardData(deckId),
      agreementIds && Array.isArray(agreementIds)
        ? Promise.all(agreementIds.map(loadAgreementData)).then((ags) => ags.filter((a): a is AgreementWithPosition => a !== null))
        : Promise.resolve([])
    ]);

    return { cards, agreements: agreementData, actors };
  }

  async function enhanceCardData(cards: CardWithPosition[]): Promise<CardWithPosition[]> {
    log(`Enhancing ${cards.length} cards`);
    return Promise.all(
      cards.map(async (card) => {
        const valueNames = card.values
          ? await Promise.all(
              Object.keys(card.values).map(async (valueId) =>
                valueId.startsWith('value_')
                  ? (await getValue(valueId))?.name || valueId.replace('value_', '').replace(/-/g, ' ')
                  : valueId.replace(/-/g, ' ')
              )
            )
          : [];
        const capabilityNames = card.capabilities
          ? await Promise.all(
              Object.keys(card.capabilities).map(async (capabilityId) =>
                capabilityId.startsWith('capability_')
                  ? (await getCapability(capabilityId))?.name || capabilityId.replace('capability_', '').replace(/-/g, ' ')
                  : capabilityId.replace(/-/g, ' ')
              )
            )
          : [];
        return { ...card, _valueNames: valueNames, _capabilityNames: capabilityNames };
      })
    );
  }

  function subscribeToGameData() {
    log(`Subscribing to game data: ${gameId}`);
    const gun = getGun();
    if (!gun) return;

    unsubscribe.push(
      subscribeToGame(gameId, (game) => {
        loadGameAgreements(game).then((ags) => {
          agreements = ags;
        });
      })
    );

    gun.get(nodes.games).get(gameId).get('deck').once((deckData) => {
      if (!deckData) return;
      const deckId = Object.keys(deckData).find((key) => key.startsWith('decks/'));
      if (!deckId) return;

      gun.get(deckId).get('cards').map().on((cardData, cardId) => {
        if (cardData && cardId.startsWith('cards/')) {
          const cardPath = `${nodes.cards}/${cardId.replace('cards/', '')}`;
          gun.get(cardPath).on(async (fullCardData: Card) => {
            if (fullCardData) {
              const existing = cardsWithPosition.find((c) => c.card_id === fullCardData.card_id);
              const updatedCard: CardWithPosition = {
                ...fullCardData,
                position: existing?.position || { x: Math.random() * width, y: Math.random() * height },
                _valueNames: await Promise.all(
                  fullCardData.values
                    ? Object.keys(fullCardData.values).map(async (valueId) =>
                        valueId.startsWith('value_')
                          ? (await getValue(valueId))?.name || valueId.replace('value_', '').replace(/-/g, ' ')
                          : valueId.replace(/-/g, ' ')
                      )
                    : []
                ),
                _capabilityNames: await Promise.all(
                  fullCardData.capabilities
                    ? Object.keys(fullCardData.capabilities).map(async (capabilityId) =>
                        capabilityId.startsWith('capability_')
                          ? (await getCapability(capabilityId))?.name || capabilityId.replace('capability_', '').replace(/-/g, ' ')
                          : capabilityId.replace(/-/g, ' ')
                      )
                    : []
                )
              };
              cardsWithPosition = existing
                ? cardsWithPosition.map((c) => (c.card_id === fullCardData.card_id ? updatedCard : c))
                : [...cardsWithPosition, updatedCard];
            }
          });
        }
      });
    });
  }

  async function initializeVisualization() {
    log('Starting initialization');
    if (!svgElement) {
      console.error('SVG element not available');
      return;
    }

    try {
      if (activeActorId) {
        const card = await getUserCard(gameId, activeActorId);
        if (card) activeCardId = card.card_id;
      }

      const { cards, agreements: loadedAgreements, actors: loadedActors } = await loadGameData();
      cardsWithPosition = await enhanceCardData(cards);
      agreements = loadedAgreements;
      actors = loadedActors;

      cardsWithPosition.forEach((card) => {
        if (card.actor_id) actorCardMap.set(card.actor_id, card.card_id);
      });
      actors.forEach((actor) => {
        if (actor.card_id) actorCardMap.set(actor.actor_id, actor.card_id);
      });

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
      simulation = graphState.simulation;
      nodeElements = graphState.nodeElements;

      addDonutRings(nodeElements, activeCardId);

      const iconNames = cardsWithPosition
        .map((card) => card.icon || 'user')
        .filter((value, index, self) => self.indexOf(value) === index);
      await loadIcons(iconNames);

      nodeElements.each(function (node) {
        if (node.type === 'actor') {
          const centerGroup = d3.select(this).append('g').attr('class', 'center-group center-icon-container');
          const iconContainer = document.createElement('div');
          iconContainer.className = 'icon-container';
          const card = node.data as Card;
          if (!card) return;

          const iconName = card.icon || 'user';
          const isActive = node.id === activeCardId;
          const iconSize = isActive ? 36 : 24;
          const offset = isActive ? -18 : -12;

          createCardIcon(iconName, iconSize, iconContainer, card.role_title || 'Card');
          const foreignObject = centerGroup
            .append('foreignObject')
            .attr('width', iconSize)
            .attr('height', iconSize)
            .attr('x', offset)
            .attr('y', offset)
            .attr('class', 'icon-container')
            .style('pointer-events', 'none');
          foreignObject.node()?.appendChild(iconContainer);
        }
      });

      subscribeToGameData();
    } catch (error) {
      console.error('Error initializing visualization:', error);
    }
  }

  onMount(() => {
    log('Component mounted');
    initializeVisualization();
    return () => {
      if (simulation) simulation.stop();
      unsubscribe.forEach((unsub) => unsub());
    };
  });
</script>

<div class="w-full h-full relative overflow-hidden">
  <svg bind:this={svgElement} width="100%" height="100%" class="d3-graph"></svg>
  {#if selectedNode}
    <div class="absolute bottom-4 left-4 p-4 bg-surface-100 rounded-xl shadow-lg max-w-lg">
      {#if selectedNode.type === 'actor'}
        <h3 class="text-lg font-semibold mb-2">{selectedNode.name}</h3>
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          {#if selectedNode._valueNames?.length}
            <div>
              <h4 class="text-sm font-medium text-primary-700">Values</h4>
              <ul class="list-disc pl-5 text-sm">
                {#each selectedNode._valueNames as value}
                  <li>{value}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if selectedNode._capabilityNames?.length}
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
          {#if selectedNode.data?.obligations?.length}
            <div>
              <h4 class="text-sm font-medium text-indigo-700">Obligations</h4>
              <ul class="list-disc pl-5 text-sm">
                {#each selectedNode.data.obligations as obligation}
                  <li>{obligation.text}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if selectedNode.data?.benefits?.length}
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
        on:click={() => (selectedNode = null)}
      >
        Close
      </button>
    </div>
  {/if}
</div>