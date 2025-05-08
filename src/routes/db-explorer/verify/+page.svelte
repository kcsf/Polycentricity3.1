<script lang="ts">
  import { onMount } from 'svelte';
  import gun from '$lib/services/gun-db';

  // Reactive state with runes
  let data = $state<{
    games: Record<string, any>;
    actors: Record<string, any>;
    cards: Record<string, any>;
    decks: Record<string, any>;
    agreements: Record<string, any>;
  } | null>(null);
  let error = $state<string | null>(null);
  let isLoading = $state(true);

  // Safely stringify with circular reference handling and inline one-level GUN references
  function safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (key, value) => {
        // handle circular refs
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        // inline GUN reference one level deep only
        if (
          value && typeof value === 'object' &&
          Object.keys(value).length === 1 && '#' in value
        ) {
          const path: string = (value as any)['#'];
          const [rootKey, id] = path.split('/');
          const nodeData = data?.[rootKey as keyof typeof data]?.[id];
          if (nodeData && typeof nodeData === 'object') {
            const inlineRecord: Record<string, any> = { '#': path };
            for (const [k, v] of Object.entries(nodeData)) {
              if (typeof v !== 'object' || v === null) {
                inlineRecord[k] = v;
              }
            }
            return inlineRecord;
          }
          return `[GUN Reference → ${path}]`;
        }
        return value;
      },
      2
    );
  }

  // Fetch raw data for a given root key
  async function fetchRawData(rootKey: string): Promise<Record<string, any>> {
    try {
      const nodes: Record<string, any> = {};
      await new Promise<void>((resolve) => {
        gun.get(rootKey).map().once((node, key) => {
          if (key && key !== '_' && node) {
            const { _, ...clean } = node;
            nodes[key] = clean;
          }
        });
        setTimeout(resolve, 500);
      });
      return nodes;
    } catch (e: any) {
      throw new Error(`Error accessing raw data for ${rootKey}: ${e.message}`);
    }
  }

  // Fetch all relevant data, now including agreements
  async function fetchAllData() {
    try {
      const [games, actors, cards, decks, agreements] = await Promise.all([
        fetchRawData('games'),
        fetchRawData('actors'),
        fetchRawData('cards'),
        fetchRawData('decks'),
        fetchRawData('agreements'),
      ]);
      data = { games, actors, cards, decks, agreements };
    } catch (e: any) {
      console.error('Error fetching verification data:', e);
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  // Load data on mount
  onMount(() => {
    fetchAllData();
    (window as any).gun = gun;
  });
</script>

<div class="container p-4 bg-surface-100-800-token">
  <h1 class="h2 mb-4">Database Verification View</h1>

  <div class="card">
    <header class="card-header flex justify-between items-center">
      <h2 class="h4">Verification Data (Raw View)</h2>
      <div>
        {#if isLoading}
          <span class="badge variant-soft">Loading...</span>
        {:else if data}
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
      {:else if data}
        <div class="space-y-4">
          {#each Object.entries(data) as [key, value]}
            <div>
              <h3 class="h5 mb-2">{key}</h3>
              <pre
                class="bg-surface-200-700-token p-4 rounded-container-token overflow-auto max-h-[400px] text-sm whitespace-pre-wrap"
              >
                {safeStringify(value)}
              </pre>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-center p-4">No data available</p>
      {/if}
    </section>
  </div>
</div>
