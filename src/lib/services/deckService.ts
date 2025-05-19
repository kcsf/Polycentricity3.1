import { getGun, nodes, get } from "./gunService";
import type { Deck, Card } from "$lib/types";
import { generateSequentialCardId, standardizeValueId, standardizeCapabilityId } from "./cardUtils";

// Helper to wait between Gun operations
type Delay = (ms: number) => Promise<void>;
const delay: Delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Strip out Gun.js metadata and collapse any *_ref maps
 * to only the { id: true } entries.
 */
function deepClean<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") return obj;
    const out = {} as any;
    for (const k in obj as any) {
      const v = (obj as any)[k];
      if (
        v !== undefined &&
        k !== "_" &&
        !k.startsWith("#") &&
        !k.startsWith(":")
      ) {
        if (k.endsWith("_ref") && typeof v === "object") {
          out[k] = Object.entries(v)
            .filter(([, val]) => val === true)
            .reduce((acc, [id]) => ((acc[id] = true), acc), {} as Record<string, boolean>);
        } else {
          out[k] = deepClean(v);
        }
      }
    }
    return out;
  }

// Simplified write: fires a put() and resolves on the ack or a short timeout
async function write(path: string, key: string, data: any): Promise<boolean> {
  const gun = getGun();
  if (!gun) {
    console.error(`[deckService] Cannot save to ${path}/${key} - Gun not initialized`);
    return false;
  }

  const cleanData = deepClean(data);
  const node = gun.get(path).get(key);
  let done = false;

  return new Promise<boolean>((resolve) => {
    node.put(cleanData, (ack: any) => {
      if (done) return;
      done = true;
      if (ack?.err) {
        console.warn(`[deckService] Error saving to ${path}/${key}:`, ack.err);
        resolve(false);
      } else {
        console.log(`[deckService] Successfully saved to ${path}/${key}`);
        resolve(true);
      }
    });

    setTimeout(() => {
      if (!done) {
        done = true;
        console.warn(`[deckService] Fallback timeout for ${path}/${key}, assuming success`);
        resolve(true);
      }
    }, 1000);
  });
}

// Create an edge using Gun.js’s .set()  (still used for value & capability edges)
async function createEdge(
  fromPath: string,
  fromKey: string,
  toPath: string,
  toKey: string
): Promise<boolean> {
  const gun = getGun();
  if (!gun) {
    console.error(
      `[deckService] Cannot create edge ${fromPath}/${fromKey} → ${toPath}/${toKey}`
    );
    return false;
  }

  const fromNode = gun.get(fromPath).get(fromKey);
  const toNode = gun.get(toPath).get(toKey);
  let done = false;

  return new Promise<boolean>((resolve) => {
    fromNode.set(toNode, (ack: any) => {
      if (done) return;
      done = true;
      if (ack?.err) {
        console.warn(
          `[deckService] Error creating edge ${fromPath}/${fromKey} → ${toPath}/${toKey}:`,
          ack.err
        );
        resolve(false);
      } else {
        console.log(
          `[deckService] Created edge ${fromPath}/${fromKey} → ${toPath}/${toKey}`
        );
        resolve(true);
      }
    });

    setTimeout(() => {
      if (!done) {
        done = true;
        console.warn(
          `[deckService] Fallback timeout for edge ${fromPath}/${fromKey} → ${toPath}/${toKey}, assuming success`
        );
        resolve(true);
      }
    }, 1000);
  });
}

// Get a deck by ID
export async function getDeck(deckId: string): Promise<Deck | null> {
    const gun = getGun();
    if (!gun) return null;
    return new Promise((resolve) => {
      gun
        .get(nodes.decks)
        .get(deckId)
        .once((raw) => {
          if (!raw) return resolve(null);
          const data = deepClean(raw);
          resolve({
            ...data,
            deck_id: deckId,
            cards_ref: data.cards_ref || {},
            values_ref: data.values_ref || {},
            capabilities_ref: data.capabilities_ref || {},
            agreements_ref: data.agreements_ref || {},
            actors_ref: data.actors_ref || {},
          } as Deck);
        });
    });
  }  

// Update a deck
export async function updateDeck(
  deckId: string,
  updates: Partial<Deck>
): Promise<boolean> {
  console.log(`[updateDeck] Updating deck ${deckId} with`, updates);
  try {
    const validUpdate = { ...updates, deck_id: deckId } as Deck;
    return await write(nodes.decks, deckId, validUpdate);
  } catch (error) {
    console.error("[updateDeck] Error:", error);
    return false;
  }
}

// Create a new card
export async function createCard(
    card: Omit<Card, "card_id" | "created_at" | "agreements_ref" | "decks_ref">
  ): Promise<Card | null> {
    console.log("[createCard] Creating card:", card.role_title);
    const cardId = await generateSequentialCardId();
    console.log(`[createCard] Generated card ID: ${cardId}`);
  
    const createdAt = Date.now();
    // start with empty refs
    const gunCard: Card = {
      card_id: cardId,
      card_number: card.card_number,
      role_title: card.role_title,
      backstory: card.backstory || "",
      goals: card.goals || "",
      obligations: card.obligations || "",
      intellectual_property: card.intellectual_property || "",
      resources: card.resources || "",
      values_ref: {},
      capabilities_ref: {},
      decks_ref: {},
      agreements_ref: {},
      card_category: card.card_category || "Supporters",
      type: card.type || "Practice",
      icon: card.icon || "User",
      creator_ref: card.creator_ref || "u_123",
      created_at: createdAt,
    };
  
    try {
      // 1) write the empty card node
      const ok = await write(nodes.cards, cardId, gunCard);
      if (!ok) throw new Error(`Failed to save card node ${cardId}`);
  
      // 2) small pause
      await delay(100);
  
      // 3) write the boolean maps *exactly* as passed in
      await write(`${nodes.cards}/${cardId}`, "values_ref", card.values_ref);
      await write(`${nodes.cards}/${cardId}`, "capabilities_ref", card.capabilities_ref);
  
      // 4) now create or update your value/capability nodes themselves,
      //    but *without* ever creating Gun.js edges
      const writes: Promise<boolean>[] = [];
      for (const vid of Object.keys(card.values_ref)) {
        if (card.values_ref[vid]) {
          writes.push(
            write(nodes.values, vid, {
              value_id: vid,
              name: vid.replace(/^value_/, "").replace(/_/g, " "),
              creator_ref: gunCard.creator_ref,
              cards_ref: { [cardId]: true },
              created_at: createdAt,
            })
          );
        }
      }
      for (const cid of Object.keys(card.capabilities_ref)) {
        if (card.capabilities_ref[cid]) {
          writes.push(
            write(nodes.capabilities, cid, {
              capability_id: cid,
              name: cid.replace(/^cap_/, "").replace(/_/g, " "),
              creator_ref: gunCard.creator_ref,
              cards_ref: { [cardId]: true },
              created_at: createdAt,
            })
          );
        }
      }
      const results = await Promise.all(writes);
      if (results.some((r) => !r)) {
        console.warn("[createCard] Some value/cap writes failed");
      }
  
      return gunCard;
    } catch (e) {
      console.error("[createCard] Error:", e);
      return null;
    }
  }
  

// **UPDATED** Add a card to a deck **without** nesting full node objects
export async function addCardToDeck(
    deckId: string,
    cardId: string
  ): Promise<boolean> {
    console.log(`[addCardToDeck] Adding ${cardId} → deck ${deckId}`);
    try {
      // 1) Merge into deck.cards_ref
      const deck = await getDeck(deckId);
      const existingCardsRef = deck?.cards_ref || {};
      const newCardsRef = { ...existingCardsRef, [cardId]: true };
      const okDeck = await write(`${nodes.decks}/${deckId}`, "cards_ref", newCardsRef);
  
      // 2) Merge into card.decks_ref
      const cardData = (await get(`${nodes.cards}/${cardId}`)) as Card | null;
      const existingDecksRef = cardData?.decks_ref || {};
      const newDecksRef = { ...existingDecksRef, [deckId]: true };
      const okCard = await write(`${nodes.cards}/${cardId}`, "decks_ref", newDecksRef);

      // 3) Wire up the Gun edges so getSet() will see them (need to refactor this to use new keys, like: set_ref for both)
    // const edge1 = await createEdge(
    //     `${nodes.decks}/${deckId}`,
    //     "cards_ref",
    //     nodes.cards,
    //     cardId
    //   );
    //   const edge2 = await createEdge(
    //     `${nodes.cards}/${cardId}`,
    //     "decks_ref",
    //     nodes.decks,
    //     deckId
    //   );
  
      return okDeck && okCard; //&& edge1 && edge2;
    } catch (error) {
      console.error("[addCardToDeck] Error:", error);
      return false;
    }
  }
  
  // Import multiple cards
  type ImportResult = { success: boolean; added: number; error?: string };
  export async function importCardsToDeck(
    deckId: string,
    cardsData: any[]
  ): Promise<ImportResult> {
    console.log(`[importCardsToDeck] Importing ${cardsData.length} cards to ${deckId}`);
    const deck = await getDeck(deckId);
    if (!deck) {
      const msg = `Deck with ID ${deckId} not found`;
      console.error(`[importCardsToDeck] ${msg}`);
      return { success: false, added: 0, error: msg };
    }
  
    let addedCount = 0;
    for (let i = 0; i < cardsData.length; i++) {
      const data = cardsData[i];
      if (!data.role_title) continue;
  
      const processed = {
        card_number: data.card_number,
        role_title: data.role_title,
        backstory: data.backstory || "",
        goals: data.goals || "",
        obligations: data.obligations || "",
        intellectual_property: data.intellectual_property || "",
        resources: data.resources || "",
        values_ref: Object.keys(data.values_ref || {}).reduce<Record<string, boolean>>(
          (acc, v) => {
            if (data.values_ref[v]) acc[standardizeValueId(v)] = true;
            return acc;
          },
          {}
        ),
        capabilities_ref: Object.keys(data.capabilities_ref || {}).reduce<Record<string, boolean>>(
          (acc, c) => {
            if (data.capabilities_ref[c]) acc[standardizeCapabilityId(c)] = true;
            return acc;
          },
          {}
        ),
        card_category: data.card_category || "Supporters",
        type: data.type || "Practice",
        icon: data.icon || "User",
        creator_ref: data.creator_ref || "u_123",
      };
  
      const card = await createCard(processed);
      if (card) {
        const added = await addCardToDeck(deckId, card.card_id);
        if (added) {
          addedCount++;
          console.log(`[importCardsToDeck] Added ${card.card_id}`);
        }
      }
  
      await delay(500);
    }
  
    console.log(`[importCardsToDeck] Completed: ${addedCount}/${cardsData.length}`);
    return { success: addedCount > 0, added: addedCount };
  }
