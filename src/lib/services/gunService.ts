import Gun from "gun";
import "gun/sea"; // Import SEA for authentication
import { browser } from "$app/environment";
import type { IGunInstance, IGunUserInstance } from "gun";
import "gun/lib/radix"; // Enable IndexedDB support

// Gun instance
let gun: IGunInstance | undefined;

const GUN_PEERS: string[] = []; // Add peers later if needed
// Interface for Gun acknowledgment
export interface GunAck {
    err?: string;
    ok?: boolean;
    [key: string]: any;
}

/**
 * Initialize Gun database
 * @returns The Gun instance or undefined if not in browser
 */
export function initializeGun(): IGunInstance | undefined {
    if (browser) {
        console.log(
            "[initializeGun] Initializing Gun.js with peers:",
            GUN_PEERS,
        );
        // Hybrid storage approach:
        // - localStorage: true = enables access to existing data stored prior to IndexedDB
        // - radisk: true = enables IndexedDB for faster future storage
        // This approach allows accessing old data while transitioning to the new storage method
        gun = Gun({
            radisk: true, // Use IndexedDB for faster storage
            localStorage: true, // Keep localStorage enabled for backward compatibility
            peers: GUN_PEERS,
        });
        console.log("[initializeGun] Gun initialized");
        return gun;
    }
    console.warn("[initializeGun] Cannot initialize outside browser");
    return undefined;
}

/**
 * Get the Gun instance, initializing if needed
 * @returns The Gun instance or undefined if not available
 */
export function getGun(): IGunInstance | undefined {
    if (!gun && browser) {
        console.log("[getGun] Gun not initialized, initializing now");
        return initializeGun();
    }
    console.log("[getGun] Returning existing Gun instance");
    return gun;
}

/**
 * Get the Gun user instance
 * @returns The Gun user instance or undefined if not available
 */
export function getUser(): IGunUserInstance | undefined {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.warn("[getUser] Gun not initialized");
        return undefined;
    }
    const user = gunInstance.user();
    console.log("[getUser] User instance retrieved");
    return user;
}

/**
 * Put data into a Gun node
 * @param node Node path
 * @param data Data to store
 * @param callback Optional callback function
 * @returns A promise that resolves with the acknowledgment or rejects with an error
 */
export function put<T>(
    node: string,
    data: T,
    callback?: (ack: GunAck) => void,
): Promise<GunAck> {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error("[put] Gun not initialized");
        return Promise.reject(new Error("Gun not initialized"));
    }

    console.log(`[put] Starting save to ${node}`, typeof data === 'object' ? JSON.stringify(data) : data);
    
    // Following the exact pattern from Gun.js docs
    return new Promise((resolve) => {
        try {
            const startTime = Date.now();
            let completed = false;
            
            // Add a timeout safety in case Gun never calls back
            const safetyTimeout = setTimeout(() => {
                if (!completed) {
                    console.warn(`[put] Safety timeout after 10s for ${node}`);
                    completed = true;
                    resolve({
                        err: "Operation timed out",
                        ok: false,
                    });
                }
            }, 10000);
            
            // Use direct put with no chaining, following Gun's API docs exactly
            gunInstance.get(node).put(data, (ack: any) => {
                if (completed) return; // Already resolved by timeout
                completed = true;
                clearTimeout(safetyTimeout);
                
                console.log(`[put] Got acknowledgment in ${Date.now() - startTime}ms:`, ack);
                
                // Standard acknowledgment format
                const gunAck: GunAck = { 
                    err: ack.err, 
                    ok: !ack.err 
                };
                
                if (callback) callback(gunAck);
                
                if (ack.err) {
                    console.error(`[put] Error saving to ${node}:`, ack.err);
                }
                
                console.log(`[put] Completed save to ${node}:`, 
                    ack.err ? 'with error' : 'successfully');
                
                // Always resolve, never reject (Gun's pattern)
                resolve(gunAck);
            });
        } catch (error) {
            console.error(`[put] Exception during save to ${node}:`, error);
            // Even for exceptions, resolve with an error
            resolve({
                err: String(error),
                ok: false,
            });
        }
    });
}

/**
 * Get data from a Gun node (once)
 * @param node Node path
 * @returns A promise that resolves with the data or null if not found
 */
export function get<T>(node: string): Promise<T | null> {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error("[get] Gun not initialized");
        return Promise.reject(new Error("Gun not initialized"));
    }

    console.log(`[get] Fetching from ${node}`);
    return new Promise((resolve) => {
        let completed = false;
        
        // Add timeout safety
        const safetyTimeout = setTimeout(() => {
            if (!completed) {
                console.warn(`[get] Safety timeout after 5s for ${node}`);
                completed = true;
                resolve(null);
            }
        }, 5000);
        
        gunInstance.get(node).once((data: any) => {
            if (completed) return; // Already resolved by timeout
            completed = true;
            clearTimeout(safetyTimeout);
            
            // Remove Gun metadata from the result
            const result =
                data && typeof data === "object"
                    ? { ...data, _: undefined }
                    : data;
            console.log(`[get] Fetched from ${node}:`, result);
            resolve(result as T | null);
        });
    });
}

/**
 * Subscribe to changes on a Gun node
 * @param node Node path
 * @param callback Callback function for updates
 */
export function subscribe<T>(
    node: string,
    callback: (data: T) => void,
): () => void {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error("[subscribe] Gun not initialized");
        return () => {};
    }

    console.log(`[subscribe] Subscribing to ${node}`);
    const subscription = gunInstance.get(node).on((data: any) => {
        const result =
            data && typeof data === "object" ? { ...data, _: undefined } : data;
        console.log(`[subscribe] Update for ${node}:`, result);
        callback(result as T);
    });

    return () => {
        console.log(`[subscribe] Unsubscribing from ${node}`);
        subscription.off();
    };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    const id =
        Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    console.log("[generateId] Generated:", id);
    return id;
}

/**
 * Get data from a specific field in a Gun node
 * @param nodePath Base node path
 * @param key Field key
 * @returns A promise that resolves with the data or null if not found
 */
export function getField<T>(
    nodePath: string,
    key: string,
): Promise<T | null> {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error("[getField] Gun not initialized");
        return Promise.reject(new Error("Gun not initialized"));
    }

    console.log(`[getField] Fetching ${nodePath}/${key}`);
    return new Promise((resolve) => {
        let completed = false;
        
        // Add timeout safety
        const safetyTimeout = setTimeout(() => {
            if (!completed) {
                console.warn(`[getField] Safety timeout after 5s for ${nodePath}/${key}`);
                completed = true;
                resolve(null);
            }
        }, 5000);
        
        gunInstance
            .get(nodePath)
            .get(key)
            .once((data: any) => {
                if (completed) return; // Already resolved by timeout
                completed = true;
                clearTimeout(safetyTimeout);
                
                // Remove Gun metadata from the result
                const result =
                    data && typeof data === "object"
                        ? { ...data, _: undefined }
                        : data;
                console.log(
                    `[getField] Fetched ${nodePath}/${key}:`,
                    result,
                );
                resolve(result as T | null);
            });
    });
}

/**
 * Set a specific field in a Gun node
 * @param nodePath Base node path
 * @param key Field key
 * @param value Value to set
 * @returns A promise that resolves with the acknowledgment
 */
export function setField<T>(
    nodePath: string,
    key: string,
    value: T,
): Promise<GunAck> {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error("[setField] Gun not initialized");
        return Promise.reject(new Error("Gun not initialized"));
    }

    console.log(`[setField] Setting ${nodePath}/${key} to:`, value);
    
    return new Promise((resolve) => {
        try {
            const startTime = Date.now();
            let completed = false;
            
            // Add a timeout safety in case Gun never calls back
            const safetyTimeout = setTimeout(() => {
                if (!completed) {
                    console.warn(`[setField] Safety timeout after 10s for ${nodePath}/${key}`);
                    completed = true;
                    resolve({
                        err: "Operation timed out",
                        ok: false,
                    });
                }
            }, 10000);
            
            // Using Gun's direct callback pattern
            gunInstance
                .get(nodePath)
                .get(key)
                .put(value, (ack: any) => {
                    if (completed) return; // Already resolved by timeout
                    completed = true;
                    clearTimeout(safetyTimeout);
                    
                    console.log(`[setField] Got acknowledgment in ${Date.now() - startTime}ms:`, ack);
                    
                    // Standardize the acknowledgment
                    const gunAck: GunAck = { 
                        err: ack.err, 
                        ok: !ack.err,
                    };
                    
                    // Always log errors for debugging
                    if (ack.err) {
                        console.error(`[setField] Error setting ${nodePath}/${key}:`, ack.err);
                    }
                    
                    // Always resolve, following the Gun.js pattern
                    console.log(`[setField] Completed setting ${nodePath}/${key}:`, 
                        ack.err ? 'with error' : 'successfully');
                    resolve(gunAck);
                });
        } catch (error) {
            console.error(`[setField] Exception during setting ${nodePath}/${key}:`, error);
            // Even for exceptions, resolve with an error object
            resolve({
                err: String(error),
                ok: false,
            });
        }
    });
}

/**
 * Get all items from a collection node
 * @param nodePath Path to the collection
 * @returns A promise that resolves with an array of items
 */
export function getCollection<T>(nodePath: string): Promise<T[]> {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error("[getCollection] Gun not initialized");
        return Promise.reject(new Error("Gun not initialized"));
    }

    console.log(`[getCollection] Fetching collection from ${nodePath}`);
    return new Promise((resolve) => {
        const items: T[] = [];
        
        // Use Gun's map().once() pattern to iterate through collection items
        gunInstance
            .get(nodePath)
            .map()
            .once((data: any, key: string) => {
                if (data && key !== "_") {
                    // Remove Gun metadata and add id property
                    const item = { ...data, _: undefined, id: key } as T;
                    items.push(item);
                    console.log(
                        `[getCollection] Item from ${nodePath}: ${key}`,
                        item,
                    );
                }
            });
        
        // Allow time for data to load (Gun.js loads data asynchronously)
        setTimeout(() => {
            console.log(
                `[getCollection] Retrieved ${items.length} items from ${nodePath}`,
            );
            resolve(items);
        }, 1000); // 1 second should be enough to gather collection items
    });
}

/**
 * Check if a node exists
 * @param nodePath Path to the node
 * @returns A promise that resolves with true if the node exists, false otherwise
 */
export function nodeExists(nodePath: string): Promise<boolean> {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error("[nodeExists] Gun not initialized");
        return Promise.reject(new Error("Gun not initialized"));
    }

    console.log(`[nodeExists] Checking if ${nodePath} exists`);
    return new Promise((resolve) => {
        let completed = false;
        
        // Add timeout safety
        const safetyTimeout = setTimeout(() => {
            if (!completed) {
                console.warn(`[nodeExists] Safety timeout after 5s for ${nodePath}`);
                completed = true;
                resolve(false);
            }
        }, 5000);
        
        gunInstance.get(nodePath).once((data: any) => {
            if (completed) return; // Already resolved by timeout
            completed = true;
            clearTimeout(safetyTimeout);
            
            const exists =
                data !== undefined &&
                data !== null &&
                Object.keys(data).length > 0;
            console.log(`[nodeExists] ${nodePath} exists: ${exists}`);
            resolve(exists);
        });
    });
}

/**
 * Delete a node (set to null)
 * @param nodePath Path to the node
 * @returns A promise that resolves with the acknowledgment or rejects with an error
 */
export function deleteNode(nodePath: string): Promise<GunAck> {
    console.log(`[deleteNode] Deleting ${nodePath}`);
    return put(nodePath, null);
}

// Gun nodes
export const nodes = {
    values: "values",
    capabilities: "capabilities",
    users: "users",
    games: "games",
    cards: "cards",
    decks: "decks",
    actors: "actors",
    chat: "chat",
    // D3GameBoard related nodes
    agreements: "agreements",
    positions: "node_positions",
};
