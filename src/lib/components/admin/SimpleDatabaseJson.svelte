<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getGun, nodes } from '$lib/services/gunService';

  // Data storage for each node type
  let cards = {};
  let values = {};
  let capabilities = {};
  let decks = {};
  let users = {};
  let games = {};
  let actors = {};
  let agreements = {};
  let positions = {};
  let chat = {};

  // Track subscription callbacks for cleanup
  let subscriptions = [];
  
  // Track expanded sections
  let expandedSections = {
    cards: false,
    values: false,
    capabilities: false,
    decks: false,
    users: false,
    games: false,
    actors: false,
    agreements: false,
    positions: false,
    chat: false
  };

  // Toggle section expansion
  function toggleSection(section) {
    expandedSections[section] = !expandedSections[section];
  }

  // Formatting helpers
  function formatJson(data) {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error formatting JSON:', error);
      return `Error formatting data: ${error}`;
    }
  }

  function trimJsonSize(obj, maxSize = 1000) {
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
          preview: obj.slice(0, 3).map(item => 
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
    function subscribeToNodeType(nodeType, dataStore) {
      const unsub = gun.get(nodeType).map().on((data, key) => {
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

<div class="simple-database-json">
  <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Database JSON Explorer</h2>
  <p style="margin-bottom: 1rem;">View raw JSON data from the Gun.js database to debug structure issues.</p>

  <button 
    style="background-color: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.25rem; margin-bottom: 1rem;"
    on:click={loadData}
  >
    Refresh JSON Data
  </button>

  <div>
    <!-- Values -->
    <div style="border: 1px solid #e5e7eb; margin-bottom: 0.5rem; border-radius: 0.25rem;">
      <div 
        style="padding: 0.75rem; font-weight: bold; background-color: #f3f4f6; cursor: pointer; display: flex; justify-content: space-between;"
        on:click={() => toggleSection('values')}
      >
        <span>Values ({Object.keys(values).length})</span>
        <span>{expandedSections.values ? '▼' : '►'}</span>
      </div>
      {#if expandedSections.values}
        <div style="padding: 1rem;">
          {#if Object.keys(values).length === 0}
            <p style="text-align: center; color: #6b7280;">No value data found.</p>
          {:else}
            {#each Object.entries(values) as [id, value]}
              <div style="padding: 0.75rem; margin-bottom: 0.5rem; background-color: #f9fafb; border-radius: 0.25rem;">
                <div style="font-weight: 600; color: #4f46e5; margin-bottom: 0.25rem;">{id}</div>
                <pre style="font-family: monospace; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap;">{formatJson(value)}</pre>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Capabilities -->
    <div style="border: 1px solid #e5e7eb; margin-bottom: 0.5rem; border-radius: 0.25rem;">
      <div 
        style="padding: 0.75rem; font-weight: bold; background-color: #f3f4f6; cursor: pointer; display: flex; justify-content: space-between;"
        on:click={() => toggleSection('capabilities')}
      >
        <span>Capabilities ({Object.keys(capabilities).length})</span>
        <span>{expandedSections.capabilities ? '▼' : '►'}</span>
      </div>
      {#if expandedSections.capabilities}
        <div style="padding: 1rem;">
          {#if Object.keys(capabilities).length === 0}
            <p style="text-align: center; color: #6b7280;">No capability data found.</p>
          {:else}
            {#each Object.entries(capabilities) as [id, capability]}
              <div style="padding: 0.75rem; margin-bottom: 0.5rem; background-color: #f9fafb; border-radius: 0.25rem;">
                <div style="font-weight: 600; color: #4f46e5; margin-bottom: 0.25rem;">{id}</div>
                <pre style="font-family: monospace; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap;">{formatJson(capability)}</pre>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Cards -->
    <div style="border: 1px solid #e5e7eb; margin-bottom: 0.5rem; border-radius: 0.25rem;">
      <div 
        style="padding: 0.75rem; font-weight: bold; background-color: #f3f4f6; cursor: pointer; display: flex; justify-content: space-between;"
        on:click={() => toggleSection('cards')}
      >
        <span>Cards ({Object.keys(cards).length})</span>
        <span>{expandedSections.cards ? '▼' : '►'}</span>
      </div>
      {#if expandedSections.cards}
        <div style="padding: 1rem;">
          {#if Object.keys(cards).length === 0}
            <p style="text-align: center; color: #6b7280;">No card data found.</p>
          {:else}
            {#each Object.entries(cards) as [id, card]}
              <div style="padding: 0.75rem; margin-bottom: 0.5rem; background-color: #f9fafb; border-radius: 0.25rem;">
                <div style="font-weight: 600; color: #4f46e5; margin-bottom: 0.25rem;">{id}</div>
                <pre style="font-family: monospace; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap;">{formatJson(card)}</pre>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Decks -->
    <div style="border: 1px solid #e5e7eb; margin-bottom: 0.5rem; border-radius: 0.25rem;">
      <div 
        style="padding: 0.75rem; font-weight: bold; background-color: #f3f4f6; cursor: pointer; display: flex; justify-content: space-between;"
        on:click={() => toggleSection('decks')}
      >
        <span>Decks ({Object.keys(decks).length})</span>
        <span>{expandedSections.decks ? '▼' : '►'}</span>
      </div>
      {#if expandedSections.decks}
        <div style="padding: 1rem;">
          {#if Object.keys(decks).length === 0}
            <p style="text-align: center; color: #6b7280;">No deck data found.</p>
          {:else}
            {#each Object.entries(decks) as [id, deck]}
              <div style="padding: 0.75rem; margin-bottom: 0.5rem; background-color: #f9fafb; border-radius: 0.25rem;">
                <div style="font-weight: 600; color: #4f46e5; margin-bottom: 0.25rem;">{id}</div>
                <pre style="font-family: monospace; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap;">{formatJson(deck)}</pre>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Other sections can be added following the same pattern -->
  </div>
</div>