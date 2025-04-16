<script lang="ts">
  import gameStore from '$lib/stores/enhancedGameStore';
  import type { ActorWithPosition, AgreementWithPosition } from '$lib/stores/enhancedGameStore';
  import * as icons from 'lucide-svelte';
  import { derived } from 'svelte/store';
  
  // Props
  export let isOpen = false;
  
  // Local variables
  let selectedNode: ActorWithPosition | AgreementWithPosition | null = null;
  let selectedNodeType: 'actor' | 'agreement' | null = null;
  let actors: ActorWithPosition[] = [];
  
  // Subscribe to stores
  const unsubscribeNode = gameStore.selectedNode.subscribe(value => {
    selectedNode = value;
    
    // Auto-open the panel when a node is selected
    if (value) {
      isOpen = true;
    }
  });
  
  const unsubscribeNodeType = gameStore.selectedNodeType.subscribe(value => {
    selectedNodeType = value;
  });
  
  const unsubscribeActors = gameStore.actors.subscribe(value => {
    actors = value;
  });
  
  // Cleanup on component destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    unsubscribeNode();
    unsubscribeNodeType();
    unsubscribeActors();
  });
  
  // Function to close the panel
  function closePanel() {
    isOpen = false;
    gameStore.clearSelectedNode();
  }
  
  // Function to edit an agreement
  function editAgreement() {
    if (selectedNode && selectedNodeType === 'agreement') {
      gameStore.toggleAgreementModal(true, selectedNode as AgreementWithPosition);
    }
  }
  
  // Function to delete an agreement
  function deleteAgreement() {
    if (selectedNode && selectedNodeType === 'agreement') {
      if (confirm('Are you sure you want to delete this agreement?')) {
        gameStore.deleteAgreement(selectedNode.id);
        closePanel();
      }
    }
  }
  
  // Helper functions
  function getActorName(actorId: string): string {
    const actor = actors.find(a => a.actor_id === actorId);
    return actor ? actor.role_title : 'Unknown Actor';
  }
</script>

<div 
  class="node-details-panel absolute top-0 {isOpen ? 'right-0' : '-right-full'} h-full w-72 bg-white dark:bg-surface-800 shadow-lg border-l border-surface-200 dark:border-surface-700 transition-all duration-300 ease-in-out overflow-y-auto"
>
  <div class="p-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
    <h3 class="text-lg font-semibold">Details</h3>
    <button 
      class="btn btn-sm btn-icon variant-ghost-surface" 
      on:click={closePanel}
      title="Close Panel"
    >
      <svelte:component this={icons.X} class="w-4 h-4" />
    </button>
  </div>
  
  {#if selectedNode}
    <div class="p-4">
      {#if selectedNodeType === 'actor'}
        {@const actor = selectedNode as ActorWithPosition}
        <div class="mb-4">
          <h4 class="text-lg font-semibold text-primary-500">{actor.role_title}</h4>
          <p class="text-sm text-surface-600 dark:text-surface-400">{actor.actor_id}</p>
        </div>
        
        <div class="mb-4">
          <h5 class="font-semibold mb-1">Backstory</h5>
          <p class="text-sm">{actor.backstory}</p>
        </div>
        
        <div class="mb-4">
          <h5 class="font-semibold mb-1">Values</h5>
          <ul class="list-disc list-inside text-sm">
            {#each actor.values as value}
              <li>{value}</li>
            {/each}
          </ul>
        </div>
        
        <div class="mb-4">
          <h5 class="font-semibold mb-1">Goals</h5>
          <ul class="list-disc list-inside text-sm">
            {#each actor.goals as goal}
              <li>{goal}</li>
            {/each}
          </ul>
        </div>
        
        {#if actor.skills && actor.skills.length > 0}
          <div class="mb-4">
            <h5 class="font-semibold mb-1">Skills</h5>
            <ul class="list-disc list-inside text-sm">
              {#each actor.skills as skill}
                <li>{skill}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        {#if actor.resources && actor.resources.length > 0}
          <div class="mb-4">
            <h5 class="font-semibold mb-1">Resources</h5>
            <ul class="list-disc list-inside text-sm">
              {#each actor.resources as resource}
                <li>{resource}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        {#if actor.constraints && actor.constraints.length > 0}
          <div class="mb-4">
            <h5 class="font-semibold mb-1">Constraints</h5>
            <ul class="list-disc list-inside text-sm">
              {#each actor.constraints as constraint}
                <li>{constraint}</li>
              {/each}
            </ul>
          </div>
        {/if}
      {:else if selectedNodeType === 'agreement'}
        {@const agreement = selectedNode as AgreementWithPosition}
        <div class="mb-4">
          <h4 class="text-lg font-semibold text-primary-500">{agreement.title}</h4>
          <p class="text-sm text-surface-600 dark:text-surface-400">Created: {new Date(agreement.created_at).toLocaleDateString()}</p>
        </div>
        
        <div class="mb-4">
          <h5 class="font-semibold mb-1">Description</h5>
          <p class="text-sm">{agreement.description}</p>
        </div>
        
        <div class="mb-4">
          <h5 class="font-semibold mb-1">Parties</h5>
          <ul class="list-disc list-inside text-sm">
            {#each agreement.parties as partyId}
              <li>{getActorName(partyId)}</li>
            {/each}
          </ul>
        </div>
        
        <div class="mb-4">
          <h5 class="font-semibold mb-1">Terms</h5>
          <ul class="list-disc list-inside text-sm">
            {#each agreement.terms as term}
              <li>{term}</li>
            {/each}
          </ul>
        </div>
        
        {#if agreement.obligations && agreement.obligations.length > 0}
          <div class="mb-4">
            <h5 class="font-semibold mb-1">Obligations</h5>
            <ul class="list-disc list-inside text-sm">
              {#each agreement.obligations as obligation}
                <li><span class="font-medium">{getActorName(obligation.fromActorId)}</span>: {obligation.description}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        {#if agreement.benefits && agreement.benefits.length > 0}
          <div class="mb-4">
            <h5 class="font-semibold mb-1">Benefits</h5>
            <ul class="list-disc list-inside text-sm">
              {#each agreement.benefits as benefit}
                <li><span class="font-medium">{getActorName(benefit.toActorId)}</span>: {benefit.description}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        <div class="mt-6 space-y-2">
          <button class="btn btn-sm w-full variant-filled-primary" on:click={editAgreement}>
            Edit Agreement
          </button>
          <button class="btn btn-sm w-full variant-filled-error" on:click={deleteAgreement}>
            Delete Agreement
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="p-4 text-center text-surface-500 dark:text-surface-400">
      <p>Select a node to view details</p>
    </div>
  {/if}
</div>

<style>
  .node-details-panel {
    z-index: 50;
  }
</style>