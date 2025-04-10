// Deck management service
import { getGun, nodes, generateId } from './gunService';
import type { Deck, Card } from '$lib/types';

// Get a deck by ID
export async function getDeck(deckId: string): Promise<Deck | null> {
    try {
        console.log(`Getting deck: ${deckId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.decks).get(deckId).once((deckData: Deck) => {
                if (!deckData) {
                    console.log(`Deck not found: ${deckId}`);
                    resolve(null);
                    return;
                }
                
                console.log(`Found deck: ${deckId}`, deckData);
                // Log cards information
                if (deckData.cards) {
                    if (Array.isArray(deckData.cards)) {
                        console.log(`Deck has ${deckData.cards.length} cards (array format):`, deckData.cards);
                    } else {
                        console.log(`Deck has ${Object.keys(deckData.cards).length} cards (object format):`, deckData.cards);
                    }
                } else {
                    console.log(`Deck ${deckId} has no cards property`);
                }
                
                resolve(deckData);
            });
        });
    } catch (error) {
        console.error('Get deck error:', error);
        return null;
    }
}

// Update a deck
export async function updateDeck(deckId: string, updates: Partial<Deck>): Promise<boolean> {
    try {
        console.log(`Updating deck: ${deckId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.decks).get(deckId).put(updates, (ack: any) => {
                if (ack.err) {
                    console.error('Error updating deck:', ack.err);
                    resolve(false);
                } else {
                    console.log(`Updated deck: ${deckId}`);
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('Update deck error:', error);
        return false;
    }
}

// Import the value and capability services
import { createOrGetValues } from './valueService';
import { createOrGetCapabilities } from './capabilityService';

// Create a new card
export async function createCard(card: Omit<Card, 'card_id'>): Promise<Card | null> {
    try {
        console.log('Creating new card');
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        const cardId = `card_${generateId()}`;
        
        // Ensure card_number is set and within valid range
        // If card_number is explicitly provided, use it as-is
        // Only generate random if completely missing
        if (card.card_number === undefined || card.card_number === null) {
            console.log('No card number provided, generating random number');
            card.card_number = Math.floor(Math.random() * 52) + 1;
        } else {
            // Convert to number if it's a string
            if (typeof card.card_number === 'string') {
                card.card_number = parseInt(card.card_number, 10);
            }
            console.log(`Using provided card number: ${card.card_number}`);
        }
        
        // Set default icon if not provided
        if (!card.icon) {
            // Set a default icon based on card category
            switch (card.card_category) {
                case 'Funders':
                    card.icon = 'CircleDollarSign';
                    break;
                case 'Providers':
                    card.icon = 'Hammer';
                    break;
                case 'Supporters':
                    card.icon = 'Heart';
                    break;
                default:
                    card.icon = 'User';
            }
        }
        
        // Process values: convert from array to record of value_id -> true
        let valuesRecord: Record<string, boolean> = {};
        
        // Handle values based on its type
        if (card.values) {
            if (Array.isArray(card.values)) {
                // Create value nodes and get their IDs
                valuesRecord = await createOrGetValues(card.values);
            } else if (typeof card.values === 'object') {
                // Already in the correct format
                valuesRecord = card.values as Record<string, boolean>;
            } else if (typeof card.values === 'string') {
                // Handle single string value
                const valueArray = (card.values as string).split(',').map((v: string) => v.trim()).filter((v: string) => v);
                valuesRecord = await createOrGetValues(valueArray);
            }
        }
        
        // Process goals: convert array to comma-separated strings for Gun.js
        const goalsStr = Array.isArray(card.goals) ? card.goals.join(',') : card.goals;
        
        // Process capabilities: convert from string to record of capability_id -> true
        let capabilitiesRecord: Record<string, boolean> = {};
        
        // Handle capabilities based on its type
        if (card.capabilities) {
            if (typeof card.capabilities === 'string') {
                // Create capability nodes from the string
                capabilitiesRecord = await createOrGetCapabilities(card.capabilities);
            } else if (Array.isArray(card.capabilities)) {
                // If passed as array, join and create capability nodes
                capabilitiesRecord = await createOrGetCapabilities(card.capabilities.join(', '));
            } else if (typeof card.capabilities === 'object') {
                // Already in the correct format
                capabilitiesRecord = card.capabilities as Record<string, boolean>;
            }
        }
        
        // Create a Gun.js compatible object (no arrays)
        const gunCompatibleCard = {
            card_id: cardId,
            card_number: card.card_number,
            role_title: card.role_title,
            backstory: card.backstory,
            values: valuesRecord, // Now a record of value_id -> true
            goals: goalsStr,
            obligations: card.obligations || '',
            capabilities: capabilitiesRecord, // Now a record of capability_id -> true
            intellectual_property: card.intellectual_property || '',
            rivalrous_resources: card.rivalrous_resources || '',
            card_category: card.card_category,
            type: card.type,
            icon: card.icon || 'User',
            decks: card.decks || {} // Initialize the decks object for bidirectional relationships
        };
        
        // For the return value (to match the interface), convert back to arrays if needed
        // We'll get the actual value/capability names later in the UI
        const cardData: Card = {
            card_id: cardId,
            card_number: card.card_number,
            role_title: card.role_title,
            backstory: card.backstory,
            values: valuesRecord, // We keep as Record in the interface now
            goals: Array.isArray(card.goals) ? card.goals : goalsStr.split(',').map(g => g.trim()).filter(g => g),
            obligations: card.obligations,
            capabilities: capabilitiesRecord, // We keep as Record in the interface now
            intellectual_property: card.intellectual_property,
            rivalrous_resources: card.rivalrous_resources,
            card_category: card.card_category,
            type: card.type,
            icon: card.icon,
            decks: card.decks || {} // Include the decks in the returned object
        };
        
        return new Promise((resolve) => {
            gun.get(nodes.cards).get(cardId).put(gunCompatibleCard, (ack: any) => {
                if (ack.err) {
                    console.error('Error creating card:', ack.err);
                    resolve(null);
                } else {
                    console.log(`Created card: ${cardId}`);
                    resolve(cardData);
                }
            });
        });
    } catch (error) {
        console.error('Create card error:', error);
        return null;
    }
}

// Add a card to a deck (bidirectional relationship)
export async function addCardToDeck(deckId: string, cardId: string): Promise<boolean> {
    try {
        console.log(`Adding card ${cardId} to deck ${deckId} with bidirectional relationship`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        // Get the current deck
        const deck = await getDeck(deckId);
        
        if (!deck) {
            console.error(`Deck not found: ${deckId}`);
            return false;
        }
        
        // Create or update the cards object in the deck
        let cards: Record<string, boolean> = {};
        
        if (deck.cards) {
            // Handle both array and object format
            if (Array.isArray(deck.cards)) {
                deck.cards.forEach(id => {
                    cards[id] = true;
                });
            } else {
                cards = { ...deck.cards };
            }
        }
        
        // Step 1: Add the card to the deck
        cards[cardId] = true;
        
        // Step 2: Also add the deck to the card's decks property (bidirectional)
        await new Promise<void>((resolve) => {
            // First check if the card exists and get its current decks
            gun.get(nodes.cards).get(cardId).once((cardData: any) => {
                if (!cardData) {
                    console.error(`Card not found: ${cardId}`);
                    resolve();
                    return;
                }
                
                console.log(`Found card: ${cardId}, adding deck reference`);
                
                // Create or update the decks object in the card
                let decks: Record<string, boolean> = {};
                
                if (cardData.decks) {
                    // Handle both array and object format
                    if (Array.isArray(cardData.decks)) {
                        cardData.decks.forEach((id: string) => {
                            decks[id] = true;
                        });
                    } else {
                        decks = { ...cardData.decks };
                    }
                }
                
                // Add the deck reference to the card
                decks[deckId] = true;
                
                // Update the card with the deck reference
                gun.get(nodes.cards).get(cardId).put({ decks }, (ack: any) => {
                    if (ack.err) {
                        console.error(`Error adding deck ${deckId} to card ${cardId}:`, ack.err);
                    } else {
                        console.log(`Added deck ${deckId} to card ${cardId}`);
                    }
                    resolve();
                });
            });
        });
        
        // Step 3: Update the deck with the card reference
        const updated = await updateDeck(deckId, { cards });
        
        return updated;
    } catch (error) {
        console.error('Add card to deck error:', error);
        return false;
    }
}

// Function to initialize bidirectional relationships for existing cards and decks
export async function initializeBidirectionalRelationships(): Promise<{success: boolean, processed: number}> {
    try {
        console.log('Initializing bidirectional relationships between cards and decks');
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return { success: false, processed: 0 };
        }
        
        let processedCount = 0;
        
        // Get all decks
        const decks: Record<string, Deck> = {};
        await new Promise<void>((resolve) => {
            gun.get(nodes.decks).map().once((deck: Deck, deckId: string) => {
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
            } else if (typeof deck.cards === 'object') {
                // Handle Gun.js reference
                if ((deck.cards as any)['#']) {
                    const cardsPath = (deck.cards as any)['#'] as string;
                    await new Promise<void>((resolve) => {
                        gun.get(cardsPath).map().once((value: boolean, cardId: string) => {
                            if (value === true) {
                                cardIds.push(cardId);
                            }
                        });
                        
                        // Give Gun time to process all cards
                        setTimeout(resolve, 500);
                    });
                } else {
                    // Standard object format
                    cardIds = Object.keys(deck.cards as Record<string, boolean>);
                }
            }
            
            console.log(`Processing ${cardIds.length} cards for deck ${deckId}`);
            
            // Update each card with a reference to this deck
            for (const cardId of cardIds) {
                await new Promise<void>((resolve) => {
                    gun.get(nodes.cards).get(cardId).once((cardData: any) => {
                        if (!cardData) {
                            console.log(`Card ${cardId} not found, skipping`);
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
                            } else if (typeof cardData.decks === 'object') {
                                // Handle Gun.js reference
                                if ((cardData.decks as any)['#']) {
                                    console.log(`Card ${cardId} has decks reference with soul: ${(cardData.decks as any)['#']}, will update there`);
                                    
                                    // Get the existing decks and add this deck
                                    const decksPath = (cardData.decks as any)['#'] as string;
                                    gun.get(decksPath).once((existingDecks: any) => {
                                        // Add this deck to the existing decks
                                        existingDecks[deckId] = true;
                                        
                                        // Update the decks node
                                        gun.get(decksPath).put(existingDecks, (ack: any) => {
                                            if (ack.err) {
                                                console.error(`Error updating decks for card ${cardId}:`, ack.err);
                                            } else {
                                                console.log(`Added deck ${deckId} to card ${cardId}'s decks reference`);
                                                processedCount++;
                                            }
                                            resolve();
                                        });
                                    });
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
                            gun.get(nodes.cards).get(cardId).put({ decks }, (ack: any) => {
                                if (ack.err) {
                                    console.error(`Error adding deck ${deckId} to card ${cardId}:`, ack.err);
                                } else {
                                    console.log(`Added deck ${deckId} to card ${cardId}`);
                                    processedCount++;
                                }
                                resolve();
                            });
                        } else {
                            console.log(`Deck ${deckId} already in card ${cardId}'s decks`);
                            resolve();
                        }
                    });
                });
            }
        }
        
        console.log(`Bidirectional relationships initialized for ${processedCount} card-deck pairs`);
        return {
            success: processedCount > 0,
            processed: processedCount
        };
    } catch (error) {
        console.error('Initialize bidirectional relationships error:', error);
        return {
            success: false,
            processed: 0
        };
    }
}

// Import multiple cards and add them to a deck
export async function importCardsToDeck(deckId: string, cardsData: Omit<Card, 'card_id'>[]): Promise<{success: boolean, added: number}> {
    try {
        console.log(`Importing ${cardsData.length} cards to deck ${deckId}`);
        let addedCount = 0;
        
        for (const cardData of cardsData) {
            const card = await createCard(cardData);
            
            if (card) {
                const added = await addCardToDeck(deckId, card.card_id);
                if (added) {
                    addedCount++;
                }
            }
        }
        
        return { 
            success: addedCount > 0, 
            added: addedCount 
        };
    } catch (error) {
        console.error('Import cards error:', error);
        return { success: false, added: 0 };
    }
}

// Get all decks that contain a specific card
export async function getDecksForCard(cardId: string): Promise<Deck[]> {
    try {
        console.log(`Getting all decks for card ${cardId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return [];
        }
        
        // First, check if the card has bidirectional deck references
        return new Promise((resolve) => {
            gun.get(nodes.cards).get(cardId).once((cardData: any) => {
                if (!cardData) {
                    console.error(`Card not found: ${cardId}`);
                    resolve([]);
                    return;
                }
                
                // If the card has decks property with bidirectional references
                if (cardData.decks) {
                    console.log(`Card ${cardId} has deck references:`, cardData.decks);
                    const deckIds: string[] = [];
                    
                    // Handle both array and object format
                    if (Array.isArray(cardData.decks)) {
                        deckIds.push(...cardData.decks);
                    } else if (typeof cardData.decks === 'object') {
                        // Handle Gun.js reference
                        if (cardData.decks['#']) {
                            console.log(`Card has deck reference with soul: ${cardData.decks['#']}`);
                            
                            // Create a promise to collect all deck IDs from the reference
                            const decksPath = cardData.decks['#'] as string;
                            const decks: Deck[] = [];
                            
                            // Fetch decks from the reference
                            gun.get(decksPath).map().once(async (value: boolean, deckId: string) => {
                                if (value === true) {
                                    console.log(`Found deck ID from reference: ${deckId}`);
                                    // Look up the deck using the ID
                                    const deck = await getDeck(deckId);
                                    if (deck) decks.push(deck);
                                }
                            });
                            
                            // Give Gun time to process all decks
                            setTimeout(() => {
                                console.log(`Retrieved ${decks.length} decks for card ${cardId}`);
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
                        console.log(`Found ${deckIds.length} deck IDs:`, deckIds);
                        // Fetch each deck
                        Promise.all(deckIds.map(deckId => getDeck(deckId)))
                            .then(decks => {
                                // Filter out nulls
                                const validDecks = decks.filter(d => d !== null) as Deck[];
                                console.log(`Retrieved ${validDecks.length} decks for card ${cardId}`);
                                resolve(validDecks);
                            });
                        return;
                    }
                }
                
                // Fallback: Search all decks for the card ID
                console.log(`Card ${cardId} doesn't have deck references, searching all decks...`);
                const decks: Deck[] = [];
                
                gun.get(nodes.decks).map().once((deckData: Deck, deckId: string) => {
                    if (deckData) {
                        let containsCard = false;
                        
                        // Check if deck contains the card
                        if (deckData.cards) {
                            if (Array.isArray(deckData.cards)) {
                                containsCard = deckData.cards.includes(cardId);
                            } else if (typeof deckData.cards === 'object') {
                                // Handle Gun.js reference
                                if (deckData.cards['#']) {
                                    // We'll need to check this reference separately
                                    gun.get(deckData.cards['#']).once((cardsData: any) => {
                                        if (cardsData && cardsData[cardId] === true) {
                                            console.log(`Deck ${deckId} contains card ${cardId} via reference`);
                                            decks.push(deckData);
                                        }
                                    });
                                    return;
                                }
                                // Standard object format
                                else {
                                    containsCard = deckData.cards[cardId] === true;
                                }
                            }
                        }
                        
                        if (containsCard) {
                            console.log(`Deck ${deckId} contains card ${cardId}`);
                            decks.push(deckData);
                        }
                    }
                });
                
                // Give Gun time to process all decks
                setTimeout(() => {
                    console.log(`Found ${decks.length} decks containing card ${cardId}`);
                    resolve(decks);
                }, 1000);
            });
        });
    } catch (error) {
        console.error('Get decks for card error:', error);
        return [];
    }
}

// Get value names for a card
export async function getCardValueNames(card: Card): Promise<string[]> {
    if (!card.values) return [];
    
    const valueNames: string[] = [];
    const gun = getGun();
    
    if (!gun) {
        console.error('Gun not initialized');
        return [];
    }
    
    console.log(`Getting value names for card ${card.card_id}`, card.values);
    
    // Case 1: values is a reference to another Gun node (contains # property)
    if (typeof card.values === 'object' && (card.values as any)['#']) {
        console.log(`Values is a reference to another Gun node: ${(card.values as any)['#']}`);
        
        // Create a promise to collect all values
        return new Promise((resolveAll) => {
            const valuesPath = (card.values as any)['#'] as string;
            
            gun.get(valuesPath).map().once(async (value: any, valueId: string) => {
                if (value === true) {
                    console.log(`Found value ID from reference: ${valueId}`);
                    
                    // Look up the value name using the ID
                    await new Promise<void>(resolve => {
                        gun.get(nodes.values).get(valueId).once((valueData: any) => {
                            if (valueData && valueData.name) {
                                console.log(`Found value name: ${valueData.name} for ID: ${valueId}`);
                                valueNames.push(valueData.name);
                            } else {
                                console.log(`Value data missing for ID: ${valueId}`, valueData);
                            }
                            resolve();
                        });
                    });
                }
            });
            
            // Give Gun time to process all values
            setTimeout(() => {
                console.log(`Retrieved ${valueNames.length} value names:`, valueNames);
                resolveAll(valueNames);
            }, 500);
        });
    }
    // Case 2: Handle both array and object format
    else {
        const valueIds: string[] = Array.isArray(card.values) 
            ? card.values 
            : Object.keys(card.values as Record<string, boolean>);
            
        if (valueIds.length === 0) return [];
        
        console.log(`Value IDs to look up:`, valueIds);
        
        // Get each value's name
        for (const valueId of valueIds) {
            await new Promise<void>(resolve => {
                gun.get(nodes.values).get(valueId).once((valueData: any) => {
                    if (valueData && valueData.name) {
                        console.log(`Found value name: ${valueData.name} for ID: ${valueId}`);
                        valueNames.push(valueData.name);
                    } else {
                        console.log(`Value data missing for ID: ${valueId}`, valueData);
                    }
                    resolve();
                });
            });
        }
        
        return valueNames;
    }
}

// Get capability names for a card
export async function getCardCapabilityNames(card: Card): Promise<string[]> {
    if (!card.capabilities) return [];
    
    const capabilityNames: string[] = [];
    const gun = getGun();
    
    if (!gun) {
        console.error('Gun not initialized');
        return [];
    }
    
    console.log(`Getting capability names for card ${card.card_id}`, card.capabilities);
    
    // Case 1: If capabilities is a string (old format), just return it split into an array
    if (typeof card.capabilities === 'string') {
        return (card.capabilities as string).split(',').map((c: string) => c.trim()).filter((c: string) => c);
    }
    
    // Case 2: capabilities is a reference to another Gun node (contains # property)
    if (typeof card.capabilities === 'object' && (card.capabilities as any)['#']) {
        console.log(`Capabilities is a reference to another Gun node: ${(card.capabilities as any)['#']}`);
        
        // Create a promise to collect all capabilities
        return new Promise((resolveAll) => {
            const capabilitiesPath = (card.capabilities as any)['#'] as string;
            
            gun.get(capabilitiesPath).map().once(async (value: any, capabilityId: string) => {
                if (value === true) {
                    console.log(`Found capability ID from reference: ${capabilityId}`);
                    
                    // Look up the capability name using the ID
                    await new Promise<void>(resolve => {
                        gun.get(nodes.capabilities).get(capabilityId).once((capabilityData: any) => {
                            if (capabilityData && capabilityData.name) {
                                console.log(`Found capability name: ${capabilityData.name} for ID: ${capabilityId}`);
                                capabilityNames.push(capabilityData.name);
                            } else {
                                console.log(`Capability data missing for ID: ${capabilityId}`, capabilityData);
                            }
                            resolve();
                        });
                    });
                }
            });
            
            // Give Gun time to process all capabilities
            setTimeout(() => {
                console.log(`Retrieved ${capabilityNames.length} capability names:`, capabilityNames);
                resolveAll(capabilityNames);
            }, 500);
        });
    }
    // Case 3: Handle both array and object format
    else {
        const capabilityIds: string[] = Array.isArray(card.capabilities) 
            ? card.capabilities 
            : Object.keys(card.capabilities as Record<string, boolean>);
            
        if (capabilityIds.length === 0) return [];
        
        console.log(`Capability IDs to look up:`, capabilityIds);
        
        // Get each capability's name
        for (const capabilityId of capabilityIds) {
            await new Promise<void>(resolve => {
                gun.get(nodes.capabilities).get(capabilityId).once((capabilityData: any) => {
                    if (capabilityData && capabilityData.name) {
                        console.log(`Found capability name: ${capabilityData.name} for ID: ${capabilityId}`);
                        capabilityNames.push(capabilityData.name);
                    } else {
                        console.log(`Capability data missing for ID: ${capabilityId}`, capabilityData);
                    }
                    resolve();
                });
            });
        }
        
        return capabilityNames;
    }
}