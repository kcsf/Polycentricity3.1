import { getGun, nodes } from './gunService';

// Define types if not already available in the project
interface Card {
  id?: string;
  role_title?: string;
  description?: string;
  values?: Record<string, boolean> | string[];
  capabilities?: Record<string, boolean> | string[];
  created_at?: number;
  updated_at?: number;
  [key: string]: any;
}

interface Value {
  id?: string;
  name: string;
  description?: string;
  created_at?: number;
  updated_at?: number;
}

interface Capability {
  id?: string;
  name: string;
  description?: string;
  created_at?: number;
  updated_at?: number;
}

/**
 * Validates card-value relationships and logs issues
 * @returns Promise resolving to an object with results
 */
export async function validateCardValueRelationships(): Promise<{
  scanned: number;
  issues: number;
  details: Array<{cardId: string; issue: string}>;
}> {
  const gun = getGun();
  const result = {
    scanned: 0,
    issues: 0,
    details: [] as Array<{cardId: string; issue: string}>
  };
  
  if (!gun) {
    console.error('Gun not initialized');
    return result;
  }
  
  return new Promise((resolve) => {
    // Collect all values for lookup
    const valueMap: Record<string, Value> = {};
    const valuePromise = new Promise<void>((resolveValues) => {
      gun.get(nodes.values).map().once((value: Value, valueId: string) => {
        if (value && value.name) {
          valueMap[valueId] = value;
        }
      });
      
      // Give time for values to load
      setTimeout(resolveValues, 500);
    });
    
    // Once values are collected, check all cards
    valuePromise.then(() => {
      console.log(`Loaded ${Object.keys(valueMap).length} values for validation`);
      
      const cardPromise = new Promise<void>((resolveCards) => {
        gun.get(nodes.cards).map().once((card: Card, cardId: string) => {
          result.scanned++;
          
          // Check values on this card
          if (card && card.values) {
            // Case 1: Card has values object with key-value pairs (correct format)
            if (typeof card.values === 'object' && !Array.isArray(card.values)) {
              // Check if any referenced value doesn't exist
              const valuesObj = card.values as Record<string, boolean>;
              Object.keys(valuesObj).forEach(valueId => {
                if (valuesObj[valueId] === true && !valueMap[valueId]) {
                  result.issues++;
                  result.details.push({
                    cardId,
                    issue: `Card references value ${valueId} which doesn't exist`
                  });
                }
              });
            }
            // Case 2: Card has values as array (incorrect format)
            else if (Array.isArray(card.values)) {
              result.issues++;
              result.details.push({
                cardId,
                issue: `Card has values as array instead of object: ${JSON.stringify(card.values)}`
              });
            }
            // Case 3: Other invalid values format
            else if (card.values !== null && typeof card.values !== 'object') {
              result.issues++;
              result.details.push({
                cardId,
                issue: `Card has invalid values format: ${typeof card.values}`
              });
            }
          }
        });
        
        // Give time for cards to load
        setTimeout(resolveCards, 1000);
      });
      
      // Finalize results
      cardPromise.then(() => {
        console.log(`Validated ${result.scanned} cards, found ${result.issues} issues`);
        resolve(result);
      });
    });
  });
}

/**
 * Validate that all referenced values and capabilities exist
 */
export async function validateAllRelationships(): Promise<{
  values: {valid: number; invalid: number; details: string[]};
  capabilities: {valid: number; invalid: number; details: string[]};
}> {
  const gun = getGun();
  const result = {
    values: {valid: 0, invalid: 0, details: []},
    capabilities: {valid: 0, invalid: 0, details: []}
  };
  
  if (!gun) {
    console.error('Gun not initialized');
    return result;
  }
  
  // Collect all entities for validation
  const valueMap: Record<string, boolean> = {};
  const capabilityMap: Record<string, boolean> = {};
  
  // Load all values
  await new Promise<void>((resolve) => {
    gun.get(nodes.values).map().once((value: Value, valueId: string) => {
      if (value) {
        valueMap[valueId] = true;
      }
    });
    
    setTimeout(resolve, 500);
  });
  
  // Load all capabilities
  await new Promise<void>((resolve) => {
    gun.get(nodes.capabilities).map().once((capability: Capability, capabilityId: string) => {
      if (capability) {
        capabilityMap[capabilityId] = true;
      }
    });
    
    setTimeout(resolve, 500);
  });
  
  // Check all cards
  await new Promise<void>((resolve) => {
    gun.get(nodes.cards).map().once((card: Card, cardId: string) => {
      // Check values
      if (card && card.values && typeof card.values === 'object' && !Array.isArray(card.values)) {
        const valuesObj = card.values as Record<string, boolean>;
        Object.keys(valuesObj).forEach(valueId => {
          if (valuesObj[valueId] === true) {
            if (valueMap[valueId]) {
              result.values.valid++;
            } else {
              result.values.invalid++;
              result.values.details.push(`Card ${cardId} references missing value ${valueId}`);
            }
          }
        });
      }
      
      // Check capabilities
      if (card && card.capabilities && typeof card.capabilities === 'object' && !Array.isArray(card.capabilities)) {
        const capabilitiesObj = card.capabilities as Record<string, boolean>;
        Object.keys(capabilitiesObj).forEach(capabilityId => {
          if (capabilitiesObj[capabilityId] === true) {
            if (capabilityMap[capabilityId]) {
              result.capabilities.valid++;
            } else {
              result.capabilities.invalid++;
              result.capabilities.details.push(`Card ${cardId} references missing capability ${capabilityId}`);
            }
          }
        });
      }
    });
    
    setTimeout(resolve, 1000);
  });
  
  return result;
}

/**
 * Check for cards with array-style values and convert them to proper Gun.js format
 */
export async function fixCardValueArrays(): Promise<{
  scanned: number;
  fixed: number;
  details: string[];
}> {
  const gun = getGun();
  const result = {
    scanned: 0,
    fixed: 0,
    details: [] as string[]
  };
  
  if (!gun) {
    console.error('Gun not initialized');
    return result;
  }
  
  // Load all values for lookup by name
  const valuesByName: Record<string, string> = {};
  await new Promise<void>((resolve) => {
    gun.get(nodes.values).map().once((value: Value, valueId: string) => {
      if (value && value.name) {
        valuesByName[value.name.toLowerCase()] = valueId;
      }
    });
    
    setTimeout(resolve, 500);
  });
  
  // Find and fix cards with array-style values
  return new Promise((resolve) => {
    gun.get(nodes.cards).map().once(async (card: Card, cardId: string) => {
      result.scanned++;
      
      // Check if values is an array
      if (card && card.values && Array.isArray(card.values)) {
        try {
          // Convert array values to Gun.js object format
          const valueObject: Record<string, boolean> = {};
          
          for (const valueName of card.values) {
            if (typeof valueName === 'string') {
              const valueId = valuesByName[valueName.toLowerCase()];
              
              if (valueId) {
                valueObject[valueId] = true;
              } else {
                console.warn(`Could not find value ID for "${valueName}" on card ${cardId}`);
              }
            }
          }
          
          // Only update if we found at least one valid value
          if (Object.keys(valueObject).length > 0) {
            // Update the card with the new values object
            await new Promise<void>((resolveUpdate) => {
              gun.get(nodes.cards).get(cardId).get('values').put(valueObject, (ack: any) => {
                if (ack.err) {
                  console.error(`Failed to update card ${cardId} values:`, ack.err);
                  result.details.push(`Failed to fix card ${cardId}: ${ack.err}`);
                } else {
                  result.fixed++;
                  result.details.push(`Fixed card ${cardId}, converted ${card.values!.length} values to object format`);
                }
                resolveUpdate();
              });
            });
          }
        } catch (err) {
          console.error(`Error fixing card ${cardId}:`, err);
          result.details.push(`Error with card ${cardId}: ${err}`);
        }
      }
    });
    
    // Give enough time for all operations to complete
    setTimeout(() => resolve(result), 5000);
  });
}