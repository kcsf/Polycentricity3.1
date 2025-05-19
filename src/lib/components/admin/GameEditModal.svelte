<script lang="ts">
  import { updateGame } from '$lib/services/gameService';
  import type { Game } from '$lib/types';
  import { GameStatus } from '$lib/types';

  let { isModalOpen = false, game = null, onclose, onupdate } = $props<{
    isModalOpen?: boolean;
    game?: Game | null;
    onclose?: () => void;
    onupdate?: () => void;
  }>();

  const statusOptions = Object.values(GameStatus).map(status => ({
    value: status,
    label: status.toLowerCase()
  }));

  let isLoading = $state(false);
  let formData = $state({
    name: '',
    description: '',
    creator_ref: '',
    deck_ref: '',
    deck_type: '',
    status: GameStatus.ACTIVE,
    max_players: 0,
    password: '',
    created_at: 0,
    updated_at: 0
  });

  $effect(() => {
    if (game && isModalOpen) {
      formData = {
        name: game.name || '',
        description: game.description || '',
        creator_ref: game.creator_ref || '',
        deck_ref: game.deck_ref || '',
        deck_type: game.deck_type || '',
        status: game.status || GameStatus.ACTIVE,
        max_players: game.max_players ?? 0,
        password: game.password || '',
        created_at: game.created_at || 0,
        updated_at: Date.now()
      };
    }
  });

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (!game) return;
    isLoading = true;

    const updates: Partial<Game> = {
      name: formData.name,
      description: formData.description,
      creator_ref: formData.creator_ref,
      deck_ref: formData.deck_ref,
      deck_type: formData.deck_type,
      status: formData.status,
      created_at: formData.created_at,
      updated_at: Date.now()
    };

    const parsed = parseInt(formData.max_players.toString(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      updates.max_players = parsed;
    }

    if (formData.password?.trim()) {
      updates.password = formData.password.trim();
    }

    try {
      const success = await updateGame(game.game_id, updates);
      if (success) {
        console.log(`[GameEditModal] Updated game ${game.game_id}`);
        onupdate?.();
        onclose?.();
      }
    } catch (err) {
      console.error('[GameEditModal] Error updating game:', err);
    } finally {
      isLoading = false;
    }
  }
</script>

{#if isModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
    <div class="bg-surface-100 dark:bg-surface-800 p-6 rounded-lg max-w-2xl w-full space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="h3">✏️ Edit Game</h3>
        <button type="button" onclick={onclose} class="text-2xl">❌</button>
      </div>
      <form onsubmit={handleSubmit} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label for="name" class="block text-sm font-medium">Game Name</label>
            <input
              id="name"
              type="text"
              bind:value={formData.name}
              class="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div class="space-y-1">
            <label for="description" class="block text-sm font-medium">Description</label>
            <textarea
              id="description"
              bind:value={formData.description}
              class="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px]"
              placeholder="Describe the purpose and rules of this game"
            ></textarea>
          </div>
          <div class="space-y-1">
            <label for="creator_ref" class="block text-sm font-medium">Creator Reference ID</label>
            <input
              id="creator_ref"
              type="text"
              bind:value={formData.creator_ref}
              class="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div class="space-y-1">
            <label for="deck_ref" class="block text-sm font-medium">Deck Reference ID</label>
            <input
              id="deck_ref"
              type="text"
              bind:value={formData.deck_ref}
              class="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div class="space-y-1">
            <label for="deck_type" class="block text-sm font-medium">Deck Type</label>
            <input
              id="deck_type"
              type="text"
              bind:value={formData.deck_type}
              class="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div class="space-y-1">
            <label for="status" class="block text-sm font-medium">Game Status</label>
            <select
              id="status"
              bind:value={formData.status}
              class="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {#each statusOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label for="max_players" class="block text-sm font-medium">Max Players (0 for unlimited)</label>
            <input
              id="max_players"
              type="number"
              bind:value={formData.max_players}
              class="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              min="0"
            />
          </div>
          <div class="space-y-1">
            <label for="password" class="block text-sm font-medium">Password (optional)</label>
            <input
              id="password"
              type="text"
              bind:value={formData.password}
              class="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Leave empty for open games"
            />
          </div>
        </div>
        {#if formData.created_at}
          <div class="text-sm text-surface-500">
            <div>Created: {new Date(formData.created_at).toLocaleString()}</div>
            {#if formData.updated_at && formData.updated_at !== formData.created_at}
              <div>Last Updated: {new Date(formData.updated_at).toLocaleString()}</div>
            {/if}
          </div>
        {/if}
        <div class="flex justify-end space-x-2">
          <button
            type="button"
            onclick={onclose}
            class="px-4 py-2 border border-surface-300 dark:border-surface-600 rounded-md text-surface-700 dark:text-surface-200 hover:bg-surface-200 dark:hover:bg-surface-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            disabled={isLoading}
          >
            {#if isLoading}
              <span class="animate-spin border-2 border-t-transparent border-white rounded-full w-4 h-4 mr-2"></span>
              Saving...
            {:else}
              💾 Save Changes
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}