<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from 'svelte-lucide';
  import { getDeck, updateDeck, importCardsToDeck } from '$lib/services/deckService';
  import { getGun, nodes, generateId } from '$lib/services/gunService';
  import { getCurrentUser } from '$lib/services/authService';
  import type { Card, Deck } from '$lib/types';
  
  let isLoading = false;
  let result: { success: boolean; message: string } | null = null;
  export let deckId = 'd1'; // Default deck ID, can be overridden by parent
  let deck: Deck | null = null;
  let userId = '';
  
  // Card import variables
  let importText = '';
  let isImporting = false;
  let importResult: { success: boolean; message: string } | null = null;
  
  onMount(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      userId = currentUser.user_id;
    }
    
    // Load the current deck
    await loadDeck();
  });
  
  async function loadDeck() {
    isLoading = true;
    result = null;
    
    try {
      deck = await getDeck(deckId);
      
      if (!deck) {
        result = {
          success: false,
          message: `Deck with ID ${deckId} not found`
        };
      }
    } catch (error) {
      console.error('Error loading deck:', error);
      result = {
        success: false,
        message: `Error loading deck: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      isLoading = false;
    }
  }
  
  async function updateDeckCreator() {
    if (!userId) {
      result = {
        success: false,
        message: 'No user logged in'
      };
      return;
    }
    
    if (!deck) {
      result = {
        success: false,
        message: 'No deck loaded'
      };
      return;
    }
    
    isLoading = true;
    result = null;
    
    try {
      const success = await updateDeck(deckId, {
        name: 'Eco-Village Deck',
        creator: userId
      });
      
      if (success) {
        result = {
          success: true,
          message: `Successfully updated deck ${deckId} with creator ${userId}`
        };
        
        // Reload the deck
        await loadDeck();
      } else {
        result = {
          success: false,
          message: 'Failed to update deck'
        };
      }
    } catch (error) {
      console.error('Error updating deck:', error);
      result = {
        success: false,
        message: `Error updating deck: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      isLoading = false;
    }
  }
  
  async function handleImportCards() {
    if (!importText.trim()) {
      importResult = {
        success: false,
        message: 'Please enter card data'
      };
      return;
    }
    
    isImporting = true;
    importResult = null;
    
    try {
      // Try to parse the JSON
      let cardsData: Omit<Card, 'card_id'>[];
      
      try {
        cardsData = JSON.parse(importText);
        
        // Check if it's an array
        if (!Array.isArray(cardsData)) {
          cardsData = [cardsData]; // Convert single object to array
        }
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        importResult = {
          success: false,
          message: 'Invalid JSON format. Please check your input.'
        };
        isImporting = false;
        return;
      }
      
      // Validate card data
      for (const card of cardsData) {
        if (!card.role_title || !card.card_category || !card.type) {
          importResult = {
            success: false,
            message: 'Each card must have a role_title, card_category, and type'
          };
          isImporting = false;
          return;
        }
      }
      
      // Import the cards
      const result = await importCardsToDeck(deckId, cardsData);
      
      if (result.success) {
        importResult = {
          success: true,
          message: `Successfully imported ${result.added} cards`
        };
        
        // Clear the import text
        importText = '';
        
        // Reload the deck
        await loadDeck();
      } else {
        importResult = {
          success: false,
          message: 'Failed to import cards'
        };
      }
    } catch (error) {
      console.error('Error importing cards:', error);
      importResult = {
        success: false,
        message: `Error importing cards: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      isImporting = false;
    }
  }
</script>

<div class="card p-4 bg-surface-50-900-token">
  <h3 class="h4 mb-4 flex items-center">
    <svelte:component this={icons.Layers} class="w-5 h-5 mr-2 text-primary-500" />
    {deck ? `Import Cards to ${deck.name || 'Deck'}` : 'Deck Manager'}
  </h3>
  
  {#if isLoading}
    <div class="flex items-center justify-center p-10">
      <div class="spinner-third w-8 h-8"></div>
      <span class="ml-3">Loading Deck...</span>
    </div>
  {:else if !deck}
    <div class="alert variant-ghost-warning">
      <div class="alert-message">
        <p>Deck not found. Try refreshing.</p>
      </div>
    </div>
  {:else}
    <div class="mb-6">
      <h4 class="font-semibold mb-2">Current Deck Information</h4>
      <div class="card p-3 bg-surface-100-800-token">
        <p><span class="font-semibold">Deck ID:</span> {deck.deck_id}</p>
        <p><span class="font-semibold">Name:</span> {deck.name || 'Unnamed'}</p>
        <p><span class="font-semibold">Creator:</span> {deck.creator || 'None'}</p>
        <p><span class="font-semibold">Cards:</span> {deck.cards ? (Array.isArray(deck.cards) ? deck.cards.length : Object.keys(deck.cards).length) : 0}</p>
      </div>
    </div>
    
    <div class="flex flex-col gap-4 mb-6">
      <button 
        class="btn variant-filled-primary" 
        on:click={updateDeckCreator}
        disabled={isLoading}
      >
        {#if isLoading}
          <div class="spinner-third w-4 h-4 mr-2"></div>
          Updating...
        {:else}
          <svelte:component this={icons.UserCheck} class="w-4 h-4 mr-2" />
          Update Creator & Rename
        {/if}
      </button>
      
      {#if result}
        <div class="alert {result.success ? 'variant-filled-success' : 'variant-filled-error'} mb-4">
          <svelte:component this={result.success ? icons.CheckCircle : icons.AlertTriangle} class="w-5 h-5" />
          <div class="alert-message">
            <h4 class="h5">{result.success ? 'Success' : 'Error'}</h4>
            <p>{result.message}</p>
          </div>
        </div>
      {/if}
    </div>
    
    <hr class="!border-t-2 my-6">
    
    <div class="mb-2">
      <h4 class="font-semibold mb-4">Import Cards</h4>
      <p class="text-sm mb-4">
        Paste JSON data for cards to import. Each card should include the following fields:
      </p>
      
      <div class="card p-3 bg-surface-100-800-token mb-4">
        <pre class="text-xs font-mono overflow-x-auto">
{`// Example card format (you can import array of these):
{
  "card_number": 12,             // 1-52 for randomizing draws
  "role_title": "Urban Farmer",
  "backstory": "You've been growing food in the city for 10 years...",
  "values": ["Sustainability", "Community"],
  "goals": ["Establish community garden", "Teach urban farming"],
  "obligations": "Responsible for weekly harvests",
  "capabilities": "Expert in small-space growing techniques",
  "intellectual_property": "Developed unique vertical farming method",
  "rivalrous_resources": "Limited growing space",
  "card_category": "Providers",  // "Funders", "Providers", or "Supporters"
  "type": "Individual",          // "DAO", "Practice", "Individual", etc.
  "icon": "Sprout"               // Lucide icon name (optional)
}`}
        </pre>
      </div>
      
      <div class="mb-4">
        <label class="label">
          <span>Card JSON Data</span>
          <textarea 
            class="textarea" 
            bind:value={importText}
            rows="10"
            placeholder="Paste JSON data here..."
          ></textarea>
        </label>
      </div>
      
      <button 
        class="btn variant-filled-secondary" 
        on:click={handleImportCards}
        disabled={isImporting || !importText.trim()}
      >
        {#if isImporting}
          <div class="spinner-third w-4 h-4 mr-2"></div>
          Importing...
        {:else}
          <svelte:component this={icons.Upload} class="w-4 h-4 mr-2" />
          Import Cards
        {/if}
      </button>
      
      {#if importResult}
        <div class="alert {importResult.success ? 'variant-filled-success' : 'variant-filled-error'} mt-4">
          <svelte:component this={importResult.success ? icons.CheckCircle : icons.AlertTriangle} class="w-5 h-5" />
          <div class="alert-message">
            <h4 class="h5">{importResult.success ? 'Success' : 'Error'}</h4>
            <p>{importResult.message}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>