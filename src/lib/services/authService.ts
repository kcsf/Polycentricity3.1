// src/lib/services/authService.ts
/**
 * authService.ts – User authentication for Polycentricity3 using Gun.js SEA directly
 */

import { getGun, getUser } from "./gunService";
import { userStore, setError } from "$lib/stores/userStore";
import type { User } from "$lib/types";
import { get as getStore } from "svelte/store";

/**
 * Register a new user
 * @param name – User's name
 * @param email – User's email
 * @param password – User's password
 * @returns Registered User or null if failed
 */
export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<User | null> {
  try {
    console.log(`Creating user with email: ${email}`);

    const gun = getGun();
    const user = getUser();
    if (!gun || !user) throw new Error("Gun or user not initialized");

    return new Promise<User>((resolve, reject) => {
      user.create(email, password, (ack: any) => {
        if (ack.err) {
          console.error("Error creating user:", ack.err);
          setError(String(ack.err));
          return reject(ack.err);
        }

        console.log("User created, authenticating...");

        user.auth(email, password, (authAck: any) => {
          if (authAck.err) {
            console.error("Error authenticating user:", authAck.err);
            setError(String(authAck.err));
            return reject(authAck.err);
          }

          const user_id = user._.sea?.pub;
          if (!user_id) {
            const err = "No public key found after authentication";
            console.error(err);
            setError(err);
            return reject(err);
          }

          const userData: User = {
            user_id,
            name,
            email,
            pub: user_id,
            role: email === "bjorn@endogon.com" ? "Admin" : "Guest",
            created_at: Date.now(),
          };

          console.log(`Saving user profile for: ${user_id}`);

          // 1) Private SEA‐encrypted profile
          user.get("profile").put(userData, (putAck: any) => {
            if (putAck.err) {
              console.error("Error saving user profile:", putAck.err);
              setError(String(putAck.err));
            }

            // 2) Mirror to public users/{user_id} for lookups
            gun.get("users").get(user_id).put(userData);
          });

          // Update Svelte store
          userStore.update((state) => ({
            ...state,
            user: userData,
            isAuthenticated: true,
            isLoading: false,
            lastError: null,
          }));

          console.log("User registration complete");
          resolve(userData);
        });
      });
    });
  } catch (error: any) {
    const msg = String(error);
    console.error("Registration error:", msg);
    setError(msg);
    return null;
  }
}

/**
 * Login a user
 * @param email – User's email
 * @param password – User's password
 * @returns Logged‐in User or null if failed
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<User | null> {
  try {
    console.log(`Attempting login for: ${email}`);

    const gun = getGun();
    const user = getUser();
    if (!gun || !user) throw new Error("Gun or user not initialized");

    return new Promise<User>((resolve, reject) => {
      user.auth(email, password, (ack: any) => {
        if (ack.err) {
          console.error("Authentication error:", ack.err);
          setError(String(ack.err));
          return reject(ack.err);
        }

        const user_id = user._.sea?.pub;
        if (!user_id) {
          const err = "No public key found after authentication";
          console.error(err);
          setError(err);
          return reject(err);
        }

        // Fetch SEA‐encrypted profile
        user.get("profile").once((profileData: any) => {
          let userData: User;
          if (!profileData) {
            console.log("No profile found, creating basic profile");
            userData = {
              user_id,
              name: email.split("@")[0],
              email,
              pub: user_id,
              role: email === "bjorn@endogon.com" ? "Admin" : "Guest",
              created_at: Date.now(),
            };
            user.get("profile").put(userData);
            gun.get("users").get(user_id).put(userData);
          } else {
            console.log("User profile found");
            userData = profileData as User;
          }

          userStore.update((state) => ({
            ...state,
            user: userData,
            isAuthenticated: true,
            isLoading: false,
            lastError: null,
          }));
          resolve(userData);
        });
      });
    });
  } catch (error: any) {
    const msg = String(error);
    console.error("Login error:", msg);
    setError(msg);
    return null;
  }
}

/**
 * Logout the current user
 */
export async function logoutUser(): Promise<void> {
  try {
    const user = getUser();
    user?.leave();
    userStore.set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      lastError: null,
    });
  } catch (error: any) {
    setError(String(error));
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getStore(userStore).isAuthenticated;
}

/**
 * Get the current user
 */
export function getCurrentUser(): User | null {
  return getStore(userStore).user;
}

/**
 * Check if a user exists by email
 * @param email – User's email
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  try {
    const gun = getGun();
    if (!gun) throw new Error("Gun not initialized");

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 2000);

      // Use the correct alias key: "~<email>"
      gun.get(`~${email}`).once((data: any) => {
        clearTimeout(timeout);
        resolve(Boolean(data && data.pub));
      });
    });
  } catch (error) {
    console.error("Error checking if user exists:", error);
    return false;
  }
}

/**
 * Initialize authentication from stored credentials
 */
export async function initializeAuth(): Promise<void> {
  try {
    userStore.update((s) => ({ ...s, isLoading: true }));

    const user = getUser();
    const user_id = user?._.sea?.pub;
    if (!user_id) {
      console.log("No authenticated user found in session");
      userStore.update((s) => ({ ...s, isLoading: false }));
      return;
    }

    user.get("profile").once((profileData: any) => {
      if (!profileData) {
        console.log("No profile found for authenticated user");
        userStore.update((s) => ({ ...s, isLoading: false }));
        return;
      }

      console.log("User profile loaded");
      userStore.update((s) => ({
        ...s,
        user: profileData as User,
        isAuthenticated: true,
        isLoading: false,
        lastError: null,
      }));
    });
  } catch (error: any) {
    console.error("Error initializing auth:", error);
    setError(String(error));
    userStore.update((s) => ({ ...s, isLoading: false }));
  }
}

/**
 * Create a new user directly (for admin setup)
 * @param email – User's email
 * @param name – User's name
 * @param role – User's role
 */
export async function createUserDirectly(
  email: string,
  name: string,
  role: "Guest" | "Member" | "Admin" = "Guest",
): Promise<{ success: boolean; userId?: string }> {
  try {
    const exists = await userExistsByEmail(email);
    if (exists) return { success: false };

    const gun = getGun();
    if (!gun) return { success: false };

    const user_id = `u${Math.floor(Date.now() / 1000).toString(36)}`;
    const userData: User = {
      user_id,
      name,
      email,
      role,
      created_at: Date.now(),
    };

    // Public profile store
    gun.get(`users`).get(user_id).put(userData);
    // SEA alias index
    gun.get(`~${email}`).put({ pub: user_id });

    return { success: true, userId: user_id };
  } catch (error: any) {
    console.error("Error creating user directly:", error);
    setError(String(error));
    return { success: false };
  }
}

/**
 * Promote an existing user to Admin
 * @param email – User's email
 */
export async function updateUserToAdmin(email: string): Promise<boolean> {
  try {
    const exists = await userExistsByEmail(email);
    const gun = getGun();
    if (!gun) return false;

    if (!exists) {
      const res = await createUserDirectly(email, email.split("@")[0], "Admin");
      return res.success;
    }

    // Lookup alias
    const record: any = await new Promise((res) =>
      gun.get(`~${email}`).once(res),
    );
    const user_id = record?.pub;
    if (!user_id) return false;

    // Update public profile
    gun.get(`users`).get(user_id).get("role").put("Admin");
    return true;
  } catch (error: any) {
    console.error("Error updating user to admin:", error);
    setError(String(error));
    return false;
  }
}
