<script lang="ts">
  import { gameStore } from '$lib/stores/gameStore';
  import type { Actor } from '$lib/types';
  
  // Bind this to make it controllable from the parent component
  export let showSidebar = false;
  
  let actors: Actor[] = [];
  let activeActorId: string | null = null;
  
  // Subscribe to store changes
  const unsubscribeActors = gameStore.actors.subscribe(value => {
    actors = value;
  });
  
  const unsubscribeActiveActor = gameStore.activeActorId.subscribe(value => {
    activeActorId = value;
  });
  
  function selectActor(actorId: string) {
    gameStore.selectNode(actorId, 'actor');
  }
</script>

<aside class="sidebar w-64 h-full overflow-auto transition-all duration-300 transform {showSidebar ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0">
  <div class="p-4">
    <h2 class="font-semibold text-lg mb-4">Actors</h2>
    
    <div class="space-y-4">
      {#each actors as actor}
        <div 
          class="p-3 rounded-lg border cursor-pointer transition-colors {actor.id === activeActorId ? 'bg-primary/10 border-primary' : 'hover:bg-gray-50'}"
          on:click={() => selectActor(actor.id)}
        >
          <h3 class="font-medium text-gray-800">{actor.name}</h3>
          <div class="text-xs text-gray-500 mt-1">Role: {actor.role}</div>
          <p class="text-sm text-gray-600 mt-2">{actor.description}</p>
        </div>
      {/each}
    </div>
  </div>
</aside>
