import { getGun, getUser, nodes, generateId } from './gunService';
import { userStore } from '$lib/stores/userStore';
import type { User } from '$lib/types';
import { get } from 'svelte/store';

// Register a new user
export async function registerUser(name: string, email: string, password: string): Promise<User | null> {
    try {
        console.log(`Attempting to register user: ${email}`);
        const gun = getGun();
        const user = getUser();
        
        if (!gun || !user) {
            console.error('Gun or user not initialized');
            return null;
        }
        
        // Create a new user with SEA
        return new Promise((resolve, reject) => {
            user.create(email, password, async (ack: any) => {
                if (ack.err) {
                    console.error('Registration error:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                // Login after creating account
                user.auth(email, password, async (authAck: any) => {
                    if (authAck.err) {
                        console.error('Authentication after registration failed:', authAck.err);
                        reject(authAck.err);
                        return;
                    }
                    
                    const user_id = user.is.pub;
                    // Set role based on email
                    let role: 'Guest' | 'Member' | 'Admin' = 'Guest';
                    
                    // Special case for your email
                    if (email === 'bjorn@endogon.com') {
                        role = 'Admin';
                    }
                    
                    const userData: User = {
                        user_id,
                        name,
                        email,
                        magic_key: generateId(), // Generate a unique key for the user
                        devices: navigator.userAgent, // Store as string instead of array
                        created_at: Date.now(),
                        role: role
                    };
                    
                    // Save user data
                    gun.get(nodes.users).get(user_id).put(userData, (putAck: any) => {
                        if (putAck.err) {
                            console.error('Error saving user data:', putAck.err);
                            reject(putAck.err);
                            return;
                        }
                        
                        console.log(`Registered user: ${user_id}`);
                        
                        // Update user store
                        userStore.update(state => ({
                            ...state,
                            user: userData,
                            isAuthenticated: true,
                            isLoading: false
                        }));
                        
                        resolve(userData);
                    });
                });
            });
        });
    } catch (error) {
        console.error('Registration error:', error);
        return null;
    }
}

// Login a user
export async function loginUser(email: string, password: string): Promise<User | null> {
    try {
        console.log(`Attempting to login user: ${email}`);
        const gun = getGun();
        const user = getUser();
        
        if (!gun || !user) {
            console.error('Gun or user not initialized');
            return null;
        }
        
        return new Promise((resolve, reject) => {
            user.auth(email, password, (ack: any) => {
                if (ack.err) {
                    console.error('Login error:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                const user_id = user.is.pub;
                
                // Get user data
                gun.get(nodes.users).get(user_id).once((userData: User) => {
                    if (!userData) {
                        console.error('User data not found');
                        reject('User data not found');
                        return;
                    }
                    
                    console.log(`Login successful: ${user_id}`);
                    
                    // Update user store
                    userStore.update(state => ({
                        ...state,
                        user: userData,
                        isAuthenticated: true,
                        isLoading: false
                    }));
                    
                    resolve(userData);
                });
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        return null;
    }
}

// Logout the current user
export function logoutUser(): void {
    try {
        console.log('Logging out user');
        const user = getUser();
        
        if (user) {
            user.leave();
        }
        
        // Update user store
        userStore.update(state => ({
            ...state,
            user: null,
            isAuthenticated: false,
            isLoading: false
        }));
        
        console.log('Logout successful');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
    const { isAuthenticated } = get(userStore);
    return isAuthenticated;
}

// Get the current user
export function getCurrentUser(): User | null {
    const { user } = get(userStore);
    return user;
}

// Update a user's role to Admin
export async function updateUserToAdmin(email: string): Promise<boolean> {
    try {
        console.log(`Attempting to update user to admin: ${email}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return false;
        }
        
        return new Promise((resolve) => {
            // Find the user by email
            gun.get(nodes.users).map().once((userData: User, key: string) => {
                if (userData && userData.email === email) {
                    // Update the user's role to Admin
                    gun.get(nodes.users).get(key).put({
                        role: 'Admin'
                    }, (ack: any) => {
                        if (ack.err) {
                            console.error('Error updating user role:', ack.err);
                            resolve(false);
                        } else {
                            console.log(`Updated role for user: ${key}`);
                            resolve(true);
                        }
                    });
                }
            });
            
            // Set a timeout in case user is not found
            setTimeout(() => {
                resolve(false);
            }, 2000);
        });
    } catch (error) {
        console.error('Update user role error:', error);
        return false;
    }
}

// Initialize authentication from stored credentials
export async function initializeAuth(): Promise<void> {
    try {
        console.log('Initializing authentication');
        userStore.update(state => ({ ...state, isLoading: true }));
        
        const user = getUser();
        
        if (!user || !user.is) {
            console.log('No stored user session');
            userStore.update(state => ({ ...state, isLoading: false }));
            return;
        }
        
        const user_id = user.is.pub;
        const gun = getGun();
        
        // Get user data
        gun.get(nodes.users).get(user_id).once((userData: User) => {
            if (!userData) {
                console.log('User data not found for stored session');
                userStore.update(state => ({ ...state, isLoading: false }));
                return;
            }
            
            console.log(`Restored session for user: ${user_id}`);
            
            // Update user store
            userStore.update(state => ({
                ...state,
                user: userData,
                isAuthenticated: true,
                isLoading: false
            }));
        });
    } catch (error) {
        console.error('Init auth error:', error);
        userStore.update(state => ({ ...state, isLoading: false }));
    }
}
