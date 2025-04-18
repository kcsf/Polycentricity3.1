<script lang="ts">
  import type { D3Node } from '$lib/utils/d3GraphUtils';
  
  /**
   * Component properties using Svelte 5 Runes
   */
  const props = $props<{
    /** The currently selected node to display details for */
    node: D3Node;
    /** Function to call when closing the popover */
    onClose: () => void;
  }>();
  
  // Create a typed logging function
  const isDev = process.env.NODE_ENV !== 'production';
  const log = (...args: any[]) => isDev && console.log('[CardDetailsPopover]', ...args);
  
  // Add state for animation
  const isVisible = $state(false);
  
  // Animation effect - make visible after component is mounted
  $effect(() => {
    // Set visible in next tick to trigger animation
    setTimeout(() => {
      isVisible = true;
    }, 10);
    
    log('Popover rendered for', props.node.name);
  });
</script>

<div 
  class="p-4 bg-surface-100/95 backdrop-blur-sm rounded-xl shadow-lg max-w-lg border border-surface-300/50 transition-all duration-200"
  class:opacity-0={!isVisible} 
  class:opacity-100={isVisible}
  class:translate-y-4={!isVisible}
  class:translate-y-0={isVisible}
>
  {#if props.node.type === 'actor'}
    <h3 class="text-lg font-semibold mb-2 text-primary-700">{props.node.name}</h3>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      {#if props.node._valueNames?.length}
        <div>
          <h4 class="text-sm font-medium text-primary-700">Values</h4>
          <ul class="list-disc pl-5 text-sm">
            {#each props.node._valueNames as value}
              <li>{value}</li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if props.node._capabilityNames?.length}
        <div>
          <h4 class="text-sm font-medium text-primary-700">Capabilities</h4>
          <ul class="list-disc pl-5 text-sm">
            {#each props.node._capabilityNames as capability}
              <li>{capability}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {:else if props.node.type === 'agreement'}
    <h3 class="text-lg font-semibold mb-2 text-primary-700">{props.node.name}</h3>
    <div class="grid grid-cols-1 gap-4">
      {#if props.node.data?.obligations?.length}
        <div>
          <h4 class="text-sm font-medium text-indigo-700">Obligations</h4>
          <ul class="list-disc pl-5 text-sm">
            {#each props.node.data.obligations as obligation}
              <li>{obligation.text}</li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if props.node.data?.benefits?.length}
        <div>
          <h4 class="text-sm font-medium text-emerald-700">Benefits</h4>
          <ul class="list-disc pl-5 text-sm">
            {#each props.node.data.benefits as benefit}
              <li>{benefit.text}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}
  <button
    class="mt-4 px-3 py-1 text-sm bg-surface-200 rounded hover:bg-surface-300 transition-colors"
    onclick={props.onClose}
  >
    Close
  </button>
</div>

<style>
  /* Use Tailwind utilities for most styling */
  /* Any component-specific styles that can't be done with Tailwind */
  ul {
    margin-top: 0.5rem;
  }
  
  li {
    margin-bottom: 0.25rem;
  }
</style>