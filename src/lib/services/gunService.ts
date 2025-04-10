import Gun from 'gun';
import 'gun/sea'; // Import SEA for authentication
import { browser } from '$app/environment';

// Gun instance
let gun: any;

// Initialize Gun with a peer server
export function initializeGun() {
    if (browser) {
        console.log('Initializing Gun.js database...');
        gun = Gun({
            peers: ['https://gun-manhattan.herokuapp.com/gun'] // Public peer for development
        });
        return gun;
    }
    return null;
}

// Get the Gun instance
export function getGun() {
    if (!gun && browser) {
        return initializeGun();
    }
    return gun;
}

// Gun user instance
export function getUser() {
    const gun = getGun();
    return gun?.user?.();
}

// Generic function to put data
export function put(node: string, data: any, callback?: (ack: any) => void) {
    const gun = getGun();
    if (!gun) return null;
    
    return new Promise((resolve, reject) => {
        gun.get(node).put(data, (ack: any) => {
            if (ack.err) {
                console.error('Gun put error:', ack.err);
                reject(ack.err);
                if (callback) callback(ack);
                return;
            }
            console.log(`Data saved to node: ${node}`);
            resolve(ack);
            if (callback) callback(ack);
        });
    });
}

// Generic function to get data
export function get(node: string) {
    const gun = getGun();
    if (!gun) return null;
    
    return new Promise((resolve) => {
        gun.get(node).once((data: any) => {
            resolve(data);
        });
    });
}

// Generic function to subscribe to data changes
export function subscribe(node: string, callback: (data: any) => void) {
    const gun = getGun();
    if (!gun) return () => {};
    
    const subscription = gun.get(node).on((data: any) => {
        callback(data);
    });
    
    // Return function to unsubscribe
    return () => {
        subscription.off();
    };
}

// Function to generate a unique ID
export function generateId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

// Export the gun nodes for different data types
export const nodes = {
  values: 'values', // New node type for values
  capabilities: 'capabilities', // New node type for capabilities
    users: 'users',
    games: 'games',
    cards: 'cards',       // New: static role templates
    decks: 'decks',       // New: card collections
    actors: 'actors',     // Changed: now links user to card in game
    chat: 'chat',
    // D3GameBoard related nodes
    agreements: 'agreements',
    positions: 'node_positions'
};
