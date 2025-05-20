<script lang="ts">
  import { getGun, getUser, get, put, putSigned, nodes, getSet } from '$lib/services/gunService';
  import { deleteSeaUser, loginUser, getCurrentUser } from '$lib/services/authService';
  import type { User, GunAck } from '$lib/types';

  let email = $state('admin@ecovalence.com');
  let password = $state('');
  let loginEmail = $state('');
  let loginPassword = $state('');
  let results = $state<any>({});
  let isLoading = $state(false);
  let errorMessage = $state('');
  let loginMessage = $state('');
  let currentUser = $state<User | null>(null);

  $effect(() => {
    currentUser = getCurrentUser();
    searchUser();
  });

  async function login() {
    try {
      isLoading = true;
      errorMessage = '';
      loginMessage = '';
      const user = await loginUser(loginEmail, loginPassword);
      if (user) {
        loginMessage = `Logged in as ${user.email}`;
        currentUser = user;
      } else {
        loginMessage = 'Login failed. Please check your credentials.';
      }
    } catch (e) {
      console.error('Login error:', e);
      loginMessage = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }

  async function searchUser() {
    try {
      isLoading = true;
      errorMessage = '';
      results = {};

      console.log('Searching for user with email:', email);
      const gun = getGun();
      if (!gun) throw new Error('Gun not initialized');

      const aliasSoul = `~@${email}`;
      const alias = await new Promise<any>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 500);
        gun.get(aliasSoul).once((a) => {
          clearTimeout(timeout);
          resolve(a);
        });
      });
      results.alias = alias;
      console.log('Alias result:', alias);

      let pubKey: string | undefined;
      if (alias && typeof alias === 'object') {
        const k = Object.keys(alias).find((k) => k.startsWith('~'));
        if (k) pubKey = k.slice(1);
      }
      results.pubKey = pubKey;
      console.log('Public key:', pubKey);

      let credentialData: any = null;
      if (pubKey) {
        const credentialSoul = `~${pubKey}`;
        credentialData = await new Promise<any>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 500);
          gun.get(credentialSoul).once((data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });
        results.credentialData = credentialData;
        console.log('Credential data:', credentialData);
      }

      if (pubKey) {
        const soul = `${nodes.users}/${pubKey}`;
        results.userPath = soul;
        const userData = await get<User>(soul);
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

      const now = Date.now();
      const newUser: User = {
        user_id: pubKey,
        pub: pubKey,
        name: email.split('@')[0],
        email,
        role: 'Guest',
        created_at: now,
        magic_key: Math.random().toString(36).slice(2),
        games_ref: {},
      };

      console.log('Creating user record:', newUser);
      const ack = await putSigned(`${nodes.users}/${pubKey}`, newUser);
      if (!ack.ok) throw new Error(`Failed to create user record: ${ack.err}`);

      results.fixResult = 'User record created successfully';
      console.log(results.fixResult);

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
      if (!pubKey) {
        errorMessage = 'Public key not found. Please search for the user first.';
        return;
      }
      if (!password.trim()) {
        errorMessage = 'Please enter a password to delete the user.';
        return;
      }

      const ack = await deleteSeaUser(pubKey, email, password);
      if (!ack.ok) {
        if (ack.err?.includes('Authentication failed') || ack.err?.includes('Account not same')) {
          errorMessage = 'Invalid email or password. Please verify credentials.';
        } else if (ack.err?.includes('Signature did not match') || ack.err?.includes('Unverified data')) {
          errorMessage = 'Authentication error: Credentials could not be verified.';
        } else if (ack.err?.includes('Failed to nullify SEA alias')) {
          errorMessage = 'Failed to remove SEA alias. The user may still exist in the auth system.';
        } else {
          errorMessage = `Failed to delete user: ${ack.err}`;
        }
        return;
      }

      results.removeResult = 'User deleted from SEA and database; session cleared';
      console.log(results.removeResult);

      const aliasSoul = `~@${email}`;
      const gun = getGun();
      if (!gun) throw new Error('Gun not initialized');
      const aliasCheck = await new Promise<any>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 500);
        gun.get(aliasSoul).once((data: any) => {
          clearTimeout(timeout);
          resolve(data);
        });
      });
      console.log('Post-deletion alias check:', aliasCheck);

      await searchUser();
    } catch (e) {
      console.error('Error removing user:', e);
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">User Database Debug</h1>

  <div class="card p-4 bg-surface-100-800 mb-4">
    <h2 class="text-xl font-semibold mb-2">Login</h2>
    <div class="flex flex-col space-y-2">
      <input
        type="text"
        bind:value={loginEmail}
        placeholder="Enter email address"
        class="input p-2 border border-surface-300-600 bg-surface-200-700 w-full"
      />
      <input
        type="password"
        bind:value={loginPassword}
        placeholder="Enter password"
        class="input p-2 border border-surface-300-600 bg-surface-200-700 w-full"
      />
      <button
        onclick={login}
        class="btn bg-primary-500 text-white"
        disabled={isLoading || !loginEmail.trim() || !loginPassword.trim()}
      >
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      {#if loginMessage}
        <p class="text-sm {loginMessage.includes('failed') ? 'text-error-500-400' : 'text-success-500-400'}">
          {loginMessage}
        </p>
      {/if}
      {#if currentUser}
        <p class="text-sm text-success-500-400">Current user: {currentUser.email} ({currentUser.role})</p>
      {/if}
    </div>
  </div>

  <div class="card p-4 bg-surface-100-800 mb-4">
    <h2 class="text-xl font-semibold mb-2">User Search and Deletion</h2>
    <div class="flex flex-col space-y-2">
      <input
        type="text"
        bind:value={email}
        placeholder="Enter email address to search"
        class="input p-2 border border-surface-300-600 bg-surface-200-700 w-full"
      />
      <input
        type="password"
        bind:value={password}
        placeholder="Enter password (required for deletion)"
        class="input p-2 border border-surface-300-600 bg-surface-200-700 w-full"
      />
      {#if !password.trim() && results.pubKey}
        <p class="text-error-500-400 text-sm">Password is required to delete the user.</p>
      {/if}
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
        <h3 class="font-semibold">Alias Record (~@{email}):</h3>
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

      {#if results.credentialData}
        <div>
          <h3 class="font-semibold">SEA Credential Data (~{results.pubKey}):</h3>
          <pre class="bg-surface-200-700 p-2 rounded">
            {JSON.stringify(results.credentialData, null, 2) ?? 'null'}
          </pre>
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

      {#if results.pubKey && (results.userData || results.alias || results.credentialData)}
        <div class="alert bg-error-500-400/20 border border-error-500-400 text-error-500-400 p-4 mt-4">
          <p>Remove this user from the database completely.</p>
          <button
            onclick={removeUserFromAuth}
            class="btn bg-error-500-400 text-white mt-2"
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? 'Removing...' : 'Remove User'}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>