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
    values: true, // Open values by default
    capabilities: true, // Open capabilities by default
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
    if (subscriptions && subscriptions.length) {
      subscriptions.forEach(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    }
    subscriptions = [];

    // Reset data objects
    cards = {};
    values = {};
    capabilities = {};
    decks = {};
    users = {};
    games = {};
    actors = {};
    agreements = {};
    positions = {};
    chat = {};

    // Helper to create subscription for a node type
    function subscribeToNodeType(nodeType, dataStore) {
      try {
        console.log(`Subscribing to ${nodeType}...`);
        const callback = (data, key) => {
          if (data === null || data === undefined) {
            delete dataStore[key];
          } else {
            dataStore[key] = trimJsonSize(data);
          }
          // Force Svelte reactivity
          dataStore = {...dataStore};
        };
        
        gun.get(nodeType).map().on(callback);
        
        // Store the cleanup function
        subscriptions.push(() => {
          gun.get(nodeType).map().off(callback);
        });
      } catch (error) {
        console.error(`Error subscribing to ${nodeType}:`, error);
      }
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

    // Force a refresh after a moment to ensure we get the data
    setTimeout(() => {
      loadData();
    }, 1000);
  });

  onDestroy(() => {
    // Clean up subscriptions
    if (subscriptions && subscriptions.length) {
      subscriptions.forEach(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    }
  });
</script>

<div class="simple-database-json">
  <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; color: #0e172c;">Database JSON Explorer</h2>
  <p style="margin-bottom: 1rem; color: #374151;">View raw JSON data from the Gun.js database to debug structure issues.</p>

  <button 
    style="background-color: #ff3e00; color: white; padding: 0.5rem 1rem; border-radius: 0.25rem; margin-bottom: 1rem; font-weight: bold; border: none; cursor: pointer;"
    on:click={loadData}
  >
    Refresh JSON Data
  </button>

  <div>
    <!-- Values Section -->
    <div style="border: 1px solid #2c3e50; margin-bottom: 0.5rem; border-radius: 0.25rem;">
      <button 
        style="width: 100%; padding: 0.75rem; font-weight: bold; background-color: #2c3e50; color: white; cursor: pointer; display: flex; justify-content: space-between; border: none; text-align: left; align-items: center;"
        on:click={() => toggleSection('values')}
        aria-expanded={expandedSections.values}
      >
        <span>Values ({Object.keys(values).length})</span>
        <span>{expandedSections.values ? '▼' : '►'}</span>
      </button>
      {#if expandedSections.values}
        <div style="padding: 1rem; background-color: #1a202c; color: #e2e8f0;">
          {#if Object.keys(values).length === 0}
            <p style="text-align: center; color: #a0aec0; padding: 1rem;">No value data found.</p>
          {:else}
            {#each Object.entries(values) as [id, value]}
              <div style="padding: 0.75rem; margin-bottom: 0.5rem; background-color: #2d3748; border-radius: 0.25rem;">
                <div style="font-weight: 600; color: #90cdf4; margin-bottom: 0.25rem;">{id}</div>
                <pre style="font-family: monospace; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap; background-color: #1a202c; padding: 0.5rem; border-radius: 0.25rem; color: #e2e8f0;">{formatJson(value)}</pre>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Capabilities Section -->
    <div style="border: 1px solid #2c3e50; margin-bottom: 0.5rem; border-radius: 0.25rem;">
      <button 
        style="width: 100%; padding: 0.75rem; font-weight: bold; background-color: #2c3e50; color: white; cursor: pointer; display: flex; justify-content: space-between; border: none; text-align: left; align-items: center;"
        on:click={() => toggleSection('capabilities')}
        aria-expanded={expandedSections.capabilities}
      >
        <span>Capabilities ({Object.keys(capabilities).length})</span>
        <span>{expandedSections.capabilities ? '▼' : '►'}</span>
      </button>
      {#if expandedSections.capabilities}
        <div style="padding: 1rem; background-color: #1a202c; color: #e2e8f0;">
          {#if Object.keys(capabilities).length === 0}
            <p style="text-align: center; color: #a0aec0; padding: 1rem;">No capability data found.</p>
          {:else}
            {#each Object.entries(capabilities) as [id, capability]}
              <div style="padding: 0.75rem; margin-bottom: 0.5rem; background-color: #2d3748; border-radius: 0.25rem;">
                <div style="font-weight: 600; color: #90cdf4; margin-bottom: 0.25rem;">{id}</div>
                <pre style="font-family: monospace; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap; background-color: #1a202c; padding: 0.5rem; border-radius: 0.25rem; color: #e2e8f0;">{formatJson(capability)}</pre>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Cards Section -->
    <div style="border: 1px solid #2c3e50; margin-bottom: 0.5rem; border-radius: 0.25rem;">
      <button 
        style="width: 100%; padding: 0.75rem; font-weight: bold; background-color: #2c3e50; color: white; cursor: pointer; display: flex; justify-content: space-between; border: none; text-align: left; align-items: center;"
        on:click={() => toggleSection('cards')}
        aria-expanded={expandedSections.cards}
      >
        <span>Cards ({Object.keys(cards).length})</span>
        <span>{expandedSections.cards ? '▼' : '►'}</span>
      </button>
      {#if expandedSections.cards}
        <div style="padding: 1rem; background-color: #1a202c; color: #e2e8f0;">
          {#if Object.keys(cards).length === 0}
            <p style="text-align: center; color: #a0aec0; padding: 1rem;">No card data found.</p>
          {:else}
            {#each Object.entries(cards) as [id, card]}
              <div style="padding: 0.75rem; margin-bottom: 0.5rem; background-color: #2d3748; border-radius: 0.25rem;">
                <div style="font-weight: 600; color: #90cdf4; margin-bottom: 0.25rem;">{id}</div>
                <pre style="font-family: monospace; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap; background-color: #1a202c; padding: 0.5rem; border-radius: 0.25rem; color: #e2e8f0;">{formatJson(card)}</pre>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Decks Section -->
    <div style="border: 1px solid #2c3e50; margin-bottom: 0.5rem; border-radius: 0.25rem;">
      <button 
        style="width: 100%; padding: 0.75rem; font-weight: bold; background-color: #2c3e50; color: white; cursor: pointer; display: flex; justify-content: space-between; border: none; text-align: left; align-items: center;"
        on:click={() => toggleSection('decks')}
        aria-expanded={expandedSections.decks}
      >
        <span>Decks ({Object.keys(decks).length})</span>
        <span>{expandedSections.decks ? '▼' : '►'}</span>
      </button>
      {#if expandedSections.decks}
        <div style="padding: 1rem; background-color: #1a202c; color: #e2e8f0;">
          {#if Object.keys(decks).length === 0}
            <p style="text-align: center; color: #a0aec0; padding: 1rem;">No deck data found.</p>
          {:else}
            {#each Object.entries(decks) as [id, deck]}
              <div style="padding: 0.75rem; margin-bottom: 0.5rem; background-color: #2d3748; border-radius: 0.25rem;">
                <div style="font-weight: 600; color: #90cdf4; margin-bottom: 0.25rem;">{id}</div>
                <pre style="font-family: monospace; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap; background-color: #1a202c; padding: 0.5rem; border-radius: 0.25rem; color: #e2e8f0;">{formatJson(deck)}</pre>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>