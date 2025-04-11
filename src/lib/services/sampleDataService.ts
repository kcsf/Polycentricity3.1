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
 * Enhanced safe put operation specifically for sample data
 * This ensures Gun.js with Radisk has enough time to process each write
 */
async function robustPut(path: string, key: string, data: any): Promise<boolean> {
  // Get a fresh Gun instance each time to ensure it's initialized
  const gun = getGun();
  if (!gun) {
    console.error(`[sampleData] Cannot save to ${path}/${key} - Gun not initialized`);
    return false;
  }
  
  console.log(`[sampleData] Saving to ${path}/${key}...`);
  
  // Return a promise that can resolve in multiple ways:
  // 1. Successfully on ack with no error
  // 2. Error if ack has an error
  // 3. Timeout after 10 seconds (but still continue the operation)
  return new Promise<boolean>((resolve) => {
    // First - small delay to ensure Radisk is ready
    setTimeout(() => {
      try {
        // Second - actual Gun put operation
        gun.get(path).get(key).put(data, (ack: any) => {
          if (ack && ack.err) {
            console.warn(`[sampleData] Error saving to ${path}/${key}:`, ack.err);
            resolve(false);
          } else {
            console.log(`[sampleData] Successfully saved to ${path}/${key}`);
            resolve(true);
          }
        });
        
        // Third - safety timeout if Gun never responds
        setTimeout(() => {
          console.log(`[sampleData] Timeout while saving to ${path}/${key} - continuing anyway`);
          resolve(true); // Continue the process despite timeout
        }, 10000);
      } catch (error) {
        console.error(`[sampleData] Exception while saving to ${path}/${key}:`, error);
        resolve(false);
      }
    }, 500);
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
    },
    {
      user_id: "u124",
      name: "Guest User",
      email: "guest@example.com",
      role: "Guest",
      created_at: now,
    },
    {
      user_id: "u125",
      name: "Admin User",
      email: "admin@example.com",
      role: "Admin",
      created_at: now,
    },
  ];

  // Prepare cards with Gun.js-compatible formats (no arrays, no undefined values)
  const cards = [
    {
      card_id: "c1",
      card_number: 1,
      role_title: "Verdant Weaver",
      backstory:
        "A skilled cultivator who weaves plant life into sustainable systems.",
      // Store these as comma-separated strings for Gun compatibility
      rawValues: "Sustainability,Community Resilience",
      rawCapabilities: "Permaculture Design,Project Management", // <-- "Project Management" is shared
      goals: "Create a self-sustaining garden; Train others in permaculture",
      obligations: "Must share knowledge with the community",
      intellectual_property: "Seed storage techniques",
      rivalrous_resources: "Limited water supply",
      card_category: "Providers",
      type: "Practice",
      icon: "Hammer",
      created_at: now,
    },
    {
      card_id: "c2",
      card_number: 2,
      role_title: "Luminos Funder",
      backstory:
        "A visionary investor who funds innovative ecological projects.",
      // Store these as comma-separated strings for Gun compatibility
      rawValues: "Sustainability,Transparency", // <-- "Sustainability" is shared
      rawCapabilities: "Smart Contract Development,Project Management",
      goals: "Fund 5 eco-projects; Create a funding network",
      obligations: "Must transparently report all funding allocations",
      intellectual_property: "Investment strategy methodologies",
      rivalrous_resources: "Limited investment capital",
      card_category: "Funders",
      type: "DAO",
      icon: "CircleDollarSign",
      created_at: now,
    },
  ];

  const deck = {
    deck_id: "d1",
    name: "Eco-Village Standard Deck",
    description: "A standard deck for eco-village simulation games",
    creator: "u125",
    created_at: now,
    updated_at: now,
  };

  const game = {
    game_id: "g456",
    name: "Test Eco-Village",
    creator: "u125",
    deck_id: deck.deck_id,
    role_assignment: "choice",
    players: { u123: true, u124: true },
    created_at: now,
    status: "active",
  };

  // Define actors individually instead of using an array
  const actor1 = { actor_id: "a1", game_id: game.game_id, user_id: "u123", card_id: "c1" };
  const actor2 = { actor_id: "a2", game_id: game.game_id, user_id: "u124", card_id: "c2" };

  // Convert array formats to objects for Gun.js compatibility
  const agreement = {
    agreement_id: "ag1",
    game_id: game.game_id,
    title: "Funding for Garden Initiative",
    summary:
      "Luminos Funder provides capital to Verdant Weaver for a community garden",
    type: "asymmetric",
    // Convert array to object with numbered properties
    parties: { 0: "a1", 1: "a2" },
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
  };

  // Make chat data Gun.js friendly (convert arrays to objects)
  const messageId = generateId();
  const chat = {
    chat_id: `${game.game_id}_group`,
    game_id: game.game_id,
    type: "group",
    // Convert array to object with numbered keys
    participants: { 0: "u123", 1: "u124" },
    // Store messages as an object with message IDs as keys
    messages: {
      [messageId]: {
        id: messageId,
        user_id: "u123",
        user_name: "Member User",
        content: "Hello! Let's start planning our eco-village!",
        timestamp: now,
        type: "group",
      }
    },
  };

  // Define node positions without using arrays
  const nodePosition1 = { node_id: "a1", game_id: game.game_id, x: 100, y: 100 };
  const nodePosition2 = { node_id: "ag1", game_id: game.game_id, x: 300, y: 200 };

  // 2. Persist the base nodes
  for (const u of users) {
    await ensureNode(`${nodes.users}/${u.user_id}`, u);
  }

  // Save individual card nodes
  const baseCardData1 = {
    ...cards[0],
    // Remove the rawValues/rawCapabilities so we don't store them as direct fields
    rawValues: undefined,
    rawCapabilities: undefined,
  };
  await ensureNode(`${nodes.cards}/${cards[0].card_id}`, baseCardData1);
  
  const baseCardData2 = {
    ...cards[1],
    // Remove the rawValues/rawCapabilities so we don't store them as direct fields
    rawValues: undefined,
    rawCapabilities: undefined,
  };
  await ensureNode(`${nodes.cards}/${cards[1].card_id}`, baseCardData2);

  await ensureNode(`${nodes.decks}/${deck.deck_id}`, deck);
  await ensureNode(`${nodes.games}/${game.game_id}`, game);

  // Save individual actor nodes
  await ensureNode(`${nodes.actors}/${actor1.actor_id}`, actor1);
  await ensureNode(`${nodes.actors}/${actor2.actor_id}`, actor2);

  await ensureNode(`${nodes.agreements}/${agreement.agreement_id}`, agreement);
  await ensureNode(`${nodes.chat}/${chat.chat_id}`, chat);

  // Save individual position nodes
  await ensureNode(`${nodes.positions}/${nodePosition1.node_id}`, nodePosition1);
  await ensureNode(`${nodes.positions}/${nodePosition2.node_id}`, nodePosition2);

  // 3. Enhanced helper to create edges using `.set()` with better error handling
  function createEdge(fromSoul: string, field: string, toSoul: string) {
    return new Promise<GunAck>((resolve) => {
      // Get a new Gun instance for each operation to ensure it's ready
      const gun = getGun();
      if (!gun) {
        console.error(`[createEdge] Gun not initialized for ${fromSoul} -> ${toSoul}`);
        resolve({ err: "Gun not initialized", ok: false });
        return;
      }
      
      try {
        // Add a small delay to ensure Gun is ready
        setTimeout(() => {
          try {
            // First reference - the node to attach the edge to
            const fromRef = gun.get(fromSoul);
            
            // Second reference - the node the edge points to
            const toRef = gun.get(toSoul);
            
            // Create the edge
            fromRef.get(field).set(toRef, (ack: any) => {
              if (ack && ack.err) {
                console.warn(`[createEdge] Error creating edge ${fromSoul}.${field} -> ${toSoul}:`, ack.err);
              } else {
                console.log(`[createEdge] Successfully created edge ${fromSoul}.${field} -> ${toSoul}`);
              }
              resolve(ack);
            });
            
            // Safety timeout
            setTimeout(() => {
              console.log(`[createEdge] Timeout for edge ${fromSoul}.${field} -> ${toSoul}`);
              resolve({ err: "Timeout", ok: false });
            }, 5000);
          } catch (error) {
            console.error(`[createEdge] Exception for ${fromSoul}.${field} -> ${toSoul}:`, error);
            resolve({ err: String(error), ok: false });
          }
        }, 300);
      } catch (outerError) {
        console.error(`[createEdge] Outer exception for ${fromSoul}.${field} -> ${toSoul}:`, outerError);
        resolve({ err: String(outerError), ok: false });
      }
    });
  }

  // 4. Deck <--> Card edges - process cards individually
  
  // Process card 1
  const c1 = cards[0];
  const deckToCard1 = await withTimeout(
    createEdge(
      `${nodes.decks}/${deck.deck_id}`,
      "cards",
      `${nodes.cards}/${c1.card_id}`,
    ),
  );
  logAck(`deck->card ${deck.deck_id} -> ${c1.card_id}`, deckToCard1);

  const cardToDeck1 = await withTimeout(
    createEdge(
      `${nodes.cards}/${c1.card_id}`,
      "decks",
      `${nodes.decks}/${deck.deck_id}`,
    ),
  );
  logAck(`card->deck ${c1.card_id} -> ${deck.deck_id}`, cardToDeck1);
  
  // Process card 2
  const c2 = cards[1];
  const deckToCard2 = await withTimeout(
    createEdge(
      `${nodes.decks}/${deck.deck_id}`,
      "cards",
      `${nodes.cards}/${c2.card_id}`,
    ),
  );
  logAck(`deck->card ${deck.deck_id} -> ${c2.card_id}`, deckToCard2);

  const cardToDeck2 = await withTimeout(
    createEdge(
      `${nodes.cards}/${c2.card_id}`,
      "decks",
      `${nodes.decks}/${deck.deck_id}`,
    ),
  );
  logAck(`card->deck ${c2.card_id} -> ${deck.deck_id}`, cardToDeck2);

  // 5. Values & Capabilities for each card - process individually
  
  // Process values and capabilities for card 1
  const valueNames1 = c1.rawValues.split(',').map(v => v.trim()).filter(Boolean);
  
  // Process each value for card 1
  for (const vName of valueNames1) {
    const vId = `value_${vName.toLowerCase().replace(/\s+/g, "-")}`;
    // If value node doesn't exist, create it
    await ensureNode(`${nodes.values}/${vId}`, {
      value_id: vId,
      name: vName,
      created_at: now,
    });

    // edges: value->card and card->value
    const valToCardAck = await withTimeout(
      createEdge(
        `${nodes.values}/${vId}`,
        "cards",
        `${nodes.cards}/${c1.card_id}`,
      ),
    );
    logAck(`value->card ${vId} -> ${c1.card_id}`, valToCardAck);

    const cardToValAck = await withTimeout(
      createEdge(
        `${nodes.cards}/${c1.card_id}`,
        "values",
        `${nodes.values}/${vId}`,
      ),
    );
    logAck(`card->value ${c1.card_id} -> ${vId}`, cardToValAck);
  }

  // Process capabilities for card 1
  const capabilityNames1 = c1.rawCapabilities.split(',').map(cap => cap.trim()).filter(Boolean);
  
  for (const capName of capabilityNames1) {
    const capId = `capability_${capName.toLowerCase().replace(/\s+/g, "-")}`;
    // If capability node doesn't exist, create it
    await ensureNode(`${nodes.capabilities}/${capId}`, {
      capability_id: capId,
      name: capName,
      created_at: now,
    });

    // edges: capability->card and card->capability
    const capToCardAck = await withTimeout(
      createEdge(
        `${nodes.capabilities}/${capId}`,
        "cards",
        `${nodes.cards}/${c1.card_id}`,
      ),
    );
    logAck(`cap->card ${capId} -> ${c1.card_id}`, capToCardAck);

    const cardToCapAck = await withTimeout(
      createEdge(
        `${nodes.cards}/${c1.card_id}`,
        "capabilities",
        `${nodes.capabilities}/${capId}`,
      ),
    );
    logAck(`card->cap ${c1.card_id} -> ${capId}`, cardToCapAck);
  }
  
  // Process values and capabilities for card 2
  const valueNames2 = c2.rawValues.split(',').map(v => v.trim()).filter(Boolean);
  
  // Process each value for card 2
  for (const vName of valueNames2) {
    const vId = `value_${vName.toLowerCase().replace(/\s+/g, "-")}`;
    // If value node doesn't exist, create it
    await ensureNode(`${nodes.values}/${vId}`, {
      value_id: vId,
      name: vName,
      created_at: now,
    });

    // edges: value->card and card->value
    const valToCardAck = await withTimeout(
      createEdge(
        `${nodes.values}/${vId}`,
        "cards",
        `${nodes.cards}/${c2.card_id}`,
      ),
    );
    logAck(`value->card ${vId} -> ${c2.card_id}`, valToCardAck);

    const cardToValAck = await withTimeout(
      createEdge(
        `${nodes.cards}/${c2.card_id}`,
        "values",
        `${nodes.values}/${vId}`,
      ),
    );
    logAck(`card->value ${c2.card_id} -> ${vId}`, cardToValAck);
  }

  // Process capabilities for card 2
  const capabilityNames2 = c2.rawCapabilities.split(',').map(cap => cap.trim()).filter(Boolean);
  
  for (const capName of capabilityNames2) {
    const capId = `capability_${capName.toLowerCase().replace(/\s+/g, "-")}`;
    // If capability node doesn't exist, create it
    await ensureNode(`${nodes.capabilities}/${capId}`, {
      capability_id: capId,
      name: capName,
      created_at: now,
    });

    // edges: capability->card and card->capability
    const capToCardAck = await withTimeout(
      createEdge(
        `${nodes.capabilities}/${capId}`,
        "cards",
        `${nodes.cards}/${c2.card_id}`,
      ),
    );
    logAck(`cap->card ${capId} -> ${c2.card_id}`, capToCardAck);

    const cardToCapAck = await withTimeout(
      createEdge(
        `${nodes.cards}/${c2.card_id}`,
        "capabilities",
        `${nodes.capabilities}/${capId}`,
      ),
    );
    logAck(`card->cap ${c2.card_id} -> ${capId}`, cardToCapAck);
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

  // Count how many keys appear under a node
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
        
      // Give Gun a moment to load before resolving
      setTimeout(() => done(n), 700);
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
