<script lang="ts">
  // SvelteRunesGuide.svelte - Svelte 5 Runes Mode Pattern Guide
  import * as icons from 'lucide-svelte';
  
  // Component props
  const {} = $props();
  
  // State for demo
  let count = $state<number>(0);
  let inputText = $state<string>("");
  let items = $state<string[]>([]);
  let isLoading = $state<boolean>(false);
  let activeTab = $state<string>("basics");
  
  // Derived state
  let doubledCount = $derived(() => count * 2);
  let itemCount = $derived(() => items.length);
  let displayMessage = $derived(
    () => count > 10 ? "Count is getting high!" : "Count is still low"
  );
  
  // Function to escape HTML content for code blocks
  function escapeHtml(code: string): string {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // Debug effect
  $effect(() => {
    console.log('count:', count);
    console.log('doubledCount:', doubledCount);
    console.log('displayMessage:', displayMessage);
    console.log('activeTab:', activeTab);
    console.log('items:', items);
    console.log('isLoading:', isLoading);
  });
  
  // Functions
  function increment(): void {
    count = count + 1;
  }
  
  function resetCount(): void {
    count = 0;
  }
  
  function addItem(): void {
    if (inputText.trim()) {
      items = [...items, inputText];
      inputText = "";
    }
  }
  
  function removeItem(index: number): void {
    items = items.filter((_, i) => i !== index);
  }
  
  async function fetchData(): Promise<void> {
    isLoading = true;
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      items = [...items, "Fetched item " + Math.floor(Math.random() * 100)];
    } finally {
      isLoading = false;
    }
  }
  
  function setTab(tab: string): void {
    activeTab = tab;
  }
  
  // Initialize component
  $effect(() => {
    console.log("SvelteRunesGuide component initialized");
  });
</script>

<div class="p-6 space-y-8">
  <h1 class="text-2xl font-bold text-primary-500">Svelte 5 Runes Mode Pattern Guide</h1>
  <p class="text-surface-700 dark:text-surface-300">
    This guide demonstrates standard patterns for Svelte 5.25.9 Runes mode development in Polycentricity3.
  </p>
  
  <!-- Tab Navigation -->
  <div class="border-b border-surface-200 dark:border-surface-700">
    <nav class="flex space-x-4" aria-label="Tabs">
      <button 
        class="py-2 px-3 border-b-2 font-medium text-sm {activeTab === 'basics' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'}"
        onclick={() => setTab('basics')}
      >
        Basics
      </button>
      <button 
        class="py-2 px-3 border-b-2 font-medium text-sm {activeTab === 'components' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'}"
        onclick={() => setTab('components')}
      >
        Components
      </button>
      <button 
        class="py-2 px-3 border-b-2 font-medium text-sm {activeTab === 'reactive' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'}"
        onclick={() => setTab('reactive')}
      >
        Reactivity
      </button>
      <button 
        class="py-2 px-3 border-b-2 font-medium text-sm {activeTab === 'gunjs' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'}"
        onclick={() => setTab('gunjs')}
      >
        Gun.js Integration
      </button>

    </nav>
  </div>
  
  <!-- Tab Content -->
  <div class="tab-content">
    {#if activeTab === 'basics'}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Svelte 5 Runes Mode Basics</h2>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">1. State Declaration</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Old way (Svelte 4)
let count = 0;
$: doubled = count * 2;`)}
            </pre>
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// New way (Svelte 5 Runes)
let count = $state<number>(0);
let doubled = $derived(() => count * 2);`)}
            </pre>
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">2. Component Props</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Old way (Svelte 4)
export let name = "default";
export let count = 0;`)}
            </pre>
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// New way (Svelte 5 Runes)
const { name = "default", count = 0 } 
  = $props();`)}
            </pre>
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">3. Reactive Statements</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Old way (Svelte 4)
$: {
  console.log("Count is " + count);
  calculateSomething(count);
}`)}
            </pre>
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// New way (Svelte 5 Runes)
$effect(() => {
  console.log("Count is " + count);
  calculateSomething(count);
});`)}
            </pre>
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">4. Event Handlers</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Old way (Svelte 4)
<button on:click={handleClick}>
  Click me
</button>`)}
            </pre>
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// New way (Svelte 5 Runes)
<button onclick={handleClick}>
  Click me
</button>`)}
            </pre>
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">5. DOM References</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Old way (Svelte 4)
let inputElement;
<input bind:this={inputElement}>`)}
            </pre>
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// New way (Svelte 5 Runes)
let inputElement = $state<HTMLInputElement | null>(null);
<input bind:this={inputElement}>`)}
            </pre>
          </div>
        </div>
      </div>
    {/if}
    
    {#if activeTab === 'components'}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Component Patterns</h2>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">1. Component Structure</h3>
          <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`<script lang="ts">
  // No imports needed for Svelte 5 Runes
  // ($state, $effect, $derived, $props)
  
  // Component props
  const { title = "Default", options = [] } = $props();
  
  // State declarations
  let isExpanded = $state<boolean>(false);
  let selectedIndex = $state<number>(-1);
  
  // Derived state
  let hasSelection = $derived(() => selectedIndex >= 0);
  
  // Effects
  $effect(() => {
    // Side effects when state changes
    console.log("Selection changed: " + selectedIndex);
  });
  
  // Methods
  function toggle(): void {
    isExpanded = !isExpanded;
  }
  
  function select(index: number): void {
    selectedIndex = index;
    isExpanded = false;
  }
</script>`)}
          </pre>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">2. Slot Rendering</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Old way (Svelte 4)
<div class="container">
  <slot name="header"></slot>
  <slot>Default content</slot>
  <slot name="footer"></slot>
</div>`)}
            </pre>
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// New way (Svelte 5 Runes)
<div class="container">
  {#render headerSlot?.()}
    Header content
  {/render}
  {#render defaultSlot?.()}
    Default content
  {/render}
  {#render footerSlot?.()}
    Footer content
  {/render}
</div>`)}
            </pre>
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">3. Snippet Rendering</h3>
          <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Svelte 5 Runes Snippet Example
<script lang="ts">
  let items = $state<string[]>(["Item 1", "Item 2"]);
</script>

{#snippet itemRenderer(item)}
  <li class="p-2 bg-surface-100">{item}</li>
{/snippet}

<ul>
  {#each items as item}
    {@render itemRenderer(item)}
  {/each}
</ul>`)}
          </pre>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">4. Dynamic Components</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Old way (Svelte 4)
<svelte:component this={componentType} {...props} />`)}
            </pre>
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// New way (Svelte 5 Runes)
<{componentType} {...props} />`)}
            </pre>
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">5. Component Events</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Old way (Svelte 4)
// Child component
import { createEventDispatcher } from "svelte";
const dispatch = createEventDispatcher();
function notify() {
  dispatch("message", { text: "Hello" });
}

// Parent
<Child on:message={handleMessage} />`)}
            </pre>
            <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// New way (Svelte 5 Runes)
// Child component
const { onMessage } = $props();
function notify() {
  onMessage?.({ text: "Hello" });
}

// Parent
<Child onMessage={handleMessage} />`)}
            </pre>
          </div>
        </div>
      </div>
    {/if}
    
    {#if activeTab === 'reactive'}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Reactivity Patterns</h2>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">Live Demo</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 bg-surface-50 dark:bg-surface-900 rounded-lg">
              <h4 class="font-medium mb-2">Counter Example</h4>
              <div class="mb-4">
                <div class="text-2xl font-bold mb-2">{count}</div>
                <div class="text-sm text-surface-600 dark:text-surface-400">
                  Doubled: {doubledCount} <br>
                  Message: {displayMessage}
                </div>
              </div>
              <div class="flex space-x-2">
                <button 
                  class="btn variant-filled-primary" 
                  onclick={increment}
                >
                  Increment
                </button>
                <button 
                  class="btn variant-filled-surface" 
                  onclick={resetCount}
                >
                  Reset
                </button>
              </div>
            </div>
            
            <div class="p-4 bg-surface-50 dark:bg-surface-900 rounded-lg">
              <h4 class="font-medium mb-2">List Example</h4>
              <div class="mb-4">
                <div class="flex mb-2">
                  <input 
                    type="text" 
                    bind:value={inputText}
                    class="input w-full border border-surface-300 dark:border-surface-700 rounded-l-lg"
                    placeholder="Add an item..."
                  />
                  <button 
                    class="btn variant-filled-primary rounded-l-none" 
                    onclick={addItem}
                  >
                    Add
                  </button>
                </div>
                <div class="text-sm text-surface-600 dark:text-surface-400 mb-2">
                  Total items: {itemCount}
                </div>
                <div class="mt-2">
                  <button 
                    class="btn variant-ghost-primary btn-sm"
                    onclick={fetchData}
                    disabled={isLoading}
                  >
                    {#if isLoading}
                      <div class="animate-spin mr-2">
                        <icons.Loader size={16} />
                      </div>
                      Loading...
                    {:else}
                      <icons.Download size={16} class="mr-2" />
                      Fetch Item
                    {/if}
                  </button>
                </div>
              </div>
              <ul class="space-y-2 max-h-40 overflow-y-auto">
                {#each items as item, i}
                  <li class="flex justify-between items-center p-2 bg-surface-100 dark:bg-surface-800 rounded">
                    <span>{item}</span>
                    <button 
                      class="btn-icon variant-ghost-error btn-sm"
                      onclick={() => removeItem(i)}
                    >
                      <icons.Trash size={16} />
                    </button>
                  </li>
                {/each}
                {#if items.length === 0}
                  <li class="text-center text-surface-500 dark:text-surface-400 p-2">
                    No items yet
                  </li>
                {/if}
              </ul>
            </div>
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">Best Practices</h3>
          <ul class="list-disc pl-6 space-y-2">
            <li><strong>Prefer $state over let</strong> for reactive variables</li>
            <li><strong>Use $derived for computed values</strong> instead of imperative recalculation</li>
            <li><strong>Keep side effects in $effect</strong> and make them minimal</li>
            <li><strong>Remember that $effect may run multiple times</strong> - add cleanup if needed</li>
            <li><strong>Dont set state inside $effect</strong> to avoid infinite loops</li>
            <li><strong>Create new arrays/objects</strong> when updating complex state</li>
            <li><strong>Use proper type annotations</strong> with $state&lt;Type&gt;(initialValue)</li>
            <li><strong>Console debugging:</strong> Use debug tools like $state.snapshot(value) instead of console.log for $state variables</li>
          </ul>
        </div>
      </div>
    {/if}
    
    {#if activeTab === 'gunjs'}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Gun.js Integration with Svelte 5 Runes</h2>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">1. Data Loading Pattern</h3>
          <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Load data from Gun.js with Runes reactivity
import { getGun, nodes } from "$lib/services/gunService";

// State for data and loading
let userData = $state<User | null>(null);
let isLoading = $state(true);
let error = $state<string | null>(null);

// Effect for data loading
$effect(async () => {
  try {
    // Create function to update loading state
    const setLoading = (state: boolean) => {
      isLoading = state;
    };
    setLoading(true);
    
    const gun = getGun();
    if (!gun) {
      throw new Error("Gun not initialized");
    }
    
    // Using Promise for cleaner async handling
    const result = await new Promise<User | null>((resolve) => {
      // Set a timeout to prevent indefinite waiting
      const timeout = setTimeout(() => {
        console.log("Gun query timed out");
        resolve(null);
      }, 5000);
      
      // Query Gun database
      gun.get(nodes.users).get(userId).once((data: User) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
    
    // Function to update state safely
    const updateUserData = (data: User | null) => {
      if (data) {
        userData = data;
      } else {
        error = "Data not found";
      }
    };
    
    // Call the function with our result
    updateUserData(result);
  } catch (err) {
    console.error("Error loading data:", err);
    // Function to set error state
    const setError = (err: any) => {
      error = err instanceof Error ? err.message : "Unknown error";
    };
    setError(err);
  } finally {
    // Set loading state with separate function
    const setLoading = (state: boolean) => {
      isLoading = state;
    };
    setLoading(false);
  }
});`)}
          </pre>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">2. Reactive Subscriptions</h3>
          <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Subscribe to real-time Gun.js data with proper cleanup
import { getGun, nodes } from "$lib/services/gunService";

// State for subscription data
let liveData = $state<any[]>([]);

// Svelte 5 Runes effect with cleanup
$effect(() => {
  const gun = getGun();
  if (!gun) return;
  
  // Create subscription
  const subscription = gun.get(nodes.games)
    .map()
    .on((gameData, gameId) => {
      if (!gameData) return;
      
      // Update state safely with immutable pattern and a separate function
      // Avoiding direct state mutation in the callback to prevent state_unsafe_mutation errors
      const updatedData = [...liveData.filter(g => g.game_id !== gameData.game_id), 
                      { ...gameData, game_id: gameId }];
      // Update state with the new array
      liveData = updatedData;
    });
  
  // Clean up subscription on component teardown
  return () => {
    if (subscription && subscription.off) {
      subscription.off();
    }
  };
});`)}
          </pre>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">3. Saving Data</h3>
          <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto rounded">
{@html escapeHtml(`// Save data to Gun.js with proper state handling
import { getGun, nodes } from "$lib/services/gunService";

// State for save operation
let isSaving = $state(false);
let saveError = $state<string | null>(null);
let formData = $state({
  name: "",
  description: ""
});

// Save function
async function saveToGun() {
  try {
    // Set saving state with a separate function
    const setSavingState = (state: boolean) => {
      isSaving = state;
    };
    setSavingState(true);
    
    // Clear error with a separate function
    const clearError = () => {
      saveError = null;
    };
    clearError();
    
    const gun = getGun();
    if (!gun) {
      throw new Error("Gun not initialized");
    }
    
    // Generate ID if needed
    const newId = \`item_\${Date.now()}\`;
    
    // Create item data
    const itemData = {
      item_id: newId,
      name: formData.name,
      description: formData.description,
      created_at: Date.now()
    };
    
    // Save with promise wrapper for better async handling
    await new Promise((resolve, reject) => {
      // Use regular string instead of interpolated string with state variables
      console.log("Starting save to items node");
      gun.get(nodes.items).get(newId).put(itemData, (ack) => {
        if (ack.err) {
          console.error("Save error:", ack.err);
          reject(new Error(ack.err));
        } else {
          // Simple string log without state variables
          console.log("Item saved successfully");
          resolve(true);
        }
      });
      
      // Also resolve after timeout to prevent hanging
      setTimeout(resolve, 2000);
    });
    
    // Reset form on success with a separate function
    const resetForm = () => {
      formData = { name: "", description: "" };
    };
    resetForm();
    
  } catch (err) {
    console.error("Error saving data:", err);
    // Set error state with a separate function
    const setErrorState = (err: any) => {
      saveError = err instanceof Error ? err.message : "Unknown error";
    };
    setErrorState(err);
  } finally {
    // Set saving state with a separate function (reuse from above)
    const setSavingState = (state: boolean) => {
      isSaving = state;
    };
    setSavingState(false);
  }
}`)}
          </pre>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">4. Best Practices with Gun.js</h3>
          <ul class="list-disc pl-6 space-y-2">
            <li><strong>Always use timeouts</strong> with Gun.js queries to prevent indefinite waiting</li>
            <li><strong>Clean up subscriptions</strong> by returning a cleanup function from $effect</li>
            <li><strong>Use immutable patterns</strong> when updating arrays or objects in state</li>
            <li><strong>Add proper error handling</strong> with specific error states</li>
            <li><strong>Implement retry logic</strong> for critical operations</li>
            <li><strong>Always check for Gun initialization</strong> before using it</li>
            <li><strong>Use our utility functions</strong> in gameService.ts for common operations</li>
            <li><strong>Remember to handle Gun.js references</strong> structured as reference objects</li>
            <li><strong>For collections, use object format</strong> with key-value pairs, not arrays</li>
          </ul>
        </div>
      </div>
    {/if}
    

  </div>
  
  <div class="mt-8 p-4 border border-dashed border-surface-300 dark:border-surface-600 rounded-lg">
    <h3 class="text-lg font-semibold mb-2">Resources</h3>
    <ul class="list-disc pl-6 space-y-1">
      <li><a href="https://svelte.dev/docs/svelte/v5-migration-guide" class="text-primary-500 hover:underline" target="_blank">Official Svelte 5 Migration Guide</a></li>
      <li><a href="https://svelte.dev/docs/content-tracking" class="text-primary-500 hover:underline" target="_blank">Svelte 5 Content Tracking (Reactivity)</a></li>
      <li><a href="https://svelte.dev/docs/runes" class="text-primary-500 hover:underline" target="_blank">Svelte 5 Runes Documentation</a></li>
      <li><a href="https://svelte.dev/tutorial/welcome-to-svelte" class="text-primary-500 hover:underline" target="_blank">Svelte Tutorial</a></li>
    </ul>
  </div>
</div>