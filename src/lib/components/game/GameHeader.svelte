<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as icons from 'lucide-svelte';
  
  export let game = { name: 'Polycentricity', game_id: 'demo' };
  
  const dispatch = createEventDispatcher();
  
  function toggleSidebar() {
    dispatch('toggleSidebar');
  }
</script>

<header class="game-header py-2 px-4 flex justify-between items-center shadow-sm">
  <div class="flex items-center gap-4">
    <button 
      on:click={toggleSidebar}
      class="hidden md:flex w-8 h-8 items-center justify-center rounded-md hover:bg-gray-200"
      aria-label="Toggle Sidebar"
    >
      <svelte:component this={icons.Menu} class="w-5 h-5 text-gray-700" />
    </button>
    <h1 class="text-xl font-semibold text-gray-800">{game.name || 'Polycentricity'}</h1>
  </div>
  
  <div class="flex items-center gap-4">
    <span class="text-sm text-gray-600">Game ID: {game.game_id}</span>
  </div>
</header>