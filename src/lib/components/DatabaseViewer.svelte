<script>
  import { onMount } from 'svelte';
  import gun from '$lib/services/gun-db';
  
  // Reactive state with runes
  let rootKey = $state('cards');  // Default root key
  let dbData = $state(null);
  let error = $state(null);
  let isLoading = $state(true);

  // Safely stringify circular references
  function safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    }, 2);
  }

  // Fetch data when rootKey changes
  $effect(() => {
    error = null;
    dbData = null;
    isLoading = true;
    
    // Log to console for debugging
    console.log(`Fetching data for key: ${rootKey}`);
    
    // Using .map().once() to get all items at this level
    gun.get(rootKey).map().once((data, key) => {
      console.log(`Found data for ${rootKey}/${key}:`, data);
    });
    
    // Using .open() to get a deep snapshot
    gun.get(rootKey).open((data) => {
      console.log(`Open data for ${rootKey}:`, data);
      
      if (data) {
        try {
          // Process the data to expand GUN references
          const processedData = processGunReferences(data);
          dbData = safeStringify(processedData);
        } catch (e) {
          console.error("Error processing data:", e);
          error = `Error serializing data: ${e.message}`;
        }
      } else {
        error = `No data found for key: ${rootKey}`;
      }
      isLoading = false;
    });
  });
  
  // Helper to process and display Gun references more nicely
  function processGunReferences(data) {
    if (!data || typeof data !== 'object') return data;
    
    const result = {};
    
    // Process each property
    Object.keys(data).forEach(key => {
      // Skip internal Gun keys
      if (key === '_' || key === '#') {
        result[key] = data[key];
        return;
      }
      
      const value = data[key];
      
      // Handle Gun reference objects (format: {"#": "path"})
      if (value && typeof value === 'object' && value['#'] && Object.keys(value).length === 1) {
        result[key] = `[GUN Reference → ${value['#']}]`;
      } 
      // Handle nested objects
      else if (value && typeof value === 'object') {
        result[key] = processGunReferences(value);
      } 
      // Handle primitive values
      else {
        result[key] = value;
      }
    });
    
    return result;
  }

  // Common root keys for quick access
  const commonKeys = [
    'cards',
    'actors',
    'values',
    'capabilities',
    'decks',
    'games',
    'users',
    'chats',
    'agreements'
  ];
</script>

<div class="container p-4 bg-surface-100-800-token">
  <h1 class="h2 mb-4">Gun.js Database Explorer</h1>
  
  <div class="mb-4">
    <label for="rootKey" class="label">Database Root Key:</label>
    <div class="flex gap-2">
      <input
        id="rootKey"
        type="text"
        bind:value={rootKey}
        class="input p-2 w-full"
        placeholder="e.g., cards"
      />
      <button 
        class="btn variant-filled-primary" 
        on:click={() => rootKey = rootKey}>
        Refresh
      </button>
    </div>
  </div>
  
  <div class="mb-4">
    <div class="label">Quick Access:</div>
    <div class="flex flex-wrap gap-2">
      {#each commonKeys as key}
        <button 
          class="btn {rootKey === key ? 'variant-filled-primary' : 'variant-soft'}"
          on:click={() => rootKey = key}>
          {key}
        </button>
      {/each}
    </div>
  </div>
  
  <div class="card">
    <header class="card-header flex justify-between items-center">
      <h2 class="h4">Data for "{rootKey}"</h2>
      <div>
        {#if isLoading}
          <span class="badge variant-soft">Loading...</span>
        {:else if dbData}
          <span class="badge variant-filled-success">Data Loaded</span>
        {:else}
          <span class="badge variant-filled-error">No Data</span>
        {/if}
      </div>
    </header>
    
    <section class="p-4">
      {#if error}
        <p class="text-error-500">{error}</p>
      {:else if isLoading}
        <div class="flex justify-center items-center p-6">
          <div class="spinner-third w-8 h-8"></div>
        </div>
      {:else if dbData}
        <pre class="bg-surface-200-700-token p-4 rounded-container-token overflow-auto max-h-[600px] text-sm whitespace-pre-wrap">{dbData}</pre>
      {:else}
        <p class="text-center p-4">No data available for this key</p>
      {/if}
    </section>
  </div>
</div>