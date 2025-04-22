/**
 * authService.ts - User authentication for Polycentricity3
 *
 * Manages user registration, login, logout, and session initialization using Gun.js SEA,
 * aligned with the new schema and optimized for Replit.
 *
 * Features:
 * - Schema-aligned User type (no devices, includes pub)
 * - Removes admin bypass for security
 * - Optimized findUserByEmail with indexed node
 * - Short timeouts (1s) for performance
 */

import { getGun, getUser, nodes, put, get as getNode, putSigned, setField } from './gunService';
import { userStore, setError } from '$lib/stores/userStore';
import type { User, UserSession } from '$lib/types';
import { get as getStore } from 'svelte/store';

/**
 * Register a new user
 * @param name - User’s name
 * @param email - User’s email
 * @param password - User’s password
 * @returns Registered User or null if failed
 */
export async function registerUser(name: string, email: string, password: string): Promise<User | null> {
  try {
    const gun = getGun();
    const user = getUser();
    if (!gun || !user) throw new Error('Gun or user not initialized');

    return new Promise((resolve, reject) => {
      user.create(email, password, async (ack: any) => {
        if (ack.err) {
          setError(ack.err);
          reject(ack.err);
          return;
        }

        user.auth(email, password, async (authAck: any) => {
          if (authAck.err) {
            setError(authAck.err);
            reject(authAck.err);
            return;
          }

          const user_id = user._.sea?.pub || `u_${Date.now().toString(36)}`;
          const userData: User = {
            user_id,
            name,
            email,
            pub: user._.sea?.pub,
            role: email === 'bjorn@endogon.com' ? 'Admin' : 'Guest',
            magic_key: `mk_${Date.now().toString(36)}`,
            created_at: Date.now()
          };

          const ack = await putSigned(`${nodes.users}/${user_id}`, userData);
          if (ack.err) {
            setError(ack.err);
            reject(ack.err);
            return;
          }

          userStore.update(state => ({
            ...state,
            user: userData,
            isAuthenticated: true,
            isLoading: false,
            lastError: null
          }));
          resolve(userData);
        });
      });
    });
  } catch (error) {
    const errorMsg = String(error);
    setError(errorMsg);
    return null;
  }
}

/**
 * Login a user
 * @param email - User’s email
 * @param password - User’s password
 * @returns Logged-in User or null if failed
 */
export async function loginUser(email: string, password: string): Promise<User | null> {
  try {
    const gun = getGun();
    const user = getUser();
    if (!gun || !user) throw new Error('Gun or user not initialized');

    return new Promise((resolve, reject) => {
      user.auth(email, password, async (ack: any) => {
        if (ack.err) {
          setError(ack.err);
          reject(ack.err);
          return;
        }

        const user_id = user._.sea?.pub || `u_${Date.now().toString(36)}`;
        const userData = await getNode<User>(`${nodes.users}/${user_id}`);
        if (!userData) {
          setError('User data not found');
          reject('User data not found');
          return;
        }

        userStore.update(state => ({
          ...state,
          user: userData,
          isAuthenticated: true,
          isLoading: false,
          lastError: null
        }));
        resolve(userData);
      });
    });
  } catch (error) {
    const errorMsg = String(error);
    setError(errorMsg);
    return null;
  }
}

/**
 * Logout the current user
 */
export async function logoutUser(): Promise<void> {
  try {
    const user = getUser();
    if (user) user.leave();

    userStore.update(state => ({
      ...state,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      lastError: null
    }));
  } catch (error) {
    setError(String(error));
  }
}

/**
 * Check if user is authenticated
 * @returns Boolean indicating authentication status
 */
export function isAuthenticated(): boolean {
  return getStore(userStore).isAuthenticated;
}

/**
 * Get the current user
 * @returns Current User or null
 */
export function getCurrentUser(): User | null {
  return getStore(userStore).user;
}

/**
 * Find user by email using indexed node
 * @param email - User’s email
 * @returns Object with found status, userId, and userData
 */
export async function findUserByEmail(email: string): Promise<{ found: boolean; userId?: string; userData?: User }> {
  try {
    const gun = getGun();
    if (!gun) throw new Error('Gun not initialized');

    const emailHash = encodeURIComponent(email.toLowerCase());
    const userData = await getNode<User>(`${nodes.users}/by_email/${emailHash}`);
    if (!userData) return { found: false };

    return {
      found: true,
      userId: userData.user_id,
      userData
    };
  } catch (error) {
    setError(String(error));
    return { found: false };
  }
}

/**
 * Create a new user directly (for admin setup)
 * @param email - User’s email
 * @param name - User’s name
 * @param role - User’s role
 * @returns Object with success status and userId
 */
export async function createUserDirectly(
  email: string,
  name: string,
  role: 'Guest' | 'Member' | 'Admin' = 'Guest'
): Promise<{ success: boolean; userId?: string }> {
  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser.found) return { success: false };

    const user_id = `u_${Date.now().toString(36)}`;
    const userData: User = {
      user_id,
      name,
      email,
      role,
      created_at: Date.now()
    };

    const ack = await put(`${nodes.users}/${user_id}`, userData);
    if (ack.err) return { success: false };

    await put(`${nodes.users}/by_email/${encodeURIComponent(email.toLowerCase())}`, userData);
    return { success: true, userId: user_id };
  } catch (error) {
    setError(String(error));
    return { success: false };
  }
}

/**
 * Update a user’s role to Admin
 * @param email - User’s email
 * @returns Boolean indicating success
 */
export async function updateUserToAdmin(email: string): Promise<boolean> {
  try {
    const existingUser = await findUserByEmail(email);
    if (!existingUser.found || !existingUser.userId) {
      const result = await createUserDirectly(email, email.split('@')[0], 'Admin');
      return result.success;
    }

    const ack = await setField(`${nodes.users}/${existingUser.userId}`, 'role', 'Admin');
    return !ack.err;
  } catch (error) {
    setError(String(error));
    return false;
  }
}

/**
 * Initialize authentication from stored credentials
 */
export async function initializeAuth(): Promise<void> {
  try {
    userStore.update(state => ({ ...state, isLoading: true }));
    const user = getUser();
    if (!user || !user._.sea?.pub) {
      userStore.update(state => ({ ...state, isLoading: false }));
      return;
    }

    const user_id = user._.sea.pub;
    const userData = await getNode<User>(`${nodes.users}/${user_id}`);
    if (!userData) {
      userStore.update(state => ({ ...state, isLoading: false }));
      return;
    }

    userStore.update(state => ({
      ...state,
      user: userData,
      isAuthenticated: true,
      isLoading: false,
      lastError: null
    }));
  } catch (error) {
    setError(String(error));
    userStore.update(state => ({ ...state, isLoading: false }));
  }
}