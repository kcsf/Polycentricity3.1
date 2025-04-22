/**
 * gunResetService.ts
 * Utility service for resetting Gun.js database and user information
 */

import { getGun, getUser } from './gunService';

/**
 * Clear a specific user from Gun SEA authentication system
 * This is useful when Gun reports "User already created" but you want to recreate it
 * 
 * Note: This is a hack and not an official Gun.js method. It may not work in all cases.
 * 
 * @param email Email to clear from Gun's user system
 * @returns Boolean indicating success
 */
export async function clearUserFromGun(email: string): Promise<boolean> {
  try {
    const gun = getGun();
    if (!gun) return false;
    
    console.log(`Attempting to clear user with email: ${email}`);
    
    // Try to find and remove associated Gun.js localStorage entries
    const localStorageKey = `~@${email}`;
    localStorage.removeItem(localStorageKey);
    
    // Clear any other potential user data
    const emailHash = encodeURIComponent(email.toLowerCase());
    const aliases = [`~@${email}`, `~@${emailHash}`, `~${email}`, `~${emailHash}`];
    
    aliases.forEach(alias => {
      // Direct null put - this is a hack but can help in some cases
      gun.get(alias).put(null);
      localStorage.removeItem(alias);
    });
    
    console.log('User data may have been cleared. Try registering again.');
    return true;
  } catch (error) {
    console.error('Error clearing user:', error);
    return false;
  }
}

/**
 * Clear all authentication data from Gun and localStorage
 * Use this as a last resort when authentication issues persist
 */
export function resetGunAuth(): void {
  try {
    // Clear all authentication data from localStorage
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('gun/') || 
        key.includes('sea') || 
        key.startsWith('~@') || 
        key.startsWith('~')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} Gun-related items from localStorage`);
    
    // Reload the page to reinitialize Gun
    window.location.reload();
  } catch (error) {
    console.error('Error resetting Gun auth:', error);
  }
}