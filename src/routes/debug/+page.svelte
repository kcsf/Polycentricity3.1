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
        // Extract the public key
        const pubKey = typeof alias === 'string' && alias.startsWith('~') 
          ? alias.substring(1) 
          : alias.pub || alias;
          
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
      
      const gun = getGun();
      if (!gun) {
        errorMessage = 'Gun not initialized';
        return;
      }
      
      // First find the user's public key
      const aliasPromise = new Promise<any>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 3000);
        gun.get(`~@${email}`).once((alias) => {
          clearTimeout(timeout);
          resolve(alias);
        });
      });
      
      const alias = await aliasPromise;
      
      if (!alias) {
        errorMessage = 'User alias not found';
        return;
      }
      
      // Extract the public key
      const pubKey = typeof alias === 'string' && alias.startsWith('~') 
        ? alias.substring(1) 
        : alias.pub || alias;
        
      if (!pubKey) {
        errorMessage = 'Could not determine user public key';
        return;
      }
      
      // Create a minimal user record with Guest role
      const now = Date.now();
      const magic_key = Math.random().toString(36).substring(2);
      const expires_at = now + 24 * 60 * 60 * 1000;
      
      const newUser = {
        user_id: pubKey,
        pub: pubKey,
        name: email.split('@')[0], // Use part before @ as name
        email,
        role: 'Guest',
        created_at: now,
        magic_key,
        expires_at,
        games_ref: {}
      };
      
      const userPath = `${nodes.users}/${pubKey}`;
      
      // Create the user record
      gun.get(userPath).put(newUser, (ack) => {
        if (ack.err) {
          errorMessage = `Failed to save user: ${ack.err}`;
        } else {
          results.fixResult = 'User record created successfully';
          // Refresh the search results
          setTimeout(() => searchUser(), 1000);
        }
      });
    } catch (error) {
      console.error('Error fixing user record:', error);
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
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
    </div>
  </div>
</div>