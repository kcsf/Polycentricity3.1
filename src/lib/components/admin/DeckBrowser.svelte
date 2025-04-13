<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from 'svelte-lucide';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import { getDeck } from '$lib/services/deckService';
  import { getCardValueNames, getCardCapabilityNames } from '$lib/services/deckService';
  import type { Deck, Card } from '$lib/types';
  import { page } from '$app/stores';
  import DeckManager from '$lib/components/admin/DeckManager.svelte';
  
  // State variables
  let selectedDeckId = $state('');
  let decks = $state<Deck[]>([]);
  let cards = $state<Card[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  
  // Card display metadata
  let cardValues = $state<Record<string, string[]>>({});
  let cardCapabilities = $state<Record<string, string[]>>({});
  
  // For accordion sections - empty array means all accordions are closed by default
  let accordionValue = $state([]);
  
  // Load all decks for dropdown
  async function loadDecks() {
    isLoading = true;
    error = null;
    
    try {
      const gun = getGun();
      if (!gun) {
        error = 'Gun database not initialized';
        isLoading = false;
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
          decks = deckList;
          if (decks.length > 0) {
            selectedDeckId = decks[0].deck_id;
            loadDeckCards(selectedDeckId);
          } else {
            isLoading = false;
          }
          resolve();
        }, 500);
      });
    } catch (err) {
      console.error('Error loading decks:', err);
      error = err instanceof Error ? err.message : String(err);
      isLoading = false;
    }
  }
  
  // Load cards for a specific deck
  async function loadDeckCards(deckId: string) {
    isLoading = true;
    error = null;
    cards = [];
    cardValues = {};
    cardCapabilities = {};
    
    console.log(`Loading cards for deck ${deckId}...`);
    
    try {
      const gun = getGun();
      if (!gun) {
        error = 'Gun database not initialized';
        isLoading = false;
        return;
      }
      
      // DIRECT APPROACH: Query all cards in the database
      // This will bypass the need to follow references and just look at all cards directly
      const loadedCards: Card[] = [];
      
      // First get the deck to confirm it exists
      const deck = await getDeck(deckId);
      if (!deck) {
        error = `Deck ${deckId} not found`;
        isLoading = false;
        return;
      }
      
      console.log(`Deck found:`, JSON.stringify(deck));
      
      // ENHANCED APPROACH: Handle both reference types in decks
      const cardIds: string[] = [];
      
      // CASE 1: Check if the deck has a cards property with a Gun.js reference
      // This handles the case where cards is stored as {"#":"decks/d1/cards"} format
      if (deck.cards && typeof deck.cards === 'object' && '#' in deck.cards) {
        console.log(`Deck has cards stored as a Gun reference: ${(deck.cards as any)['#']}`);
        
        // Get the reference path and follow it to get the actual card IDs
        const cardsPath = (deck.cards as any)['#'];
        
        // Wait a bit to access the referenced soul
        await new Promise<void>(resolve => {
          // Follow the reference and collect all card IDs
          gun.get(cardsPath).map().once((value: any, cardId: string) => {
            if (value === true) {
              console.log(`Found card ID ${cardId} in deck ${deckId} via reference`);
              if (!cardIds.includes(cardId)) cardIds.push(cardId);
            }
          });
          
          // Allow time for all references to be resolved
          setTimeout(resolve, 1000);
        });
      }
      
      // CASE 2: Direct cards collection in the deck
      // This handles the case where cards is stored as a direct object: {"card1": true, "card2": true}
      if (deck.cards && typeof deck.cards === 'object' && !('#' in deck.cards)) {
        Object.keys(deck.cards).forEach(cardId => {
          if ((deck.cards as Record<string, boolean>)[cardId] === true) {
            console.log(`Found card ID ${cardId} directly in deck ${deckId}`);
            if (!cardIds.includes(cardId)) cardIds.push(cardId);
          }
        });
      }
      
      console.log(`Found ${cardIds.length} card IDs that should be in deck ${deckId}: ${cardIds.join(', ')}`);
      
      // CASE 3: If no cards found through direct references, fallback to scanning all cards
      // Only do this if we didn't find any cards via the direct approach
      if (cardIds.length === 0) {
        console.log(`No cards found through direct references, scanning all cards...`);
        
        await new Promise<void>(resolve => {
          // For each card in the database, check if it belongs to this deck
          gun.get(nodes.cards).map().once(async (cardData: Card) => {
            if (!cardData || !cardData.card_id) return;
            
            // Check for direct deck reference in card
            if (cardData.decks && typeof cardData.decks === 'object') {
              if ('#' in cardData.decks) {
                // It's a Soul reference, we'd normally need to follow but we'll just assume
                console.log(`Card ${cardData.card_id} has a decks reference that might contain deck ${deckId}`);
                if (!cardIds.includes(cardData.card_id)) cardIds.push(cardData.card_id);
              } else if (cardData.decks[deckId] === true) {
                console.log(`Card ${cardData.card_id} directly references deck ${deckId}`);
                if (!cardIds.includes(cardData.card_id)) cardIds.push(cardData.card_id);
              }
            }
          });
          
          // Give time for all the cards to be processed
          setTimeout(resolve, 1500);
        });
      }
      
      // Now load the actual card data for each card ID we found
      console.log(`Loading ${cardIds.length} card details...`);
      
      for (const cardId of cardIds) {
        try {
          // Get card data by ID - use retry approach
          const maxRetries = 2;
          let retries = 0;
          let cardData = null;
          
          while (!cardData && retries <= maxRetries) {
            try {
              cardData = await new Promise<Card | null>(resolve => {
                gun.get(`${nodes.cards}/${cardId}`).once((data: Card) => {
                  if (data && data.card_id) resolve(data);
                  else resolve(null);
                });
                
                // Timeout if card isn't found quickly
                setTimeout(() => resolve(null), 1000);
              });
              
              if (!cardData && retries < maxRetries) {
                retries++;
                console.log(`Retry ${retries}/${maxRetries} for card ${cardId}`);
                await new Promise(r => setTimeout(r, 500 * retries));
              }
            } catch (err) {
              console.error(`Error fetching card ${cardId}:`, err);
              retries++;
              if (retries <= maxRetries) {
                await new Promise(r => setTimeout(r, 500 * retries));
              }
            }
          }
          
          if (cardData) {
            console.log(`Adding card ${cardData.card_id} (${cardData.role_title || "Unnamed"}) to results`);
            loadedCards.push(cardData);
            
            // Load values and capabilities
            cardValues[cardData.card_id] = await getCardValueNames(cardData);
            cardCapabilities[cardData.card_id] = await getCardCapabilityNames(cardData);
          } else {
            console.warn(`Could not load data for card ${cardId} after ${maxRetries} retries`);
          }
        } catch (err) {
          console.error(`Error processing card ${cardId}:`, err);
        }
      }
      
      console.log(`Finished loading cards: found ${loadedCards.length} cards for deck ${deckId}`);
      
      // Sort cards by card_number and update state
      cards = loadedCards.sort((a, b) => a.card_number - b.card_number);
      console.log(`Loaded and sorted ${cards.length} cards for deck ${deckId}`);
      
    } catch (err) {
      console.error(`Error loading cards for deck ${deckId}:`, err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }
  
  // Format goals for display (now goals is already a string in Gun.js)
  function formatGoals(goals: string): string {
    return goals || '';
  }
  
  // Get color based on card category using Skeleton UI tokens
  function getCategoryColor(category: string): string {
    switch (category) {
      case 'Funders':
        return 'primary'; // Fennec theme: blue
      case 'Providers':
        return 'success'; // Fennec theme: green
      case 'Supporters':
        return 'secondary'; // Fennec theme: purple
      default:
        return 'tertiary'; // Fennec theme: gray
    }
  }
  
  // Transform icon name to PascalCase for svelte-lucide
  function toPascalCase(str: string): string {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
  
  // Get icon component based on card icon name
  function getCardIcon(iconName: string | undefined): any {
    if (!iconName) return icons.User;
    const pascalIconName = toPascalCase(iconName); // e.g., 'sun' -> 'Sun', 'circle-dollar-sign' -> 'CircleDollarSign'
    return icons[pascalIconName as keyof typeof icons] || icons.User;
  }
  
  // Handle deck selection change
  function handleDeckChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedDeckId = select.value;
    loadDeckCards(selectedDeckId);
  }
  
  onMount(() => {
    loadDecks();
  });
</script>

<div class="deck-browser container mx-auto p-4">
  <div class="card p-4 bg-surface-100-800 mb-4 shadow-md border border-surface-300-600">
    <div class="flex items-center space-x-4">
      <svelte:component this={icons.Layout} class="text-primary-500 w-6 h-6" />
      <div>
        <h3 class="h3 font-bold text-surface-900-50">Deck Browser</h3>
        <p class="text-sm text-surface-700-300">Explore cards in the selected deck with a vibrant new look.</p>
      </div>
    </div>
  </div>
  
  <Accordion value={accordionValue} onValueChange={(e) => (accordionValue = e.value)} multiple>
    <!-- Deck Selection Section -->
    <Accordion.Item value="deck-selection">
      {#snippet lead()}
        <svelte:component this={icons.Cards} size={24} />
      {/snippet}
      
      {#snippet control()}Deck Browser{/snippet}
      
      {#snippet panel()}
        <div class="p-4">
          <!-- Deck selection -->
          <div class="mb-6">
            <label for="deck-select" class="block text-sm font-medium mb-2 text-surface-900-50">Select Deck</label>
            <div class="flex gap-4 items-center">
              <select 
                id="deck-select" 
                class="select rounded-md w-full md:w-1/2 lg:w-1/3 bg-surface-100-800 text-surface-900-50 border border-surface-300-600"
                value={selectedDeckId}
                onchange={(e) => handleDeckChange(e)}
                disabled={isLoading}
              >
                {#if decks.length === 0}
                  <option value="">No decks available</option>
                {:else}
                  {#each decks as deck}
                    <option value={deck.deck_id}>{deck.name}</option>
                  {/each}
                {/if}
              </select>
              
              <button 
                class="btn bg-primary-500 hover:bg-primary-600 text-white flex items-center gap-2"
                onclick={() => loadDeckCards(selectedDeckId)}
                disabled={isLoading}
              >
                <svelte:component this={icons.RefreshCcw} class="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
          
          <!-- Error display -->
          {#if error}
            <div class="alert bg-error-500 text-white mb-4 flex items-center gap-3 rounded-md">
              <svelte:component this={icons.AlertTriangle} class="w-5 h-5" />
              <div>
                <h3 class="text-sm font-bold">Error</h3>
                <p class="text-xs">{error}</p>
              </div>
            </div>
          {/if}
          
          <!-- Loading indicator -->
          {#if isLoading}
            <div class="flex items-center justify-center p-12">
              <div class="spinner-third w-10 h-10 text-primary-500"></div>
              <span class="ml-4 text-sm text-surface-700-300">Loading cards...</span>
            </div>
          {/if}
          
          <!-- Card grid -->
          {#if !isLoading && cards.length === 0}
            <div class="card p-6 bg-surface-50-900 text-center rounded-md shadow-md border border-surface-300-600">
              <svelte:component this={icons.Package} class="w-12 h-12 mx-auto mb-4 text-surface-500-400" />
              <h3 class="text-base font-bold text-surface-900-50 mb-2">No Cards Found</h3>
              <p class="text-xs text-surface-700-300">This deck doesn't contain any cards or couldn't be loaded properly.</p>
            </div>
          {:else if !isLoading}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {#each cards as card}
                <div class="card overflow-hidden rounded-md shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 bg-surface-100-800 border border-surface-300-600 card-glow">
                  <!-- Card header -->
                  <header class="relative p-2 text-white bg-gradient-to-r from-{getCategoryColor(card.card_category)}-500 to-{getCategoryColor(card.card_category)}-700 rounded-t-md">
                    <div class="absolute left-2 top-2 bg-surface-900/50 rounded-full p-1">
                      <svelte:component this={getCardIcon(card.icon)} class="w-6 h-6" />
                    </div>
                    <div class="flex items-center justify-between pl-10">
                      <h3 class="text-base font-bold truncate">{card.role_title}</h3>
                      <span class="badge bg-surface-100-800 text-surface-900-50 text-xs px-2 py-1 rounded-full">{card.card_number}</span>
                    </div>
                    <div class="flex items-center gap-2 text-xs mt-1 pl-10">
                      <span>{card.type}</span>
                      <span class="badge bg-white/20 text-white ml-auto px-2 py-0.5 rounded-full">{card.card_category}</span>
                    </div>
                  </header>
                  
                  <!-- Card body -->
                  <div class="p-2 space-y-1">
                    <!-- Backstory -->
                    <div>
                      <h4 class="text-xs font-semibold text-surface-700-300">Backstory</h4>
                      <p class="text-xs text-surface-900-50 line-clamp-2">{card.backstory}</p>
                    </div>
                    
                    <!-- Values -->
                    {#if cardValues[card.card_id] && cardValues[card.card_id].length > 0}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Values</h4>
                        <ul class="list-disc list-inside text-xs text-surface-900-50">
                          {#each cardValues[card.card_id] as value}
                            <li>{value}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                    
                    <!-- Capabilities -->
                    {#if cardCapabilities[card.card_id] && cardCapabilities[card.card_id].length > 0}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Capabilities</h4>
                        <ul class="list-disc list-inside text-xs text-surface-900-50">
                          {#each cardCapabilities[card.card_id] as capability}
                            <li>{capability}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                    
                    <!-- Goals -->
                    {#if card.goals}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Goals</h4>
                        <p class="text-xs text-surface-900-50 line-clamp-2">{formatGoals(card.goals)}</p>
                      </div>
                    {/if}
                    
                    <!-- Obligations -->
                    {#if card.obligations}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Obligations</h4>
                        <p class="text-xs text-surface-900-50 line-clamp-2">{card.obligations}</p>
                      </div>
                    {/if}
                    
                    <!-- IP & Resources -->
                    {#if card.intellectual_property || card.rivalrous_resources}
                      <div class="space-y-1 border-t border-surface-300-600 pt-1">
                        {#if card.intellectual_property}
                          <div>
                            <h4 class="text-xs font-semibold text-surface-700-300">IP</h4>
                            <p class="text-xs text-surface-900-50 line-clamp-1">{card.intellectual_property}</p>
                          </div>
                        {/if}
                        
                        {#if card.rivalrous_resources}
                          <div>
                            <h4 class="text-xs font-semibold text-surface-700-300">Resources</h4>
                            <p class="text-xs text-surface-900-50 line-clamp-1">{card.rivalrous_resources}</p>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/snippet}
    </Accordion.Item>
    
    <!-- Card Import Section -->
    <Accordion.Item value="card-import">
      {#snippet lead()}
        <svelte:component this={icons.Upload} size={24} />
      {/snippet}
      
      {#snippet control()}Import Cards{/snippet}
      
      {#snippet panel()}
        <div class="p-4">
          <DeckManager deckId={$page.url.searchParams.get('deckId') || 'd1'} />
        </div>
      {/snippet}
    </Accordion.Item>
  </Accordion>
</div>