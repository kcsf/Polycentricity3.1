import { writable } from 'svelte/store';
import type { Game } from '$lib/types';

// Game store for current active game
export const currentGameStore = writable<Game | null>(null);

// Games list store for user's games
export const userGamesStore = writable<Game[]>([]);

// Set current game
export function setCurrentGame(game: Game): void {
    currentGameStore.set(game);
}

// Clear current game
export function clearCurrentGame(): void {
    currentGameStore.set(null);
}

// Set user games
export function setUserGames(games: Game[]): void {
    userGamesStore.set(games);
}

// Add a game to user games
export function addUserGame(game: Game): void {
    userGamesStore.update(games => {
        // Check if game already exists
        const index = games.findIndex(g => g.game_id === game.game_id);
        if (index >= 0) {
            // Update existing game
            const updatedGames = [...games];
            updatedGames[index] = game;
            return updatedGames;
        } else {
            // Add new game
            return [...games, game];
        }
    });
}

// Remove a game from user games
export function removeUserGame(gameId: string): void {
    userGamesStore.update(games => games.filter(game => game.game_id !== gameId));
}

// Update a game in user games
export function updateUserGame(gameId: string, updates: Partial<Game>): void {
    userGamesStore.update(games => {
        return games.map(game => {
            if (game.game_id === gameId) {
                return { ...game, ...updates };
            }
            return game;
        });
    });
}
