<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import { get, getCollection, getSet, nodes } from '$lib/services/gunService';
  import type { Deck, Card, CardWithPosition, Value, Capability } from '$lib/types';
  import { page } from '$app/stores';
  import DeckManager from '$lib/components/admin/DeckManager.svelte';
  import CreateDeckModal from '$lib/components/admin/CreateDeckModal.svelte';

  // State variables using Svelte 5 Runes
  let selectedDeckId = $state('');
  let decks = $state<Deck[]>([]);
  let cards = $state<CardWithPosition[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // For accordion sections - empty array means all accordions are closed by default
  let accordionValue = $state<string[]>([]);

  // Load all decks for dropdown
  async function loadDecks() {
    isLoading = true;
    error = null;

    try {
      const deckList = await getCollection<Deck>(nodes.decks);
      console.log(
        '[DeckBrowser] Loaded decks:',
        deckList.map(d => ({ deck_id: d.deck_id, name: d.name, cards_ref: d.cards_ref }))
      );
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
      const deck = decks.find(d => d.deck_id === deckId);
      if (!deck) throw new Error(`Deck ${deckId} not found`);
      console.log('[DeckBrowser] Deck details:', { deck_id: deck.deck_id, name: deck.name });

      // Fetch card IDs under decks/<deckId>/cards_ref
      const cardIds = await getSet(`${nodes.decks}/${deckId}`, 'cards_ref');
      console.log(`[DeckBrowser] Card IDs for deck ${deckId}: ${cardIds.join(', ') || 'none'}`);

      if (cardIds.length === 0) {
        console.warn(`[DeckBrowser] No card IDs found for deck ${deckId}.`);
        error = `No cards found for deck ${deckId}. Please verify the deck's card references in the database.`;
        return;
      }

      const loadedCards = await Promise.all(
        cardIds.map(async (cardId) => {
          try {
            const card = await get<Card>(`${nodes.cards}/${cardId}`);
            if (!card) {
              console.warn(`[DeckBrowser] Card ${cardId} not found`);
              return null;
            }

            // Fetch value and capability IDs
            const valueIds = await getSet(`${nodes.cards}/${cardId}`, 'values_ref');
            const capabilityIds = await getSet(`${nodes.cards}/${cardId}`, 'capabilities_ref');
            console.log(`[DeckBrowser] Card ${cardId} value IDs:`, valueIds);
            console.log(`[DeckBrowser] Card ${cardId} capability IDs:`, capabilityIds);

            // Fetch names for values and capabilities
            const valueNames = await Promise.all(
              valueIds.map(async (vid) => {
                const value = await get<Value>(`${nodes.values}/${vid}`);
                return value?.name || vid;
              })
            );
            const capabilityNames = await Promise.all(
              capabilityIds.map(async (cid) => {
                const capability = await get<Capability>(`${nodes.capabilities}/${cid}`);
                return capability?.name || cid;
              })
            );

            const flatValues: Record<string, boolean> = {};
            valueIds.forEach(vid => { flatValues[vid] = true; });

            const flatCaps: Record<string, boolean> = {};
            capabilityIds.forEach(cid => { flatCaps[cid] = true; });

            const cardWithPosition: CardWithPosition = {
              ...card,
              values_ref: flatValues,
              capabilities_ref: flatCaps,
              position: { x: 0, y: 0 },
              _valueNames: valueNames,
              _capabilityNames: capabilityNames,
            };

            console.log(
              `[DeckBrowser] Loaded card ${cardId} (${card.role_title})`,
              { values: cardWithPosition._valueNames, capabilities: cardWithPosition._capabilityNames }
            );
            return cardWithPosition;
          } catch (err) {
            console.error(`[DeckBrowser] Error loading card ${cardId}:`, err);
            return null;
          }
        })
      );

      cards = loadedCards
        .filter((c): c is CardWithPosition => Boolean(c))
        .sort((a, b) => a.card_number - b.card_number);

      console.log(`[DeckBrowser] Finished loading ${cards.length} cards for deck ${deckId}`);
    } catch (err) {
      console.error(`[DeckBrowser] Error loading cards for deck ${deckId}:`, err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }

  function formatGoals(goals: string): string {
    return goals || '';
  }

  function getCategoryColor(category: string): string {
    switch (category) {
      case 'Funders': return 'primary';
      case 'Providers': return 'success';
      case 'Supporters': return 'secondary';
      default: return 'tertiary';
    }
  }

  function toPascalCase(str: string): string {
    return str
      .split('-')
      .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }

  function getCardIcon(iconName: string | undefined): any {
    if (!iconName) return icons.User;
    const name = toPascalCase(iconName);
    return (icons as any)[name] || icons.User;
  }

  function handleDeckChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedDeckId = select.value;
    loadDeckCards(selectedDeckId);
  }

  onMount(loadDecks);
</script>

<div class="deck-browser container mx-auto p-4 max-w-7xl">
  <div class="preset-tonal bg-surface-100-900 border-surface-200-800 rounded-lg p-4 mb-4 shadow-md">
    <div class="flex items-center space-x-4">
      <icons.Layout class="text-primary-500-400 w-6 h-6" />
      <div>
        <h3 class="h3 font-bold text-surface-900-50">Deck Browser</h3>
        <p class="text-sm text-surface-700-200">Explore cards in the selected deck with a vibrant new look.</p>
      </div>
    </div>
  </div>

  <Accordion value={accordionValue} onValueChange={e => (accordionValue = e.value as string[])} multiple>
    <Accordion.Item value="deck-selection">
      {#snippet lead()}
        <icons.CreditCard size={24} />
      {/snippet}
      {#snippet control()}Deck Browser{/snippet}
      {#snippet panel()}
        <div class="p-4">
          <div class="mb-6">
            <label for="deck-select" class="block text-sm font-medium mb-2 text-surface-900-50">Select Deck</label>
            <div class="flex gap-4 items-center">
              <select
                id="deck-select"
                class="preset-outlined rounded-md size-full md:size-1/2 lg:size-1/3 bg-surface-100-900 text-surface-900-50 border-surface-300-700 focus:border-primary-500-400"
                value={selectedDeckId}
                onchange={handleDeckChange}
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
                class="preset-filled bg-primary-500-400 text-white-950 border-primary-600-300 rounded-md flex items-center gap-2 hover:bg-primary-600-300 disabled:bg-surface-300-600/50"
                onclick={() => loadDeckCards(selectedDeckId)}
                disabled={isLoading}
              >
                <icons.RefreshCcw class="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {#if error}
            <div class="preset-filled bg-error-500-400 text-white-950 mb-4 flex items-center gap-3 rounded-md p-4">
              <icons.AlertTriangle class="w-5 h-5" />
              <div>
                <h3 class="text-sm font-bold">Error</h3>
                <p class="text-xs">{error}</p>
              </div>
            </div>
          {/if}

          {#if isLoading}
            <div class="flex items-center justify-center p-12">
              <div class="spinner-third w-10 h-10 text-primary-500-400"></div>
              <span class="ml-4 text-sm text-surface-700-200">Loading cards...</span>
            </div>
          {/if}

          {#if !isLoading && cards.length === 0}
            <div class="preset-tonal bg-surface-50-900 border-surface-200-800 rounded-lg p-6 text-center shadow-md">
              <icons.Package class="w-12 h-12 mx-auto mb-4 text-surface-500-400" />
              <h3 class="text-base font-bold text-surface-900-50 mb-2">No Cards Found</h3>
              <p class="text-xs text-surface-700-200">This deck doesn’t contain any cards or couldn’t be loaded.</p>
            </div>
          {:else if !isLoading}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {#each cards as card}
                {@const IconComponent = getCardIcon(card.icon)}
                <div class="preset-tonal overflow-hidden rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 bg-surface-100-900 border-surface-200-800">
                  <header class="relative p-2 text-white bg-gradient-to-r from-{getCategoryColor(card.card_category)}-500-400 to-{getCategoryColor(card.card_category)}-600-300 rounded-t-lg">
                    <div class="absolute left-2 top-2 bg-surface-900-50/50 rounded-full p-1">
                      <IconComponent class="w-6 h-6" />
                    </div>
                    <div class="flex items-center justify-between pl-10">
                      <h3 class="text-baseefeated font-bold truncate">{card.role_title}</h3>
                      <span class="badge bg-surface-100-900 text-surface-900-50 text-xs px-2 py-1 rounded-full">{card.card_number}</span>
                    </div>
                    <div class="flex items-center gap-2 text-xs mt-1 pl-10">
                      <span>{card.type}</span>
                      <span class="badge bg-white-950/20 text-white-950 ml-auto px-2 py-0.5 rounded-full">{card.card_category}</span>
                    </div>
                  </header>
                  <div class="p-2 space-y-1">
                    {#if card.backstory}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-200">Backstory</h4>
                        <p class="text-xs text-surface-900-50 line-clamp-2">{card.backstory}</p>
                      </div>
                    {/if}
                    {#if card._valueNames?.length}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-200">Values</h4>
                        <ul class="list-disc list-inside text-xs text-surface-900-50">
                          {#each card._valueNames as v}<li>{v}</li>{/each}
                        </ul>
                      </div>
                    {/if}
                    {#if card._capabilityNames?.length}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-200">Capabilities</h4>
                        <ul class="list-disc list-inside text-xs text-surface-900-50">
                          {#each card._capabilityNames as c}<li>{c}</li>{/each}
                        </ul>
                      </div>
                    {/if}
                    {#if card.goals}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-200">Goals</h4>
                        <p class="text-xs text-surface-900-50 line-clamp-2">{formatGoals(card.goals)}</p>
                      </div>
                    {/if}
                    {#if card.obligations}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-200">Obligations</h4>
                        <p class="text-xs text-surface-900-50 line-clamp-2">{card.obligations}</p>
                      </div>
                    {/if}
                    {#if card.intellectual_property || card.resources}
                      <div class="space-y-1 border-t border-surface-200-800 pt-1">
                        {#if card.intellectual_property}
                          <div>
                            <h4 class="text-xs font-semibold text-surface-700-200">IP</h4>
                            <p class="text-xs text-surface-900-50 line-clamp-1">{card.intellectual_property}</p>
                          </div>
                        {/if}
                        {#if card.resources}
                          <div>
                            <h4 class="text-xs font-semibold text-surface-700-200">Resources</h4>
                            <p class="text-xs text-surface-900-50 line-clamp-1">{card.resources}</p>
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
</style>