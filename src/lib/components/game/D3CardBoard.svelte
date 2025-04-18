<script lang="ts">
  import { onMount } from 'svelte';
  import type { SvelteComponent } from 'svelte';
  import * as d3 from 'd3';
  import { User } from 'lucide-svelte';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import { getGun, nodes } from '$lib/services/gunService';
  import { 
    getGameActors, 
    getUserCard, 
    subscribeToGame, 
    subscribeToGameActors,
    getGame, 
    getAvailableCardsForGame 
  } from '$lib/services/gameService';
  import { getValue } from '$lib/services/valueService';
  import { getCapability } from '$lib/services/capabilityService';
  import type { Card, Value, Capability, Actor, Agreement } from '$lib/types';
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
  
  // Add logging utility for debugging
  const isDev = process.env.NODE_ENV !== 'production';
  const log = (...args: any[]) => isDev && console.log('[D3CardBoard]', ...args);
  
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
    
    // Get cards using the optimized function from gameService
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
    
    // Check gameCache first for performance
    let game;
    if (gameCache.has(gameId)) {
      log('Using cached game data');
      game = gameCache.get(gameId);
    } else {
      // Load game data
      game = await getGame(gameId);
      if (game) gameCache.set(gameId, game);
    }
    
    if (!game) throw new Error(`Game not found: ${gameId}`);
    
    // Get actors using the optimized function
    const actors = await getGameActors(gameId);
    
    // Get deck ID from game
    const deckId = game.deck_id;
    if (!deckId) throw new Error(`No deck ID found for game: ${gameId}`);
    
    // Load cards
    const cards = await loadCardData(deckId);
    
    // Load agreements if any, using our optimized function with 
    // limit of 10 concurrent calls
    let agreementData: AgreementWithPosition[] = [];
    if (game.agreement_ids) {
      agreementData = await loadGameAgreements(game);
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
    
    // Get all unique values and capabilities IDs that need fetching
    const valueIdsToFetch = new Set<string>();
    const capabilityIdsToFetch = new Set<string>();
    
    // First pass - identify what needs fetching
    cards.forEach(card => {
      // Values
      if (card.values) {
        Object.keys(card.values).forEach(valueId => {
          if (!valueCache.has(valueId) && valueId.startsWith('value_')) {
            valueIdsToFetch.add(valueId);
          }
        });
      }
      
      // Capabilities
      if (card.capabilities) {
        Object.keys(card.capabilities).forEach(capabilityId => {
          if (!capabilityCache.has(capabilityId) && capabilityId.startsWith('capability_')) {
            capabilityIdsToFetch.add(capabilityId);
          }
        });
      }
    });
    
    // Fetch values in batches
    const valueIdsArray = Array.from(valueIdsToFetch);
    const batchSize = 10; // Larger batch size for better efficiency
    
    for (let i = 0; i < valueIdsArray.length; i += batchSize) {
      const batch = valueIdsArray.slice(i, i + batchSize);
      
      // Fetch batch of values
      await Promise.allSettled(
        batch.map(async (valueId) => {
          try {
            const value = await getValue(valueId);
            const name = value?.name || valueId.replace('value_', '').replace(/-/g, ' ');
            valueCache.set(valueId, name);
          } catch (error) {
            // Cache a fallback on error
            const fallbackName = valueId.replace('value_', '').replace(/-/g, ' ');
            valueCache.set(valueId, fallbackName);
          }
        })
      );
    }
    
    // Fetch capabilities in batches
    const capabilityIdsArray = Array.from(capabilityIdsToFetch);
    
    for (let i = 0; i < capabilityIdsArray.length; i += batchSize) {
      const batch = capabilityIdsArray.slice(i, i + batchSize);
      
      // Fetch batch of capabilities
      await Promise.allSettled(
        batch.map(async (capabilityId) => {
          try {
            const capability = await getCapability(capabilityId);
            const name = capability?.name || capabilityId.replace('capability_', '').replace(/-/g, ' ');
            capabilityCache.set(capabilityId, name);
          } catch (error) {
            // Cache a fallback on error
            const fallbackName = capabilityId.replace('capability_', '').replace(/-/g, ' ');
            capabilityCache.set(capabilityId, fallbackName);
          }
        })
      );
    }
    
    // Now that all values and capabilities are cached, enhance each card
    return cards.map(card => {
      // Process values
      const valueNames: string[] = [];
      if (card.values) {
        Object.keys(card.values).forEach(valueId => {
          // Either use cache or format the ID
          if (valueCache.has(valueId)) {
            valueNames.push(valueCache.get(valueId)!);
          } else {
            const cleanName = valueId.replace(/-/g, ' ');
            valueCache.set(valueId, cleanName);
            valueNames.push(cleanName);
          }
        });
      }
      
      // Process capabilities
      const capabilityNames: string[] = [];
      if (card.capabilities) {
        Object.keys(card.capabilities).forEach(capabilityId => {
          // Either use cache or format the ID
          if (capabilityCache.has(capabilityId)) {
            capabilityNames.push(capabilityCache.get(capabilityId)!);
          } else {
            const cleanName = capabilityId.replace(/-/g, ' ');
            capabilityCache.set(capabilityId, cleanName);
            capabilityNames.push(cleanName);
          }
        });
      }
      
      return { ...card, _valueNames: valueNames, _capabilityNames: capabilityNames };
    });
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
    // This uses a selective update approach to avoid redundant data fetching
    unsubscribe.push(
      subscribeToGame(gameId, (game) => {
        if (!game) return;
        
        const currentTime = Date.now();
        
        // Throttle updates (only process once per second)
        if (currentTime - lastGameUpdateTime < 1000) {
          return;
        }
        
        lastGameUpdateTime = currentTime;
        
        // Track game changes for intelligent updates
        let shouldUpdateCards = false;
        let shouldUpdateActors = false;
        let shouldUpdateAgreements = false;
        
        // Check if it's a new game or changed significantly
        if (!gameCache.has(gameId)) {
          gameCache.set(gameId, game);
          shouldUpdateCards = true;
          shouldUpdateActors = true;
          shouldUpdateAgreements = true;
        } else {
          const cachedGame = gameCache.get(gameId);
          
          // Selective updates based on what changed
          if (cachedGame.deck_id !== game.deck_id) {
            shouldUpdateCards = true;
          }
          
          if (cachedGame.status !== game.status) {
            shouldUpdateActors = true;
          }
          
          // For agreements, check if they've been added or removed
          if (game.agreement_ids) {
            const oldAgreementCount = cachedGame.agreement_ids ? 
              (Array.isArray(cachedGame.agreement_ids) ? 
                cachedGame.agreement_ids.length : 
                Object.keys(cachedGame.agreement_ids).length) : 0;
                
            const newAgreementCount = Array.isArray(game.agreement_ids) ? 
              game.agreement_ids.length : 
              Object.keys(game.agreement_ids).length;
              
            if (oldAgreementCount !== newAgreementCount) {
              shouldUpdateAgreements = true;
            }
          }
          
          // Update cache
          gameCache.set(gameId, game);
        }
        
        // Update agreements if needed
        if (shouldUpdateAgreements || currentTime - lastAgreementUpdateTime > 5000) {
          lastAgreementUpdateTime = currentTime;
          
          if (game.agreement_ids) {
            loadGameAgreements(game).then(loadedAgreements => {
              agreements = loadedAgreements;
              log(`Updated ${loadedAgreements.length} agreements`);
            }).catch(error => {
              console.error('Error updating agreements:', error);
            });
          }
        }
        
        // Update actors if needed
        if (shouldUpdateActors || currentTime - lastActorUpdateTime > 5000) {
          lastActorUpdateTime = currentTime;
          
          getGameActors(gameId).then(loadedActors => {
            actors = loadedActors;
            
            // Cache actors and update mappings
            loadedActors.forEach(actor => {
              actorCache.set(actor.actor_id, actor);
              if (actor.card_id) actorCardMap.set(actor.actor_id, actor.card_id);
            });
          }).catch(error => {
            console.error('Error updating actors:', error);
          });
        }
        
        // Update cards only if deck changed or not yet loaded
        if (shouldUpdateCards || cardsWithPosition.length === 0) {
          const deckId = game.deck_id;
          if (deckId) {
            loadCardData(deckId)
              .then(enhanceCardData)
              .then(enhancedCards => {
                cardsWithPosition = enhancedCards;
                
                // Update card-actor mappings
                enhancedCards.forEach(card => {
                  if (card.card_id && card.actor_id) {
                    actorCardMap.set(card.actor_id, card.card_id);
                  }
                });
              })
              .catch(error => {
                console.error('Error updating cards:', error);
              });
          }
        }
      })
    );
    
    // Subscribe to actor changes
    unsubscribe.push(
      subscribeToGameActors(gameId, (updatedActors) => {
        if (!updatedActors || updatedActors.length === 0) return;
        
        // Throttle updates to avoid excessive renders
        const currentTime = Date.now();
        if (currentTime - lastActorUpdateTime < 2000) return;
        
        lastActorUpdateTime = currentTime;
        
        // Update our actor list with new data
        actors = updatedActors;
        
        // Cache actors and update mappings
        updatedActors.forEach(actor => {
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

      try {
        // Initialize the D3 graph visualization
        log('Initializing D3 graph with cards:', cardsWithPosition.length);
        if (cardsWithPosition.length === 0) {
          log('Warning: No cards to render, graph may appear empty');
        }
        
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
        log('D3 graph initialized successfully');
      } catch (graphError) {
        console.error('Failed to initialize D3 graph:', graphError);
        return; // Exit to avoid further errors
      }

      // Add donut rings for values and capabilities (with null safety)
      if (nodeElements) {
        try {
          addDonutRings(nodeElements, activeCardId);
          log('Added donut rings to nodes');
        } catch (donutError) {
          console.error('Error adding donut rings:', donutError);
          // Continue anyway, donut rings are visual enhancements only
        }
      } else {
        log('No node elements available, skipping donut rings');
      }

      // Skip if no cards to render
      if (cardsWithPosition.length === 0) {
        log('No cards available to render, skipping icon loading');
        return; // Exit early to avoid errors
      }
      
      // Get unique icon names from cards
      const iconNames = cardsWithPosition
        .map((card) => card.icon || 'user')
        .filter((value, index, self) => self.indexOf(value) === index);
      
      // Preload icons
      try {
        await loadIcons(iconNames);
        log(`Successfully loaded ${iconNames.length} icons`);
      } catch (iconError) {
        log(`Error loading icons: ${iconError}`);
        // Continue anyway - our createCardIcon function has fallbacks
      }

      // Add icons to nodes (with null safety)
      if (!nodeElements) {
        log('No node elements available, skipping icon rendering');
        return;
      }
      
      try {
        nodeElements.each(function (node: D3Node) {
          if (node.type === 'actor') {
            const centerGroup = d3.select(this).append('g').attr('class', 'center-group center-icon-container');
            const iconContainer = document.createElement('div');
            iconContainer.className = 'icon-container';
            const card = node.data as Card;
            if (!card) return;

          // Simply use the icon name directly from the card data in the database
          // This is already the Lucide icon name (e.g., "sun", "link", etc.)
          const iconName = card.icon || 'user';
          
          log(`Using icon '${iconName}' for card ${card.card_id}`);
          
          const isActive = node.id === activeCardId;
          const iconSize = isActive ? 36 : 24;
          
          // Center the icon using transform instead of x/y attributes
          createCardIcon(iconName, iconSize, iconContainer, card.role_title || 'Card');
          const foreignObject = centerGroup
            .append('foreignObject')
            .attr('width', iconSize)
            .attr('height', iconSize)
            .attr('x', -iconSize/2)  // Use half iconSize to center
            .attr('y', -iconSize/2)  // Use half iconSize to center
            .attr('class', 'card-icon-container')
            .style('pointer-events', 'none')
            .style('overflow', 'visible');
          foreignObject.node()?.appendChild(iconContainer);
        }
      });
      } catch (nodeError) {
        console.error('Error rendering node icons:', nodeError);
      }

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