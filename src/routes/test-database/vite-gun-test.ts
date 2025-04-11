/**
 * Test utilities for Gun.js with Vite/SvelteKit
 * Based on the approach from https://github.com/amark/gun/wiki/Vite
 */

// Direct import of our Gun instance from the gun-db.js file
import db from '$lib/services/gun-db.js';

// Root path for test data
const TEST_ROOT = 'test_data';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * Clean an object for Gun.js - removes undefined values and converts arrays
 * to objects with numeric keys (Gun.js doesn't support arrays directly)
 */
export function cleanObject(obj: any): any {
  // Handle null and primitives
  if (obj === null || typeof obj !== 'object') return obj;
  
  // Handle arrays (convert to object with numeric keys)
  if (Array.isArray(obj)) {
    const result: Record<string, any> = {};
    obj.forEach((item, index) => {
      if (item !== undefined) {
        result[index] = cleanObject(item);
      }
    });
    return result;
  }
  
  // Handle objects (recursively)
  const cleanObj: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      cleanObj[key] = cleanObject(obj[key]);
    }
  }
  
  return cleanObj;
}

/**
 * Save a simple key-value pair to the database
 * This uses the no-ACK pattern for reliability
 */
export async function saveSimpleItem(data: any): Promise<{ success: boolean, id: string, error?: string }> {
  try {
    // Generate a unique ID for this test item
    const id = generateId();
    
    // Clean the data to ensure Gun compatibility
    const cleanData = cleanObject(data);
    
    console.log(`[ViteGunTest] Saving item with ID ${id}:`, JSON.stringify(cleanData));
    
    // Save the item without waiting for acknowledgment
    // This is more reliable with Gun.js and avoids timeouts
    db.get(TEST_ROOT).get(id).put(cleanData);
    
    // Add a small delay to allow Gun to process the write
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log(`[ViteGunTest] Item ${id} saved (no ack)`);
    return { success: true, id };
  } catch (error) {
    console.error(`[ViteGunTest] Exception saving item:`, error);
    return { success: false, id: '', error: String(error) };
  }
}

/**
 * Get a previously saved item from the database
 */
export async function getSimpleItem(id: string): Promise<{ success: boolean, data?: any, error?: string }> {
  return new Promise((resolve) => {
    // Use a reasonable timeout to ensure we don't hang
    const timeout = setTimeout(() => {
      console.warn(`[ViteGunTest] Timeout getting item ${id}`);
      resolve({ success: false, error: 'Timeout' });
    }, 1500);
    
    let dataReceived = false;
    
    try {
      // Request the data
      db.get(TEST_ROOT).get(id).once((data: any) => {
        dataReceived = true;
        clearTimeout(timeout);
        
        if (!data) {
          console.warn(`[ViteGunTest] Item ${id} not found`);
          resolve({ success: false, error: 'Not found' });
        } else {
          // Remove Gun metadata from the result
          const cleanedResult = { ...data };
          delete cleanedResult._;
          
          console.log(`[ViteGunTest] Successfully retrieved item ${id}:`, JSON.stringify(cleanedResult));
          resolve({ success: true, data: cleanedResult });
        }
      });
      
      // If data doesn't come back within 500ms, try an alternative approach
      // This helps when Gun might be slow to respond
      setTimeout(() => {
        if (!dataReceived) {
          console.log(`[ViteGunTest] Trying alternative approach for item ${id}`);
          db.get(TEST_ROOT).map().once((data: any, key: string) => {
            if (key === id && data) {
              dataReceived = true;
              clearTimeout(timeout);
              
              // Remove Gun metadata from the result
              const cleanedResult = { ...data };
              delete cleanedResult._;
              
              console.log(`[ViteGunTest] Found item ${id} using map() approach:`, JSON.stringify(cleanedResult));
              resolve({ success: true, data: cleanedResult });
            }
          });
        }
      }, 500);
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[ViteGunTest] Exception getting item ${id}:`, error);
      resolve({ success: false, error: String(error) });
    }
  });
}

/**
 * Get all items from the test root
 */
export async function getAllSimpleItems(): Promise<{ success: boolean, items?: Record<string, any>, error?: string }> {
  return new Promise((resolve) => {
    const items: Record<string, any> = {};
    let itemCount = 0;
    
    // Use a timeout to ensure we don't hang
    const timeout = setTimeout(() => {
      console.log(`[ViteGunTest] Finished getting ${itemCount} items (timed out after 2s)`);
      resolve({ success: true, items });
    }, 2000);
    
    try {
      // Get all items under the test root
      db.get(TEST_ROOT).map().once((data: any, key: string) => {
        if (data && key !== '_') {
          // Remove Gun metadata from the result
          const cleanedResult = { ...data };
          delete cleanedResult._;
          
          items[key] = cleanedResult;
          itemCount++;
        }
      });
      
      // Resolve after a short delay to collect results
      setTimeout(() => {
        clearTimeout(timeout);
        console.log(`[ViteGunTest] Successfully retrieved ${itemCount} items`);
        resolve({ success: true, items });
      }, 1000);
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[ViteGunTest] Exception getting all items:`, error);
      resolve({ success: false, error: String(error) });
    }
  });
}

/**
 * Delete an item from the database
 */
export async function deleteSimpleItem(id: string): Promise<{ success: boolean, error?: string }> {
  try {
    console.log(`[ViteGunTest] Deleting item ${id}`);
    
    // In Gun.js, you delete by setting to null
    // Don't wait for ack, which can cause timeouts
    db.get(TEST_ROOT).get(id).put(null);
    
    // Add a small delay to allow Gun to process the delete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log(`[ViteGunTest] Item ${id} deleted (no ack)`);
    return { success: true };
  } catch (error) {
    console.error(`[ViteGunTest] Exception deleting item ${id}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Clean up all test data
 */
export async function cleanupTestData(): Promise<{ success: boolean, error?: string }> {
  try {
    console.log(`[ViteGunTest] Cleaning up all test data`);
    
    // In Gun.js, you delete by setting to null
    // Don't wait for ack, which can cause timeouts
    db.get(TEST_ROOT).put(null);
    
    // Add a small delay to allow Gun to process the delete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log(`[ViteGunTest] All test data cleaned up (no ack)`);
    return { success: true };
  } catch (error) {
    console.error(`[ViteGunTest] Exception cleaning up test data:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if Gun.js is using persistent storage
 * Returns true if the storage is persistent (IndexedDB/Radisk)
 */
export function isPersistentStorage(): boolean {
  try {
    // If Gun.RAD is true, it means Radisk is active
    const usingRadisk = !!(db.back as any)?.opt?.radisk && !!(db as any)?._.opt?.radisk;
    
    // Additional check for the actual RAD property, which might be in a different location
    const hasRADProperty = !!(db as any).RAD === true || !!(db as any).back?.RAD === true;
    
    return usingRadisk || hasRADProperty;
  } catch (error) {
    console.error('[ViteGunTest] Error checking storage type:', error);
    return false;
  }
}