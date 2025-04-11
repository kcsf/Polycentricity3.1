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
  // Add a created_at if not present
  const payload = { ...data, created_at: data.created_at ?? Date.now() };
  // Use your existing `put(...)` function
  const ack = await withTimeout(put(soul, payload), 30000);
  logAck(soul, ack);
}

/**
 * Main function to seed the data with Gun edges
 */
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

  const cards = [
    {
      card_id: "c1",
      card_number: 1,
      role_title: "Verdant Weaver",
      backstory:
        "A skilled cultivator who weaves plant life into sustainable systems.",
      rawValues: ["Sustainability", "Community Resilience"],
      rawCapabilities: ["Permaculture Design", "Project Management"], // <-- "Project Management" is shared
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
      rawValues: ["Sustainability", "Transparency"], // <-- "Sustainability" is shared
      rawCapabilities: ["Smart Contract Development", "Project Management"],
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

  const actors = [
    { actor_id: "a1", game_id: game.game_id, user_id: "u123", card_id: "c1" },
    { actor_id: "a2", game_id: game.game_id, user_id: "u124", card_id: "c2" },
  ];

  const agreement = {
    agreement_id: "ag1",
    game_id: game.game_id,
    title: "Funding for Garden Initiative",
    summary:
      "Luminos Funder provides capital to Verdant Weaver for a community garden",
    type: "asymmetric",
    parties: ["a1", "a2"],
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

  const chat = {
    chat_id: `${game.game_id}_group`,
    game_id: game.game_id,
    type: "group",
    participants: ["u123", "u124"],
    messages: [
      {
        id: generateId(),
        user_id: "u123",
        user_name: "Member User",
        content: "Hello! Let's start planning our eco-village!",
        timestamp: now,
        type: "group",
      },
    ],
  };

  const nodePositions = [
    { node_id: "a1", game_id: game.game_id, x: 100, y: 100 },
    { node_id: "ag1", game_id: game.game_id, x: 300, y: 200 },
  ];

  // 2. Persist the base nodes
  for (const u of users) {
    await ensureNode(`${nodes.users}/${u.user_id}`, u);
  }

  for (const card of cards) {
    const baseCardData = {
      ...card,
      // Remove the rawValues/rawCapabilities so we don't store them as direct fields
      rawValues: undefined,
      rawCapabilities: undefined,
    };
    await ensureNode(`${nodes.cards}/${card.card_id}`, baseCardData);
  }

  await ensureNode(`${nodes.decks}/${deck.deck_id}`, deck);
  await ensureNode(`${nodes.games}/${game.game_id}`, game);

  for (const actor of actors) {
    await ensureNode(`${nodes.actors}/${actor.actor_id}`, actor);
  }

  await ensureNode(`${nodes.agreements}/${agreement.agreement_id}`, agreement);
  await ensureNode(`${nodes.chat}/${chat.chat_id}`, chat);

  for (const pos of nodePositions) {
    await ensureNode(`${nodes.positions}/${pos.node_id}`, pos);
  }

  // 3. Helper to create edges using `.set()`
  function createEdge(fromSoul: string, field: string, toSoul: string) {
    return new Promise<GunAck>((resolve) => {
      getGun()!
        .get(fromSoul)
        .get(field)
        .set(getGun()!.get(toSoul), (ack) => {
          resolve(ack);
        });
    });
  }

  // 4. Deck <--> Card edges
  for (const c of cards) {
    const deckToCard = await withTimeout(
      createEdge(
        `${nodes.decks}/${deck.deck_id}`,
        "cards",
        `${nodes.cards}/${c.card_id}`,
      ),
    );
    logAck(`deck->card ${deck.deck_id} -> ${c.card_id}`, deckToCard);

    const cardToDeck = await withTimeout(
      createEdge(
        `${nodes.cards}/${c.card_id}`,
        "decks",
        `${nodes.decks}/${deck.deck_id}`,
      ),
    );
    logAck(`card->deck ${c.card_id} -> ${deck.deck_id}`, cardToDeck);
  }

  // 5. Values & Capabilities as actual nodes + edges
  for (const c of cards) {
    // For each Value
    for (const vName of c.rawValues) {
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
          `${nodes.cards}/${c.card_id}`,
        ),
      );
      logAck(`value->card ${vId} -> ${c.card_id}`, valToCardAck);

      const cardToValAck = await withTimeout(
        createEdge(
          `${nodes.cards}/${c.card_id}`,
          "values",
          `${nodes.values}/${vId}`,
        ),
      );
      logAck(`card->value ${c.card_id} -> ${vId}`, cardToValAck);
    }

    // For each Capability
    for (const capName of c.rawCapabilities) {
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
          `${nodes.cards}/${c.card_id}`,
        ),
      );
      logAck(`cap->card ${capId} -> ${c.card_id}`, capToCardAck);

      const cardToCapAck = await withTimeout(
        createEdge(
          `${nodes.cards}/${c.card_id}`,
          "capabilities",
          `${nodes.capabilities}/${capId}`,
        ),
      );
      logAck(`card->cap ${c.card_id} -> ${capId}`, cardToCapAck);
    }
  }

  console.log("[seed] Sample data (with edges) initialized ✅");
  return { success: true, message: "Sample data initialized (edge style)" };
}

/**
 * Verify how many child keys exist under each high-level node.
 */
export async function verifySampleData() {
  console.log("[verify] Counting nodes …");
  const gun = getGun();
  if (!gun) {
    return { success: false, message: "Gun not initialized" };
  }

  // Count how many keys appear under a node
  async function count(soul: string) {
    return new Promise<number>((done) => {
      let n = 0;
      gun
        .get(soul)
        .map()
        .once((_data, key) => {
          if (key && key !== "_") n++;
        });
      setTimeout(() => done(n), 700); // give Gun a moment to load
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
