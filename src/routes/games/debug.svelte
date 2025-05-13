<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { get, nodes } from '$lib/services/gunService';
  import { getCurrentUser } from '$lib/services/authService';
  import { getGame } from '$lib/services/gameService';

  let gameId = $state('g_456'); // Default to your game
  let diagResults = $state<any>({});
  let loading = $state(false);
  
  async function runDiagnostics() {
    loading = true;
    diagResults = {};
    
    try {
      // 1. Check if game exists
      const game = await getGame(gameId);
      diagResults.game = {
        exists: !!game,
        data: game
      };
      
      if (!game) {
        throw new Error('Game not found');
      }
      
      // 2. Get raw player_actor_map
      const pamPath = `${nodes.games}/${gameId}/player_actor_map`;
      const pamData = await get(pamPath);
      diagResults.player_actor_map = {
        path: pamPath,
        exists: !!pamData,
        data: pamData || {}
      };
      
      // 3. Get raw players map
      const playersPath = `${nodes.games}/${gameId}/players`;
      const playersData = await get(playersPath);
      diagResults.players = {
        path: playersPath,
        exists: !!playersData,
        data: playersData || {}
      };
      
      // 4. Get current authenticated user
      const user = getCurrentUser();
      diagResults.currentUser = {
        exists: !!user,
        userId: user?.user_id,
        data: user
      };
      
      // 5. Check if current user is in player maps
      if (user?.user_id) {
        diagResults.userStatus = {
          inPlayersMap: playersData ? user.user_id in playersData : false,
          inPAM: pamData ? user.user_id in pamData : false
        };
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
  <h1 class="text-2xl font-bold mb-6">Game Diagnostics Tool</h1>
  
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
        {loading ? 'Running...' : 'Run Diagnostics'}
      </button>
    </div>
  </div>
  
  {#if loading}
    <div class="flex justify-center my-8">
      <div class="loading loading-spinner loading-lg"></div>
    </div>
  {:else if diagResults.error}
    <div class="alert bg-error-500 text-on-error-token p-4 mb-4">
      <span>Error: {diagResults.error}</span>
    </div>
  {:else}
    <!-- Game Info -->
    <div class="card p-4 bg-surface-200-800 mb-4">
      <h3 class="text-lg font-semibold mb-2">Game Info</h3>
      {#if diagResults.game?.exists}
        <div class="bg-surface-300-700 p-2 rounded">
          <p><strong>Game ID:</strong> {diagResults.game.data.game_id}</p>
          <p><strong>Name:</strong> {diagResults.game.data.name}</p>
          <p><strong>Status:</strong> {diagResults.game.data.status}</p>
        </div>
      {:else}
        <p class="text-error-500">Game not found!</p>
      {/if}
    </div>
    
    <!-- Current User -->
    <div class="card p-4 bg-surface-200-800 mb-4">
      <h3 class="text-lg font-semibold mb-2">Current User</h3>
      {#if diagResults.currentUser?.exists}
        <div class="bg-surface-300-700 p-2 rounded">
          <p><strong>User ID:</strong> {diagResults.currentUser.userId}</p>
          <p><strong>Name:</strong> {diagResults.currentUser.data.name}</p>
          
          {#if diagResults.userStatus}
            <div class="mt-4">
              <h4 class="font-medium mb-1">Game Membership:</h4>
              <p>
                <span class={diagResults.userStatus.inPlayersMap ? 'text-success-500' : 'text-error-500'}>
                  {diagResults.userStatus.inPlayersMap ? '✓' : '✗'} In players map
                </span>
              </p>
              <p>
                <span class={diagResults.userStatus.inPAM ? 'text-success-500' : 'text-error-500'}>
                  {diagResults.userStatus.inPAM ? '✓' : '✗'} In player_actor_map
                </span>
              </p>
            </div>
          {/if}
        </div>
      {:else}
        <p class="text-warning-500">Not authenticated!</p>
      {/if}
    </div>
    
    <!-- Players Map -->
    <div class="card p-4 bg-surface-200-800 mb-4">
      <h3 class="text-lg font-semibold mb-2">Players Map</h3>
      {#if diagResults.players?.exists}
        <p><strong>Path:</strong> {diagResults.players.path}</p>
        <div class="bg-surface-300-700 p-2 rounded mt-2 font-mono text-sm">
          <pre>{JSON.stringify(diagResults.players.data, null, 2)}</pre>
        </div>
      {:else}
        <p class="text-error-500">Players map not found!</p>
      {/if}
    </div>
    
    <!-- Player-Actor Map -->
    <div class="card p-4 bg-surface-200-800 mb-4">
      <h3 class="text-lg font-semibold mb-2">Player-Actor Map</h3>
      {#if diagResults.player_actor_map?.exists}
        <p><strong>Path:</strong> {diagResults.player_actor_map.path}</p>
        <div class="bg-surface-300-700 p-2 rounded mt-2 font-mono text-sm">
          <pre>{JSON.stringify(diagResults.player_actor_map.data, null, 2)}</pre>
        </div>
      {:else}
        <p class="text-error-500">Player-actor map not found!</p>
      {/if}
    </div>
  {/if}
</div>