// Card utility functions - separated to avoid circular dependencies
import { getCollection, nodes } from './gunService';
import type { Card } from '$lib/types';

/**
 * Generates a sequential card ID based on existing cards in the database
 * This ensures IDs follow the card_XX pattern (card_1, card_2, etc.)
 * @returns Promise with the next sequential card ID
 */
export async function generateSequentialCardId(): Promise<string> {
  try {
    const cards = await getCollection<Card>(nodes.cards);
    // Find the highest card number from cards with valid IDs (card_NUMBER format)
    const cardNumbers = cards
      .filter(card => /^card_\d+$/.test(card.card_id))
      .map(card => parseInt(card.card_id.replace('card_', '')));
    
    const maxCardNumber = cardNumbers.length > 0 
      ? cardNumbers.reduce((max, num) => Math.max(max, num), 0)
      : 0;
    
    console.log(`[generateSequentialCardId] Found max card number: ${maxCardNumber}, generating card_${maxCardNumber + 1}`);
    // Return the next sequential ID
    return `card_${maxCardNumber + 1}`;
  } catch (err) {
    console.error('[generateSequentialCardId] Error:', err);
    // Fallback to a safe default (large number less likely to conflict)
    const fallbackId = Math.floor(Math.random() * 1000) + 1000;
    console.log(`[generateSequentialCardId] Using fallback ID: card_${fallbackId}`);
    return `card_${fallbackId}`;
  }
}

/**
 * Converts legacy value identifiers to standardized format
 * Maps old identifiers like 'c1', 'c2' to proper 'value_sustainability', etc.
 * @param valueId - Original value ID
 * @returns Standardized value ID
 */
export function standardizeValueId(valueId: string): string {
  // Map of legacy value IDs to standardized format
  const valueIdMap: Record<string, string> = {
    'c1': 'value_sustainability',
    'c2': 'value_community_resilience',
    'c3': 'value_equity',
    'c4': 'value_decentralization',
    'c5': 'value_transparency',
    'c6': 'value_privacy',
    'c7': 'value_community',
    'c8': 'value_innovation',
    'c9': 'value_resilience'
  };
  
  // If it's already in the proper format (starts with 'value_'), return as is
  if (valueId.startsWith('value_')) {
    return valueId;
  }
  
  // If it's a legacy ID that we can map, use the mapping
  if (valueId in valueIdMap) {
    console.log(`[standardizeValueId] Mapping legacy ID ${valueId} to ${valueIdMap[valueId]}`);
    return valueIdMap[valueId];
  }
  
  // If it's something else entirely, prefix it with 'value_' and convert to kebab case
  console.log(`[standardizeValueId] Converting arbitrary ID ${valueId} to standardized format`);
  return `value_${valueId.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}