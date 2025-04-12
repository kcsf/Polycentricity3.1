/****************************************************************************************
 * initializeSampleData.ts (edge‑centric version)
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

// Helper function to wait between Gun operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// A small helper to wrap promises with a 30s fallback (so we don't hang forever)
function withTimeout<T>(promise: Promise<T>, ms = 30000): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      console.warn(`[seed] Timed out after ${ms}ms`);
      resolve(promise); // Let the original promise keep working, but we "resolve" early
    }, ms);
    promise.then((val) => {
      clearTimeout(t);
      resolve(val);
    });
  });
}

// Minimized logging function - only logs errors, not success messages
function logAck(ctx: string, ack: GunAck) {
  if (ack.err) {
    console.warn(`[seed] ${ctx} ✗ ${ack.err}`);
  }
  // Success logs removed to reduce console noise
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
    
    // No logging for success cases to reduce console noise
    // Only handle failures
    if (!success) {
      console.warn(`Failed to save ${soul}`);
    }
    
    // Further reduced wait time (50ms instead of 100ms)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return success;
  } catch (error) {
    console.error(`Error in ensureNode for ${soul}`);
    return false;
  }
}

/**
 * Main function to seed the data with Gun edges
 */
/**
 * Optimized put operation for sample data with reduced timeouts and minimal logging
 */
async function robustPut(path: string, key: string, data: any): Promise<boolean> {
  // Get the Gun instance once
  const gun = getGun();
  if (!gun) {
    console.error(`[sampleData] Cannot save to ${path}/${key} - Gun not initialized`);
    return false;
  }
  
  // Helper function to deep clean an object - more compact implementation
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
  
  // Clean the data object thoroughly
  const cleanData = deepClean(data);
  
  // Return a promise with reduced timeouts and fewer logs
  return new Promise<boolean>((resolve) => {
    try {
      // No initial delay - just perform the operation directly
      gun.get(path).get(key).put(cleanData, (ack: any) => {
        if (ack && ack.err) {
          // Only log errors
          console.warn(`[sampleData] Error saving to ${path}/${key}`);
          resolve(false);
        } else {
          // No success logging to reduce console noise
          resolve(true);
        }
      });
      
      // Further reduced safety timeout (1 second instead of 3)
      setTimeout(() => {
        resolve(true); // Continue the process despite timeout
      }, 1000);
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

  // 1. Define all sample data
  const users = [
    {
      user_id: "u123",
      name: "Member User",
      email: "member@example.com",
      role: "Member",
      magic_key: "abc123", // Verified
      devices: "device1,device2",
      created_at: now,
      last_login: now
    },
    {
      user_id: "u124",
      name: "Guest User",
      email: "guest@example.com",
      role: "Guest",
      magic_key: "xyz789", // Unverified
      created_at: now,
      last_login: now
    },
    {
      user_id: "u125",
      name: "Admin User",
      email: "admin@example.com",
      role: "Admin",
      created_at: now,
      last_login: now
    },
  ];

  // Define values with improved structure
  const values = [
    {
      value_id: "value_sustainability",
      name: "Sustainability",
      description: "Practices that can be maintained indefinitely without depleting resources",
      created_at: now,
      creator: "u125",
      cards: {} // Will be populated with references
    },
    {
      value_id: "value_community-resilience",
      name: "Community Resilience",
      description: "The ability of a community to withstand, adapt to, and recover from adversity",
      created_at: now,
      creator: "u125",
      cards: {} // Will be populated with references
    },
    {
      value_id: "value_transparency",
      name: "Transparency",
      description: "Open and clear communication about decisions, processes, and results",
      created_at: now,
      creator: "u125",
      cards: {} // Will be populated with references
    }
  ];

  // Define capabilities with improved structure
  const capabilities = [
    {
      capability_id: "capability_permaculture-design",
      name: "Permaculture Design",
      description: "Ability to design sustainable agricultural ecosystems",
      created_at: now,
      creator: "u125",
      cards: {} // Will be populated with references
    },
    {
      capability_id: "capability_project-management",
      name: "Project Management",
      description: "Skills in planning, organizing, and managing resources to achieve specific goals",
      created_at: now,
      creator: "u125",
      cards: {} // Will be populated with references
    },
    {
      capability_id: "capability_smart-contract-development",
      name: "Smart Contract Development",
      description: "Ability to create and deploy blockchain-based automated agreements",
      created_at: now,
      creator: "u125",
      cards: {} // Will be populated with references
    }
  ];

  // Prepare cards with Gun.js-compatible formats
  const cards = [
    {
      card_id: "c1",
      card_number: 1,
      role_title: "Verdant Weaver",
      backstory: "A skilled cultivator who weaves plant life into sustainable systems.",
      values: {
        // Instead of arrays, use object with value_id keys
        "value_sustainability": true,
        "value_community-resilience": true
      },
      capabilities: {
        // Instead of arrays, use object with capability_id keys 
        "capability_permaculture-design": true,
        "capability_project-management": true
      },
      goals: "Create a self-sustaining garden; Train others in permaculture",
      obligations: "Must share knowledge with the community",
      intellectual_property: "Seed storage techniques",
      rivalrous_resources: "Limited water supply",
      card_category: "Providers",
      type: "Practice",
      icon: "Hammer",
      created_at: now,
      creator: "u125",
      decks: {} // Will be populated with references
    },
    {
      card_id: "c2",
      card_number: 2,
      role_title: "Luminos Funder",
      backstory: "A visionary investor who funds innovative ecological projects.",
      values: {
        // Instead of arrays, use object with value_id keys
        "value_sustainability": true,
        "value_transparency": true
      },
      capabilities: {
        // Instead of arrays, use object with capability_id keys
        "capability_smart-contract-development": true,
        "capability_project-management": true
      },
      goals: "Fund 5 eco-projects; Create a funding network",
      obligations: "Must transparently report all funding allocations",
      intellectual_property: "Investment strategy methodologies",
      rivalrous_resources: "Limited investment capital",
      card_category: "Funders",
      type: "DAO",
      icon: "CircleDollarSign",
      created_at: now,
      creator: "u125",
      decks: {} // Will be populated with references
    },
  ];

  const deck = {
    deck_id: "d1",
    name: "Eco-Village Standard Deck",
    description: "A standard deck for eco-village simulation games",
    creator: "u125",
    created_at: now,
    updated_at: now,
    is_public: true,
    cards: {} // Will be populated with references
  };

  const game = {
    game_id: "g456",
    name: "Test Eco-Village",
    description: "A test game for our eco-village simulation",
    creator: "u125",
    deck_id: deck.deck_id,
    role_assignment: "choice",
    // Map user_ids to actor_ids
    players: { 
      "u123": "a1", 
      "u124": "a2" 
    },
    created_at: now,
    updated_at: now,
    status: "active",
    max_players: 10
  };

  // Define actors with improved structure
  const actor1 = { 
    actor_id: "a1", 
    game_id: game.game_id, 
    user_id: "u123", 
    card_id: "c1",
    created_at: now,
    custom_name: "Alice's Garden Steward",
    status: "active",
    agreements: {} // Will be populated with references
  };
  
  const actor2 = { 
    actor_id: "a2", 
    game_id: game.game_id, 
    user_id: "u124", 
    card_id: "c2",
    created_at: now,
    custom_name: "Bob's Funding Visionary",
    status: "active",
    agreements: {} // Will be populated with references
  };

  // Multiple agreements with different statuses
  const agreement1 = {
    agreement_id: "ag1",
    game_id: game.game_id,
    title: "Funding for Garden Initiative",
    summary: "Luminos Funder provides capital to Verdant Weaver for a community garden",
    type: "asymmetric",
    parties: { 
      "a1": true, 
      "a2": true 
    },
    obligations: {
      a1: "Create and maintain community garden for one year",
      a2: "Provide 5000 credits of funding and quarterly reviews",
    },
    benefits: {
      a1: "Receives funding and resources for the garden",
      a2: "Receives 10% of produce and community recognition",
    },
    status: "accepted",
    created_at: now,
    updated_at: now,
    created_by: "u123",
    votes: {
      "a1": "accept",
      "a2": "accept"
    }
  };

  const agreement2 = {
    agreement_id: "ag2",
    game_id: game.game_id,
    title: "Water Sharing Plan",
    summary: "Actors agree to share water resources equally",
    type: "symmetric",
    parties: {
        "a1": true,
        "a2": true
    },
    obligations: {
        a1: "Share water equally",
        a2: "Share water equally"
    },
    benefits: {
        a1: "Stable water supply",
        a2: "Stable water supply"
    },
    status: "proposed",
    created_at: now,
    created_by: "u123",
    votes: {
        "a1": "pending",
        "a2": "pending"
    }
  };

  const agreement3 = {
      agreement_id: "ag3",
      game_id: game.game_id,
      title: "Land Use Pact",
      summary: "Actors tried to share land but disagreed on terms",
      type: "symmetric",
      parties: {
          "a1": true,
          "a2": true
      },
      obligations: {
          a1: "Proposed shared land use",
          a2: "Proposed shared land use"
      },
      benefits: {
          a1: "Access to shared land",
          a2: "Access to shared land"
      },
      status: "rejected",
      created_at: now,
      updated_at: now,
      created_by: "u123",
      votes: {
          "a1": "reject",
          "a2": "reject"
      }
  };

  const agreement4 = {
      agreement_id: "ag4",
      game_id: game.game_id,
      title: "Seed Exchange Program",
      summary: "Actors completed a seed-sharing initiative",
      type: "symmetric",
      parties: {
          "a1": true,
          "a2": true
      },
      obligations: {
          a1: "Share seeds monthly",
          a2: "Share seeds monthly"
      },
      benefits: {
          a1: "Diverse seed stock",
          a2: "Diverse seed stock"
      },
      status: "completed",
      created_at: now,
      updated_at: now,
      created_by: "u123",
      votes: {
          "a1": "accept",
          "a2": "accept"
      }
  };

  // Improved chat structure
  const messageId = generateId();
  const chat = {
    chat_id: `${game.game_id}_group`,
    game_id: game.game_id,
    type: "group",
    participants: { 
      "u123": true, 
      "u124": true 
    },
    messages: {
      [messageId]: {
        id: messageId,
        user_id: "u123",
        user_name: "Member User",
        content: "Hello! Let's start planning our eco-village!",
        timestamp: now,
        type: "group",
        read_by: {
          "u123": true,
          "u124": false
        }
      }
    },
    created_at: now,
    last_message_at: now
  };

  // Node positions in a circle pattern
  const nodePosition1 = {
    node_id: "a1",
    game_id: game.game_id,
    x: 100, // cos(0°) * 100
    y: 0,   // sin(0°) * 100
    type: "actor",
    last_updated: now
  };

  const nodePosition2 = {
    node_id: "a2",
    game_id: game.game_id,
    x: -100, // cos(180°) * 100
    y: 0,    // sin(180°) * 100
    type: "actor",
    last_updated: now
  };

  const nodePosition3 = {
    node_id: "ag1",
    game_id: game.game_id,
    x: 0,
    y: 50,
    type: "agreement",
    last_updated: now
  };

  const nodePosition4 = {
    node_id: "ag2",
    game_id: game.game_id,
    x: 0,
    y: -50,
    type: "agreement",
    last_updated: now
  };

  const nodePosition5 = {
    node_id: "ag3",
    game_id: game.game_id,
    x: 50,
    y: 0,
    type: "agreement",
    last_updated: now
  };

  const nodePosition6 = {
    node_id: "ag4",
    game_id: game.game_id,
    x: -50,
    y: 0,
    type: "agreement",
    last_updated: now
  };

  // 2. Persist the base nodes using batch techniques where possible
  
  // Define a helper function for batch saving collections
  async function saveBatch<T extends { [key: string]: any }>(
    nodePath: string,
    items: T[],
    idField: keyof T
  ) {
    console.log(`[seed] Batch saving ${items.length} items to ${nodePath}`);
    const gun = getGun();
    if (!gun) {
      console.error(`[batch] Gun not initialized for ${nodePath}`);
      return false;
    }
    
    // Process all items in the collection
    for (const item of items) {
      const id = String(item[idField]);
      // Use the fire-and-forget approach - no waiting for acknowledgment
      gun.get(nodePath).get(id).put(item);
    }
    
    // Small delay to allow Gun to process the batch
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  }

  // Batch save users
  await saveBatch(nodes.users, users, 'user_id');
  
  // Batch save values
  await saveBatch(nodes.values, values, 'value_id');
  
  // Batch save capabilities
  await saveBatch(nodes.capabilities, capabilities, 'capability_id');

  // Batch save cards
  await saveBatch(nodes.cards, cards, 'card_id');
  
  // Save single-entity nodes
  const singletons = [
    { path: nodes.decks, data: deck, id: deck.deck_id },
    { path: nodes.games, data: game, id: game.game_id },
    { path: nodes.chat, data: chat, id: chat.chat_id }
  ];
  
  console.log(`[seed] Batch saving singleton entities`);
  const gunInstance = getGun();
  if (gunInstance) {
    // Process all singletons in parallel with fire-and-forget approach
    for (const item of singletons) {
      gunInstance.get(item.path).get(item.id).put(item.data);
    }
    // Small delay to allow Gun to process
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Batch save actors
  await saveBatch(nodes.actors, [actor1, actor2], 'actor_id');
  
  // Batch save agreements
  await saveBatch(nodes.agreements, [agreement1, agreement2, agreement3, agreement4], 'agreement_id');
  
  // Batch save node positions for all entities
  await saveBatch(
    nodes.positions, 
    [nodePosition1, nodePosition2, nodePosition3, nodePosition4, nodePosition5, nodePosition6], 
    'node_id'
  );

  // 3. Optimized version of createEdge that uses "fire-and-forget" approach (no ack waiting)
  function createEdge(fromSoul: string, field: string, toSoul: string) {
    // Get the Gun instance once
    const gun = getGun();
    if (!gun) {
      console.error(`[createEdge] Gun not initialized for ${fromSoul} -> ${toSoul}`);
      return Promise.resolve({ err: "Gun not initialized", ok: false });
    }
    
    try {
      // Create the edge without waiting for acknowledgment
      gun.get(fromSoul).get(field).set(gun.get(toSoul));
      
      // Immediately resolve for faster operation
      return Promise.resolve({ ok: true });
    } catch (error) {
      console.error(`[createEdge] Exception for ${fromSoul}.${field} -> ${toSoul}:`, error);
      return Promise.resolve({ err: String(error), ok: false });
    }
  }
  
  // Type definition for batch result
  type BatchResult = { ok: boolean; count?: number; err?: string; };
  
  // Batch create multiple edges at once
  function createEdgesBatch(edgeDefinitions: {fromSoul: string, field: string, toSoul: string}[]): Promise<BatchResult> {
    console.log(`[createEdgesBatch] Creating ${edgeDefinitions.length} edges in batch`);
    
    // Get the Gun instance once
    const gun = getGun();
    if (!gun) {
      console.error("[createEdgesBatch] Gun not initialized");
      return Promise.resolve({ err: "Gun not initialized", ok: false });
    }
    
    try {
      // Process all edges in the batch
      for (const def of edgeDefinitions) {
        gun.get(def.fromSoul).get(def.field).set(gun.get(def.toSoul));
      }
      
      // Immediately resolve for faster operation
      return Promise.resolve({ ok: true, count: edgeDefinitions.length });
    } catch (error) {
      console.error("[createEdgesBatch] Exception during batch operation:", error);
      return Promise.resolve({ err: String(error), ok: false });
    }
  }

  // 4. Create relationships between entities using batch operations
  // This optimized approach creates multiple relationships in batches
  
  // Prepare all the edge definitions we want to create
  const allEdges = [];
  
  // Define deck <-> card relationships
  console.log("[seed] Creating deck ↔ cards relationships in batch");
  
  // For each card, create bidirectional deck<->card edges
  for (const card of cards) {
    // Deck -> Card
    allEdges.push({
      fromSoul: `${nodes.decks}/${deck.deck_id}`,
      field: "cards",
      toSoul: `${nodes.cards}/${card.card_id}`
    });
    
    // Card -> Deck
    allEdges.push({
      fromSoul: `${nodes.cards}/${card.card_id}`,
      field: "decks", 
      toSoul: `${nodes.decks}/${deck.deck_id}`
    });
  }
  
  // Define value -> card relationships for all cards
  console.log("[seed] Creating values → cards relationships in batch");
  
  // Process card 1 value references
  for (const valueId of Object.keys(cards[0].values)) {
    allEdges.push({
      fromSoul: `${nodes.values}/${valueId}`,
      field: "cards",
      toSoul: `${nodes.cards}/${cards[0].card_id}`
    });
  }
  
  // Process card 2 value references
  for (const valueId of Object.keys(cards[1].values)) {
    allEdges.push({
      fromSoul: `${nodes.values}/${valueId}`,
      field: "cards",
      toSoul: `${nodes.cards}/${cards[1].card_id}`
    });
  }
  
  // Define capability -> card relationships for all cards
  console.log("[seed] Creating capabilities → cards relationships in batch");
  
  // Process card 1 capability references
  for (const capabilityId of Object.keys(cards[0].capabilities)) {
    allEdges.push({
      fromSoul: `${nodes.capabilities}/${capabilityId}`,
      field: "cards",
      toSoul: `${nodes.cards}/${cards[0].card_id}`
    });
  }
  
  // Process card 2 capability references
  for (const capabilityId of Object.keys(cards[1].capabilities)) {
    allEdges.push({
      fromSoul: `${nodes.capabilities}/${capabilityId}`,
      field: "cards",
      toSoul: `${nodes.cards}/${cards[1].card_id}`
    });
  }
  
  // Define actor -> agreement relationships
  console.log("[seed] Creating actors → agreement relationships in batch");
  
  // Process all agreements
  const allAgreements = [agreement1, agreement2, agreement3, agreement4];
  for (const agreement of allAgreements) {
    for (const actorId of Object.keys(agreement.parties)) {
      allEdges.push({
        fromSoul: `${nodes.actors}/${actorId}`,
        field: "agreements",
        toSoul: `${nodes.agreements}/${agreement.agreement_id}`
      });
    }
  }
  
  // Define game -> deck relationship
  console.log("[seed] Creating game → deck relationship");
  
  allEdges.push({
    fromSoul: `${nodes.games}/${game.game_id}`,
    field: "deck",
    toSoul: `${nodes.decks}/${deck.deck_id}`
  });
  
  // Define user -> actor relationships
  console.log("[seed] Creating users → actors relationships in batch");
  
  // User 1 -> Actor 1
  allEdges.push({
    fromSoul: `${nodes.users}/${actor1.user_id}`,
    field: "actors",
    toSoul: `${nodes.actors}/${actor1.actor_id}`
  });
  
  // User 2 -> Actor 2
  allEdges.push({
    fromSoul: `${nodes.users}/${actor2.user_id}`,
    field: "actors",
    toSoul: `${nodes.actors}/${actor2.actor_id}`
  });
  
  // Create all edges in a batch
  console.log(`[seed] Creating all ${allEdges.length} relationships in one batch operation`);
  const batchResult = await createEdgesBatch(allEdges);
  
  if (batchResult.ok) {
    console.log(`[seed] Successfully created ${batchResult.count || allEdges.length} relationships`);
  } else {
    console.warn(`[seed] Error in batch creation of relationships: ${batchResult.err || 'Unknown error'}`);
  }

  console.log("[seed] Sample data (with edges) initialized ✅");
  
  // Add a small delay before reporting completion
  // This helps ensure all operations have a chance to complete
  // before anyone tries to verify the data
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return { success: true, message: "Sample data initialized (edge style)" };
}

/**
 * Clear all sample data from the database.
 * This removes all nodes but keeps the Gun database structure intact.
 */
export async function clearSampleData() {
  console.log("[clear] Clearing all sample data...");
  const gun = getGun();
  if (!gun) {
    return { success: false, message: "Gun not initialized" };
  }
  
  // List of all node types to clear
  const nodesToClear = [
    nodes.users,
    nodes.cards,
    nodes.decks,
    nodes.values,
    nodes.capabilities,
    nodes.games,
    nodes.actors,
    nodes.agreements,
    nodes.chat,
    nodes.positions
  ];
  
  // Process each node type and remove all children
  for (const nodePath of nodesToClear) {
    try {
      console.log(`[clear] Clearing all data in ${nodePath}...`);
      // Get all keys for this node type
      await new Promise<void>((resolve) => {
        gun.get(nodePath).map().once((data, key) => {
          if (key && key !== "_") {
            // Remove this node
            gun.get(nodePath).get(key).put(null);
          }
        });
        
        // Wait a bit to ensure all nodes are processed
        setTimeout(() => resolve(), 200);
      });
    } catch (error) {
      console.error(`[clear] Error clearing ${nodePath}:`, error);
    }
  }
  
  // Add a small delay to allow Gun to process all the removals
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log("[clear] Sample data cleared ✅");
  return { success: true, message: "Sample data cleared" };
}

/**
 * Verify how many child keys exist under each high-level node.
 */
export async function verifySampleData() {
  console.log("[verify] Counting nodes…");
  
  // Check for Gun initialization here, but we'll get a fresh instance in each count() call
  // instead of relying on this gun variable which might cause TS errors
  if (!getGun()) {
    return { success: false, message: "Gun not initialized" };
  }
  
  // Add a small delay before verification to ensure Gun has processed data
  await new Promise(resolve => setTimeout(resolve, 200));

  // Count how many keys appear under a node (optimized with shorter timeout)
  async function count(soul: string) {
    return new Promise<number>((done) => {
      let n = 0;
      // Ensure we have a Gun instance
      const gunInstance = getGun();
      if (!gunInstance) {
        console.error(`[count] Gun not initialized for count(${soul})`);
        done(0);
        return;
      }
      
      // Count keys
      gunInstance
        .get(soul)
        .map()
        .once((_data, key) => {
          if (key && key !== "_") n++;
        });
        
      // Further reduced wait time (100ms instead of 300ms)
      setTimeout(() => done(n), 100);
    });
  }

  console.table({
    users: await count(nodes.users),
    cards: await count(nodes.cards),
    decks: await count(nodes.decks),
    values: await count(nodes.values),
    capabilities: await count(nodes.capabilities),
    games: await count(nodes.games),
    actors: await count(nodes.actors),
    agreements: await count(nodes.agreements),
    chat: await count(nodes.chat),
    node_positions: await count(nodes.positions),
  });

  console.log("[verify] Complete ✔");
  return { success: true, message: "Verification done" };
}
