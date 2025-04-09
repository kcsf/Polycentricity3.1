import { writable } from 'svelte/store';
import type { UserSession, User } from '$lib/types';

// Initial state for the user store
const initialState: UserSession = {
    user: null,
    isAuthenticated: false,
    isLoading: true
};

// Create the user store
export const userStore = writable<UserSession>(initialState);

// Reset user store
export function resetUserStore(): void {
    userStore.set(initialState);
}

// Set user in the store
export function setUser(user: User): void {
    userStore.update(state => ({
        ...state,
        user,
        isAuthenticated: true,
        isLoading: false
    }));
}

// Clear user from the store
export function clearUser(): void {
    userStore.update(state => ({
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false
    }));
}
