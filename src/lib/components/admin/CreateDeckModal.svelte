<script lang="ts">
  import { FolderPlus, X } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { createDeck } from '$lib/services/gameService';

  const { open = false } = $props<{ open: boolean }>();
  const dispatch = createEventDispatcher();

  // Form state
  let name = $state('');
  let description = $state('');
  let isPublic = $state(true);
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // Reset form when modal opens
  $effect(() => {
    if (open) {
      name = '';
      description = '';
      isPublic = true;
      errorMessage = '';
      successMessage = '';
      console.log('Create Deck modal opened');
    }
  });

  // Debug input
  function logInput(field: string, value: string | boolean) {
    console.log(`Input changed: ${field} = ${value}`);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    isSubmitting = true;
    errorMessage = '';
    successMessage = '';

    try {
      console.log('Creating deck:', { name, description, is_public: isPublic });
      
      if (!name.trim()) {
        throw new Error('Deck name is required');
      }

      // Create the deck using gameService
      const deckId = await createDeck({
        name,
        description,
        is_public: isPublic
      });

      if (!deckId) {
        throw new Error('Failed to create deck - no deck ID returned');
      }

      console.log('Deck created successfully with ID:', deckId);
      successMessage = 'Deck created successfully!';
      
      // Notify parent component about successful creation
      dispatch('created', { deckId, name });
      
      // Close modal after a brief delay
      setTimeout(() => dispatch('update:open', false), 1500);
    } catch (error) {
      console.error('Create deck error:', error);
      errorMessage = `Creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    dispatch('update:open', false);
  }
</script>

{#if open}
<div class="fixed inset-0 bg-surface-950-50/90 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
  <div class="card bg-surface-50-800 p-6 shadow-xl max-w-lg w-full m-4 rounded-lg">
    <header class="flex justify-between items-start mb-4">
      <div class="flex items-center gap-2">
        <FolderPlus size={20} class="text-primary-500" />
        <div>
          <h3 class="h3 text-primary-500">Create New Deck</h3>
          <p class="text-sm opacity-80">Add a new card deck to the system</p>
        </div>
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
      <!-- Deck Name -->
      <div class="space-y-2">
        <label for="deck-name-input" class="label font-medium text-surface-900-100">
          Deck Name
        </label>
        <input
          id="deck-name-input"
          type="text"
          class="input rounded-md border-primary-500/30 bg-surface-100-900 text-surface-900-100"
          placeholder="Enter deck name"
          bind:value={name}
          oninput={(e) => logInput('name', e.currentTarget.value)}
          required
        />
      </div>

      <!-- Description -->
      <div class="space-y-2">
        <label for="description-input" class="label font-medium text-surface-900-100">
          Description
        </label>
        <textarea
          id="description-input"
          class="textarea rounded-md border-primary-500/30 bg-surface-100-900 text-surface-900-100"
          placeholder="Enter deck description"
          bind:value={description}
          oninput={(e) => logInput('description', e.currentTarget.value)}
          rows="3"
        ></textarea>
      </div>

      <!-- Visibility -->
      <div class="space-y-2">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            class="checkbox"
            checked={isPublic}
            onchange={(e) => {
              isPublic = e.currentTarget.checked;
              logInput('isPublic', isPublic);
            }}
          />
          <span class="text-surface-900-100">Make deck public</span>
        </label>
        <p class="text-xs text-surface-700-200">
          Public decks are available to all users. Private decks are only visible to administrators.
        </p>
      </div>

      <!-- Messages -->
      {#if errorMessage}
        <div class="alert preset-filled-error">
          <span>{errorMessage}</span>
        </div>
      {/if}
      {#if successMessage}
        <div class="alert preset-filled-success">
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
          class="btn preset-tonal-primary"
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <span class="animate-pulse">Creating...</span>
          {:else}
            Create Deck
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
{/if}