<script lang="ts">
  import { onMount } from 'svelte';
  import type { SvelteComponent } from 'svelte';
  import * as d3 from 'd3';
  import { User } from 'lucide-svelte';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import { getGun, nodes } from '$lib/services/gunService';
  import { getGameActors, getUserCard, subscribeToGame, getGame } from '$lib/services/gameService';
  import { getValue } from '$lib/services/valueService';
  import { getCapability } from '$lib/services/capabilityService';
  import type { Card, Value, Capability, Actor, Agreement } from '$lib/types';
  
  // Add logging utility for debugging
  const isDev = process.env.NODE_ENV !== 'production';
  const log = (...args: any[]) => isDev && console.log('[D3CardBoard]', ...args);
  import { GameStatus } from '$lib/types';
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
    
    // Create a promise that includes timeout
    const dataPromise = new Promise<CardWithPosition[]>((resolve) => {
      gun.get(deckId).get('cards').map().once((cardData: any, cardId: string) => {
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
      }).then(() => resolve(cards));
      
      // Set a timeout to resolve anyway after 3 seconds
      setTimeout(() => {
        log(`loadCardData timed out after 3 seconds, returning ${cards.length} cards`);
        resolve(cards);
      }, 3000);
    });
    
    return dataPromise;
  }

  async function loadAgreementData(agreementId: string): Promise<AgreementWithPosition | null> {
    log(`Loading agreement: ${agreementId}`);
    const gun = getGun();
    return new Promise((resolve) => {
      gun.get(nodes.agreements).get(agreementId).once((agreement: Agreement) => {
        if (!agreement) resolve(null);
        else resolve({ ...agreement, position: { x: Math.random() * width, y: Math.random() * height } });
      });
      
      // Set a timeout to resolve if Gun.js doesn't respond
      setTimeout(() => {
        log(`loadAgreementData timed out after 2 seconds for agreement: ${agreementId}`);
        resolve(null);
      }, 2000);
    });
  }

  async function loadGameData(): Promise<{
    cards: CardWithPosition[];
    agreements: AgreementWithPosition[];
    actors: Actor[];
  }> {
    log(`Loading game data for: ${gameId}`);
    
    // Use getGame with timeout protection
    const gamePromise = getGame(gameId);
    const gameTimeout = new Promise<null>((resolve) => {
      setTimeout(() => {
        log('getGame timed out after 3 seconds');
        resolve(null);
      }, 3000);
    });
    
    // Race between loading and timeout
    const game = await Promise.race([gamePromise, gameTimeout]);
    if (!game) throw new Error(`Game not found or loading timed out: ${gameId}`);
    
    // Get actors using the optimized function with timeout
    const actorsPromise = getGameActors(gameId);
    const actorsTimeout = new Promise<Actor[]>((resolve) => {
      setTimeout(() => {
        log('getGameActors timed out after 3 seconds');
        resolve([]);
      }, 3000);
    });
    
    const actors = await Promise.race([actorsPromise, actorsTimeout]);
    
    // Load cards and agreements
    let cards: Card[] = [];
    let agreementData: AgreementWithPosition[] = [];
    
    // Get deck ID from game
    const deckId = game.deck_id;
    if (!deckId) throw new Error(`No deck ID found for game: ${gameId}`);
    
    // Load cards
    try {
      cards = await loadCardData(deckId);
    } catch (error) {
      console.error('Error loading card data:', error);
      cards = [];
    }
    
    // Load agreements if any
    try {
      if (game.agreement_ids) {
        // Handle both string[] and Record<string, boolean> formats
        const agreementIdList = Array.isArray(game.agreement_ids) 
          ? game.agreement_ids 
          : typeof game.agreement_ids === 'object' && !game.agreement_ids['#']
            ? Object.keys(game.agreement_ids)
            : [];
            
        agreementData = await Promise.all(
          agreementIdList.map(loadAgreementData)
        ).then((ags) => ags.filter((a): a is AgreementWithPosition => a !== null));
      }
    } catch (error) {
      console.error('Error loading agreement data:', error);
      agreementData = [];
    }

    return { cards, agreements: agreementData, actors };
  }

  async function loadGameAgreements(game: { agreement_ids?: string[] | Record<string, boolean> | Record<string, any> }): Promise<AgreementWithPosition[]> {
    if (!game || !game.agreement_ids) return [];
    
    // Handle both string[] and Record<string, boolean> formats, and Gun.js references
    const agreementIdList = Array.isArray(game.agreement_ids) 
      ? game.agreement_ids 
      : typeof game.agreement_ids === 'object' && !game.agreement_ids['#']
        ? Object.keys(game.agreement_ids)
        : [];
        
    if (agreementIdList.length === 0) return [];
    
    const agreements = await Promise.all(agreementIdList.map(loadAgreementData));
    return agreements.filter((a): a is AgreementWithPosition => a !== null);
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
    
    // Subscribe to game updates using our optimized service function
    unsubscribe.push(
      subscribeToGame(gameId, (game) => {
        // When game data changes, update agreements
        if (game) {
          loadGameAgreements(game).then((ags) => {
            agreements = ags;
          });
          
          // If game data changes dramatically, refresh the visualization
          if (game.deck_id && game.status === GameStatus.ACTIVE) {
            // This helps ensure we have the latest data without redundant direct Gun.js calls
            loadGameData().then(({ cards, agreements: loadedAgreements, actors: loadedActors }) => {
              log(`Game subscription received update, reloading data: ${cards.length} cards, ${loadedAgreements.length} agreements`);
              
              // Update the visualization with the latest data
              enhanceCardData(cards).then(enhancedCards => {
                cardsWithPosition = enhancedCards;
                agreements = loadedAgreements;
                actors = loadedActors;
                
                // Update actor-card mappings
                cardsWithPosition.forEach((card) => {
                  if (card.actor_id) actorCardMap.set(card.actor_id, card.card_id);
                });
                actors.forEach((actor) => {
                  if (actor.card_id) actorCardMap.set(actor.actor_id, actor.card_id);
                });
              });
            }).catch(error => {
              console.error('Error refreshing game data:', error);
            });
          }
        }
      })
    );
  }

  async function initializeVisualization() {
    log('Starting initialization');
    if (!svgElement) {
      console.error('SVG element not available');
      return;
    }

    try {
      if (activeActorId) {
        // Add timeout protection for getUserCard
        const cardPromise = getUserCard(gameId, activeActorId);
        const cardTimeout = new Promise<null>((resolve) => {
          setTimeout(() => {
            log('getUserCard timed out after 3 seconds');
            resolve(null);
          }, 3000);
        });
        
        const card = await Promise.race([cardPromise, cardTimeout]);
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

      nodeElements.each(function (node: D3Node) {
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
        onclick={() => (selectedNode = null)}
      >
        Close
      </button>
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