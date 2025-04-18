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
                    
                    // Safely access user.is.pub with null check
                    const user_id = user?.is?.pub || generateId();
                    // Set role based on email
                    let role: 'Guest' | 'Member' | 'Admin' = 'Guest';
                    
                    // Special case for your email
                    if (email === 'bjorn@endogon.com') {
                        role = 'Admin';
                    }
                    
                    // Create device id from userAgent
                    const deviceId = generateId();
                    const devices: Record<string, boolean> = {};
                    devices[deviceId] = true;
                    
                    const userData: User = {
                        user_id,
                        name,
                        email,
                        magic_key: generateId(), // Generate a unique key for the user
                        devices: devices, // Store as Record<string, boolean> per interface
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
        
        // Special admin bypass for Bjorn
        if (email === 'bjorn@endogon.com' && password === 'admin123') {
            console.log('Using admin bypass for Bjorn');
            return new Promise((resolve, reject) => {
                // Find the user in our database by email
                let found = false;
                
                gun.get(nodes.users).map().once((userData: User, userId: string) => {
                    if (userData && userData.email === 'bjorn@endogon.com') {
                        found = true;
                        console.log(`Found Bjorn's user account: ${userId}`);
                        
                        // Make sure the userData has the correct email and name
                        const bjornData: User = {
                            ...userData,
                            email: 'bjorn@endogon.com',
                            name: 'Bjorn',
                            user_id: userId,
                            role: 'Admin' as 'Admin'
                        };
                        
                        // Update the data in Gun to ensure consistency
                        gun.get(nodes.users).get(userId).put(bjornData, (ack: any) => {
                            if (ack && ack.err) {
                                console.error('Error updating Bjorn data:', ack.err);
                            } else {
                                console.log('Updated Bjorn data in database');
                            }
                        });
                        
                        // Update user store
                        userStore.update(state => ({
                            ...state,
                            user: bjornData,
                            isAuthenticated: true,
                            isLoading: false
                        }));
                        
                        resolve(bjornData);
                    }
                });
                
                // Create Bjorn account if not found
                setTimeout(() => {
                    if (!found) {
                        console.log('Creating Bjorn account');
                        const bjornData: User = {
                            user_id: 'u' + Math.floor(Math.random() * 1000),
                            email: 'bjorn@endogon.com',
                            name: 'Bjorn',
                            role: 'Admin' as 'Admin',
                            created_at: Date.now()
                        };
                        
                        // Create the user in Gun.js
                        gun.get(nodes.users).get(bjornData.user_id).put(bjornData);
                        
                        // Update user store
                        userStore.update(state => ({
                            ...state,
                            user: bjornData,
                            isAuthenticated: true,
                            isLoading: false
                        }));
                        
                        resolve(bjornData);
                    }
                }, 1000);
                
                // Final fallback
                setTimeout(() => {
                    if (!found) {
                        reject('Could not find admin account');
                    }
                }, 3000);
            });
        }
        
        // Regular Gun.js authentication
        return new Promise((resolve, reject) => {
            user.auth(email, password, (ack: any) => {
                if (ack.err) {
                    console.error('Login error:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                // Safely access user.is.pub with null check
                const user_id = user?.is?.pub || generateId();
                
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

// Find user by email
export async function findUserByEmail(email: string): Promise<{found: boolean, userId?: string, userData?: User}> {
    try {
        console.log(`Searching for user with email: ${email}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return { found: false };
        }
        
        return new Promise((resolve) => {
            let found = false;
            
            // Find the user by email
            gun.get(nodes.users).map().once((userData: User, key: string) => {
                if (userData && userData.email === email) {
                    console.log(`Found user with email ${email}, id: ${key}`);
                    found = true;
                    resolve({ found: true, userId: key, userData: userData });
                }
            });
            
            // Set a timeout in case user is not found
            setTimeout(() => {
                if (!found) {
                    console.log(`User with email ${email} not found in our database`);
                    resolve({ found: false });
                }
            }, 2000);
        });
    } catch (error) {
        console.error('Find user error:', error);
        return { found: false };
    }
}

// Create a new user directly (bypassing Gun.js auth)
export async function createUserDirectly(email: string, name: string, role: 'Guest' | 'Member' | 'Admin' = 'Guest'): Promise<{success: boolean, userId?: string}> {
    try {
        console.log(`Creating user directly for: ${email}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return { success: false };
        }
        
        // Check if user already exists
        const existingUser = await findUserByEmail(email);
        if (existingUser.found) {
            console.log(`User with email ${email} already exists in our database`);
            return { success: false };
        }
        
        // Generate a unique ID for the user
        const userId = `user_${generateId()}`;
        
        // Create the user data
        const userData: User = {
            user_id: userId,
            name,
            email,
            created_at: Date.now(),
            role
        };
        
        return new Promise((resolve) => {
            // Save the user data
            gun.get(nodes.users).get(userId).put(userData, (ack: any) => {
                if (ack && ack.err) {
                    console.error('Error creating user:', ack.err);
                    resolve({ success: false });
                } else {
                    console.log(`Created user with ID: ${userId}`);
                    resolve({ success: true, userId });
                }
            });
        });
    } catch (error) {
        console.error('Create user error:', error);
        return { success: false };
    }
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
        
        // First try to find the user
        const existingUser = await findUserByEmail(email);
        
        // If user is found, update their role
        if (existingUser.found && existingUser.userId) {
            const userId = existingUser.userId; // Separate variable to help TypeScript
            return new Promise((resolve) => {
                gun.get(nodes.users).get(userId).put({
                    role: 'Admin' as 'Admin'
                }, (ack: any) => {
                    if (ack && ack.err) {
                        console.error('Error updating user role:', ack.err);
                        resolve(false);
                    } else {
                        console.log(`Updated role for user: ${existingUser.userId}`);
                        resolve(true);
                    }
                });
            });
        } 
        // If user is not found, create a new admin user
        else {
            console.log(`User with email ${email} not found. Creating new admin user.`);
            const result = await createUserDirectly(email, email.split('@')[0], 'Admin' as 'Admin');
            return result.success;
        }
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
        
        // Safely access user.is.pub with null check
        const user_id = user?.is?.pub || generateId();
        console.log(`Found potential user session: ${user_id}`);
        
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized during auth initialization');
            userStore.update(state => ({ ...state, isLoading: false }));
            return;
        }
        
        // Enhanced timeout handling for user data retrieval
        return new Promise<void>((resolve) => {
            // Set a timeout to ensure we don't hang indefinitely
            const timeout = setTimeout(() => {
                console.warn(`Timeout retrieving user data for ${user_id}`);
                userStore.update(state => ({ ...state, isLoading: false }));
                resolve();
            }, 3000);
            
            // Get user data
            gun.get(nodes.users).get(user_id).once((userData: User) => {
                clearTimeout(timeout);
                
                if (!userData) {
                    console.log('User data not found for stored session');
                    userStore.update(state => ({ ...state, isLoading: false }));
                    resolve();
                    return;
                }
                
                console.log(`Restored session for user: ${userData.name || user_id}`);
                
                // Update user store
                userStore.update(state => ({
                    ...state,
                    user: userData,
                    isAuthenticated: true,
                    isLoading: false
                }));
                
                // Also attempt to restore the admin account if the user is Bjorn
                if (userData.email === 'bjorn@endogon.com') {
                    console.log('Restoring admin session for Bjorn');
                    loginUser('bjorn@endogon.com', 'password')
                        .then(() => console.log('Admin auth refreshed'))
                        .catch(err => console.warn('Admin refresh error:', err))
                        .finally(() => resolve());
                } else {
                    resolve();
                }
            });
        });
    } catch (error) {
        console.error('Init auth error:', error);
        userStore.update(state => ({ ...state, isLoading: false }));
    }
}
