<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import { Accordion, AccordionItem } from '@skeletonlabs/skeleton';
  import * as icons from 'svelte-lucide';

  // Data storage for each node type
  let cards: Record<string, any> = {};
  let values: Record<string, any> = {};
  let capabilities: Record<string, any> = {};
  let decks: Record<string, any> = {};
  let users: Record<string, any> = {};
  let games: Record<string, any> = {};
  let actors: Record<string, any> = {};
  let agreements: Record<string, any> = {};
  let positions: Record<string, any> = {};
  let chat: Record<string, any> = {};

  // Track subscription callbacks for cleanup
  let subscriptions: (() => void)[] = [];

  // Formatting helpers
  function formatJson(data: any): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error formatting JSON:', error);
      return `Error formatting data: ${error}`;
    }
  }

  function trimJsonSize(obj: any, maxSize = 1000): any {
    const str = JSON.stringify(obj);
    if (str.length <= maxSize) return obj;

    // For large objects, create a summary
    if (typeof obj === 'object' && obj !== null) {
      const isArray = Array.isArray(obj);
      const keys = Object.keys(obj);
      
      if (isArray) {
        return {
          type: 'Array',
          length: obj.length,
          preview: obj.slice(0, 3).map((item: any) => 
            typeof item === 'object' && item !== null
              ? { type: typeof item, keys: Object.keys(item).slice(0, 5) }
              : item
          ),
          note: `Array trimmed, total length: ${obj.length} items`
        };
      } else {
        return {
          type: 'Object',
          keys: keys.slice(0, 10),
          keyCount: keys.length,
          preview: Object.fromEntries(
            keys.slice(0, 5).map(k => [k, 
              typeof obj[k] === 'object' && obj[k] !== null
                ? { type: typeof obj[k], summary: 'Object/Array (nested)' }
                : obj[k]
            ])
          ),
          note: `Object trimmed, total keys: ${keys.length}`
        };
      }
    }
    
    return obj;
  }

  function loadData() {
    const gun = getGun();
    if (!gun) {
      console.error('Gun not initialized');
      return;
    }
    
    // Clear existing subscriptions
    subscriptions.forEach(unsub => unsub());
    subscriptions = [];

    // Helper to create subscription for a node type
    function subscribeToNodeType(nodeType: string, dataStore: Record<string, any>) {
      const unsub = gun.get(nodeType).map().on((data: any, key: string) => {
        if (data === null || data === undefined) {
          delete dataStore[key];
        } else {
          dataStore[key] = trimJsonSize(data);
        }
        dataStore = { ...dataStore }; // Trigger reactivity
      });
      
      subscriptions.push(unsub);
    }

    // Subscribe to all node types
    subscribeToNodeType(nodes.cards, cards);
    subscribeToNodeType(nodes.values, values);
    subscribeToNodeType(nodes.capabilities, capabilities);
    subscribeToNodeType(nodes.decks, decks);
    subscribeToNodeType(nodes.users, users);
    subscribeToNodeType(nodes.games, games);
    subscribeToNodeType(nodes.actors, actors);
    subscribeToNodeType(nodes.agreements, agreements);
    subscribeToNodeType(nodes.positions, positions);
    subscribeToNodeType('chat', chat); // Using string directly as it might not be in nodes object
  }

  onMount(() => {
    loadData();
  });

  onDestroy(() => {
    // Clean up subscriptions
    subscriptions.forEach(unsub => unsub());
  });
</script>

<div class="database-json">
  <div class="card p-4 bg-surface-100-800-token mb-4">
    <div class="flex items-center space-x-4">
      <svelte:component this={icons.Database} class="text-primary-500" />
      <div>
        <h3 class="h4">Database JSON Explorer</h3>
        <p class="text-sm">View raw JSON data from the Gun.js database.</p>
      </div>
    </div>
  </div>

  <div class="flex justify-end mb-4">
    <button class="btn variant-filled-primary" on:click={loadData}>
      <svelte:component this={icons.RefreshCcw} class="w-4 h-4 mr-2" />
      Refresh JSON Data
    </button>
  </div>

  <Accordion>
    <!-- Cards -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.CreditCard} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Cards ({Object.keys(cards).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(cards).length === 0}
          <p class="text-center p-4 text-surface-500">No card data found.</p>
        {:else}
          {#each Object.entries(cards) as [id, card]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(card)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>

    <!-- Values -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.Heart} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Values ({Object.keys(values).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(values).length === 0}
          <p class="text-center p-4 text-surface-500">No value data found.</p>
        {:else}
          {#each Object.entries(values) as [id, value]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(value)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>

    <!-- Capabilities -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.Zap} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Capabilities ({Object.keys(capabilities).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(capabilities).length === 0}
          <p class="text-center p-4 text-surface-500">No capability data found.</p>
        {:else}
          {#each Object.entries(capabilities) as [id, capability]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(capability)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>

    <!-- Decks -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.Layout} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Decks ({Object.keys(decks).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(decks).length === 0}
          <p class="text-center p-4 text-surface-500">No deck data found.</p>
        {:else}
          {#each Object.entries(decks) as [id, deck]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(deck)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>

    <!-- Users -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.Users} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Users ({Object.keys(users).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(users).length === 0}
          <p class="text-center p-4 text-surface-500">No user data found.</p>
        {:else}
          {#each Object.entries(users) as [id, user]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(user)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>

    <!-- Games -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.GameController} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Games ({Object.keys(games).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(games).length === 0}
          <p class="text-center p-4 text-surface-500">No game data found.</p>
        {:else}
          {#each Object.entries(games) as [id, game]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(game)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>

    <!-- Actors -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.UserCircle} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Actors ({Object.keys(actors).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(actors).length === 0}
          <p class="text-center p-4 text-surface-500">No actor data found.</p>
        {:else}
          {#each Object.entries(actors) as [id, actor]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(actor)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>

    <!-- Agreements -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.FileSignature} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Agreements ({Object.keys(agreements).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(agreements).length === 0}
          <p class="text-center p-4 text-surface-500">No agreement data found.</p>
        {:else}
          {#each Object.entries(agreements) as [id, agreement]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(agreement)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>

    <!-- Node Positions -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.MoveHorizontal} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Node Positions ({Object.keys(positions).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(positions).length === 0}
          <p class="text-center p-4 text-surface-500">No position data found.</p>
        {:else}
          {#each Object.entries(positions) as [id, position]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(position)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>

    <!-- Chat -->
    <AccordionItem>
      <svelte:fragment slot="lead">
        <svelte:component this={icons.MessageSquare} class="w-5 h-5 mr-2" />
      </svelte:fragment>
      <svelte:fragment slot="summary">
        Chat ({Object.keys(chat).length})
      </svelte:fragment>
      <svelte:fragment slot="content">
        {#if Object.keys(chat).length === 0}
          <p class="text-center p-4 text-surface-500">No chat data found.</p>
        {:else}
          {#each Object.entries(chat) as [id, chatItem]}
            <div class="card p-3 mb-2 bg-surface-50-900-token">
              <div class="font-semibold text-primary-500 mb-1">{id}</div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{formatJson(chatItem)}</pre>
            </div>
          {/each}
        {/if}
      </svelte:fragment>
    </AccordionItem>
  </Accordion>
</div>

<style>
  .database-json {
    min-height: 60vh;
  }
  
  pre {
    font-family: 'Fira Code', monospace;
    max-height: 400px;
    overflow-y: auto;
  }
</style>