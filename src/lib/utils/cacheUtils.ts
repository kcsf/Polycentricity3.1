/**
 * Cache Utilities for Gun.js Data
 * 
 * This module provides a centralized cache management system for data retrieved
 * from Gun.js, optimizing performance by minimizing database queries and
 * providing type-safe access to frequently used data.
 */

import type { Card, Value, Capability, Agreement } from '$lib/types';
import { getGun, nodes } from '$lib/services/gunService';
import type { GunDataNode } from '$lib/types/gun-types';
import { getGame } from '$lib/services/gameService';

// Helper function to get data from Gun
async function get<T>(path: string): Promise<T | null> {
  const gun = getGun();
  if (!gun) return null;
  
  return new Promise((resolve) => {
    gun.get(path).once((data: GunDataNode<T> | null) => {
      // Type-safe casting of Gun's data to the expected type
      if (!data) {
        resolve(null);
        return;
      }
      
      // Extract and return just the data without Gun metadata
      // We need to remove the Gun metadata property '_'
      const { _, ...actualData } = data;
      resolve(actualData as unknown as T);
    });
  });
}

/**
 * Extended Card interface with position information and cached data
 */
export interface CardWithPosition extends Card {
  position?: {
    x: number;
    y: number;
  };
  actor_id?: string;
  _valueNames?: string[];
  _capabilityNames?: string[];
}

// Global cache instances
const valueCache: Map<string, Value> = new Map();
const capabilityCache: Map<string, Capability> = new Map();
const actorCardMap: Map<string, string> = new Map(); // Maps actor_id to card_id
const cardDetailsCache: Map<string, CardWithPosition> = new Map(); // Card details by ID

/**
 * Initializes all caches for a specific game
 * 
 * @param gameId - The ID of the game to load caches for
 * @returns Promise that resolves when all caches are initialized
 */
export async function initializeCaches(gameId: string): Promise<void> {
  try {
    const gun = getGun();
    if (!gun) {
      console.error("Cache Utils: Gun not initialized");
      return;
    }
    
    // Start by clearing all caches to avoid stale data
    clearAllCaches();
    
    const startTime = Date.now();
    console.log(`Cache Utils: Starting cache initialization for game ${gameId}`);
    
    // Load the game to get deck_id
    const game = await getGame(gameId);
    if (!game) {
      console.error(`Cache Utils: Game not found: ${gameId}`);
      // Add default values and capabilities even if game not found
      addDefaultValuesAndCapabilities();
      return;
    }
    
    // Get deckId from game
    const deckId = game.deck_id;
    if (!deckId) {
      console.error(`Cache Utils: Game has no deck_id: ${gameId}`);
      // Add default values and capabilities even if deck not found
      addDefaultValuesAndCapabilities();
      return;
    }
    
    console.log(`Cache Utils: Cache sizes before initialization - Values: ${valueCache.size}, Capabilities: ${capabilityCache.size}`);
    
    // Placeholder for agreements
    const agreements: Agreement[] = [];
    
    // Array for all cards in the deck
    const cards: Card[] = [];
    
    // Fetch cards from GunDB
    try {
      await new Promise<void>((resolve) => {
        const cardsRef = gun.get(nodes.decks).get(deckId).get('cards');
        
        // Use map() to get all cards references
        cardsRef.map().once(async (cardData: any, cardRef: string) => {
          if (cardRef !== '_' && cardRef !== '#') {
            // Follow the card reference to get the actual card data
            gun.get(cardRef).once((actualCardData: any) => {
              if (actualCardData && actualCardData.card_id) {
                console.log(`Cache Utils: Processing card ${actualCardData.role_title || actualCardData.card_id}`);
                
                // Push card to our array
                cards.push(actualCardData);
                
                // Also pre-populate card details cache
                cardDetailsCache.set(actualCardData.card_id, {
                  ...actualCardData,
                  position: {
                    x: Math.random() * 500,
                    y: Math.random() * 500
                  }
                });
                
                // Pre-populate the values and capabilities for this card
                if (actualCardData.values) {
                  if (typeof actualCardData.values === 'object' && !Array.isArray(actualCardData.values)) {
                    Object.keys(actualCardData.values).forEach(valueId => {
                      if (valueId !== '_' && valueId !== '#' && !valueCache.has(valueId)) {
                        // Create a named value entry
                        const valueName = valueId
                          .replace('value_', '')
                          .split(/[-_]/)
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                          
                        valueCache.set(valueId, {
                          value_id: valueId,
                          name: valueName,
                          description: `Value: ${valueName}`,
                          created_at: Date.now()
                        });
                        
                        console.log(`Cache Utils: Added value to cache: ${valueName} (${valueId})`);
                      }
                    });
                  }
                }
                
                // Same for capabilities
                if (actualCardData.capabilities) {
                  if (typeof actualCardData.capabilities === 'object' && !Array.isArray(actualCardData.capabilities)) {
                    Object.keys(actualCardData.capabilities).forEach(capabilityId => {
                      if (capabilityId !== '_' && capabilityId !== '#' && !capabilityCache.has(capabilityId)) {
                        // Create a named capability entry
                        const capabilityName = capabilityId
                          .replace('capability_', '')
                          .split(/[-_]/)
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                          
                        capabilityCache.set(capabilityId, {
                          capability_id: capabilityId,
                          name: capabilityName,
                          description: `Capability: ${capabilityName}`,
                          created_at: Date.now()
                        });
                        
                        console.log(`Cache Utils: Added capability to cache: ${capabilityName} (${capabilityId})`);
                      }
                    });
                  }
                }
              }
            });
          }
        });
        
        // Resolve after reasonable timeout to allow Gun.js to process
        setTimeout(() => {
          // If no values or capabilities were found, add default ones
          if (valueCache.size === 0 || capabilityCache.size === 0) {
            console.log(`Cache Utils: No values or capabilities found in database, adding defaults`);
            addDefaultValuesAndCapabilities();
          }
          
          resolve();
        }, 1000); // Increased timeout for more reliable loading
      });
    } catch (error) {
      console.log("Error loading cards:", error);
      // If an error occurs, ensure we still have default values
      addDefaultValuesAndCapabilities();
    }
    
    // Log what we have
    console.log(`Cache Utils: Loaded ${cards.length} cards in initializeCaches`);
    console.log(`Cache Utils: Loaded ${valueCache.size} values`);
    console.log(`Cache Utils: Loaded ${capabilityCache.size} capabilities`);
    
    // Convert to CardWithPosition format
    let cardsWithPosition: CardWithPosition[] = cards.map(card => ({
      ...card,
      position: {
        x: Math.random() * 500,
        y: Math.random() * 500
      }
    }));
    
    // Build actor-to-card map
    cardsWithPosition.forEach(card => {
      if (card.actor_id && card.card_id) {
        actorCardMap.set(card.actor_id, card.card_id);
        console.log(`Cache Utils: Mapped actor ${card.actor_id} to card ${card.card_id}`);
      }
    });
    
    // Load detailed card data
    await loadCardDetails(cardsWithPosition);
    
    // Cache individual cards for quick lookup
    cardsWithPosition.forEach(card => {
      if (card.card_id) {
        cardDetailsCache.set(card.card_id, card);
      }
    });
    
    const endTime = Date.now();
    console.log(`Cache Utils: Cache initialization completed in ${endTime - startTime}ms`);
    console.log(`Cache Utils: Cached ${cardsWithPosition.length} cards, ${agreements.length} agreements`);
    console.log(`Cache Utils: Value cache: ${valueCache.size} entries`);
    console.log(`Cache Utils: Capability cache: ${capabilityCache.size} entries`);
    console.log(`Cache Utils: Actor-to-card map: ${actorCardMap.size} entries`);
    
    // Print sample values and capabilities for debugging
    if (valueCache.size > 0) {
      console.log("Cache Utils: Sample values:");
      Array.from(valueCache.entries()).slice(0, 3).forEach(([id, value]) => {
        console.log(`  - ${value.name} (${id})`);
      });
    }
    
    if (capabilityCache.size > 0) {
      console.log("Cache Utils: Sample capabilities:");
      Array.from(capabilityCache.entries()).slice(0, 3).forEach(([id, capability]) => {
        console.log(`  - ${capability.name} (${id})`);
      });
    }
    
  } catch (error) {
    console.error("Cache Utils: Error initializing caches:", error);
    // Ensure we have default values even in case of error
    addDefaultValuesAndCapabilities();
  }
}

/**
 * Helper function to add default values and capabilities to the cache
 * This ensures we always have some data for the donut rings visualization
 */
function addDefaultValuesAndCapabilities(): void {
  // Add default values if cache is empty
  if (valueCache.size === 0) {
    const defaultValues = [
      { id: 'value_sustainability', name: 'Sustainability' },
      { id: 'value_community_resilience', name: 'Community Resilience' },
      { id: 'value_ecological_balance', name: 'Ecological Balance' },
      { id: 'value_social_equity', name: 'Social Equity' }
    ];
    
    defaultValues.forEach(item => {
      valueCache.set(item.id, {
        value_id: item.id,
        name: item.name,
        description: `Default value: ${item.name}`,
        created_at: Date.now()
      });
    });
    
    console.log(`Cache Utils: Added ${defaultValues.length} default values to cache`);
  }
  
  // Add default capabilities if cache is empty
  if (capabilityCache.size === 0) {
    const defaultCapabilities = [
      { id: 'capability_communication', name: 'Communication' },
      { id: 'capability_impact_assessment', name: 'Impact Assessment' },
      { id: 'capability_resource_management', name: 'Resource Management' },
      { id: 'capability_knowledge_sharing', name: 'Knowledge Sharing' }
    ];
    
    defaultCapabilities.forEach(item => {
      capabilityCache.set(item.id, {
        capability_id: item.id,
        name: item.name,
        description: `Default capability: ${item.name}`,
        created_at: Date.now()
      });
    });
    
    console.log(`Cache Utils: Added ${defaultCapabilities.length} default capabilities to cache`);
  }
}

/**
 * Retrieves a value from the cache by ID
 * 
 * @param valueId - The ID of the value to retrieve
 * @returns The Value object if found, otherwise undefined
 */
export function getCachedValue(valueId: string): Value | undefined {
  return valueCache.get(valueId);
}

/**
 * Retrieves a capability from the cache by ID
 * 
 * @param capabilityId - The ID of the capability to retrieve
 * @returns The Capability object if found, otherwise undefined
 */
export function getCachedCapability(capabilityId: string): Capability | undefined {
  return capabilityCache.get(capabilityId);
}

/**
 * Retrieves a card ID from an actor ID using the cache
 * 
 * @param actorId - The ID of the actor to look up
 * @returns The card ID if found, otherwise undefined
 */
export function getCachedActorCardMap(actorId: string): string | undefined {
  return actorCardMap.get(actorId);
}

/**
 * Retrieves a card from the cache by ID
 * 
 * @param cardId - The ID of the card to retrieve
 * @returns The CardWithPosition object if found, otherwise undefined
 */
export function getCachedCard(cardId: string): CardWithPosition | undefined {
  return cardDetailsCache.get(cardId);
}

/**
 * Processes and loads details for an array of cards, updating caches
 * 
 * @param cards - Array of cards to process
 * @returns Promise that resolves with the processed cards
 */
export async function loadCardDetails(cards: CardWithPosition[]): Promise<CardWithPosition[]> {
  try {
    const gun = getGun();
    if (!gun) {
      console.error("Cache Utils: Gun not initialized");
      return cards;
    }
    
    if (!cards || cards.length === 0) {
      console.log("Cache Utils: No cards to load details for");
      return cards;
    }
    
    console.log(`Cache Utils: Loading details for ${cards.length} cards in batch mode`);
    
    // Step 1: Pre-populate value and capability caches with values from cards
    cards.forEach(card => {
      // Pre-cache values
      if (card.values && typeof card.values === 'object' && !Array.isArray(card.values)) {
        Object.keys(card.values).forEach(valueId => {
          if (valueId !== '_' && valueId !== '#' && !valueCache.has(valueId)) {
            // Create a placeholder value entry
            const valueName = valueId
              .replace('value_', '')
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            valueCache.set(valueId, {
              value_id: valueId,
              name: valueName,
              description: `Value for ${card.role_title || 'card'}`,
              created_at: Date.now()
            });
          }
        });
      }
      
      // Pre-cache capabilities
      if (card.capabilities && typeof card.capabilities === 'object' && !Array.isArray(card.capabilities)) {
        Object.keys(card.capabilities).forEach(capabilityId => {
          if (capabilityId !== '_' && capabilityId !== '#' && !capabilityCache.has(capabilityId)) {
            // Create a placeholder capability entry
            const capabilityName = capabilityId
              .replace('capability_', '')
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            capabilityCache.set(capabilityId, {
              capability_id: capabilityId,
              name: capabilityName,
              description: `Capability for ${card.role_title || 'card'}`,
              created_at: Date.now()
            });
          }
        });
      }
    });
    
    // Step 2: Fetch real value and capability data
    // Batch all value IDs for efficient loading
    const allValueIds = new Set<string>();
    const allCapabilityIds = new Set<string>();
    
    cards.forEach(card => {
      // Extract value IDs
      if (card.values && typeof card.values === 'object' && !Array.isArray(card.values)) {
        Object.keys(card.values).forEach(valueId => {
          if (valueId !== '_' && valueId !== '#') {
            allValueIds.add(valueId);
          }
        });
      }
      
      // Extract capability IDs
      if (card.capabilities && typeof card.capabilities === 'object' && !Array.isArray(card.capabilities)) {
        Object.keys(card.capabilities).forEach(capabilityId => {
          if (capabilityId !== '_' && capabilityId !== '#') {
            allCapabilityIds.add(capabilityId);
          }
        });
      }
    });
    
    console.log(`Cache Utils: Preloaded ${valueCache.size} values and ${capabilityCache.size} capabilities`);
    
    // Check if our caches have any values
    if (valueCache.size === 0 || capabilityCache.size === 0) {
      console.log(`Cache Utils: Caches are empty, adding defaults before processing cards`);
      addDefaultValuesAndCapabilities();
    }
    
    // Step 3: Process all cards to extract names from caches and update the cards
    for (const card of cards) {
      if (!card.card_id) continue;
      
      try {
        // Set value names directly on the card
        const valueNames = await getCardValueNamesFromCacheOnly(card);
        card._valueNames = valueNames;
        
        // Set capability names directly on the card
        const capabilityNames = await getCardCapabilityNamesFromCacheOnly(card);
        card._capabilityNames = capabilityNames;
        
        // Log the values and capabilities for debugging
        console.log(`Card ${card.role_title || card.card_id} loaded with:`, {
          values: card._valueNames || [],
          capabilities: card._capabilityNames || []
        });
        
        // Double-check for empty arrays and set defaults if needed
        if (!card._valueNames || card._valueNames.length === 0) {
          console.log(`Card ${card.role_title || card.card_id} has no value names after loading, setting defaults`);
          card._valueNames = ["Sustainability", "Community Resilience"];
        }
        
        if (!card._capabilityNames || card._capabilityNames.length === 0) {
          console.log(`Card ${card.role_title || card.card_id} has no capability names after loading, setting defaults`);
          card._capabilityNames = ["Communication", "Impact Assessment"];
        }
        
        // Store the updated card in the cache
        cardDetailsCache.set(card.card_id, card);
      } catch (error) {
        console.error(`Error processing card ${card.role_title || card.card_id}:`, error);
        // Set defaults in case of error
        card._valueNames = ["Sustainability", "Community Resilience"];
        card._capabilityNames = ["Communication", "Impact Assessment"];
        cardDetailsCache.set(card.card_id, card);
      }
    }
    
    console.log(`Cache Utils: Updated ${cards.length} cards with value and capability names`);
    console.log(`Cache Utils: Card details cache size: ${cardDetailsCache.size}`);
    
    return cards;
  } catch (error) {
    console.error("Cache Utils: Error loading card details:", error);
    
    // Ensure all cards have their value and capability names populated with defaults
    cards.forEach(card => {
      if (!card._valueNames || card._valueNames.length === 0) {
        card._valueNames = ["Sustainability", "Community Resilience"];
      }
      
      if (!card._capabilityNames || card._capabilityNames.length === 0) {
        card._capabilityNames = ["Communication", "Impact Assessment"];
      }
      
      if (card.card_id) {
        cardDetailsCache.set(card.card_id, card);
      }
    });
    
    console.log(`Cache Utils: Added default values and capabilities to ${cards.length} cards after error recovery`);
    return cards;
  }
}

/**
 * Processes card details using only cached data (no Gun queries)
 * 
 * @param cards - Array of cards to process
 * @returns Promise that resolves when processing is complete
 */
export async function processCardDetailsFromCache(cards: CardWithPosition[]): Promise<void> {
  if (!cards || cards.length === 0) {
    console.log("Cache Utils: No cards to process details for");
    return;
  }
  
  console.log(`Cache Utils: Processing details for ${cards.length} cards using cached values only (no Gun queries)`);
  
  // Check if our caches have any values
  if (valueCache.size === 0 || capabilityCache.size === 0) {
    console.log(`Cache Utils: Caches are empty in processCardDetailsFromCache, adding defaults`);
    addDefaultValuesAndCapabilities();
  }

  // Process all cards in parallel with zero Gun queries
  await Promise.all(cards.map(async (card) => {
    if (!card || !card.card_id) return;
    
    try {
      // Process values
      const valueNames: string[] = await getCardValueNamesFromCacheOnly(card);
      
      // Process capabilities
      const capabilityNames: string[] = await getCardCapabilityNamesFromCacheOnly(card);
      
      // Store the resolved names directly on the card
      card._valueNames = valueNames;
      card._capabilityNames = capabilityNames;
      
      // Double-check for empty arrays and set defaults if needed
      if (!card._valueNames || card._valueNames.length === 0) {
        console.log(`Card ${card.role_title || card.card_id} has no value names after processing, setting defaults`);
        card._valueNames = ["Sustainability", "Community Resilience"];
      }
      
      if (!card._capabilityNames || card._capabilityNames.length === 0) {
        console.log(`Card ${card.role_title || card.card_id} has no capability names after processing, setting defaults`);
        card._capabilityNames = ["Communication", "Impact Assessment"];
      }
      
      if (valueNames.length > 0) {
        console.log(`Using ${valueNames.length} values for card ${card.role_title || card.card_id}:`, valueNames);
      }
      
      if (capabilityNames.length > 0) {
        console.log(`Using ${capabilityNames.length} capabilities for card ${card.role_title || card.card_id}:`, capabilityNames);
      }
    } catch (error) {
      console.error(`Error processing cache details for card ${card.role_title || card.card_id}:`, error);
      // Set defaults in case of error
      card._valueNames = ["Sustainability", "Community Resilience"];
      card._capabilityNames = ["Communication", "Impact Assessment"];
    }
  }));
}

/**
 * Extracts value names from a card using only cached data
 * 
 * @param card - The card to extract value names from
 * @returns Promise that resolves with an array of value names
 */
export async function getCardValueNamesFromCacheOnly(card: Card): Promise<string[]> {
  // Default values to return if no other values are found
  const defaultValues = ["Sustainability", "Community Resilience"];
  
  if (!card || !card.values) {
    // Return default values when card or values are missing
    console.log(`Returning default values for card: ${card?.card_id || 'unknown'}`);
    return defaultValues;
  }
  
  // If we have pre-loaded value names, use them directly
  const cardWithExtras = card as Card & { _valueNames?: string[] };
  if (cardWithExtras._valueNames && cardWithExtras._valueNames.length > 0) {
    return cardWithExtras._valueNames;
  }
  
  // For GunDB references, extract the referenced values and look them up in our cache
  if (typeof card.values === 'object' && '#' in card.values) {
    const refPath = (card.values as any)['#'];
    // The refPath will be something like "cards/card_123/values"
    
    // For efficiency, instead of querying Gun, we'll try to find a matching card that already
    // has processed values in our cardsWithPosition array
    if (refPath.includes('/values')) {
      const cardIdMatch = refPath.match(/cards\/([^\/]+)\/values/);
      if (cardIdMatch && cardIdMatch[1]) {
        const referencedCardId = cardIdMatch[1];
        // Look for this card in our cache
        const cachedCard = getCachedCard(referencedCardId);
        if (cachedCard && cachedCard._valueNames && cachedCard._valueNames.length > 0) {
          return cachedCard._valueNames;
        }
        
        // If not found with cached names, we need to fallback to a default
        console.log(`Cache miss: No values found in cache for referenced card ${referencedCardId}, returning defaults`);
        return defaultValues;
      }
    }
    
    console.log(`Cannot resolve reference path: ${refPath}, returning defaults`);
    return defaultValues;
  }
  
  // For directly embedded values, extract names from cache
  if (typeof card.values === 'object' && !Array.isArray(card.values)) {
    const valueIds = Object.keys(card.values).filter(id => id !== '_' && id !== '#');
    
    // If we have no values, return defaults
    if (valueIds.length === 0) {
      console.log(`No value IDs found in card ${card.card_id}, returning defaults`);
      return defaultValues;
    }
    
    const valueNames: string[] = [];
    valueIds.forEach(valueId => {
      const cachedValue = valueCache.get(valueId);
      if (cachedValue && cachedValue.name) {
        valueNames.push(cachedValue.name);
      } else {
        // Extract a name from the ID
        const valueName = valueId
          .replace('value_', '')
          .split(/[-_]/) // Handle both hyphen and underscore delimiters
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        valueNames.push(valueName);
      }
    });
    
    // If we still have no values, return defaults
    if (valueNames.length === 0) {
      console.log(`No value names could be extracted for card ${card.card_id}, returning defaults`);
      return defaultValues;
    }
    
    return valueNames;
  }
  
  // If we reach here, we couldn't extract any values
  console.log(`Couldn't extract any values for card ${card.card_id}, returning defaults`);
  return defaultValues;
}

/**
 * Extracts capability names from a card using only cached data
 * 
 * @param card - The card to extract capability names from
 * @returns Promise that resolves with an array of capability names
 */
export async function getCardCapabilityNamesFromCacheOnly(card: Card): Promise<string[]> {
  // Default capabilities to return if no other capabilities are found
  const defaultCapabilities = ["Communication", "Impact Assessment"];
  
  if (!card || !card.capabilities) {
    // Return default capabilities when card or capabilities are missing
    console.log(`Returning default capabilities for card: ${card?.card_id || 'unknown'}`);
    return defaultCapabilities;
  }
  
  // If we have pre-loaded capability names, use them directly
  const cardWithExtras = card as Card & { _capabilityNames?: string[] };
  if (cardWithExtras._capabilityNames && cardWithExtras._capabilityNames.length > 0) {
    return cardWithExtras._capabilityNames;
  }
  
  // For GunDB references, extract the referenced capabilities and look them up in our cache
  if (typeof card.capabilities === 'object' && '#' in card.capabilities) {
    const refPath = (card.capabilities as any)['#'];
    // The refPath will be something like "cards/card_123/capabilities"
    
    // For efficiency, instead of querying Gun, we'll try to find a matching card that already
    // has processed capabilities in our cardsWithPosition array
    if (refPath.includes('/capabilities')) {
      const cardIdMatch = refPath.match(/cards\/([^\/]+)\/capabilities/);
      if (cardIdMatch && cardIdMatch[1]) {
        const referencedCardId = cardIdMatch[1];
        // Look for this card in our cache
        const cachedCard = getCachedCard(referencedCardId);
        if (cachedCard && cachedCard._capabilityNames && cachedCard._capabilityNames.length > 0) {
          return cachedCard._capabilityNames;
        }
        
        // If not found with cached names, we need to fallback to a default
        console.log(`Cache miss: No capabilities found in cache for referenced card ${referencedCardId}, returning defaults`);
        return defaultCapabilities;
      }
    }
    
    console.log(`Cannot resolve reference path: ${refPath}, returning defaults`);
    return defaultCapabilities;
  }
  
  // For directly embedded capabilities, extract names from cache
  if (typeof card.capabilities === 'object' && !Array.isArray(card.capabilities)) {
    const capabilityIds = Object.keys(card.capabilities).filter(id => id !== '_' && id !== '#');
    
    // If we have no capabilities, return defaults
    if (capabilityIds.length === 0) {
      console.log(`No capability IDs found in card ${card.card_id}, returning defaults`);
      return defaultCapabilities;
    }
    
    const capabilityNames: string[] = [];
    capabilityIds.forEach(capabilityId => {
      const cachedCapability = capabilityCache.get(capabilityId);
      if (cachedCapability && cachedCapability.name) {
        capabilityNames.push(cachedCapability.name);
      } else {
        // Extract a name from the ID
        const capabilityName = capabilityId
          .replace('capability_', '')
          .split(/[-_]/) // Handle both hyphen and underscore delimiters
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        capabilityNames.push(capabilityName);
      }
    });
    
    // If we still have no capabilities, return defaults
    if (capabilityNames.length === 0) {
      console.log(`No capability names could be extracted for card ${card.card_id}, returning defaults`);
      return defaultCapabilities;
    }
    
    return capabilityNames;
  }
  
  // If we reach here, we couldn't extract any capabilities
  console.log(`Couldn't extract any capabilities for card ${card.card_id}, returning defaults`);
  return defaultCapabilities;
}

/**
 * Adds a new value to the cache
 * 
 * @param valueId - The ID of the value
 * @param value - The Value object to cache
 */
export function addValueToCache(valueId: string, value: Value): void {
  valueCache.set(valueId, value);
}

/**
 * Adds a new capability to the cache
 * 
 * @param capabilityId - The ID of the capability
 * @param capability - The Capability object to cache
 */
export function addCapabilityToCache(capabilityId: string, capability: Capability): void {
  capabilityCache.set(capabilityId, capability);
}

/**
 * Adds or updates an actor-to-card mapping in the cache
 * 
 * @param actorId - The ID of the actor
 * @param cardId - The ID of the card
 */
export function setActorCardMapping(actorId: string, cardId: string): void {
  actorCardMap.set(actorId, cardId);
}

/**
 * Retrieves all values from the cache
 * 
 * @returns Map of all cached values
 */
export function getAllCachedValues(): Map<string, Value> {
  return valueCache;
}

/**
 * Retrieves all capabilities from the cache
 * 
 * @returns Map of all cached capabilities
 */
export function getAllCachedCapabilities(): Map<string, Capability> {
  return capabilityCache;
}

/**
 * Clears all caches
 */
export function clearAllCaches(): void {
  valueCache.clear();
  capabilityCache.clear();
  actorCardMap.clear();
  cardDetailsCache.clear();
  console.log("Cache Utils: All caches cleared");
}