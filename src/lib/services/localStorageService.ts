/**
 * Local Storage Management Service
 * Handles database wipe functionality for returning users based on admin-configured cutoff dates
 */

import { getGun, get, nodes } from './gunService';
import type { User } from '$lib/types';

/**
 * Clear local Gun.js storage for users with last_login before cutoff date or missing last_login
 * @param userId - User ID to check
 * @param cutoffDate - Timestamp cutoff for clearing storage
 * @returns Promise<boolean> - true if storage was cleared, false otherwise
 */
export async function clearLocalStorageForReturningUser(userId: string, cutoffDate: number): Promise<boolean> {
  try {
    const gun = getGun();
    if (!gun) throw new Error('Gun not initialized');
    
    // Check user's last_login timestamp
    const user = await get<User>(`${nodes.users}/${userId}`);
    if (!user) {
      console.log(`[localStorageService] User ${userId} not found in database`);
      return false;
    }
    
    // Clear storage if last_login is before cutoff OR is null/undefined
    const shouldClear = !user.last_login || user.last_login < cutoffDate;
    
    if (shouldClear) {
      console.log(`[localStorageService] Clearing local storage for user ${userId} (last_login: ${user.last_login}, cutoff: ${cutoffDate})`);
      
      // Clear localStorage entries that start with 'gun'
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('gun')) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear Gun's default localStorage key patterns
      localStorage.removeItem('gun/');
      localStorage.removeItem('gun');
      
      console.log(`[localStorageService] Successfully cleared local storage for user ${userId}`);
      return true;
    }
    
    console.log(`[localStorageService] User ${userId} last_login (${user.last_login}) is after cutoff (${cutoffDate}), keeping local storage`);
    return false;
    
  } catch (error) {
    console.error('[localStorageService] Error clearing local storage:', error);
    return false;
  }
}

/**
 * Get the admin-configured database wipe cutoff date
 * @returns Promise<number | null> - cutoff timestamp or null if not set
 */
export async function getWipeCutoffDate(): Promise<number | null> {
  try {
    const gun = getGun();
    if (!gun) return null;
    
    // Use Gun.js direct access for admin config since it's not in our typed schema
    const config = await new Promise<any>((resolve) => {
      gun.get('admin').get('database_config').once((data) => resolve(data));
      setTimeout(() => resolve(null), 1000);
    });
    return config?.wipe_cutoff_date || null;
  } catch (error) {
    console.error('[localStorageService] Error getting wipe cutoff date:', error);
    return null;
  }
}

/**
 * Set the admin-configured database wipe cutoff date
 * @param cutoffDate - Timestamp for the cutoff date
 * @returns Promise<boolean> - true if successful
 */
export async function setWipeCutoffDate(cutoffDate: number): Promise<boolean> {
  try {
    const gun = getGun();
    if (!gun) throw new Error('Gun not initialized');
    
    await gun.get('admin').get('database_config').put({ 
      wipe_cutoff_date: cutoffDate,
      updated_at: Date.now()
    } as any);
    
    console.log(`[localStorageService] Set database wipe cutoff date to ${new Date(cutoffDate).toISOString()}`);
    return true;
  } catch (error) {
    console.error('[localStorageService] Error setting wipe cutoff date:', error);
    return false;
  }
}

/**
 * Check if local storage should be cleared on app initialization
 * Called during auth initialization to automatically handle returning users
 * @param userId - Current user ID
 * @returns Promise<boolean> - true if storage was cleared
 */
export async function checkAndClearStorageOnInit(userId: string): Promise<boolean> {
  const cutoffDate = await getWipeCutoffDate();
  if (!cutoffDate) {
    console.log('[localStorageService] No wipe cutoff date configured, skipping storage check');
    return false;
  }
  
  return await clearLocalStorageForReturningUser(userId, cutoffDate);
}