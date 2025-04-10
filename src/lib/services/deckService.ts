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
        
        const cardData: Card = {
            card_id: cardId,
            ...card
        };
        
        return new Promise((resolve) => {
            gun.get(nodes.cards).get(cardId).put(cardData, (ack: any) => {
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