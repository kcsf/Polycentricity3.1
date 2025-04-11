/**
 * Simple IndexedDB Test Module
 * 
 * A set of utilities for testing IndexedDB operations.
 */

import { 
  generateId, 
  put, 
  get, 
  getAll, 
  deleteItem, 
  clearStore, 
  stores,
  initializeDB,
} from '$lib/services/indexedDBService';

// Use the same test store as in the Gun.js version for consistency
const TEST_STORE = stores.test_data;

/**
 * Clean any null or undefined values from an object (recursively)
 * This ensures we don't have data that IndexedDB can't store properly
 */
function cleanObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const cleanObj: any = Array.isArray(obj) 
    ? [] 
    : {};
  
  Object.entries(obj).forEach(([key, value]) => {
    // Skip undefined values
    if (value === undefined) return;
    
    // Clean nested objects recursively
    if (value !== null && typeof value === 'object') {
      cleanObj[key] = cleanObject(value);
    } else {
      cleanObj[key] = value;
    }
  });
  
  return cleanObj;
}

/**
 * Save a simple key-value pair to the database
 */
export async function saveSimpleItem(data: any): Promise<{ success: boolean, id: string, error?: string }> {
  try {
    // Initialize the database if needed
    await initializeDB();
    
    // Clean the data to ensure compatibility
    const cleanData = cleanObject(data);
    
    console.log(`[IndexedDBTest] Saving item:`, JSON.stringify(cleanData));
    
    // Save the item
    const result = await put(TEST_STORE, cleanData);
    
    if (result.success) {
      console.log(`[IndexedDBTest] Successfully saved item with ID ${result.id}`);
    } else {
      console.error(`[IndexedDBTest] Error saving item:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`[IndexedDBTest] Exception in saveSimpleItem:`, error);
    return { 
      success: false, 
      id: '', 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Get a previously saved item from the database
 */
export async function getSimpleItem(id: string): Promise<{ success: boolean, data?: any, error?: string }> {
  try {
    // Initialize the database if needed
    await initializeDB();
    
    console.log(`[IndexedDBTest] Getting item with ID ${id}`);
    
    // Get the item
    const result = await get(TEST_STORE, id);
    
    if (result.success) {
      console.log(`[IndexedDBTest] Successfully retrieved item:`, result.data);
    } else {
      console.warn(`[IndexedDBTest] Error retrieving item:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`[IndexedDBTest] Exception in getSimpleItem:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Get all items from the test store
 */
export async function getAllSimpleItems(): Promise<{ success: boolean, items?: Record<string, any>, error?: string }> {
  try {
    // Initialize the database if needed
    await initializeDB();
    
    console.log(`[IndexedDBTest] Getting all items`);
    
    // Get all items
    const result = await getAll(TEST_STORE);
    
    if (result.success) {
      const itemCount = Object.keys(result.items || {}).length;
      console.log(`[IndexedDBTest] Successfully retrieved ${itemCount} items`);
    } else {
      console.warn(`[IndexedDBTest] Error retrieving items:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`[IndexedDBTest] Exception in getAllSimpleItems:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Delete an item from the database
 */
export async function deleteSimpleItem(id: string): Promise<{ success: boolean, error?: string }> {
  try {
    // Initialize the database if needed
    await initializeDB();
    
    console.log(`[IndexedDBTest] Deleting item with ID ${id}`);
    
    // Delete the item
    const result = await deleteItem(TEST_STORE, id);
    
    if (result.success) {
      console.log(`[IndexedDBTest] Successfully deleted item with ID ${id}`);
    } else {
      console.warn(`[IndexedDBTest] Error deleting item:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`[IndexedDBTest] Exception in deleteSimpleItem:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Clean up all test data
 */
export async function cleanupTestData(): Promise<{ success: boolean, error?: string }> {
  try {
    // Initialize the database if needed
    await initializeDB();
    
    console.log(`[IndexedDBTest] Cleaning up all test data`);
    
    // Clear the test store
    const result = await clearStore(TEST_STORE);
    
    if (result.success) {
      console.log(`[IndexedDBTest] Successfully cleaned up all test data`);
    } else {
      console.warn(`[IndexedDBTest] Error cleaning up test data:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`[IndexedDBTest] Exception in cleanupTestData:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}