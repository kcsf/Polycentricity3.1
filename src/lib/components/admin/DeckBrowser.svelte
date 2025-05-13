<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import { get, getCollection, nodes } from '$lib/services/gunService';
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
  let isCreateModalOpen = $state(false);

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

  // Helper to format raw value/capability IDs into human names (from original getCard)
  function getCardNames(
    ref: Record<string, boolean> | undefined,
    prefix: "value_" | "cap_",
  ): string[] {
    if (!ref) return [];
    return Object.keys(ref)
      .filter((key) => key !== "_" && ref[key] && key.startsWith(prefix))
      .map((key) =>
        key
          .replace(prefix, "")
          .split(/[-_]/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      );
  }

  // Load cards for a specific deck using cards_ref
  async function loadDeckCards(deckId: string) {
    isLoading = true;
    error = null;
    cards = [];

    console.log(`[DeckBrowser] Loading cards for deck ${deckId}...`);

    try {
      // Find our deck in the local store
      const deck = decks.find(d => d.deck_id === deckId);
      if (!deck) {
        throw new Error(`Deck ${deckId} not found`);
      }
      console.log('[DeckBrowser] Deck details:', { id: deck.deck_id, name: deck.name });

      // Pull the flat list of pointers under decks/<deckId>/cards_ref
      const cardRefs = await getCollection<{ id: string }>(
        `${nodes.decks}/${deckId}/cards_ref`
      );
      // Filter to only clean card IDs (e.g. "card_1", "card_2", etc.)
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

      // Load each card with its value & capability names
      const loadedCards = await Promise.all(
        cardIds.map(async (cardId) => {
          try {
            const card = await get<Card>(`${nodes.cards}/${cardId}`);
            if (card) {
              // Fetch values_ref and capabilities_ref
              const values = await getCollection<Value>(`${nodes.cards}/${cardId}/values_ref`);
              const capabilities = await getCollection<Capability>(`${nodes.cards}/${cardId}/capabilities_ref`);

              const flatValues: Record<string, boolean> = {};
              values.forEach(v => {
                const vid = v.value_id || v.id;
                if (vid) flatValues[vid] = true;
              });

              const flatCaps: Record<string, boolean> = {};
              capabilities.forEach(c => {
                const cid = c.capability_id || c.id;
                if (cid) flatCaps[cid] = true;
              });

              const cardWithPosition: CardWithPosition = {
                ...card,
                values_ref: flatValues,
                capabilities_ref: flatCaps,
                position: { x: 0, y: 0 },
                _valueNames: getCardNames(flatValues, "value_"),
                _capabilityNames: getCardNames(flatCaps, "cap_"),
              };

              console.log(
                `[DeckBrowser] Loaded card ${cardId} (${card.role_title})`,
                { values: cardWithPosition._valueNames, capabilities: cardWithPosition._capabilityNames }
              );
              return cardWithPosition;
            }
            console.warn(`[DeckBrowser] Card ${cardId} not found`);
            return null;
          } catch (err) {
            console.error(`[DeckBrowser] Error loading card ${cardId}:`, err);
            return null;
          }
        })
      );

      // Filter out any nulls and sort by card_number
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
                on:change={handleDeckChange}
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
                class="btn bg-primary-500-token hover:bg-primary-600-token text-white flex items-center gap-2"
                on:click={() => loadDeckCards(selectedDeckId)}
                disabled={isLoading}
              >
                <icons.RefreshCcw class="w-4 h-4" />
                Refresh
              </button>
            </div>
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