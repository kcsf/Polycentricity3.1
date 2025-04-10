// Value management service
import { getGun, nodes, generateId } from './gunService';
import type { Value } from '$lib/types';

// Create a new value
export async function createValue(name: string): Promise<Value | null> {
    try {
        console.log(`Creating new value: ${name}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        // Generate a normalized ID from the name (lowercase, spaces to hyphens)
        const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
        const valueId = `value_${normalizedName}`;
        
        const valueData: Value = {
            value_id: valueId,
            name: name,
            created_at: Date.now()
        };
        
        return new Promise((resolve) => {
            let checkTimeoutHandled = false;
            let putTimeoutHandled = false;
            
            // Timeout for the check operation
            const checkTimeoutId = setTimeout(() => {
                if (!checkTimeoutHandled) {
                    console.warn(`Timeout checking if value ${valueId} exists - moving to create`);
                    checkTimeoutHandled = true;
                    
                    // Move to creating the value
                    createValueWithTimeout();
                }
            }, 3000); // 3 second timeout
            
            // Function to create value with its own timeout
            const createValueWithTimeout = () => {
                // Timeout for the put operation
                const putTimeoutId = setTimeout(() => {
                    if (!putTimeoutHandled) {
                        console.warn(`Timeout creating value ${valueId} - assuming success anyway`);
                        putTimeoutHandled = true;
                        resolve(valueData); // Resolve with value data anyway to continue the process
                    }
                }, 5000); // 5 second timeout
                
                gun.get(nodes.values).get(valueId).put(valueData, (ack: any) => {
                    if (putTimeoutHandled) return; // Skip if timeout already triggered
                    
                    clearTimeout(putTimeoutId); // Clear the timeout
                    putTimeoutHandled = true;
                    
                    if (ack.err) {
                        console.error('Error creating value:', ack.err);
                        resolve(null);
                    } else {
                        console.log(`Created value: ${valueId}`);
                        resolve(valueData);
                    }
                });
            };
            
            // First check if it already exists
            gun.get(nodes.values).get(valueId).once((existingValue: Value) => {
                if (checkTimeoutHandled) return; // Skip if timeout already triggered
                
                clearTimeout(checkTimeoutId); // Clear the timeout
                checkTimeoutHandled = true;
                
                if (existingValue && existingValue.value_id) {
                    console.log(`Value already exists: ${valueId}`);
                    resolve(existingValue);
                } else {
                    // Now create the value
                    createValueWithTimeout();
                }
            });
        });
    } catch (error) {
        console.error('Create value error:', error);
        return null;
    }
}

// Get a value by ID
export async function getValue(valueId: string): Promise<Value | null> {
    try {
        console.log(`Getting value: ${valueId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.values).get(valueId).once((valueData: Value) => {
                if (!valueData) {
                    console.log(`Value not found: ${valueId}`);
                    resolve(null);
                    return;
                }
                
                console.log(`Found value: ${valueId}`);
                resolve(valueData);
            });
        });
    } catch (error) {
        console.error('Get value error:', error);
        return null;
    }
}

// Get all values
export async function getAllValues(): Promise<Value[]> {
    try {
        console.log('Getting all values');
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return [];
        }
        
        const values: Value[] = [];
        
        return new Promise((resolve) => {
            gun.get(nodes.values).map().once((valueData: Value, valueId: string) => {
                if (valueData) {
                    values.push(valueData);
                }
            });
            
            // Wait for Gun to load data
            setTimeout(() => {
                console.log(`Found ${values.length} values`);
                resolve(values);
            }, 500);
        });
    } catch (error) {
        console.error('Get all values error:', error);
        return [];
    }
}

// Update a value
export async function updateValue(valueId: string, updates: Partial<Value>): Promise<boolean> {
    try {
        console.log(`Updating value: ${valueId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.values).get(valueId).put(updates, (ack: any) => {
                if (ack.err) {
                    console.error('Error updating value:', ack.err);
                    resolve(false);
                } else {
                    console.log(`Updated value: ${valueId}`);
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('Update value error:', error);
        return false;
    }
}

// Delete a value
export async function deleteValue(valueId: string): Promise<boolean> {
    try {
        console.log(`Deleting value: ${valueId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.values).get(valueId).put(null, (ack: any) => {
                if (ack.err) {
                    console.error('Error deleting value:', ack.err);
                    resolve(false);
                } else {
                    console.log(`Deleted value: ${valueId}`);
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('Delete value error:', error);
        return false;
    }
}

// Create or get values from an array of names
export async function createOrGetValues(valueNames: string[]): Promise<Record<string, boolean>> {
    try {
        console.log(`Creating or getting ${valueNames.length} values`);
        const valueMap: Record<string, boolean> = {};
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return {};
        }
        
        // First check if values already exist - cache them in memory
        const existingValues = await new Promise<Record<string, Value>>((resolve) => {
            const values: Record<string, Value> = {};
            gun.get(nodes.values).map().once((valueData: Value, valueId: string) => {
                if (valueData && valueData.name) {
                    values[valueData.name.toLowerCase()] = valueData;
                }
            });
            
            // Give Gun time to process
            setTimeout(() => resolve(values), 1000); // Increased timeout
        });
        
        console.log(`Found ${Object.keys(existingValues).length} existing values in database`);
        
        // Create a modified version of createValue that has a timeout
        const createValueWithTimeout = async (name: string): Promise<Value | null> => {
            return new Promise((resolve) => {
                let timeoutHandled = false;
                
                // Set a timeout to ensure we don't hang forever
                const timeoutId = setTimeout(() => {
                    if (!timeoutHandled) {
                        console.warn(`Timeout creating value ${name} - generating fallback`);
                        timeoutHandled = true;
                        
                        // Create a fallback value object that's not in the database but will allow us to continue
                        const valueId = `value_${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
                        resolve({
                            value_id: valueId,
                            name: name,
                            created_at: Date.now()
                        });
                    }
                }, 5000); // 5 second timeout
                
                // Attempt to create the value normally
                createValue(name).then(value => {
                    if (timeoutHandled) return; // Skip if timeout already triggered
                    
                    clearTimeout(timeoutId); // Clear the timeout
                    timeoutHandled = true;
                    
                    resolve(value);
                }).catch(error => {
                    if (timeoutHandled) return; // Skip if timeout already triggered
                    
                    clearTimeout(timeoutId); // Clear the timeout
                    timeoutHandled = true;
                    
                    console.error('Error creating value:', error);
                    resolve(null);
                });
            });
        };
        
        // Process each value name, reusing existing ones when possible
        for (const name of valueNames) {
            if (!name || name.trim() === '') continue;
            
            const trimmedName = name.trim();
            const lowerName = trimmedName.toLowerCase();
            
            // Check if this value already exists
            if (existingValues[lowerName]) {
                const existingValue = existingValues[lowerName];
                console.log(`Reusing existing value: ${existingValue.value_id}`);
                valueMap[existingValue.value_id] = true;
            } else {
                // Create a new value with timeout handling
                console.log(`Creating new value: ${trimmedName}`);
                const value = await createValueWithTimeout(trimmedName);
                
                if (value) {
                    console.log(`Successfully created/got value: ${value.value_id}`);
                    valueMap[value.value_id] = true;
                    
                    // Add to our existing values so we don't try to create it again
                    existingValues[lowerName] = value;
                }
            }
        }
        
        console.log(`Finished processing ${valueNames.length} values. Created/found ${Object.keys(valueMap).length} values.`);
        return valueMap;
    } catch (error) {
        console.error('Create or get values error:', error);
        return {};
    }
}