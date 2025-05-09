<script lang="ts">
  import type { Agreement, D3Node, CardWithPosition, AgreementWithPosition, PartyItem } from '$lib/types';

  // Props
  const props = $props<{ node: D3Node; cards: CardWithPosition[]; onClose: () => void }>();
  const { node, cards, onClose } = props;  

  // Shape for each party row
  let partyItems = $state<PartyItem[]>([]);

  // Recompute partyItems whenever node or cards change
  $effect(() => {
    if (node.type !== 'agreement') {
      partyItems = [];
    } else {
      partyItems = (node.data as AgreementWithPosition).partyItems ?? [];
    }
  });

  // Visibility state
  let isVisible = $state(false);

  // Reference to the popover element
  let popoverElement: HTMLDivElement | null = null;

  // Dev‐only logger
  const isDev = process.env.NODE_ENV !== 'production';
  const log = (...args: any[]) => isDev && console.log('[CardDetailsPopover]', ...args);

  // Mount logic
  $effect(() => {
    setTimeout(() => {
      isVisible = true;
      log('Popover visible for', node.name);
      log('Node data:', JSON.stringify(node.data, null, 2));
      log('Node type:', node.type);
    }, 10);

    // Add global click listener to close popover when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverElement && !popoverElement.contains(event.target as Node)) {
        log('Click outside detected, closing popover');
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    
    return () => {
      // Clean up the event listener on destroy
      document.removeEventListener('click', handleClickOutside);
    };
  });

</script>

<div 
  bind:this={popoverElement}
  role="dialog"
  aria-label={`Details for ${node.name}`}
  tabindex="0"
  class="p-3 bg-surface-100-900/95 backdrop-blur-sm rounded-xl shadow-lg max-w-sm border border-surface-300-700/50 transition-all duration-200 overflow-hidden"
  style="max-height: 70vh; overflow-y: auto;"
  class:opacity-0={!isVisible} 
  class:opacity-100={isVisible}
  class:translate-y-4={!isVisible}
  class:translate-y-0={isVisible}
  onclick={(event) => event.stopPropagation()}
  onkeydown={(event) => {
    if (event.key === 'Enter' || event.key === 'Space') {
      event.stopPropagation();
    }
  }}
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

      <div class="col-span-2 mt-1 space-y-3">
        <span class="font-medium text-primary-500-400">Parties:</span>
        {#each partyItems as { card, obligation, benefit }, i}
          <div class="border-l-2 border-indigo-500/30 pl-2">
            <div class="font-medium text-xs text-tertiary-700">
              Party {i+1}: {card.role_title}
            </div>
            <div class="mt-0.5">
              <span class="text-indigo-500 font-medium">Obligation:</span>
              <span class="opacity-90 text-xs whitespace-pre-line ml-1">{obligation || 'None specified'}</span>
            </div>
            <div class="mt-0.5">
              <span class="text-emerald-500 font-medium">Benefit:</span>
              <span class="opacity-90 text-xs whitespace-pre-line ml-1">{benefit || 'None specified'}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
  
  <button
    class="mt-3 px-2 py-0.5 text-xs bg-surface-200-800 rounded hover:bg-surface-300-700 transition-colors"
    onclick={onClose}
  >
    Close
  </button>
</div>