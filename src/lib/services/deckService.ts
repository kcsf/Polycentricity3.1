// Deck management service
import {
    getGun,
    nodes,
    generateId,
    put,
    get,
    setField,
    getCollection,
} from "./gunService";
import type { Deck, Card } from "$lib/types";
import { createValue, createOrGetValues } from "./valueService";
import {
    createCapability,
    createOrGetCapabilities,
    parseCapabilitiesText,
} from "./capabilityService";

// Get a deck by ID
export async function getDeck(deckId: string): Promise<Deck | null> {
    console.log(`[getDeck] Fetching deck: ${deckId}`);
    const gun = getGun();
    if (!gun) {
        console.error("[getDeck] Gun not initialized");
        return null;
    }
    const deckData = await get(`${nodes.decks}/${deckId}`);
    if (!deckData) {
        console.log(`[getDeck] Deck not found: ${deckId}`);
        return null;
    }
    console.log(`[getDeck] Found deck: ${deckId}`, deckData);
    return deckData as Deck;
}

// Update a deck
export async function updateDeck(
    deckId: string,
    updates: Partial<Deck>,
): Promise<boolean> {
    console.log(`[updateDeck] Updating deck ${deckId} with`, updates);
    try {
        await put(`${nodes.decks}/${deckId}`, updates);
        console.log(`[updateDeck] Updated deck: ${deckId}`);
        return true;
    } catch (error) {
        console.error("[updateDeck] Error:", error);
        return false;
    }
}

// Create a new card
export async function createCard(
    card: Omit<Card, "card_id">,
): Promise<Card | null> {
    console.log("[createCard] Creating card:", card);
    const gun = getGun();
    if (!gun) {
        console.error("[createCard] Gun not initialized");
        return null;
    }

    const cardId = `card_${generateId()}`;
    const cardNumber =
        typeof card.card_number === "string"
            ? parseInt(card.card_number, 10)
            : card.card_number || Math.floor(Math.random() * 52) + 1;
    const icon =
        card.icon ||
        {
            Funders: "CircleDollarSign",
            Providers: "Hammer",
            Supporters: "Heart",
        }[card.card_category] ||
        "User";

    // Process values and capabilities from JSON strings
    const valuesStr =
        typeof card.values === "string"
            ? card.values
            : Array.isArray(card.values)
              ? card.values.join(",")
              : "";
    const capabilitiesStr =
        typeof card.capabilities === "string"
            ? card.capabilities
            : Array.isArray(card.capabilities)
              ? card.capabilities.join(",")
              : "";
    const goalsStr =
        typeof card.goals === "string"
            ? card.goals
            : Array.isArray(card.goals)
              ? card.goals.join(",")
              : "";

    const valuesRecord = await createOrGetValues(
        valuesStr
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
    );
    const capabilitiesRecord = await createOrGetCapabilities(capabilitiesStr);

    const gunCard = {
        card_id: cardId,
        card_number: cardNumber,
        role_title: card.role_title,
        backstory: card.backstory || "",
        values: valuesRecord, // Record<string, boolean> for Gun.js
        goals: goalsStr,
        obligations: card.obligations || "",
        capabilities: capabilitiesRecord, // Record<string, boolean> for Gun.js
        intellectual_property: card.intellectual_property || "",
        rivalrous_resources: card.rivalrous_resources || "",
        card_category: card.card_category || "Supporters",
        type: card.type || "Practice",
        icon: icon,
        decks: card.decks || {},
    };

    try {
        // Save base card with retry logic
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            try {
                await put(`${nodes.cards}/${cardId}`, gunCard);
                console.log(`[createCard] Saved card: ${cardId}`);
                break; // Exit loop on success
            } catch (putError) {
                attempts++;
                console.warn(
                    `[createCard] Attempt ${attempts}/${maxAttempts} failed:`,
                    putError,
                );
                if (attempts === maxAttempts) throw putError;
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retry
            }
        }

        // Set reverse edges sequentially
        for (const valueId of Object.keys(valuesRecord)) {
            await setField(`${nodes.values}/${valueId}/cards`, cardId, true);
            console.log(
                `[createCard] Set reverse value edge: ${valueId} for ${cardId}`,
            );
        }

        for (const capId of Object.keys(capabilitiesRecord)) {
            await setField(
                `${nodes.capabilities}/${capId}/cards`,
                cardId,
                true,
            );
            console.log(
                `[createCard] Set reverse capability edge: ${capId} for ${cardId}`,
            );
        }

        const cardData: Card = { ...gunCard };
        console.log(`[createCard] Created card: ${cardId}`);
        return cardData;
    } catch (error) {
        console.error(
            "[createCard] Error creating card:",
            error instanceof Error ? error.stack : error,
        );
        return null;
    }
}

// Add a card to a deck (bidirectional)
export async function addCardToDeck(
    deckId: string,
    cardId: string,
): Promise<boolean> {
    console.log(`[addCardToDeck] Adding ${cardId} to ${deckId}`);
    const gun = getGun();
    if (!gun) {
        console.error("[addCardToDeck] Gun not initialized");
        return false;
    }

    try {
        await Promise.all([
            setField(`${nodes.decks}/${deckId}/cards`, cardId, true),
            setField(`${nodes.cards}/${cardId}/decks`, deckId, true),
        ]);
        console.log(`[addCardToDeck] Added ${cardId} to ${deckId}`);
        return true;
    } catch (error) {
        console.error("[addCardToDeck] Error:", error);
        return false;
    }
}

// Function to initialize bidirectional relationships for existing cards and decks
export async function initializeBidirectionalRelationships(): Promise<{
    success: boolean;
    processed: number;
}> {
    console.log("[initializeBidirectionalRelationships] Starting");
    const gun = getGun();
    if (!gun) {
        console.error(
            "[initializeBidirectionalRelationships] Gun not initialized",
        );
        return { success: false, processed: 0 };
    }

    let processedCount = 0;
    try {
        const decks = await getCollection<Deck>(nodes.decks);
        console.log(
            `[initializeBidirectionalRelationships] Found ${decks.length} decks`,
        );

        for (const deck of decks) {
            const deckId = deck.deck_id;
            if (!deck.cards) {
                console.log(
                    `[initializeBidirectionalRelationships] Deck ${deckId} has no cards, skipping`,
                );
                continue;
            }

            const cardIds =
                typeof deck.cards === "object"
                    ? Object.keys(deck.cards).filter(
                          (id) => deck.cards[id] === true,
                      )
                    : [];
            console.log(
                `[initializeBidirectionalRelationships] Processing ${cardIds.length} cards for deck ${deckId}`,
            );

            for (const cardId of cardIds) {
                const cardData = await get(`${nodes.cards}/${cardId}`);
                if (!cardData) {
                    console.log(
                        `[initializeBidirectionalRelationships] Card ${cardId} not found, skipping`,
                    );
                    continue;
                }

                const decksOnCard = cardData.decks || {};
                if (!decksOnCard[deckId]) {
                    await setField(
                        `${nodes.cards}/${cardId}/decks`,
                        deckId,
                        true,
                    );
                    console.log(
                        `[initializeBidirectionalRelationships] Added ${deckId} to ${cardId}`,
                    );
                    processedCount++;
                }
            }
        }

        console.log(
            `[initializeBidirectionalRelationships] Processed ${processedCount} card-deck pairs`,
        );
        return {
            success: processedCount > 0,
            processed: processedCount,
        };
    } catch (error) {
        console.error("[initializeBidirectionalRelationships] Error:", error);
        return { success: false, processed: 0 };
    }
}

// Import multiple cards and add them to a deck
export async function importCardsToDeck(
    deckId: string,
    cardsData: any[],
): Promise<{ success: boolean; added: number }> {
    console.log(
        `[importCardsToDeck] Importing ${cardsData.length} cards to ${deckId}`,
    );
    const gun = getGun();
    if (!gun) {
        console.error("[importCardsToDeck] Gun not initialized");
        return { success: false, added: 0 };
    }

    let addedCount = 0;
    for (const cardData of cardsData) {
        if (!cardData.role_title || !cardData.card_category) {
            console.warn(
                "[importCardsToDeck] Skipping invalid card:",
                cardData,
            );
            continue;
        }

        console.log(`[importCardsToDeck] Processing: "${cardData.role_title}"`);
        const card = await createCard(cardData as Omit<Card, "card_id">);
        if (card && (await addCardToDeck(deckId, card.card_id))) {
            addedCount++;
            console.log(
                `[importCardsToDeck] Added ${card.card_id} (${addedCount}/${cardsData.length})`,
            );
        } else {
            console.warn(
                "[importCardsToDeck] Failed to add:",
                cardData.role_title,
            );
        }
        await new Promise((resolve) => setTimeout(resolve, 500)); // Minimal throttle
    }

    console.log(
        `[importCardsToDeck] Completed: ${addedCount}/${cardsData.length} added`,
    );
    return { success: addedCount > 0, added: addedCount };
}

// Get all decks that contain a specific card
export async function getDecksForCard(cardId: string): Promise<Deck[]> {
    console.log(`[getDecksForCard] Fetching decks for ${cardId}`);
    const gun = getGun();
    if (!gun) {
        console.error("[getDecksForCard] Gun not initialized");
        return [];
    }

    const cardData = await get(`${nodes.cards}/${cardId}`);
    if (!cardData || !cardData.decks) {
        console.log(`[getDecksForCard] No decks found for ${cardId}`);
        return [];
    }

    const deckIds = Object.keys(cardData.decks).filter(
        (id) => cardData.decks[id] === true,
    );
    const decks = await Promise.all(deckIds.map(getDeck));
    const validDecks = decks.filter((d) => d !== null) as Deck[];
    console.log(
        `[getDecksForCard] Found ${validDecks.length} decks for ${cardId}`,
    );
    return validDecks;
}

// Get value names for a card
export async function getCardValueNames(card: Card): Promise<string[]> {
    console.log(`[getCardValueNames] Fetching values for ${card.card_id}`);
    if (!card.values) return [];

    const gun = getGun();
    if (!gun) {
        console.error("[getCardValueNames] Gun not initialized");
        return [];
    }

    const valueIds =
        typeof card.values === "string"
            ? card.values
                  .split(",")
                  .map(
                      (v) =>
                          `value_${v.trim().toLowerCase().replace(/\s+/g, "-")}`,
                  )
            : Object.keys(card.values);
    const valueNames = await Promise.all(
        valueIds.map(async (id) => {
            const data = await get(`${nodes.values}/${id}`);
            return data?.name || "";
        }),
    );
    console.log(`[getCardValueNames] Retrieved:`, valueNames.filter(Boolean));
    return valueNames.filter(Boolean);
}

// Get capability names for a card
export async function getCardCapabilityNames(card: Card): Promise<string[]> {
    console.log(
        `[getCardCapabilityNames] Fetching capabilities for ${card.card_id}`,
    );
    if (!card.capabilities) return [];

    const gun = getGun();
    if (!gun) {
        console.error("[getCardCapabilityNames] Gun not initialized");
        return [];
    }

    const capIds =
        typeof card.capabilities === "string"
            ? card.capabilities
                  .split(",")
                  .map(
                      (c) =>
                          `capability_${c.trim().toLowerCase().replace(/\s+/g, "-")}`,
                  )
            : Object.keys(card.capabilities);
    const capNames = await Promise.all(
        capIds.map(async (id) => {
            const data = await get(`${nodes.capabilities}/${id}`);
            return data?.name || "";
        }),
    );
    console.log(
        `[getCardCapabilityNames] Retrieved:`,
        capNames.filter(Boolean),
    );
    return capNames.filter(Boolean);
}
