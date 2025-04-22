<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as icons from '@lucide/svelte';
  
  export let node: any = null;
  export let isOpen = false;
  
  const dispatch = createEventDispatcher();
  
  // Function to close the panel
  function closePanel() {
    isOpen = false;
    dispatch('close');
  }
  
  // Format JSON values for display
  function formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    
    return String(value);
  }
  
  // Determine if a property should be editable
  function isEditableProperty(key: string, value: any): boolean {
    // Don't allow editing of special Gun.js properties or complex objects
    if (key === '_' || key === '#' || key === 'id') {
      return false;
    }
    
    // Only allow editing of primitive values for now
    return typeof value !== 'object' || value === null;
  }
  
  // Event handler for saving changes (could be implemented)
  function saveChanges() {
    // This would send changes to Gun.js
    dispatch('save', { node });
  }
</script>

<div 
  class="node-details-panel fixed top-0 {isOpen ? 'right-0' : '-right-full'} h-full w-96 bg-white dark:bg-surface-800 shadow-lg border-l border-surface-200 dark:border-surface-700 transition-all duration-300 ease-in-out overflow-y-auto"
>
  <div class="p-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
    <h3 class="text-lg font-semibold">Node Details</h3>
    <button 
      class="btn btn-sm btn-icon variant-ghost-surface" 
      on:click={closePanel}
      title="Close Panel"
    >
      <svelte:component this={icons.X} class="w-4 h-4" />
    </button>
  </div>
  
  {#if node}
    <div class="p-4">
      <div class="mb-4">
        <h4 class="text-lg font-semibold text-primary-500">{node.label || 'Unnamed Node'}</h4>
        <p class="text-sm text-surface-600 dark:text-surface-400">ID: {node.nodeId}</p>
        <p class="text-sm text-surface-600 dark:text-surface-400">Type: {node.type}</p>
      </div>
      
      <div class="mb-4">
        <h5 class="font-semibold mb-2">Properties</h5>
        <div class="space-y-2">
          {#if node.data && typeof node.data === 'object'}
            {#each Object.entries(node.data || {}) as [key, value]}
              {#if key !== '_' && key !== '#'}
                <div class="property-item border border-surface-200 dark:border-surface-700 rounded p-2">
                  <div class="property-name text-sm font-medium text-surface-700 dark:text-surface-300">
                    {key}
                  </div>
                  <div class="property-value mt-1 text-sm">
                    {#if typeof value === 'object' && value !== null}
                      <pre class="bg-surface-100 dark:bg-surface-700 p-2 rounded text-xs overflow-x-auto">
                        {try {
                          JSON.stringify(value, null, 2)
                        } catch (e) {
                          '[Complex Object - Cannot Display]'
                        }}
                      </pre>
                    {:else}
                      <div class="bg-surface-100 dark:bg-surface-700 p-2 rounded font-mono text-xs break-all">
                        {formatValue(value)}
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            {/each}
          {:else}
            <p class="text-sm text-surface-500 dark:text-surface-400">No properties available.</p>
          {/if}
        </div>
      </div>
      
      <div class="mt-6 border-t border-surface-200 dark:border-surface-700 pt-4">
        <h5 class="font-semibold mb-2">Actions</h5>
        <div class="flex space-x-2">
          <button class="btn btn-sm variant-filled-primary">
            <svelte:component this={icons.Edit} class="w-4 h-4 mr-1" />
            Edit Node
          </button>
          <button class="btn btn-sm variant-filled-surface">
            <svelte:component this={icons.RefreshCcw} class="w-4 h-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>
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