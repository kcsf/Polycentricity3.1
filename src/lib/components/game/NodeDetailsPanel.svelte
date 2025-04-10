<script lang="ts">
  import { gameStore } from '@/store/gameStore';
  import type { Actor, Agreement } from '@/store/gameStore';
  import { X } from 'svelte-lucide';
  
  let selectedNode: Actor | Agreement | null = null;
  let selectedNodeType: 'actor' | 'agreement' | null = null;
  let actors: Actor[] = [];
  
  // Subscribe to stores
  const unsubscribeNode = gameStore.selectedNode.subscribe(value => {
    selectedNode = value;
  });
  
  const unsubscribeNodeType = gameStore.selectedNodeType.subscribe(value => {
    selectedNodeType = value;
  });
  
  const unsubscribeActors = gameStore.actors.subscribe(value => {
    actors = value;
  });
  
  function closeDetails() {
    gameStore.selectedNodeId.set(null);
    gameStore.selectedNodeType.set(null);
  }
  
  function getActorName(actorId: string): string {
    const actor = actors.find(a => a.id === actorId);
    return actor ? actor.name : 'Unknown Actor';
  }
</script>

{#if selectedNode}
  <div class="details-panel absolute top-0 right-0 w-72 h-full p-4 z-10 overflow-auto">
    <div class="flex justify-between items-center mb-4">
      <h2 class="font-semibold text-lg">
        {selectedNodeType === 'actor' ? 'Actor Details' : 'Agreement Details'}
      </h2>
      <button 
        on:click={closeDetails}
        class="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-200"
        aria-label="Close Details"
      >
        <X class="w-4 h-4 text-gray-700" />
      </button>
    </div>
    
    {#if selectedNodeType === 'actor'}
      {@const actor = selectedNode as Actor}
      <div class="space-y-4">
        <div>
          <h3 class="text-xl font-medium text-gray-800">{actor.name}</h3>
          <div class="text-sm text-gray-600 mt-1">Role: {actor.role}</div>
        </div>
        
        <div>
          <h4 class="font-medium text-gray-700 mb-1">Description</h4>
          <p class="text-sm text-gray-600">{actor.description}</p>
        </div>
      </div>
      
    {:else if selectedNodeType === 'agreement'}
      {@const agreement = selectedNode as Agreement}
      <div class="space-y-4">
        <div>
          <h3 class="text-xl font-medium text-gray-800">{agreement.title}</h3>
          <div class="text-sm text-gray-600 mt-1">Type: {agreement.type}</div>
        </div>
        
        <div>
          <h4 class="font-medium text-gray-700 mb-1">Summary</h4>
          <p class="text-sm text-gray-600">{agreement.summary}</p>
        </div>
        
        <div>
          <h4 class="font-medium text-gray-700 mb-1">Parties</h4>
          <ul class="space-y-1">
            {#each agreement.parties as partyId}
              <li class="text-sm px-2 py-1 rounded bg-gray-100">{getActorName(partyId)}</li>
            {/each}
          </ul>
        </div>
        
        <div>
          <h4 class="font-medium text-gray-700 mb-1">Obligations</h4>
          <ul class="space-y-1">
            {#each agreement.obligations as obligation}
              <li class="text-sm rounded p-2 bg-primary/5 border-l-2 border-primary">
                <div class="font-medium">{getActorName(obligation.fromActorId)}</div>
                <div>{obligation.description}</div>
              </li>
            {/each}
          </ul>
        </div>
        
        <div>
          <h4 class="font-medium text-gray-700 mb-1">Benefits</h4>
          <ul class="space-y-1">
            {#each agreement.benefits as benefit}
              <li class="text-sm rounded p-2 bg-accent/5 border-l-2 border-accent">
                <div class="font-medium">{getActorName(benefit.toActorId)}</div>
                <div>{benefit.description}</div>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  </div>
{/if}