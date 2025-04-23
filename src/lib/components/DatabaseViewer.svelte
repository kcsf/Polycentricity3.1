<!-- src/routes/db-explorer/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import gun from '$lib/services/gun-db';

  // Reactive state with runes
  let rootKey = $state('cards'); // Default root key
  let deepData = $state<string | null>(null); // For Deep tab
  let rawData = $state<string | null>(null); // For Raw tab
  let error = $state<string | null>(null);
  let isLoading = $state(true);
  let activeTab = $state('deep'); // Track active tab: 'deep' or 'raw'

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
  function safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        if (value && typeof value === 'object' && value['#'] && Object.keys(value).length === 1) {
          return `[GUN Reference → ${value['#']}]`;
        }
        return value;
      },
      2
    );
  }

  // Fetch deep data using open.js
  async function fetchDeepData() {
    if (!openLoaded) {
      console.log('Waiting for Gun open.js to load...');
      return;
    }
    try {
      const pathSegments = rootKey.split('/').filter(Boolean);
      let gunRef = gun;
      pathSegments.forEach(segment => {
        gunRef = gunRef.get(segment);
      });

      if (typeof gunRef.open !== 'function') {
        throw new Error('Gun.js open plugin not loaded yet');
      }

      return new Promise<string>((resolve) => {
        gunRef.open((data: any) => {
          if (data) {
            resolve(safeStringify(data));
          } else {
            resolve('No data found');
          }
        });
      });
    } catch (e) {
      throw new Error(`Error accessing deep data: ${e.message}`);
    }
  }

  // Fetch raw data (flat key/value pairs)
  async function fetchRawData() {
    try {
      const pathSegments = rootKey.split('/').filter(Boolean);
      let gunRef = gun;
      pathSegments.forEach(segment => {
        gunRef = gunRef.get(segment);
      });

      const nodes: Record<string, any> = {};
      await new Promise<void>((resolve) => {
        gunRef.map().once((data, key) => {
          if (key && key !== '_' && data) {
            nodes[key] = { ...data, _: undefined };
          }
        });
        setTimeout(resolve, 500);
      });

      return safeStringify(nodes);
    } catch (e) {
      throw new Error(`Error accessing raw data: ${e.message}`);
    }
  }

  // Refresh data based on active tab
  async function refreshData() {
    if (!openLoaded && activeTab === 'deep') {
      console.log('Waiting for Gun open.js to load...');
      isLoading = true;
      return;
    }

    error = null;
    if (activeTab === 'deep') {
      deepData = null;
    } else {
      rawData = null;
    }
    isLoading = true;

    console.log(`Fetching ${activeTab} data for key: ${rootKey}`);
    try {
      if (activeTab === 'deep') {
        deepData = await fetchDeepData();
      } else {
        rawData = await fetchRawData();
      }
    } catch (e) {
      console.error(`Error fetching ${activeTab} data:`, e);
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  // Fetch data when rootKey or activeTab changes
  $effect(() => {
    if (openLoaded || activeTab === 'raw') {
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
    'chat_rooms',
    'chat_messages',
    'agreements',
    'node_positions'
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
        on:click={() => refreshData()}
      >
        Refresh
      </button>
      <a 
        href="/reset"
        class="btn variant-filled-error"
      >
        Reset DB
      </a>
    </div>
  </div>

  <div class="mb-4">
    <div class="label">Quick Access:</div>
    <div class="flex flex-wrap gap-2">
      {#each commonKeys as key}
        <button
          class="btn {rootKey === key ? 'variant-filled-primary' : 'variant-soft'}"
          on:click={() => {
            rootKey = key;
            refreshData();
          }}
        >
          {key}
        </button>
      {/each}
    </div>
  </div>

  <div class="tabs mb-4">
    <button
      class="btn {activeTab === 'deep' ? 'variant-filled-primary' : 'variant-soft'}"
      on:click={() => { activeTab = 'deep'; refreshData(); }}
    >
      Deep View
    </button>
    <button
      class="btn {activeTab === 'raw' ? 'variant-filled-primary' : 'variant-soft'}"
      on:click={() => { activeTab = 'raw'; refreshData(); }}
    >
      Raw View
    </button>
  </div>

  <div class="card">
    <header class="card-header flex justify-between items-center">
      <h2 class="h4">{activeTab === 'deep' ? 'Deep' : 'Raw'} Data for "{rootKey}"</h2>
      <div>
        {#if isLoading}
          <span class="badge variant-soft">Loading...</span>
        {:else if activeTab === 'deep' && deepData || activeTab === 'raw' && rawData}
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
      {:else if activeTab === 'deep' && deepData}
        <pre
          class="bg-surface-200-700-token p-4 rounded-container-token overflow-auto max-h-[600px] text-sm whitespace-pre-wrap"
        >
          {deepData}
        </pre>
      {:else if activeTab === 'raw' && rawData}
        <pre
          class="bg-surface-200-700-token p-4 rounded-container-token overflow-auto max-h-[600px] text-sm whitespace-pre-wrap"
        >
          {rawData}
        </pre>
      {:else}
        <p class="text-center p-4">No data available for this key</p>
      {/if}
    </section>
  </div>
</div>