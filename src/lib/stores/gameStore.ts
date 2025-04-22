/**
 * gameStore.ts - Store for game state in Polycentricity3
 *
 * Manages the current game and user games using Svelte writable stores.
 * Best Practices:
 * - Uses writable stores for compatibility with Svelte 5 Runes
 * - Aligns with schema types (Game from $lib/types)
 * - Provides typed methods for game management
 * - Ensures reactivity for components like D3GameBoardIntegrated.svelte
 */

import { writable } from 'svelte/store';
import type { Game } from '$lib/types';

// Store for current active game
export const currentGameStore = writable<Game | null>(null);

// Store for user's games
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
  userGamesStore.update((games: Game[]) => {
    const index = games.findIndex((g: Game) => g.game_id === game.game_id);
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
  userGamesStore.update((games: Game[]) => games.filter((game: Game) => game.game_id !== gameId));
}

// Update a game in user games
export function updateUserGame(gameId: string, updates: Partial<Game>): void {
  userGamesStore.update((games: Game[]) => {
    return games.map((game: Game) => {
      if (game.game_id === gameId) {
        return { ...game, ...updates };
      }
      return game;
    });
  });
}