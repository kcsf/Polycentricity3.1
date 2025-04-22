/**
 * userStore.ts - Store for user session state in Polycentricity3
 *
 * Manages the user session using a Svelte writable store, compatible with Svelte 5 Runes.
 * Best Practices:
 * - Uses writable store for .ts file compatibility
 * - Aligns with schema types (User, UserSession from $lib/types)
 * - Provides typed methods for user session management
 * - Supports error handling for authService integration
 * - Ensures reactivity for components like +layout.svelte
 */

import { writable } from 'svelte/store';
import type { User, UserSession } from '$lib/types';

// Initial state for the user store
const initialState: UserSession = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  lastError: null
};

// Create the user store
export const userStore = writable<UserSession>(initialState);

// Reset user store to initial state
export function resetUserStore(): void {
  userStore.set(initialState);
}

// Set user in the store
export function setUser(user: User): void {
  userStore.update(state => ({
    ...state,
    user,
    isAuthenticated: true,
    isLoading: false,
    lastError: null
  }));
}

// Clear user from the store
export function clearUser(): void {
  userStore.update(state => ({
    ...state,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    lastError: null
  }));
}

// Set error in the store
export function setError(error: string | null): void {
  userStore.update(state => ({
    ...state,
    lastError: error,
    isLoading: false
  }));
}