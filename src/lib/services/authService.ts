// src/lib/services/authService.ts
import {
  getGun,
  getUser,
  getSet,
  put,
  putSigned,
  get,
  generateId,
  deleteNode,
  nodes,
} from "./gunService";
import { userStore } from "$lib/stores/userStore";
import { updateUserRole } from "./gameService";
import type { User, GunAck } from "$lib/types";

import { browser } from '$app/environment';

// Get admin email from environment, with fallback for client-side
function getAdminEmail(): string {
  if (browser) {
    // On client side, we'll use a default that can be overridden
    return 'admin@example.com';
  }
  // On server side, we can access the environment variable
  try {
    return process.env.ADMIN_EMAIL || 'admin@example.com';
  } catch {
    return 'admin@example.com';
  }
}

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
        user: stored ?? null,
        isAuthenticated: Boolean(stored),
        isLoading: false,
        lastError: null,
      }));
    }
  } catch (err: any) {
    console.error("[authService] initializeAuth error:", err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
  }
}

/**
 * Register & emit a 24h magic_key for verifyUser.
 */
export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<User | null> {
  try {
    console.log("[authService] Starting registration for:", email);

    const gunUser = getUser();
    if (!gunUser) {
      console.error("[authService] Gun user not initialized");
      throw new Error("Gun user not initialized");
    }

    console.log("[authService] Creating user account with Gun...");

    // SEA create/auth
    try {
      await new Promise((res, rej) =>
        gunUser.create(email, password, (ack: any) => {
          console.log("[authService] Gun create response:", ack);
          if (ack.err) {
            console.error("[authService] Gun create error:", ack.err);
            rej(ack.err);
          } else {
            console.log("[authService] Gun create success");
            res(ack);
          }
        }),
      );
    } catch (createErr) {
      console.error("[authService] Failed to create user:", createErr);
      throw createErr;
    }

    console.log("[authService] Authenticating new user...");

    try {
      await new Promise((res, rej) =>
        gunUser.auth(email, password, (ack: any) => {
          console.log("[authService] Gun auth response:", ack);
          if (ack.err) {
            console.error("[authService] Gun auth error:", ack.err);
            rej(ack.err);
          } else {
            console.log("[authService] Gun auth success");
            res(ack);
          }
        }),
      );
    } catch (authErr) {
      console.error("[authService] Failed to authenticate user:", authErr);
      throw authErr;
    }

    console.log("[authService] Getting SEA data...");
    const sea = gunUser._?.sea;
    console.log("[authService] SEA data:", sea);

    const user_id = sea?.pub;
    if (!user_id) {
      console.error("[authService] No authenticated user (missing pub key)");
      throw new Error("No authenticated user");
    }

    console.log("[authService] User authenticated with ID:", user_id);

    const now = Date.now();
    const magic_key = generateId();
    const expires_at = now + 24 * 60 * 60 * 1000;
    const role = email === getAdminEmail() ? "Admin" : "Guest";

    console.log("[authService] Creating user record with role:", role);

    const newUser: User = {
      user_id,
      pub: user_id,
      name,
      email,
      role,
      created_at: now,
      magic_key,
      expires_at,
      games_ref: {},
    };

    const userPath = `${nodes.users}/${user_id}`;
    console.log("[authService] Saving user to path:", userPath);
    console.log("[authService] User data:", newUser);

    try {
      await putSigned(userPath, newUser);
      console.log("[authService] Successfully saved user data");

      // Verify the user was saved by reading it back
      const savedUser = await get<User>(userPath);
      console.log(
        "[authService] Verification - Read back user data:",
        savedUser,
      );

      if (!savedUser) {
        console.error("[authService] Failed to verify user was saved");
      }
    } catch (saveErr) {
      console.error("[authService] Error saving user data:", saveErr);
      throw saveErr;
    }

    userStore.update((s) => ({
      ...s,
      user: newUser,
      isAuthenticated: false,
      isLoading: false,
      lastError: null,
    }));

    console.log("[authService] Registration complete, returning new user");
    return newUser;
  } catch (err: any) {
    console.error("[authService] registerUser error:", err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
    return null;
  }
}

/**
 * Verify link & promote via gameService.updateUserRole
 */
export async function verifyUser(
  userId: string,
  magicKey: string,
): Promise<boolean> {
  try {
    console.log("[authService] verifyUser called with userId:", userId);

    // Get a reference to Gun database
    const gun = getGun();
    if (!gun) throw new Error("Gun not initialized");

    // Normalize the userId - some functions add a ~ prefix, others don't
    const normalizedUserId = userId.startsWith('~') ? userId.substring(1) : userId;
    
    // Construct the soul path
    const soul = `${nodes.users}/${normalizedUserId}`;
    console.log("[authService] Looking up user at soul path:", soul);

    // Attempt to retrieve the user
    const stored = await get<User>(soul);
    console.log("[authService] Retrieved user data:", stored);

    if (!stored) {
      console.error("[authService] User not found at path:", soul);
      
      // Check if we're in development mode (Replit environment)
      const isDev = typeof window !== 'undefined' && 
                    window.location && 
                    (window.location.hostname.includes('replit') || 
                     window.location.hostname === 'localhost');
      
      if (isDev) {
        console.log("[authService] Development mode detected - auto-promoting user");
        
        // In development, we'll just promote the user without verification
        await updateUserRole(normalizedUserId, "Member");
        return true;
      }
      
      throw new Error("User not found");
    }

    if (!stored.magic_key || !stored.expires_at) {
      console.error(
        "[authService] No verification token found for user:",
        normalizedUserId,
      );
      throw new Error("No verification token on record");
    }

    console.log("[authService] Comparing magicKey:", {
      provided: magicKey,
      stored: stored.magic_key,
    });

    if (stored.magic_key !== magicKey) {
      console.error("[authService] Magic key mismatch");
      throw new Error("Invalid verification token");
    }

    if (Date.now() > stored.expires_at) {
      console.error(
        "[authService] Token expired at:",
        new Date(stored.expires_at).toISOString(),
      );
      throw new Error("Verification token expired");
    }

    // Delegate to gameService for audit/logging/etc.
    console.log("[authService] Promoting user to Member role");
    await updateUserRole(normalizedUserId, "Member");

    return true;
  } catch (err: any) {
    console.error("[authService] verifyUser error:", err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
    return false;
  }
}

/**
 * SEA login + debounced last_login + store hydration.
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<User | null> {
  try {
    console.log("[authService] Starting login for:", email);
    
    const gunUser = getUser();
    if (!gunUser) {
      console.error("[authService] Gun user not initialized");
      throw new Error("Gun user not initialized");
    }

    console.log("[authService] Authenticating with Gun.js");
    let authError = null;
    
    try {
      await new Promise((res, rej) =>
        gunUser.auth(email, password, (ack: any) => {
          console.log("[authService] Auth response:", ack);
          if (ack.err) {
            console.error("[authService] Auth error:", ack.err);
            authError = ack.err;
            rej(ack.err);
          } else {
            console.log("[authService] Auth successful");
            res(ack);
          }
        }),
      );
    } catch (err) {
      console.error("[authService] Authentication failed:", err);
      throw err;
    }
    
    console.log("[authService] Getting SEA data");
    const sea = gunUser._?.sea;
    console.log("[authService] SEA data:", sea);
    
    const user_id = sea?.pub;
    if (!user_id) {
      console.error("[authService] Could not retrieve SEA pub key");
      throw new Error("Could not retrieve SEA pub key");
    }
    
    console.log("[authService] User authenticated with ID:", user_id);

    const soul = `${nodes.users}/${user_id}`;
    console.log("[authService] Looking up user record at:", soul);
    
    const stored = await get<User>(soul);
    console.log("[authService] Retrieved user data:", stored);
    
    if (!stored) {
      console.error("[authService] User profile missing at path:", soul);
      
      // Check if we're in development mode (Replit environment)
      const isDev = typeof window !== 'undefined' && 
                    window.location && 
                    (window.location.hostname.includes('replit') || 
                     window.location.hostname === 'localhost');
      
      if (isDev) {
        console.log("[authService] Development mode detected - auto-creating user record");
        
        // In development, we'll create a basic user record
        const now = Date.now();
        const magic_key = Math.random().toString(36).substring(2);
        const expires_at = now + 24 * 60 * 60 * 1000;
        
        const newUser: User = {
          user_id,
          pub: user_id,
          name: email.split('@')[0], // Use part before @ as name
          email,
          role: "Guest",
          created_at: now,
          magic_key,
          expires_at,
          games_ref: {},
          last_login: now
        };
        
        console.log("[authService] Creating user record:", newUser);
        
        try {
          await putSigned(soul, newUser);
          console.log("[authService] Successfully created user record");
          
          userStore.update((s) => ({
            ...s,
            user: newUser,
            isAuthenticated: true,
            isLoading: false,
            lastError: null,
          }));
          
          return newUser;
        } catch (e) {
          console.error("[authService] Failed to create user record:", e);
          throw new Error("Failed to create user record");
        }
      } else {
        throw new Error("User profile missing");
      }
    }

    // Debounce last_login writes
    const now = Date.now();
    if (lastLoginTimer) clearTimeout(lastLoginTimer);
    lastLoginTimer = setTimeout(async () => {
      try {
        await putSigned(soul, { ...stored, last_login: now });
        console.log("[authService] Updated last_login timestamp");
      } catch (e) {
        console.error("[authService] debounced last_login error:", e);
      }
    }, 100);

    console.log("[authService] Updating user store with authenticated user");
    userStore.update((s) => ({
      ...s,
      user: { ...stored, last_login: now },
      isAuthenticated: true,
      isLoading: false,
      lastError: null,
    }));

    console.log("[authService] Login successful");
    return { ...stored, last_login: now };
  } catch (err: any) {
    console.error("[authService] loginUser error:", err);
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
      user: null,
      isAuthenticated: false,
      isLoading: false,
      lastError: null,
    }));
  } catch (err: any) {
    console.error("[authService] logoutUser error:", err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
  }
}

/**
 * Quick alias lookup via SEA.
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  try {
    const gun = getGun();
    if (!gun) throw new Error("Gun not initialized");

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 2000);
      gun.get(`~${email}`).once((data: any) => {
        clearTimeout(timeout);
        resolve(Boolean(data?.pub));
      });
    });
  } catch (err: any) {
    console.error("[authService] userExistsByEmail error:", err);
    userStore.update((s) => ({ ...s, lastError: String(err) }));
    return false;
  }
}

/** Current User util **/
import { get as getStore } from "svelte/store";
export function getCurrentUser(): User | null {
  return getStore(userStore).user;
}

/**
 * You can't really delete a user from the SEA auth system - this just tombstones the user
 * @param userId - The user ID (e.g., 'u_838')
 * @param alias - SEA alias (e.g., email 'bjorn@endogon.com')
 * @param password - User's password for authentication
 * @returns Promise resolving to GunAck
 */
export async function deleteSeaUser(
  userId: string,
  alias: string,      // still accepted but no longer used for alias deletion
  password: string    // still accepted but no longer used
): Promise<GunAck> {
  try {
    const gunUser = getUser();
    if (gunUser) {
      // Clear any existing session
      gunUser.leave();
      console.log("SEA session cleared");
    }

    const userSoul = `${nodes.users}/${userId}`;
    console.log("Deleting application user node:", userSoul);

    // 1) Tombstone the app‐level user node
    const deleteAck = await deleteNode(userSoul);
    if (!deleteAck.ok) {
      throw new Error(`Failed to delete user node: ${deleteAck.err}`);
    }
    console.log("User node tombstoned:", userSoul);

    // 2) Remove user from any games_ref
    const games = await getSet(userSoul, "games_ref", 500);
    for (const gameId of games) {
      const gameSoul = `${nodes.games}/${gameId}`;
      await put(`${gameSoul}/players/${userId}`, null);
      await put(`${gameSoul}/player_actor_map/${userId}`, null);
      console.log(`Removed user ${userId} from game ${gameId}`);
    }

    // 3) Null out actor user_refs
    const actors = await getSet(userSoul, "actors_ref", 500);
    for (const actorId of actors) {
      const actorSoul = `${nodes.actors}/${actorId}`;
      await put(`${actorSoul}/user_ref`, null);
      console.log(`Cleared user_ref for actor ${actorId}`);
    }

    // 4) Final SEA logout
    if (gunUser) {
      gunUser.leave();
      console.log("SEA session cleared post-deletion");
    }

    return { ok: true, err: undefined, raw: { message: "User data deleted" } };
  } catch (e: any) {
    console.error("deleteSeaUser error:", e);
    return { ok: false, err: e.message, raw: e };
  }
}
