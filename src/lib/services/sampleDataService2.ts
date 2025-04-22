/****************************************************************************************
 * sampleDataService.ts (edge-centric version)
 * -------------------------------------------------------------------------------------
 * Seeds:
 *   - Users, Cards, Deck, Game, Actors, Agreements, Chat, Node Positions
 *   - Values & Capabilities (native Gun edges)
 *   - At least one shared Value/Capability among cards
 *
 * Relationship logic:
 *   - deck ↔ card (cards_ref, decks_ref)
 *   - card ↔ values (values_ref, cards_ref)
 *   - card ↔ capabilities (capabilities_ref, cards_ref)
 *   - game ↔ actors, agreements, chat (actors_ref, agreements_ref, chat_rooms_ref)
 *   - actor ↔ agreements (agreements_ref, parties)
 *
 * Uses gameService.ts functions for game-related entities and createRelationship for edges.
 ***************************************************************************************/

import { getGun, nodes, put, generateId, type GunAck } from "./gunService";
import {
  createGame,
  createActor,
  createAgreement,
  joinGame,
  assignCardToActor,
  updatePlayerActorMap,
  updateGameStatus,
  createRelationship,
} from "./gameService";

// Helper function to wait between Gun operations
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Minimized logging function - only logs errors
function logAck(ctx: string, ack: GunAck) {
  if (ack.err) {
    console.warn(`[seed] ${ctx} ✗ ${ack.err}`);
  }
}

/**
 * Create or update a node with minimal logging and delays
 */
async function ensureNode<T extends Record<string, any>>(
  soul: string,
  data: T,
) {
  try {
    const parts = soul.split("/");
    const key = parts.pop() || "";
    const path = parts.join("/");
    const payload = { ...data, created_at: data.created_at ?? Date.now() };
    const success = await robustPut(path, key, payload);
    if (!success) {
      console.warn(`Failed to save ${soul}`);
    }
    await delay(50);
    return success;
  } catch (error) {
    console.error(`Error in ensureNode for ${soul}`);
    return false;
  }
}

/**
 * Optimized put operation for sample data
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
      gun
        .get(path)
        .get(key)
        .put(cleanData, (ack: any) => {
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
  console.log("[seed] Initializing sample data with gameService.ts functions…");
  const gun = getGun();
  if (!gun) {
    return { success: false, message: "Gun not initialized" };
  }

  const now = Date.now();

  // Define sample data
  // 4 users, u_1 is Admin and creator
  const users = [
    {
      user_id: "u_1",
      name: "Alice",
      email: "alice@example.com",
      role: "Admin",
      created_at: now,
    },
    {
      user_id: "u_2",
      name: "Bob",
      email: "bob@example.com",
      role: "Member",
      created_at: now,
    },
    {
      user_id: "u_3",
      name: "Charlie",
      email: "charlie@example.com",
      role: "Member",
      created_at: now,
    },
    {
      user_id: "u_4",
      name: "David",
      email: "david@example.com",
      role: "Member",
      created_at: now,
    },
  ];

  // Values from card JSON
  const values = [
    {
      value_id: "value_sustainability",
      name: "Sustainability",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_equity",
      name: "Equity",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_community_resilience",
      name: "Community Resilience",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_decentralization",
      name: "Decentralization",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_transparency",
      name: "Transparency",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_privacy",
      name: "Privacy",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_community",
      name: "Community",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_innovation",
      name: "Innovation",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      value_id: "value_resilience",
      name: "Resilience",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
  ];

  // Capabilities from card JSON
  const capabilities = [
    {
      capability_id: "cap_grant_writing",
      name: "Grant-writing expertise",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_impact_assessment",
      name: "Impact assessment",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_smart_contract_dev",
      name: "Smart contract development",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_crowdfunding_coord",
      name: "Crowdfunding coordination",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_land_acquisition",
      name: "Land acquisition",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_legal_structuring",
      name: "Legal structuring",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_crowdfunding_mgmt",
      name: "Crowdfunding management",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_community_outreach",
      name: "Community outreach",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_tech_scouting",
      name: "Tech scouting",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
    {
      capability_id: "cap_blockchain_integration",
      name: "Blockchain integration",
      creator_ref: "u_1",
      cards_ref: {},
      created_at: now,
    },
  ];

  // Cards from provided JSON
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
      creator_ref: "u_1",
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
      decks_ref: { d1: true },
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
      creator_ref: "u_1",
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
      decks_ref: { d1: true },
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
      creator_ref: "u_1",
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
      decks_ref: { d1: true },
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
      creator_ref: "u_1",
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
      decks_ref: { d1: true },
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
      creator_ref: "u_1",
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
      decks_ref: { d1: true },
      created_at: now,
    },
  ];

  // Deck
  const deck = {
    deck_id: "d1",
    name: "Eco-Village Funder Deck",
    description: "A deck of funder roles for eco-village simulation",
    creator_ref: "u_1",
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

  // Game
  const game = {
    game_id: "g_456",
    name: "Eco-Village Simulation",
    description: "A simulation of eco-village funding and collaboration",
    creator_ref: "u_1",
    deck_ref: "d1",
    deck_type: "eco-village",
    status: "active",
    created_at: now,
    updated_at: now,
    max_players: 5,
    players: { u_1: true, u_2: true, u_3: true, u_4: true },
    player_actor_map: {
      u_1: "actor_1",
      u_2: "actor_2",
      u_3: "actor_3",
      u_4: "actor_4",
    },
    actors_ref: { actor_1: true, actor_2: true, actor_3: true, actor_4: true },
    agreements_ref: {
      ag_1: true,
      ag_2: true,
      ag_3: true,
      ag_4: true,
      ag_5: true,
    },
    chat_rooms_ref: { chat_g_456: true },
  };

  // Actors
  const actors = [
    {
      actor_id: "actor_1",
      user_ref: "u_1",
      game_ref: "g_456",
      card_ref: "card_1",
      actor_type: "Funder",
      custom_name: "Alice's Luminos Funder",
      status: "active",
      agreements_ref: { ag_1: true, ag_5: true },
      created_at: now,
    },
    {
      actor_id: "actor_2",
      user_ref: "u_2",
      game_ref: "g_456",
      card_ref: "card_2",
      actor_type: "Funder",
      custom_name: "Bob's Green Veil DAO",
      status: "active",
      agreements_ref: { ag_1: true, ag_2: true },
      created_at: now,
    },
    {
      actor_id: "actor_3",
      user_ref: "u_3",
      game_ref: "g_456",
      card_ref: "card_3",
      actor_type: "Funder",
      custom_name: "Charlie's PMA Seedkeeper",
      status: "active",
      agreements_ref: { ag_2: true, ag_3: true },
      created_at: now,
    },
    {
      actor_id: "actor_4",
      user_ref: "u_4",
      game_ref: "g_456",
      card_ref: "card_4",
      actor_type: "Funder",
      custom_name: "David's Eco-Patron",
      status: "active",
      agreements_ref: { ag_3: true, ag_4: true },
      created_at: now,
    },
  ];

  // Agreements
  const agreements = [
    {
      agreement_id: "ag_1",
      game_ref: "g_456",
      creator_ref: "u_1",
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
      creator_ref: "u_2",
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
      creator_ref: "u_3",
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
      creator_ref: "u_4",
      title: "Tech Investment Deal",
      summary: "Eco-Patron Collective funds Verdant Venture DAO's tech project",
      type: "asymmetric",
      status: "completed",
      parties: {
        actor_4: {
          card_ref: "card_4",
          obligation: "Provide $3K funding",
          benefit: "Gain tech prototype access",
        },
        actor_5: {
          card_ref: "card_5",
          obligation: "Develop tech prototype",
          benefit: "Receive funding",
        },
      },
      cards_ref: { card_4: true, card_5: true },
      created_at: now,
      updated_at: now,
      votes: { actor_4: "accept", actor_5: "accept" },
    },
    {
      agreement_id: "ag_5",
      game_ref: "g_456",
      creator_ref: "u_1",
      title: "Resource Sharing",
      summary: "Luminos Funder and Verdant Venture DAO share resources",
      type: "symmetric",
      status: "accepted",
      parties: {
        actor_1: {
          card_ref: "card_1",
          obligation: "Share funding expertise",
          benefit: "Access tech solutions",
        },
        actor_5: {
          card_ref: "card_5",
          obligation: "Share tech expertise",
          benefit: "Access funding networks",
        },
      },
      cards_ref: { card_1: true, card_5: true },
      created_at: now,
      updated_at: now,
      votes: { actor_1: "accept", actor_5: "accept" },
    },
  ];

  // Chat Room and Messages
  const messageId = generateId();
  const chat = {
    chat_id: "chat_g_456",
    game_ref: "g_456",
    type: "group",
    participants_ref: {
      actor_1: true,
      actor_2: true,
      actor_3: true,
      actor_4: true,
    },
    messages_ref: { day_20250421: true },
    created_at: now,
    last_message_at: now,
  };
  const messages = [
    {
      message_id: messageId,
      chat_ref: "chat_g_456",
      game_ref: "g_456",
      sender_ref: "u_1",
      sender_name: "Alice",
      content: "Let’s discuss the funding agreement!",
      type: "group",
      read_by_ref: { u_1: true },
      created_at: now,
    },
  ];

  // Node Positions (circular layout)
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

  // Batch save helper
  async function saveBatch<T extends { [key: string]: any }>(
    nodePath: string,
    items: T[],
    idField: keyof T,
  ) {
    console.log(`[seed] Batch saving ${items.length} items to ${nodePath}`);
    const gun = getGun();
    if (!gun) {
      console.error(`[batch] Gun not initialized for ${nodePath}`);
      return false;
    }
    for (const item of items) {
      await ensureNode(`${nodePath}/${item[idField]}`, item);
    }
    await delay(100);
    return true;
  }

  // Save non-gameService entities
  await saveBatch(nodes.users, users, "user_id");
  await saveBatch(nodes.values, values, "value_id");
  await saveBatch(nodes.capabilities, capabilities, "capability_id");
  await saveBatch(nodes.cards, cards, "card_id");
  await ensureNode(`${nodes.decks}/${deck.deck_id}`, deck);
  await ensureNode(`${nodes.chat_rooms}/${chat.chat_id}`, chat);
  await saveBatch(nodes.chat_messages, messages, "message_id");

  // Use gameService.ts for game, actors, and agreements
  await createGame(game.name, game.deck_type, "choice");
  for (const user of users) {
    await joinGame(game.game_id, user.user_id);
  }
  for (const actor of actors) {
    await createActor(
      actor.game_ref,
      actor.card_ref,
      actor.actor_type,
      actor.custom_name,
    );
    await assignCardToActor(actor.actor_id, actor.card_ref);
  }
  for (const agreement of agreements) {
    await createAgreement(
      agreement.game_ref,
      agreement.title,
      agreement.summary,
      Object.keys(agreement.parties),
      Object.fromEntries(
        Object.entries(agreement.parties).map(([actorId, party]) => [
          actorId,
          { obligations: [party.obligation], benefits: [party.benefit] },
        ]),
      ),
    );
  }
  await updatePlayerActorMap(game.game_id, game.player_actor_map);
  await updateGameStatus(game.game_id, "active");
  await saveBatch(
    nodes.node_positions,
    [...actorPositions, ...agreementPositions],
    "node_id",
  );

  // Create edges
  async function createEdgesBatch(
    edgeDefinitions: { fromSoul: string; field: string; toSoul: string }[],
  ) {
    console.log(
      `[createEdgesBatch] Creating ${edgeDefinitions.length} edges in batch`,
    );
    try {
      await Promise.all(
        edgeDefinitions.map((def) =>
          createRelationship(def.fromSoul, def.field, def.toSoul),
        ),
      );
      return { ok: true, count: edgeDefinitions.length };
    } catch (error) {
      console.error(
        "[createEdgesBatch] Exception during batch operation:",
        error,
      );
      return { err: String(error), ok: false };
    }
  }

  const allEdges = [];
  // Deck ↔ Card
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
  // Card ↔ Value
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
  // Card ↔ Capability
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
  // Game ↔ Actors, Agreements, Chat
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
  allEdges.push({
    fromSoul: `${nodes.games}/${game.game_id}`,
    field: "chat_rooms_ref",
    toSoul: `${nodes.chat_rooms}/${chat.chat_id}`,
  });
  // Actor ↔ Agreement
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
  // User ↔ Actor
  for (const actor of actors) {
    allEdges.push({
      fromSoul: `${nodes.users}/${actor.user_ref}`,
      field: "actors_ref",
      toSoul: `${nodes.actors}/${actor.actor_id}`,
    });
  }
  // Game ↔ Deck
  allEdges.push({
    fromSoul: `${nodes.games}/${game.game_id}`,
    field: "deck_ref",
    toSoul: `${nodes.decks}/${deck.deck_id}`,
  });

  const batchResult = await createEdgesBatch(allEdges);
  if (batchResult.ok) {
    console.log(
      `[seed] Successfully created ${batchResult.count || allEdges.length} relationships`,
    );
  } else {
    console.warn(
      `[seed] Error in batch creation of relationships: ${batchResult.err || "Unknown error"}`,
    );
  }

  console.log("[seed] Sample data initialized ✅");
  await delay(300);
  return {
    success: true,
    message: "Sample data initialized with gameService.ts",
  };
}

export async function clearSampleData() {
  console.log("[clear] Clearing all sample data...");
  const gun = getGun();
  if (!gun) {
    return { success: false, message: "Gun not initialized" };
  }

  const nodesToClear = [
    nodes.users,
    nodes.cards,
    nodes.decks,
    nodes.values,
    nodes.capabilities,
    nodes.games,
    nodes.actors,
    nodes.agreements,
    nodes.chat_rooms,
    nodes.chat_messages,
    nodes.node_positions,
  ];

  for (const nodePath of nodesToClear) {
    try {
      console.log(`[clear] Clearing all data in ${nodePath}...`);
      const keys: string[] = [];
      await new Promise<void>((resolve) => {
        gun
          .get(nodePath)
          .map()
          .once((data, key) => {
            if (key && key !== "_") keys.push(key);
          });
        setTimeout(() => resolve(), 300);
      });

      console.log(
        `[clear] Found ${keys.length} items to remove from ${nodePath}`,
      );
      for (const key of keys) {
        gun.get(nodePath).get(key).put(null);
        await new Promise<void>((resolve) => {
          gun
            .get(nodePath)
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
              setTimeout(resolve, 20);
            });
        });
      }
      await delay(300);
    } catch (error) {
      console.error(`[clear] Error clearing ${nodePath}:`, error);
    }
  }

  await delay(800);
  console.log("[clear] Sample data cleared ✅");
  return { success: true, message: "Sample data cleared" };
}

export async function verifySampleData() {
  console.log("[verify] Counting nodes…");
  if (!getGun()) {
    return { success: false, message: "Gun not initialized" };
  }

  await delay(200);
  async function count(soul: string) {
    return new Promise<number>((done) => {
      let n = 0;
      const gunInstance = getGun();
      if (!gunInstance) {
        console.error(`[count] Gun not initialized for count(${soul})`);
        done(0);
        return;
      }
      gunInstance
        .get(soul)
        .map()
        .once((data, key) => {
          if (
            key &&
            key !== "_" &&
            data !== null &&
            Object.keys(data).length > 0
          )
            n++;
        });
      setTimeout(() => done(n), 300);
    });
  }

  const counts = {
    users: await count(nodes.users),
    cards: await count(nodes.cards),
    decks: await count(nodes.decks),
    values: await count(nodes.values),
    capabilities: await count(nodes.capabilities),
    games: await count(nodes.games),
    actors: await count(nodes.actors),
    agreements: await count(nodes.agreements),
    chat_rooms: await count(nodes.chat_rooms),
    chat_messages: await count(nodes.chat_messages),
    node_positions: await count(nodes.node_positions),
  };

  console.table(counts);
  console.log("[verify] Complete ✔");
  return { success: true, message: "Verification done", counts };
}
