<script>
  import { onMount } from 'svelte';
  import gun from '$lib/services/gun-db';
  
  // Need to import Gun.js 'open' plugin
  import 'gun/lib/open.js';
  
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
    
    try {
      // Handle nested paths (e.g., 'cards/card_id/values')
      const pathSegments = rootKey.split('/').filter(Boolean);
      
      // Start with the base reference
      let gunRef = gun;
      
      // Build up the path
      pathSegments.forEach(segment => {
        gunRef = gunRef.get(segment);
      });
      
      // Log all direct child items first to help with debugging
      console.log(`Fetching all direct children of '${rootKey}':`);
      gunRef.map().once((data, key) => {
        console.log(`Found entry: ${key}`, data);
      });
      
      // Now get a deeper view with open
      console.log(`Getting deep data from '${rootKey}'`);
      gunRef.open((data) => {
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
    } catch (e) {
      console.error("Error accessing Gun data:", e);
      error = `Error: ${e.message}`;
      isLoading = false;
    }
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
        // Store the reference path for later navigation
        const refPath = value['#'];
        result[key] = {
          type: 'gun-reference',
          path: refPath,
          display: `[GUN Reference → ${refPath}]`
        };
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
  
  // Navigation history for breadcrumb
  let pathHistory = $state([]);
  
  // Navigate to a Gun.js reference 
  function navigateToReference(path) {
    // Add current path to history unless already there
    if (rootKey && !pathHistory.includes(rootKey)) {
      pathHistory = [...pathHistory, rootKey];
    }
    
    // Set new path
    rootKey = path;
  }
  
  // Go back to previous path
  function navigateBack() {
    if (pathHistory.length > 0) {
      // Take the last path from history
      const previousPath = pathHistory.pop();
      // Update history without the removed path
      pathHistory = [...pathHistory];
      // Set rootKey to previous path
      if (previousPath) {
        rootKey = previousPath;
      }
    }
  }

  // Function to render the data with clickable links for references
  function renderDbDataWithLinks(data) {
    if (!data) return '';
    
    // Helper to handle different data types for rendering
    function renderValue(val, indent = 0) {
      if (val === null) return '<span class="text-error-500">null</span>';
      if (val === undefined) return '<span class="text-error-500">undefined</span>';
      
      // Format indentation
      const padding = '  '.repeat(indent);
      
      // Handle Gun.js reference objects (special format we created)
      if (val && typeof val === 'object' && val.type === 'gun-reference') {
        return `<a href="#" class="text-primary-500 underline" onclick="window.navigateToPath('${val.path}'); return false;">${val.display}</a>`;
      }
      
      // Handle arrays
      if (Array.isArray(val)) {
        if (val.length === 0) return '[]';
        
        let result = '[\n';
        val.forEach((item, i) => {
          result += `${padding}  ${renderValue(item, indent + 1)}${i < val.length - 1 ? ',' : ''}\n`;
        });
        result += `${padding}]`;
        return result;
      }
      
      // Handle objects
      if (typeof val === 'object') {
        const keys = Object.keys(val);
        if (keys.length === 0) return '{}';
        
        let result = '{\n';
        keys.forEach((key, i) => {
          const formattedKey = `<span class="text-tertiary-500">"${key}"</span>`;
          result += `${padding}  ${formattedKey}: ${renderValue(val[key], indent + 1)}${i < keys.length - 1 ? ',' : ''}\n`;
        });
        result += `${padding}}`;
        return result;
      }
      
      // Handle primitive types
      if (typeof val === 'string') {
        return `<span class="text-success-500">"${val.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"</span>`;
      }
      if (typeof val === 'number') {
        return `<span class="text-warning-500">${val}</span>`;
      }
      if (typeof val === 'boolean') {
        return `<span class="text-primary-500">${val}</span>`;
      }
      
      // Default for any other types
      return String(val);
    }
    
    // Expose navigation function to window for event handling
    if (typeof window !== 'undefined') {
      window.navigateToPath = (path) => {
        navigateToReference(path);
      };
    }
    
    return renderValue(data);
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
  
  <!-- Breadcrumbs Navigation -->
  {#if pathHistory.length > 0}
    <div class="mb-4 flex items-center text-sm">
      <button 
        class="btn btn-sm variant-soft mr-2"
        on:click={navigateBack}
      >
        ← Back
      </button>
      
      <div class="breadcrumbs">
        {#each pathHistory as path, i}
          <span>
            <button 
              class="btn btn-sm variant-ghost-primary"
              on:click={() => {
                // Go to this path and truncate history to this point
                pathHistory = pathHistory.slice(0, i);
                rootKey = path;
              }}
            >
              {path}
            </button>
            {#if i < pathHistory.length - 1}
              <span class="mx-1">→</span>
            {/if}
          </span>
        {/each}
        <span class="mx-1">→</span>
        <span class="font-bold">{rootKey}</span>
      </div>
    </div>
  {/if}
  
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
        <div class="bg-surface-200-700-token p-4 rounded-container-token overflow-auto max-h-[600px] text-sm">
          <!-- Custom rendering to make references clickable -->
          <pre class="whitespace-pre-wrap">{@html renderDbDataWithLinks(JSON.parse(dbData))}</pre>
        </div>
      {:else}
        <p class="text-center p-4">No data available for this key</p>
      {/if}
    </section>
  </div>
</div>