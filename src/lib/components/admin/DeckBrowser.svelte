<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from 'svelte-lucide';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import { getDeck } from '$lib/services/deckService';
  import { getCardValueNames, getCardCapabilityNames } from '$lib/services/deckService';
  import type { Deck, Card } from '$lib/types';
  
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
    
    try {
      const gun = getGun();
      if (!gun) {
        error = 'Gun database not initialized';
        isLoading = false;
        return;
      }
      
      // Get the deck to find its card references
      const deck = await getDeck(deckId);
      if (!deck) {
        error = `Deck ${deckId} not found`;
        isLoading = false;
        return;
      }
      
      // Extract card IDs from the deck data
      const cardIds: string[] = [];
      
      // Handle different ways cards can be stored in decks
      if (deck.cards) {
        console.log('Deck cards object:', deck.cards);
        
        // Case 1: Cards stored as an array
        if (Array.isArray(deck.cards)) {
          console.log('Cards is an array');
          cardIds.push(...deck.cards);
        } 
        // Case 2: Cards is a reference to another Gun node (contains # property)
        else if (typeof deck.cards === 'object' && deck.cards['#']) {
          console.log('Cards is a reference to another Gun node:', deck.cards['#']);
          
          // We need to fetch the actual cards from the referenced node
          await new Promise<void>(resolve => {
            const cardsPath = deck.cards['#'];
            console.log(`Fetching cards from path: ${cardsPath}`);
            
            gun.get(cardsPath).map().once((value: any, cardId: string) => {
              if (value === true) {
                console.log(`Found card ID from reference: ${cardId}`);
                cardIds.push(cardId);
              }
            });
            
            // Give Gun time to process
            setTimeout(() => {
              console.log(`Found ${cardIds.length} cards from reference`);
              resolve();
            }, 500);
          });
        } 
        // Case 3: Cards stored as direct object with card_id: true format
        else {
          console.log('Cards is a direct object');
          cardIds.push(...Object.keys(deck.cards as Record<string, boolean>));
        }
      }
      
      console.log(`Final card IDs to fetch: ${cardIds.length}`, cardIds);
      
      // Load each card individually
      const loadedCards: Card[] = [];
      
      console.log(`Loading cards for deck ${deckId}. Found ${cardIds.length} card IDs:`, cardIds);
      
      for (const cardId of cardIds) {
        await new Promise<void>(resolve => {
          console.log(`Fetching card data for ${cardId}...`);
          gun.get(nodes.cards).get(cardId).once(async (cardData: Card) => {
            console.log(`Card data for ${cardId}:`, cardData);
            if (cardData && cardData.card_id) {
              loadedCards.push(cardData);
              
              // Get values and capabilities for this card
              cardValues[cardData.card_id] = await getCardValueNames(cardData);
              cardCapabilities[cardData.card_id] = await getCardCapabilityNames(cardData);
              console.log(`Added card ${cardData.card_id} with values:`, cardValues[cardData.card_id]);
            } else {
              console.warn(`Card ${cardId} data invalid or not found`);
            }
            resolve();
          });
        });
      }
      
      console.log(`Loaded ${loadedCards.length} cards:`, loadedCards);
      
      // Sort cards by card_number
      cards = loadedCards.sort((a, b) => a.card_number - b.card_number);
      
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
  
  // Get color based on card category
  function getCategoryColor(category: string): string {
    switch (category) {
      case 'Funders':
        return 'bg-blue-500';
      case 'Providers':
        return 'bg-green-500';
      case 'Supporters':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  }
  
  // Get icon component based on card icon name
  function getCardIcon(iconName: string | undefined): any {
    if (!iconName) return icons.User;
    return icons[iconName as keyof typeof icons] || icons.User;
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

<div class="deck-browser">
  <div class="card p-4 bg-surface-100-800-token mb-4">
    <div class="flex items-center space-x-4">
      <svelte:component this={icons.Layout} class="text-primary-500" />
      <div>
        <h3 class="h4">Deck Browser</h3>
        <p class="text-sm">Browse and explore cards in the selected deck.</p>
      </div>
    </div>
  </div>
  
  <Accordion value={accordionValue} onValueChange={(e) => (accordionValue = e.value)} multiple>
    <!-- Deck Selection Section -->
    <Accordion.Item value="deck-selection">
      {#snippet lead()}
        <svelte:component this={icons.Cards} size={24} />
      {/snippet}
      
      {#snippet control()}Deck Selection{/snippet}
      
      {#snippet panel()}
        <div class="p-4">
          <!-- Deck selection -->
          <div class="mb-6">
            <label for="deck-select" class="block text-sm font-medium mb-2">Select Deck</label>
            <div class="flex gap-4 items-center">
              <select 
                id="deck-select" 
                class="select rounded-md w-full md:w-1/2 lg:w-1/3"
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
                class="btn variant-filled-primary" 
                onclick={() => loadDeckCards(selectedDeckId)}
                disabled={isLoading}
              >
                <svelte:component this={icons.RefreshCcw} class="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
          
          <!-- Error display -->
          {#if error}
            <div class="alert variant-filled-error mb-4">
              <svelte:component this={icons.AlertTriangle} class="w-5 h-5" />
              <div class="alert-message">
                <h3 class="h4">Error</h3>
                <p>{error}</p>
              </div>
            </div>
          {/if}
          
          <!-- Loading indicator -->
          {#if isLoading}
            <div class="flex items-center justify-center p-12">
              <div class="spinner-third w-10 h-10"></div>
              <span class="ml-4 text-lg">Loading cards...</span>
            </div>
          {/if}
          
          <!-- Card grid -->
          {#if !isLoading && cards.length === 0}
            <div class="card p-6 bg-surface-50-900-token text-center">
              <svelte:component this={icons.Package} class="w-12 h-12 mx-auto mb-4 text-surface-400" />
              <h3 class="h4 mb-2">No Cards Found</h3>
              <p>This deck doesn't contain any cards or couldn't be loaded properly.</p>
            </div>
          {:else if !isLoading}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {#each cards as card}
                <div class="card p-0 overflow-hidden bg-surface-50-900-token shadow-lg hover:shadow-xl transition-shadow duration-200">
                  <!-- Card header -->
                  <header class="p-4 text-white {getCategoryColor(card.card_category)}">
                    <div class="flex items-center justify-between">
                      <h3 class="text-lg font-bold truncate">{card.role_title}</h3>
                      <span class="badge variant-filled-surface">{card.card_number}</span>
                    </div>
                    <div class="flex items-center mt-1 text-sm">
                      <svelte:component this={getCardIcon(card.icon)} class="w-4 h-4 mr-2" />
                      <span class="opacity-90">{card.type}</span>
                      <span class="badge variant-ghost-surface ml-auto">{card.card_category}</span>
                    </div>
                  </header>
                  
                  <!-- Card body -->
                  <div class="p-4">
                    <!-- Backstory -->
                    <div class="mb-3">
                      <h4 class="text-sm font-semibold text-surface-600-300-token mb-1">Backstory</h4>
                      <p class="text-sm">{card.backstory}</p>
                    </div>
                    
                    <!-- Values -->
                    {#if cardValues[card.card_id] && cardValues[card.card_id].length > 0}
                      <div class="mb-3">
                        <h4 class="text-sm font-semibold text-surface-600-300-token mb-1">Values</h4>
                        <div class="flex flex-wrap gap-1">
                          {#each cardValues[card.card_id] as value}
                            <span class="badge variant-soft-primary">{value}</span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    
                    <!-- Goals -->
                    {#if card.goals}
                      <div class="mb-3">
                        <h4 class="text-sm font-semibold text-surface-600-300-token mb-1">Goals</h4>
                        <p class="text-sm">{formatGoals(card.goals)}</p>
                      </div>
                    {/if}
                    
                    <!-- Obligations -->
                    {#if card.obligations}
                      <div class="mb-3">
                        <h4 class="text-sm font-semibold text-surface-600-300-token mb-1">Obligations</h4>
                        <p class="text-sm">{card.obligations}</p>
                      </div>
                    {/if}
                    
                    <!-- Capabilities -->
                    {#if cardCapabilities[card.card_id] && cardCapabilities[card.card_id].length > 0}
                      <div class="mb-3">
                        <h4 class="text-sm font-semibold text-surface-600-300-token mb-1">Capabilities</h4>
                        <div class="flex flex-wrap gap-1">
                          {#each cardCapabilities[card.card_id] as capability}
                            <span class="badge variant-soft-secondary">{capability}</span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    
                    <!-- IP & Resources -->
                    {#if card.intellectual_property || card.rivalrous_resources}
                      <div class="grid grid-cols-1 gap-2 mt-4 border-t border-surface-200-700-token pt-3">
                        {#if card.intellectual_property}
                          <div>
                            <h4 class="text-sm font-semibold text-surface-600-300-token mb-1">Intellectual Property</h4>
                            <p class="text-sm">{card.intellectual_property}</p>
                          </div>
                        {/if}
                        
                        {#if card.rivalrous_resources}
                          <div>
                            <h4 class="text-sm font-semibold text-surface-600-300-token mb-1">Resources</h4>
                            <p class="text-sm">{card.rivalrous_resources}</p>
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
  </Accordion>
</div>

<style>
  .deck-browser {
    min-height: 60vh;
  }
  
  .card {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .card header {
    border-radius: var(--theme-rounded-base) var(--theme-rounded-base) 0 0;
  }
</style>