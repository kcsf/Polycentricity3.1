<!-- src/routes/db-explorer/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import gun from '$lib/services/gun-db';

  // State management
  let rootKey = $state<string>('cards');
  let deepData = $state<string | null>(null);
  let rawData = $state<string | null>(null);
  let error = $state<string | null>(null);
  let isLoading = $state(true);
  let activeTab = $state<'deep' | 'raw'>('deep');
  let openLoaded = $state(false);

  // Enhanced open.js loading with fallback
  onMount(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/gun/lib/open.js';
    script.async = true;
    
    const loadTimeout = setTimeout(() => {
      console.warn('open.js load timeout - falling back to raw mode');
      openLoaded = false;
      isLoading = false;
      error = 'open.js plugin failed to load - using raw view only';
    }, 5000);

    script.onload = () => {
      clearTimeout(loadTimeout);
      openLoaded = true;
      if (activeTab === 'deep') refreshData();
    };

    script.onerror = () => {
      clearTimeout(loadTimeout);
      openLoaded = false;
      error = 'Failed to load open.js plugin';
      isLoading = false;
    };

    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
      clearTimeout(loadTimeout);
    };
  });

  // Circular reference handling
  function safeStringify(obj: unknown): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (_, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
        if (value['#']) return `[GUN Ref: ${value['#']}]`;
      }
      return value;
    }, 2);
  }

  const commonKeys = $state<string[]>([
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
  ]);

  async function fetchDeepData(): Promise<string> {
    if (!openLoaded) throw new Error('open.js not loaded');
    
    try {
      const pathSegments = rootKey.split('/').filter(Boolean);
      let gunRef = gun.get(pathSegments[0]);
      
      pathSegments.slice(1).forEach(segment => {
        gunRef = gunRef.get(segment);
      });

      return new Promise<string>((resolve, reject) => {
        const data: Record<string, any> = {};
        let pending = 0;
        let completed = false;

        const complete = () => {
          if (completed || pending > 0) return;
          completed = true;
          (gunRef as any).off();
          resolve(data ? safeStringify(data) : 'No data');
        };

        (gunRef as any).open((nodeData: any, key: string) => {
          if (nodeData && key && key !== '_') {
            pending++;
            data[key] = nodeData;
            // Recursively fetch nested references
            const refs = ['values_ref', 'capabilities_ref', 'decks_ref', 'agreements_ref'];
            Promise.all(refs.map(ref => new Promise<void>(res => {
              if (nodeData[ref] && typeof nodeData[ref] === 'object') {
                const refKeys = Object.keys(nodeData[ref]);
                let refPending = refKeys.length;
                if (refPending === 0) res();
                refKeys.forEach(refKey => {
                  const refPath = ref === 'values_ref' ? 'values' : ref === 'capabilities_ref' ? 'capabilities' : ref === 'decks_ref' ? 'decks' : 'agreements';
                  gun.get(refPath).get(refKey).open((refData: any) => {
                    if (refData) {
                      data[key][ref][refKey] = refData;
                    }
                    refPending--;
                    if (refPending === 0) res();
                  });
                });
              } else {
                res();
              }
            }))).then(() => {
              pending--;
              complete();
            });
          }
        });

        setTimeout(() => {
          if (!completed) {
            completed = true;
            (gunRef as any).off();
            resolve(data ? safeStringify(data) : 'No data');
          }
        }, 5000); // 5s timeout
      });
    } catch (e) {
      throw new Error(`Deep fetch error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function fetchRawData(): Promise<string> {
    try {
      const pathSegments = rootKey.split('/').filter(Boolean);
      let gunRef = gun.get(pathSegments[0]);
      
      pathSegments.slice(1).forEach(segment => {
        gunRef = gunRef.get(segment);
      });

      const nodes: Record<string, unknown> = {};
      await new Promise<void>((resolve) => {
        gunRef.map().once((data: unknown, key: string) => {
          if (key && key !== '_' && data) {
            nodes[key] = data;
          }
        });
        setTimeout(resolve, 2000); // Increased to 2000ms
      });
      return safeStringify(nodes);
    } catch (e) {
      throw new Error(`Raw fetch error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function refreshData() {
    error = null;
    isLoading = true;
    
    try {
      if (activeTab === 'deep') {
        deepData = await fetchDeepData();
      } else {
        rawData = await fetchRawData();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    if (openLoaded || activeTab === 'raw') {
      refreshData();
    }
  });
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

  <div class="tabs mb-4">
    <button
      class="btn {activeTab === 'deep' ? 'variant-filled-primary' : 'variant-soft'}"
      onclick={() => { activeTab = 'deep'; refreshData(); }}
    >
      Deep View
    </button>
    <button
      class="btn {activeTab === 'raw' ? 'variant-filled-primary' : 'variant-soft'}"
      onclick={() => { activeTab = 'raw'; refreshData(); }}
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