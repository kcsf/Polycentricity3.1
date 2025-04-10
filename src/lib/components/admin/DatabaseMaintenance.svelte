<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from 'svelte-lucide';
  import { initializeBidirectionalRelationships } from '$lib/services/deckService';
  import { getGun, nodes } from '$lib/services/gunService';
  
  let isLoading = false;
  let error: string | null = null;
  let success = false;
  let result: { success: boolean; processed: number } | null = null;
  
  async function initializeRelationships() {
    isLoading = true;
    error = null;
    success = false;
    
    try {
      result = await initializeBidirectionalRelationships();
      success = result.success;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      isLoading = false;
    }
  }
  
  let relationshipStats = {
    cardsWithDecks: 0,
    decksWithCards: 0,
    cards: 0,
    decks: 0
  };
  
  async function getRelationshipStats() {
    const gun = getGun();
    let cardsWithDecks = 0;
    let cards = 0;
    let decks = 0;
    let decksWithCards = 0;
    
    // Count cards
    await new Promise<void>(resolve => {
      gun.get(nodes.cards).map().once((cardData, cardId) => {
        cards++;
        if (cardData.decks && Object.keys(cardData.decks).length > 0) {
          cardsWithDecks++;
        }
      });
      
      // Give it a moment to fetch data before resolving
      setTimeout(resolve, 500);
    });
    
    // Count decks
    await new Promise<void>(resolve => {
      gun.get(nodes.decks).map().once((deckData, deckId) => {
        decks++;
        if (deckData.cards && Object.keys(deckData.cards).length > 0) {
          decksWithCards++;
        }
      });
      
      // Give it a moment to fetch data before resolving
      setTimeout(resolve, 500);
    });
    
    relationshipStats = {
      cardsWithDecks,
      decksWithCards,
      cards,
      decks
    };
  }
  
  onMount(() => {
    getRelationshipStats();
  });
</script>

<div class="p-2">
  <div class="card p-4 bg-surface-100-800-token mb-4">
    <div class="flex items-center space-x-4">
      <svelte:component this={icons.Tool} class="text-primary-500" />
      <div>
        <h3 class="h4">Database Maintenance</h3>
        <p class="text-sm">Utilities for maintaining and optimizing your Gun.js database relationships.</p>
      </div>
    </div>
  </div>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <div class="card p-4 bg-surface-50-900-token">
      <h3 class="h4 mb-4">Relationship Statistics</h3>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="p-3 bg-surface-100-800-token rounded">
          <div class="flex justify-between items-center">
            <span class="font-semibold">Total Cards</span>
            <span class="text-xl font-mono">{relationshipStats.cards}</span>
          </div>
        </div>
        
        <div class="p-3 bg-surface-100-800-token rounded">
          <div class="flex justify-between items-center">
            <span class="font-semibold">Total Decks</span>
            <span class="text-xl font-mono">{relationshipStats.decks}</span>
          </div>
        </div>
        
        <div class="p-3 bg-primary-500/10 border border-primary-500 rounded">
          <div class="flex justify-between items-center">
            <span class="font-semibold">Cards with Decks</span>
            <span class="text-xl font-mono">{relationshipStats.cardsWithDecks}</span>
          </div>
          <div class="mt-2 text-xs">
            <div class="h-2 rounded-full bg-surface-300-600-token overflow-hidden">
              <div 
                class="h-full bg-primary-500" 
                style="width: {relationshipStats.cards ? (relationshipStats.cardsWithDecks / relationshipStats.cards) * 100 : 0}%"
              ></div>
            </div>
            <div class="mt-1 text-right">
              {relationshipStats.cards ? Math.round((relationshipStats.cardsWithDecks / relationshipStats.cards) * 100) : 0}%
            </div>
          </div>
        </div>
        
        <div class="p-3 bg-primary-500/10 border border-primary-500 rounded">
          <div class="flex justify-between items-center">
            <span class="font-semibold">Decks with Cards</span>
            <span class="text-xl font-mono">{relationshipStats.decksWithCards}</span>
          </div>
          <div class="mt-2 text-xs">
            <div class="h-2 rounded-full bg-surface-300-600-token overflow-hidden">
              <div 
                class="h-full bg-primary-500" 
                style="width: {relationshipStats.decks ? (relationshipStats.decksWithCards / relationshipStats.decks) * 100 : 0}%"
              ></div>
            </div>
            <div class="mt-1 text-right">
              {relationshipStats.decks ? Math.round((relationshipStats.decksWithCards / relationshipStats.decks) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>
      
      <button class="btn variant-soft-primary w-full mt-4" on:click={getRelationshipStats}>
        <svelte:component this={icons.RefreshCcw} class="w-4 h-4 mr-2" />
        Refresh Statistics
      </button>
    </div>
    
    <div class="card p-4 bg-surface-50-900-token">
      <h3 class="h4 mb-4">Initialize Bidirectional Relationships</h3>
      
      <p class="text-sm mb-4">
        This utility initializes bidirectional relationships between cards and decks, ensuring that
        each card has references to the decks it belongs to, and each deck has references to its cards.
      </p>
      
      {#if isLoading}
        <div class="flex items-center justify-center p-6">
          <div class="spinner-third w-8 h-8"></div>
          <span class="ml-3">Processing...</span>
        </div>
      {:else if error}
        <div class="alert variant-filled-error">
          <svelte:component this={icons.AlertTriangle} class="w-5 h-5" />
          <div class="alert-message">
            <h3 class="h4">Error</h3>
            <p>{error}</p>
          </div>
          <div class="alert-actions">
            <button class="btn variant-filled" on:click={initializeRelationships}>Retry</button>
          </div>
        </div>
      {:else if success}
        <div class="alert variant-filled-success">
          <svelte:component this={icons.CheckCircle} class="w-5 h-5" />
          <div class="alert-message">
            <h3 class="h4">Success</h3>
            <p>Successfully processed {result?.processed} bidirectional relationships.</p>
          </div>
        </div>
      {/if}
      
      <button 
        class="btn variant-filled-primary w-full mt-4" 
        on:click={initializeRelationships}
        disabled={isLoading}
      >
        <svelte:component this={icons.RefreshCw} class="w-4 h-4 mr-2" />
        Initialize Bidirectional Relationships
      </button>
    </div>
  </div>
  
  <div class="card p-4 bg-surface-50-900-token">
    <h3 class="h4 mb-4">How Bidirectional Relationships Work</h3>
    
    <div class="p-4 bg-surface-100-800-token rounded mb-4">
      <h4 class="font-semibold mb-2">Cards to Decks</h4>
      <pre class="text-xs p-3 bg-surface-50-900-token rounded overflow-auto">
// A card node contains a 'decks' property with references to all decks it belongs to
gun.get('cards').get('card123').get('decks').get('deck456').put(true)
      </pre>
      
      <h4 class="font-semibold mb-2 mt-4">Decks to Cards</h4>
      <pre class="text-xs p-3 bg-surface-50-900-token rounded overflow-auto">
// A deck node contains a 'cards' property with references to all its cards
gun.get('decks').get('deck456').get('cards').get('card123').put(true)
      </pre>
    </div>
    
    <div class="p-4 bg-surface-100-800-token rounded">
      <h4 class="font-semibold mb-2">Diagram</h4>
      <div class="relationship-diagram p-4 bg-surface-50-900-token rounded">
        <svg width="100%" height="180" viewBox="0 0 500 180">
          <!-- Card Node -->
          <rect x="50" y="50" width="150" height="80" rx="5" fill="#F6BD16" stroke="#000" stroke-width="2"/>
          <text x="125" y="85" text-anchor="middle" font-weight="bold">Card</text>
          <text x="125" y="105" text-anchor="middle" font-size="12">id: card123</text>
          
          <!-- Deck Node -->
          <rect x="300" y="50" width="150" height="80" rx="5" fill="#E8684A" stroke="#000" stroke-width="2"/>
          <text x="375" y="85" text-anchor="middle" font-weight="bold">Deck</text>
          <text x="375" y="105" text-anchor="middle" font-size="12">id: deck456</text>
          
          <!-- Relationships -->
          <path d="M 200 80 L 300 80" stroke="#000" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="250" y="70" text-anchor="middle" font-size="12">belongs to</text>
          
          <path d="M 300 100 L 200 100" stroke="#000" stroke-width="2" marker-end="url(#arrowhead)"/>
          <text x="250" y="120" text-anchor="middle" font-size="12">contains</text>
          
          <!-- Arrow marker definition -->
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" />
            </marker>
          </defs>
        </svg>
      </div>
    </div>
  </div>
</div>