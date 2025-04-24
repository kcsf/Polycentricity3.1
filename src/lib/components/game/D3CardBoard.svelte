<script lang="ts">
  import type { SvelteComponent } from 'svelte';
  import * as d3 from 'd3';
  import { User } from '@lucide/svelte';
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
  
  // Enhanced logging utility for debugging with proper $state handling for Svelte 5 Runes
  // Added consistent prefix for easier log filtering and improved error handling
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
    log(`[D3CardBoard] Loading cards for deck: ${deckId}`);
    
    try {
      // Get cards using the optimized function from gameService 
      // This is a big improvement over direct Gun.js access
      const cards = await getAvailableCardsForGame(gameId);
      log(`[D3CardBoard] Loaded ${cards.length} cards from gameService`);
      
      // First look for any existing cached positions to maintain continuity
      const existingPositions = new Map<string, {x: number, y: number}>();
      cardsWithPosition.forEach(card => {
        if (card.card_id && card.position) {
          existingPositions.set(card.card_id, card.position);
        }
      });
      
      // Cache cards for future reference
      cards.forEach(card => {
        if (card.card_id) cardCache.set(card.card_id, card);
      });
      
      // Add position data, preferring existing positions when available
      return cards.map(card => {
        let position;
        
        // Use existing position if we have one
        if (card.card_id && existingPositions.has(card.card_id)) {
          position = existingPositions.get(card.card_id);
        } else {
          // Or create a new random position
          position = { x: Math.random() * width, y: Math.random() * height };
        }
        
        return {
          ...card,
          position
        };
      });
    } catch (error) {
      log(`[D3CardBoard] Error loading cards for deck ${deckId}:`, error);
      // Return empty array to prevent component from breaking
      return [];
    }
  }

  // Optimized to use gameService instead of direct Gun.js access
  async function loadAgreementData(agreementId: string): Promise<AgreementWithPosition | null> {
    log(`[D3CardBoard] Loading agreement: ${agreementId}`);
    
    // Use subscribeToGameAgreements from gameService instead of direct Gun.js access
    // This improves consistency with the rest of the application
    try {
      // Check if agreement exists in cache first
      if (agreementCache.has(agreementId) && agreementCache.get(agreementId) !== null) {
        const cachedAgreement = agreementCache.get(agreementId);
        log(`[D3CardBoard] Using cached agreement: ${agreementId}`);
        return cachedAgreement as AgreementWithPosition;
      }
      
      // Fallback to direct Gun.js access for now
      // This would be replaced with a proper gameService function once implemented
      const gun = getGun();
      return new Promise((resolve) => {
        gun.get(nodes.agreements).get(agreementId).once((agreement: Agreement) => {
          if (!agreement) resolve(null);
          else {
            const agreementWithPos = { 
              ...agreement, 
              position: { 
                x: Math.random() * width, 
                y: Math.random() * height 
              } 
            };
            
            // Cache the result for future use
            agreementCache.set(agreementId, agreementWithPos);
            resolve(agreementWithPos);
          }
        });
        
        // Set a timeout to resolve if Gun.js doesn't respond
        setTimeout(() => {
          log(`[D3CardBoard] loadAgreementData timed out after 2 seconds for agreement: ${agreementId}`);
          resolve(null);
        }, 2000);
      });
    } catch (error) {
      log(`[D3CardBoard] Error loading agreement ${agreementId}:`, error);
      return null;
    }
  }

  async function loadGameData(): Promise<{
    cards: CardWithPosition[];
    agreements: AgreementWithPosition[];
    actors: Actor[];
  }> {
    log(`[D3CardBoard] Loading game data for: ${gameId}`);
    
    try {
      // Check gameCache first for performance
      let game;
      if (gameCache.has(gameId)) {
        log('[D3CardBoard] Using cached game data');
        game = gameCache.get(gameId);
      } else {
        // Load game data using optimized service function
        game = await getGame(gameId);
        if (game) gameCache.set(gameId, game);
      }
      
      if (!game) throw new Error(`Game not found: ${gameId}`);
      
      // Get actors using the optimized function rather than direct Gun.js access
      log('[D3CardBoard] Loading actors via optimized service function');
      const actors = await getGameActors(gameId);
      log(`[D3CardBoard] Loaded ${actors.length} actors`);
      
      // Cache actors for future diff checking
      actors.forEach(actor => {
        actorCache.set(actor.actor_id, actor);
      });
      
      // Get deck ID from game
      const deckId = game.deck_id;
      if (!deckId) throw new Error(`No deck ID found for game: ${gameId}`);
      
      // Load cards 
      const cards = await loadCardData(deckId);
      
      // Load agreements if any, using our optimized function with 
      // limit of 10 concurrent calls to prevent Gun.js overload
      let agreementData: AgreementWithPosition[] = [];
      if (game.agreement_ids) {
        log('[D3CardBoard] Loading agreements');
        agreementData = await loadGameAgreements(game);
        log(`[D3CardBoard] Loaded ${agreementData.length} agreements`);
      } else {
        log('[D3CardBoard] No agreements to load');
      }

      return { cards, agreements: agreementData, actors };
    } catch (error) {
      log(`[D3CardBoard] Error in loadGameData:`, error);
      // Return empty data to prevent component from breaking
      return { cards: [], agreements: [], actors: [] };
    }
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
    log(`[D3CardBoard] Enhancing ${cards.length} cards with values and capabilities`);
    
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
    log(`[D3CardBoard] Subscribing to game data: ${gameId}`);
    
    // Subscribe to game updates using our optimized service function
    // with improved throttling to reduce Gun.js over-syncing
    unsubscribe.push(
      subscribeToGame(gameId, (game) => {
        if (!game) return;
        
        const currentTime = Date.now();
        
        // Increase throttle time to 3 seconds to reduce over-syncing issues
        // This is critical to prevent excessive Gun.js data pulls (1K+ records warning)
        if (currentTime - lastGameUpdateTime < 3000) {
          return;
        }
        
        lastGameUpdateTime = currentTime;
        
        // Track game changes for intelligent updates
        let shouldUpdateCards = false;
        let shouldUpdateActors = false;
        let shouldUpdateAgreements = false;
        
        // Check if it's a new game or changed significantly
        if (!gameCache.has(gameId)) {
          log('[D3CardBoard] New game detected - full data load required');
          gameCache.set(gameId, {...game}); // Use spread to avoid reference issues
          shouldUpdateCards = true;
          shouldUpdateActors = true;
          shouldUpdateAgreements = true;
        } else {
          const cachedGame = gameCache.get(gameId);
          
          // Selective updates based on what changed - be very specific
          // to minimize unnecessary data fetching
          if (cachedGame.deck_id !== game.deck_id) {
            log('[D3CardBoard] Deck ID changed - updating cards');
            shouldUpdateCards = true;
          }
          
          // Only update actors when game status changes or player count changes
          if (cachedGame.status !== game.status) {
            log('[D3CardBoard] Game status changed - updating actors');
            shouldUpdateActors = true;
          } else if (game.players) {
            // Check if player count changed
            const oldPlayerCount = cachedGame.players ? 
              (Array.isArray(cachedGame.players) ? 
                cachedGame.players.length : 
                Object.keys(cachedGame.players).length) : 0;
                
            const newPlayerCount = Array.isArray(game.players) ? 
              game.players.length : 
              Object.keys(game.players).length;
              
            if (oldPlayerCount !== newPlayerCount) {
              log('[D3CardBoard] Player count changed - updating actors');
              shouldUpdateActors = true;
            }
          }
          
          // For agreements, only update when count changes to avoid redundant fetches
          if (game.agreement_ids) {
            const oldAgreementCount = cachedGame.agreement_ids ? 
              (Array.isArray(cachedGame.agreement_ids) ? 
                cachedGame.agreement_ids.length : 
                Object.keys(cachedGame.agreement_ids).length) : 0;
                
            const newAgreementCount = Array.isArray(game.agreement_ids) ? 
              game.agreement_ids.length : 
              Object.keys(game.agreement_ids).length;
              
            if (oldAgreementCount !== newAgreementCount) {
              log('[D3CardBoard] Agreement count changed - updating agreements');
              shouldUpdateAgreements = true;
            }
          }
          
          // Update cache with a deep copy to avoid reference issues
          gameCache.set(gameId, {...game});
        }
        
        // Update agreements if needed, but not too frequently (10 second minimum)
        if (shouldUpdateAgreements || currentTime - lastAgreementUpdateTime > 10000) {
          lastAgreementUpdateTime = currentTime;
          
          if (game.agreement_ids) {
            log('[D3CardBoard] Loading agreements');
            loadGameAgreements(game).then(loadedAgreements => {
              agreements = loadedAgreements;
              log(`[D3CardBoard] Updated ${loadedAgreements.length} agreements`);
            }).catch(error => {
              console.error('[D3CardBoard] Error updating agreements:', error);
            });
          }
        }
        
        // Update actors if needed, but not too frequently (8 second minimum)
        if (shouldUpdateActors || currentTime - lastActorUpdateTime > 8000) {
          lastActorUpdateTime = currentTime;
          
          log('[D3CardBoard] Loading actors with intelligent diff checking');
          
          getGameActors(gameId).then(loadedActors => {
            // First, check if anything actually changed compared to our cached actors
            let hasChanges = false;
            
            // Quick check - different number of actors means changes
            if (actors.length !== loadedActors.length) {
              log('[D3CardBoard] Actor count changed:', actors.length, '->', loadedActors.length);
              hasChanges = true;
            } else {
              // Check each actor for changes with enhanced attributes checking
              for (const newActor of loadedActors) {
                const existingActor = actorCache.get(newActor.actor_id);
                
                // If actor doesn't exist in cache or card_id changed, it's a change
                if (!existingActor || existingActor.card_id !== newActor.card_id) {
                  hasChanges = true;
                  log('[D3CardBoard] Actor changed:', newActor.actor_id);
                  break;
                }
              }
            }
            
            // Only update if we detected actual changes
            if (hasChanges) {
              log('[D3CardBoard] Applying actor updates');
              actors = loadedActors;
              
              // Update cache and mappings
              loadedActors.forEach(actor => {
                actorCache.set(actor.actor_id, actor);
                if (actor.card_id) actorCardMap.set(actor.actor_id, actor.card_id);
              });
            } else {
              log('[D3CardBoard] No actor changes detected - skipping update');
            }
          }).catch(error => {
            console.error('[D3CardBoard] Error updating actors:', error);
          });
        }
        
        // Update cards only if deck changed or not yet loaded (10 second minimum)
        if (shouldUpdateCards || (cardsWithPosition.length === 0 && currentTime - lastGameUpdateTime > 10000)) {
          const deckId = game.deck_id;
          if (deckId) {
            log('[D3CardBoard] Loading cards with intelligent diff checking');
            
            // Get the lastCardUpdateTime as a reference point for optimizations
            const lastCardUpdateTime = localStorage.getItem(`game_${gameId}_lastCardUpdate`) || '0';
            const lastUpdate = parseInt(lastCardUpdateTime, 10);
            const hasBeenLongTime = (currentTime - lastUpdate) > 60000; // 1 minute
            
            loadCardData(deckId)
              .then(cards => {
                // Check if we need to perform a full enhancement (expensive operation)
                // or if we can use the cards as-is
                
                // If we have no cards yet, or it's been a long time, do full enhancement
                if (cardsWithPosition.length === 0 || hasBeenLongTime) {
                  log('[D3CardBoard] Performing full card enhancement');
                  return enhanceCardData(cards);
                }
                
                // Check for any changes before doing expensive enhancement
                if (cards.length !== cardsWithPosition.length) {
                  log('[D3CardBoard] Card count changed, performing enhancement');
                  return enhanceCardData(cards);
                }
                
                // Quick diff check for changes before enhancement
                const existingCardIds = new Set(cardsWithPosition.map(c => c.card_id));
                const hasNewCards = cards.some(card => !existingCardIds.has(card.card_id));
                
                if (hasNewCards) {
                  log('[D3CardBoard] New cards detected, performing enhancement');
                  return enhanceCardData(cards); 
                }
                
                log('[D3CardBoard] No significant card changes detected, using cached data');
                return cards.map(card => {
                  // Try to find existing enhanced card
                  const existingCard = cardsWithPosition.find(c => c.card_id === card.card_id);
                  if (existingCard) {
                    // Preserve position and enhancements but update raw data
                    return {
                      ...card,
                      position: existingCard.position,
                      _valueNames: existingCard._valueNames || [],
                      _capabilityNames: existingCard._capabilityNames || []
                    };
                  }
                  // For new cards, assign random position
                  return {
                    ...card,
                    position: { x: Math.random() * width, y: Math.random() * height },
                    _valueNames: [],
                    _capabilityNames: []
                  };
                });
              })
              .then(enhancedCards => {
                // Update state with new card data
                cardsWithPosition = enhancedCards;
                
                // Update card cache and actor-card mappings
                enhancedCards.forEach(card => {
                  if (card.card_id) {
                    // Update the card cache
                    cardCache.set(card.card_id, card);
                    
                    // Update actor-card mapping if available
                    if (card.actor_id) {
                      actorCardMap.set(card.actor_id, card.card_id);
                    }
                  }
                });
                
                // Save last update time for future reference
                localStorage.setItem(`game_${gameId}_lastCardUpdate`, currentTime.toString());
                log(`[D3CardBoard] Updated ${enhancedCards.length} cards with values and capabilities`);
              })
              .catch(error => {
                console.error('[D3CardBoard] Error updating cards:', error);
              });
          }
        }
      })
    );
    
    // Subscribe to actor changes with increased throttling to reduce Gun.js load
    unsubscribe.push(
      subscribeToGameActors(gameId, (updatedActors) => {
        if (!updatedActors || updatedActors.length === 0) return;
        
        // Throttle updates more aggressively (5 seconds) to avoid excessive Gun.js
        // queries and 1K+ records warning
        const currentTime = Date.now();
        if (currentTime - lastActorUpdateTime < 5000) return;
        
        // Check if there are actually changes to the actors
        let hasChanges = false;
        
        // Only process if we have a different number of actors or new actor IDs
        if (updatedActors.length !== actors.length) {
          hasChanges = true;
          log(`[D3CardBoard] Actor count changed from ${actors.length} to ${updatedActors.length}`);
        } else {
          // If same count, check for new actor IDs
          const existingActorIds = new Set(actors.map(a => a.actor_id));
          for (const actor of updatedActors) {
            if (!existingActorIds.has(actor.actor_id)) {
              hasChanges = true;
              log(`[D3CardBoard] New actor detected: ${actor.actor_id}`);
              break;
            }
          }
        }
        
        // Only update if we detected changes or it's been a while (15 seconds)
        if (hasChanges || currentTime - lastActorUpdateTime > 15000) {
          lastActorUpdateTime = currentTime;
          log(`[D3CardBoard] Updating ${updatedActors.length} actors`);
          
          // Update our actor list with new data
          actors = updatedActors;
          
          // Cache actors and update mappings
          updatedActors.forEach(actor => {
            actorCache.set(actor.actor_id, actor);
            if (actor.card_id) actorCardMap.set(actor.actor_id, actor.card_id);
          });
        }
      })
    );
  }

  async function initializeVisualization() {
    log('[D3CardBoard] Starting initialization');
    if (!svgElement) {
      console.error('[D3CardBoard] SVG element not available');
      return;
    }

    try {
      // Fetch the game data first, which is the most critical for initialization
      log('[D3CardBoard] Loading game data for: ' + gameId);
      const gameDataPromise = loadGameData();
      
      // In parallel, if we have an active actor, start loading their card
      let cardDataPromise: Promise<Card | null> | null = null;
      
      if (activeActorId) {
        // First check localStorage for cached card ID which can be faster than fetching
        const cachedCardId = localStorage.getItem(`actor_${activeActorId}_card`);
        if (cachedCardId) {
          log(`[D3CardBoard] Found cached card ID for actor ${activeActorId}: ${cachedCardId}`);
          activeCardId = cachedCardId;
        }
        
        // Prioritize fetching from existing local cache if available
        if (cardCache.has(cachedCardId)) {
          log(`[D3CardBoard] Using cached card data for ${cachedCardId}`);
          const cachedCard = cardCache.get(cachedCardId);
          if (cachedCard) {
            activeCardId = cachedCardId;
          }
        } else {
          // Start fetching card data in parallel with game data
          log(`[D3CardBoard] Fetching card for actor ${activeActorId}`);
          cardDataPromise = getUserCard(gameId, activeActorId);
        }
      }

      // Wait for both the game data and any card data promises
      const [{ cards, agreements: loadedAgreements, actors: loadedActors }, userCard] = await Promise.all([
        gameDataPromise,
        cardDataPromise || Promise.resolve(null)
      ]);
      
      // Process any card data we received
      if (userCard) {
        log(`[D3CardBoard] Successfully loaded card ${userCard.card_id}`);
        activeCardId = userCard.card_id;
        // Cache the card ID for quicker loading next time
        if (activeActorId) {
          localStorage.setItem(`actor_${activeActorId}_card`, userCard.card_id);
        }
        // Also add to our in-memory cache
        cardCache.set(userCard.card_id, userCard);
      }
      
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
        log('[D3CardBoard] Initializing D3 graph with cards:', cardsWithPosition.length);
        if (cardsWithPosition.length === 0) {
          log('[D3CardBoard] Warning: No cards to render, graph may appear empty');
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
        log('[D3CardBoard] D3 graph initialized successfully');
      } catch (graphError) {
        console.error('[D3CardBoard] Failed to initialize D3 graph:', graphError);
        return; // Exit to avoid further errors
      }

      // Add donut rings for values and capabilities (with null safety)
      if (nodeElements) {
        try {
          addDonutRings(nodeElements, activeCardId);
          log('[D3CardBoard] Added donut rings to nodes');
        } catch (donutError) {
          console.error('[D3CardBoard] Error adding donut rings:', donutError);
          // Continue anyway, donut rings are visual enhancements only
        }
      } else {
        log('[D3CardBoard] No node elements available, skipping donut rings');
      }

      // Skip if no cards to render
      if (cardsWithPosition.length === 0) {
        log('[D3CardBoard] No cards available to render, skipping icon loading');
        return; // Exit early to avoid errors
      }
      
      // Get unique icon names from cards
      const iconNames = cardsWithPosition
        .map((card) => card.icon || 'user')
        .filter((value, index, self) => self.indexOf(value) === index);
      
      // Preload icons
      try {
        await loadIcons(iconNames);
        log(`[D3CardBoard] Successfully loaded ${iconNames.length} icons`);
      } catch (iconError) {
        log(`[D3CardBoard] Error loading icons: ${iconError}`);
        // Continue anyway - our createCardIcon function has fallbacks
      }

      // Add icons to nodes (with null safety)
      if (!nodeElements) {
        log('[D3CardBoard] No node elements available, skipping icon rendering');
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
          
          log(`[D3CardBoard] Using icon '${iconName}' for card ${card.card_id}`);
          
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
        console.error('[D3CardBoard] Error rendering node icons:', nodeError);
      }

      subscribeToGameData();
    } catch (error) {
      console.error('[D3CardBoard] Error initializing visualization:', error);
    }
  }

  // Use $effect instead of onMount for component initialization and cleanup
  $effect(() => {
    log('[D3CardBoard] Component mounted');
    initializeVisualization();
    
    // Return cleanup function to run when component is destroyed
    return () => {
      log('[D3CardBoard] Component cleanup');
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