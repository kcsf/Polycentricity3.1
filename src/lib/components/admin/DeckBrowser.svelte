<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import { getCollection, nodes, purgeNode } from '$lib/services/gunService';
  import { getCard } from '$lib/services/gameService';
  import type { Deck, CardWithPosition } from '$lib/types';
  import { page } from '$app/stores';
  import DeckManager from '$lib/components/admin/DeckManager.svelte';
  import { resetGunDatabase } from '$lib/services/gunResetService';
  import { cleanupNullCardReferences } from '$lib/services/cleanupService';

  // State variables using Svelte 5 Runes
  let selectedDeckId = $state('');
  let decks = $state<Deck[]>([]);
  let cards = $state<CardWithPosition[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isCleaning = $state(false);
  let cleanupMessage = $state<string | null>(null);

  // For accordion sections - empty array means all accordions are closed by default
  let accordionValue = $state<string[]>([]);

  // Load all decks for dropdown
  async function loadDecks() {
    isLoading = true;
    error = null;

    try {
      const deckList = await getCollection<Deck>(nodes.decks);
      console.log('[DeckBrowser] Loaded decks:', $state.snapshot(deckList).map(d => ({ id: d.deck_id, name: d.name, cards_ref: d.cards_ref })));
      if (deckList.length > 0) {
        decks = deckList;
        selectedDeckId = deckList[0].deck_id;
        await loadDeckCards(selectedDeckId);
      } else {
        error = 'No decks found in the database';
      }
    } catch (err) {
      console.error('[DeckBrowser] Error loading decks:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }

  // Load cards for a specific deck using cards_ref
  async function loadDeckCards(deckId: string) {
    isLoading = true;
    error = null;
    cards = [];

    console.log(`[DeckBrowser] Loading cards for deck ${deckId}...`);

    try {
      // find our deck in the local store
      const deck = decks.find(d => d.deck_id === deckId);
      if (!deck) {
        throw new Error(`Deck ${deckId} not found`);
      }
      console.log('[DeckBrowser] Deck details:', { id: deck.deck_id, name: deck.name });

      // pull the flat list of pointers under decks/<deckId>/cards_ref
      const cardRefs = await getCollection<{ id: string }>(
        `${nodes.decks}/${deckId}/cards_ref`
      );
      // filter to only clean card IDs (e.g. "card_1", "card_2", etc.)
      const cardIds = cardRefs
        .map(r => r.id)
        .filter(id => /^card_\d+$/.test(id));

      console.log('[DeckBrowser] cards_ref raw keys:', cardRefs.map(r => r.id));
      console.log(
        `[DeckBrowser] Clean card IDs for deck ${deckId}: ${cardIds.join(', ') || 'none'}`
      );

      if (cardIds.length === 0) {
        console.warn(`[DeckBrowser] No card IDs found for deck ${deckId}.`);
        error = `No cards found for deck ${deckId}. Please verify the deck's card references in the database.`;
      }

      // now load each card with its value & capability names
      const loadedCards = await Promise.all(
        cardIds.map(async (cardId) => {
          try {
            const card = await getCard(cardId, true);
            if (card) {
              console.log(
                `[DeckBrowser] Loaded card ${cardId} (${card.role_title})`,
                { values: card._valueNames, capabilities: card._capabilityNames }
              );
              return card;
            }
            console.warn(`[DeckBrowser] Card ${cardId} not found`);
            return null;
          } catch (err) {
            console.error(`[DeckBrowser] Error loading card ${cardId}:`, err);
            return null;
          }
        })
      );

      // filter out any nulls and sort by card_number
      cards = loadedCards
        .filter((c): c is CardWithPosition => c !== null)
        .sort((a, b) => a.card_number - b.card_number);

      console.log(
        `[DeckBrowser] Finished loading ${cards.length} cards for deck ${deckId}`
      );
    } catch (err) {
      console.error(`[DeckBrowser] Error loading cards for deck ${deckId}:`, err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }




  // Format goals for display (goals is already a string)
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
    const pascalIconName = toPascalCase(iconName);
    return icons[pascalIconName as keyof typeof icons] || icons.User;
  }

  // Handle deck selection change
  function handleDeckChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedDeckId = select.value;
    loadDeckCards(selectedDeckId);
  }
  
  // Clear local component cache
  async function clearCache() {
    isCleaning = true;
    cleanupMessage = "Clearing component cache...";
    
    try {
      // Clear our local svelte state
      cards = [];
      decks = [];
      
      // Reload the data from Gun.js but bypass any caching
      await loadDecks();
      
      cleanupMessage = "Component cache cleared and data reloaded.";
      setTimeout(() => {
        cleanupMessage = null;
        isCleaning = false;
      }, 3000);
    } catch (err) {
      console.error("Error clearing cache:", err);
      cleanupMessage = `Error clearing cache: ${err instanceof Error ? err.message : String(err)}`;
      isCleaning = false;
    }
  }
  
  // Cleanup null card references
  async function cleanupNullRefs() {
    isCleaning = true;
    cleanupMessage = "Cleaning up null card references... This might take a few moments.";
    
    try {
      const result = await cleanupNullCardReferences();
      console.log("Cleanup result:", result);
      
      if (result.success) {
        cleanupMessage = `Successfully removed ${result.removed} null references. Reloading data...`;
        
        // Reload data
        await loadDecks();
        
        // Suggest next steps
        setTimeout(() => {
          cleanupMessage = `Cleanup completed. For stubborn database issues:
1. Try running the cleanup 2-3 times
2. Check the DB Explorer to verify problematic IDs are gone
3. If issues persist, try Force Purge Problem Nodes`;
          
          // Keep message visible but set cleaning to false
          isCleaning = false;
        }, 3000);
      } else {
        cleanupMessage = `Error during cleanup: ${result.error}`;
        isCleaning = false;
      }
    } catch (err) {
      console.error("Error cleaning up references:", err);
      cleanupMessage = `Error cleaning up references: ${err instanceof Error ? err.message : String(err)}`;
      isCleaning = false;
    }
  }
  
  // Direct purge for problematic nodes that resist standard cleanup
  async function purgeProblemNodesDirect() {
    isCleaning = true;
    cleanupMessage = "Forcefully purging problem nodes... This is a direct database operation.";
    
    try {
      // Specify the exact known problematic nodes to purge
      const problematicNodes = [
        "card_7252", 
        "card_1542", 
        "card__m9uawqaa_ll8gey0f", 
        "card__m9uawqrj_aplrvl0s",
        "card__m9u8x60b_1oy5qop1",
        "card__m9u8x6yc_jijzcs87"
      ];
      
      let successCount = 0;
      
      // Process each node with our special purge function
      for (const badNodeId of problematicNodes) {
        // Direct paths to clean from root card collection
        console.log(`Forcefully purging ${badNodeId} from database...`);
        
        // Use our aggressive purge method that tries multiple strategies
        const success = await purgeNode(`${nodes.cards}/${badNodeId}`);
        if (success) successCount++;
        
        // Also purge from d_1 deck's cards_ref collection (problematic area based on pasted data)
        await purgeNode(`${nodes.decks}/d_1/cards_ref/${badNodeId}`);
        
        // Also purge prefixed versions
        await purgeNode(`${nodes.decks}/d_1/cards_ref/cards/${badNodeId}`);
        
        // For completeness, check if there's a nested decks/d_1 path
        await purgeNode(`${nodes.decks}/d_1/decks/d_1/cards_ref/${badNodeId}`);
      }
      
      cleanupMessage = `Forcefully purged ${successCount}/${problematicNodes.length} problem nodes. Reloading data...`;
      
      // Reload data after the purge
      await loadDecks();
      
      // Final status
      setTimeout(() => {
        cleanupMessage = `Force purge complete. Check the DB Explorer to confirm the problematic nodes are gone. If problems persist, try using the database reset function from Admin Tools page.`;
        isCleaning = false;
      }, 3000);
    } catch (err) {
      console.error("Error during force purge:", err);
      cleanupMessage = `Error during force purge: ${err instanceof Error ? err.message : String(err)}`;
      isCleaning = false;
    }
  }

  onMount(() => {
    loadDecks();
  });
</script>

<div class="deck-browser container mx-auto p-4">
  <div class="card p-4 bg-surface-100-800-token mb-4 shadow-md border border-surface-300-600-token">
    <div class="flex items-center space-x-4">
      <icons.Layout class="text-primary-500-token w-6 h-6" />
      <div>
        <h3 class="h3 font-bold text-surface-900-50-token">Deck Browser</h3>
        <p class="text-sm text-surface-700-300-token">Explore cards in the selected deck with a vibrant new look.</p>
      </div>
    </div>
  </div>

  <Accordion value={accordionValue} onValueChange={(e) => (accordionValue = e.value as string[])} multiple>
    <!-- Deck Selection Section -->
    <Accordion.Item value="deck-selection">
      {#snippet lead()}
        <icons.Cards size={24} />
      {/snippet}
      {#snippet control()}Deck Browser{/snippet}
      {#snippet panel()}
        <div class="p-4">
          <!-- Deck selection -->
          <div class="mb-6">
            <label for="deck-select" class="block text-sm font-medium mb-2 text-surface-900-50-token">Select Deck</label>
            <div class="flex gap-4 items-center">
              <select
                id="deck-select"
                class="select rounded-md w-full md:w-1/2 lg:w-1/3 bg-surface-100-800-token text-surface-900-50-token border border-surface-300-600-token"
                value={selectedDeckId}
                onChange={handleDeckChange}
                disabled={isLoading || isCleaning}
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
                class="btn bg-primary-500-token hover:bg-primary-600-token text-white flex items-center gap-2"
                onclick={() => loadDeckCards(selectedDeckId)}
                disabled={isLoading || isCleaning}
              >
                <icons.RefreshCcw class="w-4 h-4" />
                Refresh
              </button>
            </div>
            
            <!-- Database maintenance buttons -->
            <div class="flex flex-wrap gap-2 mt-4">
              <button
                class="btn variant-ghost-warning flex items-center gap-2 text-sm"
                onclick={cleanupNullRefs}
                disabled={isLoading || isCleaning}
              >
                <icons.Eraser class="w-4 h-4" />
                Clean Null References
              </button>
              
              <button
                class="btn variant-ghost-error flex items-center gap-2 text-sm"
                onclick={clearCache}
                disabled={isLoading || isCleaning}
              >
                <icons.RefreshCcw class="w-4 h-4" />
                Clear Component Cache
              </button>
              
              <button
                class="btn variant-ghost-tertiary flex items-center gap-2 text-sm"
                onclick={purgeProblemNodesDirect}
                disabled={isLoading || isCleaning}
              >
                <icons.AlertTriangle class="w-4 h-4" />
                Force Purge Problem Nodes
              </button>
            </div>
            
            <!-- Cleanup status message -->
            {#if cleanupMessage}
              <div class="alert variant-soft-primary mt-2 p-2">
                <div class="flex items-center gap-2">
                  {#if isCleaning}
                    <div class="spinner-third w-4 h-4"></div>
                  {:else}
                    <icons.CheckCircle class="w-4 h-4" />
                  {/if}
                  <p class="text-sm">{cleanupMessage}</p>
                </div>
              </div>
            {/if}
          </div>

          <!-- Error display -->
          {#if error}
            <div class="alert bg-error-500-token text-white mb-4 flex items-center gap-3 rounded-md">
              <icons.AlertTriangle class="w-5 h-5" />
              <div>
                <h3 class="text-sm font-bold">Error</h3>
                <p class="text-xs">{error}</p>
              </div>
            </div>
          {/if}

          <!-- Loading indicator -->
          {#if isLoading}
            <div class="flex items-center justify-center p-12">
              <div class="spinner-third w-10 h-10 text-primary-500-token"></div>
              <span class="ml-4 text-sm text-surface-700-300-token">Loading cards...</span>
            </div>
          {/if}

          <!-- Card grid -->
          {#if !isLoading && cards.length === 0}
            <div class="card p-6 bg-surface-50-900-token text-center rounded-md shadow-md border border-surface-300-600-token">
              <icons.Package class="w-12 h-12 mx-auto mb-4 text-surface-500-400-token" />
              <h3 class="text-base font-bold text-surface-900-50-token mb-2">No Cards Found</h3>
              <p class="text-xs text-surface-700-300-token">This deck doesn't contain any cards or couldn't be loaded properly.</p>
            </div>
          {:else if !isLoading}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {#each cards as card}
                <div class="card overflow-hidden rounded-md shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 bg-surface-100-800-token border border-surface-300-600-token card-glow">
                  <!-- Card header -->
                  <header class="relative p-2 text-white bg-gradient-to-r from-{getCategoryColor(card.card_category)}-500-token to-{getCategoryColor(card.card_category)}-700-token rounded-t-md">
                    <div class="absolute left-2 top-2 bg-surface-900-token/50 rounded-full p-1">
                      {#if card.icon}
                        {@const IconComponent = getCardIcon(card.icon)}
                        <IconComponent class="w-6 h-6" />
                      {:else}
                        <icons.User class="w-6 h-6" />
                      {/if}
                    </div>
                    <div class="flex items-center justify-between pl-10">
                      <h3 class="text-base font-bold truncate">{card.role_title}</h3>
                      <span class="badge bg-surface-100-800-token text-surface-900-50-token text-xs px-2 py-1 rounded-full">{card.card_number}</span>
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
                      <h4 class="text-xs font-semibold text-surface-700-300-token">Backstory</h4>
                      <p class="text-xs text-surface-900-50-token line-clamp-2">{card.backstory}</p>
                    </div>

                    <!-- Values -->
                    {#if card._valueNames?.length}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300-token">Values</h4>
                        <ul class="list-disc list-inside text-xs text-surface-900-50-token">
                          {#each card._valueNames as value}
                            <li>{value}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}

                    <!-- Capabilities -->
                    {#if card._capabilityNames?.length}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300-token">Capabilities</h4>
                        <ul class="list-disc list-inside text-xs text-surface-900-50-token">
                          {#each card._capabilityNames as capability}
                            <li>{capability}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}

                    <!-- Goals -->
                    {#if card.goals}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300-token">Goals</h4>
                        <p class="text-xs text-surface-900-50-token line-clamp-2">{formatGoals(card.goals)}</p>
                      </div>
                    {/if}

                    <!-- Obligations -->
                    {#if card.obligations}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300-token">Obligations</h4>
                        <p class="text-xs text-surface-900-50-token line-clamp-2">{card.obligations}</p>
                      </div>
                    {/if}

                    <!-- IP & Resources -->
                    {#if card.intellectual_property || card.resources}
                      <div class="space-y-1 border-t border-surface-300-600-token pt-1">
                        {#if card.intellectual_property}
                          <div>
                            <h4 class="text-xs font-semibold text-surface-700-300-token">IP</h4>
                            <p class="text-xs text-surface-900-50-token line-clamp-1">{card.intellectual_property}</p>
                          </div>
                        {/if}
                        {#if card.resources}
                          <div>
                            <h4 class="text-xs font-semibold text-surface-700-300-token">Resources</h4>
                            <p class="text-xs text-surface-900-50-token line-clamp-1">{card.resources}</p>
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
        <icons.Upload size={24} />
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

<style>
  .deck-browser {
    max-width: 1400px;
  }
  .card-glow {
    position: relative;
  }
  .card-glow:hover {
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
  }
</style>