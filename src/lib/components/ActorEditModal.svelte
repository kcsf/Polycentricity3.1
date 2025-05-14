<script lang="ts">
  import type { Actor } from '$lib/types';
  import { get, putSigned, nodes } from '$lib/services/gunService';
  import { Save, X } from '@lucide/svelte';

  let { open = $bindable(false), actor = $bindable(null), onclose } = $props<{
    open: boolean;
    actor: Actor | null;
    onclose?: () => void;
  }>();
  let customName = $state('');
  let actorType = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // Sync internal state with actor prop and update parent when modal closes
  $effect(() => {
    if (actor) {
      customName = actor.custom_name || '';
      actorType = actor.actor_type || '';
    } else {
      customName = '';
      actorType = '';
    }
    return () => {
      open = false; // Update parent when modal is closed
      onclose?.(); // Trigger onclose callback
    };
  });

  // Reset messages when modal opens
  $effect(() => {
    if (open) {
      errorMessage = '';
      successMessage = '';
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!actor) return;

    isSubmitting = true;
    errorMessage = '';
    successMessage = '';

    try {
      const soul = `${nodes.actors}/${actor.actor_id}`;
      const currentActor = await get<Actor>(soul);
      if (!currentActor || !actor?.games_ref?.[currentActor.actor_id]) {
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
        actor_id: actor.actor_id,
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

      successMessage = 'Actor updated successfully!';
      setTimeout(() => {
        open = false;
        onclose?.();
      }, 1500);
    } catch (err) {
      console.error('Failed to update actor:', err);
      errorMessage = 'Failed to update actor. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    open = false;
    onclose?.();
  }
</script>

{#if open && actor}
  <div class="fixed inset-0 bg-surface-950-50/90 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
    <div class="card bg-surface-50-950/90 p-6 shadow-xl max-w-lg w-full m-4">
      <header class="flex justify-between items-start mb-4">
        <div>
          <h3 class="h3 text-primary-500">Edit Actor</h3>
          <p class="text-sm opacity-80">Update actor details below</p>
        </div>
        <button 
          type="button" 
          class="btn-icon preset-tonal-surface"
          onclick={handleCancel}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </header>

      <form onsubmit={handleSubmit} class="space-y-5">
        <!-- Custom Name -->
        <div class="space-y-2">
          <label for="actor-name" class="label font-medium text-surface-900-100">
            Custom Name
          </label>
          <input
            id="actor-name"
            type="text"
            class="input rounded-md border-primary-500/30 bg-surface-100-900 text-surface-900-100"
            placeholder="Custom actor name"
            value={customName}
            oninput={(e) => (customName = e.currentTarget.value)}
            required
          />
        </div>

        <!-- Actor Type -->
        <div class="space-y-2">
          <label for="actor-type" class="label font-medium text-surface-900-100">
            Actor Type
          </label>
          <input
            id="actor-type"
            type="text"
            class="input rounded-md border-primary-500/30 bg-surface-100-900 text-surface-900-100"
            placeholder="Farmer, Funder, etc."
            value={actorType}
            oninput={(e) => (actorType = e.currentTarget.value)}
            required
          />
        </div>

        <!-- Messages -->
        {#if errorMessage}
          <div class="alert preset-filled-error bg-error-500-100 text-error-900-50">
            <span>{errorMessage}</span>
          </div>
        {/if}
        {#if successMessage}
          <div class="alert preset-filled-success bg-success-500-100 text-success-900-50">
            <span>{successMessage}</span>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex justify-end gap-4 pt-4">
          <button
            type="button"
            class="btn preset-tonal-surface"
            onclick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            class="btn preset-tonal-secondary"
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <span class="animate-pulse">Saving...</span>
            {:else}
              Save Changes
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}