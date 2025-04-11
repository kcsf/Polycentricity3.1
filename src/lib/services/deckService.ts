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

    // Convert goals string to array
    const goalsArray = goalsStr
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);

    const valuesRecord = await createOrGetValues(
        valuesStr
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
    );
    const capabilitiesRecord = await createOrGetCapabilities(capabilitiesStr);

    // Convert goals array to Gun-compatible object (Gun can't handle arrays)
    const goalsObject: Record<string, string> = {};
    goalsArray.forEach((goal, index) => {
        goalsObject[`${index}`] = goal;
    });
    
    // Properly structured to match Card type, but Gun-compatible (no arrays)
    const gunCard = {
        card_id: cardId,
        card_number: cardNumber,
        role_title: card.role_title,
        backstory: card.backstory || "",
        values: valuesRecord, // Record<string, boolean> for Gun.js
        goals: goalsObject, // Gun-compatible object instead of array
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
        console.log(`[createCard] Creating card with ID: ${cardId} and title: ${gunCard.role_title}`);
        
        // STEP 1: Save base card with retry logic
        let cardSaved = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!cardSaved && attempts < maxAttempts) {
            try {
                console.log(`[createCard] Attempt ${attempts+1}/${maxAttempts} to save base card`);
                const result = await put(`${nodes.cards}/${cardId}`, gunCard);
                
                if (result.err) {
                    console.warn(
                        `[createCard] Attempt ${attempts+1}/${maxAttempts} had error:`,
                        result.err
                    );
                    attempts++;
                    
                    if (attempts === maxAttempts) {
                        console.error(`[createCard] Failed to save card after ${maxAttempts} attempts`);
                        throw new Error(`Failed to save card: ${result.err}`);
                    }
                    
                    // Exponential backoff
                    const waitTime = 1000 * attempts;
                    console.log(`[createCard] Waiting ${waitTime}ms before retry...`);
                    await new Promise((resolve) => setTimeout(resolve, waitTime));
                } else {
                    console.log(`[createCard] Successfully saved base card: ${cardId}`);
                    cardSaved = true;
                }
            } catch (error) {
                console.error(`[createCard] Exception during save:`, error);
                attempts++;
                
                if (attempts === maxAttempts) {
                    console.error(`[createCard] Failed after ${maxAttempts} attempts`);
                    throw error;
                }
                
                const waitTime = 1000 * attempts;
                console.log(`[createCard] Waiting ${waitTime}ms before retry...`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
        }

        // Wait after saving the card before adding relations
        console.log(`[createCard] Card saved. Waiting 1s before creating relationships...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // STEP 2: Process values with individual error handling
        console.log(`[createCard] Setting up value relationships for ${Object.keys(valuesRecord).length} values`);
        for (const valueId of Object.keys(valuesRecord)) {
            try {
                console.log(`[createCard] Setting value relationship: ${valueId} -> ${cardId}`);
                const result = await setField(`${nodes.values}/${valueId}/cards`, cardId, true);
                
                if (result.err) {
                    console.error(`[createCard] Error setting value relationship for ${valueId}:`, result.err);
                } else {
                    console.log(`[createCard] Successfully set reverse value edge: ${valueId} -> ${cardId}`);
                }
                
                // Small delay between each value relationship
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (valueError) {
                console.error(`[createCard] Exception setting value relationship for ${valueId}:`, valueError);
                // Continue with other values even if one fails
            }
        }

        // Wait between value and capability relationships
        console.log(`[createCard] Values processed. Waiting 1s before processing capabilities...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // STEP 3: Process capabilities with individual error handling
        console.log(`[createCard] Setting up capability relationships for ${Object.keys(capabilitiesRecord).length} capabilities`);
        for (const capId of Object.keys(capabilitiesRecord)) {
            try {
                console.log(`[createCard] Setting capability relationship: ${capId} -> ${cardId}`);
                const result = await setField(
                    `${nodes.capabilities}/${capId}/cards`,
                    cardId,
                    true
                );
                
                if (result.err) {
                    console.error(`[createCard] Error setting capability relationship for ${capId}:`, result.err);
                } else {
                    console.log(`[createCard] Successfully set reverse capability edge: ${capId} -> ${cardId}`);
                }
                
                // Small delay between each capability relationship
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (capError) {
                console.error(`[createCard] Exception setting capability relationship for ${capId}:`, capError);
                // Continue with other capabilities even if one fails
            }
        }

        console.log(`[createCard] Card creation completed successfully: ${cardId}`);
        
        // Convert the goals back to an array for the return value
        // This ensures the rest of the application can work with the array format
        // while Gun.js uses the object format for storage
        
        // Type-safe return value
        const cardData: Card = { 
            ...gunCard, 
            values: valuesRecord as Record<string, boolean>,
            capabilities: capabilitiesRecord as Record<string, boolean>,
            // When returning to the application, provide goals as a regular array
            goals: goalsArray 
        };
        
        console.log(`[createCard] Returning card with ID ${cardId} and ${goalsArray.length} goals`);
        return cardData;
    } catch (error) {
        console.error(
            "[createCard] Error creating card:",
            error instanceof Error ? error.stack : error,
        );
        return null;
    }
}

// Add a card to a deck (bidirectional) with sequential processing and retry logic
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
        // STEP 1: Add card to deck with retry logic
        let deckSuccess = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!deckSuccess && attempts < maxAttempts) {
            try {
                console.log(`[addCardToDeck] Attempt ${attempts+1}/${maxAttempts} to add card to deck`);
                const result = await setField(`${nodes.decks}/${deckId}/cards`, cardId, true);
                
                if (result.err) {
                    console.warn(
                        `[addCardToDeck] Attempt ${attempts+1}/${maxAttempts} had error:`,
                        result.err
                    );
                    attempts++;
                    
                    if (attempts === maxAttempts) {
                        console.error(`[addCardToDeck] Failed to add card to deck after ${maxAttempts} attempts`);
                        return false;
                    }
                } else {
                    console.log(`[addCardToDeck] Successfully added card reference to deck`);
                    deckSuccess = true;
                }
                
                if (!deckSuccess) {
                    // Wait before retrying
                    const waitTime = 1000 * attempts;
                    console.log(`[addCardToDeck] Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            } catch (error) {
                attempts++;
                console.warn(`[addCardToDeck] Exception in attempt ${attempts}/${maxAttempts}:`, error);
                
                if (attempts === maxAttempts) {
                    console.error(`[addCardToDeck] Failed to add card to deck after ${maxAttempts} attempts`);
                    return false;
                }
                
                // Wait before retrying
                const waitTime = 1000 * attempts;
                console.log(`[addCardToDeck] Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        // Wait before adding the reverse relationship
        console.log(`[addCardToDeck] Waiting 1s before adding reverse relationship...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // STEP 2: Add deck to card (reverse relationship) with retry logic
        let cardSuccess = false;
        attempts = 0;
        
        while (!cardSuccess && attempts < maxAttempts) {
            try {
                console.log(`[addCardToDeck] Attempt ${attempts+1}/${maxAttempts} to add deck to card`);
                const result = await setField(`${nodes.cards}/${cardId}/decks`, deckId, true);
                
                if (result.err) {
                    console.warn(
                        `[addCardToDeck] Attempt ${attempts+1}/${maxAttempts} had error:`,
                        result.err
                    );
                    attempts++;
                    
                    if (attempts === maxAttempts) {
                        console.error(`[addCardToDeck] Failed to add deck to card after ${maxAttempts} attempts`);
                        // Continue even if this fails, as the primary relationship (card->deck) is established
                    }
                } else {
                    console.log(`[addCardToDeck] Successfully added deck reference to card`);
                    cardSuccess = true;
                }
                
                if (!cardSuccess && attempts < maxAttempts) {
                    // Wait before retrying
                    const waitTime = 1000 * attempts;
                    console.log(`[addCardToDeck] Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            } catch (error) {
                attempts++;
                console.warn(`[addCardToDeck] Exception in attempt ${attempts}/${maxAttempts}:`, error);
                
                if (attempts === maxAttempts) {
                    console.error(`[addCardToDeck] Failed to add deck to card after ${maxAttempts} attempts`);
                    // Continue even if this fails, as the primary relationship (card->deck) is established
                }
                
                if (attempts < maxAttempts) {
                    // Wait before retrying
                    const waitTime = 1000 * attempts;
                    console.log(`[addCardToDeck] Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        // Consider the operation a success if the primary relationship was established
        console.log(`[addCardToDeck] Successfully added ${cardId} to ${deckId}`);
        return deckSuccess;
    } catch (error) {
        console.error("[addCardToDeck] Unexpected error:", error);
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
                typeof deck.cards === "object" && deck.cards !== null
                    ? Object.keys(deck.cards).filter(
                          (id) => typeof deck.cards === "object" && deck.cards !== null && 
                          id in deck.cards && deck.cards[id as keyof typeof deck.cards] === true,
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

                // TypeScript safety: ensure decks exists as an object
                const cardDataWithDecks = cardData as { decks?: Record<string, boolean> };
                const decksOnCard = cardDataWithDecks.decks || {};
                
                if (!decksOnCard[deckId]) {
                    const result = await setField(
                        `${nodes.cards}/${cardId}/decks`,
                        deckId,
                        true,
                    );
                    
                    if (result.err) {
                        console.error(
                            `[initializeBidirectionalRelationships] Error adding ${deckId} to ${cardId}:`,
                            result.err
                        );
                    } else {
                        console.log(
                            `[initializeBidirectionalRelationships] Added ${deckId} to ${cardId}`
                        );
                        processedCount++;
                    }
                    
                    // Add a small delay between operations
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            // Add delay between processing decks
            console.log(`[initializeBidirectionalRelationships] Finished processing deck ${deckId}, waiting 1s before next deck`);
            await new Promise(resolve => setTimeout(resolve, 1000));
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
): Promise<{ success: boolean; added: number; error?: string }> {
    console.log(
        `[importCardsToDeck] Importing ${cardsData.length} cards to ${deckId}`,
    );
    const gun = getGun();
    if (!gun) {
        console.error("[importCardsToDeck] Gun not initialized");
        return { success: false, added: 0, error: "Database not initialized" };
    }

    let addedCount = 0;
    
    // Check if the deck exists first
    const deck = await getDeck(deckId);
    if (!deck) {
        const errorMsg = `Deck with ID ${deckId} not found`;
        console.error(`[importCardsToDeck] ${errorMsg}`);
        return { success: false, added: 0, error: errorMsg };
    }
    
    // Process cards one at a time with enough delay between each
    try {
        for (let i = 0; i < cardsData.length; i++) {
            const cardData = cardsData[i];
            
            if (!cardData.role_title || !cardData.card_category) {
                console.warn(
                    "[importCardsToDeck] Skipping invalid card:",
                    cardData,
                );
                continue;
            }

            console.log(`[importCardsToDeck] Processing card ${i+1}/${cardsData.length}: "${cardData.role_title}"`);
            
            // Step 1: Create the card
            try {
                console.log(`[importCardsToDeck] Creating card: "${cardData.role_title}"`);
                const card = await createCard(cardData as Omit<Card, "card_id">);
                
                if (card) {
                    // Step 2: Add card to deck after successful creation
                    console.log(`[importCardsToDeck] Adding card ${card.card_id} to deck ${deckId}`);
                    const added = await addCardToDeck(deckId, card.card_id);
                    
                    if (added) {
                        addedCount++;
                        console.log(
                            `[importCardsToDeck] Successfully added ${card.card_id} (${addedCount}/${cardsData.length})`,
                        );
                    } else {
                        console.warn(
                            `[importCardsToDeck] Failed to add card ${card.card_id} to deck`,
                        );
                    }
                } else {
                    console.error(
                        `[importCardsToDeck] Failed to create card: "${cardData.role_title}"`,
                    );
                }
            } catch (error) {
                console.error(`[importCardsToDeck] Error processing card: "${cardData.role_title}"`, error);
            }
            
            // Add significant delay between cards to prevent overloading Gun.js
            console.log(`[importCardsToDeck] Waiting 2 seconds before processing next card...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    } catch (error) {
        console.error("[importCardsToDeck] Critical error during import:", error);
        return { 
            success: addedCount > 0, 
            added: addedCount, 
            error: error instanceof Error ? error.message : String(error) 
        };
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
    if (!cardData) {
        console.log(`[getDecksForCard] Card not found: ${cardId}`);
        return [];
    }
    
    // TypeScript safety: ensure decks exists and is the right type
    const cardDataWithDecks = cardData as { decks?: Record<string, boolean> };
    const cardDecks = cardDataWithDecks.decks;
    
    if (!cardDecks || Object.keys(cardDecks).length === 0) {
        console.log(`[getDecksForCard] No decks found for ${cardId}`);
        return [];
    }

    const deckIds = Object.keys(cardDecks).filter(
        (id) => cardDecks[id] === true,
    );
    
    console.log(`[getDecksForCard] Found ${deckIds.length} deck references for ${cardId}`);
    
    // Fetch each deck and filter out any nulls
    const decks = await Promise.all(deckIds.map(getDeck));
    const validDecks = decks.filter((d) => d !== null) as Deck[];
    
    console.log(
        `[getDecksForCard] Retrieved ${validDecks.length} valid decks for ${cardId}`,
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

    try {
        let valueIds: string[] = [];
        
        if (typeof card.values === "string") {
            // Handle string format
            valueIds = (card.values as string)
                .split(",")
                .map((v: string) => 
                    `value_${v.trim().toLowerCase().replace(/\s+/g, "-")}`)
                .filter(Boolean);
        } else if (Array.isArray(card.values)) {
            // Handle array format
            valueIds = (card.values as string[])
                .map((v: string) => 
                    `value_${v.trim().toLowerCase().replace(/\s+/g, "-")}`)
                .filter(Boolean);
        } else {
            // Handle Record/object format (Gun.js format)
            valueIds = Object.keys(card.values as Record<string, boolean>)
                .filter(key => (card.values as Record<string, boolean>)[key] === true);
        }

        console.log(`[getCardValueNames] Processing ${valueIds.length} value IDs:`, valueIds);
        
        const valueNames = await Promise.all(
            valueIds.map(async (id: string) => {
                const data = await get(`${nodes.values}/${id}`);
                // Safely access name property
                return data && typeof data === 'object' && 'name' in data ? data.name as string : "";
            }),
        );
        
        const filteredNames = valueNames.filter(Boolean);
        console.log(`[getCardValueNames] Retrieved:`, filteredNames);
        return filteredNames;
    } catch (error) {
        console.error("[getCardValueNames] Error:", error);
        return [];
    }
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

    try {
        let capIds: string[] = [];
        
        if (typeof card.capabilities === "string") {
            // Handle string format
            capIds = (card.capabilities as string)
                .split(",")
                .map((c: string) => 
                    `capability_${c.trim().toLowerCase().replace(/\s+/g, "-")}`)
                .filter(Boolean);
        } else if (Array.isArray(card.capabilities)) {
            // Handle array format
            capIds = (card.capabilities as string[])
                .map((c: string) => 
                    `capability_${c.trim().toLowerCase().replace(/\s+/g, "-")}`)
                .filter(Boolean);
        } else {
            // Handle Record/object format (Gun.js format)
            capIds = Object.keys(card.capabilities as Record<string, boolean>)
                .filter(key => (card.capabilities as Record<string, boolean>)[key] === true);
        }

        console.log(`[getCardCapabilityNames] Processing ${capIds.length} capability IDs:`, capIds);
        
        const capNames = await Promise.all(
            capIds.map(async (id: string) => {
                const data = await get(`${nodes.capabilities}/${id}`);
                // Safely access name property
                return data && typeof data === 'object' && 'name' in data ? data.name as string : "";
            }),
        );
        
        const filteredNames = capNames.filter(Boolean);
        console.log(`[getCardCapabilityNames] Retrieved:`, filteredNames);
        return filteredNames;
    } catch (error) {
        console.error("[getCardCapabilityNames] Error:", error);
        return [];
    }
}
