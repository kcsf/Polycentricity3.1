// Capability management service
import {
    getGun,
    nodes,
    generateId,
    put,
    get,
    getCollection,
} from "./gunService";
import type { Capability, Card } from "$lib/types";

// Create a new capability
export async function createCapability(
    name: string,
): Promise<Capability | null> {
    console.log(`[createCapability] Processing: ${name}`);
    const gun = getGun();
    if (!gun) {
        console.error("[createCapability] Gun not initialized");
        return null;
    }

    const capabilityId = `capability_${name.toLowerCase().replace(/\s+/g, "-")}`;
    const capData: Capability = {
        capability_id: capabilityId,
        name,
        created_at: Date.now(),
    };

    const existing = await get(`${nodes.capabilities}/${capabilityId}`);
    if (existing?.capability_id) {
        console.log(`[createCapability] Reusing: ${capabilityId}`);
        return existing as Capability;
    }

    try {
        await put(`${nodes.capabilities}/${capabilityId}`, capData);
        console.log(`[createCapability] Created: ${capabilityId}`);
        return capData;
    } catch (error) {
        console.error("[createCapability] Error:", error);
        return null;
    }
}

// Get a capability by ID
export async function getCapability(
    capabilityId: string,
): Promise<Capability | null> {
    console.log(`[getCapability] Fetching: ${capabilityId}`);
    const gun = getGun();
    if (!gun) {
        console.error("[getCapability] Gun not initialized");
        return null;
    }

    const capData = await get(`${nodes.capabilities}/${capabilityId}`);
    if (!capData) {
        console.log(`[getCapability] Not found: ${capabilityId}`);
        return null;
    }
    console.log(`[getCapability] Found: ${capabilityId}`);
    return capData as Capability;
}

// Get all capabilities
export async function getAllCapabilities(): Promise<Capability[]> {
    console.log("[getAllCapabilities] Fetching all capabilities");
    const caps = await getCollection<Capability>(nodes.capabilities);
    console.log(`[getAllCapabilities] Found ${caps.length} capabilities`);
    return caps;
}

// Update a capability
export async function updateCapability(
    capabilityId: string,
    updates: Partial<Capability>,
): Promise<boolean> {
    console.log(`[updateCapability] Updating ${capabilityId} with`, updates);
    try {
        await put(`${nodes.capabilities}/${capabilityId}`, updates);
        console.log(`[updateCapability] Updated: ${capabilityId}`);
        return true;
    } catch (error) {
        console.error("[updateCapability] Error:", error);
        return false;
    }
}

// Delete a capability
export async function deleteCapability(capabilityId: string): Promise<boolean> {
    console.log(`[deleteCapability] Deleting ${capabilityId}`);
    try {
        await put(`${nodes.capabilities}/${capabilityId}`, null);
        console.log(`[deleteCapability] Deleted: ${capabilityId}`);
        return true;
    } catch (error) {
        console.error("[deleteCapability] Error:", error);
        return false;
    }
}

// Parse capabilities text into an array
export function parseCapabilitiesText(capabilitiesText: string): string[] {
    return capabilitiesText
        ? capabilitiesText
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
        : [];
}

// Create or get capabilities from a text string
export async function createOrGetCapabilities(
    capabilitiesText: string,
): Promise<Record<string, boolean>> {
    console.log(`[createOrGetCapabilities] Processing: ${capabilitiesText}`);
    const capabilityNames = parseCapabilitiesText(capabilitiesText);
    const capabilityMap: Record<string, boolean> = {};

    for (const name of capabilityNames) {
        const cap = await createCapability(name);
        if (cap) {
            capabilityMap[cap.capability_id] = true;
            console.log(
                `[createOrGetCapabilities] Added: ${cap.capability_id}`,
            );
        }
    }

    console.log(
        `[createOrGetCapabilities] Processed ${Object.keys(capabilityMap).length} capabilities`,
    );
    return capabilityMap;
}

/**
 * Get all capability names for a card efficiently using Gun.js references
 * 
 * @param card - The card to get capability names for
 * @returns Array of capability names
 */
export async function getCardCapabilityNames(card: Card): Promise<string[]> {
    console.log(`[getCardCapabilityNames] Processing capabilities for card: ${card.card_id}`);
    
    try {
        // Early return if no capabilities
        if (!card.capabilities) {
            console.log(`[getCardCapabilityNames] No capabilities found for card: ${card.card_id}`);
            return [];
        }
        
        // Handle different Gun.js reference formats
        let capabilityIds: string[] = [];
        
        // Check if capabilities is a Gun.js reference (format: {"#": "path"})
        if (typeof card.capabilities === 'object' && '#' in card.capabilities) {
            // It's a reference to a Gun.js node
            const capabilitiesRef = (card.capabilities as any)['#'];
            console.log(`[getCardCapabilityNames] Following capabilities reference: ${capabilitiesRef}`);
            
            try {
                // Get the referenced node data
                const refCapabilities = await get(capabilitiesRef);
                
                if (refCapabilities && typeof refCapabilities === 'object') {
                    // Extract capability IDs (keys where value is true)
                    capabilityIds = Object.keys(refCapabilities)
                        .filter(key => 
                            key !== '_' && 
                            key !== '#' && 
                            (refCapabilities as Record<string, any>)[key] === true
                        );
                    
                    console.log(`[getCardCapabilityNames] Found ${capabilityIds.length} capabilities from reference:`, capabilityIds);
                } else {
                    console.log(`[getCardCapabilityNames] Referenced capabilities object not found: ${capabilitiesRef}`);
                }
            } catch (error) {
                console.error(`[getCardCapabilityNames] Error resolving capabilities reference:`, error);
            }
        } else if (typeof card.capabilities === 'object') {
            // It's an inline object with capability IDs as keys
            capabilityIds = Object.keys(card.capabilities as Record<string, boolean>)
                .filter(key => {
                    const value = (card.capabilities as Record<string, any>)[key];
                    return key !== '_' && key !== '#' && value === true;
                });
            
            console.log(`[getCardCapabilityNames] Found ${capabilityIds.length} inline capabilities:`, capabilityIds);
        }
        
        // Now resolve the capability IDs to actual capability names
        const gun = getGun();
        if (!gun) {
            console.error("[getCardCapabilityNames] Gun not initialized");
            return [];
        }
        
        // Create a Map to hold capability names as they're resolved (for deduplication)
        const capabilityNamesMap = new Map<string, string>();
        
        // Process each capability ID in parallel
        await Promise.all(capabilityIds.map(async (capabilityId) => {
            try {
                // Handle standard capability IDs (starting with 'capability_')
                if (capabilityId.startsWith('capability_')) {
                    const capabilityData = await get(`${nodes.capabilities}/${capabilityId}`);
                    if (capabilityData?.name) {
                        capabilityNamesMap.set(capabilityId, capabilityData.name);
                        return;
                    }
                }
                
                // For any other format, make a readable name from the ID
                if (capabilityId.startsWith('capability_')) {
                    // Convert capability_something-like-this to Something Like This
                    const readable = capabilityId.replace('capability_', '')
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    capabilityNamesMap.set(capabilityId, readable);
                } else {
                    // Use the ID directly if no other processing applies
                    capabilityNamesMap.set(capabilityId, capabilityId);
                }
            } catch (error) {
                console.error(`[getCardCapabilityNames] Error processing capability ID ${capabilityId}:`, error);
            }
        }));
        
        // Convert Map values to array and remove duplicates
        const capabilityNames = [...capabilityNamesMap.values()];
        console.log(`[getCardCapabilityNames] Final capability names for card ${card.card_id}:`, capabilityNames);
        
        return capabilityNames;
    } catch (error) {
        console.error(`[getCardCapabilityNames] Error:`, error);
        return [];
    }
}
