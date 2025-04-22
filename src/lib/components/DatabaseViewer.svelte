<script>
  import { onMount } from 'svelte';
  import gun from '$lib/services/gun-db';

  // Reactive state with runes
  let rootKey = $state('cards'); // Default root key
  let dbData = $state(null);
  let error = $state(null);
  let isLoading = $state(true);

  // Flag to track if open.js is loaded
  let openLoaded = $state(false);
  
  // Load Gun.js open plugin dynamically in browser
  onMount(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/gun/lib/open.js';
    script.async = true;
    script.onload = () => {
      console.log('Gun open.js loaded');
      openLoaded = true;
      // Trigger data refresh once loaded
      refreshData();
    };
    script.onerror = () => {
      console.error('Failed to load Gun open.js');
      error = 'Failed to load Gun open.js plugin';
      isLoading = false;
    };
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  });

  // Safely stringify with circular reference handling
  function safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        // Simplify Gun references
        if (value && typeof value === 'object' && value['#'] && Object.keys(value).length === 1) {
          return `[GUN Reference → ${value['#']}]`;
        }
        return value;
      },
      2
    );
  }

  // Function to refresh data
  function refreshData() {
    if (!openLoaded) {
      console.log('Waiting for Gun open.js to load...');
      isLoading = true;
      return; // Don't proceed until open.js is loaded
    }
    
    error = null;
    dbData = null;
    isLoading = true;

    console.log(`Fetching data for key: ${rootKey}`);
    try {
      // Handle nested paths (e.g., 'cards/card_id/values')
      const pathSegments = rootKey.split('/').filter(Boolean);
      let gunRef = gun;
      pathSegments.forEach(segment => {
        gunRef = gunRef.get(segment);
      });

      // Log direct children for debugging
      console.log(`Fetching all direct children of '${rootKey}':`);
      gunRef.map().once((data, key) => {
        console.log(`Found entry: ${key}`, data);
      });

      // Check if open method is available before using it
      if (typeof gunRef.open !== 'function') {
        console.error('Gun.js open plugin not loaded yet');
        error = 'Gun.js open plugin not loaded yet. Please try again in a moment.';
        isLoading = false;
        return;
      }

      // Fetch deep data with open
      console.log(`Getting deep data from '${rootKey}'`);
      gunRef.open((data) => {
        console.log(`Open data for ${rootKey}:`, data);
        if (data) {
          try {
            dbData = safeStringify(data);
          } catch (e) {
            console.error('Error serializing data:', e);
            error = `Error serializing data: ${e.message}`;
          }
        } else {
          error = `No data found for key: ${rootKey}`;
        }
        isLoading = false;
      });
    } catch (e) {
      console.error('Error accessing Gun data:', e);
      error = `Error: ${e.message}`;
      isLoading = false;
    }
  }

  // Fetch data when rootKey changes
  $effect(() => {
    // This effect runs whenever rootKey changes
    if (openLoaded) {
      refreshData();
    } else {
      console.log('Waiting for Gun open.js to load before fetching data for', rootKey);
      isLoading = true;
    }
  });

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
        onclick={() => refreshData()}
      >
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
          onclick={() => {
            rootKey = key;
            refreshData();
          }}
        >
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
        <pre
          class="bg-surface-200-700-token p-4 rounded-container-token overflow-auto max-h-[600px] text-sm whitespace-pre-wrap"
        >
          {dbData}
        </pre>
      {:else}
        <p class="text-center p-4">No data available for this key</p>
      {/if}
    </section>
  </div>
</div>