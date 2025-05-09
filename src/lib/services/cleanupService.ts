import { getGun, nodes, put } from './gunService';
import { getCurrentUser } from './authService';

/**
 * Removes all decks from the database
 * @returns Promise<{success: boolean, removed: number, error?: string}>
 */
export async function cleanupAllDecks(): Promise<{success: boolean, removed: number, error?: string}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, removed: 0, error: 'Gun database is not initialized' };
    }

    // Count of how many decks were removed
    let removedCount = 0;
    
    return new Promise((resolve) => {
      // This will get all deck nodes
      gun.get(nodes.decks).map().once((deckData: any, deckId: string) => {
        if (!deckData) return;
        
        // Delete this deck node by setting it to null
        console.log(`Removing deck: ${deckId}`);
        gun.get(nodes.decks).get(deckId).put(null);
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
    console.error('Error cleaning up decks:', error);
    return {
      success: false,
      removed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Removes all cards from the database
 * @returns Promise<{success: boolean, removed: number, error?: string}>
 */
export async function cleanupAllCards(): Promise<{success: boolean, removed: number, error?: string}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, removed: 0, error: 'Gun database is not initialized' };
    }

    // Count of how many cards were removed
    let removedCount = 0;
    
    return new Promise((resolve) => {
      // This will get all card nodes
      gun.get(nodes.cards).map().once((cardData: any, cardId: string) => {
        if (!cardData) return;
        
        // Delete this card node by setting it to null
        console.log(`Removing card: ${cardId}`);
        gun.get(nodes.cards).get(cardId).put(null);
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
    console.error('Error cleaning up cards:', error);
    return {
      success: false,
      removed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Removes all games from the database
 * @returns Promise<{success: boolean, removed: number, error?: string}>
 */
export async function cleanupAllGames(): Promise<{success: boolean, removed: number, error?: string}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, removed: 0, error: 'Gun database is not initialized' };
    }

    // Count of how many games were removed
    let removedCount = 0;
    
    return new Promise((resolve) => {
      // This will get all game nodes
      gun.get(nodes.games).map().once((gameData: any, gameId: string) => {
        if (!gameData) return;
        
        // Delete this game node by setting it to null
        console.log(`Removing game: ${gameId}`);
        gun.get(nodes.games).get(gameId).put(null);
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
    console.error('Error cleaning up games:', error);
    return {
      success: false,
      removed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Removes all users except for an optional preserved user ID
 * @param preserveUserId Optional user ID to preserve (if not provided, removes all users)
 * @returns Promise<{success: boolean, removed: number, error?: string}>
 */
export async function cleanupUsers(preserveUserId?: string): Promise<{success: boolean, removed: number, error?: string}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, removed: 0, error: 'Gun database is not initialized' };
    }

    // Get current user data if we're not passing a specific user ID to preserve
    let currentUserId = preserveUserId;
    if (!currentUserId) {
      const currentUser = getCurrentUser();
      if (currentUser) {
        currentUserId = currentUser.user_id;
        console.log(`Keeping current user: ${currentUserId}`);
      } else {
        console.log('No user preserved - removing all users');
      }
    }

    // Count of how many users were removed
    let removedCount = 0;
    
    return new Promise((resolve) => {
      // This will get all user nodes
      gun.get(nodes.users).map().once((userData: any, userId: string) => {
        // Skip the user to preserve if one was specified
        if (currentUserId && userId === currentUserId) {
          console.log(`Skipping preserved user: ${userId}`);
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
 * Removes all users (admin function, no authentication required)
 * @returns Promise<{success: boolean, removed: number, error?: string}>
 */
export async function cleanupAllUsers(): Promise<{success: boolean, removed: number, error?: string}> {
  return cleanupUsers(undefined); // Pass undefined to remove all users
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

/**
 * Removes all actors from the database
 * @returns Promise<{success: boolean, removed: number, error?: string}>
 */
export async function cleanupAllActors(): Promise<{success: boolean, removed: number, error?: string}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, removed: 0, error: 'Gun database is not initialized' };
    }

    // Count of how many actors were removed
    let removedCount = 0;
    
    return new Promise((resolve) => {
      // This will get all actor nodes
      gun.get(nodes.actors).map().once((actorData: any, actorId: string) => {
        if (!actorData) return;
        
        // Delete this actor node by setting it to null
        console.log(`Removing actor: ${actorId}`);
        gun.get(nodes.actors).get(actorId).put(null);
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
    console.error('Error cleaning up actors:', error);
    return {
      success: false,
      removed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Removes all agreements from the database
 * @returns Promise<{success: boolean, removed: number, error?: string}>
 */
export async function cleanupAllAgreements(): Promise<{success: boolean, removed: number, error?: string}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, removed: 0, error: 'Gun database is not initialized' };
    }

    // Count of how many agreements were removed
    let removedCount = 0;
    
    return new Promise((resolve) => {
      // This will get all agreement nodes
      gun.get(nodes.agreements).map().once((agreementData: any, agreementId: string) => {
        if (!agreementData) return;
        
        // Delete this agreement node by setting it to null
        console.log(`Removing agreement: ${agreementId}`);
        gun.get(nodes.agreements).get(agreementId).put(null);
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
    console.error('Error cleaning up agreements:', error);
    return {
      success: false,
      removed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

