<script lang="ts">
  import type { D3Node } from '$lib/utils/d3GraphUtils';
  
  // Convert to Svelte 5 Runes syntax using $props()
  const {
    node,
    onClose
  } = $props<{
    node: D3Node;
    onClose: () => void;
  }>();
  
  // Create a typed logging function
  const isDev = process.env.NODE_ENV !== 'production';
  const log = (...args: any[]) => isDev && console.log('[CardDetailsPopover]', ...args);
  
  // Reactive variable using Svelte 5 Runes $state
  let isVisible = $state(false);
  
  // Run as soon as the script executes
  setTimeout(() => {
    isVisible = true;
    log('Popover visible for', node.name);
    log('Node data:', JSON.stringify(node.data, null, 2));
    log('Node type:', node.type);
  }, 10);
</script>

<div 
  class="p-3 bg-surface-100-900/95 backdrop-blur-sm rounded-xl shadow-lg max-w-sm border border-surface-300-700/50 transition-all duration-200 overflow-hidden"
  style="max-height: 70vh; overflow-y: auto;"
  class:opacity-0={!isVisible} 
  class:opacity-100={isVisible}
  class:translate-y-4={!isVisible}
  class:translate-y-0={isVisible}
>
  {#if node.type === 'card'}
    <!-- Card Details -->
    <div class="flex justify-between items-start">
      <h3 class="text-sm font-semibold text-primary-700-300 truncate">{node.name}</h3>
      <span class="text-xs rounded bg-green-500/20 text-green-500 px-1.5 py-0.5 ml-1">Card</span>
    </div>
    
    <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
      {#if node.data.type}
        <div class="col-span-2">
          <span class="font-medium text-primary-500-400">Type:</span> {node.data.type}
        </div>
      {/if}
      
      {#if node.data.backstory}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Backstory:</h4>
          <p class="mt-0.5 opacity-90 text-xs">{node.data.backstory}</p>
        </div>
      {/if}
      
      {#if node.data.goals}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Goals:</h4>
          <p class="mt-0.5 opacity-90 text-xs">{node.data.goals}</p>
        </div>
      {/if}
      
      {#if node.data.resources}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Resources:</h4>
          <p class="mt-0.5 opacity-90 text-xs whitespace-pre-line">{node.data.resources}</p>
        </div>
      {/if}
      
      {#if node.data.intellectual_property}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Intellectual Property:</h4>
          <p class="mt-0.5 opacity-90 text-xs whitespace-pre-line">{node.data.intellectual_property}</p>
        </div>
      {/if}
      
      {#if node._valueNames?.length}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Values:</h4>
          <div class="flex flex-wrap gap-1 mt-0.5">
            {#each node._valueNames as value}
              <span class="inline-block bg-primary-500/10 text-primary-500 rounded-full px-1.5 py-0.5">{value}</span>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if node._capabilityNames?.length}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Capabilities:</h4>
          <div class="flex flex-wrap gap-1 mt-0.5">
            {#each node._capabilityNames as capability}
              <span class="inline-block bg-secondary-500/10 text-secondary-500 rounded-full px-1.5 py-0.5">{capability}</span>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    
  {:else if node.type === 'actor'}
    <!-- Actor Details -->
    <div class="flex justify-between items-start">
      <h3 class="text-sm font-semibold text-primary-700-300 truncate">{node.name}</h3>
      <span class="text-xs rounded bg-blue-500/20 text-blue-500 px-1.5 py-0.5 ml-1">Actor</span>
    </div>
    
    <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
      {#if node.data.type}
        <div class="col-span-2">
          <span class="font-medium text-primary-500-400">Type:</span> {node.data.type}
        </div>
      {/if}
      
      {#if node.data.actor_type}
        <div class="col-span-2">
          <span class="font-medium text-primary-500-400">Actor Type:</span> {node.data.actor_type}
        </div>
      {/if}
      
      {#if node.data.custom_name}
        <div class="col-span-2">
          <span class="font-medium text-primary-500-400">Custom Name:</span> {node.data.custom_name}
        </div>
      {/if}
      
      {#if node.data.backstory}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Backstory:</h4>
          <p class="mt-0.5 opacity-90 text-xs">{node.data.backstory}</p>
        </div>
      {/if}
      
      {#if node.data.goals}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Goals:</h4>
          <p class="mt-0.5 opacity-90 text-xs">{node.data.goals}</p>
        </div>
      {/if}
      
      {#if node.data.resources}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Resources:</h4>
          <p class="mt-0.5 opacity-90 text-xs whitespace-pre-line">{node.data.resources}</p>
        </div>
      {/if}
      
      {#if node.data.intellectual_property}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Intellectual Property:</h4>
          <p class="mt-0.5 opacity-90 text-xs whitespace-pre-line">{node.data.intellectual_property}</p>
        </div>
      {/if}
      
      {#if node.data._valueNames?.length}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Values:</h4>
          <div class="flex flex-wrap gap-1 mt-0.5">
            {#each node.data._valueNames as value}
              <span class="inline-block bg-primary-500/10 text-primary-500 rounded-full px-1.5 py-0.5">{value}</span>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if node.data._capabilityNames?.length}
        <div class="col-span-2 mt-1">
          <h4 class="font-medium text-primary-500-400">Capabilities:</h4>
          <div class="flex flex-wrap gap-1 mt-0.5">
            {#each node.data._capabilityNames as capability}
              <span class="inline-block bg-secondary-500/10 text-secondary-500 rounded-full px-1.5 py-0.5">{capability}</span>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if Object.keys(node.data.cards_by_game || {}).length}
        <div class="col-span-2 mt-1">
          <span class="font-medium text-primary-500-400">Card ID:</span>
          {Object.entries(node.data.cards_by_game || {}).map(([gameId, cardId]) => cardId).join(', ')}
        </div>
      {/if}
      
      <div class="col-span-2 mt-1">
        <span class="font-medium text-primary-500-400">Status:</span> {node.data.status || 'active'}
      </div>
    </div>
    
  {:else if node.type === 'agreement'}
    <!-- Agreement Details -->
    <div class="flex justify-between items-start">
      <h3 class="text-sm font-semibold text-primary-700-300 truncate">{node.name}</h3>
      <span class="text-xs rounded bg-indigo-500/20 text-indigo-500 px-1.5 py-0.5 ml-1">Agreement</span>
    </div>
    
    <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
      {#if node.data.summary}
        <div class="col-span-2">
          <span class="font-medium text-primary-500-400">Summary:</span>
          <p class="mt-0.5 opacity-90 text-xs whitespace-pre-line">{node.data.summary}</p>
        </div>
      {/if}
      
      <div class="col-span-1">
        <span class="font-medium text-primary-500-400">Type:</span> {node.data.type}
      </div>
      
      <div class="col-span-1">
        <span class="font-medium text-primary-500-400">Status:</span> {node.data.status}
      </div>
      
      {#if node.data.parties && Object.keys(node.data.parties).length}
        <div class="col-span-2 mt-1">
          <span class="font-medium text-primary-500-400">Parties:</span>
          {#each Object.entries(node.data.parties || {}) as [actorId, details], i}
            <div class="border-l-2 border-indigo-500/30 pl-2 mt-1">
              <div class="font-medium text-xs text-tertiary-700">
                Party {i+1}: 
                {#if details.role_title}
                  {details.role_title}
                {:else if details.card_ref}
                  {details.card_ref}
                {:else}
                  {actorId}
                {/if}
              </div>
              
              <div class="mt-0.5">
                <span class="text-indigo-500">Obligation:</span>
                <p class="opacity-90 text-xs whitespace-pre-line">{details.obligation || 'None specified'}</p>
              </div>
              
              <div class="mt-0.5">
                <span class="text-emerald-500">Benefit:</span>
                <p class="opacity-90 text-xs whitespace-pre-line">{details.benefit || 'None specified'}</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  
  <button
    class="mt-3 px-2 py-0.5 text-xs bg-surface-200-800 rounded hover:bg-surface-300-700 transition-colors"
    onclick={onClose}
  >
    Close
  </button>
</div>

<!-- No additional styles needed since we're using Tailwind classes -->