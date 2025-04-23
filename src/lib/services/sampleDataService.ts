/****************************************************************************************
 * sampleDataService.ts
 * -------------------------------------------------------------------------------------
 * Data initialization service that follows the schema exactly as defined in GunSchema.md
 * Uses gameService.ts for game-related operations
 * Uses gunService.ts createRelationship for bidirectional relationships
 ***************************************************************************************/

import { getGun, nodes, generateId, type GunAck, createRelationship } from "./gunService";
import { createGame, createActor, createAgreement, joinGame, assignCardToActor } from "./gameService";

// Helper function to wait between Gun operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Optimized put operation for sample data with reduced timeouts and minimal logging
 */
async function robustPut(path: string, key: string, data: any): Promise<boolean> {
  const gun = getGun();
  if (!gun) {
    console.error(`[sampleData] Cannot save to ${path}/${key} - Gun not initialized`);
    return false;
  }
  
  function deepClean(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      const result: Record<string, any> = {};
      obj.forEach((val, idx) => { 
        if (val !== undefined) result[idx] = deepClean(val);
      });
      return result;
    }
    const cleanObj: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
        cleanObj[key] = deepClean(obj[key]);
      }
    }
    return cleanObj;
  }
  
  const cleanData = deepClean(data);
  
  return new Promise<boolean>((resolve) => {
    try {
      gun.get(path).get(key).put(cleanData, (ack: any) => {
        if (ack && ack.err) {
          console.warn(`[sampleData] Error saving to ${path}/${key}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
      setTimeout(() => resolve(true), 1000);
    } catch (error) {
      console.error(`[sampleData] Exception for ${path}/${key}`);
      resolve(false);
    }
  });
}

/**
 * Initialize sample data following the schema in GunSchema.md
 */
export async function initializeSampleData() {
  console.log("[seed] Initializing sample data according to GunSchema.md...");
  const gun = getGun();
  if (!gun) {
    return { success: false, message: "Gun not initialized" };
  }

  const now = Date.now();

  // Define users
  const users = [
    { 
      user_id: "u_123", 
      name: "Alice Admin", 
      email: "alice@example.com", 
      role: "Admin", 
      created_at: now 
    },
    { 
      user_id: "u_124", 
      name: "Bob Member", 
      email: "bob@example.com", 
      role: "Member", 
      created_at: now 
    },
    { 
      user_id: "u_125", 
      name: "Charlie Guest", 
      email: "charlie@example.com", 
      role: "Guest", 
      created_at: now 
    }
  ];

  // Define values
  const values = [
    { 
      value_id: "value_sustainability", 
      name: "Sustainability", 
      description: "Practices that can be maintained indefinitely without depleting resources", 
      creator_ref: "u_123", 
      cards_ref: {}, 
      created_at: now 
    },
    { 
      value_id: "value_community", 
      name: "Community", 
      description: "Focus on building social connections and shared resources", 
      creator_ref: "u_123", 
      cards_ref: {}, 
      created_at: now 
    },
    { 
      value_id: "value_transparency", 
      name: "Transparency", 
      description: "Open and clear communication about decisions and processes", 
      creator_ref: "u_123", 
      cards_ref: {}, 
      created_at: now 
    }
  ];

  // Define capabilities
  const capabilities = [
    { 
      capability_id: "cap_permaculture", 
      name: "Permaculture Design", 
      description: "Ability to design sustainable agricultural ecosystems", 
      creator_ref: "u_123", 
      cards_ref: {}, 
      created_at: now 
    },
    { 
      capability_id: "cap_fundraising", 
      name: "Fundraising", 
      description: "Skills in raising capital for community projects", 
      creator_ref: "u_123", 
      cards_ref: {}, 
      created_at: now 
    },
    { 
      capability_id: "cap_community_organizing", 
      name: "Community Organizing", 
      description: "Ability to mobilize and coordinate community participation", 
      creator_ref: "u_123", 
      cards_ref: {}, 
      created_at: now 
    }
  ];

  // Define cards
  const cards = [
    {
      card_id: "card_1",
      card_number: 1,
      role_title: "Eco-Village Steward",
      card_category: "Providers",
      type: "Practice",
      backstory: "A skilled permaculture practitioner committed to sustainable land management",
      goals: "Create a model permaculture system; Train others in sustainable practices",
      intellectual_property: "Permaculture designs and implementation techniques",
      resources: "5 acres of community land, garden tools",
      obligations: "Must maintain the land for community benefit",
      icon: "Sprout",
      creator_ref: "u_123",
      values_ref: { "value_sustainability": true, "value_community": true },
      capabilities_ref: { "cap_permaculture": true, "cap_community_organizing": true },
      agreements_ref: {},
      decks_ref: {},
      created_at: now
    },
    {
      card_id: "card_2",
      card_number: 2,
      role_title: "Eco-Fund Manager",
      card_category: "Funders",
      type: "DAO",
      backstory: "A community-managed fund that invests in sustainable projects",
      goals: "Fund 5 eco-projects annually; Grow fund capital by 10%",
      intellectual_property: "Sustainable investment algorithms and metrics",
      resources: "$50K in discretionary funds",
      obligations: "Must report financials quarterly to community",
      icon: "PiggyBank",
      creator_ref: "u_123",
      values_ref: { "value_transparency": true, "value_sustainability": true },
      capabilities_ref: { "cap_fundraising": true },
      agreements_ref: {},
      decks_ref: {},
      created_at: now
    }
  ];

  // Define deck
  const deck = {
    deck_id: "d_1",
    name: "Eco-Village Standard Deck",
    description: "A standard deck for eco-village simulation games",
    creator_ref: "u_123",
    is_public: true,
    cards_ref: {},
    created_at: now,
    updated_at: now
  };

  // Save basic entities to Gun
  for (const user of users) {
    await robustPut(nodes.users, user.user_id, user);
  }
  
  for (const value of values) {
    await robustPut(nodes.values, value.value_id, value);
  }
  
  for (const capability of capabilities) {
    await robustPut(nodes.capabilities, capability.capability_id, capability);
  }
  
  for (const card of cards) {
    await robustPut(nodes.cards, card.card_id, card);
  }
  
  await robustPut(nodes.decks, deck.deck_id, deck);
  
  // Create relationships between decks and cards
  for (const card of cards) {
    await createRelationship(`${nodes.decks}/${deck.deck_id}`, 'cards_ref', `${nodes.cards}/${card.card_id}`);
    await createRelationship(`${nodes.cards}/${card.card_id}`, 'decks_ref', `${nodes.decks}/${deck.deck_id}`);
  }
  
  // Create relationships between cards and values
  for (const card of cards) {
    for (const valueId of Object.keys(card.values_ref)) {
      await createRelationship(`${nodes.cards}/${card.card_id}`, 'values_ref', `${nodes.values}/${valueId}`);
      await createRelationship(`${nodes.values}/${valueId}`, 'cards_ref', `${nodes.cards}/${card.card_id}`);
    }
  }
  
  // Create relationships between cards and capabilities
  for (const card of cards) {
    for (const capabilityId of Object.keys(card.capabilities_ref)) {
      await createRelationship(`${nodes.cards}/${card.card_id}`, 'capabilities_ref', `${nodes.capabilities}/${capabilityId}`);
      await createRelationship(`${nodes.capabilities}/${capabilityId}`, 'cards_ref', `${nodes.cards}/${card.card_id}`);
    }
  }
  
  // Use gameService to create a game
  // NOTE: Real user authentication needs to be active for this to work correctly
  const gameName = "Eco-Village Simulation";
  const deckType = "eco-village";
  const roleAssignment = "choice";
  
  const game = await createGame(gameName, deckType, roleAssignment);
  if (!game) {
    return { success: false, message: "Failed to create game" };
  }
  
  console.log(`Created game with ID: ${game.game_id}`);
  
  // Create actors for each user using gameService
  const actors = [];
  
  for (let i = 0; i < 2; i++) {
    const user = users[i];
    const card = cards[i];
    
    // Use gameService to create an actor
    let actorType: 'Funder' | 'Farmer' | 'Builder' | 'Organizer' | 'Technologist' = 
      i === 0 ? 'Farmer' : 'Funder';
    
    const actor = await createActor(game.game_id, card.card_id, actorType, `${user.name}'s ${card.role_title}`);
    if (actor) {
      // Join game and assign card to actor
      await joinGame(user.user_id, game.game_id);
      await assignCardToActor(actor.actor_id, card.card_id);
      
      actors.push(actor);
    }
  }
  
  if (actors.length < 2) {
    return { success: false, message: "Failed to create all actors" };
  }
  
  // Create an agreement between the actors
  const agreement = await createAgreement(
    game.game_id,
    "Eco-Village Funding Agreement",
    "The Fund Manager provides capital to the Village Steward for sustainable projects",
    [actors[0].actor_id, actors[1].actor_id],
    {
      [actors[0].actor_id]: {
        obligations: ["Implement sustainable projects", "Report quarterly on outcomes"],
        benefits: ["Receive funding for projects", "Access to technical expertise"]
      },
      [actors[1].actor_id]: {
        obligations: ["Provide funding in quarterly installments", "Offer technical advice"],
        benefits: ["Portfolio diversification", "PR benefits from successful projects"]
      }
    }
  );
  
  if (!agreement) {
    return { success: false, message: "Failed to create agreement" };
  }
  
  // Create chat rooms
  const groupChatId = `chat_${game.game_id}_group`;
  const groupChat = {
    chat_id: groupChatId,
    game_ref: game.game_id,
    type: "group",
    participants_ref: { [users[0].user_id]: true, [users[1].user_id]: true },
    created_at: now,
    last_message_at: now
  };
  
  await robustPut(nodes.chat_rooms, groupChatId, groupChat);
  
  // Add a sample message
  const messageId = generateId();
  const message = {
    id: messageId,
    user_id: users[0].user_id,
    user_name: users[0].name,
    content: "Welcome to our eco-village simulation! Let's collaborate on some sustainable projects.",
    timestamp: now,
    type: "group",
    read_by: { [users[0].user_id]: true, [users[1].user_id]: false }
  };
  
  await robustPut(`${nodes.chat_rooms}/${groupChatId}/messages`, messageId, message);
  
  // Set node positions for visualization
  const nodePositions = [
    { node_id: actors[0].actor_id, game_id: game.game_id, x: 100, y: 0, type: "actor", last_updated: now },
    { node_id: actors[1].actor_id, game_id: game.game_id, x: -100, y: 0, type: "actor", last_updated: now },
    { node_id: agreement.agreement_id, game_id: game.game_id, x: 0, y: 0, type: "agreement", last_updated: now }
  ];
  
  for (const position of nodePositions) {
    await robustPut(nodes.node_positions, position.node_id, position);
  }
  
  console.log("[seed] Sample data initialization complete!");
  return { success: true };
}

/**
 * Verifies that sample data was properly initialized
 * Reports on nodes and their relationships
 */
export async function verifySampleData() {
  console.log("[verify] Verifying sample data...");
  const gun = getGun();
  if (!gun) {
    return { success: false, message: "Gun not initialized" };
  }
  
  // Collect and report entity counts for each node type
  const nodeTypes = Object.values(nodes);
  const stats: Record<string, { count: number }> = {};
  
  // Helper function to count entities of a given type
  async function countEntities(path: string): Promise<number> {
    return new Promise((resolve) => {
      let count = 0;
      gun?.get(path).map().once((data, key) => {
        if (key && key !== '_' && data) {
          count++;
        }
      });
      setTimeout(() => resolve(count), 500);
    });
  }
  
  // Count each node type
  for (const nodeType of nodeTypes) {
    try {
      const count = await countEntities(nodeType);
      stats[nodeType] = { count };
      console.log(`[verify] ${nodeType}: ${count} nodes`);
    } catch (error) {
      console.error(`[verify] Error counting ${nodeType}:`, error);
    }
  }
  
  return { success: true, stats };
}

/**
 * Clears all sample data, removing nodes from the database
 */
export async function clearSampleData() {
  console.log("[clear] Clearing sample data...");
  const gun = getGun();
  if (!gun) {
    return { success: false, message: "Gun not initialized" };
  }
  
  const nodeTypes = Object.values(nodes);
  
  for (const nodeType of nodeTypes) {
    try {
      console.log(`[clear] Clearing ${nodeType}...`);
      
      // Get all nodes of this type
      const nodeData: Record<string, any> = await new Promise((resolve) => {
        const result: Record<string, any> = {};
        gun?.get(nodeType).map().once((data, key) => {
          if (key && key !== '_' && data) {
            result[key] = null; // Map keys to null for later null-setting
          }
        });
        setTimeout(() => resolve(result), 500);
      });
      
      // Null out each node
      for (const key of Object.keys(nodeData)) {
        gun?.get(nodeType).get(key).put(null);
        await delay(10); // Small delay between operations
      }
      
    } catch (error) {
      console.error(`[clear] Error clearing ${nodeType}:`, error);
    }
  }
  
  return { success: true };
}