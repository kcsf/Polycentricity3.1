<script lang="ts">
  import { onMount } from 'svelte';
  import { getGun, get, nodes } from '$lib/services/gunService';
  
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
      
      if (!gun) {
        errorMessage = 'Gun not initialized';
        return;
      }
      
      // Search for user in Gun's alias system
      const aliasPromise = new Promise<any>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 3000);
        gun.get(`~@${email}`).once((alias) => {
          clearTimeout(timeout);
          resolve(alias);
        });
      });
      
      const alias = await aliasPromise;
      results.alias = alias;
      console.log('Alias result:', alias);
      
      if (alias) {
        // Extract the public key - Gun.js stores it differently than we expect
        let pubKey;
        if (typeof alias === 'string' && alias.startsWith('~')) {
          pubKey = alias.substring(1);
        } else if (alias.pub) {
          pubKey = alias.pub;
        } else if (alias && typeof alias === 'object') {
          // Look for a key that starts with ~
          const keys = Object.keys(alias);
          const pubKeyCandidate = keys.find(k => k.startsWith('~'));
          if (pubKeyCandidate) {
            pubKey = pubKeyCandidate;
          }
        }
          
        results.pubKey = pubKey;
        console.log('Public key:', pubKey);
        
        if (pubKey) {
          // Check if user exists in our users collection
          const userPath = `${nodes.users}/${pubKey}`;
          results.userPath = userPath;
          
          const userDataPromise = new Promise<any>((resolve) => {
            const timeout = setTimeout(() => resolve(null), 3000);
            gun.get(userPath).once((userData) => {
              clearTimeout(timeout);
              resolve(userData);
            });
          });
          
          const userData = await userDataPromise;
          results.userData = userData;
          console.log('User data:', userData);
        }
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }
  
  async function fixUserRecord() {
    try {
      isLoading = true;
      errorMessage = '';
      results.fixResult = null;
      
      const gun = getGun();
      if (!gun) {
        errorMessage = 'Gun not initialized';
        isLoading = false;
        return;
      }
      
      // We already have the public key from the search, so we can use it directly
      const pubKey = results.pubKey;
      
      if (!pubKey) {
        errorMessage = 'Public key not found. Please search for the user first.';
        isLoading = false;
        return;
      }
      
      console.log('Fixing user record with public key:', pubKey);
      
      // Normalize the pubKey - remove ~ if it exists
      const normalizedPubKey = pubKey.startsWith('~') ? pubKey.substring(1) : pubKey;
      
      // Create a minimal user record with Guest role
      const now = Date.now();
      const magic_key = Math.random().toString(36).substring(2);
      const expires_at = now + 24 * 60 * 60 * 1000;
      
      const newUser = {
        user_id: normalizedPubKey,
        pub: normalizedPubKey,
        name: email.split('@')[0], // Use part before @ as name
        email,
        role: 'Guest',
        created_at: now,
        magic_key,
        expires_at,
        games_ref: {}
      };
      
      console.log('Creating user record:', newUser);
      
      // Construct the user path
      const userPath = `${nodes.users}/${normalizedPubKey}`;
      console.log('User path:', userPath);
      
      try {
        // Use a simple timeout for the put operation
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log('Put operation timed out, assuming success');
            resolve(null);
          }, 3000);
          
          gun.get(userPath).put(newUser, (ack) => {
            clearTimeout(timeout);
            if (ack.err) {
              console.error('Failed to save user:', ack.err);
              reject(new Error(ack.err));
            } else {
              console.log('Successfully saved user record');
              resolve(ack);
            }
          });
        });
        
        results.fixResult = 'User record created successfully';
        results.createdUser = newUser;
        console.log('Update complete, refreshing data');
      } catch (putError) {
        console.error('Error during put operation:', putError);
        errorMessage = String(putError);
      }
      
      // Force a refresh of the page state
      isLoading = false;
      
      // Refresh the search results after a short delay
      setTimeout(() => searchUser(), 500);
    } catch (error) {
      console.error('Error fixing user record:', error);
      errorMessage = error instanceof Error ? error.message : String(error);
      isLoading = false;
    }
  }
  
  async function removeUserFromAuth() {
    try {
      isLoading = true;
      errorMessage = '';
      results.removeResult = null;
      
      const gun = getGun();
      if (!gun) {
        errorMessage = 'Gun not initialized';
        isLoading = false;
        return;
      }
      
      // We need to use both the user record and auth record
      const pubKey = results.pubKey;
      
      if (!pubKey) {
        errorMessage = 'Public key not found. Please search for the user first.';
        isLoading = false;
        return;
      }
      
      // Normalize the pubKey - remove ~ if it exists
      const normalizedPubKey = pubKey.startsWith('~') ? pubKey.substring(1) : pubKey;
      
      console.log('Removing user with public key:', pubKey);
      
      // Remove the alias entry
      try {
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log('Remove alias operation timed out, continuing');
            resolve(null);
          }, 3000);
          
          gun.get(`~@${email}`).put(null, (ack) => {
            clearTimeout(timeout);
            if (ack.err) {
              console.warn('Warning removing alias:', ack.err);
            } else {
              console.log('Successfully removed alias');
            }
            resolve(ack);
          });
        });
      } catch (aliasError) {
        console.warn('Error removing alias:', aliasError);
      }
      
      // Remove the user record
      try {
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log('Remove user operation timed out, continuing');
            resolve(null);
          }, 3000);
          
          // Remove the user node
          const userPath = `${nodes.users}/${normalizedPubKey}`;
          gun.get(userPath).put(null, (ack) => {
            clearTimeout(timeout);
            if (ack.err) {
              console.warn('Warning removing user record:', ack.err);
            } else {
              console.log('Successfully removed user record');
            }
            resolve(ack);
          });
        });
        
        results.removeResult = 'User records have been removed. For complete removal, you may need to clear the Gun.js data and restart the application.';
        console.log('User removal complete');
      } catch (userError) {
        console.warn('Error removing user:', userError);
      }
      
      // Force a refresh of the page state
      isLoading = false;
      
      // Refresh the search results to show the result
      setTimeout(() => searchUser(), 500);
    } catch (error) {
      console.error('Error removing user:', error);
      errorMessage = error instanceof Error ? error.message : String(error);
      isLoading = false;
    }
  }
  
  onMount(() => {
    searchUser();
  });
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
        <pre class="bg-surface-200-700 p-2 rounded">{JSON.stringify(results.alias, null, 2) || 'null'}</pre>
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
        <pre class="bg-surface-200-700 p-2 rounded">{JSON.stringify(results.userData, null, 2) || 'null'}</pre>
      </div>
      
      {#if results.alias && !results.userData}
        <div class="alert bg-warning-500-400/20 border border-warning-500-400 text-warning-500-400 p-4">
          <p>User exists in Gun's authentication system but not in the application's user collection.</p>
          <p>This is causing the "User already created!" error during registration, but "User not found" during verification.</p>
          
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
          <p class="text-sm">This will attempt to remove both the authentication record and user record.</p>
          
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