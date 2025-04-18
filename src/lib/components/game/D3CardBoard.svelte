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

  // Card cache to avoid redundant fetches
  const cardCache = new Map<string, Card>();
  
  async function loadCardData(deckId: string): Promise<CardWithPosition[]> {
    log(`Loading cards for deck: ${deckId}`);
    
    // First try to get cards from the gameService
    try {
      const cards = await getAvailableCardsForGame(gameId);
      log(`Loaded ${cards.length} cards from gameService`);
      
      // Cache cards for future reference
      cards.forEach(card => {
        if (card.card_id) cardCache.set(card.card_id, card);
      });
      
      // Add position data
      return cards.map(card => ({
        ...card,
        position: { x: Math.random() * width, y: Math.random() * height }
      }));
    } catch (error) {
      log(`Error loading cards from gameService: ${error}`);
      
      // Fallback to direct Gun.js loading with batching
      const gun = getGun();
      const cards: CardWithPosition[] = [];
      
      return new Promise<CardWithPosition[]>((resolve) => {
        // Use a counter to track when all data is loaded
        let pendingFetches = 0;
        let fetched = false;
        
        gun.get(deckId).get('cards').map().once((cardData: any, cardId: string) => {
          if (cardData && cardId.startsWith('cards/')) {
            const cardId = cardId.replace('cards/', '');
            
            // Check cache first
            if (cardCache.has(cardId)) {
              const cachedCard = cardCache.get(cardId);
              cards.push({
                ...cachedCard,
                position: { x: Math.random() * width, y: Math.random() * height }
              });
              return;
            }
            
            // Fetch from Gun.js
            pendingFetches++;
            const cardPath = `${nodes.cards}/${cardId}`;
            
            gun.get(cardPath).once((fullCardData: Card) => {
              pendingFetches--;
              
              if (fullCardData) {
                // Cache for future use
                if (fullCardData.card_id) {
                  cardCache.set(fullCardData.card_id, fullCardData);
                }
                
                cards.push({
                  ...fullCardData,
                  position: { x: Math.random() * width, y: Math.random() * height }
                });
              }
              
              // If all pending fetches are done, resolve
              if (pendingFetches === 0 && fetched) {
                resolve(cards);
              }
            });
          }
        }).then(() => {
          fetched = true;
          if (pendingFetches === 0) {
            resolve(cards);
          }
        });
        
        // Set a reasonable timeout to resolve anyway after 2 seconds
        setTimeout(() => {
          log(`loadCardData fallback timed out after 2 seconds, returning ${cards.length} cards`);
          resolve(cards);
        }, 2000);
      });
    }
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

  // Cache of agreement data to prevent redundant fetches
  const agreementCache = new Map<string, AgreementWithPosition | null>();
  
  async function loadGameAgreements(game: { agreement_ids?: string[] | Record<string, boolean> | Record<string, any> }): Promise<AgreementWithPosition[]> {
    if (!game || !game.agreement_ids) return [];
    
    // Handle both string[] and Record<string, boolean> formats, and Gun.js references
    const agreementIdList = Array.isArray(game.agreement_ids) 
      ? game.agreement_ids 
      : typeof game.agreement_ids === 'object' && !game.agreement_ids['#']
        ? Object.keys(game.agreement_ids)
        : [];
        
    if (agreementIdList.length === 0) return [];
    
    // Split into cached and uncached agreements
    const cachedAgreementIds = agreementIdList.filter(id => agreementCache.has(id));
    const uncachedAgreementIds = agreementIdList.filter(id => !agreementCache.has(id));
    
    // Get cached agreements
    const cachedAgreements = cachedAgreementIds
      .map(id => agreementCache.get(id))
      .filter((a): a is AgreementWithPosition => a !== null);
    
    // Limit concurrent Gun.js lookups to prevent overloading
    const maxConcurrent = 10;
    const agreements: AgreementWithPosition[] = [...cachedAgreements];
    
    // Process uncached agreements in batches
    for (let i = 0; i < uncachedAgreementIds.length; i += maxConcurrent) {
      const batch = uncachedAgreementIds.slice(i, i + maxConcurrent);
      
      const batchResults = await Promise.all(batch.map(async (agreementId) => {
        const agreement = await loadAgreementData(agreementId);
        // Cache the result (even if null)
        agreementCache.set(agreementId, agreement);
        return agreement;
      }));
      
      // Add non-null results
      agreements.push(...batchResults.filter((a): a is AgreementWithPosition => a !== null));
    }
    
    return agreements;
  }

  // Caches for values and capabilities
  const valueCache = new Map<string, string>();
  const capabilityCache = new Map<string, string>();
  
  async function enhanceCardData(cards: CardWithPosition[]): Promise<CardWithPosition[]> {
    log(`Enhancing ${cards.length} cards`);
    
    // Batch process the cards to reduce Gun.js load
    return Promise.all(
      cards.map(async (card) => {
        // Process values with caching
        const valueNames = [];
        if (card.values) {
          const valueIds = Object.keys(card.values);
          
          // Split into cached and uncached values
          const cachedValueIds = valueIds.filter(id => valueCache.has(id) || !id.startsWith('value_'));
          const uncachedValueIds = valueIds.filter(id => !valueCache.has(id) && id.startsWith('value_'));
          
          // Add cached values
          for (const valueId of cachedValueIds) {
            if (valueCache.has(valueId)) {
              valueNames.push(valueCache.get(valueId));
            } else {
              // For non-value_ IDs, just clean up the format
              const cleanName = valueId.replace(/-/g, ' ');
              valueCache.set(valueId, cleanName);
              valueNames.push(cleanName);
            }
          }
          
          // Batch request uncached values in small groups (max 5 at a time)
          const batchSize = 5;
          for (let i = 0; i < uncachedValueIds.length; i += batchSize) {
            const batch = uncachedValueIds.slice(i, i + batchSize);
            
            await Promise.all(
              batch.map(async (valueId) => {
                try {
                  const value = await getValue(valueId);
                  const name = value?.name || valueId.replace('value_', '').replace(/-/g, ' ');
                  valueCache.set(valueId, name);
                  valueNames.push(name);
                } catch (error) {
                  // Fallback to formatted value ID
                  const fallbackName = valueId.replace('value_', '').replace(/-/g, ' ');
                  valueCache.set(valueId, fallbackName);
                  valueNames.push(fallbackName);
                }
              })
            );
          }
        }
        
        // Process capabilities with caching
        const capabilityNames = [];
        if (card.capabilities) {
          const capabilityIds = Object.keys(card.capabilities);
          
          // Split into cached and uncached capabilities
          const cachedCapabilityIds = capabilityIds.filter(id => capabilityCache.has(id) || !id.startsWith('capability_'));
          const uncachedCapabilityIds = capabilityIds.filter(id => !capabilityCache.has(id) && id.startsWith('capability_'));
          
          // Add cached capabilities
          for (const capabilityId of cachedCapabilityIds) {
            if (capabilityCache.has(capabilityId)) {
              capabilityNames.push(capabilityCache.get(capabilityId));
            } else {
              // For non-capability_ IDs, just clean up the format
              const cleanName = capabilityId.replace(/-/g, ' ');
              capabilityCache.set(capabilityId, cleanName);
              capabilityNames.push(cleanName);
            }
          }
          
          // Batch request uncached capabilities in small groups (max 5 at a time)
          const batchSize = 5;
          for (let i = 0; i < uncachedCapabilityIds.length; i += batchSize) {
            const batch = uncachedCapabilityIds.slice(i, i + batchSize);
            
            await Promise.all(
              batch.map(async (capabilityId) => {
                try {
                  const capability = await getCapability(capabilityId);
                  const name = capability?.name || capabilityId.replace('capability_', '').replace(/-/g, ' ');
                  capabilityCache.set(capabilityId, name);
                  capabilityNames.push(name);
                } catch (error) {
                  // Fallback to formatted capability ID
                  const fallbackName = capabilityId.replace('capability_', '').replace(/-/g, ' ');
                  capabilityCache.set(capabilityId, fallbackName);
                  capabilityNames.push(fallbackName);
                }
              })
            );
          }
        }
        
        return { ...card, _valueNames: valueNames, _capabilityNames: capabilityNames };
      })
    );
  }

  // Track the last update time to avoid redundant operations
  let lastGameUpdateTime = 0;
  let lastAgreementUpdateTime = 0;
  let lastActorUpdateTime = 0;
  
  // Game cache for tracking changes
  const gameCache = new Map<string, any>();
  const actorCache = new Map<string, Actor>();
  
  function subscribeToGameData() {
    log(`Subscribing to game data: ${gameId}`);
    
    // Subscribe to game updates using our optimized service function
    unsubscribe.push(
      subscribeToGame(gameId, (game) => {
        if (!game) return;
        
        const currentTime = Date.now();
        
        // Check if this is a meaningful update (at least 1 second since last update)
        if (currentTime - lastGameUpdateTime < 1000) {
          log('Skipping redundant game update (too frequent)');
          return;
        }
        
        lastGameUpdateTime = currentTime;
        log(`Game subscription received update at ${new Date(currentTime).toISOString()}`);
        
        // Track if game structure changed to determine if we need a full refresh
        let needsFullRefresh = false;
        
        if (!gameCache.has(gameId)) {
          gameCache.set(gameId, game);
          needsFullRefresh = true;
        } else {
          const cachedGame = gameCache.get(gameId);
          
          // Check if critical game properties have changed
          if (
            cachedGame.deck_id !== game.deck_id || 
            cachedGame.status !== game.status
          ) {
            needsFullRefresh = true;
            gameCache.set(gameId, game);
          }
        }
        
        // Always check for agreement updates since they're lightweight
        if (game.agreement_ids && currentTime - lastAgreementUpdateTime > 2000) {
          lastAgreementUpdateTime = currentTime;
          loadGameAgreements(game).then((ags) => {
            agreements = ags;
            log(`Updated ${ags.length} agreements`);
          });
        }
        
        // Only do full refresh if needed or significant time has passed
        if (needsFullRefresh || currentTime - lastActorUpdateTime > 10000) {
          lastActorUpdateTime = currentTime;
          
          log('Performing selective game data refresh');
          
          // Get actors separately without reloading cards if possible
          getGameActors(gameId).then(loadedActors => {
            actors = loadedActors;
            log(`Updated ${loadedActors.length} actors`);
            
            // Update actor-card mappings
            actors.forEach((actor) => {
              actorCache.set(actor.actor_id, actor);
              if (actor.card_id) actorCardMap.set(actor.actor_id, actor.card_id);
            });
            
            // Only reload cards if we don't have any or deck ID changed
            if (cardsWithPosition.length === 0 || needsFullRefresh) {
              const deckId = game.deck_id;
              if (deckId) {
                loadCardData(deckId).then(cards => {
                  enhanceCardData(cards).then(enhancedCards => {
                    cardsWithPosition = enhancedCards;
                    log(`Updated ${enhancedCards.length} cards`);
                    
                    // Update card-actor mappings
                    cardsWithPosition.forEach((card) => {
                      if (card.actor_id) actorCardMap.set(card.actor_id, card.card_id);
                    });
                  });
                }).catch(error => {
                  console.error('Error refreshing card data:', error);
                });
              }
            }
          }).catch(error => {
            console.error('Error refreshing actor data:', error);
          });
        }
      })
    );
    
    // Also subscribe to actors to catch new actors joining
    unsubscribe.push(
      subscribeToGameActors(gameId, (updatedActors) => {
        if (!updatedActors || updatedActors.length === 0) return;
        
        const currentTime = Date.now();
        if (currentTime - lastActorUpdateTime < 2000) {
          log('Skipping redundant actor update (too frequent)');
          return;
        }
        
        log(`Actor subscription received update with ${updatedActors.length} actors`);
        lastActorUpdateTime = currentTime;
        
        // Update our actor list and mappings
        actors = updatedActors;
        updatedActors.forEach((actor) => {
          actorCache.set(actor.actor_id, actor);
          if (actor.card_id) actorCardMap.set(actor.actor_id, actor.card_id);
        });
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