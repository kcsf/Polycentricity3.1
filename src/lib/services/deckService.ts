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
                
                console.log(`Found deck: ${deckId}`);
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
            icon: card.icon || 'User'
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
            icon: card.icon
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

// Add a card to a deck
export async function addCardToDeck(deckId: string, cardId: string): Promise<boolean> {
    try {
        console.log(`Adding card ${cardId} to deck ${deckId}`);
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
        
        // Create or update the cards object
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
        
        // Add the new card
        cards[cardId] = true;
        
        // Update the deck
        return updateDeck(deckId, { cards });
    } catch (error) {
        console.error('Add card to deck error:', error);
        return false;
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

// Get value names for a card
export async function getCardValueNames(card: Card): Promise<string[]> {
    if (!card.values) return [];
    
    const valueNames: string[] = [];
    const gun = getGun();
    
    if (!gun) {
        console.error('Gun not initialized');
        return [];
    }
    
    // Handle both array and object format
    const valueIds: string[] = Array.isArray(card.values) 
        ? card.values 
        : Object.keys(card.values as Record<string, boolean>);
        
    if (valueIds.length === 0) return [];
    
    // Get each value's name
    for (const valueId of valueIds) {
        await new Promise<void>(resolve => {
            gun.get(nodes.values).get(valueId).once((valueData: any) => {
                if (valueData && valueData.name) {
                    valueNames.push(valueData.name);
                }
                resolve();
            });
        });
    }
    
    return valueNames;
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
    
    // If capabilities is a string (old format), just return it split into an array
    if (typeof card.capabilities === 'string') {
        return (card.capabilities as string).split(',').map((c: string) => c.trim()).filter((c: string) => c);
    }
    
    // Handle both array and object format
    const capabilityIds: string[] = Array.isArray(card.capabilities) 
        ? card.capabilities 
        : Object.keys(card.capabilities as Record<string, boolean>);
        
    if (capabilityIds.length === 0) return [];
    
    // Get each capability's name
    for (const capabilityId of capabilityIds) {
        await new Promise<void>(resolve => {
            gun.get(nodes.capabilities).get(capabilityId).once((capabilityData: any) => {
                if (capabilityData && capabilityData.name) {
                    capabilityNames.push(capabilityData.name);
                }
                resolve();
            });
        });
    }
    
    return capabilityNames;
}