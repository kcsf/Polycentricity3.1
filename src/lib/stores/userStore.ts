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
 * - Persists sessions across page reloads with localStorage
 */

import { writable } from 'svelte/store';
import type { User, UserSession } from '$lib/types';

// Storage key for persisting user session
const STORAGE_KEY = 'polycentricity_session';

// Load any existing session from localStorage
function loadPersistedState(): UserSession {
  if (typeof window === 'undefined') {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: true,
      lastError: null
    };
  }

  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const parsedData = JSON.parse(storedData) as UserSession;
      return {
        ...parsedData,
        isLoading: false // Ensure loading is false for restored sessions
      };
    }
  } catch (error) {
    console.error('Error loading persisted session:', error);
  }

  // Default state if nothing is stored
  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    lastError: null
  };
}

// Create the user store with persisted state
export const userStore = writable<UserSession>(loadPersistedState());

// Save current state to localStorage
function persistState(state: UserSession): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Don't store loading state
    const storableState = {
      ...state,
      isLoading: false
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storableState));
  } catch (error) {
    console.error('Error persisting session:', error);
  }
}

// Subscribe to store changes and persist them
userStore.subscribe(state => {
  // Only persist if not in loading state
  if (!state.isLoading) {
    persistState(state);
  }
});

// Reset user store to initial state
export function resetUserStore(): void {
  const initialState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    lastError: null
  };
  userStore.set(initialState);
  
  // Clear localStorage when resetting
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
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
  
  // Clear localStorage when logging out
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Set error in the store
export function setError(error: string | null): void {
  userStore.update(state => ({
    ...state,
    lastError: error,
    isLoading: false
  }));
}