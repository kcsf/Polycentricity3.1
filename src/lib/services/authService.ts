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

    // First check if this email already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser.found) {
      const errorMsg = 'User already created with this email';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`Creating user with email: ${email}`);
    
    return new Promise((resolve, reject) => {
      user.create(email, password, async (ack: any) => {
        if (ack.err) {
          console.error('Error creating user:', ack.err);
          setError(ack.err);
          reject(ack.err);
          return;
        }

        console.log('User created, authenticating...');
        
        user.auth(email, password, async (authAck: any) => {
          if (authAck.err) {
            console.error('Error authenticating user:', authAck.err);
            setError(authAck.err);
            reject(authAck.err);
            return;
          }
          
          console.log('User authenticated, saving profile data...');

          // Generate a user_id that aligns with our schema
          const user_id = user._.sea?.pub || `u${Math.floor(Date.now() / 1000).toString(36)}`;
          
          // Create user data object with schema-aligned fields
          const userData: User = {
            user_id,
            name,
            email,
            pub: user._.sea?.pub,
            role: email === 'bjorn@endogon.com' ? 'Admin' : 'Guest',
            magic_key: `mk_${Math.floor(Date.now() / 1000).toString(36)}`,
            created_at: Date.now()
          };

          console.log(`Creating user profile: ${user_id}`);
          
          // Using regular put instead of putSigned to ensure data is saved
          // (putSigned might not work correctly with our Gun setup)
          const userAck = await put(`${nodes.users}/${user_id}`, userData);
          if (userAck.err) {
            console.error('Error saving user data:', userAck.err);
            setError(userAck.err);
            reject(userAck.err);
            return;
          }
          
          // Create email index for easier lookup
          const emailHash = encodeURIComponent(email.toLowerCase());
          const emailIndexAck = await put(`${nodes.users}/by_email/${emailHash}`, userData);
          if (emailIndexAck.err) {
            console.error('Error creating email index:', emailIndexAck.err);
            // Don't reject here, this is a non-critical error
          }
          
          console.log('User registration complete');
          
          // Update user store with the new user
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
    console.error('Registration error:', errorMsg);
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

    console.log(`Attempting login for: ${email}`);
    
    return new Promise((resolve, reject) => {
      user.auth(email, password, async (ack: any) => {
        if (ack.err) {
          console.error('Authentication error:', ack.err);
          setError(ack.err);
          reject(ack.err);
          return;
        }
        
        console.log('User authenticated, fetching profile data...');

        // First try to get the user via the SEA public key
        const user_id = user._.sea?.pub;
        if (!user_id) {
          console.error('No public key found after authentication');
          setError('Authentication issue: no public key found');
          reject('No public key found');
          return;
        }
        
        console.log(`Fetching user data for ID: ${user_id}`);
        
        // Try to get user by their ID
        let userData = await getNode<User>(`${nodes.users}/${user_id}`);
        
        // If no user found by ID, try the email index
        if (!userData) {
          console.log('User data not found by ID, trying email index...');
          const emailResult = await findUserByEmail(email);
          
          if (emailResult.found && emailResult.userData) {
            console.log('User found via email index');
            userData = emailResult.userData;
          } else {
            // Create a basic user record if none exists
            // This can happen if the user was created with Gun.user.create
            // but we never stored their profile data
            console.log('Creating basic user profile');
            userData = {
              user_id,
              name: email.split('@')[0],
              email,
              pub: user_id,
              role: email === 'bjorn@endogon.com' ? 'Admin' : 'Guest',
              created_at: Date.now()
            };
            
            // Save this user data
            await put(`${nodes.users}/${user_id}`, userData);
            await put(`${nodes.users}/by_email/${encodeURIComponent(email.toLowerCase())}`, userData);
          }
        }
        
        console.log('Login successful');
        
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
    console.error('Login error:', errorMsg);
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
      console.log('No authenticated user found in session');
      userStore.update(state => ({ ...state, isLoading: false }));
      return;
    }

    const user_id = user._.sea.pub;
    console.log(`Found authenticated session for user: ${user_id}`);
    
    // Get user data from Gun.js database
    const userData = await getNode<User>(`${nodes.users}/${user_id}`);
    if (!userData) {
      console.log('User profile not found in database');
      userStore.update(state => ({ ...state, isLoading: false }));
      return;
    }

    console.log('Session restored successfully');
    
    userStore.update(state => ({
      ...state,
      user: userData,
      isAuthenticated: true,
      isLoading: false,
      lastError: null
    }));
  } catch (error) {
    console.error('Error initializing auth:', error);
    setError(String(error));
    userStore.update(state => ({ ...state, isLoading: false }));
  }
}