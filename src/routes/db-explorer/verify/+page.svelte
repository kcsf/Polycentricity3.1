<script lang="ts">
  import { onMount } from 'svelte';
  import { getCollection, getGun } from '$lib/services/gunService';
  import type { Game, Actor, Card, Deck, Agreement } from '$lib/types';

  // Reactive state with runes
  let data = $state<{
    games: Record<string, Game>;
    actors: Record<string, Actor>;
    cards: Record<string, Card>;
    decks: Record<string, Deck>;
    agreements: Record<string, Agreement>;
  } | null>(null);
  let error = $state<string | null>(null);
  let isLoading = $state(true);

  // Safely stringify with circular reference handling and inline one-level GUN references
  function safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (key, value) => {
        // Handle circular refs
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        // Inline GUN reference one level deep only
        if (
          value &&
          typeof value === 'object' &&
          Object.keys(value).length === 1 &&
          '#' in value
        ) {
          const path: string = value['#'];
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

  // Map rootKey to the correct ID field for each type
  function getIdField<T extends Game | Actor | Card | Deck | Agreement>(item: T, rootKey: string): string {
    switch (rootKey) {
      case 'games':
        return (item as Game).game_id;
      case 'actors':
        return (item as Actor).actor_id;
      case 'cards':
        return (item as Card).card_id;
      case 'decks':
        return (item as Deck).deck_id;
      case 'agreements':
        return (item as Agreement).agreement_id;
      default:
        throw new Error(`Unknown rootKey: ${rootKey}`);
    }
  }

  // Fetch raw data for a given root key using getCollection
  async function fetchRawData<T extends Game | Actor | Card | Deck | Agreement>(
    rootKey: string
  ): Promise<Record<string, T>> {
    try {
      const items = await getCollection<T>(rootKey);
      return Object.fromEntries(items.map((item) => [getIdField(item, rootKey), item]));
    } catch (e: any) {
      throw new Error(`Error accessing raw data for ${rootKey}: ${e.message}`);
    }
  }

  // Fetch all relevant data, now including agreements
  async function fetchAllData() {
    try {
      const [games, actors, cards, decks, agreements] = await Promise.all([
        fetchRawData<Game>('games'),
        fetchRawData<Actor>('actors'),
        fetchRawData<Card>('cards'),
        fetchRawData<Deck>('decks'),
        fetchRawData<Agreement>('agreements'),
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
    const gunInstance = getGun();
    if (gunInstance) {
      (window as any).gun = gunInstance;
    }
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