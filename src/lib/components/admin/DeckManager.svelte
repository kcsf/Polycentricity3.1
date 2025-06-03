<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { getDeck, updateDeck, importCardsToDeck } from '$lib/services/deckService';
  import { getGun, nodes, generateId } from '$lib/services/gunService';
  import { getCurrentUser } from '$lib/services/authService';
  import type { Card, Deck } from '$lib/types';
  import { standardizeValueId, standardizeCapabilityId } from '$lib/services/cardUtils';

  // Define interfaces for clarity
  interface ImportResult {
    success: boolean;
    message: string;
    added?: number;
    error?: string;
  }

  // Props in Svelte 5 Runes mode
  const props = $props<{ deckId?: string }>();

  // State variables
  let isLoading = $state(false);
  let result = $state<{ success: boolean; message: string } | null>(null);
  let deckIdValue = $state(props.deckId || 'd1');
  let deck = $state<Deck | null>(null);
  let userId = $state('');
  let decks = $state<Deck[]>([]);
  let importText = $state('');
  let isImporting = $state(false);
  let importResult = $state<ImportResult | null>(null);

  onMount(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      userId = currentUser.user_id;
    }
    await loadDecks();
    await loadDeck();
  });

  /** 
 * A card shape coming straight from the user’s import JSON 
 * (before we normalize into the Card interface for Gun.js) 
 */
interface RawImportCard {
  // Mandatory fields:
  card_number: string | number;
  role_title: string;

  // Optional descriptive fields:
  backstory?: string;
  goals?: string;
  obligations?: string;
  intellectual_property?: string;
  resources?: string;
  card_category?: string;
  type?: string;
  icon?: string;

  // Value inputs can be any of:
  // - comma-separated string
  // - array of strings
  // - object map of booleans
  values?: string | string[] | Record<string, boolean>;
  values_ref?: Record<string, boolean>;

  // Capability inputs can be any of:
  // - comma-separated string
  // - array of strings
  // - object map of booleans
  capabilities?: string | string[] | Record<string, boolean>;
  capabilities_ref?: Record<string, boolean>;

  // Catch-all for any extra properties your JSON might include:
  [k: string]: any;
}

  // Load all decks for dropdown
  async function loadDecks() {
    try {
      const gun = getGun();
      if (!gun) {
        console.error('Gun database not initialized');
        return;
      }

      const deckList: Deck[] = [];
      await new Promise<void>((resolve) => {
        gun.get(nodes.decks).map().once((deckData: Deck, deckId: string) => {
          if (deckData && deckData.deck_id) {
            deckList.push({
              ...deckData,
              deck_id: deckId,
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
          message: `Deck with ID ${deckIdValue} not found`,
        };
      }
    } catch (error) {
      console.error('Error loading deck:', error);
      result = {
        success: false,
        message: `Error loading deck: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      isLoading = false;
    }
  }

  async function updateDeckCreator() {
    if (!userId) {
      result = {
        success: false,
        message: 'No user logged in',
      };
      return;
    }
    if (!deck) {
      result = {
        success: false,
        message: 'No deck loaded',
      };
      return;
    }

    isLoading = true;
    result = null;
    try {
      const success = await updateDeck(deckIdValue, {
        name: 'Eco-Village Deck',
        creator_ref: userId,
      });
      if (success) {
        result = {
          success: true,
          message: `Successfully updated deck ${deckIdValue} with creator ${userId}`,
        };
        await loadDeck();
      } else {
        result = {
          success: false,
          message: 'Failed to update deck',
        };
      }
    } catch (error) {
      console.error('Error updating deck:', error);
      result = {
        success: false,
        message: `Error updating deck: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      isLoading = false;
    }
  }

  /** 
   * Turn a free-form values input into a { value_xxx: true } map 
   */
   function toValueRecord(input: unknown): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    if (!input) return out;
    if (typeof input === 'object' && !Array.isArray(input)) {
      for (const k of Object.keys(input as any)) {
        if ((input as any)[k]) {
          out[ standardizeValueId(k) ] = true;
        }
      }
    } else if (Array.isArray(input)) {
      for (const v of input as string[]) {
        out[ standardizeValueId(v) ] = true;
      }
    } else if (typeof input === 'string') {
      for (const v of (input as string).split(',')) {
        const t = v.trim();
        if (t) out[ standardizeValueId(t) ] = true;
      }
    }
    return out;
  }

  /** 
   * Same as above, but for capabilities (cap_ prefix) 
   */
  function toCapabilityRecord(input: unknown): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    if (!input) return out;
    if (typeof input === 'object' && !Array.isArray(input)) {
      for (const k of Object.keys(input as any)) {
        if ((input as any)[k]) {
          out[ standardizeCapabilityId(k) ] = true;
        }
      }
    } else if (Array.isArray(input)) {
      for (const v of input as string[]) {
        out[ standardizeCapabilityId(v) ] = true;
      }
    } else if (typeof input === 'string') {
      for (const v of (input as string).split(',')) {
        const t = v.trim();
        if (t) out[ standardizeCapabilityId(t) ] = true;
      }
    }
    return out;
  }


  // Helper function to convert various formats to Record<string, boolean>
  function toRecord(value: unknown): Record<string, boolean> {
    // Handle undefined or null
    if (value === undefined || value === null) {
      return {};
    }

    // Handle string input
    if (typeof value === 'string') {
      if (!value.trim()) return {};
      return value.split(',').reduce((acc, item) => {
        const trimmed = item.trim();
        if (trimmed) {
          acc[`value_${trimmed.toLowerCase().replace(/\s+/g, '_')}`] = true;
        }
        return acc;
      }, {} as Record<string, boolean>);
    }

    // Handle array input
    if (Array.isArray(value)) {
      return value.reduce((acc, item) => {
        if (typeof item === 'string' && item.trim()) {
          acc[`value_${item.toLowerCase().replace(/\s+/g, '_')}`] = true;
        }
        return acc;
      }, {} as Record<string, boolean>);
    }

    // Handle object input
    if (typeof value === 'object' && value !== null) {
      // Ensure it's a Record<string, boolean>
      const obj = value as Record<string, unknown>;
      return Object.keys(obj).reduce((acc, key) => {
        acc[key] = Boolean(obj[key]);
        return acc;
      }, {} as Record<string, boolean>);
    }

    // Fallback for unexpected types
    return {};
  }

  async function handleImportCards() {
    if (!importText.trim()) {
      importResult = {
        success: false,
        message: 'Please enter card data',
      };
      return;
    }

    isImporting = true;
    importResult = null;
    try {
      console.log(`Import text length: ${importText.length} characters`);
      let cardsData: RawImportCard[];
      try {
        console.log('Attempting to parse card data...');
        try {
          cardsData = JSON.parse(importText);
          console.log('Successfully parsed as standard JSON');
        } catch (standardJsonError) {
          console.log('Standard JSON parse failed, trying with JavaScript object format');
          const cleanedText = importText
            .replace(/\n/g, ' ')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/,\s*]/g, ']')
            .replace(/,\s*}/g, '}')
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
          try {
            const sanitizedText = cleanedText
              .replace(/'/g, '"')
              .replace(/:\s*"([^"]+)"/g, (match, p1) => ': "' + p1.replace(/"/g, '\\"') + '"');
            console.log('Sanitized text for parsing');
            cardsData = JSON.parse(sanitizedText);
            console.log('Successfully parsed as sanitized JavaScript object format');
          } catch (jsParseError) {
            console.log('Standard sanitization failed, trying more aggressive parsing');
            const objects = importText.match(/\{[^{}]*\}/g);
            if (objects && objects.length > 0) {
              const processedObjects = objects.map((obj) =>
                obj
                  .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
                  .replace(/'/g, '"')
                  .replace(/,\s*}/g, '}')
              );
              cardsData = JSON.parse('[' + processedObjects.join(',') + ']');
              console.log('Successfully parsed using object extraction method');
            } else {
              console.error('Object extraction failed, no valid objects found');
              throw new Error('No valid JSON objects found in the input');
            }
          }
        }
        if (!Array.isArray(cardsData)) {
          console.log('Data is not an array, converting single object to array');
          cardsData = [cardsData];
        }

        // Pre-process the data to ensure compatibility with our schema
        cardsData = cardsData.map((card) => {
          let cardNumber = card.card_number;
          if (typeof cardNumber === 'string') {
            cardNumber = parseInt(cardNumber, 10);
            if (isNaN(cardNumber)) {
              cardNumber = Math.floor(Math.random() * 52) + 1;
            }
          }

          // Normalize values_ref and capabilities_ref
          //const valuesRef = toRecord(card.values);
          //const capabilitiesRef = toRecord(card.capabilities);
          const valuesRef = toValueRecord(card.values || card.values_ref);
          const capabilitiesRef = toCapabilityRecord(card.capabilities || card.capabilities_ref);

          return {
            ...card,
            card_number: cardNumber,
            values_ref: valuesRef,
            capabilities_ref: capabilitiesRef,
            backstory: card.backstory || '',
            goals: card.goals || '',
            obligations: card.obligations || '',
            intellectual_property: card.intellectual_property || '',
            resources: card.resources || '',
            card_category: card.card_category || 'Supporters',
            type: card.type || 'Individual',
            icon: card.icon || 'User',
            creator_ref: userId,
          };
        });

        console.log(`Successfully parsed ${cardsData.length} cards from input data`);
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
          4. Values containing quotes need to be escaped`,
        };
        isImporting = false;
        return;
      }

      console.log('Validating card data...');
      let validCards = 0;
      for (const card of cardsData) {
        if (!card.role_title) {
          importResult = {
            success: false,
            message: 'Each card must have a role_title',
          };
          console.error('Validation failed - missing role_title', card);
          isImporting = false;
          return;
        }
        validCards++;
      }
      console.log(`Validation passed for all ${validCards} cards`);

      console.log(`Starting import of ${cardsData.length} cards to deck ${deckIdValue}`);
      const result = await importCardsToDeck(deckIdValue, cardsData as RawImportCard[]);
      if (result.success) {
        importResult = {
          success: true,
          message: `Successfully imported ${result.added} cards`,
          added: result.added,
        };
        console.log(`Import completed successfully. Added ${result.added} cards`);
        importText = '';
        await loadDeck();
      } else {
        importResult = {
          success: false,
          message: result.error || 'Failed to import cards',
          error: result.error,
        };
        console.error('Import failed with result:', result);
      }
    } catch (error) {
      console.error('Error importing cards:', error);
      importResult = {
        success: false,
        message: `Error importing cards: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      isImporting = false;
    }
  }
</script>

<div class="card p-4 bg-surface-50-900-token">
  <h3 class="h4 mb-4 flex items-center">
    <icons.Layers class="w-5 h-5 mr-2 text-primary-500" />
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
        onchange={(e: Event) => {
          const target = e.target as HTMLSelectElement;
          deckIdValue = target.value;
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

      <button class="btn variant-filled-primary" onclick={loadDeck} disabled={isLoading}>
        <icons.RefreshCcw class="w-4 h-4 mr-2" />
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
        <p><span class="font-semibold">Creator:</span> {deck.creator_ref || 'None'}</p>
        <p>
          <span class="font-semibold">Cards:</span>
          { Object.keys(deck.cards_ref ?? {}).length }
        </p>
      </div>
    </div>

    {#if result}
      <div class="alert {result.success ? 'variant-filled-success' : 'variant-filled-error'} mb-4">
        {#if result.success}
          <icons.CheckCircle class="w-5 h-5" />
        {:else}
          <icons.AlertTriangle class="w-5 h-5" />
        {/if}
        <div class="alert-message">
          <h4 class="h5">{result.success ? 'Success' : 'Error'}</h4>
          <p>{result.message}</p>
        </div>
      </div>
    {/if}

    <hr class="!border-t-2 my-6">

    <div class="mb-2">
      <h4 class="font-semibold mb-4">Import Cards</h4>
      <p class="text-sm mb-4">Paste JSON data for cards to import. Each card should include the following fields:</p>

      <div class="card p-3 bg-surface-100-800-token mb-4">
        <pre class="text-xs font-mono overflow-x-auto">
{`// Example card format—JavaScript object format (you can import array of these).
[
 {
   "card_number": 1,
   "role_title": "Luminos Funder",
   "backstory": "A wealthy idealist who left corporate life to fund sustainable communities.",
   "values_ref": ["Sustainability", "Equity", "Community Resilience"],
   "capabilities_ref": ["Grant-writing expertise", "Impact assessment"],
   "goals": "Fund projects that reduce ecological footprints and promote self-reliance.",
   "obligations": "Must report impact to a donor network; cannot fund profit-driven ventures.",
   "intellectual_property": "Database of sustainable tech solutions, funding strategy playbook.",
   "resources": "$50K in discretionary funds, limited staff time.",
   "card_category": "Funders",
   "type": "Individual",
   "icon": "sun"
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
        onclick={handleImportCards}
        disabled={isImporting || !importText.trim()}
      >
        {#if isImporting}
          <div class="spinner-third w-4 h-4 mr-2"></div>
          Importing...
        {:else}
          <icons.Upload class="w-4 h-4 mr-2" />
          Import Cards
        {/if}
      </button>

      {#if importResult}
        <div class="alert {importResult.success ? 'variant-filled-success' : 'variant-filled-error'} mt-4">
          {#if importResult.success}
            <icons.CheckCircle class="w-5 h-5" />
          {:else}
            <icons.AlertTriangle class="w-5 h-5" />
          {/if}
          <div class="alert-message">
            <h4 class="h5">{importResult.success ? 'Success' : 'Error'}</h4>
            <p>{importResult.message}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>