/****************************************************************************************
 * sampleDataService.ts
 * -------------------------------------------------------------------------------------
 * Data initialization service that follows the schema exactly as defined in GunSchema.md
 * Uses direct Gun.js calls with batch processing for efficiency
 * Creates sample data in the correct order: users, decks, cards, values, capabilities,
 * game, actors, agreements, node positions
 * Compatible with +page.svelte for initialization, verification, and clearing
 * Excludes chat rooms and messages
 ***************************************************************************************/

import { getGun, nodes, put, generateId, type GunAck } from "./gunService";

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
        if (val !== undefined) result[String(idx)] = deepClean(val);
      });
      return result;
    }
    const cleanObj: Record<string, any> = {};
    for (const k in obj) {
      if (
        Object.prototype.hasOwnProperty.call(obj, k) &&
        obj[k] !== undefined
      ) {
        cleanObj[k] = deepClean(obj[k]);
      }
    }
    return cleanObj;
  }

  const cleanData = deepClean(data);

  return new Promise<boolean>((resolve) => {
    try {
      gun
        .get(path)
        .get(key)
        .put(cleanData, (ack: any) => {
          if (ack && ack.err) {
            console.warn(
              `[sampleData] Error saving to ${path}/${key}:`,
              ack.err,
            );
            resolve(false);
          } else {
            console.log(`[sampleData] Successfully saved to ${path}/${key}`);
            resolve(true);
          }
        });
      setTimeout(() => resolve(true), 1000);
    } catch (error) {
      console.error(`[sampleData] Exception for ${path}/${key}:`, error);
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
    await delay(100);
  }
  await delay(200);
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

  // 1. Users
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

  // 3. Cards
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
      agreements_ref: { ag_3: true, ag_4: true, ag_5: true },
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
      agreements_ref: {},
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
    role_assignment_type: "player-choice",
    status: "active",
    created_at: now,
    updated_at: now,
    max_players: 5,
    players: { u_123: true, u_124: true, u_125: true, u_126: true },
    player_actor_map: {
      u_123: "actor_1",
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
      games_ref: { g_456: true },
      cards_by_game: { g_456: "card_1" },
      actor_type: "National Identity",
      custom_name: "Alice's Luminos Funder",
      status: "active",
      agreements_ref: { ag_1: true, ag_5: true },
      created_at: now,
    },
    {
      actor_id: "actor_2",
      user_ref: "u_124",
      games_ref: { g_456: true },
      cards_by_game: { g_456: "card_2" },
      actor_type: "National Identity",
      custom_name: "Bob's Green Veil DAO",
      status: "active",
      agreements_ref: { ag_1: true, ag_2: true },
      created_at: now,
    },
    {
      actor_id: "actor_3",
      user_ref: "u_125",
      games_ref: { g_456: true },
      cards_by_game: { g_456: "card_3" },
      actor_type: "Sovereign Identity",
      custom_name: "Charlie's PMA Seedkeeper",
      status: "active",
      agreements_ref: { ag_2: true, ag_3: true },
      created_at: now,
    },
    {
      actor_id: "actor_4",
      user_ref: "u_126",
      games_ref: { g_456: true },
      cards_by_game: { g_456: "card_4" },
      actor_type: "Sovereign Identity",
      custom_name: "David's Eco-Patron",
      status: "active",
      agreements_ref: { ag_3: true, ag_4: true, ag_5: true },
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
      },
      cards_ref: { card_4: true },
      created_at: now,
      updated_at: now,
      votes: { actor_4: "accept" },
    },
    {
      agreement_id: "ag_5",
      game_ref: "g_456",
      creator_ref: "u_123",
      title: "Resource Sharing",
      summary: "Luminos Funder and Eco-Patron Collective share resources",
      type: "symmetric",
      status: "accepted",
      parties: {
        actor_1: {
          card_ref: "card_1",
          obligation: "Share funding expertise",
          benefit: "Access tech solutions",
        },
        actor_4: {
          card_ref: "card_4",
          obligation: "Share tech expertise",
          benefit: "Access funding networks",
        },
      },
      cards_ref: { card_1: true, card_4: true },
      created_at: now,
      updated_at: now,
      votes: { actor_1: "accept", actor_4: "accept" },
    },
  ];

  // 9. Node Positions
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
  await robustPut(nodes.decks, deck.deck_id, deck);
  await saveBatch(nodes.cards, cards, "card_id");
  await saveBatch(nodes.values, values, "value_id");
  await saveBatch(nodes.capabilities, capabilities, "capability_id");
  await robustPut(nodes.games, game.game_id, game);
  await saveBatch(nodes.actors, actors, "actor_id");
  await saveBatch(nodes.agreements, agreements, "agreement_id");
  await saveBatch(
    nodes.node_positions,
    [...actorPositions, ...agreementPositions].map((pos) => ({
      ...pos,
      node_id: `${pos.game_ref}/${pos.node_id}`,
    })),
    "node_id",
  );

  // ----------------------------------------------------------------------
  // Now write all boolean-map refs and denormalized parties exactly per schema:

  // Deck ↔ Card
  for (const c of cards) {
    await robustPut(
      `${nodes.decks}/${deck.deck_id}/cards_ref`,
      c.card_id,
      true,
    );
    await robustPut(
      `${nodes.cards}/${c.card_id}/decks_ref`,
      deck.deck_id,
      true,
    );
  }

  // Card ↔ Value
  for (const c of cards) {
    for (const vId of Object.keys(c.values_ref)) {
      if (c.values_ref[vId]) {
        await robustPut(`${nodes.cards}/${c.card_id}/values_ref`, vId, true);
        await robustPut(`${nodes.values}/${vId}/cards_ref`, c.card_id, true);
      }
    }
  }

  // Card ↔ Capability
  for (const c of cards) {
    for (const capId of Object.keys(c.capabilities_ref)) {
      if (c.capabilities_ref[capId]) {
        await robustPut(
          `${nodes.cards}/${c.card_id}/capabilities_ref`,
          capId,
          true,
        );
        await robustPut(
          `${nodes.capabilities}/${capId}/cards_ref`,
          c.card_id,
          true,
        );
      }
    }
  }

  // Game ↔ Actors & Agreements
  for (const a of actors) {
    await robustPut(
      `${nodes.games}/${game.game_id}/actors_ref`,
      a.actor_id,
      true,
    );
    await robustPut(
      `${nodes.actors}/${a.actor_id}/games_ref`,
      game.game_id,
      true,
    );
  }
  for (const ag of agreements) {
    await robustPut(
      `${nodes.games}/${game.game_id}/agreements_ref`,
      ag.agreement_id,
      true,
    );
  }

  // User ↔ Actor
  for (const a of actors) {
    await robustPut(
      `${nodes.users}/${a.user_ref}/actors_ref`,
      a.actor_id,
      true,
    );
  }

  // Parties (denormalized)
  for (const ag of agreements) {
    for (const [actorId, terms] of Object.entries(ag.parties)) {
      await robustPut(
        `${nodes.agreements}/${ag.agreement_id}/parties`,
        actorId,
        terms,
      );
    }
  }

  // Actor ↔ Agreements
  for (const a of actors) {
    for (const agId of Object.keys(a.agreements_ref)) {
      if (a.agreements_ref[agId]) {
        await robustPut(
          `${nodes.actors}/${a.actor_id}/agreements_ref`,
          agId,
          true,
        );
      }
    }
  }

  // Card ↔ Agreements
  for (const c of cards) {
    for (const agId of Object.keys(c.agreements_ref)) {
      if (c.agreements_ref[agId]) {
        await robustPut(
          `${nodes.cards}/${c.card_id}/agreements_ref`,
          agId,
          true,
        );
        await robustPut(
          `${nodes.agreements}/${agId}/cards_ref`,
          c.card_id,
          true,
        );
      }
    }
  }

  // User ↔ Games
  for (const u of users) {
    await robustPut(
      `${nodes.users}/${u.user_id}/games_ref`,
      game.game_id,
      true,
    );
  }

  // Game ↔ Creator
  await robustPut(
    `${nodes.games}/${game.game_id}/creator_ref`,
    game.creator_ref,
    true,
  );

  // Game ↔ Deck
  await robustPut(
    `${nodes.games}/${game.game_id}/deck_ref`,
    deck.deck_id,
    true,
  );

  // Game ↔ Players
  for (const userId of Object.keys(game.players)) {
    await robustPut(`${nodes.games}/${game.game_id}/players`, userId, true);
  }

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

  const nodeTypes = [
    nodes.users,
    nodes.games,
    nodes.actors,
    nodes.cards,
    nodes.decks,
    nodes.values,
    nodes.capabilities,
    nodes.agreements,
    nodes.node_positions,
  ];
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
      setTimeout(() => resolve(count), 2000); // Increased timeout to ensure all nodes are counted
    });
  }

  for (const nodeType of nodeTypes) {
    try {
      counts[nodeType] = await countEntities(nodeType);
      console.log(`[verify] ${nodeType}: ${counts[nodeType]} nodes`);
    } catch (error) {
      console.error(`[verify] Error counting ${nodeType}:`, error);
    }
    await delay(100);
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

  const nodeTypes = [
    nodes.users,
    nodes.games,
    nodes.actors,
    nodes.cards,
    nodes.decks,
    nodes.values,
    nodes.capabilities,
    nodes.agreements,
    nodes.node_positions,
    nodes.chat_rooms,
    nodes.chat_messages,
  ];

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
        setTimeout(() => resolve(result), 1000);
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
      await delay(100);
    } catch (error) {
      console.error(`[clear] Error clearing ${nodeType}:`, error);
    }
  }

  return { success: true, message: "Sample data cleared" };
}
