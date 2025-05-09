import { getGun } from './gunService';
import type { User } from '$lib/types';

/**
 * Update the user's lastActiveAt timestamp in Gun
 */
export function pokePresence(userId: string): void {
  const gun = getGun();
  if (!gun) throw new Error('Gun not ready');

  const ts = Date.now();
  // Write timestamp to users/<userId>/lastActiveAt
  gun.get('users').get(userId).get('lastActiveAt').put(ts);
}

/**
 * Subscribe to changes on a user's lastActiveAt field
 * @returns unsubscribe function
 */
export function subscribeToLastActive(
  userId: string,
  callback: (lastActiveAt: number) => void
): () => void {
  const gun = getGun();
  if (!gun) throw new Error('Gun not ready');

  // Listen for updates at users/<userId>/lastActiveAt
  const listener = gun
    .get('users')
    .get(userId)
    .get('lastActiveAt')
    .on((val: any) => {
      if (typeof val === 'number') callback(val);
    });

  return () => {
    listener.off();
  };
}
