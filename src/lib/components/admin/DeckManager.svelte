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
      // Log the length of the input for debugging
      console.log(`Import text length: ${importText.length} characters`);
      
      // Try to parse the JSON
      let cardsData: Omit<Card, 'card_id'>[];
      
      try {
        console.log('Attempting to parse card data...');
        
        // First try standard JSON parse
        try {
          cardsData = JSON.parse(importText);
          console.log('Successfully parsed as standard JSON');
        } catch (standardJsonError) {
          console.log('Standard JSON parse failed, trying with JavaScript object format');
          
          // If that fails, try evaluating it as JavaScript (for unquoted property names)
          try {
            // Add quotes to property names
            const sanitizedText = importText
              .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
              .replace(/'/g, '"'); // Replace single quotes with double quotes
              
            console.log('Sanitized text for parsing');
            cardsData = JSON.parse(sanitizedText);
            console.log('Successfully parsed as sanitized JavaScript object format');
          } catch (jsParseError) {
            console.error('Both parsing methods failed', jsParseError);
            // If both methods fail, throw the original error
            throw standardJsonError;
          }
        }
        
        // Check if it's an array
        if (!Array.isArray(cardsData)) {
          console.log('Data is not an array, converting single object to array');
          cardsData = [cardsData]; // Convert single object to array
        }
        
        // Log the parsed data length
        console.log(`Successfully parsed ${cardsData.length} cards from input data`);
        
        // Debug: show a sample of the data
        if (cardsData.length > 0) {
          console.log('Sample of first card:', JSON.stringify(cardsData[0]).substring(0, 100) + '...');
        }
        
        if (cardsData.length > 10) {
          console.log(`Large import detected: ${cardsData.length} cards`);
        }
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        importResult = {
          success: false,
          message: 'Invalid JSON format. Please check your input. Make sure to use valid JSON with double quotes around property names.'
        };
        isImporting = false;
        return;
      }
      
      // Validate card data
      console.log('Validating card data...');
      let validCards = 0;
      
      for (const card of cardsData) {
        if (!card.role_title || !card.card_category || !card.type) {
          importResult = {
            success: false,
            message: 'Each card must have a role_title, card_category, and type'
          };
          console.error('Validation failed - missing required fields', card);
          isImporting = false;
          return;
        }
        validCards++;
      }
      
      console.log(`Validation passed for all ${validCards} cards`);
      
      // Import the cards
      console.log(`Starting import of ${cardsData.length} cards to deck ${deckId}`);
      const result = await importCardsToDeck(deckId, cardsData);
      
      if (result.success) {
        importResult = {
          success: true,
          message: `Successfully imported ${result.added} cards`
        };
        console.log(`Import completed successfully. Added ${result.added} cards`);
        
        // Clear the import text
        importText = '';
        
        // Reload the deck
        await loadDeck();
      } else {
        importResult = {
          success: false,
          message: 'Failed to import cards'
        };
        console.error('Import failed with result:', result);
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
        <div class="mb-2 flex items-center">
          <span class="badge variant-filled-primary mr-2">NEW</span>
          <p class="text-sm text-primary-500 font-semibold">Both JSON and JavaScript object formats are supported!</p>
        </div>
        <pre class="text-xs font-mono overflow-x-auto">
{`// Example card format (you can import array of these):
// Valid JSON format:
[
  {
    "card_number": 1,    // Important: This is a numeric value (1-52) used for card sorting
    "role_title": "Luminos Funder",
    "backstory": "A wealthy idealist who left corporate life to fund sustainable communities.",
    "values": ["Sustainability", "Equity", "Community Resilience"],
    "goals": "Fund projects that reduce ecological footprints and promote self-reliance.",
    "obligations": "Must report impact to a donor network; cannot fund profit-driven ventures.",
    "capabilities": "Grant-writing expertise, impact assessment.",
    "intellectual_property": "Database of sustainable tech solutions, funding strategy playbook.",
    "rivalrous_resources": "$50K in discretionary funds, limited staff time.",
    "card_category": "Funders",
    "type": "Individual",
    "icon": "sun"
  }
]

// OR JavaScript object format (without quotes on property names):
[
  {
    card_number: 2,    // Your cards will use this exact number (1-52)
    role_title: 'DAO of the Green Veil',
    backstory: 'A blockchain-based collective pooling crypto for eco-village experiments.',
    values: ['Decentralization', 'Sustainability', 'Transparency'],
    goals: 'Invest in scalable eco-village models; increase DAO membership.',
    obligations: 'Decisions must pass a token-weighted vote; funds locked until consensus.',
    capabilities: 'Smart contract development, crowdfunding coordination.',
    intellectual_property: 'Governance protocols, tokenomics model.',
    rivalrous_resources: '10 ETH in treasury, limited developer hours.',
    card_category: 'Funders',
    type: 'DAO',
    icon: 'link'
  }
]`}
        </pre>
      </div>
      
      <div class="mb-4">
        <label class="label">
          <span>Card JSON Data</span>
          <textarea 
            class="textarea" 
            bind:value={importText}
            rows="20"
            placeholder="Paste JSON data here..."
            style="min-height: 300px; max-height: 600px;"
          ></textarea>
        </label>
        <p class="text-xs mt-1">{importText.length} characters • Supports large imports (50+ cards)</p>
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