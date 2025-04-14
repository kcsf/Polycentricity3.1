import { getGun, nodes, generateId } from './gunService';
import { getCurrentUser } from './authService';
import type { Game, Actor, RoleAssignment } from '$lib/types';
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
                    games.push(gameData);
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
export async function getPlayerRole(gameId: string, userId: string): Promise<Actor | null> {
    try {
        console.log(`Getting role for user ${userId} in game ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return null;
        }
        
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
                
                console.log(`Got role for user ${userId} in game ${gameId}: ${actorData.role_title}`);
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
