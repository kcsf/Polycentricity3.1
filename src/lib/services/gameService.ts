import { getGun, nodes, generateId, createRelationship } from './gunService';
import { getCurrentUser } from './authService';
import type { Game, Actor, Card } from '$lib/types';
import { GameStatus } from '$lib/types';
import { currentGameStore, setUserGames } from '$lib/stores/gameStore';
import { get } from 'svelte/store';
import { getPredefinedDeck } from '$lib/data/predefinedDecks';

// Create a new game
export async function createGame(
    name: string, 
    deckType: string, 
    roleAssignmentType: string = 'random'
): Promise<Game | null> {
    try {
        console.log(`Creating game: ${name} with deck type: ${deckType} and role assignment: ${roleAssignmentType}`);
        const gun = getGun();
        let currentUser = getCurrentUser();
        
        // For development: create a mock user if no real user is authenticated
        if (!currentUser) {
            console.warn('No authenticated user found. Using mock user for development.');
            currentUser = {
                user_id: 'dev-user-' + Date.now(),
                name: 'Development User',
                email: 'dev@example.com',
                created_at: Date.now()
            };
        }
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        const game_id = generateId();
        const gameData: Game = {
            game_id,
            name,
            creator: currentUser.user_id,
            deck_type: deckType,
            deck: {}, // Will be populated later as an object, not array
            role_assignment: {}, // Will be populated as players join
            role_assignment_type: roleAssignmentType, // 'random' or 'player-choice'
            players: {[currentUser.user_id]: true}, // Creator is the first player, stored as object key
            created_at: Date.now(),
            status: GameStatus.CREATED
        };
        
        // Create game in a more structured way to avoid Gun.js issues
        return new Promise((resolve, reject) => {
            try {
                // First add basic game info
                gun.get(nodes.games).get(game_id).put({
                    game_id,
                    name,
                    creator: currentUser.user_id,
                    deck_type: deckType,
                    role_assignment_type: roleAssignmentType,
                    created_at: Date.now(),
                    status: GameStatus.CREATED
                }, (ack: any) => {
                    if (ack.err) {
                        console.error('Error creating game basic info:', ack.err);
                        reject(ack.err);
                        return;
                    }
                    
                    // Then add players separately - using object instead of array to avoid Gun.js issues
                    gun.get(nodes.games).get(game_id).get('players').put({[currentUser.user_id]: true}, (ack: any) => {
                        if (ack.err) {
                            console.error('Error adding player to game:', ack.err);
                            reject(ack.err);
                            return;
                        }
                        
                        // Then add empty deck (as object) and role assignment
                        gun.get(nodes.games).get(game_id).get('deck').put({}, (ack: any) => {
                            if (ack.err) {
                                console.error('Error adding deck to game:', ack.err);
                                reject(ack.err);
                                return;
                            }
                            
                            gun.get(nodes.games).get(game_id).get('role_assignment').put({}, async (ack: any) => {
                                if (ack.err) {
                                    console.error('Error adding role assignment to game:', ack.err);
                                    reject(ack.err);
                                    return;
                                }
                                
                                // Now add predefined deck if using a predefined deck type
                                if (deckType === 'eco-village' || deckType === 'community-garden') {
                                    try {
                                        const actors = getPredefinedDeck(deckType);
                                        const success = await setGameActors(game_id, actors);
                                        if (!success) {
                                            console.warn(`Failed to set predefined deck for game ${game_id}, but game was created`);
                                        }
                                    } catch (err) {
                                        console.warn(`Error setting predefined deck: ${err}, but game was created`);
                                    }
                                }
                                
                                // Create explicit relationships for visualization in the admin graph
                                try {
                                    // Create user-to-game relationship
                                    gun.get(nodes.users).get(currentUser.user_id).get('games').set(game_id);
                                    
                                    // Create game-to-user (creator) relationship
                                    gun.get(nodes.games).get(game_id).get('creator_ref').put({
                                        '#': `${nodes.users}/${currentUser.user_id}`
                                    });
                                    
                                    // Create game-to-deck relationship if using a predefined deck
                                    if (deckType === 'eco-village' || deckType === 'community-garden') {
                                        const deckId = deckType === 'eco-village' ? 'd1' : 'd2';
                                        gun.get(nodes.games).get(game_id).get('deck_ref').put({
                                            '#': `${nodes.decks}/${deckId}`
                                        });
                                    }
                                    
                                    console.log(`Created graph relationships for game ${game_id}`);
                                } catch (err) {
                                    console.warn(`Error creating graph relationships: ${err}, but game was created`);
                                }
                                
                                console.log(`Game created: ${game_id}`);
                                resolve(gameData);
                            });
                        });
                    });
                });
            } catch (error) {
                console.error('Error in game creation process:', error);
                reject(error);
            }
        });
    } catch (error) {
        console.error('Create game error:', error);
        return null;
    }
}

// Get a game by ID
export async function getGame(gameId: string): Promise<Game | null> {
    try {
        console.log(`Getting game: ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.games).get(gameId).once((gameData: Game) => {
                if (!gameData) {
                    console.log(`Game not found: ${gameId}`);
                    resolve(null);
                    return;
                }
                
                console.log(`Game retrieved: ${gameId}`);
                resolve(gameData);
            });
        });
    } catch (error) {
        console.error('Get game error:', error);
        return null;
    }
}

// Get all games
export async function getAllGames(): Promise<Game[]> {
    try {
        console.log('Getting all games');
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return [];
        }
        
        return new Promise((resolve) => {
            const games: Game[] = [];
            gun.get(nodes.games).map().once((gameData: Game, gameId: string) => {
                if (gameData && gameId !== '_') {
                    // Ensure the game_id is included in the gameData 
                    // This fixes duplicate key issues when using game_id as a key in loops
                    games.push({
                        ...gameData,
                        game_id: gameId // Add or overwrite with the actual ID from Gun
                    });
                }
            });
            
            // Use setTimeout to give Gun time to fetch data (not ideal but functional for now)
            setTimeout(() => {
                console.log(`Retrieved ${games.length} games`);
                resolve(games);
            }, 500);
        });
    } catch (error) {
        console.error('Get all games error:', error);
        return [];
    }
}

// Join a game
export async function joinGame(gameId: string): Promise<boolean> {
    try {
        console.log(`Joining game: ${gameId}`);
        const gun = getGun();
        const currentUser = getCurrentUser();
        
        if (!gun || !currentUser) {
            console.error('Gun or user not initialized');
            return false;
        }
        
        const game = await getGame(gameId);
        if (!game) {
            console.error(`Game not found: ${gameId}`);
            return false;
        }
        
        // Check if user is already in the game
        const playersObj = game.players as Record<string, boolean>;
        if (playersObj && playersObj[currentUser.user_id]) {
            console.log(`User already in game: ${gameId}`);
            return true;
        }
        
        // Add user to the game object
        const updatedPlayers = { ...(playersObj || {}), [currentUser.user_id]: true };
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.games).get(gameId).get('players').put(updatedPlayers, (ack: any) => {
                if (ack.err) {
                    console.error('Error joining game:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                console.log(`Joined game: ${gameId}`);
                
                // Create explicit relationships for visualization in the admin graph
                try {
                    // Create user-to-game relationship
                    gun.get(nodes.users).get(currentUser.user_id).get('games').set(gameId);
                    
                    // Create game-to-players relationship
                    gun.get(nodes.games).get(gameId).get('player_refs').set({
                        '#': `${nodes.users}/${currentUser.user_id}`
                    });
                    
                    console.log(`Created graph relationships for player ${currentUser.user_id} joining game ${gameId}`);
                } catch (err) {
                    console.warn(`Error creating graph relationships: ${err}, but user joined game`);
                }
                
                resolve(true);
            });
        });
    } catch (error) {
        console.error('Join game error:', error);
        return false;
    }
}

// Leave a game
export async function leaveGame(gameId: string): Promise<boolean> {
    try {
        console.log(`Leaving game: ${gameId}`);
        const gun = getGun();
        const currentUser = getCurrentUser();
        
        if (!gun || !currentUser) {
            console.error('Gun or user not initialized');
            return false;
        }
        
        const game = await getGame(gameId);
        if (!game) {
            console.error(`Game not found: ${gameId}`);
            return false;
        }
        
        // Remove user from the game object
        const playersObj = game.players as Record<string, boolean>;
        const updatedPlayers = { ...playersObj };
        delete updatedPlayers[currentUser.user_id];
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.games).get(gameId).get('players').put(updatedPlayers, (ack: any) => {
                if (ack.err) {
                    console.error('Error leaving game:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                console.log(`Left game: ${gameId}`);
                resolve(true);
            });
        });
    } catch (error) {
        console.error('Leave game error:', error);
        return false;
    }
}

// Assign role to a player
export async function assignRole(gameId: string, userId: string, actorId: string): Promise<boolean> {
    try {
        console.log(`Assigning role ${actorId} to user ${userId} in game ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        const game = await getGame(gameId);
        if (!game) {
            console.error(`Game not found: ${gameId}`);
            return false;
        }
        
        // Update role assignment
        const roleAssignment = { ...game.role_assignment, [userId]: actorId };
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.games).get(gameId).get('role_assignment').put(roleAssignment, (ack: any) => {
                if (ack.err) {
                    console.error('Error assigning role:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                console.log(`Role assigned: ${actorId} to ${userId} in game ${gameId}`);
                resolve(true);
            });
        });
    } catch (error) {
        console.error('Assign role error:', error);
        return false;
    }
}

// Get a player's role in a game
export async function getPlayerRole(gameId: string, userId: string, specifiedActorId?: string): Promise<Actor | null> {
    try {
        console.log(`Getting role for user ${userId} in game ${gameId}${specifiedActorId ? ` with actorId: ${specifiedActorId}` : ''}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        // If a specific actorId is provided, use it directly
        if (specifiedActorId) {
            return new Promise((resolve) => {
                gun.get(nodes.actors).get(specifiedActorId).once((actorData: Actor) => {
                    if (!actorData) {
                        console.log(`Specified actor not found: ${specifiedActorId}`);
                        resolve(null);
                        return;
                    }
                    
                    console.log(`Got role using specified actorId for user ${userId} in game ${gameId}`);
                    resolve(actorData);
                });
            });
        }
        
        // Otherwise look up the actorId from game's role_assignment
        const game = await getGame(gameId);
        if (!game || !game.role_assignment) {
            console.error(`Game not found or no role assignments: ${gameId}`);
            return null;
        }
        
        const actorId = game.role_assignment[userId];
        if (!actorId) {
            console.log(`No role assigned to user ${userId} in game ${gameId}`);
            return null;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
                if (!actorData) {
                    console.log(`Actor not found: ${actorId}`);
                    resolve(null);
                    return;
                }
                
                console.log(`Got role for user ${userId} in game ${gameId}: ${actorData.name || actorData.actor_id}`);
                resolve(actorData);
            });
        });
    } catch (error) {
        console.error('Get player role error:', error);
        return null;
    }
}

// Update game status
export async function updateGameStatus(gameId: string, status: GameStatus): Promise<boolean> {
    try {
        console.log(`Updating game ${gameId} status to ${status}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.games).get(gameId).get('status').put(status, (ack: any) => {
                if (ack.err) {
                    console.error('Error updating game status:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                console.log(`Game ${gameId} status updated to ${status}`);
                resolve(true);
            });
        });
    } catch (error) {
        console.error('Update game status error:', error);
        return false;
    }
}

// Subscribe to a game's changes
export function subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
    try {
        console.log(`Subscribing to game: ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return () => {};
        }
        
        const subscription = gun.get(nodes.games).get(gameId).on((gameData: Game) => {
            if (gameData) {
                callback(gameData);
            }
        });
        
        return () => {
            console.log(`Unsubscribing from game: ${gameId}`);
            subscription.off();
        };
    } catch (error) {
        console.error('Subscribe to game error:', error);
        return () => {};
    }
}

// Set initial actor/role cards for the game
export async function setGameActors(gameId: string, actors: Actor[]): Promise<boolean> {
    try {
        console.log(`Setting actors for game ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        // Save each actor
        for (const actor of actors) {
            await new Promise<void>((resolve, reject) => {
                gun.get(nodes.actors).get(actor.actor_id).put(actor, (ack: any) => {
                    if (ack.err) {
                        console.error(`Error saving actor ${actor.actor_id}:`, ack.err);
                        reject(ack.err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        
        // Add actor IDs to game's deck as object (not array)
        const deckObj: Record<string, boolean> = {};
        actors.forEach(actor => {
            deckObj[actor.actor_id] = true;
        });
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.games).get(gameId).get('deck').put(deckObj, (ack: any) => {
                if (ack.err) {
                    console.error('Error setting game actors:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                console.log(`Actors set for game ${gameId}`);
                
                // Create explicit relationships for visualization in the admin graph
                try {
                    // Create game-to-actor relationships for each actor
                    for (const actor of actors) {
                        // Game references actor
                        gun.get(nodes.games).get(gameId).get('actor_refs').set({
                            '#': `${nodes.actors}/${actor.actor_id}`
                        });
                        
                        // Actor references game
                        gun.get(nodes.actors).get(actor.actor_id).get('game_refs').set({
                            '#': `${nodes.games}/${gameId}`
                        });
                    }
                    
                    console.log(`Created graph relationships between game ${gameId} and its actors`);
                } catch (err) {
                    console.warn(`Error creating actor graph relationships: ${err}, but actors were set`);
                }
                
                resolve(true);
            });
        });
    } catch (error) {
        console.error('Set game actors error:', error);
        return false;
    }
}

// Get user's games (games they are part of)
export async function getUserGames(): Promise<Game[]> {
    try {
        console.log('Getting user games');
        let currentUser = getCurrentUser();
        
        // For development: create a mock user if no real user is authenticated
        if (!currentUser) {
            console.warn('No authenticated user found. Using mock user for development.');
            currentUser = {
                user_id: 'dev-user-' + Date.now(),
                name: 'Development User',
                email: 'dev@example.com',
                created_at: Date.now()
            };
        }
        
        const allGames = await getAllGames();
        const userGames = allGames.filter(game => {
            if (Array.isArray(game.players)) {
                return game.players.includes(currentUser.user_id);
            } else {
                const playersObj = game.players as Record<string, boolean>;
                return playersObj && playersObj[currentUser.user_id];
            }
        });
        
        console.log(`Retrieved ${userGames.length} games for user ${currentUser.user_id}`);
        return userGames;
    } catch (error) {
        console.error('Get user games error:', error);
        return [];
    }
}

/**
 * Fixes relationships for existing games to ensure they appear correctly in the graph visualization
 * This creates explicit relationships between games and their related entities (users, decks, actors)
 */
// Get available cards for a game (cards not yet assigned to players)
export async function getAvailableCardsForGame(gameId: string): Promise<Card[]> {
    try {
        console.log(`Getting available cards for game: ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return [];
        }
        
        const game = await getGame(gameId);
        if (!game) {
            console.error(`Game not found: ${gameId}`);
            return [];
        }
        
        // Get all cards in the game's deck
        let deckId = '';
        if (game.deck_type === 'eco-village') {
            deckId = 'd1';
        } else if (game.deck_type === 'community-garden') {
            deckId = 'd2';
        } else if (game.deck_id) {
            deckId = game.deck_id;
        }
        
        if (!deckId) {
            console.error(`No deck found for game ${gameId}`);
            return [];
        }
        
        // Get all cards in the deck
        return new Promise((resolve) => {
            const cards: Card[] = [];
            const usedCardIds = new Set<string>();
            
            // First, check which cards are already in use by getting all actors in this game
            gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
                if (actorData && actorData.game_id === gameId && actorData.card_id) {
                    usedCardIds.add(actorData.card_id);
                }
            });
            
            // Then get all cards in the deck, filtering out used ones
            setTimeout(() => {
                gun.get(nodes.decks).get(deckId).get('cards').map().once((cardValue: any, cardId: string) => {
                    if (cardValue && cardId !== '_' && !usedCardIds.has(cardId)) {
                        // Fetch the card details
                        gun.get(nodes.cards).get(cardId).once((cardData: Card) => {
                            if (cardData) {
                                cards.push(cardData);
                            }
                        });
                    }
                });
                
                // Give Gun time to fetch the card data
                setTimeout(() => {
                    console.log(`Found ${cards.length} available cards for game ${gameId}`);
                    resolve(cards);
                }, 500);
            }, 500);
        });
    } catch (error) {
        console.error('Get available cards error:', error);
        return [];
    }
}

// Get a specific card by ID
export async function getCard(cardId: string): Promise<Card | null> {
    try {
        // Getting card by ID
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.cards).get(cardId).once((cardData: Card) => {
                if (!cardData) {
                    console.log(`Card not found: ${cardId}`);
                    resolve(null);
                    return;
                }
                
                console.log(`Card retrieved: ${cardId}`);
                resolve(cardData);
            });
        });
    } catch (error) {
        console.error('Get card error:', error);
        return null;
    }
}

// Create a new actor for a user in a game
export async function createActor(
    gameId: string, 
    cardId: string, 
    actorType: 'National Identity' | 'Sovereign Identity',
    customName?: string
): Promise<Actor | null> {
    try {
        console.log(`Creating actor in game ${gameId} with card ${cardId}`);
        const gun = getGun();
        const currentUser = getCurrentUser();
        
        if (!gun || !currentUser) {
            console.error('Gun or user not initialized');
            return null;
        }
        
        const game = await getGame(gameId);
        if (!game) {
            console.error(`Game not found: ${gameId}`);
            return null;
        }
        
        // Check if user is already in the game players
        const playersObj = game.players as Record<string, boolean>;
        if (!playersObj || !playersObj[currentUser.user_id]) {
            // Add user to game players first
            const success = await joinGame(gameId);
            if (!success) {
                console.error(`Failed to join game ${gameId}`);
                return null;
            }
        }
        
        // Create actor
        const actorId = generateId();
        const actor: Actor = {
            actor_id: actorId,
            game_id: gameId,
            user_id: currentUser.user_id,
            card_id: cardId,
            created_at: Date.now(),
            custom_name: customName,
            actor_type: actorType,
            status: 'active',
            agreements: {}
        };
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.actors).get(actorId).put(actor, async (ack: any) => {
                if (ack.err) {
                    console.error('Error creating actor:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                try {
                    // Update game role_assignment
                    await assignRole(gameId, currentUser.user_id, actorId);
                    
                    // Create explicit relationships for visualization
                    // 1. User to Actor relationship
                    createRelationship(`${nodes.users}/${currentUser.user_id}`, 'actors', `${nodes.actors}/${actorId}`);
                    
                    // 2. Actor to Card relationship
                    createRelationship(`${nodes.actors}/${actorId}`, 'card', `${nodes.cards}/${cardId}`);
                    
                    // 3. Actor to Game relationship
                    createRelationship(`${nodes.actors}/${actorId}`, 'game', `${nodes.games}/${gameId}`);
                    
                    // 4. Add to game chat participants
                    gun.get(nodes.chat).get(`${gameId}_group`).get('participants').set(currentUser.user_id);
                    
                    console.log(`Actor created: ${actorId} for user ${currentUser.user_id} in game ${gameId}`);
                    resolve(actor);
                } catch (err) {
                    console.warn(`Error creating relationships: ${err}, but actor was created`);
                    resolve(actor);
                }
            });
        });
    } catch (error) {
        console.error('Create actor error:', error);
        return null;
    }
}

// Get a user's actors from all games
export async function getUserActors(userId?: string): Promise<Actor[]> {
    try {
        const gun = getGun();
        const currentUser = getCurrentUser();
        
        if (!gun) {
            console.error('Gun not initialized');
            return [];
        }
        
        // If userId is not provided, use current user's ID
        const userToCheck = userId || (currentUser?.user_id);
        
        if (!userToCheck) {
            console.warn('No user ID available. Using mock user ID for development.');
            return [];
        }
        
        console.log(`Getting actors for user: ${userToCheck}`);
        
        return new Promise((resolve) => {
            const actors: Actor[] = [];
            gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
                if (actorData && actorData.user_id === userToCheck) {
                    actors.push({...actorData, actor_id: actorId});
                }
            });
            
            // Use setTimeout to give Gun time to fetch data
            setTimeout(() => {
                console.log(`Found ${actors.length} actors for user ${userToCheck}`);
                resolve(actors);
            }, 500);
        });
    } catch (error) {
        console.error('Get user actors error:', error);
        return [];
    }
}

// Get all actors for a specific game
export async function getGameActors(gameId: string): Promise<Actor[]> {
    try {
        console.log(`Getting actors for game: ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return [];
        }
        
        return new Promise((resolve) => {
            const actors: Actor[] = [];
            gun.get(nodes.actors).map().once((actorData: Actor, actorId: string) => {
                if (actorData && actorData.game_id === gameId) {
                    actors.push({...actorData, actor_id: actorId});
                }
            });
            
            // Use setTimeout to give Gun time to fetch data
            setTimeout(() => {
                console.log(`Found ${actors.length} actors for game ${gameId}`);
                resolve(actors);
            }, 500);
        });
    } catch (error) {
        console.error('Get game actors error:', error);
        return [];
    }
}

// Assign a card to an actor randomly or by choice
export async function assignCardToActor(gameId: string, actorId: string, cardId?: string): Promise<boolean> {
    try {
        console.log(`Assigning card to actor ${actorId} in game ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        const game = await getGame(gameId);
        if (!game) {
            console.error(`Game not found: ${gameId}`);
            return false;
        }
        
        // If cardId is not provided, assign a random card
        let finalCardId = cardId;
        if (!finalCardId) {
            const availableCards = await getAvailableCardsForGame(gameId);
            if (availableCards.length === 0) {
                console.error('No available cards to assign');
                return false;
            }
            
            // Pick a random card
            const randomIndex = Math.floor(Math.random() * availableCards.length);
            finalCardId = availableCards[randomIndex].card_id;
        }
        
        if (!finalCardId) {
            console.error('No card ID available to assign');
            return false;
        }
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.actors).get(actorId).get('card_id').put(finalCardId, (ack: any) => {
                if (ack.err) {
                    console.error('Error assigning card to actor:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                // Create explicit relationship for visualization
                createRelationship(`${nodes.actors}/${actorId}`, 'card', `${nodes.cards}/${finalCardId}`);
                
                console.log(`Card ${finalCardId} assigned to actor ${actorId}`);
                resolve(true);
            });
        });
    } catch (error) {
        console.error('Assign card error:', error);
        return false;
    }
}

// Check if a game is full (reached max_players)
export async function isGameFull(gameId: string): Promise<boolean> {
    try {
        console.log(`Checking if game ${gameId} is full`);
        const game = await getGame(gameId);
        
        if (!game) {
            console.error(`Game not found: ${gameId}`);
            return false;
        }
        
        // If max_players is not set, game is never full
        if (!game.max_players) {
            return false;
        }
        
        const playersObj = game.players as Record<string, boolean>;
        const playerCount = playersObj ? Object.keys(playersObj).length : 0;
        
        const isFull = playerCount >= game.max_players;
        console.log(`Game ${gameId} has ${playerCount}/${game.max_players} players. Full: ${isFull}`);
        return isFull;
    } catch (error) {
        console.error('Check if game is full error:', error);
        return false;
    }
}

export async function fixGameRelationships(): Promise<{success: boolean, gamesFixed: number}> {
    try {
        console.log('Fixing game relationships for visualization');
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return {success: false, gamesFixed: 0};
        }
        
        const allGames = await getAllGames();
        let gamesFixed = 0;
        
        for (const game of allGames) {
            try {
                // Create relationships for each game
                if (game.creator) {
                    // Game references creator
                    gun.get(nodes.games).get(game.game_id).get('creator_ref').put({
                        '#': `${nodes.users}/${game.creator}`
                    });
                    
                    // User references game
                    gun.get(nodes.users).get(game.creator).get('games').set(game.game_id);
                }
                
                // Game references deck
                if (game.deck_type) {
                    const deckId = game.deck_type === 'eco-village' ? 'd1' : 'd2';
                    gun.get(nodes.games).get(game.game_id).get('deck_ref').put({
                        '#': `${nodes.decks}/${deckId}`
                    });
                }
                
                // Add relationships for each player
                if (game.players) {
                    const players = Array.isArray(game.players) 
                        ? game.players 
                        : Object.keys(game.players as Record<string, boolean>);
                        
                    for (const playerId of players) {
                        // Skip if playerId is just the Gun metadata property '_'
                        if (playerId === '_') continue;
                        
                        // Create user-to-game relationship
                        gun.get(nodes.users).get(playerId).get('games').set(game.game_id);
                        
                        // Create game-to-player relationship
                        gun.get(nodes.games).get(game.game_id).get('player_refs').set({
                            '#': `${nodes.users}/${playerId}`
                        });
                    }
                }
                
                // Fix relationships for actors/roles if they exist
                // Safely access the game.roles property (previously was incorrectly "deck")
                const roles = game.roles || (game as any).deck;
                
                if (roles && typeof roles === 'object') {
                    // Filter out internal Gun.js properties
                    const actorIds = Object.keys(roles).filter(key => key !== '_');
                    
                    for (const actorId of actorIds) {
                        // Game references actor
                        gun.get(nodes.games).get(game.game_id).get('actor_refs').set({
                            '#': `${nodes.actors}/${actorId}`
                        });
                        
                        // Actor references game
                        gun.get(nodes.actors).get(actorId).get('game_refs').set({
                            '#': `${nodes.games}/${game.game_id}`
                        });
                    }
                }
                
                gamesFixed++;
            } catch (error) {
                console.warn(`Error fixing relationships for game ${game.game_id}:`, error);
            }
        }
        
        console.log(`Fixed relationships for ${gamesFixed} games`);
        return {success: true, gamesFixed};
    } catch (error) {
        console.error('Fix game relationships error:', error);
        return {success: false, gamesFixed: 0};
    }
}
