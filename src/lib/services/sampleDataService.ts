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

import { getGun, nodes } from "./gunService";
import type { IGunInstance, IGunChain } from "gun";

/**
 * Helper to create an edge (relationship) via Gun.js’s .set()
 * Resolves true on success or after a 500 ms fallback.
 */
export async function createEdge(
  fromPath: string,
  fromKey: string,
  toPath: string,
  toKey: string,
): Promise<boolean> {
  const gun = getGun() as IGunInstance | undefined;
  if (!gun) {
    console.error(
      `[sampleData] Gun not initialized, cannot create edge ${fromPath}/${fromKey} → ${toPath}/${toKey}`,
    );
    return false;
  }

  const fromNode = gun.get(fromPath).get(fromKey);
  const toNode = gun.get(toPath).get(toKey);
  let done = false;

  return new Promise<boolean>((resolve) => {
    // 1) issue the .set()
    fromNode.set(toNode, (ack: any) => {
      if (done) return;
      done = true;
      if (ack?.err) {
        console.error(
          `[sampleData] Error creating edge ${fromPath}/${fromKey} → ${toPath}/${toKey}:`,
          ack.err,
        );
        resolve(false);
      } else {
        console.log(
          `[sampleData] Created edge ${fromPath}/${fromKey} → ${toPath}/${toKey}`,
        );
        resolve(true);
      }
    });

    // 2) fallback in case no ack ever arrives
    setTimeout(() => {
      if (!done) {
        done = true;
        console.warn(
          `[sampleData] Fallback timeout for edge ${fromPath}/${fromKey} → ${toPath}/${toKey}, assuming success`,
        );
        resolve(true);
      }
    }, 500);
  });
}

/**
 * Helper to wait between Gun operations
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simplified write: fires a put() and resolves on the ack or a short timeout
 */
export async function write(
  path: string,
  key: string,
  data: any,
): Promise<boolean> {
  const gun = getGun() as IGunInstance | undefined;
  if (!gun) {
    console.error(
      `[sampleData] Gun not initialized, cannot write ${path}/${key}`,
    );
    return false;
  }

  // deepClean: remove undefined, "_" metadata, and any "#"/":" pointers
  function deepClean(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;
    const out: Record<string, any> = {};
    for (const k in obj) {
      if (
        Object.hasOwnProperty.call(obj, k) &&
        obj[k] !== undefined &&
        k !== "_" &&
        !k.startsWith("#") &&
        !k.startsWith(":")
      ) {
        out[k] = deepClean(obj[k]);
      }
    }
    return out;
  }

  const cleanData = deepClean(data);
  const node = gun.get(path).get(key);
  let done = false;

  return new Promise<boolean>((resolve) => {
    // 1) Fire the put
    node.put(cleanData, (ack: any) => {
      if (done) return;
      done = true;
      if (ack?.err) {
        console.error(`[sampleData] Error writing ${path}/${key}:`, ack.err);
        resolve(false);
      } else {
        console.log(`[sampleData] Wrote ${path}/${key}`);
        resolve(true);
      }
    });

    // 2) Fallback in case ack never arrives
    setTimeout(() => {
      if (!done) {
        done = true;
        console.warn(
          `[sampleData] Fallback timeout for ${path}/${key}, assuming success`,
        );
        resolve(true);
      }
    }, 500);
  });
}

/**
 * Batch save a collection of items
 */
async function saveBatch<T extends { [key: string]: any }>(
  nodePath: string,
  items: T[],
  idField: keyof T,
): Promise<boolean> {
  for (const item of items) {
    const success = await write(nodePath, String(item[idField]), item);
    if (!success) {
      console.error(`[sampleData] Failed to save ${nodePath}/${item[idField]}`);
      return false;
    }
    await delay(100);
  }
  return true;
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
  console.log("[seed] Saving users...");
  const users = [
    {
      user_id: "u_123",
      name: "Alice Admin",
      email: "alice@example.com",
      role: "Admin",
      created_at: now,
      games_ref: { g_456: true },
      actors_ref: { actor_1: true },
    },
    {
      user_id: "u_124",
      name: "Bob Member",
      email: "bob@example.com",
      role: "Member",
      created_at: now,
      games_ref: { g_456: true },
      actors_ref: { actor_2: true },
    },
    {
      user_id: "u_125",
      name: "Charlie Member",
      email: "charlie@example.com",
      role: "Member",
      created_at: now,
      games_ref: { g_456: true },
      actors_ref: { actor_3: true },
    },
    {
      user_id: "u_126",
      name: "David Member",
      email: "david@example.com",
      role: "Member",
      created_at: now,
      games_ref: { g_456: true },
      actors_ref: { actor_4: true },
    },
  ];

  // 2. Deck
  console.log("[seed] Saving deck...");
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
  console.log("[seed] Saving cards...");
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
  console.log("[seed] Saving values...");
  const values = [
    {
      value_id: "value_sustainability",
      name: "Sustainability",
      creator_ref: "u_123",
      cards_ref: {
        card_1: true,
        card_2: true,
        card_3: true,
        card_4: true,
        card_5: true,
      },
      created_at: now,
    },
    {
      value_id: "value_equity",
      name: "Equity",
      creator_ref: "u_123",
      cards_ref: { card_1: true, card_3: true, card_4: true },
      created_at: now,
    },
    {
      value_id: "value_community_resilience",
      name: "Community Resilience",
      creator_ref: "u_123",
      cards_ref: { card_1: true },
      created_at: now,
    },
    {
      value_id: "value_decentralization",
      name: "Decentralization",
      creator_ref: "u_123",
      cards_ref: { card_2: true },
      created_at: now,
    },
    {
      value_id: "value_transparency",
      name: "Transparency",
      creator_ref: "u_123",
      cards_ref: { card_2: true },
      created_at: now,
    },
    {
      value_id: "value_privacy",
      name: "Privacy",
      creator_ref: "u_123",
      cards_ref: { card_3: true },
      created_at: now,
    },
    {
      value_id: "value_community",
      name: "Community",
      creator_ref: "u_123",
      cards_ref: { card_4: true },
      created_at: now,
    },
    {
      value_id: "value_innovation",
      name: "Innovation",
      creator_ref: "u_123",
      cards_ref: { card_5: true },
      created_at: now,
    },
    {
      value_id: "value_resilience",
      name: "Resilience",
      creator_ref: "u_123",
      cards_ref: { card_5: true },
      created_at: now,
    },
  ];

  // 5. Capabilities
  console.log("[seed] Saving capabilities...");
  const capabilities = [
    {
      capability_id: "cap_grant_writing",
      name: "Grant-writing expertise",
      creator_ref: "u_123",
      cards_ref: { card_1: true },
      created_at: now,
    },
    {
      capability_id: "cap_impact_assessment",
      name: "Impact assessment",
      creator_ref: "u_123",
      cards_ref: { card_1: true },
      created_at: now,
    },
    {
      capability_id: "cap_smart_contract_dev",
      name: "Smart contract development",
      creator_ref: "u_123",
      cards_ref: { card_2: true },
      created_at: now,
    },
    {
      capability_id: "cap_crowdfunding_coord",
      name: "Crowdfunding coordination",
      creator_ref: "u_123",
      cards_ref: { card_2: true },
      created_at: now,
    },
    {
      capability_id: "cap_land_acquisition",
      name: "Land acquisition",
      creator_ref: "u_123",
      cards_ref: { card_3: true },
      created_at: now,
    },
    {
      capability_id: "cap_legal_structuring",
      name: "Legal structuring",
      creator_ref: "u_123",
      cards_ref: { card_3: true },
      created_at: now,
    },
    {
      capability_id: "cap_crowdfunding_mgmt",
      name: "Crowdfunding management",
      creator_ref: "u_123",
      cards_ref: { card_4: true },
      created_at: now,
    },
    {
      capability_id: "cap_community_outreach",
      name: "Community outreach",
      creator_ref: "u_123",
      cards_ref: { card_4: true },
      created_at: now,
    },
    {
      capability_id: "cap_tech_scouting",
      name: "Tech scouting",
      creator_ref: "u_123",
      cards_ref: { card_5: true },
      created_at: now,
    },
    {
      capability_id: "cap_blockchain_integration",
      name: "Blockchain integration",
      creator_ref: "u_123",
      cards_ref: { card_5: true },
      created_at: now,
    },
  ];

  // Parallelize independent saves
  // 1. Save users, deck and cards in parallel
  const [ usersSaved, deckSaved, cardsSaved ] = await Promise.all([
    saveBatch(nodes.users, users,   "user_id"),
    saveBatch(nodes.decks, [deck],  "deck_id"),
    saveBatch(nodes.cards, cards,   "card_id")
  ]);

  if (!usersSaved || !deckSaved || !cardsSaved) {
    console.error("[seed] Failed to save users, deck or cards – aborting");
    return { success: false, message: "Failed to save initial entities" };
  }
  console.log("[seed] Saved users, deck and cards");

  // 2. Write nested refs for cards
  console.log("[seed] Writing nested refs for cards...");
  await Promise.all(cards.map(card =>
    Promise.all([
      write(`${nodes.cards}/${card.card_id}`, "decks_ref",        card.decks_ref),
      write(`${nodes.cards}/${card.card_id}`, "values_ref",       card.values_ref),
      write(`${nodes.cards}/${card.card_id}`, "capabilities_ref", card.capabilities_ref),
      write(`${nodes.cards}/${card.card_id}`, "agreements_ref",   card.agreements_ref)
    ])
  ));
  console.log("[seed] Saved card nested refs");

  // 3. Save values and capabilities in parallel
  const [ valuesSaved, capabilitiesSaved ] = await Promise.all([
    saveBatch(nodes.values,       values,       "value_id"),
    saveBatch(nodes.capabilities, capabilities, "capability_id")
  ]);

  if (!valuesSaved || !capabilitiesSaved) {
    console.error("[seed] Failed to save values or capabilities – aborting");
    return { success: false, message: "Failed to save initial entities" };
  }
  console.log("[seed] Saved values and capabilities");

  // 4. Write nested refs for values
  console.log("[seed] Writing nested refs for values...");
  await Promise.all(values.map(value =>
    write(`${nodes.values}/${value.value_id}`, "cards_ref", value.cards_ref)
  ));
  console.log("[seed] Saved value nested refs");

  // 5. Write nested refs for capabilities
  console.log("[seed] Writing nested refs for capabilities...");
  await Promise.all(capabilities.map(cap =>
    write(`${nodes.capabilities}/${cap.capability_id}`, "cards_ref", cap.cards_ref)
  ));
  console.log("[seed] Saved capability nested refs");


  // 6. Game
  console.log("[seed] Saving game...");
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
    // we’ll write these nested maps separately
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

  // write the top-level game object (without the nested maps)
  const { players, player_actor_map, actors_ref, agreements_ref, ...gameRoot } =
    game;
  const ok = await write(nodes.games, game.game_id, gameRoot);
  if (!ok) {
    console.error("[seed] Failed to save game, aborting");
    return { success: false, message: "Failed to save game" };
  }
  console.log("[seed] Saved game");

  // now write each of the nested maps explicitly:
  await write(`${nodes.games}/${game.game_id}`, "players", players);
  await write(
    `${nodes.games}/${game.game_id}`,
    "player_actor_map",
    player_actor_map,
  );
  await write(`${nodes.games}/${game.game_id}`, "actors_ref", actors_ref);
  await write(
    `${nodes.games}/${game.game_id}`,
    "agreements_ref",
    agreements_ref,
  );
  console.log("[seed] Saved game nested maps");

  // 7. Actors
  console.log("[seed] Saving actors...");
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
      updated_at: now,
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
      updated_at: now,
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
      updated_at: now,
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
      updated_at: now,
    },
  ];
  const actorsSuccess = await saveBatch(nodes.actors, actors, "actor_id");
  if (!actorsSuccess) {
    console.error("[seed] Failed to save actors, aborting initialization");
    return { success: false, message: "Failed to save actors" };
  }
  console.log("[seed] Saved actors");

  // 8. Agreements
  console.log("[seed] Saving agreements...");
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
  const agreementsSuccess = await saveBatch(
    nodes.agreements,
    agreements,
    "agreement_id",
  );
  if (!agreementsSuccess) {
    console.error("[seed] Failed to save agreements, aborting initialization");
    return { success: false, message: "Failed to save agreements" };
  }
  console.log("[seed] Saved agreements");

  // 9. Node Positions
  console.log("[seed] Saving node positions...");
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
  const nodePositionsSuccess = await saveBatch(
    nodes.node_positions,
    [...actorPositions, ...agreementPositions].map((pos) => ({
      ...pos,
      node_id: `${pos.game_ref}/${pos.node_id}`,
    })),
    "node_id",
  );
  if (!nodePositionsSuccess) {
    console.error(
      "[seed] Failed to save node positions, aborting initialization",
    );
    return { success: false, message: "Failed to save node positions" };
  }
  console.log("[seed] Saved node positions");

  // 10. Create edges using .set()
  console.log("[seed] Creating edges...");
  // Game ↔ Actors
  for (const a of actors) {
    await createEdge(
      `${nodes.games}/${game.game_id}`,
      "actors_ref",
      nodes.actors,
      a.actor_id,
    );
    await createEdge(
      `${nodes.actors}/${a.actor_id}`,
      "games_ref",
      nodes.games,
      game.game_id,
    );
  }
  // Game ↔ Agreements
  for (const ag of agreements) {
    await createEdge(
      `${nodes.games}/${game.game_id}`,
      "agreements_ref",
      nodes.agreements,
      ag.agreement_id,
    );
  }
  // User ↔ Actor
  for (const a of actors) {
    await createEdge(
      `${nodes.users}/${a.user_ref}`,
      "actors_ref",
      nodes.actors,
      a.actor_id,
    );
  }
  // User ↔ Games
  for (const u of users) {
    await createEdge(
      `${nodes.users}/${u.user_id}`,
      "games_ref",
      nodes.games,
      game.game_id,
    );
  }
  // Game ↔ Creator
  await createEdge(
    `${nodes.games}/${game.game_id}`,
    "creator_ref",
    nodes.users,
    game.creator_ref,
  );
  // Game ↔ Deck
  await createEdge(
    `${nodes.games}/${game.game_id}`,
    "deck_ref",
    nodes.decks,
    deck.deck_id,
  );
  console.log("[seed] Created edges");

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
      setTimeout(() => resolve(count), 2000);
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

  // Verify nested fields
  const nestedChecks = [
    {
      path: `${nodes.actors}/actor_1/cards_by_game`,
      expected: { g_456: "card_1" },
    },
    {
      path: `${nodes.actors}/actor_2/cards_by_game`,
      expected: { g_456: "card_2" },
    },
    {
      path: `${nodes.actors}/actor_3/cards_by_game`,
      expected: { g_456: "card_3" },
    },
    {
      path: `${nodes.actors}/actor_4/cards_by_game`,
      expected: { g_456: "card_4" },
    },
    {
      path: `${nodes.games}/g_456/player_actor_map`,
      expected: {
        u_123: "actor_1",
        u_124: "actor_2",
        u_125: "actor_3",
        u_126: "actor_4",
      },
    },
    { path: `${nodes.cards}/card_1/decks_ref`, expected: { d_1: true } },
  ];

  for (const check of nestedChecks) {
    await new Promise<void>((resolve) => {
      gun.get(check.path).once((data: any) => {
        const cleanedData = data
          ? (() => {
              const cleanObj: Record<string, any> = {};
              for (const k in data) {
                if (
                  Object.prototype.hasOwnProperty.call(data, k) &&
                  data[k] !== undefined &&
                  k !== "_" &&
                  !k.startsWith("#") &&
                  !k.startsWith(":")
                ) {
                  cleanObj[k] = data[k];
                }
              }
              return cleanObj;
            })()
          : null;
        if (JSON.stringify(cleanedData) === JSON.stringify(check.expected)) {
          console.log(`[verify] ${check.path} matches expected value`);
        } else {
          console.error(
            `[verify] ${check.path} does not match expected value`,
            cleanedData,
            check.expected,
          );
        }
        resolve();
      });
    });
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

  console.log("[clear] Sample data cleared!");
  return { success: true, message: "Sample data cleared" };
}
