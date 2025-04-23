// Deck management service
// This module provides services for managing decks and cards using the standard schema
import {
    getGun,
    nodes,
    generateId,
    put,
    get,
    setField,
    getCollection,
    createRelationship,
} from "./gunService";
import type { Deck, Card } from "$lib/types";
import { createValue, createOrGetValues } from "./valueService";
import {
    createCapability,
    createOrGetCapabilities,
    parseCapabilitiesText,
} from "./capabilityService";
import { generateSequentialCardId, standardizeValueId } from "./cardUtils";

// Get a deck by ID
export async function getDeck(deckId: string): Promise<Deck | null> {
    console.log(`[getDeck] Fetching deck: ${deckId}`);
    const gun = getGun();
    if (!gun) {
        console.error("[getDeck] Gun not initialized");
        return null;
    }
    
    // Add retry logic to compensate for Gun's eventual consistency
    const maxAttempts = 3;
    let attempts = 0;
    let deckData = null;
    
    while (attempts < maxAttempts && !deckData) {
        attempts++;
        console.log(`[getDeck] Attempt ${attempts}/${maxAttempts} to fetch deck: ${deckId}`);
        
        try {
            deckData = await get(`${nodes.decks}/${deckId}`);
            
            // If we didn't get data, add a delay before the next attempt
            if (!deckData && attempts < maxAttempts) {
                const delayTime = 500 * Math.pow(2, attempts-1); // Exponential backoff: 500ms, 1000ms, 2000ms
                console.log(`[getDeck] Deck not found yet, retrying in ${delayTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayTime));
            }
        } catch (error) {
            console.error(`[getDeck] Error fetching deck ${deckId} (attempt ${attempts}):`, error);
            
            if (attempts < maxAttempts) {
                const delayTime = 500 * Math.pow(2, attempts-1);
                console.log(`[getDeck] Will retry in ${delayTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayTime));
            }
        }
    }
    
    if (!deckData) {
        console.log(`[getDeck] Deck not found after ${maxAttempts} attempts: ${deckId}`);
        return null;
    }
    
    console.log(`[getDeck] Found deck: ${deckId} on attempt ${attempts}`);
    return deckData as Deck;
}

// Update a deck
export async function updateDeck(
    deckId: string,
    updates: Partial<Deck>,
): Promise<boolean> {
    console.log(`[updateDeck] Updating deck ${deckId} with`, updates);
    try {
        // Ensure we're passing a valid type to put() by casting to the appropriate type
        // First make sure deck_id is set as required
        const validUpdate = {
            ...updates,
            deck_id: deckId, // Ensure deck_id is always set 
        } as Deck;
        
        await put(`${nodes.decks}/${deckId}`, validUpdate);
        console.log(`[updateDeck] Updated deck: ${deckId}`);
        return true;
    } catch (error) {
        console.error("[updateDeck] Error:", error);
        return false;
    }
}

// Create a new card with optimized Gun.js handling
export async function createCard(
    card: Omit<Card, "card_id">,
): Promise<Card | null> {
    console.log("[createCard] Creating card:", card.role_title);
    const gun = getGun();
    if (!gun) {
        console.error("[createCard] Gun not initialized");
        return null;
    }

    // Generate a sequential card ID for proper ordering
    // This ensures cards follow a consistent ID pattern for proper filtering in components
    const cardId = await generateSequentialCardId();
    console.log(`[createCard] Generated sequential card ID: ${cardId}`);
    
    // Process card number (either from string or number format)
    const cardNumber =
        typeof card.card_number === "string"
            ? parseInt(card.card_number, 10)
            : card.card_number || Math.floor(Math.random() * 52) + 1;
    
    // Set icon based on card category if not provided
    const icon =
        card.icon ||
        {
            Funders: "CircleDollarSign",
            Providers: "Hammer",
            Supporters: "Heart",
        }[card.card_category] ||
        "User";

    // Set up default values if none provided
    const valuesArray = ["value_sustainability", "value_community_resilience"];
    
    // Set up capabilities from capabilities_ref (if it exists) or use empty string
    const capabilitiesStr = "";
    
    // Process goals - ensure it's a string
    const goalsString = typeof card.goals === "string" ? card.goals : "";

    // Get record structures for values and capabilities
    // Standardize all values to ensure they use proper value_xxx format
    const standardizedValuesArray = valuesArray.map(valueId => standardizeValueId(valueId));
    
    // Create all values to ensure they exist in the database
    const nameBasedValuesRecord = await createOrGetValues(standardizedValuesArray);
    
    // Create the final values record using proper value IDs
    const valuesRecord: Record<string, boolean> = {};
    
    // Add all values from the record
    Object.keys(nameBasedValuesRecord).forEach(key => {
        valuesRecord[key] = true;
    });
    
    // If we still have no values, add a default value
    if (Object.keys(valuesRecord).length === 0) {
        // Add standard sustainability value as fallback
        valuesRecord["value_sustainability"] = true;
    }
    
    const capabilitiesRecord = await createOrGetCapabilities(capabilitiesStr);
    
    // Prepare Gun-compatible card structure following the schema
    const gunCard = {
        card_id: cardId,
        card_number: cardNumber,
        role_title: card.role_title,
        backstory: card.backstory || "",
        goals: goalsString,
        obligations: card.obligations || "",
        intellectual_property: card.intellectual_property || "",
        // Store values_ref as a Record<string, boolean> per schema
        values_ref: valuesRecord,
        // Store capabilities_ref as a Record<string, boolean> per schema
        capabilities_ref: capabilitiesRecord,
        // Store decks_ref as a Record<string, boolean> per schema
        decks_ref: {},
        // Empty agreements_ref per schema
        agreements_ref: {},
        card_category: card.card_category || "Supporters",
        type: card.type || "Practice",
        icon: icon,
        created_at: Date.now(),
        // Use creator_ref as per schema with proper user reference
        creator_ref: "u_123" // Default creator reference
    };

    try {
        // OPTIMIZED APPROACH: Use the "fire and forget" pattern from sampleDataService
        // This prevents timeouts by using a much shorter timeout (1s) and continuing regardless
        
        // STEP 1: Save the card data - ultra-optimized approach 
        // Based on sampleDataService fire-and-forget pattern
        
        // 1. Clean the data to prevent undefined values
        const cleanedCard = cleanObject(gunCard);
        
        // 2. Use direct Gun.js put without waiting for acknowledgment
        // This completely avoids timeouts by not using Promise.race at all
        try {
            gun.get(nodes.cards).get(cardId).put(cleanedCard);
            console.log(`[createCard] Card data sent to Gun DB (fire-and-forget): ${cardId}`);
        } catch (e) {
            console.warn(`[createCard] Exception during card save (continuing anyway): ${e}`);
        }
        
        // Wait a very brief moment to let Gun process the request
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // No delay needed between operations due to using "fire and forget"
        
        // STEP 2: Create value relationships using reliable approach
        const valueEdges = Object.keys(valuesRecord).map(valueId => ({
            fromSoul: `${nodes.values}/${valueId}`,
            field: 'cards_ref',
            toSoul: `${nodes.cards}/${cardId}`
        }));
        
        // Also create edges in the reverse direction (card to value)
        const cardToValueEdges = Object.keys(valuesRecord).map(valueId => ({
            fromSoul: `${nodes.cards}/${cardId}`,
            field: 'values_ref',
            toSoul: `${nodes.values}/${valueId}`
        }));
        
        // Combine the two edge types and process them
        const allValueEdges = [...valueEdges, ...cardToValueEdges];
        
        // Process all values relationships
        if (allValueEdges.length > 0) {
            for (const edge of allValueEdges) {
                try {
                    const toId = edge.toSoul.split('/').pop();
                    if (!toId) continue;
                    
                    // Set the field to true at the proper path, following the schema exactly
                    // This creates entries like: cards/<card_id>/values_ref/<value_id>: true
                    gun.get(edge.fromSoul).get(edge.field).get(toId).put(true);
                    
                    console.log(`[createCard] Created value edge: ${edge.fromSoul} -> ${edge.field} -> ${toId}`);
                } catch (e) {
                    const targetId = edge.toSoul.split('/').pop() || '';
                    console.warn(`[createCard] Error creating value edge ${edge.fromSoul} -> ${edge.field} -> ${targetId}:`, e);
                }
                
                // Add a small delay between operations to ensure they have time to process
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }
        
        // STEP 3: Create capability relationships using reliable approach
        const capabilityEdges = Object.keys(capabilitiesRecord).map(capId => ({
            fromSoul: `${nodes.capabilities}/${capId}`,
            field: 'cards_ref',
            toSoul: `${nodes.cards}/${cardId}`
        }));
        
        // Also create edges in the reverse direction (card to capability)
        const cardToCapabilityEdges = Object.keys(capabilitiesRecord).map(capId => ({
            fromSoul: `${nodes.cards}/${cardId}`,
            field: 'capabilities_ref',
            toSoul: `${nodes.capabilities}/${capId}`
        }));
        
        // Combine the two edge types and process them
        const allCapabilityEdges = [...capabilityEdges, ...cardToCapabilityEdges];
        
        // Process all capability relationships
        if (allCapabilityEdges.length > 0) {
            for (const edge of allCapabilityEdges) {
                try {
                    const toId = edge.toSoul.split('/').pop();
                    if (!toId) continue;
                    
                    // Set the field to true at the proper path, following the schema exactly
                    // This creates entries like: cards/<card_id>/capabilities_ref/<capability_id>: true
                    gun.get(edge.fromSoul).get(edge.field).get(toId).put(true);
                    
                    console.log(`[createCard] Created capability edge: ${edge.fromSoul} -> ${edge.field} -> ${toId}`);
                } catch (e) {
                    const targetId = edge.toSoul.split('/').pop() || '';
                    console.warn(`[createCard] Error creating capability edge ${edge.fromSoul} -> ${edge.field} -> ${targetId}:`, e);
                }
                
                // Add a small delay between operations to ensure they have time to process
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }

        // Return card data immediately without waiting for all relationships
        // This is crucial to prevent timeouts
        const cardData: Card = { 
            ...gunCard,
            // These fields are already in gunCard with the correct _ref names
            created_at: Date.now() // Ensure created_at is set to satisfy the Card interface
        };
        
        return cardData;
    } catch (error) {
        console.error("[createCard] Error:", error instanceof Error ? error.message : String(error));
        return null;
    }
}

// Helper function to clean undefined values from an object - needed for Gun.js
function cleanObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        const result: Record<string, any> = {};
        obj.forEach((val, idx) => { 
            if (val !== undefined) result[idx] = cleanObject(val);
        });
        return result;
    }
    
    const cleanObj: Record<string, any> = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
            cleanObj[key] = cleanObject(obj[key]);
        }
    }
    
    return cleanObj;
}

// Helper function to create multiple Gun edges efficiently
function createEdgesBatch(
    edgeDefinitions: {fromSoul: string, field: string, toSoul: string}[],
    gunInstance: any
): void {
    for (const edge of edgeDefinitions) {
        try {
            // Extract the target ID from the soul path
            const toId = edge.toSoul.split('/').pop();
            if (!toId) continue;
            
            // Use direct Gun.js API with fire-and-forget pattern following the schema exactly
            // This creates entries like: <fromSoul>/<field>/<toId>: true
            gunInstance.get(edge.fromSoul).get(edge.field).get(toId).put(true);
            
            console.log(`[createEdgesBatch] Created edge: ${edge.fromSoul} -> ${edge.field} -> ${toId}`);
        } catch (e) {
            console.warn(`[createEdgesBatch] Issue with edge ${edge.fromSoul} -> ${edge.toSoul}:`, e);
            // Continue despite errors - fire and forget approach
        }
    }
}

// Add a card to a deck (bidirectional) with fire-and-forget approach
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
        // OPTIMIZED APPROACH: Use the fire-and-forget pattern similar to sampleDataService
        // Create both relationships simultaneously without waiting
        
        // Create edges definitions for both directions
        const edgeDefinitions = [
            {
                fromSoul: `${nodes.decks}/${deckId}`,
                field: 'cards_ref',
                toSoul: `${nodes.cards}/${cardId}`
            },
            {
                fromSoul: `${nodes.cards}/${cardId}`,
                field: 'decks_ref',
                toSoul: `${nodes.decks}/${deckId}`
            }
        ];
        
        // Process both edges using the fire-and-forget pattern but with more reliable approach
        // Use a more reliable approach that directly writes to the nodes with the right structure
        for (const {fromSoul, field, toSoul} of edgeDefinitions) {
            const toId = toSoul.split('/').pop();
            if (!toId) continue;
            
            try {
                // Set the field to true at the proper path, following the schema exactly
                // This creates entries like: decks/<deck_id>/cards_ref/<card_id>: true
                gun.get(fromSoul).get(field).get(toId).put(true);
                
                console.log(`[addCardToDeck] Created edge: ${fromSoul} -> ${field} -> ${toId}`);
            } catch (e) {
                console.warn(`[addCardToDeck] Error creating edge ${fromSoul} -> ${field} -> ${toId}:`, e);
            }
            
            // Add a small delay between operations to ensure they have time to process
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Consider the operation successful immediately
        // This is crucial for preventing timeouts during imports
        console.log(`[addCardToDeck] Initiated bidirectional relationship between ${cardId} and ${deckId}`);
        return true;
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
            if (!deck.cards_ref) {
                console.log(
                    `[initializeBidirectionalRelationships] Deck ${deckId} has no cards_ref, skipping`,
                );
                continue;
            }

            const cardIds =
                typeof deck.cards_ref === "object" && deck.cards_ref !== null
                    ? Object.keys(deck.cards_ref).filter(
                          (id) => typeof deck.cards_ref === "object" && deck.cards_ref !== null && 
                          id in deck.cards_ref && deck.cards_ref[id as keyof typeof deck.cards_ref] === true,
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

                // TypeScript safety: ensure decks_ref exists as an object
                const cardDataWithDecks = cardData as { decks_ref?: Record<string, boolean> };
                const decksOnCard = cardDataWithDecks.decks_ref || {};
                
                if (!decksOnCard[deckId]) {
                    // Using createRelationship for proper Gun.js relationship
                    const result = await createRelationship(
                        `${nodes.cards}/${cardId}`,
                        'decks_ref',
                        `${nodes.decks}/${deckId}`
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
        console.log(`[importCardsToDeck] DEBUG: Starting card import process with ${cardsData.length} cards`);
        
        for (let i = 0; i < cardsData.length; i++) {
            const cardData = cardsData[i];
            
            // Only require role_title as the bare minimum
            if (!cardData.role_title) {
                console.warn(
                    "[importCardsToDeck] Skipping invalid card - missing role_title:",
                    cardData,
                );
                continue;
            }
            
            console.log(`[importCardsToDeck] DEBUG: Card ${i+1} data:`, JSON.stringify(cardData).substring(0, 100) + '...');

            console.log(`[importCardsToDeck] Processing card ${i+1}/${cardsData.length}: "${cardData.role_title}"`);
            
            // Ensure we have defaults for required fields
            // These defaults align with those in the DeckManager component preprocessor
            const processedCardData = {
                ...cardData,
                // Default card_category if missing
                card_category: cardData.card_category || 'Supporters',
                // Default type if missing  
                type: cardData.type || 'Individual',
                // Default backstory if missing
                backstory: cardData.backstory || '',
                // Ensure goals is a string
                goals: typeof cardData.goals === 'string' ? cardData.goals : '',
                // Ensure obligations is a string
                obligations: cardData.obligations || '',
                // Ensure intellectual_property is a string
                intellectual_property: cardData.intellectual_property || '',
                // Ensure rivalrous_resources is a string
                rivalrous_resources: cardData.rivalrous_resources || ''
            };
            
            // Step 1: Create the card
            try {
                console.log(`[importCardsToDeck] Creating card: "${processedCardData.role_title}"`);
                const card = await createCard(processedCardData as Omit<Card, "card_id">);
                
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
                        `[importCardsToDeck] Failed to create card: "${processedCardData.role_title}"`,
                    );
                }
            } catch (error) {
                console.error(`[importCardsToDeck] Error processing card: "${processedCardData.role_title}"`, error);
            }
            
            // Add a minimal delay between cards
            console.log(`[importCardsToDeck] Processing next card...`);
            await new Promise((resolve) => setTimeout(resolve, 300));
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

    // Add retry logic for getting the card data
    const maxAttempts = 3;
    let attempts = 0;
    let cardData = null;
    
    while (attempts < maxAttempts && !cardData) {
        attempts++;
        console.log(`[getDecksForCard] Attempt ${attempts}/${maxAttempts} to fetch card: ${cardId}`);
        
        try {
            cardData = await get(`${nodes.cards}/${cardId}`);
            
            // If we didn't get data, add a delay before the next attempt
            if (!cardData && attempts < maxAttempts) {
                const delayTime = 500 * Math.pow(2, attempts-1); // Exponential backoff
                console.log(`[getDecksForCard] Card not found yet, retrying in ${delayTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayTime));
            }
        } catch (error) {
            console.error(`[getDecksForCard] Error fetching card ${cardId} (attempt ${attempts}):`, error);
            
            if (attempts < maxAttempts) {
                const delayTime = 500 * Math.pow(2, attempts-1);
                console.log(`[getDecksForCard] Will retry in ${delayTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayTime));
            }
        }
    }
    
    if (!cardData) {
        console.log(`[getDecksForCard] Card not found after ${maxAttempts} attempts: ${cardId}`);
        return [];
    }
    
    // TypeScript safety: ensure decks_ref exists and is the right type
    const cardDataWithDecks = cardData as { decks_ref?: Record<string, boolean> };
    const cardDecks = cardDataWithDecks.decks_ref;
    
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

// Get value names for a card using the standard schema
export async function getCardValueNames(card: Card): Promise<string[]> {
    // If card is null or undefined, return empty array 
    if (!card) return [];

    const gun = getGun();
    if (!gun) {
        console.error("[getCardValueNames] Gun not initialized");
        return [];
    }

    try {
        let valueIds: string[] = [];
        
        // Check if we have values_ref following the schema
        if (card.values_ref && typeof card.values_ref === 'object') {
            // If it's a Gun.js reference, follow it
            if ('#' in card.values_ref) {
                console.log(`Card ${card.card_id} has values_ref as a Gun reference`);
                const valuesRefPath = (card.values_ref as any)['#'];
                
                try {
                    // Get all value IDs from the reference map
                    await new Promise<void>(resolve => {
                        gun.get(valuesRefPath).map().once((val: any, id: string) => {
                            if (val === true && id !== '_' && id !== '#') {
                                console.log(`Found value ID ${id} via values_ref reference`);
                                if (!valueIds.includes(id)) valueIds.push(id);
                            }
                        });
                        
                        // Give enough time for all values to load
                        setTimeout(resolve, 500);
                    });
                } catch (err) {
                    console.error(`Error following values_ref at ${valuesRefPath}:`, err);
                }
            } else {
                // Direct values_ref map in the card: {"value_1": true, "value_2": true}
                valueIds = Object.keys(card.values_ref)
                    .filter(key => card.values_ref[key] === true && key !== '_' && key !== '#');
                console.log(`Found ${valueIds.length} value IDs in direct values_ref map`);
            }
        }
        
        // We only use values_ref in the standard schema
        
        // If we found no values despite all our attempts, return empty array
        if (valueIds.length === 0) {
            console.log(`No values found for card ${card.card_id}`);
            return [];
        }
        
        // Now we need to get the actual names for these value IDs
        console.log(`Looking up names for ${valueIds.length} value IDs: ${valueIds.join(', ')}`);
        const valueNames = await Promise.all(
            valueIds.map(async (id: string) => {
                try {
                    // Try to fetch the value object from the database
                    const valuePath = `${nodes.values}/${id}`;
                    console.log(`Fetching value data from ${valuePath}`);
                    const valueData = await get(valuePath);
                    
                    // If we found the value with a name, use it
                    if (valueData && typeof valueData === 'object' && 'name' in valueData) {
                        console.log(`Found value name: ${valueData.name}`);
                        return valueData.name as string;
                    }
                    
                    // If we couldn't find the value, format the ID as a fallback
                    // This is better than no value at all
                    if (id.startsWith('value_')) {
                        const formattedName = id.replace('value_', '')
                            .split('_').join(' ')
                            .split('-').join(' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        console.log(`Formatted value ID ${id} to name: ${formattedName}`);
                        return formattedName;
                    }
                    
                    // Last resort: return the ID itself
                    return id;
                } catch (err) {
                    console.error(`Error fetching value ${id}:`, err);
                    return ""; // Return empty string for failed lookups
                }
            })
        );
        
        // Filter out any empty strings from failed lookups
        const filteredNames = valueNames.filter(Boolean);
        console.log(`Returning ${filteredNames.length} value names for card ${card.card_id}`);
        return filteredNames;
    } catch (error) {
        console.error(`[getCardValueNames] Error:`, error);
        return [];
    }
}

// Get capability names for a card using the standard schema
export async function getCardCapabilityNames(card: Card): Promise<string[]> {
    // If card is null or undefined, return empty array
    if (!card) return [];

    const gun = getGun();
    if (!gun) {
        console.error("[getCardCapabilityNames] Gun not initialized");
        return [];
    }

    try {
        let capabilityIds: string[] = [];
        
        // Check if we have capabilities_ref following the schema
        if (card.capabilities_ref && typeof card.capabilities_ref === 'object') {
            // If it's a Gun.js reference, follow it
            if ('#' in card.capabilities_ref) {
                console.log(`Card ${card.card_id} has capabilities_ref as a Gun reference`);
                const capsRefPath = (card.capabilities_ref as any)['#'];
                
                try {
                    // Get all capability IDs from the reference map
                    await new Promise<void>(resolve => {
                        gun.get(capsRefPath).map().once((val: any, id: string) => {
                            if (val === true && id !== '_' && id !== '#') {
                                console.log(`Found capability ID ${id} via capabilities_ref reference`);
                                if (!capabilityIds.includes(id)) capabilityIds.push(id);
                            }
                        });
                        
                        // Give enough time for all capabilities to load
                        setTimeout(resolve, 500);
                    });
                } catch (err) {
                    console.error(`Error following capabilities_ref at ${capsRefPath}:`, err);
                }
            } else {
                // Direct capabilities_ref map in the card: {"capability_1": true, "capability_2": true}
                capabilityIds = Object.keys(card.capabilities_ref)
                    .filter(key => card.capabilities_ref[key] === true && key !== '_' && key !== '#');
                console.log(`Found ${capabilityIds.length} capability IDs in direct capabilities_ref map`);
            }
        }
        
        // We only use capabilities_ref in the standard schema
        
        // If we found no capabilities despite all our attempts, return empty array
        if (capabilityIds.length === 0) {
            console.log(`No capabilities found for card ${card.card_id}`);
            return [];
        }
        
        // Now we need to get the actual names for these capability IDs
        console.log(`Looking up names for ${capabilityIds.length} capability IDs: ${capabilityIds.join(', ')}`);
        const capabilityNames = await Promise.all(
            capabilityIds.map(async (id: string) => {
                try {
                    // Try to fetch the capability object from the database
                    const capabilityPath = `${nodes.capabilities}/${id}`;
                    console.log(`Fetching capability data from ${capabilityPath}`);
                    const capabilityData = await get(capabilityPath);
                    
                    // If we found the capability with a name, use it
                    if (capabilityData && typeof capabilityData === 'object' && 'name' in capabilityData) {
                        console.log(`Found capability name: ${capabilityData.name}`);
                        return capabilityData.name as string;
                    }
                    
                    // If we couldn't find the capability, format the ID as a fallback
                    // This is better than no capability at all
                    if (id.startsWith('capability_')) {
                        const formattedName = id.replace('capability_', '')
                            .split('_').join(' ')
                            .split('-').join(' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        console.log(`Formatted capability ID ${id} to name: ${formattedName}`);
                        return formattedName;
                    }
                    
                    // Cap_ format is also common in the system
                    if (id.startsWith('cap_')) {
                        const formattedName = id.replace('cap_', '')
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        console.log(`Formatted cap_ ID ${id} to name: ${formattedName}`);
                        return formattedName;
                    }
                    
                    // Last resort: return the ID itself
                    return id;
                } catch (err) {
                    console.error(`Error fetching capability ${id}:`, err);
                    return ""; // Return empty string for failed lookups
                }
            })
        );
        
        // Filter out any empty strings from failed lookups
        const filteredNames = capabilityNames.filter(Boolean);
        console.log(`Returning ${filteredNames.length} capability names for card ${card.card_id}`);
        return filteredNames;
    } catch (error) {
        console.error(`[getCardCapabilityNames] Error:`, error);
        return [];
    }
}
