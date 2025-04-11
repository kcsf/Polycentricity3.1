import { getGun, nodes, generateId, put, createRelationship, type GunAck } from './gunService';

/**
 * SIMPLIFIED APPROACH FOR GUN.JS DATA INITIALIZATION
 * 
 * 1. No arrays anywhere (Gun.js doesn't handle them well)
 * 2. Use direct put operations with very simple data
 * 3. Add significant delays between operations
 * 4. Use a simpler pattern less dependent on callbacks
 * 5. Pay careful attention to Gun.js error patterns
 */

// Helper function to handle Gun.js callbacks with proper typing
function handleGunCallback(nodePath: string, ackName: string, ack: any): void {
  if (ack && ack.err) {
    console.warn(`Warning while saving ${nodePath} (${ackName}):`, ack.err);
  } else {
    console.log(`Successfully saved: ${nodePath} (${ackName})`);
  }
}

// Helper function to wait between Gun operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Simplified Gun put that doesn't rely on callbacks as much
async function safePut(path: string, key: string, data: any): Promise<boolean> {
  const gun = getGun();
  if (!gun) return false;
  
  return new Promise<boolean>(resolve => {
    console.log(`Saving to ${path}/${key}...`);
    
    gun.get(path).get(key).put(data, (ack: any) => {
      if (ack && ack.err) {
        console.warn(`Warning while saving to ${path}/${key}:`, ack.err);
        resolve(false);
      } else {
        console.log(`Successfully saved to ${path}/${key}`);
        resolve(true);
      }
    });
    
    // Safety timeout
    setTimeout(() => {
      console.log(`Timeout while saving to ${path}/${key} - continuing anyway`);
      resolve(true); // Still continue the process
    }, 3000);
  });
}

export async function initializeSampleData() {
  console.log('Initializing sample data with SIMPLIFIED Gun.js patterns...');
  const gun = getGun();
  if (!gun) {
    console.error('Failed to get Gun instance');
    return {
      success: false,
      message: 'Failed to get Gun instance'
    };
  }

  try {
    // STEP 1: Create and save users (one at a time with delays)
    const users = {
      'u123': {
        user_id: 'u123',
        name: 'Member User',
        email: 'member@example.com',
        created_at: Date.now(),
        role: 'Member'
      },
      'u124': {
        user_id: 'u124',
        name: 'Guest User',
        email: 'guest@example.com',
        created_at: Date.now(),
        role: 'Guest'
      },
      'u125': {
        user_id: 'u125',
        name: 'Admin User',
        email: 'admin@example.com',
        created_at: Date.now(),
        role: 'Admin'
      }
    };

    console.log('Saving users...');
    for (const userId in users) {
      const user = users[userId];
      await safePut(nodes.users, userId, user);
      await delay(1000); // Wait 1s between user saves
    }
    
    // STEP 2: Create and save cards (one at a time with delays)
    const cards = {
      'c1': {
        card_id: 'c1',
        card_number: 1,
        role_title: 'Verdant Weaver',
        backstory: 'A skilled cultivator who weaves plant life into sustainable systems.',
        values: {}, // Will be filled with relationship edges later
        goals: 'Create a self-sustaining garden, Train others in permaculture', // Stored as a string
        obligations: 'Must share knowledge with the community',
        capabilities: {}, // Will be filled with relationship edges later
        intellectual_property: 'Seed storage techniques',
        rivalrous_resources: 'Limited water supply',
        card_category: 'Providers',
        type: 'Practice',
        icon: 'Hammer',
        decks: {} // Will be filled with relationship edges later
      },
      'c2': {
        card_id: 'c2',
        card_number: 2,
        role_title: 'Luminos Funder',
        backstory: 'A visionary investor who funds innovative ecological projects.',
        values: {}, // Will be filled with relationship edges later
        goals: 'Fund 5 eco-projects, Create a funding network', // Stored as a string
        obligations: 'Must transparently report all funding allocations',
        capabilities: {}, // Will be filled with relationship edges later
        intellectual_property: 'Investment strategy methodologies',
        rivalrous_resources: 'Limited investment capital',
        card_category: 'Funders',
        type: 'DAO',
        icon: 'CircleDollarSign',
        decks: {} // Will be filled with relationship edges later
      }
    };

    console.log('Saving cards...');
    for (const cardId in cards) {
      const card = cards[cardId];
      await safePut(nodes.cards, cardId, card);
      await delay(1000); // Wait 1s between card saves
    }
    
    // STEP 3: Create and save a deck
    const deck = {
      deck_id: 'd1',
      name: 'Eco-Village Standard Deck',
      description: 'A standard deck for eco-village simulation games',
      creator: 'u125', // Created by Admin user
      created_at: Date.now(),
      updated_at: Date.now(),
      cards: {} // Will be filled with relationship edges later
    };
    
    console.log('Saving deck...');
    await safePut(nodes.decks, 'd1', deck);
    await delay(1000); // Wait 1s before next operation
    
    // STEP 4: Set up relationships between deck and cards
    console.log('Creating deck-card relationships...');
    // Simple way to create a relationship - for each card, add a reference in the deck
    for (const cardId in cards) {
      // Create a simple reference from deck to card (id: true pattern)
      await new Promise<void>(resolve => {
        gun.get(nodes.decks).get('d1').get('cards').get(cardId).put(true, (ack: any) => {
          if (ack && ack.err) {
            console.warn(`Warning creating deck->card relationship for ${cardId}:`, ack.err);
          } else {
            console.log(`Successfully created deck->card relationship for ${cardId}`);
          }
          resolve();
        });
        
        // Safety timeout
        setTimeout(resolve, 3000);
      });
      
      // Create reverse relationship (card to deck)
      await new Promise<void>(resolve => {
        gun.get(nodes.cards).get(cardId).get('decks').get('d1').put(true, (ack: any) => {
          if (ack && ack.err) {
            console.warn(`Warning creating card->deck relationship for ${cardId}:`, ack.err);
          } else {
            console.log(`Successfully created card->deck relationship for ${cardId}`);
          }
          resolve();
        });
        
        // Safety timeout
        setTimeout(resolve, 3000);
      });
      
      await delay(1000); // Wait 1s between relationship sets
    }
    
    // STEP 5: Create and save a game
    const game = {
      game_id: 'g456',
      name: 'Test Eco-Village',
      creator: 'u125', // Created by Admin user
      deck_id: 'd1',
      role_assignment: 'choice',
      players: { u123: true, u124: true }, // Object format instead of array
      created_at: Date.now(),
      status: 'active'
    };
    
    console.log('Saving game...');
    await safePut(nodes.games, 'g456', game);
    await delay(1000); // Wait 1s before next operation
    
    // STEP 6: Create and save actors
    const actors = {
      'a1': {
        actor_id: 'a1',
        game_id: 'g456',
        user_id: 'u123',
        card_id: 'c1'
      },
      'a2': {
        actor_id: 'a2',
        game_id: 'g456',
        user_id: 'u124',
        card_id: 'c2'
      }
    };
    
    console.log('Saving actors...');
    for (const actorId in actors) {
      const actor = actors[actorId];
      await safePut(nodes.actors, actorId, actor);
      await delay(1000); // Wait 1s between actor saves
    }
    
    // STEP 7: Create and save agreement
    const agreement = {
      agreement_id: 'ag1',
      game_id: 'g456',
      title: 'Funding for Garden Initiative',
      summary: 'Luminos Funder provides capital to Verdant Weaver for a community garden',
      type: 'asymmetric',
      parties: { 0: 'a1', 1: 'a2' }, // Object format for the parties (not array)
      obligations: {
        a1: 'Create and maintain community garden for one year',
        a2: 'Provide 5000 credits of funding and quarterly reviews'
      },
      benefits: {
        a1: 'Receives funding and resources for the garden',
        a2: 'Receives 10% of produce and community recognition'
      },
      status: 'accepted',
      created_at: Date.now()
    };
    
    console.log('Saving agreement...');
    await safePut(nodes.agreements, 'ag1', agreement);
    await delay(1000); // Wait 1s before next operation
    
    // STEP 8: Create and save chat
    const chat = {
      chat_id: 'g456_group',
      game_id: 'g456',
      type: 'group',
      participants: { 0: 'u123', 1: 'u124' }, // Object format (not array)
      messages: {
        0: {
          id: generateId(),
          user_id: 'u123',
          user_name: 'Member User',
          content: 'Hello! Let\'s start planning our eco-village!',
          timestamp: Date.now(),
          type: 'group'
        }
      }
    };
    
    console.log('Saving chat...');
    await safePut(nodes.chat, 'g456_group', chat);
    await delay(1000); // Wait 1s before next operation
    
    // STEP 9: Create and save node positions
    const positions = {
      'a1': {
        node_id: 'a1',
        game_id: 'g456',
        x: 100,
        y: 100
      },
      'ag1': {
        node_id: 'ag1',
        game_id: 'g456',
        x: 300,
        y: 200
      }
    };
    
    console.log('Saving node positions...');
    for (const nodeId in positions) {
      const position = positions[nodeId];
      await safePut(nodes.positions, nodeId, position);
      await delay(1000); // Wait 1s between position saves
    }
    
    console.log('Sample data initialization complete!');
    return { 
      success: true, 
      message: 'Sample data initialized successfully using simplified Gun.js patterns' 
    };
  } catch (error) {
    console.error('Error initializing sample data:', error);
    return { 
      success: false, 
      message: `Error initializing sample data: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

// Verify the sample data by logging and counting each node type
export async function verifySampleData() {
  console.log('Verifying sample data with improved counting...');
  const gun = getGun();
  if (!gun) {
    console.error('Failed to get Gun instance');
    return {
      success: false,
      message: 'Failed to get Gun instance'
    };
  }

  try {
    const stats: Record<string, { count: number; items: string[] }> = {};
    
    // Helper function to check a node type
    async function checkNodeType(nodeType: string): Promise<void> {
      return new Promise((resolve) => {
        console.log(`Checking ${nodeType}...`);
        const items: string[] = [];
        let count = 0;
        
        gun.get(nodeType).map().once((data: any, key: string) => {
          if (data) {
            count++;
            items.push(key);
            console.log(`Found ${nodeType} with key:`, key, data);
          }
        });
        
        // Need a timeout since Gun's once() doesn't tell us when it's done
        setTimeout(() => {
          console.log(`Found ${count} items in ${nodeType}: ${items.join(', ')}`);
          stats[nodeType] = { count, items };
          resolve();
        }, 2000);
      });
    }
    
    // Check all node types
    await checkNodeType(nodes.users);
    await checkNodeType(nodes.cards);
    await checkNodeType(nodes.decks);
    await checkNodeType(nodes.games);
    await checkNodeType(nodes.actors);
    await checkNodeType(nodes.agreements);
    await checkNodeType(nodes.chat);
    await checkNodeType(nodes.positions);
    
    console.log('Verification summary:');
    for (const nodeType in stats) {
      console.log(`${nodeType}: ${stats[nodeType].count} items`);
      if (stats[nodeType].items.length > 0) {
        console.log(`  Items: ${stats[nodeType].items.join(', ')}`);
      }
    }
    
    // Check if we have data
    const hasData = Object.values(stats).some(stat => stat.count > 0);
    
    console.log('Verification complete!');
    return { 
      success: hasData, 
      message: hasData 
        ? 'Sample data verification completed successfully'
        : 'No data found in the database'
    };
  } catch (error) {
    console.error('Error verifying sample data:', error);
    return { 
      success: false, 
      message: `Error verifying sample data: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}