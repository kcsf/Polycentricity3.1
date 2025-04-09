import { getGun, nodes, generateId } from './gunService';
import { getCurrentUser } from './authService';
import type { Game, Actor, RoleAssignment } from '$lib/types';
import { GameStatus } from '$lib/types';
import { gameStore } from '$lib/stores/gameStore';
import { get } from 'svelte/store';

// Create a new game
export async function createGame(name: string, deckType: string): Promise<Game | null> {
    try {
        console.log(`Creating game: ${name}`);
        const gun = getGun();
        const currentUser = getCurrentUser();
        
        if (!gun || !currentUser) {
            console.error('Gun or user not initialized');
            return null;
        }
        
        const game_id = generateId();
        const gameData: Game = {
            game_id,
            name,
            creator: currentUser.user_id,
            deck_type: deckType,
            deck: [], // Will be populated later
            role_assignment: {}, // Will be populated as players join
            players: [currentUser.user_id], // Creator is the first player
            created_at: Date.now(),
            status: GameStatus.CREATED
        };
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.games).get(game_id).put(gameData, (ack: any) => {
                if (ack.err) {
                    console.error('Error creating game:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                console.log(`Game created: ${game_id}`);
                resolve(gameData);
            });
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
        if (game.players.includes(currentUser.user_id)) {
            console.log(`User already in game: ${gameId}`);
            return true;
        }
        
        // Add user to the game
        const updatedPlayers = [...game.players, currentUser.user_id];
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.games).get(gameId).get('players').put(updatedPlayers, (ack: any) => {
                if (ack.err) {
                    console.error('Error joining game:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                console.log(`Joined game: ${gameId}`);
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
        
        // Remove user from the game
        const updatedPlayers = game.players.filter(id => id !== currentUser.user_id);
        
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
        
        // Add actor IDs to game's deck
        const actorIds = actors.map(actor => actor.actor_id);
        
        return new Promise((resolve, reject) => {
            gun.get(nodes.games).get(gameId).get('deck').put(actorIds, (ack: any) => {
                if (ack.err) {
                    console.error('Error setting game actors:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                console.log(`Actors set for game ${gameId}`);
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
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
            console.error('User not initialized');
            return [];
        }
        
        const allGames = await getAllGames();
        const userGames = allGames.filter(game => game.players.includes(currentUser.user_id));
        
        console.log(`Retrieved ${userGames.length} games for user ${currentUser.user_id}`);
        return userGames;
    } catch (error) {
        console.error('Get user games error:', error);
        return [];
    }
}
