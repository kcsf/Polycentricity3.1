// Value management service
import {
    getGun,
    nodes,
    generateId,
    put,
    get,
    getCollection,
} from "./gunService";
import type { Value, Card } from "$lib/types";

// Create a new value
export async function createValue(name: string): Promise<Value | null> {
    console.log(`[createValue] Processing: ${name}`);
    const gun = getGun();
    if (!gun) {
        console.error("[createValue] Gun not initialized");
        return null;
    }

    const valueId = `value_${name.toLowerCase().replace(/\s+/g, "-")}`;
    const valueData: Value = {
        value_id: valueId,
        name,
        created_at: Date.now(),
    };

    const existing = await get(`${nodes.values}/${valueId}`);
    if (existing?.value_id) {
        console.log(`[createValue] Reusing: ${valueId}`);
        return existing as Value;
    }

    try {
        await put(`${nodes.values}/${valueId}`, valueData);
        console.log(`[createValue] Created: ${valueId}`);
        return valueData;
    } catch (error) {
        console.error("[createValue] Error:", error);
        return null;
    }
}

// Get a value by ID
export async function getValue(valueId: string): Promise<Value | null> {
    console.log(`[getValue] Fetching: ${valueId}`);
    const gun = getGun();
    if (!gun) {
        console.error("[getValue] Gun not initialized");
        return null;
    }

    const valueData = await get(`${nodes.values}/${valueId}`);
    if (!valueData) {
        console.log(`[getValue] Not found: ${valueId}`);
        return null;
    }
    console.log(`[getValue] Found: ${valueId}`);
    return valueData as Value;
}

// Get all values
export async function getAllValues(): Promise<Value[]> {
    console.log("[getAllValues] Fetching all values");
    const values = await getCollection<Value>(nodes.values);
    console.log(`[getAllValues] Found ${values.length} values`);
    return values;
}

// Update a value
export async function updateValue(
    valueId: string,
    updates: Partial<Value>,
): Promise<boolean> {
    console.log(`[updateValue] Updating ${valueId} with`, updates);
    try {
        await put(`${nodes.values}/${valueId}`, updates);
        console.log(`[updateValue] Updated: ${valueId}`);
        return true;
    } catch (error) {
        console.error("[updateValue] Error:", error);
        return false;
    }
}

// Delete a value
export async function deleteValue(valueId: string): Promise<boolean> {
    console.log(`[deleteValue] Deleting ${valueId}`);
    try {
        await put(`${nodes.values}/${valueId}`, null);
        console.log(`[deleteValue] Deleted: ${valueId}`);
        return true;
    } catch (error) {
        console.error("[deleteValue] Error:", error);
        return false;
    }
}

// Create or get values from an array of names
export async function createOrGetValues(
    valueNames: string[],
): Promise<Record<string, boolean>> {
    console.log(`[createOrGetValues] Processing ${valueNames.length} values`);
    const valueMap: Record<string, boolean> = {};

    for (const name of valueNames.filter(Boolean)) {
        const value = await createValue(name.trim());
        if (value) {
            valueMap[value.value_id] = true;
            console.log(`[createOrGetValues] Added: ${value.value_id}`);
        }
    }

    console.log(
        `[createOrGetValues] Processed ${Object.keys(valueMap).length} values`,
    );
    return valueMap;
}

/**
 * Get all value names for a card efficiently using Gun.js references
 * 
 * @param card - The card to get value names for
 * @returns Array of value names
 */
export async function getCardValueNames(card: Card): Promise<string[]> {
    console.log(`[getCardValueNames] Processing values for card: ${card.card_id}`);
    
    try {
        // Early return if no values
        if (!card.values) {
            console.log(`[getCardValueNames] No values found for card: ${card.card_id}`);
            return [];
        }
        
        // Handle different Gun.js reference formats
        let valueIds: string[] = [];
        
        // Check if values is a Gun.js reference (format: {"#": "path"})
        if (typeof card.values === 'object' && '#' in card.values) {
            // It's a reference to a Gun.js node
            const valuesRef = (card.values as any)['#'];
            console.log(`[getCardValueNames] Following values reference: ${valuesRef}`);
            
            try {
                // Get the referenced node data
                const refValues = await get(valuesRef);
                
                if (refValues && typeof refValues === 'object') {
                    // Extract value IDs (keys where value is true)
                    valueIds = Object.keys(refValues)
                        .filter(key => 
                            key !== '_' && 
                            key !== '#' && 
                            (refValues as Record<string, any>)[key] === true
                        );
                    
                    console.log(`[getCardValueNames] Found ${valueIds.length} values from reference:`, valueIds);
                } else {
                    console.log(`[getCardValueNames] Referenced values object not found: ${valuesRef}`);
                }
            } catch (error) {
                console.error(`[getCardValueNames] Error resolving values reference:`, error);
            }
        } else if (typeof card.values === 'object') {
            // It's an inline object with value IDs as keys
            valueIds = Object.keys(card.values as Record<string, boolean>)
                .filter(key => {
                    const value = (card.values as Record<string, any>)[key];
                    return key !== '_' && key !== '#' && value === true;
                });
            
            console.log(`[getCardValueNames] Found ${valueIds.length} inline values:`, valueIds);
        }
        
        // Now resolve the value IDs to actual value names
        const gun = getGun();
        if (!gun) {
            console.error("[getCardValueNames] Gun not initialized");
            return [];
        }
        
        // Create a Map to hold value names as they're resolved (for deduplication)
        const valueNamesMap = new Map<string, string>();
        
        // Process each value ID in parallel
        await Promise.all(valueIds.map(async (valueId) => {
            try {
                // Handle standard value IDs (starting with 'value_')
                if (valueId.startsWith('value_')) {
                    const valueData = await get(`${nodes.values}/${valueId}`);
                    if (valueData?.name) {
                        valueNamesMap.set(valueId, valueData.name);
                        return;
                    }
                }
                
                // Handle hardcoded legacy ID mappings (c1, c2, etc.)
                if (valueId === 'c1') {
                    valueNamesMap.set(valueId, 'Sustainability');
                    return;
                }
                if (valueId === 'c2') {
                    valueNamesMap.set(valueId, 'Community Resilience');
                    return;
                }
                if (valueId === 'c3') {
                    valueNamesMap.set(valueId, 'Regeneration');
                    return;
                }
                if (valueId === 'c4') {
                    valueNamesMap.set(valueId, 'Equity');
                    return;
                }
                
                // For any other format, make a readable name from the ID
                if (valueId.startsWith('value_')) {
                    // Convert value_something-like-this to Something Like This
                    const readable = valueId.replace('value_', '')
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    valueNamesMap.set(valueId, readable);
                } else {
                    // Use the ID directly if no other processing applies
                    valueNamesMap.set(valueId, valueId);
                }
            } catch (error) {
                console.error(`[getCardValueNames] Error processing value ID ${valueId}:`, error);
            }
        }));
        
        // Convert Map values to array and remove duplicates
        const valueNames = [...valueNamesMap.values()];
        console.log(`[getCardValueNames] Final value names for card ${card.card_id}:`, valueNames);
        
        return valueNames;
    } catch (error) {
        console.error(`[getCardValueNames] Error:`, error);
        return [];
    }
}
