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

// Log Gun acks with a consistent format
function logAck(ctx: string, ack: GunAck) {
  if (ack.err) {
    console.warn(`[seed] ${ctx} ✗ ${ack.err}`);
  } else {
    console.log(`[seed] ${ctx} ✓`);
  }
}

/**
 * Create or update a simple node if it doesn't exist.
 * The data is spread in so we don't overwrite entire node every time
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
    
    // Use our new robustPut function instead of the standard put
    const success = await robustPut(path, key, payload);
    
    // Log the result based on success
    if (success) {
      logAck(soul, { ok: true });
    } else {
      logAck(soul, { err: "Put failed" });
    }
    
    // Wait a small amount to allow Radisk to process the write
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return success;
  } catch (error) {
    console.error(`Error in ensureNode for ${soul}:`, error);
    logAck(soul, { err: String(error) });
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
      
      // Shorter safety timeout (3 seconds instead of 10)
      setTimeout(() => {
        resolve(true); // Continue the process despite timeout
      }, 3000);
    } catch (error) {
      console.error(`[sampleData] Exception for ${path}/${key}`);
      resolve(false);
    }
  });
}

export async function initializeSampleData() {
  console.log("[seed] Initializing sample data (edge style) …");
  const gun = getGun();
  if (!gun) {
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
      created_at: now,
      last_login: now
    },
    {
      user_id: "u124",
      name: "Guest User",
      email: "guest@example.com",
      role: "Guest",
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
    status: "active",
    agreements: {} // Will be populated with references
  };

  // Improved agreement structure
  const agreement = {
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

  // Improved node position structure
  const nodePosition1 = { 
    node_id: "a1", 
    game_id: game.game_id, 
    x: 100, 
    y: 100,
    type: "actor",
    last_updated: now
  };
  
  const nodePosition2 = { 
    node_id: "ag1", 
    game_id: game.game_id, 
    x: 300, 
    y: 200,
    type: "agreement",
    last_updated: now
  };

  // 2. Persist the base nodes
  // Save all users
  for (const u of users) {
    await ensureNode(`${nodes.users}/${u.user_id}`, u);
  }

  // Save all values first
  for (const value of values) {
    await ensureNode(`${nodes.values}/${value.value_id}`, value);
  }

  // Save all capabilities
  for (const capability of capabilities) {
    await ensureNode(`${nodes.capabilities}/${capability.capability_id}`, capability);
  }

  // Save cards with their references to values and capabilities
  // First card
  await ensureNode(`${nodes.cards}/${cards[0].card_id}`, cards[0]);
  
  // Second card
  await ensureNode(`${nodes.cards}/${cards[1].card_id}`, cards[1]);

  // Save deck with its references to cards
  await ensureNode(`${nodes.decks}/${deck.deck_id}`, deck);
  
  // Save game
  await ensureNode(`${nodes.games}/${game.game_id}`, game);

  // Save actors with references to users, games, and cards
  await ensureNode(`${nodes.actors}/${actor1.actor_id}`, actor1);
  await ensureNode(`${nodes.actors}/${actor2.actor_id}`, actor2);

  // Save agreement with references to actors
  await ensureNode(`${nodes.agreements}/${agreement.agreement_id}`, agreement);
  
  // Save chat with references to participants
  await ensureNode(`${nodes.chat}/${chat.chat_id}`, chat);

  // Save node positions for visualization
  await ensureNode(`${nodes.positions}/${nodePosition1.node_id}`, nodePosition1);
  await ensureNode(`${nodes.positions}/${nodePosition2.node_id}`, nodePosition2);

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
  
  for (const actorId of Object.keys(agreement.parties)) {
    allEdges.push({
      fromSoul: `${nodes.actors}/${actorId}`,
      field: "agreements",
      toSoul: `${nodes.agreements}/${agreement.agreement_id}`
    });
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
  return { success: true, message: "Sample data initialized (edge style)" };
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
        
      // Reduced wait time (300ms instead of 700ms)
      setTimeout(() => done(n), 300);
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
