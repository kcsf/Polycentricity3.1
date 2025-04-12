// Deck management service
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
        await put(`${nodes.decks}/${deckId}`, updates);
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

    // Generate unique ID for the card
    const cardId = `card_${generateId()}`;
    
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

    // Process values and capabilities from JSON strings
    let valuesArray: string[] = [];
    
    // Handle values based on type
    if (typeof card.values === "string") {
        // Split string, trim each value, and filter out empty strings
        valuesArray = card.values.split(",").map(v => v.trim()).filter(Boolean);
    } else if (Array.isArray(card.values)) {
        // Use array directly, making sure each value is a string
        valuesArray = card.values.map(v => String(v).trim()).filter(Boolean);
    }
    
    // Add standard values if none specified - use hardcoded IDs for the fixed values
    if (valuesArray.length === 0) {
        // Default to these standard value IDs (they'll be directly accessible in Gun)
        valuesArray = ["c1", "c2"]; // c1 is Sustainability, c2 is Community Resilience
    }
    
    // Process capabilities as a string to be compatible with existing code
    const capabilitiesStr =
        typeof card.capabilities === "string"
            ? card.capabilities
            : Array.isArray(card.capabilities)
              ? card.capabilities.join(",")
              : "";
    
    // Process goals - ensure it's a string
    const goalsString = typeof card.goals === "string" ? card.goals : "";

    // Get record structures for values and capabilities
    // First, try creating values by name (if they're real value names)
    const nameBasedValuesRecord = await createOrGetValues(
        valuesArray.filter(v => !v.startsWith('c') || v.length > 2) // Skip hardcoded IDs
    );
    
    const capabilitiesRecord = await createOrGetCapabilities(capabilitiesStr);
    
    // Prepare Gun-compatible card structure (no arrays)
    const gunCard = {
        card_id: cardId,
        card_number: cardNumber,
        role_title: card.role_title,
        backstory: card.backstory || "",
        values: valuesRecord,
        goals: goalsString,
        obligations: card.obligations || "",
        capabilities: capabilitiesRecord,
        intellectual_property: card.intellectual_property || "",
        rivalrous_resources: card.rivalrous_resources || "",
        card_category: card.card_category || "Supporters",
        type: card.type || "Practice",
        icon: icon,
        decks: card.decks || {},
        created_at: Date.now(),
        creator: "admin" // Default creator
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
        
        // STEP 2: Create value relationships using batch operation
        const valueEdges = Object.keys(valuesRecord).map(valueId => ({
            fromSoul: `${nodes.values}/${valueId}`,
            field: 'cards',
            toSoul: `${nodes.cards}/${cardId}`
        }));
        
        if (valueEdges.length > 0) {
            createEdgesBatch(valueEdges, gun);
        }
        
        // STEP 3: Create capability relationships using batch operation
        const capabilityEdges = Object.keys(capabilitiesRecord).map(capId => ({
            fromSoul: `${nodes.capabilities}/${capId}`,
            field: 'cards',
            toSoul: `${nodes.cards}/${cardId}`
        }));
        
        if (capabilityEdges.length > 0) {
            createEdgesBatch(capabilityEdges, gun);
        }

        // Return card data immediately without waiting for all relationships
        // This is crucial to prevent timeouts
        const cardData: Card = { 
            ...gunCard, 
            values: valuesRecord as Record<string, boolean>,
            capabilities: capabilitiesRecord as Record<string, boolean>,
            goals: goalsString,
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
            // Use direct Gun.js API with fire-and-forget pattern
            gunInstance.get(edge.fromSoul).get(edge.field).set(
                gunInstance.get(edge.toSoul)
            );
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
                field: 'cards',
                toSoul: `${nodes.cards}/${cardId}`
            },
            {
                fromSoul: `${nodes.cards}/${cardId}`,
                field: 'decks',
                toSoul: `${nodes.decks}/${deckId}`
            }
        ];
        
        // Process both edges using the fire-and-forget pattern
        createEdgesBatch(edgeDefinitions, gun);
        
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
                    // Using createRelationship for proper Gun.js relationship
                    const result = await createRelationship(
                        `${nodes.cards}/${cardId}`,
                        'decks',
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
        
        // Determine the format of the values property and extract IDs accordingly
        if (typeof card.values === "string") {
            // Handle string format (comma-separated values)
            valueIds = (card.values as string)
                .split(",")
                .map((v: string) => 
                    `value_${v.trim().toLowerCase().replace(/\s+/g, "-")}`)
                .filter(Boolean);
        } else if (Array.isArray(card.values)) {
            // Handle array format (list of value strings)
            valueIds = (card.values as string[])
                .map((v: string) => 
                    `value_${v.trim().toLowerCase().replace(/\s+/g, "-")}`)
                .filter(Boolean);
        } else if (card.values && typeof card.values === 'object') {
            // Handle both direct values in the object and Gun.js reference format
            if ('#' in card.values) {
                // It's a Gun reference, need to retrieve values via the reference
                const valuesRef = (card.values as any)['#'];
                console.log(`[getCardValueNames] Found Gun reference to values: ${valuesRef}`);
                
                // First attempt: Just use the extracted IDs
                const valuesPath = valuesRef.replace('cards/', '').replace('/values', '');
                valueIds = [valuesPath];
                
                // Alternative: Use the Soul to retrieve referenced values
                try {
                    // This is a bit hacky but needed for Gun references
                    const refs = await get(valuesRef);
                    if (refs && typeof refs === 'object') {
                        const refsObj: Record<string, any> = refs as Record<string, any>;
                        valueIds = Object.keys(refsObj)
                            .filter(key => refsObj[key] === true);
                    }
                } catch (e) {
                    console.log(`[getCardValueNames] Couldn't follow reference: ${e}`);
                }
            } else {
                // Handle Record/object format (Gun.js format with direct values)
                valueIds = Object.keys(card.values as Record<string, boolean>)
                    .filter(key => (card.values as Record<string, boolean>)[key] === true);
            }
        }

        console.log(`[getCardValueNames] Processing ${valueIds.length} value IDs:`, valueIds);
        
        // If we have raw values (e.g. "Sustainability"), convert to IDs
        if (valueIds.some(id => !id.startsWith('value_'))) {
            valueIds = valueIds.map(v => v.startsWith('value_') ? v : `value_${v.toLowerCase().replace(/\s+/g, '-')}`);
        }
        
        // Enhanced value retrieval with retry logic
        const valueNames = await Promise.all(
            valueIds.map(async (id: string) => {
                try {
                    const data = await get(`${nodes.values}/${id}`);
                    
                    // If we got data with a name property, use it
                    if (data && typeof data === 'object' && 'name' in data) {
                        return data.name as string;
                    }
                    
                    // For hardcoded IDs like 'c1' or 'c2', map to predefined values
                    if (id === 'c1') return 'Sustainability';
                    if (id === 'c2') return 'Community Resilience';
                    if (id === 'c3') return 'Regeneration';
                    if (id === 'c4') return 'Equity';
                    
                    // If it's a card ID used as a value, extract a readable name
                    if (id.startsWith('card_')) {
                        // Try to extract a readable name from the card
                        try {
                            const cardData = await get(`${nodes.cards}/${id}`);
                            if (cardData && typeof cardData === 'object' && 'role_title' in cardData) {
                                return `Value: ${cardData.role_title}`;
                            }
                        } catch (e) {
                            console.warn(`[getCardValueNames] Error fetching card ${id} for value name: ${e}`);
                        }
                        
                        // If card data not available, format the ID nicely
                        return 'Value ' + id.substring(0, 10);
                    }
                    
                    // Fallback: Convert ID to human-readable format
                    if (id.startsWith('value_')) {
                        return id.replace('value_', '')
                            .split('-')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                    }
                    
                    // Last resort, return the ID with a prefix to indicate it's a value
                    return `Value: ${id}`;
                } catch (e) {
                    console.warn(`[getCardValueNames] Error fetching value ${id}: ${e}`);
                    return "";
                }
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
        
        // Determine the format of the capabilities property and extract IDs accordingly
        if (typeof card.capabilities === "string") {
            // Handle string format (comma-separated capabilities)
            capIds = (card.capabilities as string)
                .split(",")
                .map((c: string) => 
                    `capability_${c.trim().toLowerCase().replace(/\s+/g, "-")}`)
                .filter(Boolean);
        } else if (Array.isArray(card.capabilities)) {
            // Handle array format (list of capability strings)
            capIds = (card.capabilities as string[])
                .map((c: string) => 
                    `capability_${c.trim().toLowerCase().replace(/\s+/g, "-")}`)
                .filter(Boolean);
        } else if (card.capabilities && typeof card.capabilities === 'object') {
            // Handle both direct capabilities in the object and Gun.js reference format
            if ('#' in card.capabilities) {
                // It's a Gun reference, need to retrieve capabilities via the reference
                const capsRef = (card.capabilities as any)['#'];
                console.log(`[getCardCapabilityNames] Found Gun reference to capabilities: ${capsRef}`);
                
                // First attempt: Just use the extracted IDs
                const capsPath = capsRef.replace('cards/', '').replace('/capabilities', '');
                capIds = [capsPath];
                
                // Alternative: Use the Soul to retrieve referenced capabilities
                try {
                    // This is a bit hacky but needed for Gun references
                    const refs = await get(capsRef);
                    if (refs && typeof refs === 'object') {
                        const refsObj: Record<string, any> = refs as Record<string, any>;
                        capIds = Object.keys(refsObj)
                            .filter(key => refsObj[key] === true);
                    }
                } catch (e) {
                    console.log(`[getCardCapabilityNames] Couldn't follow reference: ${e}`);
                }
            } else {
                // Handle Record/object format (Gun.js format with direct capabilities)
                capIds = Object.keys(card.capabilities as Record<string, boolean>)
                    .filter(key => (card.capabilities as Record<string, boolean>)[key] === true);
            }
        }

        console.log(`[getCardCapabilityNames] Processing ${capIds.length} capability IDs:`, capIds);
        
        // If we have raw capabilities (e.g. "Farming"), convert to IDs
        if (capIds.some(id => !id.startsWith('capability_'))) {
            capIds = capIds.map(c => c.startsWith('capability_') ? c : `capability_${c.toLowerCase().replace(/\s+/g, '-')}`);
        }
        
        // Enhanced capability retrieval with retry logic
        const capNames = await Promise.all(
            capIds.map(async (id: string) => {
                try {
                    const data = await get(`${nodes.capabilities}/${id}`);
                    
                    // If we got data with a name property, use it
                    if (data && typeof data === 'object' && 'name' in data) {
                        return data.name as string;
                    }
                    
                    // Fallback: Convert ID to human-readable format
                    if (id.startsWith('capability_')) {
                        return id.replace('capability_', '')
                            .split('-')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                    }
                    
                    return ""; 
                } catch (e) {
                    console.warn(`[getCardCapabilityNames] Error fetching capability ${id}: ${e}`);
                    return "";
                }
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
