// Card utility functions - separated to avoid circular dependencies
import { getGun, getCollection, nodes } from './gunService';
import type { Card } from '$lib/types';

/**
 * Generates a sequential card ID based on existing cards in the database
 * This ensures IDs follow the card_XX pattern (card_1, card_2, etc.)
 * @returns Promise with the next sequential card ID
 */
export async function generateSequentialCardId(): Promise<string> {
  const gun = getGun();
  if (!gun) {
    throw new Error("Gun not initialized");
  }

  // Collect only the card IDs whose value is an object
  const existingIds: string[] = [];
  await new Promise<void>((resolve) => {
    gun
      .get(nodes.cards)
      .map()
      .once((val: unknown, id: string) => {
        // Filter out Gun metadata and any primitive leaf (e.g. created_at)
        if (
          id !== "_" &&
          id !== "#" &&
          val !== null &&
          typeof val === "object"
        ) {
          existingIds.push(id);
        }
      });
    // Give Gun a moment to fetch
    setTimeout(resolve, 500);
  });

  // Parse out numeric parts of IDs like "card_7" → 7
  const numbers = existingIds
    .map((id) => {
      const parts = id.split("_");
      const n = parseInt(parts[1], 10);
      return isNaN(n) ? 0 : n;
    })
    .filter((n) => n > 0);

  const max = numbers.length ? Math.max(...numbers) : 0;
  const next = max + 1;
  console.log(`[generateSequentialCardId] Found max card number: ${max}, generating card_${next}`);
  return `card_${next}`;
}

/**
 * Ensures value identifiers are in standardized format
 * All value IDs should be prefixed with 'value_'
 * @param valueId - Original value ID from input data (may be a human-readable value name)
 * @returns Standardized value ID
 */
export function standardizeValueId(valueId: string): string {
  // If it's already in the proper format (starts with 'value_'), return as is
  if (valueId.startsWith('value_')) {
    return valueId;
  }
  
  // Strip any spaces, sanitize and convert to snake case
  const sanitized = valueId.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  console.log(`[standardizeValueId] Converting "${valueId}" to standardized format: value_${sanitized}`);
  return `value_${sanitized}`;
}

/**
 * Ensures capability identifiers are in standardized format
 * All capability IDs should be prefixed with 'cap_' to match sample data
 * @param capabilityName - Original capability name from input data
 * @returns Standardized capability ID
 */
export function standardizeCapabilityId(capabilityName: string): string {
  // If it's already in the proper format (starts with 'cap_'), return as is
  if (capabilityName.startsWith('cap_')) {
    return capabilityName;
  }
  
  // If it starts with 'capability_', convert it to 'cap_'
  if (capabilityName.startsWith('capability_')) {
    const withoutPrefix = capabilityName.replace('capability_', '');
    return `cap_${withoutPrefix}`;
  }
  
  // Strip any spaces, sanitize and convert to snake case
  const sanitized = capabilityName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  console.log(`[standardizeCapabilityId] Converting "${capabilityName}" to standardized format: cap_${sanitized}`);
  return `cap_${sanitized}`;
}