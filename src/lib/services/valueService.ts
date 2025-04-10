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
            gun.get(nodes.values).get(valueId).once((existingValue: Value) => {
                if (existingValue && existingValue.value_id) {
                    console.log(`Value already exists: ${valueId}`);
                    resolve(existingValue);
                    return;
                }
                
                gun.get(nodes.values).get(valueId).put(valueData, (ack: any) => {
                    if (ack.err) {
                        console.error('Error creating value:', ack.err);
                        resolve(null);
                    } else {
                        console.log(`Created value: ${valueId}`);
                        resolve(valueData);
                    }
                });
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
    const valueMap: Record<string, boolean> = {};
    
    for (const name of valueNames) {
        if (!name || name.trim() === '') continue;
        
        const value = await createValue(name.trim());
        if (value) {
            valueMap[value.value_id] = true;
        }
    }
    
    return valueMap;
}