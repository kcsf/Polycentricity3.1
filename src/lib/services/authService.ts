// src/lib/services/authService.ts
// src/lib/services/authService.ts
/**
 * authService.ts – User authentication & verification for Polycentricity3
 * Revised per no magic_key index, debounced last_login, and TS fixes.
 */

import {
  getGun,
  getUser,
  putSigned,
  get,
  generateId,
  nodes
} from './gunService';
import { userStore } from '$lib/stores/userStore';
import { updateUserRole } from './gameService';
import type { User } from '$lib/types';

const BJORN_EMAIL = 'bjorn@endogon.com';
let lastLoginTimer: NodeJS.Timeout | null = null;

/**
 * Restore any existing SEA session, hydrate store.
 */
export async function initializeAuth(): Promise<void> {
  try {
    const gunUser = getUser();
    const sea = gunUser?._?.sea;
    if (sea?.pub) {
      const user_id = sea.pub;
      const stored = await get<User>(`${nodes.users}/${user_id}`);
      userStore.update((s) => ({
        ...s,
        user:            stored ?? null,
        isAuthenticated: Boolean(stored),
        isLoading:       false,
        lastError:       null
      }));
    }
  } catch (err: any) {
    console.error('[authService] initializeAuth error:', err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
  }
}

/**
 * Register & emit a 24h magic_key for verifyUser.
 */
export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<User | null> {
  try {
    console.log('[authService] Starting registration for:', email);
    
    const gunUser = getUser();
    if (!gunUser) {
      console.error('[authService] Gun user not initialized');
      throw new Error('Gun user not initialized');
    }
    
    console.log('[authService] Creating user account with Gun...');
    
    // SEA create/auth
    try {
      await new Promise((res, rej) =>
        gunUser.create(email, password, (ack: any) => {
          console.log('[authService] Gun create response:', ack);
          if (ack.err) {
            console.error('[authService] Gun create error:', ack.err);
            rej(ack.err);
          } else {
            console.log('[authService] Gun create success');
            res(ack);
          }
        })
      );
    } catch (createErr) {
      console.error('[authService] Failed to create user:', createErr);
      throw createErr;
    }
    
    console.log('[authService] Authenticating new user...');
    
    try {
      await new Promise((res, rej) =>
        gunUser.auth(email, password, (ack: any) => {
          console.log('[authService] Gun auth response:', ack);
          if (ack.err) {
            console.error('[authService] Gun auth error:', ack.err);
            rej(ack.err);
          } else {
            console.log('[authService] Gun auth success');
            res(ack);
          }
        })
      );
    } catch (authErr) {
      console.error('[authService] Failed to authenticate user:', authErr);
      throw authErr;
    }

    console.log('[authService] Getting SEA data...');
    const sea = gunUser._?.sea;
    console.log('[authService] SEA data:', sea);
    
    const user_id = sea?.pub;
    if (!user_id) {
      console.error('[authService] No authenticated user (missing pub key)');
      throw new Error('No authenticated user');
    }
    
    console.log('[authService] User authenticated with ID:', user_id);

    const now = Date.now();
    const magic_key = generateId();
    const expires_at = now + 24 * 60 * 60 * 1000;
    const role = email === BJORN_EMAIL ? 'Admin' : 'Guest';
    
    console.log('[authService] Creating user record with role:', role);

    const newUser: User = {
      user_id,
      pub:        user_id,
      name,
      email,
      role,
      created_at: now,
      magic_key,
      expires_at,
      games_ref:  {}
    };
    
    const userPath = `${nodes.users}/${user_id}`;
    console.log('[authService] Saving user to path:', userPath);
    console.log('[authService] User data:', newUser);
    
    try {
      await putSigned(userPath, newUser);
      console.log('[authService] Successfully saved user data');
      
      // Verify the user was saved by reading it back
      const savedUser = await get<User>(userPath);
      console.log('[authService] Verification - Read back user data:', savedUser);
      
      if (!savedUser) {
        console.error('[authService] Failed to verify user was saved');
      }
    } catch (saveErr) {
      console.error('[authService] Error saving user data:', saveErr);
      throw saveErr;
    }

    userStore.update((s) => ({
      ...s,
      user:            newUser,
      isAuthenticated: false,
      isLoading:       false,
      lastError:       null
    }));
    
    console.log('[authService] Registration complete, returning new user');
    return newUser;
  } catch (err: any) {
    console.error('[authService] registerUser error:', err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
    return null;
  }
}

/**
 * Verify link & promote via gameService.updateUserRole
 */
export async function verifyUser(
  userId: string,
  magicKey: string
): Promise<boolean> {
  try {
    console.log('[authService] verifyUser called with userId:', userId);
    
    // Get a reference to Gun database
    const gun = getGun();
    if (!gun) throw new Error('Gun not initialized');
    
    // Construct the soul path
    const soul = `${nodes.users}/${userId}`;
    console.log('[authService] Looking up user at soul path:', soul);
    
    // Attempt to retrieve the user
    const stored = await get<User>(soul);
    console.log('[authService] Retrieved user data:', stored);
    
    if (!stored) {
      console.error('[authService] User not found at path:', soul);
      throw new Error('User not found');
    }
    
    if (!stored.magic_key || !stored.expires_at) {
      console.error('[authService] No verification token found for user:', userId);
      throw new Error('No verification token on record');
    }
    
    console.log('[authService] Comparing magicKey:', {
      provided: magicKey,
      stored: stored.magic_key
    });
    
    if (stored.magic_key !== magicKey) {
      console.error('[authService] Magic key mismatch');
      throw new Error('Invalid verification token');
    }
    
    if (Date.now() > stored.expires_at) {
      console.error('[authService] Token expired at:', new Date(stored.expires_at).toISOString());
      throw new Error('Verification token expired');
    }

    // Delegate to gameService for audit/logging/etc.
    console.log('[authService] Promoting user to Member role');
    await updateUserRole(userId, 'Member');

    return true;
  } catch (err: any) {
    console.error('[authService] verifyUser error:', err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
    return false;
  }
}

/**
 * SEA login + debounced last_login + store hydration.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<User | null> {
  try {
    const gunUser = getUser();
    if (!gunUser) throw new Error('Gun user not initialized');

    await new Promise((res, rej) =>
      gunUser.auth(email, password, (ack: any) => (ack.err ? rej(ack.err) : res(ack)))
    );

    const sea = gunUser._?.sea;
    const user_id = sea?.pub;
    if (!user_id) throw new Error('Could not retrieve SEA pub key');

    const soul = `${nodes.users}/${user_id}`;
    const stored = await get<User>(soul);
    if (!stored) throw new Error('User profile missing');

    // Debounce last_login writes
    const now = Date.now();
    if (lastLoginTimer) clearTimeout(lastLoginTimer);
    lastLoginTimer = setTimeout(async () => {
      try {
        await putSigned(soul, { ...stored, last_login: now });
      } catch (e) {
        console.error('[authService] debounced last_login error:', e);
      }
    }, 100);

    userStore.update((s) => ({
      ...s,
      user:            { ...stored, last_login: now },
      isAuthenticated: true,
      isLoading:       false,
      lastError:       null
    }));

    return { ...stored, last_login: now };
  } catch (err: any) {
    console.error('[authService] loginUser error:', err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
    return null;
  }
}

/**
 * SEA logout + store reset.
 */
export async function logoutUser(): Promise<void> {
  try {
    const gunUser = getUser();
    if (gunUser) {
      // Gun.js leave is synchronous; then resolve
      await new Promise<void>((res) => {
        gunUser.leave();
        res(undefined);
      });
    }
    userStore.update((s) => ({
      ...s,
      user:            null,
      isAuthenticated: false,
      isLoading:       false,
      lastError:       null
    }));
  } catch (err: any) {
    console.error('[authService] logoutUser error:', err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
  }
}

/**
 * Quick alias lookup via SEA.
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  try {
    const gun = getGun();
    if (!gun) throw new Error('Gun not initialized');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 2000);
      gun.get(`~${email}`).once((data: any) => {
        clearTimeout(timeout);
        resolve(Boolean(data?.pub));
      });
    });
  } catch (err: any) {
    console.error('[authService] userExistsByEmail error:', err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
    return false;
  }
}

/** Current User util **/
import { get as getStore } from 'svelte/store';
export function getCurrentUser(): User | null {
  return getStore(userStore).user;
}