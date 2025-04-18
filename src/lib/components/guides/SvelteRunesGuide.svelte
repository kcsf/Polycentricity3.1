<script lang="ts">
  // SvelteRunesGuide.svelte - Svelte 5 Runes Mode Pattern Guide
  import { inspect } from 'svelte';
  import * as icons from 'lucide-svelte';
  import CodeBlock from '$lib/components/CodeBlock.svelte'; // Assume utility component
  
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
  
  // Debug effect
  $effect(() => {
    inspect(count, { name: 'count' });
    inspect(doubledCount, { name: 'doubledCount' });
    inspect(displayMessage, { name: 'displayMessage' });
    inspect(activeTab, { name: 'activeTab' });
    inspect(items, { name: 'items' });
    inspect(isLoading, { name: 'isLoading' });
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
      <button 
        class="py-2 px-3 border-b-2 font-medium text-sm {activeTab === 'migration' ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'}"
        onclick={() => setTab('migration')}
      >
        Migration Tips
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
            <CodeBlock code="// Old way (Svelte 4)\nlet count = 0;\n$: doubled = count * 2;" />
            <CodeBlock code="// New way (Svelte 5 Runes)\nlet count = $state<number>(0);\nlet doubled = $derived(() => count * 2);" />
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">2. Component Props</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CodeBlock code={'// Old way (Svelte 4)\nexport let name = "default";\nexport let count = 0;'} />
            <CodeBlock code={'// New way (Svelte 5 Runes)\nconst { name = "default", count = 0 } \n  = $props();'} />
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">3. Reactive Statements</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CodeBlock code="// Old way (Svelte 4)\n$: {\n  console.log('Count is ' + count);\n  calculateSomething(count);\n}" />
            <CodeBlock code="// New way (Svelte 5 Runes)\n$effect(() => {\n  console.log('Count is ' + count);\n  calculateSomething(count);\n});" />
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">4. Event Handlers</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CodeBlock code="// Old way (Svelte 4)\n<button on:click={handleClick}>\n  Click me\n</button>" />
            <CodeBlock code="// New way (Svelte 5 Runes)\n<button onclick={handleClick}>\n  Click me\n</button>" />
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">5. DOM References</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CodeBlock code="// Old way (Svelte 4)\nlet inputElement;\n<input bind:this={inputElement}>" />
            <CodeBlock code="// New way (Svelte 5 Runes)\nlet inputElement = $state<HTMLInputElement | null>(null);\n<input bind:this={inputElement}>" />
          </div>
        </div>
      </div>
    {/if}
    
    {#if activeTab === 'components'}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Component Patterns</h2>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">1. Component Structure</h3>
          <CodeBlock code="<script lang=\"ts\">\n  // No imports needed for Svelte 5 Runes\n  // ($state, $effect, $derived, $props)\n  \n  // Component props\n  const { title = \"Default\", options = [] } = $props();\n  \n  // State declarations\n  let isExpanded = $state<boolean>(false);\n  let selectedIndex = $state<number>(-1);\n  \n  // Derived state\n  let hasSelection = $derived(() => selectedIndex >= 0);\n  \n  // Effects\n  $effect(() => {\n    // Side effects when state changes\n    console.log(`Selection changed: ${selectedIndex}`);\n  });\n  \n  // Methods\n  function toggle(): void {\n    isExpanded = !isExpanded;\n  }\n  \n  function select(index: number): void {\n    selectedIndex = index;\n    isExpanded = false;\n  }\n</script>" />
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">2. Slot Rendering</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CodeBlock code="// Old way (Svelte 4)\n<div class=\"container\">\n  <slot name=\"header\"></slot>\n  <slot>Default content</slot>\n  <slot name=\"footer\"></slot>\n</div>" />
            <CodeBlock code="// New way (Svelte 5 Runes)\n<div class=\"container\">\n  {#render headerSlot?.()}\n    Header content\n  {/render}\n  {#render defaultSlot?.()}\n    Default content\n  {/render}\n  {#render footerSlot?.()}\n    Footer content\n  {/render}\n</div>" />
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">3. Snippet Rendering</h3>
          <CodeBlock code="// Svelte 5 Runes Snippet Example\n<script lang=\"ts\">\n  let items = $state<string[]>(['Item 1', 'Item 2']);\n</script>\n\n{#snippet itemRenderer(item)}\n  <li class=\"p-2 bg-surface-100\">{item}</li>\n{/snippet}\n\n<ul>\n  {#each items as item}\n    {@render itemRenderer(item)}\n  {/each}\n</ul>" />
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">4. Dynamic Components</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CodeBlock code="// Old way (Svelte 4)\n<svelte:component this={componentType} {...props} />" />
            <CodeBlock code="// New way (Svelte 5 Runes)\n<{componentType} {...props} />" />
          </div>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">5. Component Events</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CodeBlock code="// Old way (Svelte 4)\n// Child component\nimport { createEventDispatcher } from 'svelte';\nconst dispatch = createEventDispatcher();\nfunction notify() {\n  dispatch('message', { text: 'Hello' });\n}\n\n// Parent\n<Child on:message={handleMessage} />" />
            <CodeBlock code="// New way (Svelte 5 Runes)\n// Child component\nconst { onMessage } = $props();\nfunction notify() {\n  onMessage?.({ text: 'Hello' });\n}\n\n// Parent\n<Child onMessage={handleMessage} />" />
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
            <li><strong>Console debugging:</strong> Use $inspect(value) or $state.snapshot(value) instead of console.log for $state variables</li>
          </ul>
        </div>
      </div>
    {/if}
    
    {#if activeTab === 'gunjs'}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Gun.js Integration with Svelte 5 Runes</h2>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">1. Data Loading Pattern</h3>
          <CodeBlock code={'// Load data from Gun.js with Runes reactivity\nimport { getGun, nodes } from "$lib/services/gunService";\n\n// State for data and loading\nlet userData = $state<User | null>(null);\nlet isLoading = $state(true);\nlet error = $state<string | null>(null);\n\n// Effect for data loading\n$effect(async () => {\n  try {\n    // Create function to update loading state\n    const setLoading = (state: boolean) => {\n      isLoading = state;\n    };\n    setLoading(true);\n    \n    const gun = getGun();\n    if (!gun) {\n      throw new Error("Gun not initialized");\n    }\n    \n    // Using Promise for cleaner async handling\n    const result = await new Promise<User | null>((resolve) => {\n      // Set a timeout to prevent indefinite waiting\n      const timeout = setTimeout(() => {\n        console.log("Gun query timed out");\n        resolve(null);\n      }, 5000);\n      \n      // Query Gun database\n      gun.get(nodes.users).get(userId).once((data: User) => {\n        clearTimeout(timeout);\n        resolve(data);\n      });\n    });\n    \n    // Function to update state safely\n    const updateUserData = (data: User | null) => {\n      if (data) {\n        userData = data;\n      } else {\n        error = "Data not found";\n      }\n    };\n    \n    // Call the function with our result\n    updateUserData(result);\n  } catch (err) {\n    console.error("Error loading data:", err);\n    // Function to set error state\n    const setError = (err: any) => {\n      error = err instanceof Error ? err.message : "Unknown error";\n    };\n    setError(err);\n  } finally {\n    // Set loading state with separate function\n    const setLoading = (state: boolean) => {\n      isLoading = state;\n    };\n    setLoading(false);\n  }\n});'} />
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">2. Reactive Subscriptions</h3>
          <CodeBlock code={'// Subscribe to real-time Gun.js data with proper cleanup\nimport { getGun, nodes } from "$lib/services/gunService";\n\n// State for subscription data\nlet liveData = $state<any[]>([]);\n\n// Svelte 5 Runes effect with cleanup\n$effect(() => {\n  const gun = getGun();\n  if (!gun) return;\n  \n  // Create subscription\n  const subscription = gun.get(nodes.games)\n    .map()\n    .on((gameData, gameId) => {\n      if (!gameData) return;\n      \n      // Update state safely with immutable pattern and a separate function\n      // Avoiding direct state mutation in the callback to prevent state_unsafe_mutation errors\n      const updatedData = [...liveData.filter(g => g.game_id !== gameData.game_id), \n                      { ...gameData, game_id: gameId }];\n      // Update state with the new array\n      liveData = updatedData;\n    });\n  \n  // Clean up subscription on component teardown\n  return () => {\n    if (subscription && subscription.off) {\n      subscription.off();\n    }\n  };\n});'} />
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">3. Saving Data</h3>
          <CodeBlock code={'// Save data to Gun.js with proper state handling\nimport { getGun, nodes } from "$lib/services/gunService";\n\n// State for save operation\nlet isSaving = $state(false);\nlet saveError = $state<string | null>(null);\nlet formData = $state({\n  name: "",\n  description: ""\n});\n\n// Save function\nasync function saveToGun() {\n  try {\n    // Set saving state with a separate function\n    const setSavingState = (state: boolean) => {\n      isSaving = state;\n    };\n    setSavingState(true);\n    \n    // Clear error with a separate function\n    const clearError = () => {\n      saveError = null;\n    };\n    clearError();\n    \n    const gun = getGun();\n    if (!gun) {\n      throw new Error("Gun not initialized");\n    }\n    \n    // Generate ID if needed\n    const newId = `item_${Date.now()}`;\n    \n    // Create item data\n    const itemData = {\n      item_id: newId,\n      name: formData.name,\n      description: formData.description,\n      created_at: Date.now()\n    };\n    \n    // Save with promise wrapper for better async handling\n    await new Promise((resolve, reject) => {\n      // Use regular string instead of interpolated string with state variables\n      console.log("Starting save to items node");\n      gun.get(nodes.items).get(newId).put(itemData, (ack) => {\n        if (ack.err) {\n          console.error("Save error:", ack.err);\n          reject(new Error(ack.err));\n        } else {\n          // Simple string log without state variables\n          console.log("Item saved successfully");\n          resolve(true);\n        }\n      });\n      \n      // Also resolve after timeout to prevent hanging\n      setTimeout(resolve, 2000);\n    });\n    \n    // Reset form on success with a separate function\n    const resetForm = () => {\n      formData = { name: "", description: "" };\n    };\n    resetForm();\n    \n  } catch (err) {\n    console.error("Error saving data:", err);\n    // Set error state with a separate function\n    const setErrorState = (err: any) => {\n      saveError = err instanceof Error ? err.message : "Unknown error";\n    };\n    setErrorState(err);\n  } finally {\n    // Set saving state with a separate function (reuse from above)\n    const setSavingState = (state: boolean) => {\n      isSaving = state;\n    };\n    setSavingState(false);\n  }\n}'} />
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
    
    {#if activeTab === 'migration'}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Migration Tips</h2>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">1. Incremental Approach</h3>
          <p class="mb-4">For the Polycentricity3 project, we recommend an incremental migration approach rather than using the automated migration script. This helps maintain stability while adopting Svelte 5 features.</p>
          
          <ol class="list-decimal pl-6 space-y-2">
            <li><strong>Start with new components</strong> - Use Runes mode for all new components</li>
            <li><strong>Focus on isolated components first</strong> - Components with fewer dependencies</li>
            <li><strong>Update leaf components before parents</strong> - Work your way up the component tree</li>
            <li><strong>Keep consistent patterns</strong> - Follow this guide for consistent implementation</li>
            <li><strong>Test thoroughly after each migration</strong> - Especially for critical paths</li>
          </ol>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">2. Common Conversion Patterns</h3>
          <table class="w-full">
            <thead class="bg-surface-200 dark:bg-surface-700">
              <tr>
                <th class="p-2 text-left">Svelte 4 Feature</th>
                <th class="p-2 text-left">Svelte 5 Runes Equivalent</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-surface-200 dark:border-surface-700">
                <td class="p-2"><code>let count = 0;</code></td>
                <td class="p-2"><code>let count = $state(0);</code></td>
              </tr>
              <tr class="border-b border-surface-200 dark:border-surface-700">
                <td class="p-2"><code>export let name;</code></td>
                <td class="p-2"><code>const { name } = $props();</code></td>
              </tr>
              <tr class="border-b border-surface-200 dark:border-surface-700">
                <td class="p-2"><code>$: doubled = count * 2;</code></td>
                <td class="p-2"><code>let doubled = $derived(() => count * 2);</code></td>
              </tr>
              <tr class="border-b border-surface-200 dark:border-surface-700">
                <td class="p-2"><code>$: console.log(count);</code></td>
                <td class="p-2"><code>$effect(() => console.log(count));</code></td>
              </tr>
              <tr class="border-b border-surface-200 dark:border-surface-700">
                <td class="p-2"><code>&lt;on:click={handler}&gt;</code></td>
                <td class="p-2"><code>&lt;onclick={handler}&gt;</code></td>
              </tr>
              <tr class="border-b border-surface-200 dark:border-surface-700">
                <td class="p-2"><code>&lt;slot&gt;Default&lt;/slot&gt;</code></td>
                <td class="p-2"><code>{#render slotName?.()} content {/render}</code></td>
              </tr>
              <tr class="border-b border-surface-200 dark:border-surface-700">
                <td class="p-2"><code>&lt;svelte:component this={Comp} /&gt;</code></td>
                <td class="p-2"><code>&lt;{Comp} /&gt;</code></td>
              </tr>
              <tr>
                <td class="p-2"><code>createEventDispatcher()</code></td>
                <td class="p-2"><code>const { onEvent } = $props();</code></td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="card p-4 bg-surface-100-800-token">
          <h3 class="text-lg font-semibold mb-3">3. Migration Checklist</h3>
          <ul class="list-disc pl-6 space-y-2">
            <li>☐ Update reactive variable declarations to use $state</li>
            <li>☐ Convert props to use $props()</li>
            <li>☐ Replace $: reactive declarations with $derived</li>
            <li>☐ Update reactive statements with $effect</li>
            <li>☐ Convert on:event to onclick style handlers</li>
            <li>☐ Update component slots to use render tags</li>
            <li>☐ Replace svelte:component with dynamic components</li>
            <li>☐ Update event dispatchers to use props callbacks</li>
            <li>☐ Add proper type annotations to $state variables</li>
            <li>☐ Fix event handler types for DOM events</li>
            <li>☐ Escape code blocks with CodeBlock component or HTML entities</li>
          </ul>
        </div>
        
        <div class="alert variant-ghost-warning p-4 my-4">
          <div class="flex items-center gap-4">
            <div>
              <icons.AlertTriangle class="text-warning-500" size={24} />
            </div>
            <div class="flex-1">
              <h4 class="font-semibold">Migration Warning</h4>
              <p>The automated migration script is not recommended for our project due to our complex Gun.js integration and specialized components. Follow this guide for manual, incremental migration instead.</p>
            </div>
          </div>
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