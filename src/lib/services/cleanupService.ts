import { getGun, nodes, put, purgeNode } from './gunService';
import { getCurrentUser } from './authService';
import { createValue } from './valueService';
import { createCapability } from './capabilityService';

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

/**
 * Enhance all cards with additional values and capabilities
 * This ensures all cards have at least 3 values and 3 capabilities for visualization purposes
 * 
 * @returns Promise with details of the enhancement operation
 */
/**
 * Cleanup null card references in decks
 * This removes null entries from deck cards_ref and ensures 
 * database consistency
 * 
 * @returns Promise with details of the cleanup operation
 */
export async function cleanupNullCardReferences(): Promise<{
  success: boolean;
  removed: number;
  error?: string;
}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, removed: 0, error: 'Gun database is not initialized' };
    }

    let removedCount = 0;
    
    // Track processed items to prevent duplicate processing
    const processedItems = new Set<string>();
    
    return new Promise((resolve) => {
      console.log('Starting database reference cleanup...');
      
      // First pass: check all decks for null card references - LIMITED TO KNOWN DECKS ONLY
      // Only process the known decks we expect to have
      const knownDeckIds = ['d_1'];
      
      knownDeckIds.forEach(deckId => {
        gun.get(`${nodes.decks}/${deckId}`).get('cards_ref').map().once((value: any, cardId: string) => {
          // Skip if already processed this item
          const itemKey = `deck:${deckId}:card:${cardId}`;
          if (processedItems.has(itemKey)) return;
          processedItems.add(itemKey);
          
          // If this is a null reference or an invalid format, remove it
          const isValidCardId = /^card_\d+$/.test(cardId);
          const isNullReference = value === null;
          
          if (isNullReference || !isValidCardId) {
            console.log(`Removing null/invalid card reference ${cardId} from deck ${deckId}`);
            // Direct nullification using Gun.js
            gun.get(`${nodes.decks}/${deckId}`).get('cards_ref').get(cardId).put(null);
            removedCount++;
          } else {
            // For valid cards, verify they actually exist
            gun.get(nodes.cards).get(cardId).once((cardData: any) => {
              if (!cardData) {
                console.log(`Removing reference to non-existent card ${cardId} from deck ${deckId}`);
                // Direct nullification using Gun.js
                gun.get(`${nodes.decks}/${deckId}`).get('cards_ref').get(cardId).put(null);
                removedCount++;
              }
            });
          }
        });
      });
      
      // Instead of doing separate passes, just clean up the known problematic card IDs
      const specificProblematicIds = [
        "card_7252", 
        "card_1542"
      ];
      
      // Aggressively clear these specific IDs from cards node
      for (const badCardId of specificProblematicIds) {
        console.log(`Checking for problematic card ID: ${badCardId}`);
        
        // Only nullify the card in the cards collection if it exists
        gun.get(nodes.cards).get(badCardId).once((data: any) => {
          if (data === null) return; // Skip if already null
          
          console.log(`Nullifying problematic card: ${badCardId}`);
          gun.get(nodes.cards).get(badCardId).put(null);
          removedCount++;
        });
        
        // Clean up references from known decks (strictly limited)
        knownDeckIds.forEach(deckId => {
          gun.get(`${nodes.decks}/${deckId}`).get('cards_ref').get(badCardId).once((data: any) => {
            if (data !== null) {
              console.log(`Removing problematic card ${badCardId} from deck ${deckId}`);
              // Direct nullification using Gun.js
              gun.get(`${nodes.decks}/${deckId}`).get('cards_ref').get(badCardId).put(null);
              removedCount++;
            }
          });
        });
      }
      
      // Give time for operations to complete, using a shorter timeout
      setTimeout(() => {
        console.log(`Cleanup complete. Removed ${removedCount} invalid references.`);
        resolve({
          success: true,
          removed: removedCount,
        });
      }, 1000);
    });
  } catch (error) {
    console.error('Error cleaning up null card references:', error);
    return {
      success: false,
      removed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function enhanceCardValuesAndCapabilities(): Promise<{
  success: boolean,
  cardsUpdated: number,
  error?: string
}> {
  try {
    const gun = getGun();
    if (!gun) {
      return { success: false, cardsUpdated: 0, error: 'Gun database is not initialized' };
    }

    // Additional values to add if a card has fewer than 3
    const additionalValues = [
      'Ecological Thinking',
      'Self Reliance',
      'Social Justice'
    ];

    // Additional capabilities to add if a card has fewer than 3
    const additionalCapabilities = [
      'Networking',
      'Facilitation',
      'Technical Expertise'
    ];

    // Count of how many cards were updated
    let updatedCount = 0;
    
    return new Promise((resolve) => {
      // This will get all card nodes
      gun.get(nodes.cards).map().once(async (cardData: any, cardId: string) => {
        if (!cardData) return;
        
        // Count existing values and capabilities
        const existingValues = cardData.values ? Object.keys(cardData.values) : [];
        const existingCapabilities = cardData.capabilities ? Object.keys(cardData.capabilities) : [];
        
        // Calculate how many values and capabilities to add
        const valuesToAddCount = Math.max(0, 3 - existingValues.length);
        const capsToAddCount = Math.max(0, 3 - existingCapabilities.length);
        
        // Skip if card already has enough values and capabilities
        if (valuesToAddCount === 0 && capsToAddCount === 0) {
          console.log(`Card ${cardId} already has sufficient values and capabilities.`);
          return;
        }
        
        // Create a copy of the card data to modify
        const updatedCard = { ...cardData };
        
        // Make sure the values and capabilities properties exist as objects
        if (!updatedCard.values) updatedCard.values = {};
        if (!updatedCard.capabilities) updatedCard.capabilities = {};
        
        // Function to generate a deterministic index based on card ID
        const getConsistentIndex = (cardId: string, offset: number = 0): number => {
          const sum = cardId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return (sum + offset) % 3; // Use mod 3 to get index between 0-2
        };
        
        // Add additional values
        if (valuesToAddCount > 0) {
          for (let i = 0; i < valuesToAddCount; i++) {
            const valueIndex = getConsistentIndex(cardId, i);
            const valueName = additionalValues[valueIndex];
            
            // Create the value in the database
            const value = await createValue(valueName);
            if (value) {
              // Add to the card's values record
              updatedCard.values[value.value_id] = true;
              console.log(`Added value ${valueName} to card ${cardId}`);
            }
          }
        }
        
        // Add additional capabilities
        if (capsToAddCount > 0) {
          for (let i = 0; i < capsToAddCount; i++) {
            const capIndex = getConsistentIndex(cardId, i + 10); // Use offset to get different index than values
            const capName = additionalCapabilities[capIndex];
            
            // Create the capability in the database
            const capability = await createCapability(capName);
            if (capability) {
              // Add to the card's capabilities record
              updatedCard.capabilities[capability.capability_id] = true;
              console.log(`Added capability ${capName} to card ${cardId}`);
            }
          }
        }
        
        // Update the card in Gun.js database
        await put(`${nodes.cards}/${cardId}`, updatedCard);
        updatedCount++;
        console.log(`Updated card ${cardId} with additional values and capabilities`);
      });

      // Give it some time to process all updates
      setTimeout(() => {
        resolve({
          success: true,
          cardsUpdated: updatedCount,
        });
      }, 3000); // Longer timeout for updates
    });
  } catch (error) {
    console.error('Error enhancing card values and capabilities:', error);
    return {
      success: false,
      cardsUpdated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}