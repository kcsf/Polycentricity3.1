/****************************************************************************************
 * sampleDataService.ts
 * -------------------------------------------------------------------------------------
 * Data initialization service that follows the schema exactly as defined in GunSchema.md
 * Uses direct Gun.js calls with batch processing for efficiency
 * Creates sample data in the correct order: users, decks, cards, values, capabilities,
 * game, actors, agreements, chat rooms, messages, node positions
 * Compatible with +page.svelte for initialization, verification, and clearing
 ***************************************************************************************/

import {
  getGun,
  nodes,
  put,
  generateId,
  type GunAck,
  createRelationship,
} from "./gunService";

// Helper function to wait between Gun operations
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Optimized put operation for sample data with reduced timeouts and minimal logging
 */
async function robustPut(
  path: string,
  key: string,
  data: any,
): Promise<boolean> {
  const gun = getGun();
  if (!gun) {
    console.error(
      `[sampleData] Cannot save to ${path}/${key} - Gun not initialized`,
    );
    return false;
  }

  function deepClean(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      const result: Record<string, any> = {};
      obj.forEach((val, idx) => {
        if (val !== undefined) result[idx] = deepClean(val);
      });
      return result;
    }
    const cleanObj: Record<string, any> = {};
    for (const key in obj) {
      if (
        Object.prototype.hasOwnProperty.call(obj, key) &&
        obj[key] !== undefined
      ) {
        cleanObj[key] = deepClean(obj[key]);
      }
    }
    return cleanObj;
  }

  const cleanData = deepClean(data);

  return new Promise<boolean>((resolve) => {
    try {
      // Use a shorter timeout for faster development
      const timeoutId = setTimeout(() => {
        console.warn(`[sampleData] Timeout saving to ${path}/${key}`);
        resolve(false);
      }, 2000);
      
      gun
        .get(path)
        .get(key)
        .put(cleanData, (ack: any) => {
          clearTimeout(timeoutId); // Clear the timeout as we got a response
          if (ack && ack.err) {
            console.warn(`[sampleData] Error saving to ${path}/${key}: ${ack.err}`);
            resolve(false);
          } else {
            console.log(`[sampleData] Successfully wrote to ${path}/${key}`);
            // Verify the data was actually stored by reading it back
            gun.get(path).get(key).once((data) => {
              const success = data !== undefined;
              console.log(`[sampleData] Verification for ${path}/${key}: ${success ? 'SUCCESS' : 'FAILED'}`);
              resolve(success);
            });
          }
        });
    } catch (error) {
      console.error(`[sampleData] Exception for ${path}/${key}: ${error?.message || error}`);
      resolve(false);
    }
  });
}

/**
 * Batch save a collection of items
 */
async function saveBatch<T extends { [key: string]: any }>(
  nodePath: string,
  items: T[],
  idField: keyof T,
) {
  console.log(`[seed] Batch saving ${items.length} items to ${nodePath}`);
  for (const item of items) {
    await robustPut(nodePath, String(item[idField]), item);
  }
  await delay(100);
}

/**
 * Batch create relationships
 */
async function createEdgesBatch(
  edgeDefinitions: { fromSoul: string; field: string; toSoul: string }[],
) {
  console.log(
    `[seed] Creating ${edgeDefinitions.length} relationships in batch`,
  );
  
  // Process relationships in sequence with error handling
  for (const def of edgeDefinitions) {
    try {
      console.log(`[seed] Creating relationship: ${def.fromSoul}.${def.field} -> ${def.toSoul}`);
      await createRelationship(def.fromSoul, def.field, def.toSoul);
    } catch (error) {
      console.error(`[seed] Failed to create relationship: ${def.fromSoul}.${def.field} -> ${def.toSoul}`, error);
    }
    // Small delay between operations
    await delay(10);
  }
  
  console.log(`[seed] Completed creating relationships`);
  await delay(500);
}

/**
 * Initialize sample data following the schema in GunSchema.md
 */
export async function initializeSampleData() {
  console.log("[seed] Initializing sample data according to GunSchema.md...");
  const gun = getGun();
  if (!gun) {
    console.error("[seed] Gun not initialized");
    return { success: false, message: "Gun not initialized" };
  }

  const now = Date.now();

  // 1. Users (4 users, u_123 is Admin)
  const users = [
    {
      user_id: "u_123",
      name: "Alice Admin",
      email: "alice@example.com",
      role: "Admin",
      created_at: now,
    },
    {
      user_id: "u_124",
      name: "Bob Member",
      email: "bob@example.com",
      role: "Member",
      created_at: now,
    },
    {
      user_id: "u_125",
      name: "Charlie Member",
      email: "charlie@example.com",
      role: "Member",
      created_at: now,
    },
    {
      user_id: "u_126",
      name: "David Member",
      email: "david@example.com",
      role: "Member",
      created_at: now,
    },
  ];

  // 2. Deck
  const deck = {
    deck_id: "d_1",
    name: "Eco-Village Funder Deck",
    description: "A deck of funder roles for eco-village simulation",
    creator_ref: "u_123",
    is_public: true,
    cards_ref: {
      card_1: true,
      card_2: true,
      card_3: true,
      card_4: true,
      card_5: true,
    },
    created_at: now,
    updated_at: now,
  };

  // 3. Cards from provided JSON
  const cards = [
    {
      card_id: "card_1",
      card_number: 1,
      role_title: "Luminos Funder",
      backstory:
        "A wealthy idealist who left corporate life to fund sustainable communities.",
      goals:
        "Fund projects that reduce ecological footprints and promote self-reliance.",
      obligations:
        "Must report impact to a donor network; cannot fund profit-driven ventures.",
      intellectual_property:
        "Database of sustainable tech solutions, funding strategy playbook.",
      resources: "$50K in discretionary funds, limited staff time.",
      card_category: "Funders",
      type: "Individual",
      icon: "sun",
      creator_ref: "u_123",
      values_ref: {
        value_sustainability: true,
        value_equity: true,
        value_community_resilience: true,
      },
      capabilities_ref: {
        cap_grant_writing: true,
        cap_impact_assessment: true,
      },
      agreements_ref: { ag_1: true, ag_5: true },
      decks_ref: { d_1: true },
      created_at: now,
    },
    {
      card_id: "card_2",
      card_number: 2,
      role_title: "DAO of the Green Veil",
      backstory:
        "A blockchain-based collective pooling crypto for eco-village experiments.",
      goals: "Invest in scalable eco-village models; increase DAO membership.",
      obligations:
        "Decisions must pass a token-weighted vote; funds locked until consensus.",
      intellectual_property: "Governance protocols, tokenomics model.",
      resources: "10 ETH in treasury, limited developer hours.",
      card_category: "Funders",
      type: "DAO",
      icon: "link",
      creator_ref: "u_123",
      values_ref: {
        value_decentralization: true,
        value_sustainability: true,
        value_transparency: true,
      },
      capabilities_ref: {
        cap_smart_contract_dev: true,
        cap_crowdfunding_coord: true,
      },
      agreements_ref: { ag_1: true, ag_2: true },
      decks_ref: { d_1: true },
      created_at: now,
    },
    {
      card_id: "card_3",
      card_number: 3,
      role_title: "PMA Seedkeeper",
      backstory: "A private group funding land trusts for eco-villages.",
      goals: "Secure 100 acres for communal use.",
      obligations: "Funded by member dues; must prioritize member needs.",
      intellectual_property: "PMA governance docs, land trust templates.",
      resources: "$20K in dues, limited legal support.",
      card_category: "Funders",
      type: "PMA",
      icon: "lock",
      creator_ref: "u_123",
      values_ref: {
        value_privacy: true,
        value_sustainability: true,
        value_equity: true,
      },
      capabilities_ref: {
        cap_land_acquisition: true,
        cap_legal_structuring: true,
      },
      agreements_ref: { ag_2: true, ag_3: true },
      decks_ref: { d_1: true },
      created_at: now,
    },
    {
      card_id: "card_4",
      card_number: 4,
      role_title: "Eco-Patron Collective",
      backstory: "A grassroots group pooling micro-donations for eco-projects.",
      goals: "Support 5 local initiatives annually.",
      obligations: "Must align with donor preferences.",
      intellectual_property: "Donor engagement strategies.",
      resources: "$5K in pooled funds, volunteer time.",
      card_category: "Funders",
      type: "Collective",
      icon: "users",
      creator_ref: "u_123",
      values_ref: {
        value_equity: true,
        value_community: true,
        value_sustainability: true,
      },
      capabilities_ref: {
        cap_crowdfunding_mgmt: true,
        cap_community_outreach: true,
      },
      agreements_ref: { ag_3: true, ag_4: true },
      decks_ref: { d_1: true },
      created_at: now,
    },
    {
      card_id: "card_5",
      card_number: 5,
      role_title: "Verdant Venture DAO",
      backstory: "A DAO investing crypto in green tech for eco-villages.",
      goals: "Prototype a scalable tech solution.",
      obligations: "Slow consensus process delays funding.",
      intellectual_property: "Tech evaluation framework.",
      resources: "5 ETH, limited tech expertise.",
      card_category: "Funders",
      type: "DAO",
      icon: "rocket",
      creator_ref: "u_123",
      values_ref: {
        value_innovation: true,
        value_resilience: true,
        value_sustainability: true,
      },
      capabilities_ref: {
        cap_tech_scouting: true,
        cap_blockchain_integration: true,
      },
      agreements_ref: { ag_4: true, ag_5: true },
      decks_ref: { d_1: true },
      created_at: now,
    },
  ];

  // 4. Values
  const values = [
    {
      value_id: "value_sustainability",
      name: "Sustainability",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_equity",
      name: "Equity",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_community_resilience",
      name: "Community Resilience",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_decentralization",
      name: "Decentralization",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_transparency",
      name: "Transparency",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_privacy",
      name: "Privacy",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_community",
      name: "Community",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_innovation",
      name: "Innovation",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_resilience",
      name: "Resilience",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
  ];

  // 5. Capabilities
  const capabilities = [
    {
      capability_id: "cap_grant_writing",
      name: "Grant-writing expertise",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_impact_assessment",
      name: "Impact assessment",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_smart_contract_dev",
      name: "Smart contract development",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_crowdfunding_coord",
      name: "Crowdfunding coordination",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_land_acquisition",
      name: "Land acquisition",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_legal_structuring",
      name: "Legal structuring",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_crowdfunding_mgmt",
      name: "Crowdfunding management",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_community_outreach",
      name: "Community outreach",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_tech_scouting",
      name: "Tech scouting",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_blockchain_integration",
      name: "Blockchain integration",
      creator_ref: "u_123",
      cards_ref: {},
      created_at: now,
    },
  ];

  // 6. Game
  const game = {
    game_id: "g_456",
    name: "Eco-Village Simulation",
    description: "A simulation of eco-village funding and collaboration",
    creator_ref: "u_123",
    deck_ref: "d_1",
    deck_type: "eco-village",
    status: "active",
    created_at: now,
    updated_at: now,
    max_players: 5,
    players: { u_123: true, u_124: true, u_125: true, u_126: true },
    player_actor_map: {
      u_123: "actor_1",  // Alice has two actors (actor_1 and actor_5)
      u_124: "actor_2",
      u_125: "actor_3",
      u_126: "actor_4",
    },
    actors_ref: { actor_1: true, actor_2: true, actor_3: true, actor_4: true },
    agreements_ref: {
      ag_1: true,
      ag_2: true,
      ag_3: true,
      ag_4: true,
      ag_5: true,
    },
    chat_rooms_ref: {},
  };

  // 7. Actors
  const actors = [
    {
      actor_id: "actor_1",
      user_ref: "u_123",
      game_ref: "g_456",
      card_ref: "card_1",
      actor_type: "National Identity",
      custom_name: "Alice's Luminos Funder",
      status: "active",
      agreements_ref: { ag_1: true, ag_4: true, ag_5: true },
      created_at: now,
    },
    {
      actor_id: "actor_2",
      user_ref: "u_124",
      game_ref: "g_456",
      card_ref: "card_2",
      actor_type: "National Identity",
      custom_name: "Bob's Green Veil DAO",
      status: "active",
      agreements_ref: { ag_1: true, ag_2: true, ag_5: true },
      created_at: now,
    },
    {
      actor_id: "actor_3",
      user_ref: "u_125",
      game_ref: "g_456",
      card_ref: "card_3",
      actor_type: "Sovereign Identity",
      custom_name: "Charlie's PMA Seedkeeper",
      status: "active",
      agreements_ref: { ag_2: true, ag_3: true },
      created_at: now,
    },
    {
      actor_id: "actor_4",
      user_ref: "u_126",
      game_ref: "g_456",
      card_ref: "card_4",
      actor_type: "Sovereign Identity",
      custom_name: "David's Eco-Patron",
      status: "active",
      agreements_ref: { ag_3: true, ag_4: true },
      created_at: now,
    },
  ];

  // 8. Agreements
  const agreements = [
    {
      agreement_id: "ag_1",
      game_ref: "g_456",
      creator_ref: "u_123",
      title: "Funding Agreement",
      summary: "Luminos Funder provides capital to Green Veil DAO",
      type: "asymmetric",
      status: "accepted",
      parties: {
        actor_1: {
          card_ref: "card_1",
          obligation: "Provide $10K funding",
          benefit: "Receive impact reports",
        },
        actor_2: {
          card_ref: "card_2",
          obligation: "Implement eco-village project",
          benefit: "Receive funding",
        },
      },
      cards_ref: { card_1: true, card_2: true },
      created_at: now,
      updated_at: now,
      votes: { actor_1: "accept", actor_2: "accept" },
    },
    {
      agreement_id: "ag_2",
      game_ref: "g_456",
      creator_ref: "u_124",
      title: "Land Trust Collaboration",
      summary: "Green Veil DAO and PMA Seedkeeper share land resources",
      type: "symmetric",
      status: "proposed",
      parties: {
        actor_2: {
          card_ref: "card_2",
          obligation: "Contribute governance expertise",
          benefit: "Access to land",
        },
        actor_3: {
          card_ref: "card_3",
          obligation: "Provide land access",
          benefit: "Gain governance support",
        },
      },
      cards_ref: { card_2: true, card_3: true },
      created_at: now,
      votes: { actor_2: "pending", actor_3: "pending" },
    },
    {
      agreement_id: "ag_3",
      game_ref: "g_456",
      creator_ref: "u_125",
      title: "Community Funding Pact",
      summary: "PMA Seedkeeper and Eco-Patron Collective pool resources",
      type: "symmetric",
      status: "rejected",
      parties: {
        actor_3: {
          card_ref: "card_3",
          obligation: "Contribute $5K",
          benefit: "Expand community initiatives",
        },
        actor_4: {
          card_ref: "card_4",
          obligation: "Contribute $5K",
          benefit: "Expand community initiatives",
        },
      },
      cards_ref: { card_3: true, card_4: true },
      created_at: now,
      updated_at: now,
      votes: { actor_3: "reject", actor_4: "reject" },
    },
    {
      agreement_id: "ag_4",
      game_ref: "g_456",
      creator_ref: "u_126",
      title: "Tech Investment Deal",
      summary: "Eco-Patron Collective funds tech project",
      type: "asymmetric",
      status: "completed",
      parties: {
        actor_4: {
          card_ref: "card_4",
          obligation: "Provide $3K funding",
          benefit: "Gain tech prototype access",
        },
        actor_1: {
          card_ref: "card_1",
          obligation: "Develop tech prototype",
          benefit: "Receive funding",
        },
      },
      cards_ref: { card_4: true, card_1: true },
      created_at: now,
      updated_at: now,
      votes: { actor_4: "accept", actor_1: "accept" },
    },
    {
      agreement_id: "ag_5",
      game_ref: "g_456",
      creator_ref: "u_123",
      title: "Resource Sharing",
      summary: "Luminos Funder and Green Veil DAO share resources",
      type: "symmetric",
      status: "accepted",
      parties: {
        actor_1: {
          card_ref: "card_1",
          obligation: "Share funding expertise",
          benefit: "Access tech solutions",
        },
        actor_2: {
          card_ref: "card_2",
          obligation: "Share tech expertise",
          benefit: "Access funding networks",
        },
      },
      cards_ref: { card_1: true, card_2: true },
      created_at: now,
      updated_at: now,
      votes: { actor_1: "accept", actor_2: "accept" },
    },
  ];

  // 9. No chat rooms or messages - removed

  // 10. Node Positions (circular layout)
  const radius = 200;
  const centerX = 400;
  const centerY = 300;
  const actorPositions = actors.map((actor, i) => ({
    node_id: actor.actor_id,
    game_ref: "g_456",
    type: "actor",
    x: centerX + radius * Math.cos((i / actors.length) * 2 * Math.PI),
    y: centerY + radius * Math.sin((i / actors.length) * 2 * Math.PI),
    updated_at: now,
  }));
  const agreementPositions = agreements.map((agreement, i) => ({
    node_id: agreement.agreement_id,
    game_ref: "g_456",
    type: "agreement",
    x: centerX + (radius / 2) * Math.cos((i / agreements.length) * 2 * Math.PI),
    y: centerY + (radius / 2) * Math.sin((i / agreements.length) * 2 * Math.PI),
    updated_at: now,
  }));

  // Save entities in order
  await saveBatch(nodes.users, users, "user_id");
  
  console.log("[seed] Saving deck directly");
  const deckSuccess = await robustPut(nodes.decks, deck.deck_id, deck);
  if (!deckSuccess) {
    console.error("[seed] Failed to save deck, will retry once");
    await delay(500);
    await robustPut(nodes.decks, deck.deck_id, deck);
  }
  
  await saveBatch(nodes.cards, cards, "card_id");
  await saveBatch(nodes.values, values, "value_id");
  await saveBatch(nodes.capabilities, capabilities, "capability_id");
  
  // Direct game creation with retries
  console.log("[seed] Creating game:", game.game_id);
  let gameSuccess = false;
  // Try multiple direct approaches
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[seed] Game creation attempt ${attempt}`);
    gameSuccess = await robustPut(nodes.games, game.game_id, game);
    if (gameSuccess) {
      console.log(`[seed] Game save SUCCEEDED on attempt ${attempt}`);
      break;
    } else {
      console.error(`[seed] Game save FAILED on attempt ${attempt}`);
      await delay(500);
    }
  }
  
  if (!gameSuccess) {
    console.error("[seed] All game creation attempts failed");
    return { success: false, message: "Failed to create game" };
  }
  
  // Continue with actors
  await saveBatch(nodes.actors, actors, "actor_id");
  
  // Save agreements with verification
  console.log("[seed] Creating agreements one by one");
  for (const agreement of agreements) {
    console.log(`[seed] Creating agreement: ${agreement.agreement_id}`);
    const agreementSuccess = await robustPut(nodes.agreements, agreement.agreement_id, agreement);
    if (!agreementSuccess) {
      console.error(`[seed] Failed to create agreement: ${agreement.agreement_id}`);
      // Continue anyway
    } else {
      console.log(`[seed] Successfully created agreement: ${agreement.agreement_id}`);
    }
    await delay(100);
  }

  await saveBatch(
    nodes.node_positions,
    [...actorPositions, ...agreementPositions],
    "node_id",
  );

  // Create relationships
  const allEdges = [];
  // Deck ? Card
  for (const card of cards) {
    allEdges.push({
      fromSoul: `${nodes.decks}/${deck.deck_id}`,
      field: "cards_ref",
      toSoul: `${nodes.cards}/${card.card_id}`,
    });
    allEdges.push({
      fromSoul: `${nodes.cards}/${card.card_id}`,
      field: "decks_ref",
      toSoul: `${nodes.decks}/${deck.deck_id}`,
    });
  }
  // Card ? Value
  for (const card of cards) {
    for (const valueId of Object.keys(card.values_ref)) {
      if (card.values_ref[valueId]) {
        allEdges.push({
          fromSoul: `${nodes.cards}/${card.card_id}`,
          field: "values_ref",
          toSoul: `${nodes.values}/${valueId}`,
        });
        allEdges.push({
          fromSoul: `${nodes.values}/${valueId}`,
          field: "cards_ref",
          toSoul: `${nodes.cards}/${card.card_id}`,
        });
      }
    }
  }
  // Card ? Capability
  for (const card of cards) {
    for (const capabilityId of Object.keys(card.capabilities_ref)) {
      if (card.capabilities_ref[capabilityId]) {
        allEdges.push({
          fromSoul: `${nodes.cards}/${card.card_id}`,
          field: "capabilities_ref",
          toSoul: `${nodes.capabilities}/${capabilityId}`,
        });
        allEdges.push({
          fromSoul: `${nodes.capabilities}/${capabilityId}`,
          field: "cards_ref",
          toSoul: `${nodes.cards}/${card.card_id}`,
        });
      }
    }
  }
  // Game ? Actors, Agreements, Chat
  for (const actor of actors) {
    allEdges.push({
      fromSoul: `${nodes.games}/${game.game_id}`,
      field: "actors_ref",
      toSoul: `${nodes.actors}/${actor.actor_id}`,
    });
    allEdges.push({
      fromSoul: `${nodes.actors}/${actor.actor_id}`,
      field: "game_ref",
      toSoul: `${nodes.games}/${game.game_id}`,
    });
  }
  for (const agreement of agreements) {
    allEdges.push({
      fromSoul: `${nodes.games}/${game.game_id}`,
      field: "agreements_ref",
      toSoul: `${nodes.agreements}/${agreement.agreement_id}`,
    });
  }
  // Chat room reference removed
  // Actor ? Agreement
  for (const agreement of agreements) {
    for (const actorId of Object.keys(agreement.parties)) {
      allEdges.push({
        fromSoul: `${nodes.actors}/${actorId}`,
        field: "agreements_ref",
        toSoul: `${nodes.agreements}/${agreement.agreement_id}`,
      });
      allEdges.push({
        fromSoul: `${nodes.agreements}/${agreement.agreement_id}`,
        field: "parties",
        toSoul: `${nodes.actors}/${actorId}`,
      });
    }
  }
  // User ? Actor
  for (const actor of actors) {
    allEdges.push({
      fromSoul: `${nodes.users}/${actor.user_ref}`,
      field: "actors_ref",
      toSoul: `${nodes.actors}/${actor.actor_id}`,
    });
  }
  // Game ? Deck
  allEdges.push({
    fromSoul: `${nodes.games}/${game.game_id}`,
    field: "deck_ref",
    toSoul: `${nodes.decks}/${deck.deck_id}`,
  });

  await createEdgesBatch(allEdges);

  console.log("[seed] Sample data initialization complete!");
  return { success: true, message: "Sample data initialized" };
}

/**
 * Verifies that sample data was properly initialized
 */
export async function verifySampleData() {
  console.log("[verify] Verifying sample data...");
  const gun = getGun();
  if (!gun) {
    return { success: false, message: "Gun not initialized" };
  }

  const nodeTypes = Object.values(nodes);
  const counts: Record<string, number> = {};

  async function countEntities(path: string): Promise<number> {
    return new Promise((resolve) => {
      let count = 0;
      gun
        .get(path)
        .map()
        .once((data, key) => {
          if (key && key !== "_" && data) {
            count++;
          }
        });
      setTimeout(() => resolve(count), 500);
    });
  }

  for (const nodeType of nodeTypes) {
    try {
      counts[nodeType] = await countEntities(nodeType);
      console.log(`[verify] ${nodeType}: ${counts[nodeType]} nodes`);
    } catch (error) {
      console.error(`[verify] Error counting ${nodeType}:`, error);
    }
  }

  return { success: true, message: "Verification done", counts };
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
      const nodeData: Record<string, any> = await new Promise((resolve) => {
        const result: Record<string, any> = {};
        gun
          .get(nodeType)
          .map()
          .once((data, key) => {
            if (key && key !== "_" && data) {
              result[key] = null;
            }
          });
        setTimeout(() => resolve(result), 500);
      });

      for (const key of Object.keys(nodeData)) {
        gun.get(nodeType).get(key).put(null);
        await new Promise<void>((resolve) => {
          gun
            .get(nodeType)
            .get(key)
            .once((data: any) => {
              if (data && typeof data === "object") {
                for (const prop in data) {
                  if (
                    data[prop] &&
                    typeof data[prop] === "object" &&
                    data[prop]["#"]
                  ) {
                    gun.get(data[prop]["#"]).put(null);
                  }
                }
              }
              setTimeout(resolve, 10);
            });
        });
      }
      await delay(10);
    } catch (error) {
      console.error(`[clear] Error clearing ${nodeType}:`, error);
    }
  }

  return { success: true, message: "Sample data cleared" };
}
