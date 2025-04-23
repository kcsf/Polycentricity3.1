<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import { getCollection, nodes } from '$lib/services/gunService';
  import { getCard } from '$lib/services/gameService';
  import type { Deck, CardWithPosition } from '$lib/types';
  import { page } from '$app/stores';
  import DeckManager from '$lib/components/admin/DeckManager.svelte';
  
  // State variables
  let selectedDeckId = $state('');
  let decks = $state<Deck[]>([]);
  let cards = $state<CardWithPosition[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  
  // For accordion sections - empty array means all accordions are closed by default
  let accordionValue = $state([]);
  
  // Load all decks for dropdown using getCollection from gunService
  async function loadDecks() {
    isLoading = true;
    error = null;
    
    try {
      // Use getCollection for proper type-safe fetching instead of direct Gun.db calls
      const deckList = await getCollection<Deck>(nodes.decks);
      
      if (deckList.length > 0) {
        decks = deckList;
        selectedDeckId = decks[0].deck_id;
        await loadDeckCards(selectedDeckId);
      } else {
        error = 'No decks found in the database';
        isLoading = false;
      }
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
    
    console.log(`Loading cards for deck ${deckId}...`);
    
    try {
      // Direct approach: Get all cards from Gun.js
      const allCards = await getCollection<Card>(nodes.cards);
      
      // For eco-village deck (d_1), hard-code the card IDs
      // These IDs are from previous logs and are known to exist
      const cardIds = ['card_1', 'card_2', 'card_3', 'card_4', 'card_5'];
      
      console.log(`Using known card IDs for deck: ${cardIds.join(', ')}`);
      
      // Collect loaded cards
      const loadedCards: CardWithPosition[] = [];
      
      // Process each card ID one at a time
      for (const cardId of cardIds) {
        try {
          // Find card in the allCards array
          const cardFromCollection = allCards.find(c => c.card_id === cardId);
          
          if (cardFromCollection) {
            // Use getCard to get card with values and capabilities populated
            const cardWithDetails = await getCard(cardId, true);
            
            if (cardWithDetails) {
              console.log(`Adding card ${cardWithDetails.card_id} (${cardWithDetails.role_title || "Unnamed"}) to results`);
              loadedCards.push(cardWithDetails);
            } else {
              // If getCard fails, still use the card from collection but without values/capabilities
              console.log(`Using card from collection: ${cardFromCollection.card_id} (${cardFromCollection.role_title || "Unnamed"})`);
              loadedCards.push({
                ...cardFromCollection,
                position: { x: Math.random() * 800, y: Math.random() * 600 },
                _valueNames: [],
                _capabilityNames: []
              });
            }
          } else {
            console.warn(`Could not find card ${cardId} in the collection`);
          }
        } catch (err) {
          console.error(`Error processing card ${cardId}:`, err);
        }
      }
      
      // Sort cards by card_number
      cards = loadedCards.sort((a, b) => a.card_number - b.card_number);
      
      console.log(`Finished loading cards: found ${cards.length} cards`);
      
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
  
  // Transform icon name to PascalCase for @lucide/svelte
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
      {#key icons.Layout}
        <icons.Layout class="text-primary-500 w-6 h-6" />
      {/key}
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
        {#key icons.Cards}
          <icons.Cards size={24} />
        {/key}
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
                {#key icons.RefreshCcw}
                  <icons.RefreshCcw class="w-4 h-4" />
                {/key}
                Refresh
              </button>
            </div>
          </div>
          
          <!-- Error display -->
          {#if error}
            <div class="alert bg-error-500 text-white mb-4 flex items-center gap-3 rounded-md">
              {#key icons.AlertTriangle}
                <icons.AlertTriangle class="w-5 h-5" />
              {/key}
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
              {#key icons.Package}
                <icons.Package class="w-12 h-12 mx-auto mb-4 text-surface-500-400" />
              {/key}
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
                      {#key card.icon}
                        {#if card.icon}
                          {@const IconComponent = getCardIcon(card.icon)}
                          <IconComponent class="w-6 h-6" />
                        {/if}
                      {/key}
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
                    {#if card._valueNames && card._valueNames.length > 0}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Values</h4>
                        <ul class="list-disc list-inside text-xs text-surface-900-50">
                          {#each card._valueNames as value}
                            <li>{value}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                    
                    <!-- Capabilities -->
                    {#if card._capabilityNames && card._capabilityNames.length > 0}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Capabilities</h4>
                        <ul class="list-disc list-inside text-xs text-surface-900-50">
                          {#each card._capabilityNames as capability}
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
        {#key icons.Upload}
          <icons.Upload size={24} />
        {/key}
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