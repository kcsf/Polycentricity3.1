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
            let checkTimeoutHandled = false;
            let putTimeoutHandled = false;
            
            // Timeout for the check operation
            const checkTimeoutId = setTimeout(() => {
                if (!checkTimeoutHandled) {
                    console.warn(`Timeout checking if capability ${capabilityId} exists - moving to create`);
                    checkTimeoutHandled = true;
                    
                    // Move to creating the capability
                    createCapabilityWithTimeout();
                }
            }, 3000); // 3 second timeout
            
            // Function to create capability with its own timeout
            const createCapabilityWithTimeout = () => {
                // Timeout for the put operation
                const putTimeoutId = setTimeout(() => {
                    if (!putTimeoutHandled) {
                        console.warn(`Timeout creating capability ${capabilityId} - assuming success anyway`);
                        putTimeoutHandled = true;
                        resolve(capabilityData); // Resolve with capability data anyway to continue the process
                    }
                }, 5000); // 5 second timeout
                
                gun.get(nodes.capabilities).get(capabilityId).put(capabilityData, (ack: any) => {
                    if (putTimeoutHandled) return; // Skip if timeout already triggered
                    
                    clearTimeout(putTimeoutId); // Clear the timeout
                    putTimeoutHandled = true;
                    
                    if (ack.err) {
                        console.error('Error creating capability:', ack.err);
                        resolve(null);
                    } else {
                        console.log(`Created capability: ${capabilityId}`);
                        resolve(capabilityData);
                    }
                });
            };
            
            // First check if it already exists
            gun.get(nodes.capabilities).get(capabilityId).once((existingCapability: Capability) => {
                if (checkTimeoutHandled) return; // Skip if timeout already triggered
                
                clearTimeout(checkTimeoutId); // Clear the timeout
                checkTimeoutHandled = true;
                
                if (existingCapability && existingCapability.capability_id) {
                    console.log(`Capability already exists: ${capabilityId}`);
                    resolve(existingCapability);
                } else {
                    // Now create the capability
                    createCapabilityWithTimeout();
                }
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
        console.log(`Creating or getting capabilities from text: ${capabilitiesText.substring(0, 50)}${capabilitiesText.length > 50 ? '...' : ''}`);
        const capabilityNames = parseCapabilitiesText(capabilitiesText);
        console.log(`Parsed ${capabilityNames.length} capability names`);
        
        const capabilityMap: Record<string, boolean> = {};
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return {};
        }
        
        // First check if capabilities already exist - cache them in memory
        const existingCapabilities = await new Promise<Record<string, Capability>>((resolve) => {
            const capabilities: Record<string, Capability> = {};
            gun.get(nodes.capabilities).map().once((capabilityData: Capability, capabilityId: string) => {
                if (capabilityData && capabilityData.name) {
                    capabilities[capabilityData.name.toLowerCase()] = capabilityData;
                }
            });
            
            // Give Gun time to process
            setTimeout(() => resolve(capabilities), 1000); // Increased timeout
        });
        
        console.log(`Found ${Object.keys(existingCapabilities).length} existing capabilities in database`);
        
        // Create a modified version of createCapability that has a timeout
        const createCapabilityWithTimeout = async (name: string): Promise<Capability | null> => {
            return new Promise((resolve) => {
                let timeoutHandled = false;
                
                // Set a timeout to ensure we don't hang forever
                const timeoutId = setTimeout(() => {
                    if (!timeoutHandled) {
                        console.warn(`Timeout creating capability ${name} - generating fallback`);
                        timeoutHandled = true;
                        
                        // Create a fallback capability object that's not in the database but will allow us to continue
                        const capabilityId = `capability_${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
                        resolve({
                            capability_id: capabilityId,
                            name: name,
                            created_at: Date.now()
                        });
                    }
                }, 5000); // 5 second timeout
                
                // Attempt to create the capability normally
                createCapability(name).then(capability => {
                    if (timeoutHandled) return; // Skip if timeout already triggered
                    
                    clearTimeout(timeoutId); // Clear the timeout
                    timeoutHandled = true;
                    
                    resolve(capability);
                }).catch(error => {
                    if (timeoutHandled) return; // Skip if timeout already triggered
                    
                    clearTimeout(timeoutId); // Clear the timeout
                    timeoutHandled = true;
                    
                    console.error('Error creating capability:', error);
                    resolve(null);
                });
            });
        };
        
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
                // Create a new capability with timeout handling
                console.log(`Creating new capability: ${trimmedName}`);
                const capability = await createCapabilityWithTimeout(trimmedName);
                
                if (capability) {
                    console.log(`Successfully created/got capability: ${capability.capability_id}`);
                    capabilityMap[capability.capability_id] = true;
                    
                    // Add to our existing capabilities so we don't try to create it again
                    existingCapabilities[lowerName] = capability;
                }
            }
        }
        
        console.log(`Finished processing ${capabilityNames.length} capabilities. Created/found ${Object.keys(capabilityMap).length} capabilities.`);
        return capabilityMap;
    } catch (error) {
        console.error('Create or get capabilities error:', error);
        return {};
    }
}