// Capability management service
import { getGun, nodes, generateId } from './gunService';
import type { Capability } from '$lib/types';

// Create a new capability
export async function createCapability(name: string): Promise<Capability | null> {
    try {
        console.log(`Creating new capability: ${name}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        // Generate a normalized ID from the name (lowercase, spaces to hyphens)
        const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
        const capabilityId = `capability_${normalizedName}`;
        
        const capabilityData: Capability = {
            capability_id: capabilityId,
            name: name,
            created_at: Date.now()
        };
        
        return new Promise((resolve) => {
            gun.get(nodes.capabilities).get(capabilityId).once((existingCapability: Capability) => {
                if (existingCapability && existingCapability.capability_id) {
                    console.log(`Capability already exists: ${capabilityId}`);
                    resolve(existingCapability);
                    return;
                }
                
                gun.get(nodes.capabilities).get(capabilityId).put(capabilityData, (ack: any) => {
                    if (ack.err) {
                        console.error('Error creating capability:', ack.err);
                        resolve(null);
                    } else {
                        console.log(`Created capability: ${capabilityId}`);
                        resolve(capabilityData);
                    }
                });
            });
        });
    } catch (error) {
        console.error('Create capability error:', error);
        return null;
    }
}

// Get a capability by ID
export async function getCapability(capabilityId: string): Promise<Capability | null> {
    try {
        console.log(`Getting capability: ${capabilityId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.capabilities).get(capabilityId).once((capabilityData: Capability) => {
                if (!capabilityData) {
                    console.log(`Capability not found: ${capabilityId}`);
                    resolve(null);
                    return;
                }
                
                console.log(`Found capability: ${capabilityId}`);
                resolve(capabilityData);
            });
        });
    } catch (error) {
        console.error('Get capability error:', error);
        return null;
    }
}

// Get all capabilities
export async function getAllCapabilities(): Promise<Capability[]> {
    try {
        console.log('Getting all capabilities');
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return [];
        }
        
        const capabilities: Capability[] = [];
        
        return new Promise((resolve) => {
            gun.get(nodes.capabilities).map().once((capabilityData: Capability, capabilityId: string) => {
                if (capabilityData) {
                    capabilities.push(capabilityData);
                }
            });
            
            // Wait for Gun to load data
            setTimeout(() => {
                console.log(`Found ${capabilities.length} capabilities`);
                resolve(capabilities);
            }, 500);
        });
    } catch (error) {
        console.error('Get all capabilities error:', error);
        return [];
    }
}

// Update a capability
export async function updateCapability(capabilityId: string, updates: Partial<Capability>): Promise<boolean> {
    try {
        console.log(`Updating capability: ${capabilityId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.capabilities).get(capabilityId).put(updates, (ack: any) => {
                if (ack.err) {
                    console.error('Error updating capability:', ack.err);
                    resolve(false);
                } else {
                    console.log(`Updated capability: ${capabilityId}`);
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('Update capability error:', error);
        return false;
    }
}

// Delete a capability
export async function deleteCapability(capabilityId: string): Promise<boolean> {
    try {
        console.log(`Deleting capability: ${capabilityId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.capabilities).get(capabilityId).put(null, (ack: any) => {
                if (ack.err) {
                    console.error('Error deleting capability:', ack.err);
                    resolve(false);
                } else {
                    console.log(`Deleted capability: ${capabilityId}`);
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('Delete capability error:', error);
        return false;
    }
}

// Parse capabilities text into an array of capabilities
export function parseCapabilitiesText(capabilitiesText: string): string[] {
    if (!capabilitiesText) return [];
    
    // Split on commas, semicolons, or newlines
    return capabilitiesText
        .split(/[,;\n]/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
}

// Create or get capabilities from a capabilities text string
export async function createOrGetCapabilities(capabilitiesText: string): Promise<Record<string, boolean>> {
    try {
        const capabilityNames = parseCapabilitiesText(capabilitiesText);
        const capabilityMap: Record<string, boolean> = {};
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return {};
        }
        
        // First check if capabilities already exist to avoid redundant creation
        const existingCapabilities = await new Promise<Record<string, Capability>>((resolve) => {
            const capabilities: Record<string, Capability> = {};
            gun.get(nodes.capabilities).map().once((capabilityData: Capability, capabilityId: string) => {
                if (capabilityData && capabilityData.name) {
                    capabilities[capabilityData.name.toLowerCase()] = capabilityData;
                }
            });
            
            // Give Gun time to process
            setTimeout(() => resolve(capabilities), 500);
        });
        
        console.log(`Found ${Object.keys(existingCapabilities).length} existing capabilities`);
        
        // Process each capability name, reusing existing ones when possible
        for (const name of capabilityNames) {
            if (!name || name.trim() === '') continue;
            
            const trimmedName = name.trim();
            const lowerName = trimmedName.toLowerCase();
            
            // Check if this capability already exists
            if (existingCapabilities[lowerName]) {
                const existingCapability = existingCapabilities[lowerName];
                console.log(`Reusing existing capability: ${existingCapability.capability_id}`);
                capabilityMap[existingCapability.capability_id] = true;
            } else {
                // Create a new capability only if it doesn't exist
                const capability = await createCapability(trimmedName);
                if (capability) {
                    capabilityMap[capability.capability_id] = true;
                }
            }
        }
        
        return capabilityMap;
    } catch (error) {
        console.error('Create or get capabilities error:', error);
        return {};
    }
}