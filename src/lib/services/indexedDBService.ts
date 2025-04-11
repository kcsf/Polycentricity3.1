/**
 * IndexedDB Service
 * 
 * A direct implementation of persistent storage using IndexedDB
 * to replace Gun.js for local operations.
 */

import { browser } from '$app/environment';

// Database configuration
const DB_NAME = 'polycentricity_db';
const DB_VERSION = 1;
const STORES = {
  values: 'values',
  capabilities: 'capabilities',
  users: 'users',
  games: 'games',
  cards: 'cards',
  decks: 'decks',
  actors: 'actors',
  chat: 'chat',
  agreements: 'agreements',
  positions: 'node_positions',
  test_data: 'test_data',
};

// Global database connection
let db: IDBDatabase | null = null;
let isInitializing = false;

/**
 * Initialize the IndexedDB database
 */
export function initializeDB(): Promise<IDBDatabase> {
  if (!browser) {
    return Promise.reject(new Error('IndexedDB is only available in browser environment'));
  }
  
  if (db) {
    return Promise.resolve(db);
  }
  
  if (isInitializing) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (db) {
          clearInterval(checkInterval);
          resolve(db);
        }
        if (!isInitializing && !db) {
          clearInterval(checkInterval);
          reject(new Error('Database initialization failed'));
        }
      }, 100);
    });
  }
  
  isInitializing = true;
  console.log('[IndexedDB] Initializing database:', DB_NAME);
  
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error('[IndexedDB] Error opening database:', event);
        isInitializing = false;
        reject(new Error('Could not open IndexedDB'));
      };
      
      request.onsuccess = (event) => {
        db = request.result;
        console.log('[IndexedDB] Database initialized successfully');
        isInitializing = false;
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const database = request.result;
        console.log('[IndexedDB] Creating/upgrading database structure...');
        
        // Create object stores for all our data types
        Object.entries(STORES).forEach(([name, storeName]) => {
          if (!database.objectStoreNames.contains(storeName)) {
            console.log(`[IndexedDB] Creating object store: ${storeName}`);
            database.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
    } catch (error) {
      console.error('[IndexedDB] Exception during initialization:', error);
      isInitializing = false;
      reject(error);
    }
  });
}

/**
 * Get the database instance, initializing if needed
 */
export async function getDB(): Promise<IDBDatabase> {
  if (!db) {
    return initializeDB();
  }
  return db;
}

/**
 * Generate a unique ID (matches the pattern used in Gun.js)
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * Save data to IndexedDB
 */
export async function put<T extends { id?: string }>(
  storeName: string,
  data: T,
): Promise<{ success: boolean, id: string, error?: string }> {
  try {
    const database = await getDB();
    
    // Ensure the data has an ID
    const dataWithId = { 
      ...data,
      id: data.id || generateId(),
    };
    
    return new Promise((resolve) => {
      const transaction = database.transaction(storeName, 'readwrite');
      
      transaction.onerror = (event) => {
        console.error(`[IndexedDB] Error in transaction for ${storeName}:`, event);
        resolve({ 
          success: false, 
          id: dataWithId.id as string, 
          error: 'Transaction error' 
        });
      };
      
      const store = transaction.objectStore(storeName);
      const request = store.put(dataWithId);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Successfully saved to ${storeName} with ID ${dataWithId.id}`);
        resolve({ 
          success: true, 
          id: dataWithId.id as string 
        });
      };
      
      request.onerror = (event) => {
        console.error(`[IndexedDB] Error saving to ${storeName}:`, event);
        resolve({ 
          success: false, 
          id: dataWithId.id as string, 
          error: 'Request error' 
        });
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Exception in put operation for ${storeName}:`, error);
    return { 
      success: false, 
      id: data.id || 'error', 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Get data from IndexedDB by ID
 */
export async function get<T>(
  storeName: string,
  id: string,
): Promise<{ success: boolean, data?: T, error?: string }> {
  try {
    const database = await getDB();
    
    return new Promise((resolve) => {
      const transaction = database.transaction(storeName, 'readonly');
      
      transaction.onerror = (event) => {
        console.error(`[IndexedDB] Error in transaction for ${storeName}:`, event);
        resolve({ success: false, error: 'Transaction error' });
      };
      
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      
      request.onsuccess = () => {
        if (request.result) {
          console.log(`[IndexedDB] Successfully retrieved from ${storeName} with ID ${id}`);
          resolve({ success: true, data: request.result as T });
        } else {
          console.log(`[IndexedDB] Item not found in ${storeName} with ID ${id}`);
          resolve({ success: false, error: 'Not found' });
        }
      };
      
      request.onerror = (event) => {
        console.error(`[IndexedDB] Error retrieving from ${storeName}:`, event);
        resolve({ success: false, error: 'Request error' });
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Exception in get operation for ${storeName}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Get all data from a store
 */
export async function getAll<T>(
  storeName: string,
): Promise<{ success: boolean, items?: Record<string, T>, error?: string }> {
  try {
    const database = await getDB();
    
    return new Promise((resolve) => {
      const transaction = database.transaction(storeName, 'readonly');
      
      transaction.onerror = (event) => {
        console.error(`[IndexedDB] Error in transaction for ${storeName}:`, event);
        resolve({ success: false, error: 'Transaction error' });
      };
      
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items: Record<string, T> = {};
        
        // Convert array to object with ID as key (matching Gun.js pattern)
        if (request.result) {
          request.result.forEach((item: any) => {
            if (item && item.id) {
              items[item.id] = item as T;
            }
          });
        }
        
        console.log(`[IndexedDB] Successfully retrieved ${Object.keys(items).length} items from ${storeName}`);
        resolve({ success: true, items });
      };
      
      request.onerror = (event) => {
        console.error(`[IndexedDB] Error retrieving all from ${storeName}:`, event);
        resolve({ success: false, error: 'Request error' });
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Exception in getAll operation for ${storeName}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Delete data from IndexedDB by ID
 */
export async function deleteItem(
  storeName: string,
  id: string,
): Promise<{ success: boolean, error?: string }> {
  try {
    const database = await getDB();
    
    return new Promise((resolve) => {
      const transaction = database.transaction(storeName, 'readwrite');
      
      transaction.onerror = (event) => {
        console.error(`[IndexedDB] Error in transaction for ${storeName}:`, event);
        resolve({ success: false, error: 'Transaction error' });
      };
      
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Successfully deleted from ${storeName} with ID ${id}`);
        resolve({ success: true });
      };
      
      request.onerror = (event) => {
        console.error(`[IndexedDB] Error deleting from ${storeName}:`, event);
        resolve({ success: false, error: 'Request error' });
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Exception in delete operation for ${storeName}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Clear all data from a store
 */
export async function clearStore(
  storeName: string,
): Promise<{ success: boolean, error?: string }> {
  try {
    const database = await getDB();
    
    return new Promise((resolve) => {
      const transaction = database.transaction(storeName, 'readwrite');
      
      transaction.onerror = (event) => {
        console.error(`[IndexedDB] Error in transaction for ${storeName}:`, event);
        resolve({ success: false, error: 'Transaction error' });
      };
      
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Successfully cleared store ${storeName}`);
        resolve({ success: true });
      };
      
      request.onerror = (event) => {
        console.error(`[IndexedDB] Error clearing store ${storeName}:`, event);
        resolve({ success: false, error: 'Request error' });
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Exception in clearStore operation for ${storeName}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Export store names (matching the Gun.js pattern)
export const stores = STORES;