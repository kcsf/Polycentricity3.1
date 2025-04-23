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
 * Ensures value identifiers are in standardized format
 * All value IDs should be prefixed with 'value_'
 * @param valueId - Original value ID
 * @returns Standardized value ID
 */
export function standardizeValueId(valueId: string): string {
  // If it's already in the proper format (starts with 'value_'), return as is
  if (valueId.startsWith('value_')) {
    return valueId;
  }
  
  // If it's something else, prefix it with 'value_' and convert to snake case
  console.log(`[standardizeValueId] Converting ID ${valueId} to standardized format`);
  return `value_${valueId.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}