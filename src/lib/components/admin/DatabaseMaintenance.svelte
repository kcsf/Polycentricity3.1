<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from 'svelte-lucide';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import { initializeBidirectionalRelationships } from '$lib/services/deckService';
  import { getGun, nodes } from '$lib/services/gunService';
  
  // Using standard Svelte reactivity
  let isLoading = false;
  let error: string | null = null;
  let success = false;
  let result: { success: boolean; processed: number } | null = null;
  
  // For accordion sections - all closed by default
  let accordionValue: string[] = [];
  
  async function initializeRelationships() {
    isLoading = true;
    error = null;
    success = false;
    
    try {
      console.log('Starting initialization of bidirectional relationships');
      result = await initializeBidirectionalRelationships();
      console.log('Initialization complete', result);
      success = result.success;
      
      // Refresh the statistics after initialization
      if (success) {
        await getRelationshipStats();
      }
    } catch (err) {
      console.error('Error initializing relationships:', err);
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
    try {
      const gun = getGun();
      let cardsWithDecks = 0;
      let cards = 0;
      let decks = 0;
      let decksWithCards = 0;
      
      console.log('Getting relationship statistics...');
      
      // Count cards
      await new Promise<void>(resolve => {
        gun.get(nodes.cards).map().once((cardData, cardId) => {
          if (!cardData) return;
          
          cards++;
          console.log(`Processing card ${cardId}`, cardData);
          
          // Check if card has decks and the decks property is an object
          if (cardData.decks) {
            if (typeof cardData.decks === 'object') {
              // Handle direct object format
              if (!cardData.decks['#']) {
                const deckCount = Object.keys(cardData.decks).length;
                if (deckCount > 0) {
                  cardsWithDecks++;
                  console.log(`Card ${cardId} has ${deckCount} decks`);
                }
              } 
              // Handle Gun.js reference format
              else {
                console.log(`Card ${cardId} has decks reference: ${cardData.decks['#']}`);
                cardsWithDecks++; // Assume it has at least one deck if there's a reference
              }
            } 
            // Handle array format (though this should be rare with Gun.js)
            else if (Array.isArray(cardData.decks) && cardData.decks.length > 0) {
              cardsWithDecks++;
              console.log(`Card ${cardId} has ${cardData.decks.length} decks (array format)`);
            }
          }
        });
        
        // Give it a moment to fetch data before resolving
        setTimeout(resolve, 1000);
      });
      
      // Count decks
      await new Promise<void>(resolve => {
        gun.get(nodes.decks).map().once((deckData, deckId) => {
          if (!deckData) return;
          
          decks++;
          console.log(`Processing deck ${deckId}`, deckData);
          
          // Check if deck has cards and the cards property is an object or array
          if (deckData.cards) {
            if (typeof deckData.cards === 'object') {
              // Handle direct object format
              if (!deckData.cards['#']) {
                const cardCount = Object.keys(deckData.cards).length;
                if (cardCount > 0) {
                  decksWithCards++;
                  console.log(`Deck ${deckId} has ${cardCount} cards`);
                }
              } 
              // Handle Gun.js reference format
              else {
                console.log(`Deck ${deckId} has cards reference: ${deckData.cards['#']}`);
                decksWithCards++; // Assume it has at least one card if there's a reference
              }
            } 
            // Handle array format (though this should be rare with Gun.js)
            else if (Array.isArray(deckData.cards) && deckData.cards.length > 0) {
              decksWithCards++;
              console.log(`Deck ${deckId} has ${deckData.cards.length} cards (array format)`);
            }
          }
        });
        
        // Give it a moment to fetch data before resolving
        setTimeout(resolve, 1000);
      });
      
      console.log('Relationship statistics gathered:', {
        cards,
        cardsWithDecks,
        decks,
        decksWithCards
      });
      
      relationshipStats = {
        cardsWithDecks,
        decksWithCards,
        cards,
        decks
      };
    } catch (err) {
      console.error('Error getting relationship statistics:', err);
    }
  }
  
  // Cleanup functions
  import { cleanupAllUsers, cleanupAllGames, cleanupAllDecks, cleanupAllCards } from '$lib/services/cleanupService';
  
  let cleanupLoading = false;
  let cleanupError: string | null = null;
  let cleanupSuccess = false;
  let cleanupResult: { success: boolean; removed: number } | null = null;
  
  async function handleCleanupGames() {
    if (!confirm('Are you sure you want to remove ALL games? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all games');
      cleanupResult = await cleanupAllGames();
      console.log('Games cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
    } catch (err) {
      console.error('Error cleaning up games:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  async function handleCleanupDecks() {
    if (!confirm('Are you sure you want to remove ALL decks? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all decks');
      cleanupResult = await cleanupAllDecks();
      console.log('Decks cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
      
      // Refresh statistics after cleanup
      await getRelationshipStats();
    } catch (err) {
      console.error('Error cleaning up decks:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  async function handleCleanupCards() {
    if (!confirm('Are you sure you want to remove ALL cards? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all cards');
      cleanupResult = await cleanupAllCards();
      console.log('Cards cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
      
      // Refresh statistics after cleanup
      await getRelationshipStats();
    } catch (err) {
      console.error('Error cleaning up cards:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  async function handleCleanupUsers() {
    if (!confirm('Are you sure you want to remove ALL users except your current user? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all users');
      cleanupResult = await cleanupAllUsers();
      console.log('Users cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
    } catch (err) {
      console.error('Error cleaning up users:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  onMount(() => {
    getRelationshipStats();
  });
</script>

<div class="p-2">
  <div class="card p-4 bg-surface-100-800-token mb-4">
    <div class="flex items-center space-x-4">
      <svelte:component this={icons.Wrench} class="text-primary-500" />
      <div>
        <h3 class="h4">Database Maintenance</h3>
        <p class="text-sm">Utilities for maintaining and optimizing your Gun.js database.</p>
      </div>
    </div>
  </div>
  
  <Accordion value={accordionValue} onValueChange={(e) => (accordionValue = e.value)} multiple>
    <!-- Schema Section -->
    <Accordion.Item value="schema">
      {#snippet lead()}
        <svelte:component this={icons.Database} size={24} />
      {/snippet}
      
      {#snippet control()}Database Schema{/snippet}
      
      {#snippet panel()}
        <div class="p-4 bg-primary-500/10 border border-primary-500 rounded mb-4">
          <h4 class="font-semibold mb-2 flex items-center">
            <svelte:component this={icons.Database} class="w-5 h-5 mr-2 text-primary-500" />
            Database Schema Management
          </h4>
          <p class="text-sm mb-4">
            Access the Database Schema page for detailed documentation, initialization, and verification tools.
          </p>
          <a href="/database-schema" class="btn variant-filled-primary w-full">
            <svelte:component this={icons.FileText} class="w-4 h-4 mr-2" />
            View Database Schema
          </a>
        </div>
      {/snippet}
    </Accordion.Item>
    
    <hr class="hr" />
    
    <!-- Relationships Section -->
    <Accordion.Item value="relationships">
      {#snippet lead()}
        <svelte:component this={icons.RefreshCw} size={24} />
      {/snippet}
      
      {#snippet control()}Relationship Management{/snippet}
      
      {#snippet panel()}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
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
            
            <button class="btn variant-soft-primary w-full mt-4" onclick={getRelationshipStats}>
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
                  <button class="btn variant-filled" onclick={initializeRelationships}>Retry</button>
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
              onclick={initializeRelationships}
              disabled={isLoading}
            >
              <svelte:component this={icons.RefreshCw} class="w-4 h-4 mr-2" />
              Initialize Bidirectional Relationships
            </button>
          </div>
        </div>
      {/snippet}
    </Accordion.Item>
    
    <hr class="hr" />
    
    <!-- Cleanup Section -->
    <Accordion.Item value="cleanup">
      {#snippet lead()}
        <svelte:component this={icons.Trash2} size={24} />
      {/snippet}
      
      {#snippet control()}Database Cleanup{/snippet}
      
      {#snippet panel()}
        <div class="p-4 bg-surface-100-800-token rounded mb-4 mt-4">
          <h4 class="font-semibold mb-2">⚠️ Danger Zone</h4>
          <p class="text-sm mb-4">
            These actions will permanently remove data from your database. Use with caution.
          </p>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Games</h5>
              <p class="text-xs mb-4">
                This will permanently delete all games in the database. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full" 
                onclick={handleCleanupGames}
                disabled={cleanupLoading}
              >
                <svelte:component this={icons.Trash2} class="w-4 h-4 mr-2" />
                Remove All Games
              </button>
            </div>
            
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Users</h5>
              <p class="text-xs mb-4">
                This will permanently delete all users except your current user. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full" 
                onclick={handleCleanupUsers}
                disabled={cleanupLoading}
              >
                <svelte:component this={icons.UserX} class="w-4 h-4 mr-2" />
                Remove All Users
              </button>
            </div>
            
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Decks</h5>
              <p class="text-xs mb-4">
                This will permanently delete all decks in the database. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full" 
                onclick={handleCleanupDecks}
                disabled={cleanupLoading}
              >
                <svelte:component this={icons.Database} class="w-4 h-4 mr-2" />
                Remove All Decks
              </button>
            </div>
            
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Cards</h5>
              <p class="text-xs mb-4">
                This will permanently delete all cards in the database. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full" 
                onclick={handleCleanupCards}
                disabled={cleanupLoading}
              >
                <svelte:component this={icons.FileText} class="w-4 h-4 mr-2" />
                Remove All Cards
              </button>
            </div>
          </div>
          
          {#if cleanupLoading}
            <div class="flex items-center justify-center p-6 mt-4">
              <div class="spinner-third w-8 h-8"></div>
              <span class="ml-3">Processing cleanup operation...</span>
            </div>
          {:else if cleanupError}
            <div class="alert variant-filled-error mt-4">
              <svelte:component this={icons.AlertTriangle} class="w-5 h-5" />
              <div class="alert-message">
                <h3 class="h4">Error</h3>
                <p>{cleanupError}</p>
              </div>
            </div>
          {:else if cleanupSuccess}
            <div class="alert variant-filled-success mt-4">
              <svelte:component this={icons.CheckCircle} class="w-5 h-5" />
              <div class="alert-message">
                <h3 class="h4">Success</h3>
                <p>Successfully removed {cleanupResult?.removed} items.</p>
              </div>
            </div>
          {/if}
        </div>
      {/snippet}
    </Accordion.Item>
    
    <hr class="hr" />
    
    <!-- Documentation Section -->
    <Accordion.Item value="documentation">
      {#snippet lead()}
        <svelte:component this={icons.FileText} size={24} />
      {/snippet}
      
      {#snippet control()}Database Documentation{/snippet}
      
      {#snippet panel()}
        <div class="mt-4">
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
      {/snippet}
    </Accordion.Item>
  </Accordion>
</div>