<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { getDeck, updateDeck, importCardsToDeck } from '$lib/services/deckService';
  import { getGun, nodes, generateId } from '$lib/services/gunService';
  import { getCurrentUser } from '$lib/services/authService';
  import type { Card, Deck } from '$lib/types';
  
  // In Svelte 5 runes mode, use $props() instead of export let
  const props = $props<{ deckId?: string }>();
  
  let isLoading = $state(false);
  let result = $state<{ success: boolean; message: string } | null>(null);
  let deckIdValue = $state(props.deckId || 'd1'); // Store prop value in a state variable
  let deck = $state<Deck | null>(null);
  let userId = $state('');
  let decks = $state<Deck[]>([]);
  
  // Card import variables
  let importText = $state('');
  let isImporting = $state(false);
  let importResult = $state<{ success: boolean; message: string } | null>(null);
  
  onMount(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      userId = currentUser.user_id;
    }
    
    // Load all available decks
    await loadDecks();
    
    // Load the current deck
    await loadDeck();
  });
  
  // Load all decks for dropdown
  async function loadDecks() {
    try {
      const gun = getGun();
      if (!gun) {
        console.error('Gun database not initialized');
        return;
      }
      
      const deckList: Deck[] = [];
      
      await new Promise<void>(resolve => {
        gun.get(nodes.decks).map().once((deckData: Deck, deckId: string) => {
          if (deckData && deckData.deck_id) {
            deckList.push({
              ...deckData,
              deck_id: deckId
            });
          }
        });
        
        setTimeout(() => {
          console.log('Loaded ' + deckList.length + ' decks');
          decks = deckList;
          resolve();
        }, 500);
      });
    } catch (err) {
      console.error('Error loading decks:', err);
    }
  }
  
  async function loadDeck() {
    isLoading = true;
    result = null;
    
    try {
      deck = await getDeck(deckIdValue);
      
      if (!deck) {
        result = {
          success: false,
          message: `Deck with ID ${deckIdValue} not found`
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
      const success = await updateDeck(deckIdValue, {
        name: 'Eco-Village Deck',
        creator: userId
      });
      
      if (success) {
        result = {
          success: true,
          message: `Successfully updated deck ${deckIdValue} with creator ${userId}`
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
          
          // Clean the input text before attempting to fix it
          const cleanedText = importText
            .replace(/\n/g, ' ')              // Replace newlines with spaces
            .replace(/\t/g, ' ')              // Replace tabs with spaces
            .replace(/\s+/g, ' ')             // Collapse multiple spaces
            .replace(/,\s*]/g, ']')           // Remove trailing commas in arrays
            .replace(/,\s*}/g, '}')           // Remove trailing commas in objects
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":'); // Ensure property names are quoted
            
          // If that fails, try evaluating it as JavaScript (for unquoted property names)
          try {
            // Add quotes to property names and handle single quotes
            const sanitizedText = cleanedText
              .replace(/'/g, '"')             // Replace single quotes with double quotes
              .replace(/:\s*"([^"]+)"/g, (match, p1) => {
                // Handle string values with embedded quotes
                return ': "' + p1.replace(/"/g, '\\"') + '"';
              });
            
            console.log('Sanitized text for parsing');
            cardsData = JSON.parse(sanitizedText);
            console.log('Successfully parsed as sanitized JavaScript object format');
          } catch (jsParseError) {
            // Try a more aggressive approach - extract just what looks like JSON objects
            try {
              console.log('Standard sanitization failed, trying more aggressive parsing');
              
              // Find all objects that look like {property: value} patterns
              const objects = importText.match(/\{[^{}]*\}/g);
              if (objects && objects.length > 0) {
                // Process each object to ensure it has proper JSON format
                const processedObjects = objects.map(obj => {
                  return obj
                    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Ensure property names are quoted
                    .replace(/'/g, '"')         // Replace single quotes with double quotes
                    .replace(/,\s*}/g, '}');    // Remove trailing commas
                });
                
                // Try to parse the array of objects
                cardsData = JSON.parse('[' + processedObjects.join(',') + ']');
                console.log('Successfully parsed using object extraction method');
              } else {
                console.error('Object extraction failed, no valid objects found');
                throw new Error('No valid JSON objects found in the input');
              }
            } catch (extractionError) {
              console.error('All parsing methods failed', extractionError);
              // If all methods fail, throw the original error
              throw standardJsonError;
            }
          }
        }
        
        // Check if it's an array
        if (!Array.isArray(cardsData)) {
          console.log('Data is not an array, converting single object to array');
          cardsData = [cardsData]; // Convert single object to array
        }
        
        // Pre-process the data to ensure compatibility with our schema
        cardsData = cardsData.map(card => {
          // Ensure card_number is a number (it might be a string in the import)
          let cardNumber = card.card_number;
          if (typeof cardNumber === 'string') {
            cardNumber = parseInt(cardNumber, 10);
            // If parsing fails, generate a random number between 1-52
            if (isNaN(cardNumber)) {
              cardNumber = Math.floor(Math.random() * 52) + 1;
            }
          }
          
          // Handle values field that could be a string or array
          let valuesData = card.values;
          // If it's a string, keep it as is - it will be processed later
          // If it's an array, convert it to a comma-separated string
          if (Array.isArray(valuesData)) {
            valuesData = valuesData.join(', ');
          }
          
          // Handle capabilities field that could be a string or array
          let capabilitiesData = card.capabilities;
          // If it's a string, keep it as is - it will be processed later
          // If it's an array, convert it to a comma-separated string
          if (Array.isArray(capabilitiesData)) {
            capabilitiesData = capabilitiesData.join(', ');
          }
          
          // Set defaults for missing fields
          return {
            ...card,
            card_number: cardNumber,
            values: valuesData || '',
            capabilities: capabilitiesData || '',
            backstory: card.backstory || '',
            goals: card.goals || '',
            obligations: card.obligations || '',
            intellectual_property: card.intellectual_property || '',
            rivalrous_resources: card.rivalrous_resources || '',
            // Default these if missing
            card_category: card.card_category || 'Supporters',
            type: card.type || 'Individual',
            // Determine icon based on category if not provided
            icon: card.icon || {
                'Funders': 'CircleDollarSign',
                'Providers': 'Hammer',
                'Supporters': 'Heart'
            }[card.card_category] || 'User'
          };
        });
        
        // Log the parsed data length
        console.log(`Successfully parsed ${cardsData.length} cards from input data`);
        
        // Debug: show a sample of the data
        if (cardsData.length > 0) {
          console.log('Sample of first card (processed):', JSON.stringify(cardsData[0]).substring(0, 100) + '...');
        }
        
        if (cardsData.length > 10) {
          console.log(`Large import detected: ${cardsData.length} cards`);
        }
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        importResult = {
          success: false,
          message: `Invalid JSON format. Please check your input format and ensure it follows one of the examples. Common issues: 
          1. Missing or mismatched quotes
          2. Extra/trailing commas
          3. Unquoted property names (should be "property": value)
          4. Values containing quotes need to be escaped`
        };
        isImporting = false;
        return;
      }
      
      // Validate card data
      console.log('Validating card data...');
      let validCards = 0;
      
      for (const card of cardsData) {
        if (!card.role_title) {
          importResult = {
            success: false,
            message: 'Each card must have a role_title'
          };
          console.error('Validation failed - missing role_title', card);
          isImporting = false;
          return;
        }
        validCards++;
      }
      
      console.log(`Validation passed for all ${validCards} cards`);
      
      // Import the cards
      console.log(`Starting import of ${cardsData.length} cards to deck ${deckIdValue}`);
      const result = await importCardsToDeck(deckIdValue, cardsData);
      
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
          message: result.error || 'Failed to import cards'
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
    <span>Card Import Manager</span>
  </h3>
  
  <!-- Deck Selection Dropdown -->
  <div class="mb-6">
    <label for="deck-select" class="block text-sm font-medium mb-2">Select Deck</label>
    <div class="flex gap-4 items-center">
      <select 
        id="deck-select" 
        class="select rounded-md w-full md:w-1/2 lg:w-1/3"
        value={deckIdValue}
        on:change={(e) => {
          deckIdValue = e.target.value;
          loadDeck();
        }}
        disabled={isLoading}
      >
        {#if decks.length === 0}
          <option value="">No decks available</option>
        {:else}
          {#each decks as deck}
            <option value={deck.deck_id}>{deck.name || deck.deck_id}</option>
          {/each}
        {/if}
      </select>
      
      <button 
        class="btn variant-filled-primary" 
        on:click={loadDeck}
        disabled={isLoading}
      >
        <svelte:component this={icons.RefreshCcw} class="w-4 h-4 mr-2" />
        Refresh
      </button>
    </div>
  </div>
  
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
    
    {#if result}
      <div class="alert {result.success ? 'variant-filled-success' : 'variant-filled-error'} mb-4">
        <svelte:component this={result.success ? icons.CheckCircle : icons.AlertTriangle} class="w-5 h-5" />
        <div class="alert-message">
          <h4 class="h5">{result.success ? 'Success' : 'Error'}</h4>
          <p>{result.message}</p>
        </div>
      </div>
    {/if}
    
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
    "capabilities": "Grant-writing expertise, impact assessment",
    "intellectual_property": "Database of sustainable tech solutions, funding strategy playbook.",
    "rivalrous_resources": "$50K in discretionary funds, limited staff time.",
    "card_category": "Funders",
    "type": "Individual",
    "icon": "sun"
  }
]

// OR you can use format with comma-separated values in strings:
[
  {
    "card_number": 3,
    "role_title": "Community Gardener",
    "backstory": "A permaculture expert who develops shared growing spaces.",
    "values": "Sustainability, Community Resilience, Health",
    "goals": "Build 5 community gardens, establish seed saving network.",
    "obligations": "Must share harvest with community members.",
    "capabilities": "Permaculture design, seed saving, harvest planning",
    "intellectual_property": "Garden design plans, seed library.",
    "rivalrous_resources": "Garden tools, limited water access.",
    "card_category": "Providers",
    "type": "Individual",
    "icon": "leaf"
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
    capabilities: 'Smart contract development, crowdfunding coordination',
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