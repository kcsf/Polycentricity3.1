import Gun from 'gun';
import 'gun/sea'; // Import SEA for authentication
import { browser } from '$app/environment';

// Import Gun types, but use any for now due to type mismatches
// The @types/gun package isn't fully compatible with how we use Gun.js
import type { IGunInstanceRoot } from 'gun/types';

// Define our Gun instance type
let gun: any = null;

// Initialize timeout for database operations (in milliseconds)
export const DB_TIMEOUT = 8000; // 8 seconds

// Interface for acknowledgment
export interface GunAck {
  err?: string;
  ok?: boolean;
  [key: string]: any;
}

/**
 * Initialize Gun database
 * @returns The Gun instance or null if not in browser
 */
export function initializeGun(): IGunInstanceRoot<any, any> | null {
    if (browser) {
        console.log('Initializing Gun.js database...');
        gun = Gun({
            // Using local storage only, no external peers.
            // Data will be stored in the browser's localStorage or IndexedDB.
            localStorage: true,
            // No public peers - keeps data private and isolated
            peers: []
        });
        return gun;
    }
    return null;
}

/**
 * Get the Gun instance, initializing if needed
 * @returns The Gun instance or null if not in browser
 */
export function getGun(): IGunInstanceRoot<any, any> | null {
    if (!gun && browser) {
        return initializeGun();
    }
    return gun;
}

/**
 * Get the Gun user instance
 * @returns The Gun user instance or null if Gun is not initialized
 */
export function getUser(): any {
    const gunInstance = getGun();
    // Using any because the Gun.js typings don't perfectly align with the actual API
    if (!gunInstance) return null;
    return (gunInstance as any).user?.() || null;
}

/**
 * Create a promise with timeout
 * @param promise The promise to add timeout to
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Custom error message
 * @returns Promise with timeout
 */
function withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs: number = DB_TIMEOUT, 
    errorMessage: string = 'Operation timed out'
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
}

/**
 * Put data into a Gun node
 * @param node Node path
 * @param data Data to store
 * @param callback Optional callback function
 * @returns Promise that resolves with acknowledgment or rejects with error
 */
export function put<T>(
    node: string, 
    data: T, 
    callback?: (ack: GunAck) => void
): Promise<GunAck> {
    const gunInstance = getGun();
    if (!gunInstance) return Promise.reject(new Error('Gun not initialized'));
    
    const promise = new Promise<GunAck>((resolve, reject) => {
        gunInstance.get(node).put(data as any, (ack: GunAck) => {
            if (ack.err) {
                console.error(`Gun put error for node '${node}':`, ack.err);
                reject(new Error(ack.err));
                if (callback) callback(ack);
                return;
            }
            if (process.env.NODE_ENV !== 'production') {
                console.log(`Data saved to node: ${node}`);
            }
            resolve(ack);
            if (callback) callback(ack);
        });
    });
    
    return withTimeout(promise, DB_TIMEOUT, `Put operation timed out for node: ${node}`);
}

/**
 * Get data from a Gun node (once)
 * @param node Node path
 * @returns Promise that resolves with the data
 */
export function get<T>(node: string): Promise<T | null> {
    const gunInstance = getGun();
    if (!gunInstance) return Promise.reject(new Error('Gun not initialized'));
    
    const promise = new Promise<T | null>((resolve) => {
        gunInstance.get(node).once((data: T | null) => {
            resolve(data);
        });
    });
    
    return withTimeout(promise, DB_TIMEOUT, `Get operation timed out for node: ${node}`);
}

/**
 * Subscribe to changes on a Gun node
 * @param node Node path
 * @param callback Callback function that receives updated data
 * @returns Function to unsubscribe
 */
export function subscribe<T>(
    node: string, 
    callback: (data: T) => void
): () => void {
    const gunInstance = getGun();
    if (!gunInstance) return () => {};
    
    // Cast to any because Gun types don't fully capture the chaining API
    const subscription = (gunInstance.get(node) as any).on((data: T) => {
        callback(data);
    });
    
    // Return function to unsubscribe
    return () => {
        if (subscription && typeof subscription.off === 'function') {
            subscription.off();
        }
    };
}

/**
 * Generate a unique ID suitable for use as a Gun node key
 * @returns A unique string ID
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

/**
 * Get data from a Gun node with a specific field/key
 * @param nodePath Base node path
 * @param key The specific key to get
 * @returns Promise that resolves with the data at the specified key
 */
export function getField<T>(nodePath: string, key: string): Promise<T | null> {
    const gunInstance = getGun();
    if (!gunInstance) return Promise.reject(new Error('Gun not initialized'));
    
    const promise = new Promise<T | null>((resolve) => {
        gunInstance.get(nodePath).get(key).once((data: T | null) => {
            resolve(data);
        });
    });
    
    return withTimeout(promise, DB_TIMEOUT, `GetField operation timed out for ${nodePath}/${key}`);
}

/**
 * Set a specific field in a Gun node
 * @param nodePath Base node path
 * @param key The specific key to set
 * @param value The value to set
 * @returns Promise that resolves with acknowledgment
 */
export function setField<T>(nodePath: string, key: string, value: T): Promise<GunAck> {
    const gunInstance = getGun();
    if (!gunInstance) return Promise.reject(new Error('Gun not initialized'));
    
    const promise = new Promise<GunAck>((resolve, reject) => {
        gunInstance.get(nodePath).get(key).put(value as any, (ack: GunAck) => {
            if (ack.err) {
                console.error(`Gun setField error for ${nodePath}/${key}:`, ack.err);
                reject(new Error(ack.err));
                return;
            }
            resolve(ack);
        });
    });
    
    return withTimeout(promise, DB_TIMEOUT, `SetField operation timed out for ${nodePath}/${key}`);
}

/**
 * Safely attempt to get all items from a node that might be a collection
 * This uses a timeout to prevent hanging indefinitely
 * @param nodePath Path to the collection
 * @returns Promise resolving to an array of items
 */
export function getCollection<T>(nodePath: string): Promise<T[]> {
    const gunInstance = getGun();
    if (!gunInstance) return Promise.reject(new Error('Gun not initialized'));
    
    return new Promise<T[]>((resolve) => {
        const items: T[] = [];
        let timeoutId: NodeJS.Timeout;
        let resolved = false;
        
        // Set a timeout for the entire collection retrieval
        timeoutId = setTimeout(() => {
            if (!resolved) {
                console.warn(`Collection retrieval timed out for: ${nodePath}, returning ${items.length} items collected so far`);
                resolved = true;
                resolve(items);
            }
        }, DB_TIMEOUT);
        
        gunInstance.get(nodePath).map().once((data: any, key: string) => {
            if (data && !data._ && key !== '_') {
                // Only add actual data (not Gun metadata)
                items.push({
                    ...data,
                    id: key // Add the key as id field for convenience
                } as unknown as T);
            }
            
            // This runs every time an item is processed
            // We can't determine when map().once() is complete, so we rely on the timeout
        });
        
        // Additional timer to resolve early if no new items were added for a while
        // This helps when the collection might be small or empty
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                resolve(items);
            }
        }, 2000); // 2 seconds reasonable for small collections
    });
}

/**
 * Check if a node exists
 * @param nodePath Path to the node
 * @returns Promise resolving to true if the node exists, false otherwise
 */
export function nodeExists(nodePath: string): Promise<boolean> {
    const gunInstance = getGun();
    if (!gunInstance) return Promise.reject(new Error('Gun not initialized'));
    
    const promise = new Promise<boolean>((resolve) => {
        gunInstance.get(nodePath).once((data: any) => {
            // In Gun, a node exists if it's not undefined and not null
            // But we also want to check if it has any meaningful data
            resolve(data !== undefined && data !== null && Object.keys(data).length > 0);
        });
    });
    
    return withTimeout(promise, DB_TIMEOUT, `NodeExists check timed out for: ${nodePath}`);
}

/**
 * Delete a node (set to null)
 * Note: Gun doesn't truly delete data, it just sets it to null
 * @param nodePath Path to the node
 * @returns Promise resolving with acknowledgment
 */
export function deleteNode(nodePath: string): Promise<GunAck> {
    return put(nodePath, null);
}

// Export the gun nodes for different data types
export const nodes = {
    values: 'values', // Value system nodes
    capabilities: 'capabilities', // Capability system nodes
    users: 'users', // User accounts
    games: 'games', // Game instances
    cards: 'cards', // Role templates
    decks: 'decks', // Card collections
    actors: 'actors', // Links user to card in game
    chat: 'chat', // Chat messages
    // D3GameBoard related nodes
    agreements: 'agreements', // Agreements between actors
    positions: 'node_positions' // Position data for visualization
};
