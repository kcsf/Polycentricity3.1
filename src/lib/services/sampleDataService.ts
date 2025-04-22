/****************************************************************************************
 * sampleDataService.ts (edge-centric version)
 * -------------------------------------------------------------------------------------
 * Seeds:
 *   - Users, Cards, Deck, Game, Actors, Agreement, Chat, Node Positions
 *   - Values & Capabilities (native Gun edges)
 *   - At least one shared Value/Capability between the two sample cards
 *
 * Relationship logic:
 *   - deck <-> card
 *   - card <-> values
 *   - card <-> capabilities
 *   - etc.
 *
 * It's important that the "gun/lib/radisk" import happens before Gun is constructed,
 * otherwise radisk won't activate properly.
 ***************************************************************************************/

import { getGun, nodes, put, generateId, type GunAck } from "./gunService";
import { createGame, createActor, joinGame, assignCardToActor } from "./gameService";

// Helper function to wait between Gun operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Minimized logging function - only logs errors, not success messages
function logAck(ctx: string, ack: GunAck) {
  if (ack.err) {
    console.warn(`[seed] ${ctx} ✗ ${ack.err}`);
  }
}

/**
 * Simple createRelationship function (different from gameService version)
 * Creates a reference from one node to another
 */
async function createRelationship(fromSoul: string, field: string, toSoul: string): Promise<boolean> {
  const gun = getGun();
  if (!gun) {
    console.error(`[sampleData] Cannot create relationship - Gun not initialized`);
    return false;
  }
  
  return new Promise<boolean>((resolve) => {
    try {
      gun.get(fromSoul).get(field).set(gun.get(toSoul), (ack: any) => {
        if (ack && ack.err) {
          console.warn(`[sampleData] Error creating relationship ${fromSoul}.${field} -> ${toSoul}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
      setTimeout(() => resolve(true), 1000);
    } catch (error) {
      console.error(`[sampleData] Exception in createRelationship`);
      resolve(false);
    }
  });
}

/**
 * Optimized version to create or update a node with minimal logging and delays
 * The data is spread in so we don't overwrite the entire node every time
 */
async function ensureNode<T extends Record<string, any>>(
  soul: string,
  data: T,
) {
  try {
    // Separate the path and key from the soul
    const parts = soul.split('/');
    const key = parts.pop() || '';
    const path = parts.join('/');
    
    // Add a created_at if not present
    const payload = { ...data, created_at: data.created_at ?? Date.now() };
    
    // Use our optimized robustPut function
    const success = await robustPut(path, key, payload);
    
    // Only handle failures
    if (!success) {
      console.warn(`Failed to save ${soul}`);
    }
    
    // Reduced wait time (50ms)
    await delay(50);
    
    return success;
  } catch (error) {
    console.error(`Error in ensureNode for ${soul}`);
    return false;
  }
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

export async function initializeSampleData() {
  console.log("[seed] Initializing sample data (edge style) …");
  const gunDb = getGun();
  if (!gunDb) {
    return { success: false, message: "Gun not initialized" };
  }

  const now = Date.now();

  // Define sample data
  const users = [
    { user_id: "u123", name: "Member User", email: "member@example.com", role: "Member", magic_key: "abc123", devices: "device1,device2", created_at: now, last_login: now },
    { user_id: "u124", name: "Guest User", email: "guest@example.com", role: "Guest", magic_key: "xyz789", created_at: now, last_login: now },
    { user_id: "u125", name: "Admin User", email: "admin@example.com", role: "Admin", created_at: now, last_login: now },
  ];

  const values = [
    { value_id: "value_sustainability", name: "Sustainability", description: "Practices that can be maintained indefinitely without depleting resources", created_at: now, creator: "u125", cards: {} },
    { value_id: "value_community-resilience", name: "Community Resilience", description: "The ability of a community to withstand, adapt to, and recover from adversity", created_at: now, creator: "u125", cards: {} },
    { value_id: "value_transparency", name: "Transparency", description: "Open and clear communication about decisions, processes, and results", created_at: now, creator: "u125", cards: {} },
  ];

  const capabilities = [
    { capability_id: "capability_permaculture-design", name: "Permaculture Design", description: "Ability to design sustainable agricultural ecosystems", created_at: now, creator: "u125", cards: {} },
    { capability_id: "capability_project-management", name: "Project Management", description: "Skills in planning, organizing, and managing resources to achieve specific goals", created_at: now, creator: "u125", cards: {} },
    { capability_id: "capability_smart-contract-development", name: "Smart Contract Development", description: "Ability to create and deploy blockchain-based automated agreements", created_at: now, creator: "u125", cards: {} },
  ];

  const cards = [
    {
      card_id: "c1", card_number: 1, role_title: "Verdant Weaver", backstory: "A skilled cultivator who weaves plant life into sustainable systems.",
      values: { "value_sustainability": true, "value_community-resilience": true },
      capabilities: { "capability_permaculture-design": true, "capability_project-management": true },
      goals: "Create a self-sustaining garden; Train others in permaculture", obligations: "Must share knowledge with the community",
      intellectual_property: "Seed storage techniques", rivalrous_resources: "Limited water supply", card_category: "Providers",
      type: "Practice", icon: "Hammer", created_at: now, creator: "u125", decks: {}
    },
    {
      card_id: "c2", card_number: 2, role_title: "Luminos Funder", backstory: "A visionary investor who funds innovative ecological projects.",
      values: { "value_sustainability": true, "value_transparency": true },
      capabilities: { "capability_smart-contract-development": true, "capability_project-management": true },
      goals: "Fund 5 eco-projects; Create a funding network", obligations: "Must transparently report all funding allocations",
      intellectual_property: "Investment strategy methodologies", rivalrous_resources: "Limited investment capital", card_category: "Funders",
      type: "DAO", icon: "CircleDollarSign", created_at: now, creator: "u125", decks: {}
    },
  ];

  const deck = { deck_id: "d1", name: "Eco-Village Standard Deck", description: "A standard deck for eco-village simulation games", creator: "u125", created_at: now, updated_at: now, is_public: true, cards: {} };

  // Use gameService.ts to create game
  const gameData = {
    game_id: "g456", name: "Test Eco-Village", description: "A test game for our eco-village simulation", creator: "u125",
    deck_id: deck.deck_id, role_assignment: "choice", players: { "u123": "a1", "u124": "a2" }, created_at: now, updated_at: now,
    status: "active", max_players: 10
  };
  await createGame(gameData);

  const actors = [
    { actor_id: "a1", game_id: gameData.game_id, user_id: "u123", card_id: "c1", created_at: now, custom_name: "Alice's Garden Steward", status: "active", agreements: {} },
    { actor_id: "a2", game_id: gameData.game_id, user_id: "u124", card_id: "c2", created_at: now, custom_name: "Bob's Funding Visionary", status: "active", agreements: {} },
  ];

  const agreements = [
    {
      agreement_id: "ag1", game_id: gameData.game_id, title: "Funding for Garden Initiative", summary: "Luminos Funder provides capital to Verdant Weaver for a community garden",
      type: "asymmetric", parties: { "a1": true, "a2": true }, obligations: { a1: "Create and maintain community garden for one year", a2: "Provide 5000 credits of funding and quarterly reviews" },
      benefits: { a1: "Receives funding and resources for the garden", a2: "Receives 10% of produce and community recognition" }, status: "accepted",
      created_at: now, updated_at: now, created_by: "u123", votes: { "a1": "accept", "a2": "accept" }
    },
    {
      agreement_id: "ag2", game_id: gameData.game_id, title: "Water Sharing Plan", summary: "Actors agree to share water resources equally", type: "symmetric",
      parties: { "a1": true, "a2": true }, obligations: { a1: "Share water equally", a2: "Share water equally" }, benefits: { a1: "Stable water supply", a2: "Stable water supply" },
      status: "proposed", created_at: now, created_by: "u123", votes: { "a1": "pending", "a2": "pending" }
    },
    {
      agreement_id: "ag3", game_id: gameData.game_id, title: "Land Use Pact", summary: "Actors tried to share land but disagreed on terms", type: "symmetric",
      parties: { "a1": true, "a2": true }, obligations: { a1: "Proposed shared land use", a2: "Proposed shared land use" }, benefits: { a1: "Access to shared land", a2: "Access to shared land" },
      status: "rejected", created_at: now, updated_at: now, created_by: "u123", votes: { "a1": "reject", "a2": "reject" }
    },
    {
      agreement_id: "ag4", game_id: gameData.game_id, title: "Seed Exchange Program", summary: "Actors completed a seed-sharing initiative", type: "symmetric",
      parties: { "a1": true, "a2": true }, obligations: { a1: "Share seeds monthly", a2: "Share seeds monthly" }, benefits: { a1: "Diverse seed stock", a2: "Diverse seed stock" },
      status: "completed", created_at: now, updated_at: now, created_by: "u123", votes: { "a1": "accept", "a2": "accept" }
    },
  ];

  const messageId = generateId();
  const chat = {
    chat_id: `${gameData.game_id}_group`, game_id: gameData.game_id, type: "group", participants: { "u123": true, "u124": true },
    messages: { [messageId]: { id: messageId, user_id: "u123", user_name: "Member User", content: "Hello! Let's start planning our eco-village!", timestamp: now, type: "group", read_by: { "u123": true, "u124": false } } },
    created_at: now, last_message_at: now
  };

  const nodePositions = [
    { node_id: "a1", game_id: gameData.game_id, x: 100, y: 0, type: "actor", last_updated: now },
    { node_id: "a2", game_id: gameData.game_id, x: -100, y: 0, type: "actor", last_updated: now },
    { node_id: "ag1", game_id: gameData.game_id, x: 0, y: 50, type: "agreement", last_updated: now },
    { node_id: "ag2", game_id: gameData.game_id, x: 0, y: -50, type: "agreement", last_updated: now },
    { node_id: "ag3", game_id: gameData.game_id, x: 50, y: 0, type: "agreement", last_updated: now },
    { node_id: "ag4", game_id: gameData.game_id, x: -50, y: 0, type: "agreement", last_updated: now },
  ];

  // Batch save helper function
  async function saveBatch<T extends { [key: string]: any }>(nodePath: string, items: T[], idField: keyof T) {
    console.log(`[seed] Batch saving ${items.length} items to ${nodePath}`);
    const gun = getGun();
    if (!gun) {
      console.error(`[batch] Gun not initialized for ${nodePath}`);
      return false;
    }
    for (const item of items) {
      gun.get(nodePath).get(String(item[idField])).put(item);
    }
    await delay(100);
    return true;
  }

  // Save non-gameService entities
  await saveBatch(nodes.users, users, 'user_id');
  await saveBatch(nodes.values, values, 'value_id');
  await saveBatch(nodes.capabilities, capabilities, 'capability_id');
  await saveBatch(nodes.cards, cards, 'card_id');
  await saveBatch(nodes.decks, [deck], 'deck_id');
  await saveBatch(nodes.chat_rooms, [chat], 'chat_id');

  // Use gameService.ts for actors and agreements
  for (const actor of actors) {
    await createActor(actor);
    await assignCardToActor(actor.actor_id, actor.card_id);
    await joinGame(actor.user_id, gameData.game_id, actor.actor_id);
  }

  for (const agreement of agreements) {
    await createAgreement(agreement);
  }

  // Save node positions
  await saveBatch(nodes.node_positions, nodePositions, 'node_id');

  // Create bidirectional relationships
  
  // Add cards to deck & deck to cards
  await createRelationship(`${nodes.decks}/${deck.deck_id}`, 'cards', `${nodes.cards}/c1`);
  await createRelationship(`${nodes.decks}/${deck.deck_id}`, 'cards', `${nodes.cards}/c2`);
  await createRelationship(`${nodes.cards}/c1`, 'decks', `${nodes.decks}/${deck.deck_id}`);
  await createRelationship(`${nodes.cards}/c2`, 'decks', `${nodes.decks}/${deck.deck_id}`);
  
  // Connect values to cards 
  await createRelationship(`${nodes.values}/value_sustainability`, 'cards', `${nodes.cards}/c1`);
  await createRelationship(`${nodes.values}/value_community-resilience`, 'cards', `${nodes.cards}/c1`);
  await createRelationship(`${nodes.values}/value_sustainability`, 'cards', `${nodes.cards}/c2`);
  await createRelationship(`${nodes.values}/value_transparency`, 'cards', `${nodes.cards}/c2`);
  
  // Connect capabilities to cards
  await createRelationship(`${nodes.capabilities}/capability_permaculture-design`, 'cards', `${nodes.cards}/c1`);
  await createRelationship(`${nodes.capabilities}/capability_project-management`, 'cards', `${nodes.cards}/c1`);
  await createRelationship(`${nodes.capabilities}/capability_smart-contract-development`, 'cards', `${nodes.cards}/c2`);
  await createRelationship(`${nodes.capabilities}/capability_project-management`, 'cards', `${nodes.cards}/c2`);
  
  // Connect agreements to actors
  for (const agreement of agreements) {
    await createRelationship(`${nodes.actors}/a1`, 'agreements', `${nodes.agreements}/${agreement.agreement_id}`);
    await createRelationship(`${nodes.actors}/a2`, 'agreements', `${nodes.agreements}/${agreement.agreement_id}`);
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
  const stats: Record<string, { count: number, example?: any }> = {};
  
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
  
  // Verify relationships
  try {
    const deckCardRelationships = await checkBidirectionalRelationships('decks', 'd1', 'cards', 'c1');
    console.log('[verify] Deck-Card relationship check:', deckCardRelationships);
    
    const cardValueRelationships = await checkBidirectionalRelationships('cards', 'c1', 'values', 'value_sustainability');
    console.log('[verify] Card-Value relationship check:', cardValueRelationships);
    
    const cardCapabilityRelationships = await checkBidirectionalRelationships('cards', 'c1', 'capabilities', 'capability_permaculture-design');
    console.log('[verify] Card-Capability relationship check:', cardCapabilityRelationships);
  } catch (error) {
    console.error('[verify] Error checking relationships:', error);
  }
  
  return { success: true, stats };
}

/**
 * Helper to check if bidirectional relationships are properly established
 */
async function checkBidirectionalRelationships(aType: string, aId: string, bType: string, bId: string): Promise<{ forward: boolean, backward: boolean }> {
  return new Promise((resolve) => {
    const gun = getGun();
    let forward = false;
    let backward = false;
    
    // Check A -> B
    gun?.get(aType).get(aId).get(bType).get(bId).once((data) => {
      forward = !!data;
    });
    
    // Check B -> A
    gun?.get(bType).get(bId).get(aType).get(aId).once((data) => {
      backward = !!data;
    });
    
    setTimeout(() => resolve({ forward, backward }), 500);
  });
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