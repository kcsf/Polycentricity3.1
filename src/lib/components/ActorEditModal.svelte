<script lang="ts">
  import type { Actor } from '$lib/types';
  import { get, putSigned, nodes } from '$lib/services/gunService';
  import { Save, X } from '@lucide/svelte';

  const props = $props<{ open?: boolean; actor?: Actor | null }>();
  let isOpen = $state(props.open || false);
  let customName = $state('');
  let actorType = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');

  // Sync props changes and handle actor reactivity
  $effect(() => {
    isOpen = props.open || false;
    if (props.actor) {
      customName = props.actor.custom_name || '';
      actorType = props.actor.actor_type || '';
    } else {
      customName = '';
      actorType = '';
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!props.actor) return;

    isSubmitting = true;
    errorMessage = '';

    try {
      const soul = `${nodes.actors}/${props.actor.actor_id}`;
      const currentActor = await get<Actor>(soul);
      if (!currentActor || currentActor.game_ref !== props.actor.game_ref) {
        errorMessage = 'Actor not found or invalid.';
        return;
      }

      const updatedActor: Actor = {
        ...currentActor,
        custom_name: customName,
        actor_type: actorType as Actor['actor_type'],
        updated_at: Date.now()
      };

      const ack = await putSigned(soul, updatedActor);
      if (ack.err) {
        errorMessage = 'Failed to update actor. Please try again.';
        return;
      }

      console.log('Updated actor:', {
        actor_id: props.actor.actor_id,
        custom_name: customName,
        actor_type: actorType
      });

      // Verify update
      setTimeout(async () => {
        const savedActor = await get<Actor>(soul);
        if (!savedActor || savedActor.custom_name !== customName || savedActor.actor_type !== actorType) {
          console.warn('Actor update verification failed, retrying');
          await putSigned(soul, updatedActor);
        }
      }, 500);

      isOpen = false;
    } catch (err) {
      console.error('Failed to update actor:', err);
      errorMessage = 'Failed to update actor. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    isOpen = false;
  }
</script>

{#if isOpen && props.actor}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full">
      <header class="mb-4">
        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Actor</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">Update actor details below</p>
      </header>

      <form onsubmit={handleSubmit} class="space-y-4">
        <!-- Custom Name -->
        <div class="space-y-1">
          <label for="actor-name" class="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Name</label>
          <input
            id="actor-name"
            type="text"
            class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Custom actor name"
            value={customName}
            oninput={(e) => (customName = e.currentTarget.value)}
          />
        </div>

        <!-- Actor Type -->
        <div class="space-y-1">
          <label for="actor-type" class="text-sm font-medium text-gray-700 dark:text-gray-300">Actor Type</label>
          <input
            id="actor-type"
            type="text"
            class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Farmer, Funder, etc."
            value={actorType}
            oninput={(e) => (actorType = e.currentTarget.value)}
          />
        </div>

        {#if errorMessage}
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <span>{errorMessage}</span>
          </div>
        {/if}

        <!-- Form Actions -->
        <div class="flex justify-end gap-4 pt-2">
          <button
            type="button"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            onclick={handleCancel}
            disabled={isSubmitting}
          >
            <X size={18} class="inline mr-2" />
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <svg class="animate-spin w-4 h-4 inline mr-2" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Saving...
            {:else}
              <Save size={18} class="inline mr-2" />
              Save Changes
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}