/**
 * authService.ts - User authentication for Polycentricity3 using Gun.js SEA directly
 */

import { getGun, getUser } from './gunService';
import { userStore, setError } from '$lib/stores/userStore';
import type { User, UserSession } from '$lib/types';
import { get as getStore } from 'svelte/store';

/**
 * Register a new user
 * @param name - User's name
 * @param email - User's email
 * @param password - User's password
 * @returns Registered User or null if failed
 */
export async function registerUser(name: string, email: string, password: string): Promise<User | null> {
  try {
    console.log(`Creating user with email: ${email}`);
    
    const gun = getGun();
    const user = getUser();
    if (!gun || !user) throw new Error('Gun or user not initialized');

    return new Promise((resolve, reject) => {
      // Create a new user in Gun's user system
      user.create(email, password, async (ack: any) => {
        if (ack.err) {
          console.error('Error creating user:', ack.err);
          setError(ack.err);
          reject(ack.err);
          return;
        }

        console.log('User created, authenticating...');
        
        // Authenticate as the newly created user
        user.auth(email, password, async (authAck: any) => {
          if (authAck.err) {
            console.error('Error authenticating user:', authAck.err);
            setError(authAck.err);
            reject(authAck.err);
            return;
          }
          
          console.log('User authenticated, saving profile data...');

          const user_id = user._.sea?.pub;
          if (!user_id) {
            const error = 'No public key found after authentication';
            console.error(error);
            setError(error);
            reject(error);
            return;
          }
          
          // Create a user profile with some basic information
          // This is stored in the user's space
          const userData: User = {
            user_id,
            name,
            email,
            pub: user_id,
            role: email === 'bjorn@endogon.com' ? 'Admin' : 'Guest',
            created_at: Date.now()
          };

          console.log(`Saving user profile for: ${user_id}`);
          
          // Store the profile in the user's encrypted space
          user.get('profile').put(userData, (putAck: any) => {
            if (putAck.err) {
              console.error('Error saving user profile:', putAck.err);
              setError(putAck.err);
              // Don't reject here - the user was created successfully
            }
            
            console.log('User registration complete');
            
            // Update the user store
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
 * @param email - User's email
 * @param password - User's password
 * @returns Logged-in User or null if failed
 */
export async function loginUser(email: string, password: string): Promise<User | null> {
  try {
    console.log(`Attempting login for: ${email}`);
    
    const gun = getGun();
    const user = getUser();
    if (!gun || !user) throw new Error('Gun or user not initialized');

    return new Promise((resolve, reject) => {
      // Authenticate the user
      user.auth(email, password, async (ack: any) => {
        if (ack.err) {
          console.error('Authentication error:', ack.err);
          setError(ack.err);
          reject(ack.err);
          return;
        }
        
        console.log('User authenticated, fetching profile data...');

        // Get the user's ID (public key)
        const user_id = user._.sea?.pub;
        if (!user_id) {
          console.error('No public key found after authentication');
          setError('Authentication issue: no public key found');
          reject('No public key found');
          return;
        }
        
        // Try to get the user's profile
        user.get('profile').once((profileData: any) => {
          if (!profileData) {
            // If no profile exists, create a basic one
            console.log('No profile found, creating basic profile');
            const userData: User = {
              user_id,
              name: email.split('@')[0],
              email,
              pub: user_id,
              role: email === 'bjorn@endogon.com' ? 'Admin' : 'Guest',
              created_at: Date.now()
            };
            
            // Save the new profile
            user.get('profile').put(userData);
            
            userStore.update(state => ({
              ...state,
              user: userData,
              isAuthenticated: true,
              isLoading: false,
              lastError: null
            }));
            
            resolve(userData);
          } else {
            // Profile exists, use it
            console.log('User profile found');
            const userData = profileData as User;
            
            userStore.update(state => ({
              ...state,
              user: userData,
              isAuthenticated: true,
              isLoading: false,
              lastError: null
            }));
            
            resolve(userData);
          }
        });
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
 * Check if a user exists by email
 * @param email - User's email
 * @returns Promise resolving to a boolean
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  try {
    const gun = getGun();
    if (!gun) throw new Error('Gun not initialized');

    return new Promise((resolve) => {
      // Use a timeout to ensure we don't hang
      const timeout = setTimeout(() => {
        console.log('User check timed out');
        resolve(false);
      }, 2000);
      
      // Check if this email is registered with Gun's user system
      gun.user().is(email, (ack: any) => {
        clearTimeout(timeout);
        const exists = !!ack;
        console.log(`Email ${email} ${exists ? 'exists' : 'does not exist'} in Gun's user system`);
        resolve(exists);
      });
    });
  } catch (error) {
    console.error('Error checking if user exists:', error);
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
    
    // Try to get the user's profile
    user.get('profile').once((profileData: any) => {
      if (!profileData) {
        console.log('No profile found for authenticated user');
        userStore.update(state => ({ ...state, isLoading: false }));
        return;
      }
      
      console.log('User profile loaded');
      const userData = profileData as User;
      
      userStore.update(state => ({
        ...state,
        user: userData,
        isAuthenticated: true,
        isLoading: false,
        lastError: null
      }));
    });
  } catch (error) {
    console.error('Error initializing auth:', error);
    setError(String(error));
    userStore.update(state => ({ ...state, isLoading: false }));
  }
}