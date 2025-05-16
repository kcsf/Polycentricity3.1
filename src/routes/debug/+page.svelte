<script lang="ts">
  import { onMount } from 'svelte';
  import { getGun, getUser, get, put, putSigned, nodes } from '$lib/services/gunService';
  import type { User } from '$lib/types';

  let email = $state('admin@ecovalence.com');
  let results = $state<any>({});
  let isLoading = $state(false);
  let errorMessage = $state('');

  async function searchUser() {
    try {
      isLoading = true;
      errorMessage = '';
      results = {};

      console.log('Searching for user with email:', email);
      const gun = getGun();
      if (!gun) throw new Error('Gun not initialized');

      // Alias lookup (SEA stores as "~@email")
      const alias = await new Promise<any>(resolve => {
        const timeout = setTimeout(() => resolve(null), 3000);
        gun.get(`~@${email}`).once(a => {
          clearTimeout(timeout);
          resolve(a);
        });
      });
      results.alias = alias;
      console.log('Alias result:', alias);

      // Extract & normalize pubKey
      let pubKey: string | undefined;
      if (alias) {
        if (typeof alias === 'string' && alias.startsWith('~')) {
          pubKey = alias.substring(1);
        } else if (typeof alias === 'object' && alias.pub) {
          pubKey = alias.pub;
        } else {
          const k = Object.keys(alias).find(k => k.startsWith('~'));
          if (k) pubKey = k.slice(1);
        }
      }
      results.pubKey = pubKey;
      console.log('Public key:', pubKey);

      // Read user record via shared get()
      if (pubKey) {
        const soul = `${nodes.users}/${pubKey}`;
        results.userPath = soul;
        const userData = await get(soul);
        results.userData = userData;
        console.log('User data:', userData);
      }
    } catch (e) {
      console.error('Error searching for user:', e);
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }

  async function fixUserRecord() {
    try {
      isLoading = true;
      errorMessage = '';
      results.fixResult = null;

      const pubKey = results.pubKey;
      if (!pubKey) {
        throw new Error('Public key not found. Search first.');
      }

      // Build minimal user record
      const now = Date.now();
      const newUser = {
        user_id:    pubKey,
        pub:        pubKey,
        name:       email.split('@')[0],
        email,
        role:       'Guest' as const,
        created_at: now,
        magic_key:  Math.random().toString(36).slice(2),
        expires_at: now + 24 * 60 * 60 * 1000,
        games_ref:  {}
      } as User;

      console.log('Creating user record:', newUser);
      await putSigned(`${nodes.users}/${pubKey}`, newUser);

      results.fixResult = 'User record created successfully';
      console.log(results.fixResult);

      // Refresh
      await searchUser();
    } catch (e) {
      console.error('Error fixing user record:', e);
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }

  async function removeUserFromAuth() {
    try {
      isLoading = true;
      errorMessage = '';
      results.removeResult = null;

      const pubKey = results.pubKey;
      if (!pubKey) throw new Error('Public key not found. Search first.');

      const gun = getGun();
      const gunUser = getUser();
      if (!gun || !gunUser) throw new Error('Gun or SEA user not initialized');

      // 1) Remove SEA alias pointer(s) by unsetting the public‐graph set entry
      const aliasSoul = `~@${email}`;
      console.log('Removing alias set membership at:', aliasSoul);

      // read the raw alias node to discover each member soul
      const rawAlias: any = await new Promise(resolve => {
        const t = setTimeout(() => resolve(null), 3000);
        gun.get(aliasSoul).once(a => {
          clearTimeout(t);
          resolve(a);
        });
      });

      if (rawAlias) {
        // every key except "_" is a pointer node soul (e.g. "~d-…")
        const memberSouls = Object.keys(rawAlias).filter(k => k !== '_');
        console.log('Alias members to unset:', memberSouls);

        // unset each member by passing the chain gun.get(memberSoul)
        for (const memberSoul of memberSouls) {
          await new Promise<void>(resolve => {
            const t = setTimeout(() => {
              console.warn(`Timed out unsetting alias member ${memberSoul}`);
              resolve();
            }, 3000);
            gun.get(aliasSoul)
               .unset( gun.get(memberSoul) )
               .once(ack => {
                 clearTimeout(t);
                 // ack here is just the node value; for unset you don't get an err field
                 console.log(`Alias member ${memberSoul} unset`);
                 resolve();
               });
          });
        }
      } else {
        console.log('No alias node found to delete');
      }


      // 3) Null‐out every field on the public user record
      const userSoul = `${nodes.users}/${pubKey}`;
      console.log('Reading user record for deletion:', userSoul);
      const existing = await get(userSoul);
      if (existing) {
        const deletePayload: Record<string, null> = {};
        for (const field of Object.keys(existing)) {
          deletePayload[field] = null;
        }
        console.log('Deleting user record fields:', Object.keys(deletePayload));
        await new Promise<void>(resolve => {
          const t = setTimeout(() => {
            console.warn('Timed out nulling user fields');
            resolve();
          }, 3000);
          gun.get(userSoul).put(deletePayload, (ack?: any) => {
            clearTimeout(t);
            console.log(
              ack?.err
                ? `Error nulling user fields: ${ack.err}`
                : 'User record fields nulled'
            );
            resolve();
          });
        });
      } else {
        console.log('No public user record found to delete');
      }

      // 4) Finally, clear the SEA session locally
      gunUser.leave();
      console.log('SEA session cleared');

      results.removeResult = 'Alias + user record deleted; session cleared';
      console.log(results.removeResult);

      // 5) Refresh to confirm deletion
      await searchUser();
    } catch (e) {
      console.error('Error removing user:', e);
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }



  onMount(searchUser);
</script>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">User Database Debug</h1>

  <div class="card p-4 bg-surface-100-800 mb-4">
    <div class="flex space-x-2">
      <input
        type="text"
        bind:value={email}
        placeholder="Enter email address"
        class="input p-2 border border-surface-300-600 bg-surface-200-700 w-full"
      />
      <button
        onclick={searchUser}
        class="btn bg-primary-500-400 text-white"
        disabled={isLoading}
      >
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </div>
  </div>

  {#if errorMessage}
    <div class="alert bg-error-500-400/20 border border-error-500-400 text-error-500-400 p-4 mb-4">
      {errorMessage}
    </div>
  {/if}

  <div class="card p-4 bg-surface-100-800 mb-4">
    <h2 class="text-xl font-semibold mb-2">Search Results</h2>
    <div class="space-y-4">
      <div>
        <h3 class="font-semibold">Alias Record:</h3>
        <pre class="bg-surface-200-700 p-2 rounded">
{JSON.stringify(results.alias, null, 2) ?? 'null'}
        </pre>
      </div>

      {#if results.pubKey}
        <div>
          <h3 class="font-semibold">Public Key:</h3>
          <pre class="bg-surface-200-700 p-2 rounded">{results.pubKey}</pre>
        </div>
      {/if}

      {#if results.userPath}
        <div>
          <h3 class="font-semibold">User Path:</h3>
          <pre class="bg-surface-200-700 p-2 rounded">{results.userPath}</pre>
        </div>
      {/if}

      <div>
        <h3 class="font-semibold">User Data:</h3>
        <pre class="bg-surface-200-700 p-2 rounded">
{JSON.stringify(results.userData, null, 2) ?? 'null'}
        </pre>
      </div>

      {#if results.alias && !results.userData}
        <div class="alert bg-warning-500-400/20 border border-warning-500-400 text-warning-500-400 p-4">
          <p>User exists in Gun's auth system but not in your users collection.</p>
          <button
            onclick={fixUserRecord}
            class="btn bg-warning-500-400 text-white mt-2"
            disabled={isLoading}
          >
            {isLoading ? 'Fixing...' : 'Create Missing User Record'}
          </button>
        </div>
      {/if}

      {#if results.fixResult}
        <div class="alert bg-success-500-400/20 border border-success-500-400 text-success-500-400 p-4">
          {results.fixResult}
        </div>
      {/if}

      {#if results.removeResult}
        <div class="alert bg-success-500-400/20 border border-success-500-400 text-success-500-400 p-4">
          {results.removeResult}
        </div>
      {/if}

      {#if results.pubKey && (results.userData || results.alias)}
        <div class="alert bg-error-500-400/20 border border-error-500-400 text-error-500-400 p-4 mt-4">
          <p>Remove this user from the database completely.</p>
          <button
            onclick={removeUserFromAuth}
            class="btn bg-error-500-400 text-white mt-2"
            disabled={isLoading}
          >
            {isLoading ? 'Removing...' : 'Remove User'}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
