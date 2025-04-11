/**
 * Minimal Gun.js test utility
 * This file provides simplified functions for testing Gun.js database operations
 * with proper error handling and logging
 */

import { getGun, generateId } from '$lib/services/gunService';

// Root location for test data
const TEST_ROOT = 'test_data';

/**
 * Clean an object for Gun.js - removes undefined values and converts arrays
 * to objects with numeric keys.
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
 */
export async function saveSimpleItem(data: any): Promise<{ success: boolean, id: string, error?: string }> {
  const gun = getGun();
  if (!gun) {
    return { success: false, id: '', error: 'Gun not initialized' };
  }
  
  // Generate a unique ID for this test item
  const id = generateId();
  
  // Clean the data to ensure Gun compatibility
  const cleanData = cleanObject(data);
  
  console.log(`[SimpleTest] Saving item with ID ${id}:`, JSON.stringify(cleanData));
  
  return new Promise((resolve) => {
    // Use a timeout to ensure we don't hang
    const timeout = setTimeout(() => {
      console.warn(`[SimpleTest] Timeout saving item ${id}`);
      resolve({ success: false, id, error: 'Timeout' });
    }, 5000);
    
    try {
      // Perform the actual save operation
      gun.get(TEST_ROOT).get(id).put(cleanData, (ack: any) => {
        clearTimeout(timeout);
        
        if (ack && ack.err) {
          console.error(`[SimpleTest] Error saving item ${id}:`, ack.err);
          resolve({ success: false, id, error: String(ack.err) });
        } else {
          console.log(`[SimpleTest] Successfully saved item ${id}`);
          resolve({ success: true, id });
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[SimpleTest] Exception saving item ${id}:`, error);
      resolve({ success: false, id, error: String(error) });
    }
  });
}

/**
 * Get a previously saved item from the database
 */
export async function getSimpleItem(id: string): Promise<{ success: boolean, data?: any, error?: string }> {
  const gun = getGun();
  if (!gun) {
    return { success: false, error: 'Gun not initialized' };
  }
  
  console.log(`[SimpleTest] Getting item ${id}`);
  
  return new Promise((resolve) => {
    // Use a timeout to ensure we don't hang
    const timeout = setTimeout(() => {
      console.warn(`[SimpleTest] Timeout getting item ${id}`);
      resolve({ success: false, error: 'Timeout' });
    }, 5000);
    
    try {
      // Perform the actual get operation
      gun.get(TEST_ROOT).get(id).once((data) => {
        clearTimeout(timeout);
        
        if (!data) {
          console.warn(`[SimpleTest] Item ${id} not found`);
          resolve({ success: false, error: 'Not found' });
        } else {
          // Remove Gun metadata from the result
          const cleanedResult = { ...data };
          delete cleanedResult._;
          
          console.log(`[SimpleTest] Successfully retrieved item ${id}:`, JSON.stringify(cleanedResult));
          resolve({ success: true, data: cleanedResult });
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[SimpleTest] Exception getting item ${id}:`, error);
      resolve({ success: false, error: String(error) });
    }
  });
}

/**
 * Get all items from the test root
 */
export async function getAllSimpleItems(): Promise<{ success: boolean, items?: Record<string, any>, error?: string }> {
  const gun = getGun();
  if (!gun) {
    return { success: false, error: 'Gun not initialized' };
  }
  
  console.log(`[SimpleTest] Getting all items`);
  
  return new Promise((resolve) => {
    const items: Record<string, any> = {};
    let itemCount = 0;
    
    // Use a timeout to ensure we don't hang
    const timeout = setTimeout(() => {
      console.log(`[SimpleTest] Finished getting ${itemCount} items (timed out after 3s)`);
      resolve({ success: true, items });
    }, 3000);
    
    try {
      // Get all items under the test root
      gun.get(TEST_ROOT).map().once((data, key) => {
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
        console.log(`[SimpleTest] Successfully retrieved ${itemCount} items`);
        resolve({ success: true, items });
      }, 1000);
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[SimpleTest] Exception getting all items:`, error);
      resolve({ success: false, error: String(error) });
    }
  });
}

/**
 * Delete an item from the database
 */
export async function deleteSimpleItem(id: string): Promise<{ success: boolean, error?: string }> {
  const gun = getGun();
  if (!gun) {
    return { success: false, error: 'Gun not initialized' };
  }
  
  console.log(`[SimpleTest] Deleting item ${id}`);
  
  return new Promise((resolve) => {
    // Use a timeout to ensure we don't hang
    const timeout = setTimeout(() => {
      console.warn(`[SimpleTest] Timeout deleting item ${id}`);
      resolve({ success: false, error: 'Timeout' });
    }, 5000);
    
    try {
      // In Gun.js, you delete by setting to null
      gun.get(TEST_ROOT).get(id).put(null, (ack: any) => {
        clearTimeout(timeout);
        
        if (ack && ack.err) {
          console.error(`[SimpleTest] Error deleting item ${id}:`, ack.err);
          resolve({ success: false, error: String(ack.err) });
        } else {
          console.log(`[SimpleTest] Successfully deleted item ${id}`);
          resolve({ success: true });
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[SimpleTest] Exception deleting item ${id}:`, error);
      resolve({ success: false, error: String(error) });
    }
  });
}

/**
 * Clean up all test data
 */
export async function cleanupTestData(): Promise<{ success: boolean, error?: string }> {
  const gun = getGun();
  if (!gun) {
    return { success: false, error: 'Gun not initialized' };
  }
  
  console.log(`[SimpleTest] Cleaning up all test data`);
  
  return new Promise((resolve) => {
    // Use a timeout to ensure we don't hang
    const timeout = setTimeout(() => {
      console.warn(`[SimpleTest] Timeout cleaning up test data`);
      resolve({ success: false, error: 'Timeout' });
    }, 5000);
    
    try {
      // In Gun.js, you delete by setting to null
      gun.get(TEST_ROOT).put(null, (ack: any) => {
        clearTimeout(timeout);
        
        if (ack && ack.err) {
          console.error(`[SimpleTest] Error cleaning up test data:`, ack.err);
          resolve({ success: false, error: String(ack.err) });
        } else {
          console.log(`[SimpleTest] Successfully cleaned up test data`);
          resolve({ success: true });
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[SimpleTest] Exception cleaning up test data:`, error);
      resolve({ success: false, error: String(error) });
    }
  });
}