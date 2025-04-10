import { getGun, nodes } from './gunService';
import { getCurrentUser } from './authService';

/**
 * Removes all users except the currently logged in user
 * @returns Promise<{success: boolean, removed: number, error?: string}>
 */
export async function cleanupUsers(): Promise<{success: boolean, removed: number, error?: string}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, removed: 0, error: 'Gun database is not initialized' };
    }

    // Get current user data
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, removed: 0, error: 'No user is logged in' };
    }

    // Current user ID that we want to keep
    const currentUserId = currentUser.user_id;
    console.log(`Keeping current user: ${currentUserId}`);

    // Count of how many users were removed
    let removedCount = 0;
    
    return new Promise((resolve) => {
      // This will get all user nodes
      gun.get(nodes.users).map().once((userData: any, userId: string) => {
        // Skip the current user
        if (userId === currentUserId) {
          console.log(`Skipping current user: ${userId}`);
          return;
        }
        
        // Delete this user node by setting it to null
        console.log(`Removing user: ${userId}`);
        gun.get(nodes.users).get(userId).put(null);
        removedCount++;
      });

      // Give it some time to process all deletions
      setTimeout(() => {
        resolve({
          success: true,
          removed: removedCount,
        });
      }, 2000);
    });
  } catch (error) {
    console.error('Error cleaning up users:', error);
    return {
      success: false,
      removed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Remove a specific user by ID
 */
export async function removeUser(userId: string): Promise<{success: boolean, error?: string}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, error: 'Gun database is not initialized' };
    }

    // Current user ID that we're currently logged in as
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No user is logged in' };
    }

    // Prevent removing the current user
    if (userId === currentUser.user_id) {
      return { success: false, error: 'Cannot remove the current user' };
    }

    // Delete this user node
    gun.get(nodes.users).get(userId).put(null);
    
    return { success: true };
  } catch (error) {
    console.error('Error removing user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}