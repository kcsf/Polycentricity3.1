<script lang="ts">
  import { createPopover } from '@melt-ui/svelte';
  import { fly } from 'svelte/transition';
  
  // Define the props
  export let node: any = null; // Will be a Card or Agreement
  export let nodeType: 'actor' | 'agreement' = 'actor';
  export let trigger: HTMLElement | null = null;
  export let open: boolean = false;

  // Create the popover
  const {
    elements: { trigger: popoverTrigger, content, arrow, close },
    states: { open: isOpen }
  } = createPopover({
    positioning: {
      placement: 'right',
      gutter: 5,
    },
    forceVisible: true,
    closeOnEscape: true,
    closeOnOutsideClick: true,
    openFocus: 'content',
    closeFocus: 'trigger',
  });

  // Sync the open prop with the isOpen state
  $: {
    if (open !== $isOpen) {
      isOpen.set(open);
    }
  }

  // Dispatch a close event when the popover is closed
  function handleClose() {
    open = false;
  }

  // Format the property names for better display
  function formatPropertyName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim();
  }

  // Helper to determine if a property should be displayed
  function shouldDisplayProperty(key: string, value: any): boolean {
    if (key.startsWith('_') || key === '#') return false;
    if (value === null || value === undefined) return false;
    if (key === 'id' && !value) return false;
    
    // Skip these properties as they're either redundant or references
    const skipProps = ['position', 'active', 'x', 'y', 'fx', 'fy'];
    if (skipProps.includes(key)) return false;
    
    return true;
  }
  
  // Helper to format the value for display
  function formatPropertyValue(key: string, value: any): string {
    if (value === null || value === undefined) return '';
    
    if (key === 'created_at' && typeof value === 'number') {
      return new Date(value).toLocaleString();
    }
    
    if (typeof value === 'object') {
      // If it's a Gun.js object reference (has # property)
      if (value['#']) {
        return `[Reference: ${value['#']}]`;
      }
      
      // For parties in agreements, show the actor IDs
      if (key === 'parties') {
        return Object.keys(value)
          .filter(k => k !== '_' && k !== '#' && value[k] === true)
          .join(', ');
      }
      
      // For other objects, try to stringify them
      try {
        return JSON.stringify(value);
      } catch (e) {
        return '[Complex Object]';
      }
    }
    
    return String(value);
  }

  // Get title based on node type
  function getTitle(): string {
    if (!node) return 'Node Details';
    
    if (nodeType === 'actor') {
      return node.role_title || node.card_id || 'Card Details';
    } else {
      return node.title || node.agreement_id || 'Agreement Details';
    }
  }
</script>

<!-- Bind the trigger to any element -->
{#if trigger}
  <div use:popoverTrigger={trigger}></div>
{/if}

<!-- The popover content -->
{#if $isOpen}
  <div
    use:content
    transition:fly={{ duration: 150, y: 5 }}
    class="bg-surface-50-900-token rounded-lg shadow-lg p-4 max-w-md max-h-[80vh] overflow-y-auto"
    style="z-index: 1000;"
  >
    <div use:arrow class="h-2 w-2 rotate-45 bg-surface-50-900-token"></div>
    
    <!-- Header with title and close button -->
    <div class="flex justify-between items-center mb-3 border-b pb-2">
      <h3 class="font-bold text-lg">{getTitle()}</h3>
      <button 
        use:close 
        class="btn btn-sm variant-ghost-surface" 
        on:click={handleClose}
        aria-label="Close popover"
      >
        ×
      </button>
    </div>
    
    <!-- Content based on node type -->
    <div class="space-y-2">
      {#if node}
        {#if nodeType === 'actor'}
          <!-- Card specific info -->
          {#if node.backstory}
            <div class="p-2 bg-surface-100-800-token rounded">
              <h4 class="font-semibold">Backstory</h4>
              <p class="text-sm">{node.backstory}</p>
            </div>
          {/if}
          
          <!-- Iterate through all properties -->
          <div class="grid grid-cols-1 gap-2">
            {#each Object.entries(node) as [key, value]}
              {#if shouldDisplayProperty(key, value)}
                <div class="p-2 bg-surface-200-700-token/50 rounded">
                  <h4 class="text-xs font-semibold">{formatPropertyName(key)}</h4>
                  <p class="text-sm break-words">{formatPropertyValue(key, value)}</p>
                </div>
              {/if}
            {/each}
          </div>
        {:else if nodeType === 'agreement'}
          <!-- Agreement specific info -->
          {#if node.description}
            <div class="p-2 bg-surface-100-800-token rounded">
              <h4 class="font-semibold">Description</h4>
              <p class="text-sm">{node.description}</p>
            </div>
          {/if}
          
          <!-- Obligations and Benefits -->
          {#if node.obligations && Array.isArray(node.obligations) && node.obligations.length > 0}
            <div class="p-2 bg-surface-100-800-token rounded">
              <h4 class="font-semibold">Obligations</h4>
              <ul class="list-disc pl-5 text-sm">
                {#each node.obligations as obligation}
                  <li>
                    <span class="font-medium">{obligation.fromActorId} → {obligation.toActorId}:</span> 
                    {obligation.text}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          
          {#if node.benefits && Array.isArray(node.benefits) && node.benefits.length > 0}
            <div class="p-2 bg-surface-100-800-token rounded">
              <h4 class="font-semibold">Benefits</h4>
              <ul class="list-disc pl-5 text-sm">
                {#each node.benefits as benefit}
                  <li>
                    <span class="font-medium">{benefit.fromActorId} → {benefit.toActorId}:</span> 
                    {benefit.text}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          
          <!-- Iterate through other properties -->
          <div class="grid grid-cols-1 gap-2">
            {#each Object.entries(node) as [key, value]}
              {#if shouldDisplayProperty(key, value) && !['obligations', 'benefits', 'description'].includes(key)}
                <div class="p-2 bg-surface-200-700-token/50 rounded">
                  <h4 class="text-xs font-semibold">{formatPropertyName(key)}</h4>
                  <p class="text-sm break-words">{formatPropertyValue(key, value)}</p>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {:else}
        <p class="text-center italic">No data available</p>
      {/if}
    </div>
  </div>
{/if}