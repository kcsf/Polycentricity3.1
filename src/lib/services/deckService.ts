// Deck management service
import { getGun, nodes, generateId } from "./gunService";
import type { Deck, Card } from "$lib/types";

// Get a deck by ID
export async function getDeck(deckId: string): Promise<Deck | null> {
    try {
        console.log(`Getting deck: ${deckId}`);
        const gun = getGun();

        if (!gun) {
            console.error("Gun not initialized");
            return null;
        }

        return new Promise((resolve) => {
            gun.get(nodes.decks)
                .get(deckId)
                .once((deckData: Deck) => {
                    if (!deckData) {
                        console.log(`Deck not found: ${deckId}`);
                        resolve(null);
                        return;
                    }

                    console.log(`Found deck: ${deckId}`, deckData);
                    // Log cards information
                    if (deckData.cards) {
                        if (Array.isArray(deckData.cards)) {
                            console.log(
                                `Deck has ${deckData.cards.length} cards (array format):`,
                                deckData.cards,
                            );
                        } else {
                            console.log(
                                `Deck has ${Object.keys(deckData.cards).length} cards (object format):`,
                                deckData.cards,
                            );
                        }
                    } else {
                        console.log(`Deck ${deckId} has no cards property`);
                    }

                    resolve(deckData);
                });
        });
    } catch (error) {
        console.error("Get deck error:", error);
        return null;
    }
}

// Update a deck
export async function updateDeck(
    deckId: string,
    updates: Partial<Deck>,
): Promise<boolean> {
    try {
        console.log(`Updating deck: ${deckId}`);
        const gun = getGun();

        if (!gun) {
            console.error("Gun not initialized");
            return false;
        }

        return new Promise((resolve) => {
            gun.get(nodes.decks)
                .get(deckId)
                .put(updates, (ack: any) => {
                    if (ack.err) {
                        console.error("Error updating deck:", ack.err);
                        resolve(false);
                    } else {
                        console.log(`Updated deck: ${deckId}`);
                        resolve(true);
                    }
                });
        });
    } catch (error) {
        console.error("Update deck error:", error);
        return false;
    }
}

// Import the value and capability services
import { createOrGetValues } from "./valueService";
import { createOrGetCapabilities } from "./capabilityService";

// Create a new card
export async function createCard(
    card: Omit<Card, "card_id">,
): Promise<Card | null> {
    try {
        console.log("Creating new card");
        const gun = getGun();

        if (!gun) {
            console.error("Gun not initialized");
            return null;
        }

        const cardId = `card_${generateId()}`;

        // Handle card_number
        if (card.card_number === undefined || card.card_number === null) {
            card.card_number = Math.floor(Math.random() * 52) + 1;
        } else if (typeof card.card_number === "string") {
            card.card_number = parseInt(card.card_number, 10);
        }

        // Set default icon
        if (!card.icon) {
            switch (card.card_category) {
                case "Funders":
                    card.icon = "CircleDollarSign";
                    break;
                case "Providers":
                    card.icon = "Hammer";
                    break;
                case "Supporters":
                    card.icon = "Heart";
                    break;
                default:
                    card.icon = "User";
            }
        }

        // Process values
        let valuesRecord: Record<string, boolean> = {};
        if (card.values) {
            if (Array.isArray(card.values)) {
                valuesRecord = await createOrGetValues(card.values);
            } else if (typeof card.values === "string") {
                const valueArray = card.values
                    .split(",")
                    .map((v) => v.trim())
                    .filter((v) => v);
                valuesRecord = await createOrGetValues(valueArray);
            }
        }

        // Process capabilities
        let capabilitiesRecord: Record<string, boolean> = {};
        if (card.capabilities) {
            if (typeof card.capabilities === "string") {
                const capabilityArray = card.capabilities
                    .split(",")
                    .map((c) => c.trim())
                    .filter((c) => c);
                capabilitiesRecord = await createOrGetCapabilities(
                    capabilityArray.join(", "),
                );
            } else if (Array.isArray(card.capabilities)) {
                capabilitiesRecord = await createOrGetCapabilities(
                    card.capabilities.join(", "),
                );
            }
        }

        // Process goals
        const goalsStr = Array.isArray(card.goals)
            ? card.goals.join(",")
            : card.goals || "";

        // Base card data (without relationships as properties)
        const gunCompatibleCard = {
            card_id: cardId,
            card_number: card.card_number,
            role_title: card.role_title,
            backstory: card.backstory || "",
            goals: goalsStr,
            obligations: card.obligations || "",
            intellectual_property: card.intellectual_property || "",
            rivalrous_resources: card.rivalrous_resources || "",
            card_category: card.card_category,
            type: card.type || "Practice",
            icon: card.icon,
        };

        const cardData: Card = {
            ...gunCompatibleCard,
            values: valuesRecord,
            capabilities: capabilitiesRecord,
            decks: card.decks || {},
        };

        return new Promise((resolve) => {
            gun.get(nodes.cards)
                .get(cardId)
                .put(gunCompatibleCard, (ack) => {
                    if (ack.err) {
                        console.error("Error creating card:", ack.err);
                        resolve(null);
                        return;
                    }

                    // Set value edges
                    Promise.all(
                        Object.keys(valuesRecord).map((valueId) =>
                            Promise.all([
                                gun
                                    .get(nodes.cards)
                                    .get(cardId)
                                    .get("values")
                                    .get(valueId)
                                    .put(true),
                                gun
                                    .get(nodes.values)
                                    .get(valueId)
                                    .get("cards")
                                    .get(cardId)
                                    .put(true),
                            ]),
                        ),
                    ).then(() =>
                        console.log(
                            `Set ${Object.keys(valuesRecord).length} value edges for card ${cardId}`,
                        ),
                    );

                    // Set capability edges
                    Promise.all(
                        Object.keys(capabilitiesRecord).map((capabilityId) =>
                            Promise.all([
                                gun
                                    .get(nodes.cards)
                                    .get(cardId)
                                    .get("capabilities")
                                    .get(capabilityId)
                                    .put(true),
                                gun
                                    .get(nodes.capabilities)
                                    .get(capabilityId)
                                    .get("cards")
                                    .get(cardId)
                                    .put(true),
                            ]),
                        ),
                    ).then(() =>
                        console.log(
                            `Set ${Object.keys(capabilitiesRecord).length} capability edges for card ${cardId}`,
                        ),
                    );

                    console.log(`Created card: ${cardId}`);
                    resolve(cardData);
                });
        });
    } catch (error) {
        console.error("Create card error:", error);
        return null;
    }
}

// Add a card to a deck (bidirectional relationship)
export async function addCardToDeck(
    deckId: string,
    cardId: string,
): Promise<boolean> {
    try {
        console.log(
            `Adding card ${cardId} to deck ${deckId} with bidirectional relationship`,
        );
        const gun = getGun();

        if (!gun) {
            console.error("Gun not initialized");
            return false;
        }

        // Step 1: Simple approach - just directly set the relationships without checking existing state
        console.log(
            `Direct approach: Adding card ${cardId} to deck's cards at path ${nodes.decks}/${deckId}/cards/${cardId}`,
        );

        // First promise: Add card to deck
        const step1Promise = new Promise<boolean>((resolve) => {
            let timeoutHandled = false;

            // Direct approach to set the relationship
            gun.get(nodes.decks)
                .get(deckId)
                .get("cards")
                .get(cardId)
                .put(true, (ack: any) => {
                    if (ack.err) {
                        console.error(
                            `Error adding card ${cardId} to deck ${deckId}:`,
                            ack.err,
                        );
                        !timeoutHandled && resolve(false);
                    } else {
                        console.log(
                            `Successfully added card ${cardId} to deck ${deckId} directly`,
                        );
                        !timeoutHandled && resolve(true);
                    }
                    timeoutHandled = true;
                });

            // Add a timeout in case Gun.js doesn't respond
            setTimeout(() => {
                if (!timeoutHandled) {
                    console.warn(
                        `Timeout adding card ${cardId} to deck ${deckId} directly`,
                    );
                    resolve(false);
                    timeoutHandled = true;
                }
            }, 5000);
        });

        // Step 2: Add the deck to the card's decks property for bidirectional relationship
        console.log(
            `Direct approach: Adding deck ${deckId} to card's decks at path ${nodes.cards}/${cardId}/decks/${deckId}`,
        );

        // Second promise: Add deck to card
        const step2Promise = new Promise<boolean>((resolve) => {
            let timeoutHandled = false;

            // Direct approach to set the relationship
            gun.get(nodes.cards)
                .get(cardId)
                .get("decks")
                .get(deckId)
                .put(true, (ack: any) => {
                    if (ack.err) {
                        console.error(
                            `Error adding deck ${deckId} to card ${cardId}:`,
                            ack.err,
                        );
                        !timeoutHandled && resolve(false);
                    } else {
                        console.log(
                            `Successfully added deck ${deckId} to card ${cardId} directly`,
                        );
                        !timeoutHandled && resolve(true);
                    }
                    timeoutHandled = true;
                });

            // Add a timeout in case Gun.js doesn't respond
            setTimeout(() => {
                if (!timeoutHandled) {
                    console.warn(
                        `Timeout adding deck ${deckId} to card ${cardId} directly`,
                    );
                    resolve(false);
                    timeoutHandled = true;
                }
            }, 5000);
        });

        // Wait for both operations to complete
        const [step1Result, step2Result] = await Promise.all([
            step1Promise,
            step2Promise,
        ]);

        console.log(
            `Completed adding card ${cardId} to deck ${deckId} - Success status: ${step1Result || step2Result}`,
        );
        return step1Result || step2Result; // Consider it a success if either direction works
    } catch (error) {
        console.error("Add card to deck error:", error);
        return false;
    }
}

// Function to initialize bidirectional relationships for existing cards and decks
export async function initializeBidirectionalRelationships(): Promise<{
    success: boolean;
    processed: number;
}> {
    try {
        console.log(
            "Initializing bidirectional relationships between cards and decks",
        );
        const gun = getGun();

        if (!gun) {
            console.error("Gun not initialized");
            return { success: false, processed: 0 };
        }

        let processedCount = 0;

        // Get all decks
        const decks: Record<string, Deck> = {};
        await new Promise<void>((resolve) => {
            gun.get(nodes.decks)
                .map()
                .once((deck: Deck, deckId: string) => {
                    if (deck) {
                        decks[deckId] = deck;
                    }
                });

            // Give Gun time to process all decks
            setTimeout(resolve, 1000);
        });

        console.log(`Found ${Object.keys(decks).length} decks to process`);

        // Process each deck
        for (const [deckId, deck] of Object.entries(decks)) {
            if (!deck.cards) {
                console.log(`Deck ${deckId} has no cards, skipping`);
                continue;
            }

            let cardIds: string[] = [];

            // Extract card IDs from the deck
            if (Array.isArray(deck.cards)) {
                cardIds = deck.cards;
            } else if (typeof deck.cards === "object") {
                // Handle Gun.js reference
                if ((deck.cards as any)["#"]) {
                    const cardsPath = (deck.cards as any)["#"] as string;
                    await new Promise<void>((resolve) => {
                        gun.get(cardsPath)
                            .map()
                            .once((value: boolean, cardId: string) => {
                                if (value === true) {
                                    cardIds.push(cardId);
                                }
                            });

                        // Give Gun time to process all cards
                        setTimeout(resolve, 500);
                    });
                } else {
                    // Standard object format
                    cardIds = Object.keys(
                        deck.cards as Record<string, boolean>,
                    );
                }
            }

            console.log(
                `Processing ${cardIds.length} cards for deck ${deckId}`,
            );

            // Update each card with a reference to this deck
            for (const cardId of cardIds) {
                await new Promise<void>((resolve) => {
                    gun.get(nodes.cards)
                        .get(cardId)
                        .once((cardData: any) => {
                            if (!cardData) {
                                console.log(
                                    `Card ${cardId} not found, skipping`,
                                );
                                resolve();
                                return;
                            }

                            // Create or update the decks object in the card
                            let decks: Record<string, boolean> = {};

                            if (cardData.decks) {
                                // Handle both array and object format
                                if (Array.isArray(cardData.decks)) {
                                    cardData.decks.forEach((id: string) => {
                                        decks[id] = true;
                                    });
                                } else if (typeof cardData.decks === "object") {
                                    // Handle Gun.js reference
                                    if ((cardData.decks as any)["#"]) {
                                        console.log(
                                            `Card ${cardId} has decks reference with soul: ${(cardData.decks as any)["#"]}, will update there`,
                                        );

                                        // Get the existing decks and add this deck
                                        const decksPath = (
                                            cardData.decks as any
                                        )["#"] as string;
                                        gun.get(decksPath).once(
                                            (existingDecks: any) => {
                                                // Add this deck to the existing decks
                                                existingDecks[deckId] = true;

                                                // Update the decks node
                                                gun.get(decksPath).put(
                                                    existingDecks,
                                                    (ack: any) => {
                                                        if (ack.err) {
                                                            console.error(
                                                                `Error updating decks for card ${cardId}:`,
                                                                ack.err,
                                                            );
                                                        } else {
                                                            console.log(
                                                                `Added deck ${deckId} to card ${cardId}'s decks reference`,
                                                            );
                                                            processedCount++;
                                                        }
                                                        resolve();
                                                    },
                                                );
                                            },
                                        );
                                        return;
                                    }
                                    // Standard object format
                                    else {
                                        decks = { ...cardData.decks };
                                    }
                                }
                            }

                            // Add the deck reference to the card if not already present
                            if (!decks[deckId]) {
                                decks[deckId] = true;

                                // Update the card with the deck reference
                                gun.get(nodes.cards)
                                    .get(cardId)
                                    .put({ decks }, (ack: any) => {
                                        if (ack.err) {
                                            console.error(
                                                `Error adding deck ${deckId} to card ${cardId}:`,
                                                ack.err,
                                            );
                                        } else {
                                            console.log(
                                                `Added deck ${deckId} to card ${cardId}`,
                                            );
                                            processedCount++;
                                        }
                                        resolve();
                                    });
                            } else {
                                console.log(
                                    `Deck ${deckId} already in card ${cardId}'s decks`,
                                );
                                resolve();
                            }
                        });
                });
            }
        }

        console.log(
            `Bidirectional relationships initialized for ${processedCount} card-deck pairs`,
        );
        return {
            success: processedCount > 0,
            processed: processedCount,
        };
    } catch (error) {
        console.error("Initialize bidirectional relationships error:", error);
        return {
            success: false,
            processed: 0,
        };
    }
}

// Import multiple cards and add them to a deck
export async function importCardsToDeck(
    deckId: string,
    cardsData: any[],
): Promise<{ success: boolean; added: number }> {
    try {
        console.log(`Importing ${cardsData.length} cards to deck ${deckId}`);
        let addedCount = 0;
        const gun = getGun();

        if (!gun) {
            console.error("Gun not initialized");
            return { success: false, added: 0 };
        }

        // Import support functions to handle value/capability creation
        const { createValue } = await import("./valueService");
        const { createCapability } = await import("./capabilityService");

        // Much longer timeout between operations to reduce Gun.js pressure
        const timeout = 3500; // Increased to 3.5 seconds to ensure Gun.js can finish each operation

        // Step 1: Load all existing values into memory for faster processing
        const valueMap: Record<string, string> = {};

        await new Promise<void>((resolve) => {
            gun.get(nodes.values)
                .map()
                .once((valueData: any, valueId: string) => {
                    if (valueData && valueData.name) {
                        // Store lowercased name -> id mapping for faster lookups
                        valueMap[valueData.name.toLowerCase()] = valueId;
                    }
                });

            // Wait a bit to make sure we get everything
            setTimeout(resolve, 1000);
        });

        console.log(
            `Pre-loaded ${Object.keys(valueMap).length} value IDs for faster lookups`,
        );

        // Step 2: Load all existing capabilities for faster processing
        const capabilityMap: Record<string, string> = {};

        await new Promise<void>((resolve) => {
            gun.get(nodes.capabilities)
                .map()
                .once((capabilityData: any, capabilityId: string) => {
                    if (capabilityData && capabilityData.name) {
                        // Store lowercased name -> id mapping for faster lookups
                        capabilityMap[capabilityData.name.toLowerCase()] =
                            capabilityId;
                    }
                });

            // Wait a bit to make sure we get everything
            setTimeout(resolve, 1000);
        });

        console.log(
            `Pre-loaded ${Object.keys(capabilityMap).length} capability IDs for faster lookups`,
        );

        // Process cards one at a time
        for (let i = 0; i < cardsData.length; i++) {
            try {
                const cardData = cardsData[i];

                // Skip if missing required fields
                if (!cardData.role_title || !cardData.card_category) {
                    console.warn(
                        "Skipping card with missing required fields:",
                        cardData,
                    );
                    continue;
                }

                console.log(
                    `Processing card ${i + 1}/${cardsData.length}: "${cardData.role_title}"`,
                );

                // Create a clean version of card data with proper typing
                const cleanCardData: Partial<Card> = {
                    card_number:
                        cardData.card_number ||
                        Math.floor(Math.random() * 52) + 1,
                    role_title: cardData.role_title,
                    backstory: cardData.backstory || "",
                    goals: cardData.goals || [],
                    obligations: cardData.obligations || "",
                    intellectual_property: cardData.intellectual_property || "",
                    rivalrous_resources: cardData.rivalrous_resources || "",
                    card_category: cardData.card_category,
                    type: cardData.type || "Individual",
                    icon: cardData.icon || "User",
                };

                // Handle values - convert from various formats to record format
                cleanCardData.values = {};

                if (Array.isArray(cardData.values)) {
                    // Values provided as array of strings
                    console.log(
                        `Processing ${cardData.values.length} values from array:`,
                        cardData.values,
                    );

                    for (const value of cardData.values) {
                        console.log(`Processing value: "${value}"`);

                        const normalized = value.toLowerCase();
                        if (valueMap[normalized]) {
                            // Use existing value ID if found
                            const valueId = valueMap[normalized];
                            console.log(
                                `Using existing value ID for "${value}": ${valueId}`,
                            );
                            (cleanCardData.values as Record<string, boolean>)[
                                valueId
                            ] = true;
                        } else {
                            // Create the value if needed
                            console.log(`Creating new value "${value}"...`);
                            const newValue = await createValue(value);
                            if (newValue) {
                                console.log(
                                    `Created new value "${value}" with ID: ${newValue.value_id}`,
                                );
                                (
                                    cleanCardData.values as Record<
                                        string,
                                        boolean
                                    >
                                )[newValue.value_id] = true;
                                // Add to our map for future lookups
                                valueMap[value.toLowerCase()] =
                                    newValue.value_id;
                            } else {
                                console.warn(
                                    `Failed to create value "${value}"`,
                                );
                            }
                        }
                    }

                    // Check what we ended up with
                    console.log(`Final values object:`, cleanCardData.values);
                } else if (typeof cardData.values === "string") {
                    // Values provided as comma-separated string
                    const valueNames = cardData.values
                        .split(",")
                        .map((v: string) => v.trim())
                        .filter((v: string) => v);
                    for (const value of valueNames) {
                        const normalized = value.toLowerCase();
                        if (valueMap[normalized]) {
                            // Use existing value ID if found
                            (cleanCardData.values as Record<string, boolean>)[
                                valueMap[normalized]
                            ] = true;
                        } else {
                            // Create the value if needed
                            const newValue = await createValue(value);
                            if (newValue) {
                                (
                                    cleanCardData.values as Record<
                                        string,
                                        boolean
                                    >
                                )[newValue.value_id] = true;
                                // Add to our map for future lookups
                                valueMap[value.toLowerCase()] =
                                    newValue.value_id;
                            }
                        }
                    }
                }

                // Handle capabilities - convert from various formats to record format
                cleanCardData.capabilities = {};

                if (typeof cardData.capabilities === "string") {
                    // Capabilities provided as comma-separated string
                    const capabilityNames = cardData.capabilities
                        .split(",")
                        .map((c: string) => c.trim())
                        .filter((c: string) => c);
                    for (const capability of capabilityNames) {
                        const normalized = capability.toLowerCase();
                        if (capabilityMap[normalized]) {
                            // Use existing capability ID if found
                            (
                                cleanCardData.capabilities as Record<
                                    string,
                                    boolean
                                >
                            )[capabilityMap[normalized]] = true;
                        } else {
                            // Create the capability if needed
                            const newCapability =
                                await createCapability(capability);
                            if (newCapability) {
                                (
                                    cleanCardData.capabilities as Record<
                                        string,
                                        boolean
                                    >
                                )[newCapability.capability_id] = true;
                                // Add to our map for future lookups
                                capabilityMap[capability.toLowerCase()] =
                                    newCapability.capability_id;
                            }
                        }
                    }
                } else if (Array.isArray(cardData.capabilities)) {
                    // Capabilities provided as array of strings
                    for (const capability of cardData.capabilities) {
                        const normalized = capability.toLowerCase();
                        if (capabilityMap[normalized]) {
                            // Use existing capability ID if found
                            (
                                cleanCardData.capabilities as Record<
                                    string,
                                    boolean
                                >
                            )[capabilityMap[normalized]] = true;
                        } else {
                            // Create the capability if needed
                            const newCapability =
                                await createCapability(capability);
                            if (newCapability) {
                                (
                                    cleanCardData.capabilities as Record<
                                        string,
                                        boolean
                                    >
                                )[newCapability.capability_id] = true;
                                // Add to our map for future lookups
                                capabilityMap[capability.toLowerCase()] =
                                    newCapability.capability_id;
                            }
                        }
                    }
                }

                // Create card with our clean data
                const card = await createCard(
                    cleanCardData as Omit<Card, "card_id">,
                );

                if (card) {
                    // Add to deck
                    const added = await addCardToDeck(deckId, card.card_id);
                    if (added) {
                        addedCount++;
                        console.log(
                            `Successfully added card ${card.card_id} to deck ${deckId} (${addedCount}/${cardsData.length})`,
                        );
                    } else {
                        console.warn(
                            `Failed to add card ${card.card_id} to deck ${deckId}`,
                        );
                    }
                } else {
                    console.warn("Failed to create card:", cardData.role_title);
                }

                // Wait between cards to let Gun.js breathe
                if (i < cardsData.length - 1) {
                    console.log(
                        `Waiting ${timeout}ms before processing next card. ${cardsData.length - i - 1} cards remaining.`,
                    );
                    await new Promise((resolve) =>
                        setTimeout(resolve, timeout),
                    );
                }
            } catch (cardError) {
                console.error("Error processing individual card:", cardError);
                // Continue with next card even if one fails
            }
        }

        console.log(
            `Import complete. Added ${addedCount} out of ${cardsData.length} cards.`,
        );
        return {
            success: addedCount > 0,
            added: addedCount,
        };
    } catch (error) {
        console.error("Import cards error:", error);
        return { success: false, added: 0 };
    }
}

// Get all decks that contain a specific card
export async function getDecksForCard(cardId: string): Promise<Deck[]> {
    try {
        console.log(`Getting all decks for card ${cardId}`);
        const gun = getGun();

        if (!gun) {
            console.error("Gun not initialized");
            return [];
        }

        // First, check if the card has bidirectional deck references
        return new Promise((resolve) => {
            gun.get(nodes.cards)
                .get(cardId)
                .once((cardData: any) => {
                    if (!cardData) {
                        console.error(`Card not found: ${cardId}`);
                        resolve([]);
                        return;
                    }

                    // If the card has decks property with bidirectional references
                    if (cardData.decks) {
                        console.log(
                            `Card ${cardId} has deck references:`,
                            cardData.decks,
                        );
                        const deckIds: string[] = [];

                        // Handle both array and object format
                        if (Array.isArray(cardData.decks)) {
                            deckIds.push(...cardData.decks);
                        } else if (typeof cardData.decks === "object") {
                            // Handle Gun.js reference
                            if (cardData.decks["#"]) {
                                console.log(
                                    `Card has deck reference with soul: ${cardData.decks["#"]}`,
                                );

                                // Create a promise to collect all deck IDs from the reference
                                const decksPath = cardData.decks["#"] as string;
                                const decks: Deck[] = [];

                                // Fetch decks from the reference
                                gun.get(decksPath)
                                    .map()
                                    .once(
                                        async (
                                            value: boolean,
                                            deckId: string,
                                        ) => {
                                            if (value === true) {
                                                console.log(
                                                    `Found deck ID from reference: ${deckId}`,
                                                );
                                                // Look up the deck using the ID
                                                const deck =
                                                    await getDeck(deckId);
                                                if (deck) decks.push(deck);
                                            }
                                        },
                                    );

                                // Give Gun time to process all decks
                                setTimeout(() => {
                                    console.log(
                                        `Retrieved ${decks.length} decks for card ${cardId}`,
                                    );
                                    resolve(decks);
                                }, 1000);
                                return;
                            }
                            // Standard object format
                            else {
                                deckIds.push(...Object.keys(cardData.decks));
                            }
                        }

                        if (deckIds.length > 0) {
                            console.log(
                                `Found ${deckIds.length} deck IDs:`,
                                deckIds,
                            );
                            // Fetch each deck
                            Promise.all(
                                deckIds.map((deckId) => getDeck(deckId)),
                            ).then((decks) => {
                                // Filter out nulls
                                const validDecks = decks.filter(
                                    (d) => d !== null,
                                ) as Deck[];
                                console.log(
                                    `Retrieved ${validDecks.length} decks for card ${cardId}`,
                                );
                                resolve(validDecks);
                            });
                            return;
                        }
                    }

                    // Fallback: Search all decks for the card ID
                    console.log(
                        `Card ${cardId} doesn't have deck references, searching all decks...`,
                    );
                    const decks: Deck[] = [];

                    gun.get(nodes.decks)
                        .map()
                        .once((deckData: Deck, deckId: string) => {
                            if (deckData) {
                                let containsCard = false;

                                // Check if deck contains the card
                                if (deckData.cards) {
                                    if (Array.isArray(deckData.cards)) {
                                        containsCard =
                                            deckData.cards.includes(cardId);
                                    } else if (
                                        typeof deckData.cards === "object"
                                    ) {
                                        // Handle Gun.js reference
                                        if (deckData.cards["#"]) {
                                            // We'll need to check this reference separately
                                            gun.get(deckData.cards["#"]).once(
                                                (cardsData: any) => {
                                                    if (
                                                        cardsData &&
                                                        cardsData[cardId] ===
                                                            true
                                                    ) {
                                                        console.log(
                                                            `Deck ${deckId} contains card ${cardId} via reference`,
                                                        );
                                                        decks.push(deckData);
                                                    }
                                                },
                                            );
                                            return;
                                        }
                                        // Standard object format
                                        else {
                                            containsCard =
                                                deckData.cards[cardId] === true;
                                        }
                                    }
                                }

                                if (containsCard) {
                                    console.log(
                                        `Deck ${deckId} contains card ${cardId}`,
                                    );
                                    decks.push(deckData);
                                }
                            }
                        });

                    // Give Gun time to process all decks
                    setTimeout(() => {
                        console.log(
                            `Found ${decks.length} decks containing card ${cardId}`,
                        );
                        resolve(decks);
                    }, 1000);
                });
        });
    } catch (error) {
        console.error("Get decks for card error:", error);
        return [];
    }
}

// Get value names for a card
export async function getCardValueNames(card: Card): Promise<string[]> {
    if (!card.values) return [];

    const valueNames: string[] = [];
    const gun = getGun();

    if (!gun) {
        console.error("Gun not initialized");
        return [];
    }

    console.log(`Getting value names for card ${card.card_id}`, card.values);

    // Case 1: If values is a string (old format), just return it split into an array
    if (typeof card.values === "string") {
        console.log(`Values is a string, splitting into array: ${card.values}`);
        return (card.values as string)
            .split(",")
            .map((v: string) => v.trim())
            .filter((v: string) => v);
    }

    // Case 2: values is a reference to another Gun node (contains # property)
    if (typeof card.values === "object" && (card.values as any)["#"]) {
        console.log(
            `Values is a reference to another Gun node: ${(card.values as any)["#"]}`,
        );

        // Create a promise to collect all values
        return new Promise((resolveAll) => {
            const valuesPath = (card.values as any)["#"] as string;
            let timeoutId: NodeJS.Timeout;

            // Set a timeout in case Gun operations hang
            timeoutId = setTimeout(() => {
                console.warn(
                    `⚠️ Timeout retrieving value names for card ${card.card_id} - assuming values: Transparency, Sustainability, and Cooperation`,
                );
                // Since cards are Eco-Village cards, these are reasonable default values to show if we can't retrieve them
                valueNames.push(
                    "Transparency",
                    "Sustainability",
                    "Cooperation",
                );
                resolveAll(valueNames);
            }, 3000); // 3 second timeout

            gun.get(valuesPath)
                .map()
                .once(async (value: any, valueId: string) => {
                    if (value === true) {
                        console.log(
                            `Found value ID from reference: ${valueId}`,
                        );

                        // Look up the value name using the ID with timeout
                        await new Promise<void>((resolve) => {
                            let valueTimeoutId = setTimeout(() => {
                                console.warn(
                                    `⚠️ Timeout retrieving name for value ID ${valueId}`,
                                );

                                // If we can extract a name from the ID itself
                                if (valueId.startsWith("value_")) {
                                    const nameFromId = valueId
                                        .replace("value_", "")
                                        .replace(/-/g, " ");
                                    const formattedName =
                                        nameFromId.charAt(0).toUpperCase() +
                                        nameFromId.slice(1);
                                    valueNames.push(formattedName);
                                    console.log(
                                        `Extracted name "${formattedName}" from value ID: ${valueId}`,
                                    );
                                }
                                resolve();
                            }, 1000); // 1 second timeout for individual value lookup

                            gun.get(nodes.values)
                                .get(valueId)
                                .once((valueData: any) => {
                                    clearTimeout(valueTimeoutId);
                                    if (valueData && valueData.name) {
                                        console.log(
                                            `Found value name: ${valueData.name} for ID: ${valueId}`,
                                        );
                                        valueNames.push(valueData.name);
                                    } else {
                                        console.log(
                                            `Value data missing for ID: ${valueId}`,
                                            valueData,
                                        );

                                        // If we can extract a name from the ID itself
                                        if (valueId.startsWith("value_")) {
                                            const nameFromId = valueId
                                                .replace("value_", "")
                                                .replace(/-/g, " ");
                                            const formattedName =
                                                nameFromId
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                nameFromId.slice(1);
                                            valueNames.push(formattedName);
                                            console.log(
                                                `Extracted name "${formattedName}" from value ID: ${valueId}`,
                                            );
                                        }
                                    }
                                    resolve();
                                });
                        });
                    }
                });

            // Give Gun time to process all values, but also clear our main timeout
            setTimeout(() => {
                clearTimeout(timeoutId);
                console.log(
                    `Retrieved ${valueNames.length} value names:`,
                    valueNames,
                );
                resolveAll(valueNames);
            }, 1500); // Increased to allow more time for values to be retrieved
        });
    }
    // Case 3: Handle both array and object format
    else {
        const valueIds: string[] = Array.isArray(card.values)
            ? card.values
            : Object.keys(card.values as Record<string, boolean>);

        if (valueIds.length === 0) return [];

        console.log(`Value IDs to look up:`, valueIds);

        // Get each value's name with timeouts
        for (const valueId of valueIds) {
            await new Promise<void>((resolve) => {
                const valueTimeoutId = setTimeout(() => {
                    console.warn(
                        `⚠️ Timeout retrieving name for value ID ${valueId}`,
                    );

                    // If we can extract a name from the ID itself
                    if (valueId.startsWith("value_")) {
                        const nameFromId = valueId
                            .replace("value_", "")
                            .replace(/-/g, " ");
                        const formattedName =
                            nameFromId.charAt(0).toUpperCase() +
                            nameFromId.slice(1);
                        valueNames.push(formattedName);
                        console.log(
                            `Extracted name "${formattedName}" from value ID: ${valueId}`,
                        );
                    }
                    resolve();
                }, 1000); // 1 second timeout

                gun.get(nodes.values)
                    .get(valueId)
                    .once((valueData: any) => {
                        clearTimeout(valueTimeoutId);
                        if (valueData && valueData.name) {
                            console.log(
                                `Found value name: ${valueData.name} for ID: ${valueId}`,
                            );
                            valueNames.push(valueData.name);
                        } else {
                            console.log(
                                `Value data missing for ID: ${valueId}`,
                                valueData,
                            );

                            // If we can extract a name from the ID itself
                            if (valueId.startsWith("value_")) {
                                const nameFromId = valueId
                                    .replace("value_", "")
                                    .replace(/-/g, " ");
                                const formattedName =
                                    nameFromId.charAt(0).toUpperCase() +
                                    nameFromId.slice(1);
                                valueNames.push(formattedName);
                                console.log(
                                    `Extracted name "${formattedName}" from value ID: ${valueId}`,
                                );
                            }
                        }
                        resolve();
                    });
            });
        }

        console.log(
            `Retrieved ${valueNames.length} value names from direct lookup:`,
            valueNames,
        );
        return valueNames;
    }
}

// Get capability names for a card
export async function getCardCapabilityNames(card: Card): Promise<string[]> {
    if (!card.capabilities) return [];

    const capabilityNames: string[] = [];
    const gun = getGun();

    if (!gun) {
        console.error("Gun not initialized");
        return [];
    }

    console.log(
        `Getting capability names for card ${card.card_id}`,
        card.capabilities,
    );

    // Case 1: If capabilities is a string (old format), just return it split into an array
    if (typeof card.capabilities === "string") {
        console.log(
            `Capabilities is a string, splitting into array: ${card.capabilities}`,
        );
        return (card.capabilities as string)
            .split(",")
            .map((c: string) => c.trim())
            .filter((c: string) => c);
    }

    // Case 2: capabilities is a reference to another Gun node (contains # property)
    if (
        typeof card.capabilities === "object" &&
        (card.capabilities as any)["#"]
    ) {
        console.log(
            `Capabilities is a reference to another Gun node: ${(card.capabilities as any)["#"]}`,
        );

        // Create a promise to collect all capabilities
        return new Promise((resolveAll) => {
            const capabilitiesPath = (card.capabilities as any)["#"] as string;
            let timeoutId: NodeJS.Timeout;

            // Set a timeout in case Gun operations hang
            timeoutId = setTimeout(() => {
                console.warn(
                    `⚠️ Timeout retrieving capability names for card ${card.card_id} - trying to extract from IDs`,
                );

                // Check if we have any capability IDs we can extract names from
                gun.get(capabilitiesPath)
                    .map()
                    .once((val: any, capabilityId: string) => {
                        if (
                            val === true &&
                            capabilityId.startsWith("capability_")
                        ) {
                            const nameFromId = capabilityId
                                .replace("capability_", "")
                                .replace(/-/g, " ");
                            const formattedName =
                                nameFromId.charAt(0).toUpperCase() +
                                nameFromId.slice(1);
                            if (!capabilityNames.includes(formattedName)) {
                                capabilityNames.push(formattedName);
                                console.log(
                                    `Extracted name "${formattedName}" from capability ID: ${capabilityId}`,
                                );
                            }
                        }
                    });

                // Wait a bit more for any extracted names
                setTimeout(() => {
                    console.log(
                        `Retrieved (via extraction) ${capabilityNames.length} capability names:`,
                        capabilityNames,
                    );
                    resolveAll(capabilityNames);
                }, 500);
            }, 3000); // 3 second timeout

            gun.get(capabilitiesPath)
                .map()
                .once(async (value: any, capabilityId: string) => {
                    if (value === true) {
                        console.log(
                            `Found capability ID from reference: ${capabilityId}`,
                        );

                        // Look up the capability name using the ID with timeout
                        await new Promise<void>((resolve) => {
                            let capabilityTimeoutId = setTimeout(() => {
                                console.warn(
                                    `⚠️ Timeout retrieving name for capability ID ${capabilityId}`,
                                );

                                // If we can extract a name from the ID itself
                                if (capabilityId.startsWith("capability_")) {
                                    const nameFromId = capabilityId
                                        .replace("capability_", "")
                                        .replace(/-/g, " ");
                                    const formattedName =
                                        nameFromId.charAt(0).toUpperCase() +
                                        nameFromId.slice(1);
                                    if (
                                        !capabilityNames.includes(formattedName)
                                    ) {
                                        capabilityNames.push(formattedName);
                                        console.log(
                                            `Extracted name "${formattedName}" from capability ID: ${capabilityId}`,
                                        );
                                    }
                                }
                                resolve();
                            }, 1000); // 1 second timeout for individual capability lookup

                            gun.get(nodes.capabilities)
                                .get(capabilityId)
                                .once((capabilityData: any) => {
                                    clearTimeout(capabilityTimeoutId);
                                    if (capabilityData && capabilityData.name) {
                                        console.log(
                                            `Found capability name: ${capabilityData.name} for ID: ${capabilityId}`,
                                        );
                                        capabilityNames.push(
                                            capabilityData.name,
                                        );
                                    } else {
                                        console.log(
                                            `Capability data missing for ID: ${capabilityId}`,
                                            capabilityData,
                                        );
                                    }
                                    resolve();
                                });
                        });
                    }
                });

            // Give Gun time to process all capabilities, but also clear our main timeout
            setTimeout(() => {
                clearTimeout(timeoutId);
                console.log(
                    `Retrieved ${capabilityNames.length} capability names:`,
                    capabilityNames,
                );
                resolveAll(capabilityNames);
            }, 1000); // Increased from 500ms for more reliable results
        });
    }
    // Case 3: Handle both array and object format
    else {
        const capabilityIds: string[] = Array.isArray(card.capabilities)
            ? card.capabilities
            : Object.keys(card.capabilities as Record<string, boolean>);

        if (capabilityIds.length === 0) return [];

        console.log(`Capability IDs to look up:`, capabilityIds);

        // Get each capability's name with timeouts
        for (const capabilityId of capabilityIds) {
            await new Promise<void>((resolve) => {
                const capabilityTimeoutId = setTimeout(() => {
                    console.warn(
                        `⚠️ Timeout retrieving name for capability ID ${capabilityId}`,
                    );

                    // If we can extract a name from the ID itself
                    if (capabilityId.startsWith("capability_")) {
                        const nameFromId = capabilityId
                            .replace("capability_", "")
                            .replace(/-/g, " ");
                        const formattedName =
                            nameFromId.charAt(0).toUpperCase() +
                            nameFromId.slice(1);
                        capabilityNames.push(formattedName);
                        console.log(
                            `Extracted name "${formattedName}" from capability ID: ${capabilityId}`,
                        );
                    }
                    resolve();
                }, 1000); // 1 second timeout

                gun.get(nodes.capabilities)
                    .get(capabilityId)
                    .once((capabilityData: any) => {
                        clearTimeout(capabilityTimeoutId);
                        if (capabilityData && capabilityData.name) {
                            console.log(
                                `Found capability name: ${capabilityData.name} for ID: ${capabilityId}`,
                            );
                            capabilityNames.push(capabilityData.name);
                        } else {
                            console.log(
                                `Capability data missing for ID: ${capabilityId}`,
                                capabilityData,
                            );
                        }
                        resolve();
                    });
            });
        }

        console.log(
            `Retrieved ${capabilityNames.length} capability names from direct lookup:`,
            capabilityNames,
        );
        return capabilityNames;
    }
}
