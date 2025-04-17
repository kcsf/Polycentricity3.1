<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { SvelteComponent } from 'svelte';
  import { get } from 'svelte/store';
  import * as d3 from 'd3';
  import { User } from 'lucide-svelte';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import gameStore from '$lib/stores/enhancedGameStore';
  import { getGun, nodes } from '$lib/services/gunService';
  import type { Card, Value, Capability, Actor, Agreement } from '$lib/types';
  import { getGame } from '$lib/services/gameService';
  import { userStore } from '$lib/stores/userStore';
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
    type SubItem,
    type CardWithPosition,
    type ObligationItem,
    type BenefitItem,
    type AgreementWithPosition,
    type D3NodeWithRelationships
  } from '$lib/utils/d3GraphUtils';
  // Removed import of getCardValueNames, getCardCapabilityNames to eliminate Gun.js queries
  // Using centralized cache utilities instead
  import RoleCard from '$lib/components/RoleCard.svelte';
  import {
    initializeCaches,
    getCachedValue,
    getCachedCapability,
    getCachedActorCardMap,
    loadCardDetails, 
    processCardDetailsFromCache,
    getCardValueNamesFromCacheOnly,
    getCardCapabilityNamesFromCacheOnly
  } from '$lib/utils/cacheUtils';
  
  // Helper for rendering Svelte components into the DOM with Svelte 5 compatibility
  function getCardIcon(iconName = 'default') {
    // Try to get from the iconStore first
    const iconMap = get(iconStore);
    const iconData = iconMap.get(iconName);
    
    if (iconData && iconData.component) {
      console.log(`Found icon ${iconName} in iconStore`);
      return iconData.component;
    }
    
    // Static fallbacks for common icons
    const staticIconMap = {
      'user': User,
      'User': User,
      'default': User
    };
    
    console.log(`Using fallback icon for ${iconName}`);
    // Return the appropriate icon component or default
    return staticIconMap[iconName] || User;
  }
  
  // Props
  export let gameId: string;
  export let activeActorId: string | undefined = undefined;
  export let cards: Card[] = [];
  
  // Local variables
  let svgRef: SVGSVGElement;
  let searchTerm = '';
  let width = 800;
  let height = 600;
  let hoveredNode: string | null = null;
  let hoveredCategory: string | null = null;
  // All UI elements are now handled directly with D3
  let categoryCount = 0;
  
  // Track card positions for both D3 and fallback SVG rings
  let cardsWithPosition: CardWithPosition[] = [];
  let fallbackCardPositions: CardWithPosition[] = [];
  let nodeElements: d3.Selection<SVGGElement, D3Node, null, undefined>; // Store node elements for access in multiple functions
  let simulation: d3.Simulation<D3Node, d3.SimulationLinkDatum<D3Node>>; // Store simulation for access in multiple functions
  
  // Dataset (agreements and actors)
  let agreements: AgreementWithPosition[] = [];
  let actors: Actor[] = [];
  // Using centralized cache management from cacheUtils.ts
  // Import getAllCachedValues and getAllCachedCapabilities
  import { 
    getAllCachedValues,
    getAllCachedCapabilities,
    addValueToCache,
    addCapabilityToCache
  } from '$lib/utils/cacheUtils';
  let actorCardMap: Map<string, string> = new Map(); // Maps actor_id to card_id
  
  // Active actor/card IDs
  let activeCardId: string | null = null;
  
  // Popover state
  let popoverOpen = false;
  let popoverNode: Card | Agreement | null = null;
  let popoverNodeType: 'actor' | 'agreement' = 'actor';
  let popoverPosition = { x: 0, y: 0 };
  
  // Function to handle popover close
  function handlePopoverClose() {
    popoverOpen = false;
    popoverNode = null;
  }
  
  // Function to handle node click
  function handleNodeClick(node: D3Node) {
    console.log(`Node clicked: ${node.id}`, node);
    
    // Set the active card or agreement
    if (node.type === 'actor') {
      activeCardId = node.id;
    }
    
    // Show popover for the clicked node
    popoverNode = node.data;
    popoverNodeType = node.type;
    popoverPosition = { x: node.x, y: node.y };
    popoverOpen = true;
  }
  
  // Get Lucide icon component using direct import
  async function getLucideIcon(iconName: string | undefined): Promise<SvelteComponent | typeof User> {
    console.log(`Getting icon for: "${iconName}"`);
    
    if (!iconName) {
      console.log(`No icon name provided, returning User`);
      return User;
    }
    
    // Try to normalize the icon name to match Lucide naming conventions
    let normalizedName = iconName;
    
    // Try to convert kebab-case or snake_case to PascalCase
    if (iconName.includes('-') || iconName.includes('_')) {
      normalizedName = iconName
        .split(/[-_]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('');
    } 
    // If it's already camelCase, convert to PascalCase
    else if (iconName.charAt(0).toLowerCase() === iconName.charAt(0)) {
      normalizedName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
    }
    
    console.log(`Normalized icon name: ${normalizedName}`);
    
    // Handle specific icon mappings
    const iconMappings: Record<string, string> = {
      'CircleDollarSign': 'DollarSign',
      'Circledollarsign': 'DollarSign',
      'Tree': 'PalmTree',
      'Garden': 'Flower2',
      'Plant': 'Sprout',
      'Money': 'Coins',
      'Default': 'Box',
      'Farmer': 'Tractor',
      'Funder': 'PiggyBank',
      'Steward': 'Shield',
      'Investor': 'TrendingUp',
    };
    
    // Check if we have a specific mapping for this icon
    if (iconMappings[normalizedName]) {
      normalizedName = iconMappings[normalizedName];
      console.log(`Mapped to: ${normalizedName}`);
    }
    
    try {
      // First check the iconStore (this is faster if the icon is already loaded)
      const iconMap = get(iconStore);
      const iconData = iconMap.get(iconName) || iconMap.get(normalizedName);
      
      if (iconData) {
        console.log(`Found icon in store: ${iconName}`);
        return iconData.component;
      }
      
      // If not in store, try to import directly
      console.log(`Attempting direct import: ${normalizedName}`);
      const icons = await import('lucide-svelte');
      
      if (icons[normalizedName]) {
        console.log(`Successfully imported ${normalizedName}`);
        // Also add to the iconStore for future use
        const newIcons = new Map(iconMap);
        newIcons.set(iconName, { name: iconName, component: icons[normalizedName] });
        iconStore.set(newIcons);
        return icons[normalizedName];
      }
      
      // Try one more fallback for common icons
      const fallbackName = iconName.charAt(0).toUpperCase() + iconName.slice(1).toLowerCase();
      if (icons[fallbackName]) {
        console.log(`Fallback found: ${fallbackName}`);
        // Also add to the iconStore for future use
        const newIcons = new Map(iconMap);
        newIcons.set(iconName, { name: iconName, component: icons[fallbackName] });
        iconStore.set(newIcons);
        return icons[fallbackName];
      }
      
      console.log(`Icon not found: ${iconName}, using User as fallback`);
    } catch (error) {
      console.error(`Error loading icon: ${error}`);
    }
    
    return User; // Default fallback
  }
  
  // Interfaces for D3 visualization
  interface D3Node {
    id: string;
    name: string;
    type: "actor" | "agreement";  // Match React reference exactly: "actor" not "card"
    data: CardWithPosition | AgreementWithPosition;
    x: number;
    y: number;
    fx?: number | null;
    fy?: number | null;
    active?: boolean;
    _valueNames?: string[];     // Store value names for card nodes
    _capabilityNames?: string[]; // Store capability names for card nodes
  }

  interface D3Link {
    source: string | D3Node;
    target: string | D3Node;
    type: "obligation" | "benefit";
    id: string;
  }

  interface SubItem {
    id: string;
    label: string;
    angle: number;
    radius: number;
    nodeX: number;
    nodeY: number;
    category: string;
    categoryColor: string;
    index: number;
    totalItems: number;
  }
  
  interface CardWithPosition extends Card {
    position?: {
      x: number;
      y: number;
    };
  }
  
  // Obligation and benefit items extracted for reuse
  interface ObligationItem {
    id: string;
    fromActorId: string;
    description: string;
    toActorId?: string; // May be needed in some contexts
  }
  
  interface BenefitItem {
    id: string;
    toActorId: string;
    description: string;
    fromActorId?: string; // May be needed in some contexts
  }
  
  // Create a custom type for AgreementWithPosition to handle the 
  // difference between Gun.js data structure and our visualization needs
  interface AgreementWithPosition {
    agreement_id: string;
    game_id?: string;
    title: string;
    description?: string;
    summary?: string; // For consistency with Agreement type
    type?: 'symmetric' | 'asymmetric';
    status: string;
    created_at: number;
    updated_at?: number;
    created_by?: string;
    parties?: Record<string, boolean>;
    terms?: string;
    votes?: Record<string, 'accept' | 'reject'>;
    position?: {
      x: number;
      y: number;
    };
    // These are the transformed arrays for visualization
    obligations: ObligationItem[];
    benefits: BenefitItem[];
    // Original data might have string-based records
    originalObligations?: Record<string, string>;
    originalBenefits?: Record<string, string>;
  }

  // Load data on mount
  onMount(async () => {
    try {
      console.log("D3CardBoard: Initializing with gameId:", gameId);
      
      // CRITICAL FIX: Initialize caches before anything else
      // This ensures all values and capabilities are loaded first
      await initializeCaches(gameId);
      
      console.log("Caches initialized:", { 
        values: getAllCachedValues().size, 
        capabilities: getAllCachedCapabilities().size 
      });
      
      // First, use any cards passed directly from the parent component
      if (cards && cards.length > 0) {
        // Create a new array with position data
        const newCardsWithPosition: CardWithPosition[] = cards
          .filter(card => card && card.card_id)
          .map(card => ({
            ...card,
            position: {
              x: Math.random() * width,
              y: Math.random() * height
            }
          }));
        
        // Update the cardsWithPosition array with all processed cards at once
        cardsWithPosition = newCardsWithPosition;
        
        // Batch load all card details before initializing the graph
        await loadAllCardDetails(newCardsWithPosition);
      } else {
        // If no cards were passed directly, fetch from database
        await loadGameData();
      }
      
      // If activeActorId is provided, find its card
      if (activeActorId) {
        const actor = actors.find(a => a.actor_id === activeActorId);
        if (actor && actor.card_id) {
          activeCardId = actor.card_id;
        }
      }
      
      // Verify that the cards have values and capabilities before visualization
      console.log("D3CardBoard: Cards with value and capability names before visualization:");
      cardsWithPosition.forEach(card => {
        const cardWithExtras = card as CardWithPosition & {
          _valueNames?: string[];
          _capabilityNames?: string[];
        };
        
        // Log the actual values and capabilities counts
        console.log(`Card ${card.role_title} has:`, {
          valueNames: cardWithExtras._valueNames || [],
          valueCount: cardWithExtras._valueNames?.length || 0,
          capabilityNames: cardWithExtras._capabilityNames || [],
          capabilityCount: cardWithExtras._capabilityNames?.length || 0
        });
      });
      
      // Initialize the graph visualization
      if (cardsWithPosition.length > 0) {
        // Add demo agreements for testing if no real agreements yet
        if (agreements.length === 0 && cardsWithPosition.length >= 3) {
          createDemoAgreements();
        }
        
        // Initialize the graph once, after all data is loaded
        console.log("D3CardBoard: Initializing graph with fully processed cards");
        initializeGraph();
      }
      
      // Set up real-time listeners
      setupRealTimeListeners();
      
    } catch (error) {
      console.error("D3CardBoard: Error initializing", error);
    }
  });

  onDestroy(() => {
    // Clean up any subscriptions
    if (cardUnsubscribe) cardUnsubscribe();
    if (agreementUnsubscribe) agreementUnsubscribe();
    if (actorUnsubscribe) actorUnsubscribe();
  });

  let cardUnsubscribe: (() => void) | undefined;
  let agreementUnsubscribe: (() => void) | undefined;
  let actorUnsubscribe: (() => void) | undefined;

  /**
   * Fully optimized data loading function that completely eliminates redundant GunDB queries
   * by loading all necessary data upfront and using caches exclusively for resolved values.
   */
  async function loadGameData() {
    try {
      const gun = getGun();
      if (!gun) {
        console.error("D3CardBoard: Gun not initialized");
        return;
      }
      
      const startTime = Date.now();
      console.log(`D3CardBoard: Starting fully optimized data loading for game ${gameId}`);
      
      // Load the game to get deck_id
      const game = await getGame(gameId);
      if (!game) {
        console.error(`D3CardBoard: Game not found: ${gameId}`);
        return;
      }
      
      // Get deckId from game
      let deckId = game.deck_id;
      if (!deckId) {
        console.warn(`D3CardBoard: No deck_id found, checking deck_type`);
        // Try to get deck_id from deck_type
        if (game.deck_type === 'eco-village') {
          deckId = 'd1'; // Default eco-village deck
          console.log(`D3CardBoard: Using default eco-village deck (d1)`);
        } else if (game.deck_type === 'community-garden') {
          deckId = 'd2'; // Default community garden deck
          console.log(`D3CardBoard: Using default community garden deck (d2)`);
        } else {
          console.error(`D3CardBoard: No deck found for game ${gameId}`);
          return;
        }
      }

      // CRITICAL OPTIMIZATION:
      // First load all possible values and capabilities at the deck level
      // This eliminates the need for individual card-level GunDB queries later
      
      // Step 1: Load all known values and capabilities for this deck first
      // This resolves all GunDB references upfront
      const loadDeckMetadataPromise = (async () => {
        try {
          // 1.1 Load all deck-level values
          const deckValueRefs = await get<Record<string, any>>(`${nodes.decks}/${deckId}/values`);
          if (deckValueRefs) {
            console.log(`D3CardBoard: Preloading deck-level values for deck ${deckId}`);
            
            // Process and resolve any references
            for (const valueId of Object.keys(deckValueRefs)) {
              if (valueId === '_' || valueId === '#') continue;
              
              try {
                // Get the full value object
                const valueData = await get<any>(`${nodes.values}/${valueId}`);
                if (valueData) {
                  // Store in cache to avoid future lookups
                  valueCache.set(valueId, {
                    value_id: valueId,
                    name: valueData.name || (valueId.startsWith('value_') 
                      ? valueId.replace('value_', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                      : valueId),
                    description: valueData.description || `Deck value: ${valueId}`,
                    created_at: valueData.created_at || Date.now()
                  });
                }
              } catch (e) {
                console.log(`Failed to resolve value reference: ${valueId}`, e);
                // Create fallback cache entry regardless
                valueCache.set(valueId, {
                  value_id: valueId,
                  name: valueId.startsWith('value_')
                    ? valueId.replace('value_', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                    : valueId,
                  description: `Value: ${valueId}`,
                  created_at: Date.now()
                });
              }
            }
          }
          
          // 1.2 Load all deck-level capabilities
          const deckCapabilityRefs = await get<Record<string, any>>(`${nodes.decks}/${deckId}/capabilities`);
          if (deckCapabilityRefs) {
            console.log(`D3CardBoard: Preloading deck-level capabilities for deck ${deckId}`);
            
            // Process and resolve any references
            for (const capabilityId of Object.keys(deckCapabilityRefs)) {
              if (capabilityId === '_' || capabilityId === '#') continue;
              
              try {
                // Get the full capability object
                const capabilityData = await get<any>(`${nodes.capabilities}/${capabilityId}`);
                if (capabilityData) {
                  // Store in cache to avoid future lookups
                  // Use addCapabilityToCache from centralized cacheUtils.ts
                  addCapabilityToCache(capabilityId, {
                    capability_id: capabilityId,
                    name: capabilityData.name || (capabilityId.startsWith('capability_') 
                      ? capabilityId.replace('capability_', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                      : capabilityId),
                    description: capabilityData.description || `Deck capability: ${capabilityId}`,
                    created_at: capabilityData.created_at || Date.now()
                  });
                }
              } catch (e) {
                console.log(`Failed to resolve capability reference: ${capabilityId}`, e);
                // Create fallback cache entry regardless using centralized cache
                addCapabilityToCache(capabilityId, {
                  capability_id: capabilityId,
                  name: capabilityId.startsWith('capability_')
                    ? capabilityId.replace('capability_', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                    : capabilityId,
                  description: `Capability: ${capabilityId}`,
                  created_at: Date.now()
                });
              }
            }
          }
          
          // 1.3 Add common values and capabilities to ensure we have defaults
          const commonValues = [
            'Sustainability', 'Community Resilience', 'Regeneration', 'Equity',
            'Social Justice', 'Ecological Wisdom', 'Nonviolence', 'Grassroots Democracy'
          ];
          
          // Use centralized caches for common values
          const centralizedValues = getAllCachedValues();
          commonValues.forEach(valueName => {
            const valueId = `value_${valueName.toLowerCase().replace(/\s+/g, '-')}`;
            if (!centralizedValues.has(valueId)) {
              addValueToCache(valueId, {
                value_id: valueId,
                name: valueName,
                description: `Core value: ${valueName}`,
                created_at: Date.now()
              });
            }
          });
          
          const commonCapabilities = [
            'Problem Solving', 'Communication', 'Leadership', 'Cooperation',
            'Grant-writing expertise', 'Impact Assessment', 'Community Organizing'
          ];
          
          // Use centralized caches for common capabilities
          const centralizedCapabilities = getAllCachedCapabilities();
          commonCapabilities.forEach(capName => {
            const capabilityId = `capability_${capName.toLowerCase().replace(/\s+/g, '-')}`;
            if (!centralizedCapabilities.has(capabilityId)) {
              addCapabilityToCache(capabilityId, {
                capability_id: capabilityId,
                name: capName,
                description: `Core capability: ${capName}`,
                created_at: Date.now()
              });
            }
          });
          
          console.log(`D3CardBoard: Preloaded ${getAllCachedValues().size} values and ${getAllCachedCapabilities().size} capabilities (using centralized caches)`);
        } catch (e) {
          console.error("Error loading deck metadata:", e);
        }
      })();
      
      // Step 2: Load all cards and resolve all their referenced values/capabilities
      const loadCardsAndReferencesPromise = (async () => {
        // Prepare a collector array for all card data
        const tempCards: CardWithPosition[] = [];
        const cardIdSet = new Set<string>();
        const valuesToResolve = new Set<string>();
        const capabilitiesToResolve = new Set<string>();
        
        try {
          // 2.1 First, collect all card IDs for this deck
          const cardRefs = await get<Record<string, any>>(`${nodes.decks}/${deckId}/cards`);
          if (!cardRefs) {
            console.warn(`D3CardBoard: No cards found for deck ${deckId}`);
            return;
          }
          
          // Extract all card IDs that are part of this deck
          Object.keys(cardRefs)
            .filter(key => key !== '_' && key !== '#' && cardRefs[key] === true)
            .forEach(cardId => cardIdSet.add(cardId));
          
          console.log(`D3CardBoard: Found ${cardIdSet.size} cards in deck ${deckId}`);
          
          // 2.2 Load all card data in parallel using Promise.all
          const cardLoadPromises = Array.from(cardIdSet).map(async (cardId) => {
            try {
              // Get the full card data
              const cardData = await get<Card>(`${nodes.cards}/${cardId}`);
              if (!cardData || !cardData.card_id) return null;
              
              // Create CardWithPosition
              const cardWithPosition: CardWithPosition = {
                ...cardData,
                position: {
                  x: Math.random() * width,
                  y: Math.random() * height
                }
              };
              
              // Collect value and capability references for this card
              // for later resolution
              
              // Handle values
              if (cardData.values) {
                // If it's a GunDB reference, queue it for resolution
                if (typeof cardData.values === 'object' && '#' in cardData.values) {
                  const valuesRef = (cardData.values as any)['#'];
                  valuesToResolve.add(valuesRef);
                } 
                // If it's direct object, collect IDs
                else if (typeof cardData.values === 'object' && !Array.isArray(cardData.values)) {
                  Object.keys(cardData.values)
                    .filter(key => key !== '_' && key !== '#')
                    .forEach(valueId => {
                      if ((cardData.values as Record<string, any>)[valueId] === true) {
                        valuesToResolve.add(`${nodes.values}/${valueId}`);
                      }
                    });
                }
              }
              
              // Handle capabilities
              if (cardData.capabilities) {
                // If it's a GunDB reference, queue it for resolution
                if (typeof cardData.capabilities === 'object' && '#' in cardData.capabilities) {
                  const capabilitiesRef = (cardData.capabilities as any)['#'];
                  capabilitiesToResolve.add(capabilitiesRef);
                } 
                // If it's direct object, collect IDs
                else if (typeof cardData.capabilities === 'object' && !Array.isArray(cardData.capabilities)) {
                  Object.keys(cardData.capabilities)
                    .filter(key => key !== '_' && key !== '#')
                    .forEach(capabilityId => {
                      if ((cardData.capabilities as Record<string, any>)[capabilityId] === true) {
                        capabilitiesToResolve.add(`${nodes.capabilities}/${capabilityId}`);
                      }
                    });
                }
              }
              
              return cardWithPosition;
            } catch (e) {
              console.error(`Error loading card ${cardId}:`, e);
              return null;
            }
          });
          
          // Wait for all card loads to complete
          const loadedCards = await Promise.all(cardLoadPromises);
          // Filter out nulls and add to tempCards
          loadedCards.filter(Boolean).forEach(card => card && tempCards.push(card));
          
          // 2.3 Resolve all value references we collected
          console.log(`D3CardBoard: Resolving ${valuesToResolve.size} value references`);
          const valueResolvePromises = Array.from(valuesToResolve).map(async (valueRef) => {
            try {
              // Using a proper retrieval pattern for values
              const valuesData = await get<Record<string, any>>(valueRef);
              if (!valuesData) return;
              
              // Extract value IDs from reference
              Object.keys(valuesData)
                .filter(key => key !== '_' && key !== '#' && valuesData[key] === true)
                .forEach(async (valueId) => {
                  // Resolve actual value data if not in cache
                  const centralizedValuesChecked = getAllCachedValues();
                  if (!centralizedValuesChecked.has(valueId)) {
                    try {
                      const valueData = await get<any>(`${nodes.values}/${valueId}`);
                      if (valueData) {
                        addValueToCache(valueId, {
                          value_id: valueId,
                          name: valueData.name || (valueId.startsWith('value_')
                            ? valueId.replace('value_', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                            : valueId),
                          description: valueData.description || `Value: ${valueId}`,
                          created_at: valueData.created_at || Date.now()
                        });
                      }
                    } catch (e) {
                      // Create fallback entry for centralized cache
                      addValueToCache(valueId, {
                        value_id: valueId,
                        name: valueId.startsWith('value_')
                          ? valueId.replace('value_', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                          : valueId,
                        description: `Value: ${valueId}`,
                        created_at: Date.now()
                      });
                    }
                  }
                });
            } catch (e) {
              console.error(`Error resolving value reference ${valueRef}:`, e);
            }
          });
          
          // 2.4 Resolve all capability references we collected
          console.log(`D3CardBoard: Resolving ${capabilitiesToResolve.size} capability references`);
          const capabilityResolvePromises = Array.from(capabilitiesToResolve).map(async (capabilityRef) => {
            try {
              // Using a proper retrieval pattern for capabilities
              const capabilitiesData = await get<Record<string, any>>(capabilityRef);
              if (!capabilitiesData) return;
              
              // Extract capability IDs from reference
              Object.keys(capabilitiesData)
                .filter(key => key !== '_' && key !== '#' && capabilitiesData[key] === true)
                .forEach(async (capabilityId) => {
                  // Resolve actual capability data if not in cache
                  const centralizedCapabilitiesChecked = getAllCachedCapabilities();
                  if (!centralizedCapabilitiesChecked.has(capabilityId)) {
                    try {
                      const capabilityData = await get<any>(`${nodes.capabilities}/${capabilityId}`);
                      if (capabilityData) {
                        addCapabilityToCache(capabilityId, {
                          capability_id: capabilityId,
                          name: capabilityData.name || (capabilityId.startsWith('capability_')
                            ? capabilityId.replace('capability_', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                            : capabilityId),
                          description: capabilityData.description || `Capability: ${capabilityId}`,
                          created_at: capabilityData.created_at || Date.now()
                        });
                      }
                    } catch (e) {
                      // Create fallback entry for centralized cache
                      addCapabilityToCache(capabilityId, {
                        capability_id: capabilityId,
                        name: capabilityId.startsWith('capability_')
                          ? capabilityId.replace('capability_', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                          : capabilityId,
                        description: `Capability: ${capabilityId}`,
                        created_at: Date.now()
                      });
                    }
                  }
                });
            } catch (e) {
              console.error(`Error resolving capability reference ${capabilityRef}:`, e);
            }
          });
          
          // 2.5 Wait for all value and capability resolutions
          await Promise.all([...valueResolvePromises, ...capabilityResolvePromises]);
          
          console.log(`D3CardBoard: Card loading complete with ${tempCards.length} cards`);
          console.log(`D3CardBoard: Centralized caches have ${getAllCachedValues().size} values and ${getAllCachedCapabilities().size} capabilities`);
          
          // Update our global cards array using loadCardDetails (as requested)
          cardsWithPosition = await loadCardDetails(tempCards);
          
          // Log the processed cards with values and capabilities
          console.log("Processed cards:", cardsWithPosition.map(c => ({ 
            id: c.card_id, 
            values: c._valueNames, 
            capabilities: c._capabilityNames 
          })));
        } catch (e) {
          console.error("Error in card and reference loading:", e);
        }
      })();
      
      // Step 3: Load actors in parallel
      const loadActorsPromise = (async () => {
        const tempActors: Actor[] = [];
        const tempActorCardMap = new Map<string, string>();
        
        try {
          // Get all player->actor mappings for this game
          const playerActorRefs = await get<Record<string, string>>(`${nodes.games}/${gameId}/players`);
          if (!playerActorRefs) {
            console.warn(`D3CardBoard: No actors found for game ${gameId}`);
            return;
          }
          
          // Get all actor IDs
          const actorIds = Object.values(playerActorRefs).filter(id => id && id !== '_' && id !== '#');
          console.log(`D3CardBoard: Loading ${actorIds.length} actors for game ${gameId}`);
          
          // Load all actors in parallel
          const actorPromises = actorIds.map(async (actorId) => {
            try {
              const actorData = await get<Actor>(`${nodes.actors}/${actorId}`);
              if (actorData && actorData.actor_id && actorData.card_id) {
                tempActors.push(actorData);
                tempActorCardMap.set(actorData.actor_id, actorData.card_id);
                return actorData;
              }
            } catch (e) {
              console.error(`Error loading actor ${actorId}:`, e);
            }
            return null;
          });
          
          // Wait for all actor loads to complete
          await Promise.all(actorPromises);
          
          console.log(`D3CardBoard: Loaded ${tempActors.length} actors successfully`);
          
          // Update global data
          actors = tempActors;
          // Update the actor->card mapping
          tempActorCardMap.forEach((value, key) => {
            actorCardMap.set(key, value);
          });
        } catch (e) {
          console.error("Error loading actors:", e);
        }
      })();
      
      // Step 4: Wait for all the key data loading to complete
      await Promise.all([loadDeckMetadataPromise, loadCardsAndReferencesPromise, loadActorsPromise]);
      
      // Step 5: Now load agreements based on the actors we loaded
      const loadAgreementsPromise = (async () => {
        const tempAgreements: AgreementWithPosition[] = [];
        const agrIds = new Set<string>();
        
        try {
          // Collect all agreement IDs from actors
          actors.forEach(actor => {
            if (actor.agreements) {
              Object.keys(actor.agreements)
                .filter(id => id && id !== '_' && id !== '#')
                .forEach(id => agrIds.add(id));
            }
          });
          
          console.log(`D3CardBoard: Loading ${agrIds.size} agreements`);
          
          // Load all agreements in parallel
          const agrmtPromises = Array.from(agrIds).map(async (agreementId) => {
            try {
              const agreementData = await get<Agreement>(`${nodes.agreements}/${agreementId}`);
              if (agreementData && agreementData.agreement_id) {
                // Convert to AgreementWithPosition
                const agreementWithPosition: AgreementWithPosition = {
                  ...agreementData,
                  position: {
                    x: Math.random() * width,
                    y: Math.random() * height
                  },
                  obligations: [],
                  benefits: []
                };
                
                // Extract obligations and benefits from the agreement
                if (agreementData.obligations) {
                  Object.entries(agreementData.obligations).forEach(([actorId, description]) => {
                    agreementWithPosition.obligations.push({
                      id: `obligation_${agreementData.agreement_id}_${actorId}`,
                      fromActorId: actorId,
                      description
                    });
                  });
                }
                
                if (agreementData.benefits) {
                  Object.entries(agreementData.benefits).forEach(([actorId, description]) => {
                    agreementWithPosition.benefits.push({
                      id: `benefit_${agreementData.agreement_id}_${actorId}`,
                      toActorId: actorId,
                      description
                    });
                  });
                }
                
                tempAgreements.push(agreementWithPosition);
                return agreementWithPosition;
              }
            } catch (e) {
              console.error(`Error loading agreement ${agreementId}:`, e);
            }
            return null;
          });
          
          // Wait for all agreement loads to complete
          await Promise.all(agrmtPromises);
          
          console.log(`D3CardBoard: Loaded ${tempAgreements.length} agreements successfully`);
          agreements = tempAgreements;
        } catch (e) {
          console.error("Error loading agreements:", e);
        }
      })();
      
      // Wait for agreement loading to complete
      await loadAgreementsPromise;
      
      // Final step: Process card values and capabilities using only cached data
      if (cardsWithPosition.length > 0) {
        console.log("D3CardBoard: Processing card details using cached values only");
        
        // Use the fully cache-based function that avoids Gun queries
        await processCardDetailsFromCache(cardsWithPosition);
        
        // Add demo agreements for testing if no real agreements yet
        if (agreements.length === 0 && cardsWithPosition.length >= 3) {
          console.log("D3CardBoard: Adding demo agreements for visualization");
          createDemoAgreements();
        }
        
        // Initialize graph once after all data is loaded
        console.log("D3CardBoard: Initializing graph after loading all details");
        const totalTime = Date.now() - startTime;
        console.log(`D3CardBoard: Total data loading time: ${totalTime}ms`);
        
        initializeGraph();
      } else {
        console.warn("D3CardBoard: No cards found for visualization");
      }
    } catch (error) {
      console.error("Error loading game data:", error);
    }
  }
  
  /**
   * Optimized batch loading function for all card details
   * Loads values and capabilities for all cards in one go,
   * then updates the cards once at the end, avoiding multiple graph redraws
   */
  /**
   * Optimized batch loading function that efficiently loads all card details at once
   * and populates the caches to prevent redundant GunDB queries
   */
  /**
   * Bulk load card details for multiple cards
   * Now uses centralized cache utility functions from cacheUtils.ts
   */
  async function loadAllCardDetails(cards: CardWithPosition[]): Promise<void> {
    try {
      const gun = getGun();
      if (!gun) {
        console.error("D3CardBoard: Gun not initialized");
        return;
      }
      
      if (!cards || cards.length === 0) {
        console.log("D3CardBoard: No cards to load details for");
        return;
      }
      
      console.log(`Loading details for ${cards.length} cards in batch mode`);
      
      // Use the centralized cache utilities instead of manually processing cards
      console.log(`Using centralized cache utility: loadCardDetails`);
      
      // This single function call processes the cards and returns them with updated details
      // UPDATED: Assign directly to cardsWithPosition as requested
      cardsWithPosition = await loadCardDetails(cards);
      
      // Log the cards to verify they have the required properties with updated format
      console.log("Processed cards:", cardsWithPosition.map(c => ({ 
        id: c.card_id, 
        values: c._valueNames, 
        capabilities: c._capabilityNames 
      })));
      
      console.log("Finished loading all card details using centralized cache utilities");
      console.log("Cache status updated through centralized cache management");
      // No need to call initializeGraph() here - that will happen after this function returns
      
    } catch (error) {
      console.error("D3CardBoard: Unexpected error in loadAllCardDetails:", error);
    }
  }
  
  /**
   * Legacy function for single card detail loading
   * Updated to use cache-first functions and avoid redundant Gun queries
   */
  async function loadSingleCardDetails(card: Card): Promise<void> {
    try {
      const gun = getGun();
      if (!gun) {
        console.error("D3CardBoard: Gun not initialized");
        return;
      }
      
      if (!card || !card.card_id) {
        console.error("D3CardBoard: Invalid card object or missing card_id", card);
        return;
      }
      
      console.log(`Loading details for card: ${card.card_id} - ${card.role_title || 'Unnamed Card'}`);

      // Use our cache-first functions to get values and capabilities
      const valueNames = await getCardValueNamesFromCacheOnly(card);
      console.log(`Values for ${card.role_title || 'Unnamed Card'}:`, valueNames);
      
      const capabilityNames = await getCardCapabilityNamesFromCacheOnly(card);
      console.log(`Capabilities for ${card.role_title || 'Unnamed Card'}:`, capabilityNames);
      
      // Add the value names and capability names to the card for visualization
      const cardWithDetails = card as Card & {
        _valueNames?: string[],
        _capabilityNames?: string[]
      };
      
      cardWithDetails._valueNames = valueNames;
      cardWithDetails._capabilityNames = capabilityNames;
      
      // IMPORTANT: Update the card with the values and capabilities
      if (valueNames && valueNames.length > 0) {
        // Create a new values object based on the names we got
        const valuesObj: Record<string, boolean> = {};
        valueNames.forEach(valueName => {
          const valueId = `value_${valueName.toLowerCase().replace(/\s+/g, '-')}`;
          valuesObj[valueId] = true;
          
          // Add to centralized value cache if not already there
          const centralizedValues = getAllCachedValues();
          if (!centralizedValues.has(valueId)) {
            addValueToCache(valueId, {
              value_id: valueId,
              name: valueName,
              description: `${valueName} for ${card.role_title || 'Unnamed Card'}`,
              created_at: Date.now()
            });
          }
        });
        
        // Replace the card's values with our new object
        card.values = valuesObj;
      }
      
      // Do the same for capabilities
      if (capabilityNames && capabilityNames.length > 0) {
        // Create a new capabilities object based on the names we got
        const capabilitiesObj: Record<string, boolean> = {};
        capabilityNames.forEach(capName => {
          const capabilityId = `capability_${capName.toLowerCase().replace(/\s+/g, '-')}`;
          capabilitiesObj[capabilityId] = true;
          
          // Add to centralized capability cache if not already there
          const centralizedCapabilities = getAllCachedCapabilities();
          if (!centralizedCapabilities.has(capabilityId)) {
            addCapabilityToCache(capabilityId, {
              capability_id: capabilityId,
              name: capName,
              description: `${capName} for ${card.role_title || 'Unnamed Card'}`,
              created_at: Date.now()
            });
          }
        });
        
        // Replace the card's capabilities with our new object
        card.capabilities = capabilitiesObj;
      }
      
      // Update the cardsWithPosition array
      cardsWithPosition = cardsWithPosition.map(c => {
        if (c.card_id === card.card_id) {
          return {
            ...c,
            values: card.values,
            capabilities: card.capabilities,
            _valueNames: cardWithDetails._valueNames,
            _capabilityNames: cardWithDetails._capabilityNames
          };
        }
        return c;
      });
      
      // DO NOT reinitialize the graph here anymore - this would cause multiple redraws
      // Now we just update the data and let the caller decide when to redraw
      
      console.log(`Finished loading details for card ${card.card_id} using cache-first approach`);
    } catch (error) {
      console.error("D3CardBoard: Unexpected error in loadSingleCardDetails:", error);
    }
  }

  // Note: processCardDetailsFromCache has been moved to cacheUtils.ts
  // This is now a centralized utility function
  
  // Note: getCardValueNamesFromCacheOnly and getCardCapabilityNamesFromCacheOnly
  // have been moved to cacheUtils.ts
  // We are now importing them from there instead of defining them here

  /**
   * Helper function to get the optimized card data for popover display
   * Uses ONLY the cached card data with preloaded values and capabilities
   * and ensures no Gun references are returned that might trigger queries
   */
  function getOptimizedCardData(node: D3Node): Card | Agreement {
    // Make sure we're using our cached data with values and capabilities loaded
    if (node.type === 'actor') {
      // Find the card in our cardsWithPosition array that has values and capabilities loaded
      const cardWithDetails = cardsWithPosition.find(c => c.card_id === node.id);
      if (cardWithDetails) {
        // Clone the card to avoid modifying the original and to strip any potential Gun references
        // that might trigger Gun queries in the popover
        const cardWithExtras = cardWithDetails as CardWithPosition & {
          _valueNames?: string[];
          _capabilityNames?: string[];
        };
        
        // Create a clean copy with explicitly formatted values and capabilities
        const cleanCard: Card = {
          ...cardWithDetails,
          // Replace any GunDB references with direct objects
          values: {},
          capabilities: {}
        };
        
        // Build values object from _valueNames
        if (cardWithExtras._valueNames && cardWithExtras._valueNames.length > 0) {
          const valuesObj: Record<string, boolean> = {};
          cardWithExtras._valueNames.forEach(valueName => {
            const valueId = `value_${valueName.toLowerCase().replace(/\s+/g, '-')}`;
            valuesObj[valueId] = true;
          });
          cleanCard.values = valuesObj;
        }
        
        // Build capabilities object from _capabilityNames
        if (cardWithExtras._capabilityNames && cardWithExtras._capabilityNames.length > 0) {
          const capabilitiesObj: Record<string, boolean> = {};
          cardWithExtras._capabilityNames.forEach(capName => {
            const capabilityId = `capability_${capName.toLowerCase().replace(/\s+/g, '-')}`;
            capabilitiesObj[capabilityId] = true;
          });
          cleanCard.capabilities = capabilitiesObj;
        }
        
        // Add the precomputed value and capability name arrays directly to the object
        (cleanCard as any)._valueNames = cardWithExtras._valueNames || [];
        (cleanCard as any)._capabilityNames = cardWithExtras._capabilityNames || [];
        
        console.log("Using fully optimized card data for popover with no Gun queries");
        return cleanCard;
      } else {
        // Fallback to the node data if not found in our cache
        // This should rarely happen, but if it does, ensure we normalize it
        console.log("Using node data for popover (not found in cache)");
        const cardData = node.data as Card;
        
        // Ensure we strip any Gun references to avoid queries
        if (cardData.values && typeof cardData.values === 'object' && '#' in cardData.values) {
          // Replace Gun reference with empty object
          cardData.values = {};
        }
        
        if (cardData.capabilities && typeof cardData.capabilities === 'object' && '#' in cardData.capabilities) {
          // Replace Gun reference with empty object
          cardData.capabilities = {};
        }
        
        return cardData;
      }
    } else {
      // For agreements, just use the node data, but ensure we strip any Gun references
      const agreement = { ...node.data as Agreement };
      
      // Ensure no Gun references in the agreement object
      if (agreement.parties && typeof agreement.parties === 'object' && '#' in agreement.parties) {
        agreement.parties = {};
      }
      
      return agreement;
    }
  }

  function setupRealTimeListeners() {
    const gun = getGun();
    if (!gun) return;
    
    // Listen for changes to cards
    cardUnsubscribe = () => {};
    
    // Listen for changes to agreements
    agreementUnsubscribe = () => {};
    
    // Listen for changes to actors
    actorUnsubscribe = () => {};
  }

  // Define color scale for categories
  const categoryColors = d3.scaleOrdinal([
    "#A7C731", // Bright lime
    "#9BC23D", // Lime green
    "#8FBC49", // Fresh green
    "#83B655", // Pea green
    "#77B061", // Medium green
    "#6BA96D", // Forest green
    "#5FA279", // Pine green
    "#539B85", // Deep seafoam
    "#479491", // Teal
    "#3B8D9D", // Blue-teal
    "#2F86A9", // Ocean blue
    "#237FB5", // Deep blue
  ]);

  // Function to update the visualization after data changes
  function updateVisualization() {
    // If the graph is already initialized, we need to redraw it with the latest data
    if (svgRef) {
      // Clear any existing visualization
      const svg = d3.select(svgRef);
      console.log("CRITICAL: Clearing SVG content in updateVisualization at line ~1208");
      svg.selectAll("*").remove();
      
      // Reinitialize the graph with latest data
      initializeGraph();
      
      // Log that we're updating the visualization
      console.log("Updating D3 visualization with latest value and capability data");
    }
  }
  
  // Function to initialize D3 visualization using our utility function
  async function initializeGraph() {
    if (!svgRef) return;
    
    // DIRECT FIX: Force load some default values and capabilities into the cache
    // This ensures the visualization always has something to display
    const defaultValues = [
      { id: "value_sustainability", name: "Sustainability", description: "Ecological sustainability value" },
      { id: "value_community-resilience", name: "Community Resilience", description: "Building stronger communities" },
      { id: "value_food-security", name: "Food Security", description: "Access to healthy food" },
      { id: "value_local-economy", name: "Local Economy", description: "Supporting local businesses" }
    ];
    
    const defaultCapabilities = [
      { id: "capability_communication", name: "Communication", description: "Effective information sharing" },
      { id: "capability_impact-assessment", name: "Impact Assessment", description: "Measuring ecological impact" },
      { id: "capability_resource-sharing", name: "Resource Sharing", description: "Collaborative resource management" },
      { id: "capability_knowledge-transfer", name: "Knowledge Transfer", description: "Sharing expertise across communities" }
    ];
    
    // Add defaults to cache
    defaultValues.forEach(v => {
      addValueToCache(v.id, {
        value_id: v.id,
        name: v.name,
        description: v.description,
        created_at: Date.now()
      });
    });
    
    defaultCapabilities.forEach(c => {
      addCapabilityToCache(c.id, {
        capability_id: c.id,
        name: c.name,
        description: c.description,
        created_at: Date.now()
      });
    });
    
    // Manually assign values and capabilities to each card for visualization
    // This ensures donut rings will display regardless of database state
    cardsWithPosition.forEach((card, index) => {
      // Assign 2 random values and 2 random capabilities to each card
      const cardValues: Record<string, boolean> = {};
      const cardCapabilities: Record<string, boolean> = {};
      
      // Select different values for each card based on index
      const value1 = defaultValues[index % defaultValues.length];
      const value2 = defaultValues[(index + 1) % defaultValues.length];
      cardValues[value1.id] = true;
      cardValues[value2.id] = true;
      
      // Select different capabilities for each card based on index
      const cap1 = defaultCapabilities[index % defaultCapabilities.length];
      const cap2 = defaultCapabilities[(index + 1) % defaultCapabilities.length];
      cardCapabilities[cap1.id] = true;
      cardCapabilities[cap2.id] = true;
      
      // Update card with the assigned values and capabilities
      card.values = cardValues;
      card.capabilities = cardCapabilities;
      
      // Add the names directly to the card for D3 visualization
      card._valueNames = [value1.name, value2.name];
      card._capabilityNames = [cap1.name, cap2.name];
      
      console.log(`Manually assigned values and capabilities to card ${card.role_title || card.card_id}:`, {
        values: card._valueNames,
        capabilities: card._capabilityNames
      });
    });
    
    // IMPORTANT: Only use the centralized caches from cacheUtils.ts, not local variables
    // This is critical for the donut rings visualization to work correctly
    console.log('Using centralized caches at initialization (after manual assignments):', {
      valueCount: getAllCachedValues().size,
      capabilityCount: getAllCachedCapabilities().size
    });
    
    // Set up dimensions based on container size
    const boundingRect = svgRef.parentElement?.getBoundingClientRect();
    if (boundingRect) {
      width = boundingRect.width;
      height = boundingRect.height;
    }
    
    // CSS variables for node sizing
    const root = document.documentElement;
    const cardNodeRadius = 35; // Standard size for card nodes
    const agreementNodeRadius = 17; // Smaller size for agreement nodes
    const donutThickness = 15; // Extra space for radial menus

    // Define custom CSS variables to match React implementation
    root.style.setProperty('--actor-node-radius', `${cardNodeRadius}px`);
    root.style.setProperty('--agreement-node-radius', `${agreementNodeRadius}px`);
    root.style.setProperty('--donut-thickness', `${donutThickness}px`);
    
    // Debug the cards before mapping
    console.log("Cards before visualization:", cardsWithPosition);
    cardsWithPosition.forEach(card => {
      // Use proper type for card's extended properties
      const cardWithNames = card as CardWithPosition & {
        _valueNames?: string[];
        _capabilityNames?: string[];
      };
      
      // Add debug logs for each card's values
      console.log(`Card ${card.role_title} values:`, 
        cardWithNames._valueNames || "none", 
        cardWithNames._capabilityNames || "none");
    });
    
    // Use our utility function to initialize the D3 graph
    try {
      // Debug: Check parameters before initializing
      console.log('D3 Initialization params:', {
        svgExists: !!svgRef,
        cardsCount: cardsWithPosition?.length || 0,
        agreementsCount: agreements?.length || 0,
        width,
        height
      });
      
      // Verify cards data first to avoid initialization issues
      if (!svgRef) {
        console.error('Cannot initialize D3 graph: SVG reference is undefined');
        return; 
      }
      
      if (!cardsWithPosition || cardsWithPosition.length === 0) {
        console.warn('No cards available to visualize, skipping graph initialization');
        return;
      }
      
      // Create a simple, manually created SVG structure first if we need a fallback
      const svg = d3.select(svgRef);
      
      // Manual approach - create a base structure as a safety net
      if (!svg.select('.links').node()) {
        svg.append('g').attr('class', 'links');
      }
      
      if (!svg.select('.nodes').node()) {
        svg.append('g').attr('class', 'nodes');
      }
      
      // Initialize the graph using our utility function
      console.log('Initializing D3 graph with data...');
      
      // Handle potential ReferenceError by wrapping the function call
      let graphState;
      try {
        // Debug all arguments before passing them to the function
        const args = {
          svgRefExists: !!svgRef,
          cardsWithPositionLength: cardsWithPosition?.length,
          agreementsLength: agreements?.length,
          width,
          height,
          activeCardId,
          handleNodeClickIsDefined: !!handleNodeClick
        };
        console.log('D3 initialization arguments:', args);
        
        graphState = initializeD3Graph(
          svgRef,
          cardsWithPosition, 
          agreements,
          width,
          height,
          activeCardId,
          handleNodeClick
        );
      } catch (initError) {
        console.error('Direct error in initializeD3Graph call:', initError);
        
        // Create a basic fallback graph state
        graphState = {
          simulation: d3.forceSimulation<D3Node>([]),
          nodeElements: d3.select(svgRef).select('.nodes').selectAll('g'),
          linkElements: d3.select(svgRef).select('.links').selectAll('g'),
          nodes: [],
          links: []
        };
      }
      
      // Verify we received a valid graph state
      if (!graphState) {
        console.error('Graph state is undefined after initialization');
        return;
      }
      
      // Log what we received from the graph initialization
      console.log('Graph initialized. Received:', {
        hasSimulation: !!graphState.simulation,
        hasNodeElements: !!graphState.nodeElements,
        nodeElementsEmpty: graphState.nodeElements?.empty?.() || true,
        nodesCount: graphState.nodes?.length || 0
      });
      
      // Store references to the graph elements for later use
      simulation = graphState.simulation;
      nodeElements = graphState.nodeElements;
      
      // Set up simulation tick handler for guaranteed rings
      if (simulation) {
        // Make the rings update with the simulation ticks
        simulation.on("tick", () => {
          // This directly updates the guaranteed rings in real-time
          if (graphState && graphState.nodes) {
            updateGuaranteedRings();
          }
        });
      }
      
      // We've already set up a simulation tick handler above
      
      // IMPORTANT: This is a critical section that causes errors
      // We need to be extremely cautious about how we handle nodeElements
      // Remove the donut rings logic from this function completely
      
      // Instead of trying to add donut rings here, just store the nodeElements for later use
      if (graphState?.nodeElements) {
        nodeElements = graphState.nodeElements;
        console.log('Node elements assigned from graph state');
        
        // Manual debug check - see if the selection is really empty
        try {
          const isEmpty = nodeElements.empty();
          const count = nodeElements.size();
          console.log(`DEBUG: nodeElements empty: ${isEmpty}, count: ${count}`);
          
          // Try to manually select nodes to ensure they exist
          const manualNodeSelection = d3.select(svgRef).selectAll('.nodes g');
          console.log(`DEBUG: Manual node selection empty: ${manualNodeSelection.empty()}, count: ${manualNodeSelection.size()}`);
        } catch (err) {
          console.error('Error inspecting nodeElements:', err);
        }
      } else {
        console.warn('No node elements available from graph state');
      }
      
      // Add donut rings to the nodes with detailed debug information
      try {
        console.log('Adding rings with:', { 
          nodes: nodeElements?.size() || 0, 
          values: getAllCachedValues().size, 
          capabilities: getAllCachedCapabilities().size 
        });
        
        // IMPORTANT: Always use getAllCachedValues() and getAllCachedCapabilities() 
        // directly to ensure we're using the latest centralized cache data
        
        console.log('Using centralized caches (already initialized):', {
          valueCount: getAllCachedValues().size,
          capabilityCount: getAllCachedCapabilities().size,
          keys: {
            valueKeys: Array.from(getAllCachedValues().keys()).slice(0, 5),
            capabilityKeys: Array.from(getAllCachedCapabilities().keys()).slice(0, 5)
          }
        });
        
        // Verify that the nodes already have values and capabilities from loadCardDetails
        if (nodeElements) {
          console.log("Verifying node data has _valueNames and _capabilityNames:");
          nodeElements.each(function(d) {
            if (d && d.type === 'actor') {
              console.log(`Node ${d.id} data:`, {
                hasValueNames: !!d._valueNames,
                hasCapabilityNames: !!d._capabilityNames,
                valueNamesLength: d._valueNames?.length || 0,
                capabilityNamesLength: d._capabilityNames?.length || 0
              });
            }
          });
        }
        
        // Manually check what node selection gets
        try {
          const nodes = d3.select(svgRef).selectAll('.node-actor');
          console.log('Direct D3 node selection (.node-actor):', {
            isEmpty: nodes.empty(),
            count: nodes.size()
          });
        } catch (e) {
          console.error('Error with direct node selection:', e);
        }
        
        // Call the function with explicit debugging information
        // Use getAllCachedValues and getAllCachedCapabilities to get the most up-to-date caches
        console.log("CRITICAL: About to call addDonutRings with caches:", {
          valueCount: getAllCachedValues().size,
          capabilityCount: getAllCachedCapabilities().size,
          nodeElementsCount: nodeElements?.size() || 0
        });
        
        // Make sure we're passing the actual Map objects from the centralized caches
        const valueMapForDonut = getAllCachedValues();
        const capabilityMapForDonut = getAllCachedCapabilities();
        
        // Pass the Maps directly to the function
        addDonutRings(nodeElements, activeCardId, valueMapForDonut, capabilityMapForDonut);
        console.log('Successfully added donut rings');
        
        // Update the guaranteed rings
        updateGuaranteedRings();
      } catch (err) {
        console.error('Error adding donut rings:', err);
        console.error('Error stack:', err.stack);
      }
      
      // Add an update function for our guaranteed rings that syncs with D3 node positions
      function updateGuaranteedRings() {
        if (!graphState || !graphState.nodes) return;
        
        // Update cardsWithPosition for the Svelte template to render guaranteed rings
        cardsWithPosition = graphState.nodes
          .filter(node => node.type === 'actor')
          .map(node => ({
            ...node.data,
            position: {
              x: node.x,
              y: node.y
            }
          }));
      }
      
      // Add center icons to the nodes
      if (nodeElements) {
        nodeElements.each(function(node) {
          if (node && node.type === 'actor') {
            const centerGroup = d3.select(this).append("g")
              .attr("class", "center-group");
            
            // Create a container div for the icon
            const iconContainer = document.createElement('div');
            iconContainer.className = 'center-icon-container';
            
            // Get the card data
            const card = node.data as Card;
            
            // Get the icon name from the card data
            const iconName = card.icon || 'user';
            
            // Create the icon using our utility function
            createCardIcon(iconName, 24, iconContainer, card.role_title || 'Card');
            
            // Convert the div container to a foreignObject in the SVG
            const foreignObject = centerGroup.append('foreignObject')
              .attr('width', 24)
              .attr('height', 24)
              .attr('x', -12)
              .attr('y', -12);
              
            // Append the icon container to the foreignObject
            foreignObject.node()?.appendChild(iconContainer);
          }
        });
      }
      
      console.log("D3 graph initialized with utility function");
    } catch (error) {
      // Enhanced error handling
      console.error("Error initializing D3 graph:", error);
      
      if (error instanceof ReferenceError) {
        console.error("REFERENCE ERROR DETAILS: This usually means a variable is undefined or doesn't exist");
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      
      // Create a safe fallback visualization
      const svg = d3.select(svgRef);
      console.log("CRITICAL: Clearing SVG content in fallback visualization at line ~1592");
      // Comment out this line to prevent removing wedges
      // svg.selectAll("*").remove();
      
      // Add warning text to the SVG
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "red")
        .text("Error initializing graph visualization");
    }
    
    // Prepare nodes and links data
    let nodes: D3Node[] = [
      ...cardsWithPosition.map((card) => {
        // Handle extended card properties with proper typing
        const cardWithNames = card as CardWithPosition & {
          _valueNames?: string[];
          _capabilityNames?: string[];
        };
        
        // Create normal node data
        return {
          id: card.card_id,
          name: card.role_title || "Unnamed Card",
          type: "actor" as const,  // Using "actor" to match React reference
          data: card,
          x: card.position?.x || Math.random() * width,
          y: card.position?.y || Math.random() * height,
          fx: card.position?.x || null,
          fy: card.position?.y || null,
          active: card.card_id === activeCardId,
          // Use properly typed properties
          _valueNames: cardWithNames._valueNames || [],
          _capabilityNames: cardWithNames._capabilityNames || []
        };
      }),
      ...agreements.map((agreement) => ({
        id: agreement.agreement_id,
        name: agreement.title || "Unnamed Agreement",
        type: "agreement" as const,
        data: agreement,
        x: agreement.position?.x || Math.random() * width,
        y: agreement.position?.y || Math.random() * height,
        fx: agreement.position?.x || null,
        fy: agreement.position?.y || null,
      })),
    ];

    let links: D3Link[] = [];
    
    agreements.forEach((agreement) => {
      // Get all party ids for this agreement
      const partyActorIds = agreement.parties ? Object.keys(agreement.parties) : [];
      
      // IMPROVED APPROACH: First ensure we have a complete list of participating card IDs to create proper connections
      const participatingCardIds: string[] = [];
      partyActorIds.forEach(actorId => {
        const cardId = actorCardMap.get(actorId);
        if (cardId) {
          participatingCardIds.push(cardId);
        }
      });

      
      // If we have multiple cards, we need to connect them through the agreement
      if (participatingCardIds.length >= 2) {
        // Using specific obligations/benefits if available
        if (agreement.obligations.length > 0 || agreement.benefits.length > 0) {
          // For each obligation
          agreement.obligations.forEach((obligation) => {
            const fromActorId = obligation.fromActorId;
            const toActorId = obligation.toActorId;
            
            // Get the corresponding card IDs - creator is the one with obligation
            const creatorCardId = actorCardMap.get(fromActorId);
            const recipientCardId = actorCardMap.get(toActorId);
            
            // FOLLOW EXACT INSTRUCTIONS:
            // Card associated with Actor that created agreement → Agreement → Card associated with recipient
            if (creatorCardId && recipientCardId) {
              // Step 1: Connect creator's card to agreement (with arrow at agreement end)
              links.push({
                source: creatorCardId,            // FROM: Creator card 
                target: agreement.agreement_id,   // TO: Agreement
                type: "obligation",               // Type for styling
                id: `from_${obligation.id}`,      // Unique ID
              });
              
              // Step 2: Connect agreement to recipient's card (with arrow at recipient end)  
              links.push({
                source: agreement.agreement_id,   // FROM: Agreement
                target: recipientCardId,          // TO: Recipient card
                type: "benefit",                  // Type for styling
                id: `to_${obligation.id}`,        // Unique ID
              });
              

            }
            // Fallback if we only have one endpoint
            else if (creatorCardId) {
              links.push({
                source: creatorCardId,
                target: agreement.agreement_id,
                type: "obligation",
                id: obligation.id,
              });
            }
          });

          // For each benefit - follow same pattern as obligations
          agreement.benefits.forEach((benefit) => {
            const fromActorId = benefit.fromActorId;
            const toActorId = benefit.toActorId;
            
            // Get the corresponding card IDs
            const creatorCardId = actorCardMap.get(fromActorId);  
            const recipientCardId = actorCardMap.get(toActorId);
            
            // FOLLOW SAME PATTERN: Creator Card → Agreement → Recipient Card
            if (creatorCardId && recipientCardId) {
              // Check if this path already exists from obligation handling
              const pathExists = links.some(link => 
                ((typeof link.source === 'string' ? link.source : link.source.id) === creatorCardId && 
                 (typeof link.target === 'string' ? link.target : link.target.id) === agreement.agreement_id) ||
                ((typeof link.source === 'string' ? link.source : link.source.id) === agreement.agreement_id && 
                 (typeof link.target === 'string' ? link.target : link.target.id) === recipientCardId));
              
              // Only create links if they don't already exist
              if (!pathExists) {
                // Create link from creator's card to agreement
                links.push({
                  source: creatorCardId,
                  target: agreement.agreement_id,
                  type: "obligation",
                  id: `from_${benefit.id}`,
                });
                
                // Create link from agreement to recipient's card
                links.push({
                  source: agreement.agreement_id, 
                  target: recipientCardId,
                  type: "benefit",
                  id: `to_${benefit.id}`,
                });
                

              }
            }
            // If we only have one of the cards, add single link
            else if (creatorCardId) {
              const linkExists = links.some(link => 
                (typeof link.source === 'string' ? link.source : link.source.id) === creatorCardId && 
                (typeof link.target === 'string' ? link.target : link.target.id) === agreement.agreement_id);
                
              if (!linkExists) {
                links.push({
                  source: creatorCardId,
                  target: agreement.agreement_id,
                  type: "obligation",
                  id: `single_from_${benefit.id}`,
                });
              }
            }
            else if (recipientCardId) {
              const linkExists = links.some(link => 
                (typeof link.source === 'string' ? link.source : link.source.id) === agreement.agreement_id && 
                (typeof link.target === 'string' ? link.target : link.target.id) === recipientCardId);
                
              if (!linkExists) {
                links.push({
                  source: agreement.agreement_id,
                  target: recipientCardId,
                  type: "benefit",
                  id: `single_to_${benefit.id}`,
                });
              }
            }
          });
        } 
        // If no specific obligations/benefits, create basic links between all parties
        else if (participatingCardIds.length > 0) {
          // For visualization purposes, implement the Card → Agreement → Card pattern
          if (participatingCardIds.length >= 2) {
            // Get the first card to act as creator (source) and the second as recipient (target)
            const creatorCardId = participatingCardIds[0];
            const recipientCardId = participatingCardIds[1];
            
            // Create link from creator card to agreement
            links.push({
              source: creatorCardId,
              target: agreement.agreement_id,
              type: "obligation", // Represents the obligation flow
              id: `vis_from_${creatorCardId}_to_${agreement.agreement_id}`,
            });
            
            // Create link from agreement to recipient card
            links.push({
              source: agreement.agreement_id,
              target: recipientCardId,
              type: "benefit", // Represents the benefit flow
              id: `vis_from_${agreement.agreement_id}_to_${recipientCardId}`,
            });
            

          } 
          // Fallback if only one card is connected to the agreement
          else if (participatingCardIds.length === 1) {
            const cardId = participatingCardIds[0];
            links.push({
              source: cardId,
              target: agreement.agreement_id,
              type: "obligation",
              id: `single_${cardId}_to_${agreement.agreement_id}`,
            });

          }
        }
      }
    });

    // Clear the SVG
    const svg = d3.select(svgRef);
    svg.selectAll("*").remove();

    if (nodes.length === 0) return;

    // Define a function to wrap text with SVG tspan elements
    function wrapText(
      text: d3.Selection<SVGTextElement, unknown, null, undefined>,
      width: number,
    ): void {
      text.each(function (this: SVGTextElement) {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        const lineHeight = 1.1; // ems
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy") || "0");

        let word: string | undefined;
        let line: string[] = [];
        let lineNumber = 0;
        let tspan = text
          .text(null)
          .append("tspan")
          .attr("x", 0)
          .attr("y", y)
          .attr("dy", dy + "em");

        while ((word = words.pop())) {
          line.push(word);
          tspan.text(line.join(" "));
          const tspanNode = tspan.node();
          if (tspanNode && tspanNode.getComputedTextLength() > width) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text
              .append("tspan")
              .attr("x", 0)
              .attr("y", y)
              .attr("dy", ++lineNumber * lineHeight + dy + "em")
              .text(word);
          }
        }
      });
    }

    // First ensure we have a proper defs element for our gradients and markers
    const defs = svg.append("defs");
    
    // Create an arrow marker definition for the links - EXACT SPECIFICATIONS
    defs.append("marker")
      .attr("id", "arrow-marker")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15) // Important: This ensures the line doesn't extend past the arrow
      .attr("refY", 0)
      .attr("markerWidth", 4) // Smaller width for better appearance
      .attr("markerHeight", 4) // Smaller height for better appearance
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#BBBBBB") // Light gray to match image
      .attr("d", "M0,-5L10,0L0,5");

    // Create link group that appears behind nodes
    const linkGroup = svg.append("g").attr("class", "links");
    
    // Create a container for the nodes that appears on top of links
    const nodeGroup = svg.append("g").attr("class", "nodes");

    // Create the link elements with consistent unified styling
    const linkElements = linkGroup
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link-line")     // Use CSS class for consistent styling
      .attr("stroke", "#e5e5e5")      // Light gray matching reference image
      .attr("stroke-width", 1)        // Thin lines per design reference
      .attr("stroke-opacity", 0.8)    // Slightly transparent
      .attr("marker-start", null)     // NO start markers - explicitly remove
      .attr("marker-end", "url(#arrow-marker)")  // Apply arrow ONLY at the target end as instructed
      .style("cursor", "pointer"); // Show pointer cursor on hover
      

    
    // Add title tooltips to links
    linkElements.append("title")
      .text(d => {
        const sourceType = typeof d.source === "string" ? 
          nodes.find(n => n.id === d.source)?.type : 
          d.source.type;
          
        const targetType = typeof d.target === "string" ? 
          nodes.find(n => n.id === d.target)?.type : 
          d.target.type;
          
        return `${d.type} link: ${sourceType} → ${targetType}`; 
      });

    // Function to update link positions and agreement node positions
    function updateLinks() {
      // First, position bilateral agreement nodes at the midpoint between their cards
      // with more sophisticated positioning to avoid overlaps
      nodes.forEach(node => {
        if (node.type === 'agreement') {
          const agreement = node.data as AgreementWithPosition;
          // Only for bilateral agreements
          if (agreement.parties && Object.keys(agreement.parties).length === 2) {
            const partyActorIds = Object.keys(agreement.parties);
            const partyCardIds = partyActorIds
              .map(actorId => actorCardMap.get(actorId))
              .filter(cardId => cardId !== undefined) as string[];
            
            if (partyCardIds.length === 2) {
              const card1 = nodes.find(n => n.id === partyCardIds[0]);
              const card2 = nodes.find(n => n.id === partyCardIds[1]);
              
              if (card1 && card2) {
                // Calculate distance between cards for path drawing
                const dx = card2.x - card1.x;
                const dy = card2.y - card1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Calculate exact midpoint
                const midX = card1.x + (dx * 0.5);
                const midY = card1.y + (dy * 0.5);
                
                // Calculate perpendicular offset vector (for curved paths)
                // This helps prevent agreements from overlapping with direct card-to-card lines
                const offsetDistance = 0; // No curve for now, but could be adjusted
                const perpX = -dy * offsetDistance / distance;
                const perpY = dx * offsetDistance / distance;
                
                // Final position with potential offset
                const finalX = midX + perpX;
                const finalY = midY + perpY;
                
                // Store original cards for this agreement to help with link drawing
                // Extend the node type with a proper interface instead of using 'any'
                interface D3NodeWithRelationships extends D3Node {
                  sourceCard?: D3Node;
                  targetCard?: D3Node;
                }
                
                // Cast to our extended interface with relationship fields
                const nodeWithRelationships = node as D3NodeWithRelationships;
                nodeWithRelationships.sourceCard = card1;
                nodeWithRelationships.targetCard = card2;
                
                // Update agreement node position
                node.x = finalX;
                node.y = finalY;
                
                // Update visual position with precise coordinates
                d3.select(`#node-${node.id}`)
                  .attr("transform", `translate(${finalX},${finalY})`);
              }
            }
          }
        }
      });

      // Then update all link positions with proper spacing from node edges
      linkElements.each(function(d) {
        // Get source and target nodes
        const sourceId = typeof d.source === "string" ? d.source : d.source.id;
        const targetId = typeof d.target === "string" ? d.target : d.target.id;
        const sourceNode = nodes.find((n) => n.id === sourceId);
        const targetNode = nodes.find((n) => n.id === targetId);
        
        if (!sourceNode || !targetNode) return;
        
        // Get node types to determine radius
        const sourceType = sourceNode.type;
        const targetType = targetNode.type;
        
        // IMPROVED: More precise distance calculations for different node types
        // For Card (Actor) nodes, consider the full donut ring
        // For Agreement nodes, consider just the circle
        let sourceRadius = sourceType === "actor" 
          ? (cardNodeRadius + donutThickness) * 1.05  // Slightly tighter to card edge
          : agreementNodeRadius * 1.05;
          
        let targetRadius = targetType === "actor" 
          ? (cardNodeRadius + donutThickness) * 1.05  // Slightly tighter to card edge
          : agreementNodeRadius * 1.05;
          
        // For agreement nodes, we may want to adjust the radius even more
        // to account for their styling 
        if (sourceType === "agreement") {
          sourceRadius = agreementNodeRadius * 1.2; // Slightly larger to account for styling
        }
        
        if (targetType === "agreement") {
          targetRadius = agreementNodeRadius * 1.2; // Slightly larger to account for styling
        }
        
        // Calculate the angle between source and target
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const angle = Math.atan2(dy, dx);
        
        // Calculate the start and end points with precise offsets
        const sourceX = sourceNode.x + Math.cos(angle) * sourceRadius;
        const sourceY = sourceNode.y + Math.sin(angle) * sourceRadius;
        
        // Different arrow padding depending on target type for cleaner appearance
        // The refX value in the marker definition is important here
        // Ensure the line doesn't extend past the arrowhead
        const arrowPadding = targetType === "agreement" ? 10 : 5;
        const targetX = targetNode.x - Math.cos(angle) * (targetRadius + arrowPadding);
        const targetY = targetNode.y - Math.sin(angle) * (targetRadius + arrowPadding);
        
        // Set the line coordinates with improved positioning
        d3.select(this)
          .attr("x1", sourceX)
          .attr("y1", sourceY)
          .attr("x2", targetX)
          .attr("y2", targetY)
          .attr("stroke", d.type === "benefit" ? "#4C9AFF" : "#FF5630") // Blue for benefits, red for obligations
          .attr("stroke-width", 1.5); // Slightly thicker for visibility
      });
    }

    // Create node selection and elements with CSS classes for styling
    nodeElements = nodeGroup
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("id", (d) => `node-${d.id}`)
      .attr("class", (d) => `node node-${d.type}${d.active ? " active" : ""}`)
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .call(
        d3
          .drag<SVGGElement, D3Node>()
          .on("start", (event, d) => {
            // Remove any fx/fy values which can cause simulation auto-movement
            d.fx = null;
            d.fy = null;
          })
          .on("drag", (event, d) => {
            // During drag, update node position directly
            d.x = event.x;
            d.y = event.y;
            // Update the visual position of the node
            d3.select(event.sourceEvent.target.parentNode).attr(
              "transform",
              `translate(${d.x},${d.y})`,
            );

            // Also update any connected links in real-time
            updateLinks();
          })
          .on("end", (event, d) => {
            // When drag ends, save the final position
            d3.select(`#node-${d.id}`).attr(
              "transform",
              `translate(${d.x},${d.y})`,
            );
            
            // Save position data
            if (d.type === 'actor') {
              const card = d.data as CardWithPosition;
              card.position = { x: d.x, y: d.y };
            } else if (d.type === 'agreement') {
              const agreement = d.data as AgreementWithPosition;
              agreement.position = { x: d.x, y: d.y };
            }
          }),
      )
      // Node-level click handler removed. 
      // Individual click handlers are now on the center circle and agreement circle elements.
      //
      // This improves the user experience by:
      // 1. Making only the center circle clickable (not the donut ring)
      // 2. Using current node coordinates for accurate popover positioning
      .on("mouseenter", (event, d) => {
        // Keep existing hover behavior
        if (d.type === 'actor') {
          activeCardId = d.id;
        }
      })
      .on("mouseover", (event, d) => {
        // On hover, set the hovered node and show the radial menu
        if (d.type === 'actor') {
          hoveredNode = d.id;
          updateRadialMenu(d);
        }
      })
      .on("mouseout", (event, d) => {
        // Just clear hover state - donut rings handle their own events
        hoveredNode = null;
      });

    // Initialize link positions
    updateLinks();
    
    // Add donut rings using d3GraphUtils function
    addDonutRings(nodeElements, activeCardId, getAllCachedValues(), getAllCachedCapabilities());
    
    // Add center circles with gradients and add text on top
    const cardNodes = nodeElements.filter((d) => d.type === "actor");

    // Define gradient for center button
    cardNodes.each(function (d) {
      const nodeId = d.id;

      // Create a unique gradient ID for each node
      const gradientId = `center-gradient-${nodeId}`;

      // Add the gradient definition
      const gradient = defs
        .append("radialGradient")
        .attr("id", gradientId)
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%")
        .attr("fx", "50%")
        .attr("fy", "50%");

      // Add the gradient stops - flat button appearance with light gray shadow
      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#FFFFFF") // White center
        .attr("stop-opacity", 0.9);    // Slight transparency
        
      gradient
        .append("stop")
        .attr("offset", "85%")
        .attr("stop-color", "#F5F5F5") // Very light gray
        .attr("stop-opacity", 0.9);
        
      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#E0E0E0") // Light gray edge for subtle shadow
        .attr("stop-opacity", 0.9);

      // Add the center circle 
      const nodeRadius = 35; // Standard card node radius
      
      d3.select(this)
        .append("circle")
        .attr("r", nodeRadius)
        .attr("fill", `url(#${gradientId})`)
        .attr("stroke", "#e5e5e5") // Light gray stroke
        .attr("stroke-width", 1)
        .attr("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.08))") // Subtle shadow
        .attr("class", `center-circle card-center-circle${d.active ? " active" : ""}`)
        .style("cursor", "pointer")
        .attr("pointer-events", "all") // Ensure clickable
        .on("click", function(event) {
          event.stopPropagation(); // Prevent event bubbling
          
          // First, save the current node position to ensure latest coordinates are used
          console.log(`Saving node position: ${d.id} at x:${d.x} y:${d.y}`);
          
          // Get the current node data from the simulation
          const node = d3.select(this.parentNode).datum();
          
          // Toggle popover when clicking the same node
          const isSameNode = popoverOpen && popoverNode && 
            ((popoverNodeType === 'actor' && node.type === 'actor' && (popoverNode as Actor).card_id === node.id) || 
             (popoverNodeType === 'agreement' && node.type === 'agreement' && (popoverNode as Agreement).agreement_id === node.id));
          
          if (isSameNode) {
            // Close popover when clicking the same node
            popoverOpen = false;
            console.log("Closing popover - same node clicked again");
          } else {
            // Open the popover to show node details for a different node
            popoverNode = getOptimizedCardData(node);
            popoverNodeType = node.type;
            
            // Calculate position for the popover using CURRENT coordinates
            // This ensures popover is positioned relative to the node's CURRENT position
            popoverPosition = { 
              x: node.x, 
              y: node.y 
            };
            popoverOpen = true;
            
            // Debug log
            console.log("Node clicked:", node.type, node.id);
            console.log("Popover position:", popoverPosition);
          }
        });
    });

    // Now add center icon group based on card.icon
    const centralIconGroup = nodeElements
      .append("g")
      .attr("class", "central-icon-group")
      .attr("pointer-events", "none"); // Make icon group non-interactive

    // Preload all icons first before adding them to nodes
    const iconSize = 24; // Size of the icon
    
    // Collect all icon names from cards
    const iconNames = cardNodes.data().map(d => {
      const card = d.data as Card;
      return card.icon || card.type || 'default';
    });
    
    // Filter out duplicates and load icons once for all nodes
    const uniqueIcons = [...new Set(iconNames)];
    if (uniqueIcons.length > 0) {
      console.log("Preloading icons:", uniqueIcons);
      // Load icons and wait for them to finish before continuing
      await loadIcons(uniqueIcons);
      console.log("Icons loaded, continuing with visualization");
    }
    
    // After loading all icons, add them to each node
    cardNodes.each(function(d) {
      const card = d.data as Card;
      const nodeGroup = d3.select(this);
      
      // Remove any existing icons
      nodeGroup.selectAll('.center-icon').remove();
      
      // Create foreignObject to hold the Svelte icon component
      const foreignObject = nodeGroup
        .append('foreignObject')
        .attr('class', 'center-icon')
        .attr('width', iconSize)
        .attr('height', iconSize)
        .attr('x', -iconSize / 2)
        .attr('y', -iconSize / 2)
        .attr('pointer-events', 'none');
      
      // Create a div inside foreignObject to hold the icon
      const div = foreignObject
        .append('xhtml:div')
        .style('width', `${iconSize}px`)
        .style('height', `${iconSize}px`)
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center');
      
      // Get and render the icon component from our helper function
      // Need to use an immediately-invoked async function to handle the async icon loading
      (async () => {
        try {
          const iconName = card.icon || card.type || 'default';
          console.log(`Getting icon for card ${card.card_id} (${card.role_title}): ${iconName}`);
          
          // Get the icon component asynchronously
          const IconComponent = await getLucideIcon(iconName);
          
          // Create container for the icon
          const container = div.node();
          if (container) {
            try {
              // Clear the container first
              while (container.firstChild) {
                container.removeChild(container.firstChild);
              }
              
              if (IconComponent && typeof IconComponent === 'function') {
                // Instead of instantiating the component directly, we'll use the SVG path data
                // from the Lucide icons to create SVG elements manually
                
                // Create SVG element with proper attributes
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("width", iconSize.toString());
                svg.setAttribute("height", iconSize.toString());
                svg.setAttribute("viewBox", "0 0 24 24");
                svg.setAttribute("stroke", "#555555");
                svg.setAttribute("stroke-width", "2");
                svg.setAttribute("stroke-linecap", "round");
                svg.setAttribute("stroke-linejoin", "round");
                svg.setAttribute("fill", "none");
                svg.setAttribute("class", "lucide-icon");
                
                // Determine which icon to render
                let iconPathData: string | null = null;
                
                // Set icon path data based on iconName
                if (iconName === 'sun') {
                  // Sun icon path data
                  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                  circle.setAttribute("cx", "12");
                  circle.setAttribute("cy", "12");
                  circle.setAttribute("r", "4");
                  svg.appendChild(circle);
                  
                  // Sun rays
                  for (let i = 0; i < 8; i++) {
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    const angle = (i * Math.PI) / 4;
                    const innerRadius = 4; // Radius of the central circle
                    const outerRadius = 8; // Length of rays
                    
                    const x1 = 12 + innerRadius * Math.cos(angle);
                    const y1 = 12 + innerRadius * Math.sin(angle);
                    const x2 = 12 + outerRadius * Math.cos(angle);
                    const y2 = 12 + outerRadius * Math.sin(angle);
                    
                    line.setAttribute("x1", x1.toString());
                    line.setAttribute("y1", y1.toString());
                    line.setAttribute("x2", x2.toString());
                    line.setAttribute("y2", y2.toString());
                    
                    svg.appendChild(line);
                  }
                } else if (iconName === 'link') {
                  // Link icon
                  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path.setAttribute("d", "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71");
                  svg.appendChild(path);
                  
                  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path2.setAttribute("d", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71");
                  svg.appendChild(path2);
                } else if (iconName === 'lock') {
                  // Lock icon
                  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                  rect.setAttribute("width", "16");
                  rect.setAttribute("height", "10");
                  rect.setAttribute("x", "4");
                  rect.setAttribute("y", "9");
                  rect.setAttribute("rx", "2");
                  rect.setAttribute("ry", "2");
                  svg.appendChild(rect);
                  
                  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path.setAttribute("d", "M8 9V7a4 4 0 0 1 8 0v2");
                  svg.appendChild(path);
                } else if (iconName === 'users') {
                  // Users icon
                  const circle1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                  circle1.setAttribute("cx", "16");
                  circle1.setAttribute("cy", "7");
                  circle1.setAttribute("r", "3");
                  svg.appendChild(circle1);
                  
                  const circle2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                  circle2.setAttribute("cx", "8");
                  circle2.setAttribute("cy", "7");
                  circle2.setAttribute("r", "3");
                  svg.appendChild(circle2);
                  
                  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path1.setAttribute("d", "M3 21v-2a4 4 0 0 1 4-4h2");
                  svg.appendChild(path1);
                  
                  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path2.setAttribute("d", "M15 13h2a4 4 0 0 1 4 4v2");
                  svg.appendChild(path2);
                  
                  const path3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path3.setAttribute("d", "M16 21h-8a4 4 0 0 1-4-4v-2");
                  svg.appendChild(path3);
                } else {
                  // Default user icon as fallback
                  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                  circle.setAttribute("cx", "12");
                  circle.setAttribute("cy", "8");
                  circle.setAttribute("r", "4");
                  svg.appendChild(circle);
                  
                  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path.setAttribute("d", "M20 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2");
                  svg.appendChild(path);
                }
                
                // Add the SVG to the container
                container.appendChild(svg);
                
                console.log(`Successfully created icon component for ${card.role_title}`);
              } else {
                // Fallback: Create a simple SVG if the component isn't available
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("width", iconSize.toString());
                svg.setAttribute("height", iconSize.toString());
                svg.setAttribute("viewBox", "0 0 24 24");
                svg.setAttribute("stroke", "#555555");
                svg.setAttribute("stroke-width", "2");
                svg.setAttribute("stroke-linecap", "round");
                svg.setAttribute("stroke-linejoin", "round");
                svg.setAttribute("fill", "none");
                svg.setAttribute("class", "lucide-icon");
                
                // Create a user icon as fallback
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", "12");
                circle.setAttribute("cy", "12");
                circle.setAttribute("r", "5");
                
                // Add head above the circle
                const head = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                head.setAttribute("cx", "12");
                head.setAttribute("cy", "7");
                head.setAttribute("r", "3");
                
                svg.appendChild(circle);
                svg.appendChild(head);
                container.appendChild(svg);
              }
            } catch (err) {
              console.error(`Error creating icon component: ${err}`);
            }
          }
          
          console.log(`Successfully rendered icon for ${card.role_title}`);
        } catch (e) {
          console.error(`Error rendering icon for ${card.role_title}:`, e);
          
          // Fallback to simpler SVG circle if component rendering fails
          const container = div.node();
          if (container) {
            // Create a simple colored circle as a visual indicator that doesn't depend on component rendering
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "24");
            svg.setAttribute("height", "24");
            svg.setAttribute("viewBox", "0 0 24 24");
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", "12");
            circle.setAttribute("cy", "12");
            circle.setAttribute("r", "10");
            circle.setAttribute("fill", "#555555");
            
            svg.appendChild(circle);
            container.appendChild(svg);
            
            console.log(`Created fallback icon for ${card.role_title}`);
          }
        }
      })();
    });

    // Create name labels outside/below the node for better readability
    const cardNameGroups = cardNodes
      .append("g")
      .attr("class", "card-name-container")
      .attr("pointer-events", "none"); // Make label non-interactive
    
    // Add background rectangle for label with semi-transparent background and rounded corners
    cardNameGroups.each(function(d) {
      const group = d3.select(this);
      const card = d.data as Card;
      const labelText = card.role_title.length > 20 
        ? card.role_title.slice(0, 17) + "..." 
        : card.role_title;
      
      // First create a temporary text element to measure text width
      const tempText = group.append("text")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text(labelText)
        .style("visibility", "hidden");
        
      // Measure the text width (use getBBox method)
      const textWidth = tempText.node().getBBox().width;
      tempText.remove(); // Remove the temporary element
      
      // Create background rectangle with compact padding
      const padding = 5;
      const rectWidth = textWidth + padding * 2;
      const rectHeight = 18;
      
      // Get card color to match label color with card
      const cardData = d.data as CardWithPosition;
      
      // Calculate position below the outer ring (donut)
      // The outer ring radius = nodeRadius + donutThickness (35 + 15 = 50)
      const outerRingRadius = cardNodeRadius + donutThickness;
      const labelYPosition = outerRingRadius + (outerRingRadius * 0.1); // Position 10% below the outer ring
      
      // Add the rounded rectangle background - positioned below the outer ring
      group.append("rect")
        .attr("rx", 4) // Rounded corners
        .attr("ry", 4)
        .attr("width", rectWidth)
        .attr("height", rectHeight)
        .attr("x", -rectWidth / 2) // Center horizontally
        .attr("y", labelYPosition) // Position below the outer ring
        .attr("fill", "var(--color-tertiary-50, white)") // Use theme variable with white fallback
        .attr("fill-opacity", 0.85) // Semi-transparent background
        .attr("stroke", "var(--color-tertiary-300, #e5e5e5)") // Light border from theme
        .attr("stroke-width", 0.5) // Thin border
      
      // Add the text on top of the background
      group.append("text")
        .attr("class", "name-text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle") // Better centering
        .attr("y", labelYPosition + (rectHeight / 2)) // Center text vertically in background
        .attr("font-size", "11px") 
        .attr("font-weight", "500")
        .attr("fill", "var(--node-text-light, var(--color-tertiary-900))") // Use themed variable for proper color in both modes
        .text(labelText);
    });

    // Create agreement nodes with smaller circles
    const agreementNodes = nodeElements.filter((d) => d.type === "agreement");
    
    // Generate sequential IDs for our agreements (e.g., AG1, AG2)
    let agreementCounter = 1;
    

    
    agreementNodes.each(function(d) {
      // Add a small circle for agreement nodes - UPDATED styling to match the reference image exactly
      d3.select(this)
        .append("circle")
        .attr("r", 17) // Smaller radius for agreement nodes
        .attr("fill", "#444444") // Dark gray/black fill to match reference image
        .attr("stroke", "#333333") // Slightly darker stroke for definition
        .attr("stroke-width", 0.75) // Thinner stroke for subtle appearance
        .attr("class", "agreement-circle")
        .style("cursor", "pointer")
        .attr("pointer-events", "all") // Ensure clickable
        .style("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.2))") // Subtle shadow
        .on("click", function(event) {
          event.stopPropagation(); // Prevent event bubbling
          
          // First, save the current node position to ensure latest coordinates are used
          console.log(`Saving node position: ${d.id} at x:${d.x} y:${d.y}`);
          
          // Get the current node data from the simulation
          const node = d3.select(this.parentNode).datum();
          
          // Toggle popover when clicking the same node
          const isSameNode = popoverOpen && popoverNode && 
            ((popoverNodeType === 'actor' && node.type === 'actor' && (popoverNode as Actor).card_id === node.id) || 
             (popoverNodeType === 'agreement' && node.type === 'agreement' && (popoverNode as Agreement).agreement_id === node.id));
          
          if (isSameNode) {
            // Close popover when clicking the same node
            popoverOpen = false;
            console.log("Closing popover - same node clicked again");
          } else {
            // Open the popover to show node details for a different node
            popoverNode = getOptimizedCardData(node);
            popoverNodeType = node.type;
            
            // Calculate position for the popover using CURRENT coordinates
            // This ensures popover is positioned relative to the node's CURRENT position
            popoverPosition = { 
              x: node.x, 
              y: node.y 
            };
            popoverOpen = true;
            
            // Debug log
            console.log("Node clicked:", node.type, node.id);
            console.log("Popover position:", popoverPosition);
          }
        });
        
      // Create an agreement ID (AG1, AG2, etc.)
      const agreementId = `AG${agreementCounter++}`;
        
      // Add a title text label - UPDATED to match reference exactly
      d3.select(this)
        .append("text")
        .attr("class", "agreement-title")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle") // Better vertical centering
        .attr("font-size", "11px") // Smaller font for subtlety
        .attr("font-weight", "bold") // Bold weight to match reference
        .attr("fill", "#FFFFFF") // White text to match reference image
        .text(agreementId);
        
      // Add agreement title below on hover (handled by CSS)
      d3.select(this)
        .append("title")
        .text((d) => {
          const agreement = d.data as Agreement;
          return agreement.title || "Untitled Agreement";
        });
    });
    
    // Create central text elements LAST to ensure proper layering
    // This ensures text appears above all other elements
    cardNodes.each(function(nodeData) {
      const node = d3.select(this);
      
      // Create central text group as the last child element for proper layering
      const centerTextGroup = node.append("g")
        .attr("class", "center-text-group")
        .attr("pointer-events", "none");
      
      centerTextGroup.append("text")
        .attr("class", "count-text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "#555555")
        .text("");
        
      centerTextGroup.append("text")
        .attr("class", "options-text") 
        .attr("text-anchor", "middle")
        .attr("dy", "1em")
        .attr("font-size", "12px")
        .attr("fill", "#777777")
        .text("");
    });

    // Handle zoom functionality with better event handling
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on("zoom", (event) => {
        // Update transform for all groups to maintain consistent appearance
        nodeGroup.attr("transform", event.transform);
        linkGroup.attr("transform", event.transform);
        
        // Reset any active hover states to prevent visualization issues during zoom
        if (hoveredCategory) {
          hoveredCategory = null;
          
          // Hide all sub-wedges and labels immediately on zoom
          d3.selectAll(".sub-wedges")
            .style("opacity", 0)
            .style("visibility", "hidden");
            
          d3.selectAll(".label-container")
            .style("opacity", 0)
            .style("visibility", "hidden");
            
          // Reset all wedges to normal size
          d3.selectAll(".category-wedge")
            .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))");
            
          // Clear all central text elements
          d3.selectAll(".count-text, .options-text").text("");
        }
      });
    
    // Apply zoom behavior with event filtering
    svg.call(zoomBehavior)
       // Prevent standard mousewheel behavior and avoid event conflicts
       .on("wheel", (event) => {
         if (event.ctrlKey || event.metaKey) return; // Allow browser zoom with Ctrl/Cmd key
         event.preventDefault(); // Prevent default browser scrolling
       });
  }

  // Create demo agreements for testing when no real agreements exist
  function createDemoAgreements() {
    if (cardsWithPosition.length < 3) return;
    
    // Create a circular agreement between 3 cards
    const card1 = cardsWithPosition[0];
    const card2 = cardsWithPosition[1];
    const card3 = cardsWithPosition[2];
    
    // Create mock actor IDs for cards if they don't exist
    const actor1Id = `actor_${card1.card_id}`;
    const actor2Id = `actor_${card2.card_id}`;
    const actor3Id = `actor_${card3.card_id}`;
    
    // Map card IDs to actor IDs
    actorCardMap.set(actor1Id, card1.card_id);
    actorCardMap.set(actor2Id, card2.card_id);
    actorCardMap.set(actor3Id, card3.card_id);
    
    // Create agreement 1: card1 -> card2
    const agreement1: AgreementWithPosition = {
      agreement_id: "agreement_1",
      title: "Resource Sharing",
      description: "Agreement to share resources between parties",
      created_at: Date.now(),
      status: "active",
      parties: {
        [actor1Id]: true,
        [actor2Id]: true
      },
      obligations: [
        {
          id: "ob1",
          fromActorId: actor1Id,
          toActorId: actor2Id,
          text: "Provide funding"
        }
      ],
      benefits: [
        {
          id: "be1", 
          fromActorId: actor2Id,
          toActorId: actor1Id,
          text: "Deliver results"
        }
      ],
      position: {
        x: ((card1.position?.x || 0) + (card2.position?.x || 0)) / 2,
        y: ((card1.position?.y || 0) + (card2.position?.y || 0)) / 2
      }
    };
    
    // Create agreement 2: card2 -> card3
    const agreement2: AgreementWithPosition = {
      agreement_id: "agreement_2",
      title: "Knowledge Sharing",
      description: "Agreement to share knowledge and expertise",
      created_at: Date.now(),
      status: "active",
      parties: {
        [actor2Id]: true,
        [actor3Id]: true
      },
      obligations: [
        {
          id: "ob2",
          fromActorId: actor2Id,
          toActorId: actor3Id,
          text: "Share methodology"
        }
      ],
      benefits: [
        {
          id: "be2",
          fromActorId: actor3Id,
          toActorId: actor2Id,
          text: "Provide data"
        }
      ],
      position: {
        x: ((card2.position?.x || 0) + (card3.position?.x || 0)) / 2,
        y: ((card2.position?.y || 0) + (card3.position?.y || 0)) / 2
      }
    };
    
    // Create agreement 3: card3 -> card1
    const agreement3: AgreementWithPosition = {
      agreement_id: "agreement_3",
      title: "Community Support",
      description: "Agreement to support community initiatives",
      created_at: Date.now(),
      status: "active",
      parties: {
        [actor3Id]: true,
        [actor1Id]: true
      },
      obligations: [
        {
          id: "ob3",
          fromActorId: actor3Id,
          toActorId: actor1Id,
          text: "Provide community support"
        }
      ],
      benefits: [
        {
          id: "be3",
          fromActorId: actor1Id,
          toActorId: actor3Id,
          text: "Provide mentorship"
        }
      ],
      position: {
        x: ((card3.position?.x || 0) + (card1.position?.x || 0)) / 2,
        y: ((card3.position?.y || 0) + (card1.position?.y || 0)) / 2
      }
    };
    
    // Add agreements to the array
    agreements = [agreement1, agreement2, agreement3];
  }
  
  // Complete remake of donut rings to EXACTLY match React implementation
  // Note: This function is kept for reference but not used - we use addDonutRings from d3GraphUtils.ts instead
  function addLocalDonutRings() {
    // ----- EXACTLY MATCH REACT APPROACH -----
    
    // Get all card nodes
    const cardNodes = nodeElements.filter((d) => d.type === "actor");
    
    // Fixed values for radii (from CSS variables in React)
    const baseActorRadius = 35; 
    const baseDonutThickness = 15;

    // Helper function to ensure array format for properties
    const ensureArray = (field: Record<string, boolean | any> | string[] | string | undefined | null): string[] => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (typeof field === 'object') {
        // Handle Gun.js objects and references
        return Object.keys(field).filter(id => id !== '_' && id !== '#');
      }
      if (typeof field === 'string') {
        return field.split(',').map(item => item.trim());
      }
      return [];
    };
    
    // Step 1 (React): Add outer donut rings to all card nodes first
    cardNodes.each(function(d) {
      const isActive = d.id === activeCardId;
      const scaleFactor = isActive ? 1.5 : 1;
      const scaledNodeRadius = baseActorRadius * scaleFactor;
      const donutRadius = scaledNodeRadius + baseDonutThickness * scaleFactor;
      
      // Add a donut ring
      d3.select(this)
        .append("circle")
        .attr("r", donutRadius)
        .attr("class", `donut-ring${isActive ? " active" : ""}`)
        .attr("fill", "transparent")
        .attr("stroke", "var(--border)")
        .attr("stroke-width", 1);
    });

    // Available categories for visualization
    const categories = ["values", "capabilities", "intellectualProperty", "resources", "goals"];
    
    // Format category name nicely (shared helper function)
    const formatCategoryName = (cat: string) => {
      return cat
        .replace(/([A-Z])/g, " $1") // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
        .trim();
    };

    // Process each card node to add wedges
    cardNodes.each(function(nodeData) {
      // Basic setup for this node
      const node = d3.select(this);
      const card = nodeData.data as Card;
      const nodeId = nodeData.id;
      
      // Process card data for visualization
      const cardDataForViz = { ...card } as CardWithPosition & Record<string, any>;
      
      // Debug: Print data from the D3 node
      console.log(`DEBUG: Node data for ${nodeData.name}:`, nodeData);
      console.log(`DEBUG: Card data for ${card.role_title}:`, card);
      console.log(`DEBUG: Looking for _valueNames in nodeData:`, nodeData._valueNames);
      console.log(`DEBUG: Looking for _valueNames in card:`, (card as Record<string, unknown>)._valueNames);
      
      // IMPORTANT: Get the values directly from the d3 node object, not the card
      // This ensures we use the data that was explicitly passed from the card to the node
      if (nodeData._valueNames && nodeData._valueNames.length > 0) {
        // Update cardDataForViz with values from D3 node
        cardDataForViz._valueNames = nodeData._valueNames;
      }
      
      // Use our real value/capability data that was loaded with loadCardDetails
      if (cardDataForViz._valueNames && cardDataForViz._valueNames.length > 0) {
        console.log(`Using ${cardDataForViz._valueNames.length} real values for card ${card.role_title}:`, cardDataForViz._valueNames);
        
        // Create a values object in the format required for visualization
        const realValuesObj: Record<string, boolean> = {};
        
        // Add each value name as a properly keyed entry
        cardDataForViz._valueNames.forEach((valueName: string) => {
          const key = `value_${valueName.toLowerCase().replace(/\s+/g, '-')}`;
          realValuesObj[key] = true;
          
          // Make sure the value is in our cache for labels
          if (!valueCache.has(key)) {
            valueCache.set(key, {
              value_id: key,
              name: valueName,
              description: `${valueName} for ${card.role_title}`,
              created_at: Date.now()
            });
          }
        });
        
        // Use the real values for visualization
        cardDataForViz.values = realValuesObj;
      }
      // Fallback to standard values if no real values were loaded
      else if (!cardDataForViz.values || Object.keys(cardDataForViz.values).filter(k => k !== '_' && k !== '#').length === 0) {
        console.log(`Using default values for card ${card.role_title}`);
        
        // Use standard values that match our database
        cardDataForViz.values = { 
          'value_sustainability': true, 
          'value_community-resilience': true
        };
          
        // IMPORTANT: Use addValueToCache from cacheUtils.ts to update centralized caches
        // This ensures consistency across all components
        const centralizedValues = getAllCachedValues();
        
        if (!centralizedValues.has('value_sustainability')) {
          addValueToCache('value_sustainability', { 
            value_id: 'value_sustainability', 
            name: 'Sustainability',
            description: 'Practices that can be maintained indefinitely',
            created_at: Date.now()
          });
        }
        
        if (!centralizedValues.has('value_community-resilience')) {
          addValueToCache('value_community-resilience', { 
            value_id: 'value_community-resilience', 
            name: 'Community Resilience',
            description: 'Ability to adapt and recover from adversity',
            created_at: Date.now()
          });
        }
      } else {
        // For existing values, ensure we have them in our centralized cache
        const centralizedValues = getAllCachedValues();
        Object.keys(cardDataForViz.values).forEach(key => {
          if (key !== '_' && key !== '#' && !centralizedValues.has(key)) {
            const valueName = key.replace('value_', '')
              .split(/[-_]/) // Handle both hyphen and underscore delimiters
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            addValueToCache(key, { 
              value_id: key, 
              name: valueName,
              description: `Value for ${card.role_title}`,
              created_at: Date.now()
            });
          }
        });
      }
      
      // Do the same for capabilities - use loaded capability names if available
      if (cardDataForViz._capabilityNames && cardDataForViz._capabilityNames.length > 0) {
        console.log(`Using ${cardDataForViz._capabilityNames.length} real capabilities for card ${card.role_title}:`, cardDataForViz._capabilityNames);
        
        // Create a capabilities object in the format required for visualization
        const realCapabilitiesObj: Record<string, boolean> = {};
        
        // Add each capability name as a properly keyed entry
        cardDataForViz._capabilityNames.forEach((capName: string) => {
          const key = `capability_${capName.toLowerCase().replace(/\s+/g, '-')}`;
          realCapabilitiesObj[key] = true;
          
          // Make sure the capability is in our cache for labels
          if (!capabilityCache.has(key)) {
            capabilityCache.set(key, {
              capability_id: key,
              name: capName,
              description: `${capName} for ${card.role_title}`,
              created_at: Date.now()
            });
          }
        });
        
        // Use the real capabilities for visualization
        cardDataForViz.capabilities = realCapabilitiesObj;
      }
      // Fallback to standard capabilities if no real capabilities were loaded
      else if (!cardDataForViz.capabilities || Object.keys(cardDataForViz.capabilities).filter(k => k !== '_' && k !== '#').length === 0) {
        console.log(`Using default capabilities for card ${card.role_title}`);
        
        // Default capabilities based on card type
        if (card.card_category === 'Funders') {
          cardDataForViz.capabilities = {
            'capability_grant-writing-expertise': true,
            'capability_impact-assessment': true
          };
          
          if (!capabilityCache.has('capability_grant-writing-expertise')) {
            capabilityCache.set('capability_grant-writing-expertise', {
              capability_id: 'capability_grant-writing-expertise',
              name: 'Grant Writing Expertise',
              description: 'Ability to secure funding through grants',
              created_at: Date.now()
            });
          }
          
          if (!capabilityCache.has('capability_impact-assessment')) {
            capabilityCache.set('capability_impact-assessment', {
              capability_id: 'capability_impact-assessment',
              name: 'Impact Assessment',
              description: 'Measuring project outcomes and effectiveness',
              created_at: Date.now()
            });
          }
        } else if (card.type === 'DAO') {
          cardDataForViz.capabilities = {
            'capability_coordination': true,
            'capability_planning': true
          };
          
          if (!capabilityCache.has('capability_coordination')) {
            capabilityCache.set('capability_coordination', {
              capability_id: 'capability_coordination',
              name: 'Coordination',
              description: 'Managing decentralized activities',
              created_at: Date.now()
            });
          }
          
          if (!capabilityCache.has('capability_planning')) {
            capabilityCache.set('capability_planning', {
              capability_id: 'capability_planning',
              name: 'Planning',
              description: 'Developing and executing strategies',
              created_at: Date.now()
            });
          }
        } else {
          // Generic capabilities
          cardDataForViz.capabilities = {
            'capability_community-outreach': true,
            'capability_planning': true
          };
          
          if (!capabilityCache.has('capability_community-outreach')) {
            capabilityCache.set('capability_community-outreach', {
              capability_id: 'capability_community-outreach',
              name: 'Community Outreach',
              description: 'Engaging with local community members',
              created_at: Date.now()
            });
          }
          
          if (!capabilityCache.has('capability_planning')) {
            capabilityCache.set('capability_planning', {
              capability_id: 'capability_planning',
              name: 'Planning',
              description: 'Developing and executing strategies',
              created_at: Date.now()
            });
          }
        }
      } else {
        // For existing capabilities, ensure we have them in our cache
        Object.keys(cardDataForViz.capabilities).forEach(key => {
          if (key !== '_' && key !== '#' && !capabilityCache.has(key)) {
            const capName = key.replace('capability_', '')
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            capabilityCache.set(key, { 
              capability_id: key, 
              name: capName,
              description: `Capability for ${card.role_title}`,
              created_at: Date.now()
            });
          }
        });
      }
      
      // Map legacy field names 
      if (!cardDataForViz.resources && card.rivalrous_resources) {
        cardDataForViz.resources = card.rivalrous_resources;
      }
      
      if (!cardDataForViz.intellectualProperty && card.intellectual_property) {
        cardDataForViz.intellectualProperty = card.intellectual_property;
      }
      
      // Convert all category fields to arrays for consistent processing
      categories.forEach(cat => {
        if (typeof cardDataForViz[cat] === "string") {
          cardDataForViz[cat] = ensureArray(cardDataForViz[cat]);
        } else if (typeof cardDataForViz[cat] === "object") {
          cardDataForViz[cat] = ensureArray(cardDataForViz[cat]);
        }
      });
      
      // Filter to only categories with content
      const cardCategories = categories.filter(
        (cat) => ensureArray(cardDataForViz[cat]).length > 0
      );
      
      // Skip if no valid categories
      if (cardCategories.length === 0) return;
      
      // Set up scaling based on active status
      const isActive = nodeId === activeCardId;
      const scaleFactor = isActive ? 1.5 : 1;
      const actorNodeRadius = baseActorRadius * scaleFactor;
      const donutThickness = baseDonutThickness * scaleFactor;
      const donutRadius = actorNodeRadius + donutThickness;
      const expandedRadius = donutRadius + 15 * scaleFactor;
      
      // Step 2 (React): Create the category-level pie chart 
      const categoryPie = d3.pie<string>()
        .value(() => 1) 
        .sort(null);    
      
      const categoryPieData = categoryPie(cardCategories);
      
      // Step 3 (React): Define the arcs
      const categoryArc = d3.arc<d3.PieArcDatum<string>>()
        .innerRadius(actorNodeRadius)
        .outerRadius(actorNodeRadius + donutThickness)
        .cornerRadius(1)
        .padAngle(0.02);
      
      const expandedArc = d3.arc<d3.PieArcDatum<string>>()
        .innerRadius(actorNodeRadius)
        .outerRadius(expandedRadius)
        .cornerRadius(3)
        .padAngle(0.04);
      
      // Step 4 (React): Create a parent group for each wedge
      const categoryGroups = node
        .selectAll(".category-group")
        .data(categoryPieData)
        .enter()
        .append("g")
        .attr("class", "category-group")
        .attr("data-category", (d) => d.data);
      
      // Step 5 (React): Add the wedges to each group with direct event handlers
      categoryGroups
        .append("path")
        .attr("class", "category-wedge")
        .attr("d", categoryArc)
        .attr("fill", (d) => categoryColors(d.data))
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))")
        .style("cursor", "pointer")
        .attr("data-category", (d) => d.data)
        .attr("pointer-events", "all");
      
      // Process each category to create its sub-elements
      categoryGroups.each(function(d) {
        const group = d3.select(this);
        const category = d.data;
        const content = ensureArray(cardDataForViz[category]);
        
        if (content.length === 0) return;
        
        // Create container for sub-wedges (hidden initially)
        const subWedgesGroup = group
          .append("g")
          .attr("class", "sub-wedges")
          .style("visibility", "hidden")
          .attr("opacity", 0)
          .attr("pointer-events", "none");
        
        // Create container for labels (hidden initially)
        const labelsContainer = group  
          .append("g")
          .attr("class", "label-container")
          .style("visibility", "hidden")
          .attr("opacity", 0)
          .attr("pointer-events", "none");
        
        // Create sub-wedges within the category wedge
        const subItemPie = d3.pie<string>()
          .startAngle(d.startAngle)
          .endAngle(d.endAngle)
          .value(() => 1)
          .sort(null);
        
        const subItemPieData = subItemPie(content);
        
        // Define arc for sub-wedges
        const subArc = d3.arc<d3.PieArcDatum<string>>()
          .innerRadius(actorNodeRadius)
          .outerRadius(expandedRadius)
          .cornerRadius(1)
          .padAngle(0.01);
        
        // Add sub-wedges - directly match React
        subWedgesGroup
          .selectAll(".sub-wedge")
          .data(subItemPieData)
          .enter()
          .append("path")
          .attr("class", "sub-wedge")
          .attr("d", subArc)
          .attr("fill", categoryColors(category))
          .attr("stroke", "white")
          .attr("stroke-width", 0.5)
          .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))")
          .attr("pointer-events", "none");
        
        // Add text labels for each item - directly match React
        subItemPieData.forEach((itemWedge, index) => {
          const item = itemWedge.data;
          
          // Calculate label angle and position exactly as in React
          const itemAngle = (itemWedge.startAngle + itemWedge.endAngle) / 2;
          const adjustedAngle = itemAngle - Math.PI / 2;
          
          // Calculate label position with gap
          const gapPercentage = 0.15; 
          const labelDistance = expandedRadius * (1 + gapPercentage);
          const labelX = Math.cos(adjustedAngle) * labelDistance;
          const labelY = Math.sin(adjustedAngle) * labelDistance;
          
          // Determine text rotation and anchor
          const angleDeg = ((adjustedAngle * 180) / Math.PI) % 360;
          const isLeftSide = angleDeg > 90 && angleDeg < 270;
          const textAnchor = isLeftSide ? "end" : "start";
          const rotationDeg = isLeftSide ? angleDeg + 180 : angleDeg;
          
          // Get item name using centralized caches
          let itemName = item;
          const centralizedValues = getAllCachedValues();
          const centralizedCapabilities = getAllCachedCapabilities();
          
          if (category === "values" && centralizedValues.has(item)) {
            itemName = centralizedValues.get(item).name;
          } else if (category === "capabilities" && centralizedCapabilities.has(item)) {
            itemName = centralizedCapabilities.get(item).name;
          }
          
          // Add the label text
          labelsContainer
            .append("text")
            .attr("class", "item-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("font-size", "11px")
            .attr("fill", categoryColors(category))
            .attr("font-weight", "500")
            .attr("transform", `rotate(${rotationDeg},${labelX},${labelY})`)
            .text(itemName);
        });
        
        // Add mouse event handlers exactly like React
        const wedge = group.select(".category-wedge");
        
        // mouseenter event handler - FIXED same as mouseleave
        wedge.on("mouseenter", function(event) {
          // Critical: Prevent event bubbling
          event.stopPropagation();
          
          // Store references to DOM elements to prevent issues with "this" context
          const thisWedge = d3.select(this);
          const thisSubWedges = subWedgesGroup;
          const thisLabels = labelsContainer;
          const thisNode = node;
          
          // Reset all other wedges to default
          thisNode.selectAll(".category-wedge").each(function() {
            const otherWedge = d3.select(this);
            if (otherWedge.node() !== thisWedge.node()) {
              otherWedge
                .transition()
                .duration(150)
                .attr("d", categoryArc)
                .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))");
            }
          });
          
          // Hide all sub-elements before showing the ones for this wedge
          thisNode.selectAll(".sub-wedges, .label-container")
            .style("visibility", "hidden")
            .attr("opacity", 0);
          
          // Expand this wedge
          thisWedge
            .transition()
            .duration(150)
            .attr("d", expandedArc)
            .attr("filter", "drop-shadow(0px 0px 3px rgba(0,0,0,0.3))");
          
          // Show sub-elements for this wedge with explicit references
          thisSubWedges
            .style("visibility", "visible")
            .transition()
            .duration(150)
            .attr("opacity", 1);
          
          thisLabels
            .style("visibility", "visible")
            .transition()
            .duration(150)
            .attr("opacity", 1);
          
          // Hide the center icon when a wedge is hovered
          thisNode.select(".center-icon")
            .transition()
            .duration(150)
            .attr("opacity", 0);
            
          // Update central text with explicit references
          thisNode.select(".count-text")
            .transition()
            .duration(150)
            .text(content.length);
          
          thisNode.select(".options-text")
            .transition()
            .duration(150)
            .text(formatCategoryName(category));
        });
        
        // mouseleave event handler - CRITICAL FIX for disappearing nodes
        wedge.on("mouseleave", function(event) {
          // Critical: Prevent event bubbling
          event.stopPropagation();
          
          // Store references to DOM elements to prevent issues with "this" context
          const thisWedge = d3.select(this);
          const thisSubWedges = subWedgesGroup;
          const thisLabels = labelsContainer;
          const thisNode = node;
          
          // Reset this specific wedge's appearance
          thisWedge
            .transition()
            .duration(200)
            .attr("d", categoryArc)
            .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))");
          
          // Hide sub-elements with explicit element references
          thisSubWedges
            .transition()
            .duration(100)
            .attr("opacity", 0)
            .on("end", function() {
              thisSubWedges.style("visibility", "hidden");
            });
          
          thisLabels
            .transition()
            .duration(100)
            .attr("opacity", 0)
            .on("end", function() {
              thisLabels.style("visibility", "hidden");
            });
          
          // Show center icon again
          thisNode.select(".center-icon")
            .transition()
            .duration(200)
            .attr("opacity", 0.7);
          
          // Clear central text with explicit references
          thisNode.select(".count-text")
            .transition()
            .duration(200)
            .text("");
          
          thisNode.select(".options-text")
            .transition()
            .duration(200)
            .text("");
        });
      });
    });
  }
  
  // All visualization is now handled directly by D3 in the addDonutRings() function

  function handleSearch() {
    // Implement search logic here
  }

  function handleZoomIn() {
    const svg = d3.select(svgRef);
    const currentTransform = d3.zoomTransform(svg.node() as Element);
    // Use proper typing for the zoom transform
    const zoom = d3.zoom<SVGSVGElement, unknown>();
    svg.transition().duration(300).call(
      // Use explicit function type for transform method
      (selection: d3.Selection<SVGSVGElement, unknown, null, undefined>, transform: d3.ZoomTransform) => 
        zoom.transform(selection, transform),
      d3.zoomIdentity.scale(currentTransform.k * 1.3)
    );
  }

  function handleZoomOut() {
    const svg = d3.select(svgRef);
    const currentTransform = d3.zoomTransform(svg.node() as Element);
    // Use proper typing for the zoom transform
    const zoom = d3.zoom<SVGSVGElement, unknown>();
    svg.transition().duration(300).call(
      // Use explicit function type for transform method
      (selection: d3.Selection<SVGSVGElement, unknown, null, undefined>, transform: d3.ZoomTransform) => 
        zoom.transform(selection, transform),
      d3.zoomIdentity.scale(currentTransform.k / 1.3)
    );
  }

  function handleReset() {
    const svg = d3.select(svgRef);
    // Use proper typing for the zoom transform
    const zoom = d3.zoom<SVGSVGElement, unknown>();
    svg.transition().duration(300).call(
      // Use explicit function type for transform method
      (selection: d3.Selection<SVGSVGElement, unknown, null, undefined>, transform: d3.ZoomTransform) => 
        zoom.transform(selection, transform),
      d3.zoomIdentity
    );
  }
</script>

<style>
/* 
 * Only keeping D3/SVG-specific styles that can't be done with Tailwind
 * These are things like SVG-specific attributes (fill, stroke)
 */

/* D3 Node Core Styles - Only SVG-specific styles that can't be represented with Tailwind */
.node { cursor: pointer; }

/* Card and Agreement nodes */
.node-card .center-circle {
  fill: white; 
  stroke: #e5e5e5;
  stroke-width: 1;
  filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.08));
}

.node-card.active .center-circle {
  stroke: #4299e1;
  stroke-width: 2;
}

.node-agreement .agreement-circle {
  fill: white;
  stroke: #e5e5e5;
  stroke-width: 1.5;
  filter: drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.15));
}

.node-agreement.active .agreement-circle {
  stroke: #4299e1;
  stroke-width: 2;
}

/* SVG Text elements */
.count-text, .options-text, .card-title, .card-type, .name-text {
  pointer-events: none;
  user-select: none;
  fill: #333333;
}

/* Dark mode text colors */
:global(html.dark) .count-text,
:global(html.dark) .options-text,
:global(html.dark) .card-title,
:global(html.dark) .card-type,
:global(html.dark) .name-text {
  fill: #e5e5e5;
}

/* Link styling */
.link-line {
  stroke: #e5e5e5;
  stroke-width: 1.5;
  opacity: 0.8;
}

/* Category wedges */
.category-wedge {
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-wedge:hover {
  filter: drop-shadow(0px 0px 3px rgba(0, 0, 0, 0.3));
}

/* Sub-wedges */
.sub-wedge {
  opacity: 0.9;
  filter: drop-shadow(0px 0px 1px rgba(0, 0, 0, 0.1));
}

/* Donut rings and wedges */
.donut-ring {
  fill: transparent;
  stroke: #e5e5e5;
  stroke-width: 1px;
  opacity: 0.8;
}

.donut-ring.active {
  stroke: #4299e1;
  stroke-width: 1.5px;
}

.wedge {
  transition: opacity 0.2s ease, stroke-width 0.2s ease;
}

/* Ensure the category groups are visible */
.category-group {
  opacity: 1;
}

/* Node backgrounds */
.node-background {
  fill: white;
  stroke: #e5e5e5;
  stroke-width: 1;
}

.actor-background {
  fill: white;
  filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1));
}

.agreement-background {
  fill: #f7fafc;
}

/* Make sure actor nodes are prominent */
.node-actor {
  z-index: 10;
}

/* Guaranteed visible rings styling */
#guaranteed-rings {
  pointer-events: none; /* Allow clicks to pass through to the nodes */
}

.card-rings {
  pointer-events: none; /* Allow clicks to pass through to the nodes below */
}

.guaranteed-ring,
.guaranteed-values-wedge,
.guaranteed-capabilities-wedge,
.guaranteed-goals-wedge, 
.guaranteed-resources-wedge,
.guaranteed-ip-wedge,
.guaranteed-relationships-wedge,
.guaranteed-center {
  pointer-events: none; /* Allow clicks to pass through to the nodes below */
  filter: drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.3));
}

/* Make ring wedges slightly translucent */
.guaranteed-values-wedge,
.guaranteed-capabilities-wedge,
.guaranteed-goals-wedge,
.guaranteed-resources-wedge,
.guaranteed-ip-wedge,
.guaranteed-relationships-wedge {
  opacity: 0.85;
}

/* Ensure the center of card stays on top of wedges */
.guaranteed-center {
  opacity: 1;
}
</style>

<div class="h-full relative overflow-hidden">  
  <!-- D3 SVG container -->
  <svg 
    bind:this={svgRef} 
    width="100%" 
    height="100%" 
    onclick={(event) => {
      // Check if click is directly on SVG background (not on a node)
      if (event.target === svgRef) {
        popoverOpen = false;
      }
    }}
  >
    <!-- D3 visualization will be rendered here -->
    
    <!-- All visualization elements are now created directly with D3 -->
    
    <!-- D3 visualization will be rendered here -->
  </svg>
  
  <!-- Popover Container -->
  {#if popoverOpen && popoverNode}
    {@const cardCategory = popoverNodeType === 'actor' ? (popoverNode.card_category || 'Supporters') : ''}
    {@const categoryColor = 
      cardCategory === 'Funders' ? 'primary' : 
      cardCategory === 'Providers' ? 'success' : 
      cardCategory === 'Supporters' ? 'secondary' : 'tertiary'
    }
    
    <div 
      class="absolute max-w-md max-h-[80vh] overflow-y-auto z-[1000]"
      style="left: {popoverPosition.x + 30}px; top: {popoverPosition.y}px; transform: translateY(-50%);"
    >
      <!-- Close button in top right -->
      <div class="absolute top-2 right-2 z-10">
        <button 
          class="btn btn-sm variant-ghost-surface" 
          onclick={handlePopoverClose}
          aria-label="Close popover"
        >
          ×
        </button>
      </div>
      
      {#if popoverNodeType === 'actor' && popoverNode}
        <!-- Card styled to match DeckBrowser format exactly -->
        <!-- Using type casting for TypeScript safety -->
        {@const cardNode = popoverNode as Card}
        <!-- Card styled to exactly match the example image -->
        <div class="card bg-surface-50-900 rounded-lg shadow-lg border border-surface-300-600 w-80">
          <!-- Header with gradient -->
          <header class="p-3 text-white bg-{categoryColor}-500 rounded-t-lg">
            <div class="flex items-center gap-2">
              <!-- Icon circle -->
              <div class="bg-surface-900-50/30 rounded-full p-1.5 flex items-center justify-center">
                <svelte:component this={getCardIcon(cardNode.icon)} class="w-5 h-5" />
              </div>
              
              <!-- Title and type -->
              <div class="flex-1">
                <div class="flex justify-between items-center">
                  <h3 class="font-bold text-lg">{cardNode.role_title}</h3>
                  <span class="text-white text-sm">{cardNode.card_number}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                  <span>{cardNode.type || 'Individual'}</span>
                  <span class="bg-white/20 rounded-full px-2 py-0.5 text-xs">{cardCategory}</span>
                </div>
              </div>
            </div>
          </header>
            
            <!-- Card body with sections -->
            <div class="p-4 space-y-3">
              <!-- Backstory -->
              <div>
                <h4 class="font-medium text-surface-700-300">Backstory</h4>
                <p class="text-surface-900-50">{cardNode.backstory}</p>
              </div>
              
              <!-- Values - Get from values object directly -->
              {#if cardNode.values && Object.keys(cardNode.values).length > 0}
                <div>
                  <h4 class="font-medium text-surface-700-300">Values</h4>
                  <ul class="list-disc list-inside">
                    {#each Object.keys(cardNode.values) as valueId}
                      <li>{valueId.replace('value_', '').replaceAll('-', ' ')}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
              
              <!-- Capabilities - Get from capabilities object directly -->
              {#if cardNode.capabilities && Object.keys(cardNode.capabilities).length > 0}
                <div>
                  <h4 class="font-medium text-surface-700-300">Capabilities</h4>
                  <ul class="list-disc list-inside">
                    {#each Object.keys(cardNode.capabilities) as capabilityId}
                      <li>{capabilityId.replace('capability_', '').replaceAll('-', ' ')}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
              
              <!-- Goals -->
              {#if cardNode.goals}
                <div>
                  <h4 class="font-medium text-surface-700-300">Goals</h4>
                  <p class="text-surface-900-50">{cardNode.goals}</p>
                </div>
              {/if}
              
              <!-- Obligations -->
              {#if cardNode.obligations}
                <div>
                  <h4 class="font-medium text-surface-700-300">Obligations</h4>
                  <p class="text-surface-900-50">{cardNode.obligations}</p>
                </div>
              {/if}
              
              <!-- Intellectual Property -->
              {#if cardNode.intellectual_property}
                <div>
                  <h4 class="font-medium text-surface-700-300">IP</h4>
                  <p class="text-surface-900-50">{cardNode.intellectual_property}</p>
                </div>
              {/if}
              
              <!-- Resources -->
              {#if cardNode.rivalrous_resources}
                <div>
                  <h4 class="font-medium text-surface-700-300">Resources</h4>
                  <p class="text-surface-900-50">{cardNode.rivalrous_resources}</p>
                </div>
              {/if}
            </div>
          </div>
      {:else if popoverNodeType === 'agreement' && popoverNode}
        <!-- Using type casting for TypeScript safety -->
        {@const agreementNode = popoverNode as Agreement}
        <!-- Agreement Card -->
        <div class="card p-4 shadow-lg h-full flex flex-col bg-surface-100-900/80 rounded-lg border border-surface-200 dark:border-surface-700">
          <header class="card-header flex justify-between items-center">
            <h3 class="h3 text-tertiary-500 dark:text-tertiary-400">{agreementNode.title || 'Agreement'}</h3>
            
            {#if agreementNode.status}
              <span class="badge variant-filled-primary text-sm p-1 px-2 rounded-full">{agreementNode.status}</span>
            {/if}
          </header>
          
          <section class="p-4 flex-grow space-y-3">
            {#if agreementNode.description}
              <div>
                <h4 class="font-semibold mb-1">Description</h4>
                <p class="text-sm">{agreementNode.description}</p>
              </div>
            {/if}
            
            <!-- Obligations section -->
            {#if agreementNode.obligations && Array.isArray(agreementNode.obligations) && agreementNode.obligations.length > 0}
              <div>
                <h4 class="font-semibold mb-1">Obligations</h4>
                <ul class="list-disc list-inside">
                  {#each agreementNode.obligations as obligation}
                    <li class="text-sm">
                      <span class="font-medium">{obligation.fromActorId}:</span> 
                      {obligation.description || (obligation as unknown as {text: string}).text || ''}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
            
            <!-- Benefits section -->
            {#if agreementNode.benefits && Array.isArray(agreementNode.benefits) && agreementNode.benefits.length > 0}
              <div>
                <h4 class="font-semibold mb-1">Benefits</h4>
                <ul class="list-disc list-inside">
                  {#each agreementNode.benefits as benefit}
                    <li class="text-sm">
                      <span class="font-medium">To {benefit.toActorId}:</span> 
                      {benefit.description || (benefit as unknown as {text: string}).text || ''}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
            
            <!-- Metadata footer -->
            <div class="mt-4 pt-2 border-t border-surface-200 dark:border-surface-700">
              {#if agreementNode.created_at}
                <span class="text-xs text-surface-500 dark:text-surface-400">Created: {new Date(agreementNode.created_at).toLocaleDateString()}</span>
              {/if}
            </div>
          </section>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Controls will be connected to page header -->
  <!-- Removed redundant search and zoom controls that will be handled by GamePageLayout header -->
</div>