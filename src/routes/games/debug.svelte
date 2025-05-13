<script lang="ts">
  import { onMount } from 'svelte';
  import { get, nodes, getCollection } from '$lib/services/gunService';
  import { getCurrentUser } from '$lib/services/authService';
  import * as icons from '@lucide/svelte';

  let gameId = $state('g_456'); // Default to your game
  let diagResults = $state<any>({});
  let loading = $state(false);
  
  async function runDiagnostics() {
    loading = true;
    diagResults = {};
    
    try {
      // Get current user directly
      const currentUser = getCurrentUser();
      diagResults.currentUser = {
        exists: !!currentUser,
        userId: currentUser?.user_id || 'Not logged in',
        name: currentUser?.name || 'Unknown',
      };

      // Direct Gun.js access to minimize possible errors
      try {
        // 1. Access game directly
        const gamePath = `${nodes.games}/${gameId}`;
        const game = await get(gamePath);
        
        if (!game) {
          diagResults.error = `Game not found at path: ${gamePath}`;
          loading = false;
          return;
        }
        
        diagResults.game = {
          id: gameId,
          name: game.name || 'Unnamed game',
          status: game.status || 'Unknown status',
          createdAt: game.created_at ? new Date(game.created_at).toLocaleString() : 'Unknown',
          deckType: game.deck_type || 'Unknown deck type'
        };
        
        // 2. Get player_actor_map directly
        const pamPath = `${nodes.games}/${gameId}/player_actor_map`;
        const pamData = await get(pamPath);
        
        diagResults.player_actor_map = {
          path: pamPath,
          exists: !!pamData,
          data: pamData || {}
        };
        
        // 3. Get players map directly
        const playersPath = `${nodes.games}/${gameId}/players`;
        const playersData = await get(playersPath);
        
        diagResults.players = {
          path: playersPath,
          exists: !!playersData,
          data: playersData || {}
        };
        
        // 4. Check if the current user is in these maps
        if (currentUser?.user_id) {
          const userId = currentUser.user_id;
          
          diagResults.userStatus = {
            userId,
            inPlayersMap: playersData ? userId in playersData : false,
            inPAM: pamData ? userId in pamData : false,
            actorId: pamData && userId in pamData ? pamData[userId] : null
          };
          
          // 5. Look up actor details if available
          if (diagResults.userStatus.actorId) {
            const actorId = diagResults.userStatus.actorId;
            const actor = await get(`${nodes.actors}/${actorId}`);
            
            diagResults.userActor = {
              exists: !!actor,
              data: actor || {}
            };
          }
        }
        
        // 6. Fetch actors for the game
        const allActors = await getCollection(nodes.actors);
        
        diagResults.gameActors = {
          count: allActors.length,
          actors: allActors.map(a => ({
            id: a.actor_id,
            type: a.actor_type || 'Unknown',
            name: a.custom_name || 'Unnamed actor',
            userRef: a.user_ref || 'No user'
          }))
        };
        
      } catch (err) {
        diagResults.gunError = err instanceof Error ? err.message : String(err);
      }
      
    } catch (error) {
      console.error('Diagnostics error:', error);
      diagResults.error = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }
  
  onMount(() => {
    runDiagnostics();
  });
</script>

<div class="container mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">Game Database Diagnostics</h1>
  
  <div class="card p-4 bg-surface-200-800 mb-6">
    <h2 class="text-lg font-semibold mb-2">Check Game Data</h2>
    <div class="flex gap-2">
      <input 
        type="text" 
        bind:value={gameId} 
        placeholder="Enter game ID"
        class="input bg-surface-300-700 p-2 flex-1"
      />
      <button 
        class="btn bg-primary-500 text-on-primary-token"
        onclick={runDiagnostics}
        disabled={loading}
      >
        {#if loading}
          <span class="loading loading-spinner loading-xs mr-2"></span>
          Running...
        {:else}
          <icons.Search class="w-4 h-4 mr-2" />
          Inspect Game
        {/if}
      </button>
    </div>
    <p class="text-sm mt-2 text-surface-700-300">
      Enter a game ID (e.g., "g_456") to inspect its database structure
    </p>
  </div>
  
  {#if loading}
    <div class="flex flex-col items-center justify-center py-16">
      <div class="loading loading-spinner loading-lg"></div>
      <p class="mt-4">Analyzing database structure...</p>
    </div>
  {:else if diagResults.error}
    <div class="alert bg-error-500 text-on-error-token p-4 mb-4">
      <icons.AlertTriangle class="w-5 h-5 mr-2" />
      <span>Error: {diagResults.error}</span>
    </div>
  {:else if diagResults.gunError}
    <div class="alert bg-warning-500 text-on-warning-token p-4 mb-4">
      <icons.AlertTriangle class="w-5 h-5 mr-2" />
      <span>Gun.js Error: {diagResults.gunError}</span>
    </div>
  {:else if diagResults.game}
    <!-- Authentication Status -->
    <div class="card p-4 bg-surface-200-800 mb-6">
      <div class="flex items-center mb-3">
        <icons.User class="w-5 h-5 mr-2" />
        <h3 class="text-lg font-semibold">Authentication Status</h3>
      </div>
      <div class="bg-surface-300-700 p-3 rounded">
        {#if diagResults.currentUser?.exists}
          <div class="flex items-center text-success-500 mb-2">
            <icons.CheckCircle class="w-5 h-5 mr-2" />
            <p class="font-semibold">Authenticated as {diagResults.currentUser.name}</p>
          </div>
          <p><strong>User ID:</strong> {diagResults.currentUser.userId}</p>
        {:else}
          <div class="flex items-center text-error-500">
            <icons.XCircle class="w-5 h-5 mr-2" />
            <p class="font-semibold">Not authenticated</p>
          </div>
          <p class="mt-2 text-sm">You must be logged in to see your membership status.</p>
        {/if}
      </div>
    </div>
    
    <!-- Game Info -->
    <div class="card p-4 bg-surface-200-800 mb-6">
      <div class="flex items-center mb-3">
        <icons.GameController class="w-5 h-5 mr-2" />
        <h3 class="text-lg font-semibold">Game Details</h3>
      </div>
      <div class="bg-surface-300-700 p-3 rounded grid grid-cols-2 gap-2">
        <div class="font-semibold">Game ID:</div>
        <div>{diagResults.game.id}</div>
        <div class="font-semibold">Name:</div>
        <div>{diagResults.game.name}</div>
        <div class="font-semibold">Status:</div>
        <div>{diagResults.game.status}</div>
        <div class="font-semibold">Created:</div>
        <div>{diagResults.game.createdAt}</div>
        <div class="font-semibold">Deck Type:</div>
        <div>{diagResults.game.deckType}</div>
      </div>
    </div>
    
    <!-- User's Game Membership Status -->
    {#if diagResults.currentUser?.exists && diagResults.userStatus}
      <div class="card p-4 bg-surface-200-800 mb-6">
        <div class="flex items-center mb-3">
          <icons.Users class="w-5 h-5 mr-2" />
          <h3 class="text-lg font-semibold">Your Game Membership</h3>
        </div>
        <div class="bg-surface-300-700 p-3 rounded">
          <div class="space-y-2">
            <p>
              <span class={diagResults.userStatus.inPlayersMap ? 'text-success-500' : 'text-error-500 font-semibold'}>
                {diagResults.userStatus.inPlayersMap ? '✓' : '✗'} In players map
              </span>
              {#if !diagResults.userStatus.inPlayersMap}
                <span class="text-sm ml-2 text-error-400">
                  (User ID not in game.players)
                </span>
              {/if}
            </p>
            <p>
              <span class={diagResults.userStatus.inPAM ? 'text-success-500' : 'text-error-500 font-semibold'}>
                {diagResults.userStatus.inPAM ? '✓' : '✗'} In player_actor_map
              </span>
              {#if !diagResults.userStatus.inPAM}
                <span class="text-sm ml-2 text-error-400">
                  (User ID not in game.player_actor_map)
                </span>
              {/if}
            </p>
            {#if diagResults.userStatus.actorId}
              <p class="mt-1"><strong>Your Actor ID:</strong> {diagResults.userStatus.actorId}</p>
              {#if diagResults.userActor?.exists}
                <div class="mt-2">
                  <p><strong>Actor Name:</strong> {diagResults.userActor.data.custom_name || 'Unnamed'}</p>
                  <p><strong>Actor Type:</strong> {diagResults.userActor.data.actor_type || 'Unknown'}</p>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Raw Database Data -->
    <div class="space-y-6">
      <div class="card p-4 bg-surface-200-800">
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center">
            <icons.Database class="w-5 h-5 mr-2" />
            <h3 class="text-lg font-semibold">Game Players Map</h3>
          </div>
          <div class="text-xs bg-surface-800-200 px-2 py-1 rounded">
            Path: {diagResults.players.path}
          </div>
        </div>
        {#if diagResults.players?.exists}
          <div class="bg-surface-300-700 p-3 rounded font-mono text-sm overflow-auto max-h-64">
            <pre>{JSON.stringify(diagResults.players.data, null, 2)}</pre>
          </div>
        {:else}
          <div class="bg-surface-300-700 p-3 rounded text-error-500 flex items-center">
            <icons.AlertCircle class="w-5 h-5 mr-2" />
            <p>Players map not found or empty!</p>
          </div>
        {/if}
      </div>
      
      <div class="card p-4 bg-surface-200-800">
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center">
            <icons.GitMerge class="w-5 h-5 mr-2" />
            <h3 class="text-lg font-semibold">Player-Actor Map</h3>
          </div>
          <div class="text-xs bg-surface-800-200 px-2 py-1 rounded">
            Path: {diagResults.player_actor_map.path}
          </div>
        </div>
        {#if diagResults.player_actor_map?.exists}
          <div class="bg-surface-300-700 p-3 rounded font-mono text-sm overflow-auto max-h-64">
            <pre>{JSON.stringify(diagResults.player_actor_map.data, null, 2)}</pre>
          </div>
        {:else}
          <div class="bg-surface-300-700 p-3 rounded text-error-500 flex items-center">
            <icons.AlertCircle class="w-5 h-5 mr-2" />
            <p>Player-actor map not found or empty!</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>