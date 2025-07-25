// Deck management service
// This module provides services for managing decks and cards using the standard schema
// Following the exact patterns from sampleDataService.ts for robust Gun.js data operations
import {
    getGun,
    nodes,
    get,
    getCollection,
} from "./gunService";
import type { Deck, Card } from "$lib/types";
import { generateSequentialCardId, standardizeValueId, standardizeCapabilityId } from "./cardUtils";

/**
 * Helper function to deeply clean objects before saving to Gun
 * Removes undefined values which can cause issues in Gun.js
 */
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
        if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
            cleanObj[k] = deepClean(obj[k]);
        }
    }
    return cleanObj;
}

/**
 * Optimized put operation following sampleDataService pattern
 * Uses fire-and-forget approach with minimal timeout
 */
async function robustPut(
    path: string,
    key: string,
    data: any,
): Promise<boolean> {
    const gun = getGun();
    if (!gun) {
        console.error(`[deckService] Cannot save to ${path}/${key} - Gun not initialized`);
        return false;
    }

    const cleanData = deepClean(data);

    return new Promise<boolean>((resolve) => {
        try {
            gun
                .get(path)
                .get(key)
                .put(cleanData, (ack: any) => {
                    if (ack && ack.err) {
                        console.warn(`[deckService] Error saving to ${path}/${key}:`, ack.err);
                        resolve(false);
                    } else {
                        console.log(`[deckService] Successfully saved to ${path}/${key}`);
                        resolve(true);
                    }
                });
            // Use a short timeout to prevent hanging
            setTimeout(() => resolve(true), 1000);
        } catch (error) {
            console.error(`[deckService] Exception for ${path}/${key}:`, error);
            resolve(false);
        }
    });
}

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
        console.log(
            `[getDeck] Attempt ${attempts}/${maxAttempts} to fetch deck: ${deckId}`,
        );

        try {
            deckData = await get(`${nodes.decks}/${deckId}`);

            // If we didn't get data, add a delay before the next attempt
            if (!deckData && attempts < maxAttempts) {
                const delayTime = 500 * Math.pow(2, attempts - 1); // Exponential backoff: 500ms, 1000ms, 2000ms
                console.log(
                    `[getDeck] Deck not found yet, retrying in ${delayTime}ms...`,
                );
                await new Promise((resolve) => setTimeout(resolve, delayTime));
            }
        } catch (error) {
            console.error(
                `[getDeck] Error fetching deck ${deckId} (attempt ${attempts}):`,
                error,
            );

            if (attempts < maxAttempts) {
                const delayTime = 500 * Math.pow(2, attempts - 1);
                console.log(`[getDeck] Will retry in ${delayTime}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delayTime));
            }
        }
    }

    if (!deckData) {
        console.log(
            `[getDeck] Deck not found after ${maxAttempts} attempts: ${deckId}`,
        );
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
        // Ensure we're passing a valid type by casting to the appropriate type
        // First make sure deck_id is set as required
        const validUpdate = {
            ...updates,
            deck_id: deckId, // Ensure deck_id is always set
        } as Deck;

        // Use robustPut instead of put for consistency with sampleDataService pattern
        const result = await robustPut(nodes.decks, deckId, validUpdate);
        console.log(`[updateDeck] Updated deck ${deckId}: ${result ? 'success' : 'failed'}`);
        return result;
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

    // Process values from input data if provided (matches sampleDataService.ts pattern)
    // Create values_ref object (Record<string, boolean>) directly following the pattern in sampleDataService
    const values_ref: Record<string, boolean> = {};

    // CASE 1: Check for values object in JSON format like { "value_sustainability": true }
    if (
        typeof (card as any).values === "object" &&
        (card as any).values !== null
    ) {
        // Handle values in object format (from sample JSON)
        for (const valueId of Object.keys((card as any).values)) {
            if ((card as any).values[valueId] === true) {
                // This follows the sampleDataService pattern (values in object with true values)
                values_ref[valueId] = true;

                // Create the value entity in the database
                try {
                    const valueNameForDisplay = valueId
                        .replace("value_", "")
                        .replace(/-/g, " ")
                        .replace(/_/g, " ");
                    const capitalizedName =
                        valueNameForDisplay.charAt(0).toUpperCase() +
                        valueNameForDisplay.slice(1);
                    const valueData = {
                        value_id: valueId,
                        name: capitalizedName,
                        creator_ref: (card as any).creator_ref || "u_123",
                        cards_ref: {},
                        created_at: Date.now(),
                    };

                    // Use robustPut to create the value
                    await robustPut(nodes.values, valueId, valueData);
                    console.log(
                        `[createCard] Created value from object format: ${valueId} (${capitalizedName})`,
                    );
                } catch (e) {
                    console.warn(
                        `[createCard] Error creating value ${valueId} from object:`,
                        e,
                    );
                }
            }
        }
    }
    // CASE 2: Check for values_ref object from direct DB import
    else if (
        typeof (card as any).values_ref === "object" &&
        (card as any).values_ref !== null
    ) {
        // Handle values_ref as direct object reference (existing DB format)
        for (const valueId of Object.keys((card as any).values_ref)) {
            if ((card as any).values_ref[valueId] === true) {
                values_ref[valueId] = true;

                // Create the value entity in the database
                try {
                    const valueNameForDisplay = valueId
                        .replace("value_", "")
                        .replace(/-/g, " ")
                        .replace(/_/g, " ");
                    const capitalizedName =
                        valueNameForDisplay.charAt(0).toUpperCase() +
                        valueNameForDisplay.slice(1);
                    const valueData = {
                        value_id: valueId,
                        name: capitalizedName,
                        creator_ref: (card as any).creator_ref || "u_123",
                        cards_ref: {},
                        created_at: Date.now(),
                    };

                    // Use robustPut to create the value
                    await robustPut(nodes.values, valueId, valueData);
                    console.log(
                        `[createCard] Created value from values_ref object: ${valueId} (${capitalizedName})`,
                    );
                } catch (e) {
                    console.warn(
                        `[createCard] Error creating value ${valueId} from values_ref:`,
                        e,
                    );
                }
            }
        }
    }
    // CASE 3: Check for values as array of strings
    else if (Array.isArray((card as any).values)) {
        // Handle array of value names
        for (const valueName of (card as any).values) {
            if (typeof valueName === "string") {
                const valueId = standardizeValueId(valueName);
                values_ref[valueId] = true;

                // Create the value entity in the database
                try {
                    const valueNameForDisplay = valueId
                        .replace("value_", "")
                        .replace(/-/g, " ")
                        .replace(/_/g, " ");
                    const capitalizedName =
                        valueNameForDisplay.charAt(0).toUpperCase() +
                        valueNameForDisplay.slice(1);
                    const valueData = {
                        value_id: valueId,
                        name: capitalizedName,
                        creator_ref: (card as any).creator_ref || "u_123",
                        cards_ref: {},
                        created_at: Date.now(),
                    };

                    // Use robustPut to create the value
                    await robustPut(nodes.values, valueId, valueData);
                    console.log(
                        `[createCard] Created value from array: ${valueId} (${capitalizedName})`,
                    );
                } catch (e) {
                    console.warn(
                        `[createCard] Error creating value ${valueId} from array:`,
                        e,
                    );
                }
            }
        }
    }
    // CASE 4: Check for comma-separated string values
    else if (
        ((card as any).values && typeof (card as any).values === "string") ||
        ((card as any).values_ref && typeof (card as any).values_ref === "string")
    ) {
        // Get the string from either values or values_ref
        const valuesString = (card as any).values_ref || (card as any).values;
        
        // Parse comma-separated values string
        const valueNames = valuesString
            .split(",")
            .map((v: string) => v.trim())
            .filter(Boolean);
            
        console.log(`[createCard] Parsed ${valueNames.length} values from string: ${valuesString}`);

        // Convert each value name to a standardized ID and add to the record
        for (const valueName of valueNames) {
            const valueId = standardizeValueId(valueName);
            values_ref[valueId] = true;

            // Create the value in the database if it doesn't exist already
            // This follows the sampleDataService pattern of saving value records
            try {
                const valueNameForDisplay = valueId
                    .replace("value_", "")
                    .replace(/-/g, " ")
                    .replace(/_/g, " ");
                const capitalizedName =
                    valueNameForDisplay.charAt(0).toUpperCase() +
                    valueNameForDisplay.slice(1); // Capitalize
                const valueData = {
                    value_id: valueId,
                    name: capitalizedName,
                    creator_ref: (card as any).creator_ref || "u_123",
                    cards_ref: {},
                    created_at: Date.now(),
                };

                // Use robustPut to create the value
                await robustPut(nodes.values, valueId, valueData);
                console.log(
                    `[createCard] Created value from string: ${valueId} (${capitalizedName})`,
                );
            } catch (e) {
                console.warn(
                    `[createCard] Error creating value ${valueId} from string:`,
                    e,
                );
            }
        }
    }

    // Debug log values_ref
    console.log(
        `[createCard] Values for card ${cardId}:`,
        Object.keys(values_ref),
    );

    // We DO NOT add default values if the card doesn't specify any
    // This is the correct approach per sampleDataService.ts
    // Since we're parsing from card.values, if there are none, we'll have an empty values_ref object
    // Let the capabilities_ref be empty if no capabilities are provided

    // Process capabilities from input data if provided (matches sampleDataService.ts pattern)
    // Create capabilities_ref object (Record<string, boolean>) directly following sampleDataService.ts
    const capabilities_ref: Record<string, boolean> = {};

    // CASE 1: Check for capabilities object in JSON format like { "capability_project-management": true }
    if (
        typeof (card as any).capabilities === "object" &&
        (card as any).capabilities !== null
    ) {
        // Handle capabilities in object format (from sample JSON)
        for (const capabilityId of Object.keys((card as any).capabilities)) {
            if ((card as any).capabilities[capabilityId] === true) {
                // This follows the sampleDataService pattern (capabilities in object with true values)
                capabilities_ref[capabilityId] = true;

                // Create the capability entity in the database
                try {
                    const displayName = capabilityId
                        .replace("capability_", "")
                        .replace(/-/g, " ")
                        .replace(/_/g, " ");
                    const capitalizedName = displayName
                        .split(" ")
                        .map(
                            (word: string) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase(),
                        )
                        .join(" ");

                    const capabilityData = {
                        capability_id: capabilityId,
                        name: capitalizedName,
                        creator_ref: (card as any).creator_ref || "u_123",
                        cards_ref: {},
                        created_at: Date.now(),
                    };

                    // Use robustPut to create the capability
                    await robustPut(nodes.capabilities, capabilityId, capabilityData);
                    console.log(
                        `[createCard] Created capability from object format: ${capabilityId} (${capitalizedName})`,
                    );
                } catch (e) {
                    console.warn(
                        `[createCard] Error creating capability ${capabilityId} from object:`,
                        e,
                    );
                }
            }
        }
    }
    // CASE 2: Check for capabilities_ref object from direct DB import
    else if (
        typeof (card as any).capabilities_ref === "object" &&
        (card as any).capabilities_ref !== null
    ) {
        // Handle capabilities_ref as direct object reference (existing DB format)
        for (const capabilityId of Object.keys(
            (card as any).capabilities_ref,
        )) {
            if ((card as any).capabilities_ref[capabilityId] === true) {
                capabilities_ref[capabilityId] = true;

                // Create the capability entity in the database
                try {
                    const displayName = capabilityId
                        .replace("capability_", "")
                        .replace(/-/g, " ")
                        .replace(/_/g, " ");
                    const capitalizedName = displayName
                        .split(" ")
                        .map(
                            (word: string) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase(),
                        )
                        .join(" ");

                    const capabilityData = {
                        capability_id: capabilityId,
                        name: capitalizedName,
                        creator_ref: (card as any).creator_ref || "u_123",
                        cards_ref: {},
                        created_at: Date.now(),
                    };

                    // Use robustPut to create the capability
                    await robustPut(nodes.capabilities, capabilityId, capabilityData);
                    console.log(
                        `[createCard] Created capability from capabilities_ref object: ${capabilityId} (${capitalizedName})`,
                    );
                } catch (e) {
                    console.warn(
                        `[createCard] Error creating capability ${capabilityId} from capabilities_ref:`,
                        e,
                    );
                }
            }
        }
    }
    // CASE 3: Check for capabilities as array of strings
    else if (Array.isArray((card as any).capabilities)) {
        // Handle array of capability names
        for (const capName of (card as any).capabilities) {
            if (typeof capName === "string") {
                // Use standardizeCapabilityId to ensure consistent cap_ prefix
                const capabilityId = standardizeCapabilityId(capName);
                capabilities_ref[capabilityId] = true;

                // Create the capability entity in the database
                try {
                    const displayName = capName
                        .split(" ")
                        .map(
                            (word: string) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase(),
                        )
                        .join(" ");

                    const capabilityData = {
                        capability_id: capabilityId,
                        name: displayName,
                        creator_ref: (card as any).creator_ref || "u_123",
                        cards_ref: {},
                        created_at: Date.now(),
                    };

                    // Use robustPut to create the capability
                    await robustPut(nodes.capabilities, capabilityId, capabilityData);
                    console.log(
                        `[createCard] Created capability from array: ${capabilityId} (${displayName})`,
                    );
                } catch (e) {
                    console.warn(
                        `[createCard] Error creating capability ${capabilityId} from array:`,
                        e,
                    );
                }
            }
        }
    }
    // CASE 4: Check for comma-separated string capabilities
    else if (
        ((card as any).capabilities && typeof (card as any).capabilities === "string") ||
        ((card as any).capabilities_ref && typeof (card as any).capabilities_ref === "string")
    ) {
        // Get the string from either capabilities or capabilities_ref
        const capabilitiesString = (card as any).capabilities_ref || (card as any).capabilities;
        
        // Parse comma-separated capabilities string
        const capabilityNames = capabilitiesString
            .split(",")
            .map((c: string) => c.trim())
            .filter(Boolean);
            
        console.log(`[createCard] Parsed ${capabilityNames.length} capabilities from string: ${capabilitiesString}`);

        // Convert each capability name to a standardized ID and add to the record
        for (const capName of capabilityNames) {
            // Use standardizeCapabilityId to ensure consistent cap_ prefix
            const capabilityId = standardizeCapabilityId(capName);
            capabilities_ref[capabilityId] = true;

            // Create the capability in the database if it doesn't exist already
            try {
                const displayName = capName
                    .split(" ")
                    .map(
                        (word: string) =>
                            word.charAt(0).toUpperCase() +
                            word.slice(1).toLowerCase(),
                    )
                    .join(" ");

                const capabilityData = {
                    capability_id: capabilityId,
                    name: displayName,
                    creator_ref: (card as any).creator_ref || "u_123",
                    cards_ref: {},
                    created_at: Date.now(),
                };

                // Use robustPut to create the capability
                await robustPut(nodes.capabilities, capabilityId, capabilityData);
                console.log(
                    `[createCard] Created capability from string: ${capabilityId} (${displayName})`,
                );
            } catch (e) {
                console.warn(
                    `[createCard] Error creating capability ${capabilityId} from string:`,
                    e,
                );
            }
        }
    }

    // Debug log capabilities_ref
    console.log(
        `[createCard] Capabilities for card ${cardId}:`,
        Object.keys(capabilities_ref),
    );

    // We do NOT add default capabilities if none are provided
    // This matches sampleDataService.ts approach
    // If no capabilities are provided, capabilities_ref should be empty

    // Process goals - ensure it's a string (unchanged)
    const goalsString = typeof card.goals === "string" ? card.goals : "";

    // Prepare Gun-compatible card structure following the schema
    const gunCard = {
        card_id: cardId,
        card_number: cardNumber,
        role_title: card.role_title,
        backstory: card.backstory || "",
        goals: goalsString,
        obligations: card.obligations || "",
        intellectual_property: card.intellectual_property || "",
        resources: card.resources || "",
        values_ref: values_ref,
        capabilities_ref: capabilities_ref,
        decks_ref: {},
        agreements_ref: {},
        card_category: card.card_category || "Supporters",
        type: card.type || "Practice",
        icon: icon,
        creator_ref: (card as any).creator_ref || "u_123",
    };

    try {
        // OPTIMIZED APPROACH: Use the robustPut pattern from sampleDataService
        // This ensures consistent implementation across the codebase

        // STEP 1: Save the card data using robustPut
        console.log(`[createCard] Saving card data (no timestamp) to Gun DB: ${cardId}`);
        await robustPut(nodes.cards, cardId, gunCard);

        // STEP 2: Now write created_at as a **leaf** property
        const now = Date.now();
        console.log(`[createCard] Writing created_at timestamp: ${now}`);
        await robustPut(`${nodes.cards}/${cardId}`, 'created_at', now);

        // Add a small delay to let Gun process the request
        await new Promise((resolve) => setTimeout(resolve, 200));

        // STEP 3: Create bidirectional relationships using robustPut for each edge

        // Process values_ref bidirectional relationships
        for (const valueId of Object.keys(values_ref)) {
            if (values_ref[valueId]) {
                // Create Card → Value relationship
                await robustPut(`${nodes.cards}/${cardId}/values_ref`, valueId, true);
                console.log(`[createCard] Created relationship: card ${cardId} → value ${valueId}`);
                
                // Create Value → Card relationship
                await robustPut(`${nodes.values}/${valueId}/cards_ref`, cardId, true);
                console.log(`[createCard] Created relationship: value ${valueId} → card ${cardId}`);
                
                // Small delay between operations
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }

        // Process capabilities_ref bidirectional relationships
        for (const capabilityId of Object.keys(capabilities_ref)) {
            if (capabilities_ref[capabilityId]) {
                // Create Card → Capability relationship
                await robustPut(`${nodes.cards}/${cardId}/capabilities_ref`, capabilityId, true);
                console.log(`[createCard] Created relationship: card ${cardId} → capability ${capabilityId}`);
                
                // Create Capability → Card relationship
                await robustPut(`${nodes.capabilities}/${capabilityId}/cards_ref`, cardId, true);
                console.log(`[createCard] Created relationship: capability ${capabilityId} → card ${cardId}`);
                
                // Small delay between operations
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }

        // Return card data immediately without waiting for all relationships
        // This is crucial to prevent timeouts
        const cardData: Card = {
            ...gunCard,
            // These fields are already in gunCard with the correct _ref names
            created_at: Date.now(), // Ensure created_at is set to satisfy the Card interface
        };

        return cardData;
    } catch (error) {
        console.error(
            "[createCard] Error:",
            error instanceof Error ? error.message : String(error),
        );
        return null;
    }
}

// Helper function to clean undefined values from an object - needed for Gun.js
function cleanObject(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
        const result: Record<string, any> = {};
        obj.forEach((val, idx) => {
            if (val !== undefined) result[idx] = cleanObject(val);
        });
        return result;
    }

    const cleanObj: Record<string, any> = {};
    for (const key in obj) {
        if (
            Object.prototype.hasOwnProperty.call(obj, key) &&
            obj[key] !== undefined
        ) {
            cleanObj[key] = cleanObject(obj[key]);
        }
    }

    return cleanObj;
}

// Helper function to create multiple Gun edges efficiently
async function createEdgesBatch(
    edgeDefinitions: { fromSoul: string; field: string; toSoul: string }[],
    gunInstance: any,
): Promise<void> {
    for (const edge of edgeDefinitions) {
        try {
            // Extract the target ID from the soul path
            const toId = edge.toSoul.split("/").pop();
            if (!toId) continue;

            // Use robustPut to create the edge instead of direct Gun.js API
            // This creates entries like: <fromSoul>/<field>/<toId>: true
            await robustPut(`${edge.fromSoul}/${edge.field}`, toId, true);

            console.log(
                `[createEdgesBatch] Created edge: ${edge.fromSoul} -> ${edge.field} -> ${toId}`,
            );
        } catch (e) {
            console.warn(
                `[createEdgesBatch] Issue with edge ${edge.fromSoul} -> ${edge.toSoul}:`,
                e,
            );
            // Continue despite errors - fire and forget approach
        }
    }
}

// Add a card to a deck (bidirectional) using robustPut following sampleDataService pattern
export async function addCardToDeck(
    deckId: string,
    cardId: string,
): Promise<boolean> {
    console.log(`[addCardToDeck] Adding ${cardId} to ${deckId}`);
    
    try {
        // Use robustPut for both directions of the relationship
        // Direction 1: Deck → Card
        console.log(`[addCardToDeck] Creating Deck → Card relationship: ${deckId} → ${cardId}`);
        await robustPut(`${nodes.decks}/${deckId}/cards_ref`, cardId, true);
        
        // Small delay between operations
        await new Promise((resolve) => setTimeout(resolve, 50));
        
        // Direction 2: Card → Deck
        console.log(`[addCardToDeck] Creating Card → Deck relationship: ${cardId} → ${deckId}`);
        await robustPut(`${nodes.cards}/${cardId}/decks_ref`, deckId, true);
        
        // Consider the operation successful
        console.log(`[addCardToDeck] Successfully created bidirectional relationship between ${cardId} and ${deckId}`);
        return true;
    } catch (error) {
        console.error("[addCardToDeck] Unexpected error:", error);
        return false;
    }
}

// Function to initialize bidirectional relationships for existing cards and decks
// Updated to use robustPut following sampleDataService pattern
export async function initializeBidirectionalRelationships(): Promise<{
    success: boolean;
    processed: number;
}> {
    console.log("[initializeBidirectionalRelationships] Starting");
    
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
                          (id) =>
                              typeof deck.cards_ref === "object" &&
                              deck.cards_ref !== null &&
                              id in deck.cards_ref &&
                              deck.cards_ref[
                                  id as keyof typeof deck.cards_ref
                              ] === true,
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
                const cardDataWithDecks = cardData as {
                    decks_ref?: Record<string, boolean>;
                };
                const decksOnCard = cardDataWithDecks.decks_ref || {};

                if (!decksOnCard[deckId]) {
                    // Using robustPut for Card → Deck relationship
                    console.log(`[initializeBidirectionalRelationships] Adding deck ${deckId} to card ${cardId}`);
                    const result = await robustPut(`${nodes.cards}/${cardId}/decks_ref`, deckId, true);

                    if (result) {
                        console.log(
                            `[initializeBidirectionalRelationships] Added ${deckId} to ${cardId}`
                        );
                        processedCount++;
                    } else {
                        console.error(
                            `[initializeBidirectionalRelationships] Failed to add ${deckId} to ${cardId}`
                        );
                    }

                    // Add a small delay between operations
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }
            }

            // Add delay between processing decks
            console.log(
                `[initializeBidirectionalRelationships] Finished processing deck ${deckId}, waiting 1s before next deck`,
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
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
        console.log(
            `[importCardsToDeck] DEBUG: Starting card import process with ${cardsData.length} cards`,
        );

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

            console.log(
                `[importCardsToDeck] DEBUG: Card ${i + 1} data:`,
                JSON.stringify(cardData).substring(0, 100) + "...",
            );

            console.log(
                `[importCardsToDeck] Processing card ${i + 1}/${cardsData.length}: "${cardData.role_title}"`,
            );

            // Ensure we have defaults for required fields
            // These defaults align with those in the DeckManager component preprocessor
            const processedCardData = {
                ...cardData,
                card_category: cardData.card_category || "Supporters",
                type:          cardData.type          || "Individual",
                backstory:     cardData.backstory     || "",
                goals:         typeof cardData.goals === "string" ? cardData.goals : "",
                obligations:   cardData.obligations   || "",
                intellectual_property: cardData.intellectual_property || "",
                resources:     cardData.resources     || "",
            };

            // Step 1: Create the card
            try {
                console.log(
                    `[importCardsToDeck] Creating card: "${processedCardData.role_title}"`,
                );
                const card = await createCard(
                    processedCardData as Omit<Card, "card_id">,
                );

                if (card) {
                    // Step 2: Add card to deck after successful creation
                    console.log(
                        `[importCardsToDeck] Adding card ${card.card_id} to deck ${deckId}`,
                    );
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
                console.error(
                    `[importCardsToDeck] Error processing card: "${processedCardData.role_title}"`,
                    error,
                );
            }

            // Add a minimal delay between cards
            console.log(`[importCardsToDeck] Processing next card...`);
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error(
            "[importCardsToDeck] Critical error during import:",
            error,
        );
        return {
            success: addedCount > 0,
            added: addedCount,
            error: error instanceof Error ? error.message : String(error),
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
        console.log(
            `[getDecksForCard] Attempt ${attempts}/${maxAttempts} to fetch card: ${cardId}`,
        );

        try {
            cardData = await get(`${nodes.cards}/${cardId}`);

            // If we didn't get data, add a delay before the next attempt
            if (!cardData && attempts < maxAttempts) {
                const delayTime = 500 * Math.pow(2, attempts - 1); // Exponential backoff
                console.log(
                    `[getDecksForCard] Card not found yet, retrying in ${delayTime}ms...`,
                );
                await new Promise((resolve) => setTimeout(resolve, delayTime));
            }
        } catch (error) {
            console.error(
                `[getDecksForCard] Error fetching card ${cardId} (attempt ${attempts}):`,
                error,
            );

            if (attempts < maxAttempts) {
                const delayTime = 500 * Math.pow(2, attempts - 1);
                console.log(
                    `[getDecksForCard] Will retry in ${delayTime}ms...`,
                );
                await new Promise((resolve) => setTimeout(resolve, delayTime));
            }
        }
    }

    if (!cardData) {
        console.log(
            `[getDecksForCard] Card not found after ${maxAttempts} attempts: ${cardId}`,
        );
        return [];
    }

    // TypeScript safety: ensure decks_ref exists and is the right type
    const cardDataWithDecks = cardData as {
        decks_ref?: Record<string, boolean>;
    };
    const cardDecks = cardDataWithDecks.decks_ref;

    if (!cardDecks || Object.keys(cardDecks).length === 0) {
        console.log(`[getDecksForCard] No decks found for ${cardId}`);
        return [];
    }

    const deckIds = Object.keys(cardDecks).filter(
        (id) => cardDecks[id] === true,
    );

    console.log(
        `[getDecksForCard] Found ${deckIds.length} deck references for ${cardId}`,
    );

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
        if (card.values_ref && typeof card.values_ref === "object") {
            // If it's a Gun.js reference, follow it
            if ("#" in card.values_ref) {
                console.log(
                    `Card ${card.card_id} has values_ref as a Gun reference`,
                );
                const valuesRefPath = (card.values_ref as any)["#"];

                try {
                    // Get all value IDs from the reference map
                    await new Promise<void>((resolve) => {
                        gun.get(valuesRefPath)
                            .map()
                            .once((val: any, id: string) => {
                                if (val === true && id !== "_" && id !== "#") {
                                    console.log(
                                        `Found value ID ${id} via values_ref reference`,
                                    );
                                    if (!valueIds.includes(id))
                                        valueIds.push(id);
                                }
                            });

                        // Give enough time for all values to load
                        setTimeout(resolve, 500);
                    });
                } catch (err) {
                    console.error(
                        `Error following values_ref at ${valuesRefPath}:`,
                        err,
                    );
                }
            } else {
                // Direct values_ref map in the card: {"value_1": true, "value_2": true}
                valueIds = Object.keys(card.values_ref).filter(
                    (key) =>
                        card.values_ref[key] === true &&
                        key !== "_" &&
                        key !== "#",
                );
                console.log(
                    `Found ${valueIds.length} value IDs in direct values_ref map`,
                );
            }
        }

        // We only use values_ref in the standard schema

        // If we found no values despite all our attempts, return empty array
        if (valueIds.length === 0) {
            console.log(`No values found for card ${card.card_id}`);
            return [];
        }

        // Now we need to get the actual names for these value IDs
        console.log(
            `Looking up names for ${valueIds.length} value IDs: ${valueIds.join(", ")}`,
        );
        const valueNames = await Promise.all(
            valueIds.map(async (id: string) => {
                try {
                    // Try to fetch the value object from the database
                    const valuePath = `${nodes.values}/${id}`;
                    console.log(`Fetching value data from ${valuePath}`);
                    const valueData = await get(valuePath);

                    // If we found the value with a name, use it
                    if (
                        valueData &&
                        typeof valueData === "object" &&
                        "name" in valueData
                    ) {
                        console.log(`Found value name: ${valueData.name}`);
                        return valueData.name as string;
                    }

                    // If we couldn't find the value, format the ID as a fallback
                    // This is better than no value at all
                    if (id.startsWith("value_")) {
                        const formattedName = id
                            .replace("value_", "")
                            .split("_")
                            .join(" ")
                            .split("-")
                            .join(" ")
                            .split(" ")
                            .map(
                                (word) =>
                                    word.charAt(0).toUpperCase() +
                                    word.slice(1),
                            )
                            .join(" ");
                        console.log(
                            `Formatted value ID ${id} to name: ${formattedName}`,
                        );
                        return formattedName;
                    }

                    // Last resort: return the ID itself
                    return id;
                } catch (err) {
                    console.error(`Error fetching value ${id}:`, err);
                    return ""; // Return empty string for failed lookups
                }
            }),
        );

        // Filter out any empty strings from failed lookups
        const filteredNames = valueNames.filter(Boolean);
        console.log(
            `Returning ${filteredNames.length} value names for card ${card.card_id}`,
        );
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
        if (
            card.capabilities_ref &&
            typeof card.capabilities_ref === "object"
        ) {
            // If it's a Gun.js reference, follow it
            if ("#" in card.capabilities_ref) {
                console.log(
                    `Card ${card.card_id} has capabilities_ref as a Gun reference`,
                );
                const capsRefPath = (card.capabilities_ref as any)["#"];

                try {
                    // Get all capability IDs from the reference map
                    await new Promise<void>((resolve) => {
                        gun.get(capsRefPath)
                            .map()
                            .once((val: any, id: string) => {
                                if (val === true && id !== "_" && id !== "#") {
                                    console.log(
                                        `Found capability ID ${id} via capabilities_ref reference`,
                                    );
                                    if (!capabilityIds.includes(id))
                                        capabilityIds.push(id);
                                }
                            });

                        // Give enough time for all capabilities to load
                        setTimeout(resolve, 500);
                    });
                } catch (err) {
                    console.error(
                        `Error following capabilities_ref at ${capsRefPath}:`,
                        err,
                    );
                }
            } else {
                // Direct capabilities_ref map in the card: {"capability_1": true, "capability_2": true}
                capabilityIds = Object.keys(card.capabilities_ref).filter(
                    (key) =>
                        card.capabilities_ref[key] === true &&
                        key !== "_" &&
                        key !== "#",
                );
                console.log(
                    `Found ${capabilityIds.length} capability IDs in direct capabilities_ref map`,
                );
            }
        }

        // We only use capabilities_ref in the standard schema

        // If we found no capabilities despite all our attempts, return empty array
        if (capabilityIds.length === 0) {
            console.log(`No capabilities found for card ${card.card_id}`);
            return [];
        }

        // Now we need to get the actual names for these capability IDs
        console.log(
            `Looking up names for ${capabilityIds.length} capability IDs: ${capabilityIds.join(", ")}`,
        );
        const capabilityNames = await Promise.all(
            capabilityIds.map(async (id: string) => {
                try {
                    // Try to fetch the capability object from the database
                    const capabilityPath = `${nodes.capabilities}/${id}`;
                    console.log(
                        `Fetching capability data from ${capabilityPath}`,
                    );
                    const capabilityData = await get(capabilityPath);

                    // If we found the capability with a name, use it
                    if (
                        capabilityData &&
                        typeof capabilityData === "object" &&
                        "name" in capabilityData
                    ) {
                        console.log(
                            `Found capability name: ${capabilityData.name}`,
                        );
                        return capabilityData.name as string;
                    }

                    // If we couldn't find the capability, format the ID as a fallback
                    // This is better than no capability at all
                    // Handle both cap_ and capability_ prefixes for backward compatibility
                    if (id.startsWith("capability_") || id.startsWith("cap_")) {
                        const formattedName = id
                            .replace("capability_", "")
                            .replace("cap_", "")
                            .split("_")
                            .join(" ")
                            .split("-")
                            .join(" ")
                            .split(" ")
                            .map(
                                (word) =>
                                    word.charAt(0).toUpperCase() +
                                    word.slice(1),
                            )
                            .join(" ");
                        console.log(
                            `Formatted capability ID ${id} to name: ${formattedName}`,
                        );
                        return formattedName;
                    }

                    // Note: We already handle cap_ format in the previous condition
                    // This section is kept for reference but is no longer needed

                    // Last resort: return the ID itself
                    return id;
                } catch (err) {
                    console.error(`Error fetching capability ${id}:`, err);
                    return ""; // Return empty string for failed lookups
                }
            }),
        );

        // Filter out any empty strings from failed lookups
        const filteredNames = capabilityNames.filter(Boolean);
        console.log(
            `Returning ${filteredNames.length} capability names for card ${card.card_id}`,
        );
        return filteredNames;
    } catch (error) {
        console.error(`[getCardCapabilityNames] Error:`, error);
        return [];
    }
}
