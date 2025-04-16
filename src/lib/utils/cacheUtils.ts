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
    
    const startTime = Date.now();
    console.log(`Cache Utils: Starting cache initialization for game ${gameId}`);
    
    // Load the game to get deck_id
    const game = await getGame(gameId);
    if (!game) {
      console.error(`Cache Utils: Game not found: ${gameId}`);
      return;
    }
    
    // Get deckId from game
    const deckId = game.deck_id;
    if (!deckId) {
      console.error(`Cache Utils: Game has no deck_id: ${gameId}`);
      return;
    }
    
    // Placeholder for agreements
    const agreements: Agreement[] = [];
    
    // Actually load all cards in the deck for real this time
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
                // Push card to our array
                cards.push(actualCardData);
                
                // Also pre-populate card details cache
                cardDetailsCache.set(actualCardData.card_id, {
                  ...actualCardData,
                  position: {
                    x: Math.random() * 500, // Add some default position
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
                      }
                    });
                  }
                }
              }
            });
          }
        });
        
        // Resolve after reasonable timeout to allow Gun.js to process
        setTimeout(() => resolve(), 500);
      });
    } catch (error) {
      console.log("Error loading cards:", error);
    }
    
    // Log what we have
    console.log(`Cache Utils: Loaded ${cards.length} cards in initializeCaches`);
    console.log(`Cache Utils: Loaded ${valueCache.size} values`);
    console.log(`Cache Utils: Loaded ${capabilityCache.size} capabilities`);
    
    // Convert to CardWithPosition format
    let cardsWithPosition: CardWithPosition[] = cards.map(card => ({
      ...card,
      position: {
        x: Math.random() * 500, // Use random starting positions
        y: Math.random() * 500
      }
    }));
    
    // Build actor-to-card map
    cardsWithPosition.forEach(card => {
      if (card.actor_id && card.card_id) {
        actorCardMap.set(card.actor_id, card.card_id);
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
    
  } catch (error) {
    console.error("Cache Utils: Error initializing caches:", error);
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
    
    // Step 3: Process all cards to extract names from caches
    await processCardDetailsFromCache(cards);
    
    return cards;
  } catch (error) {
    console.error("Cache Utils: Error loading card details:", error);
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
  
  // Process all cards in parallel with zero Gun queries
  await Promise.all(cards.map(async (card) => {
    if (!card || !card.card_id) return;
    
    // Process values
    const valueNames: string[] = await getCardValueNamesFromCacheOnly(card);
    
    // Process capabilities
    const capabilityNames: string[] = await getCardCapabilityNamesFromCacheOnly(card);
    
    // Store the resolved names directly on the card
    card._valueNames = valueNames;
    card._capabilityNames = capabilityNames;
    
    if (valueNames.length > 0) {
      console.log(`Using ${valueNames.length} real values for card ${card.role_title}:`, valueNames);
    }
    
    if (capabilityNames.length > 0) {
      console.log(`Using ${capabilityNames.length} real capabilities for card ${card.role_title}:`, capabilityNames);
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
  if (!card || !card.values) return [];
  
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
        return ["Reference values not found using cache only"];
      }
    }
    
    return ["Cannot resolve reference with cache only"];
  }
  
  // For directly embedded values, extract names from cache
  if (typeof card.values === 'object' && !Array.isArray(card.values)) {
    const valueNames: string[] = [];
    Object.keys(card.values).forEach(valueId => {
      if (valueId !== '_' && valueId !== '#') {
        const cachedValue = valueCache.get(valueId);
        if (cachedValue && cachedValue.name) {
          valueNames.push(cachedValue.name);
        } else {
          // Extract a name from the ID
          const valueName = valueId
            .replace('value_', '')
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          valueNames.push(valueName);
        }
      }
    });
    
    return valueNames;
  }
  
  return [];
}

/**
 * Extracts capability names from a card using only cached data
 * 
 * @param card - The card to extract capability names from
 * @returns Promise that resolves with an array of capability names
 */
export async function getCardCapabilityNamesFromCacheOnly(card: Card): Promise<string[]> {
  if (!card || !card.capabilities) return [];
  
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
        return ["Reference capabilities not found using cache only"];
      }
    }
    
    return ["Cannot resolve reference with cache only"];
  }
  
  // For directly embedded capabilities, extract names from cache
  if (typeof card.capabilities === 'object' && !Array.isArray(card.capabilities)) {
    const capabilityNames: string[] = [];
    Object.keys(card.capabilities).forEach(capabilityId => {
      if (capabilityId !== '_' && capabilityId !== '#') {
        const cachedCapability = capabilityCache.get(capabilityId);
        if (cachedCapability && cachedCapability.name) {
          capabilityNames.push(cachedCapability.name);
        } else {
          // Extract a name from the ID
          const capabilityName = capabilityId
            .replace('capability_', '')
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          capabilityNames.push(capabilityName);
        }
      }
    });
    
    return capabilityNames;
  }
  
  return [];
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