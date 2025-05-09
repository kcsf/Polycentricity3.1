<script lang="ts">
  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import * as icons from '@lucide/svelte';
  import { createAgreement } from '$lib/services/gameService';
  import { getCurrentUser } from '$lib/services/authService';
  import type { ActorWithCard } from '$lib/types';
  import { toaster } from '$lib/utils/toaster-svelte';

  // Define toaster options type (assumed based on Skeleton Labs)
  interface ToasterOptions {
    title: string;
    description: string;
  }

  // Define terms type based on Agreement.parties structure
  interface AgreementTerms {
    [actorId: string]: {
      obligations: string[];
      benefits: string[];
    };
  }

  // Define input fields type
  interface InputFields {
    [actorId: string]: string;
  }

  // Props
  const { gameId, actorsList, currentActorId } = $props<{
    gameId: string;
    actorsList: ActorWithCard[];
    currentActorId: string;
  }>();

  // State
  let modalOpen = $state(false);
  let selectedParties = $state<string[]>([]);
  let terms = $state<AgreementTerms>({});
  let newObligations = $state<InputFields>({});
  let newBenefits = $state<InputFields>({});
  let title = $state('');
  let description = $state('');
  let agreementType = $state<'symmetric' | 'asymmetric'>('asymmetric');
  let isSubmitting = $state(false);

  // Initialize current actor's selection
  function initializeCurrentActor() {
    if (currentActorId && !selectedParties.includes(currentActorId)) {
      toggleParty(currentActorId);
    }
  }

  // Reset the form
  function resetForm() {
    title = '';
    description = '';
    selectedParties = [];
    terms = {};
    newObligations = {};
    newBenefits = {};
    agreementType = 'asymmetric';
    isSubmitting = false;

    // Always add the current user's actor when resetting
    if (currentActorId) {
      toggleParty(currentActorId);
    }
  }

  // Toggle party selection
  function toggleParty(actorId: string) {
    // Prevent deselecting the current user's actor
    if (selectedParties.includes(actorId) && actorId === currentActorId) {
      console.log(`Cannot deselect current user's actor: ${actorId}`);
      return;
    }

    if (selectedParties.includes(actorId)) {
      // Remove actor and its terms
      selectedParties = selectedParties.filter((id) => id !== actorId);

      // Create a new terms object without the removed actor
      const newTerms: AgreementTerms = {};
      for (const id in terms) {
        if (id !== actorId) {
          newTerms[id] = terms[id];
        }
      }
      terms = newTerms;

      // Create new input objects without the removed actor
      const newObligationsObj: InputFields = {};
      for (const id in newObligations) {
        if (id !== actorId) {
          newObligationsObj[id] = newObligations[id];
        }
      }
      newObligations = newObligationsObj;

      const newBenefitsObj: InputFields = {};
      for (const id in newBenefits) {
        if (id !== actorId) {
          newBenefitsObj[id] = newBenefits[id];
        }
      }
      newBenefits = newBenefitsObj;
    } else {
      // Add actor with empty terms
      selectedParties = [...selectedParties, actorId];
      terms = {
        ...terms,
        [actorId]: { obligations: [], benefits: [] },
      };
      newObligations = { ...newObligations, [actorId]: '' };
      newBenefits = { ...newBenefits, [actorId]: '' };

      console.log(`Added actor ${actorId} to terms:`, JSON.stringify(terms));
    }
  }

  // Add a new obligation
  function addObligation(actorId: string) {
    if (!newObligations[actorId]?.trim()) return;

    // Initialize terms[actorId] if it doesn't exist
    if (!terms[actorId]) {
      terms = {
        ...terms,
        [actorId]: { obligations: [], benefits: [] },
      };
    }

    terms = {
      ...terms,
      [actorId]: {
        ...terms[actorId],
        obligations: [...terms[actorId].obligations, newObligations[actorId]],
      },
    };
    newObligations = { ...newObligations, [actorId]: '' };
  }

  // Add a new benefit
  function addBenefit(actorId: string) {
    if (!newBenefits[actorId]?.trim()) return;

    // Initialize terms[actorId] if it doesn't exist
    if (!terms[actorId]) {
      terms = {
        ...terms,
        [actorId]: { obligations: [], benefits: [] },
      };
    }

    terms = {
      ...terms,
      [actorId]: {
        ...terms[actorId],
        benefits: [...terms[actorId].benefits, newBenefits[actorId]],
      },
    };
    newBenefits = { ...newBenefits, [actorId]: '' };
  }

  // Remove an obligation
  function removeObligation(actorId: string, index: number) {
    if (!terms[actorId]) {
      console.error(`Cannot remove obligation - terms[${actorId}] does not exist`);
      return;
    }

    terms = {
      ...terms,
      [actorId]: {
        ...terms[actorId],
        obligations: terms[actorId].obligations.filter((_, i) => i !== index),
      },
    };
  }

  // Remove a benefit
  function removeBenefit(actorId: string, index: number) {
    if (!terms[actorId]) {
      console.error(`Cannot remove benefit - terms[${actorId}] does not exist`);
      return;
    }

    terms = {
      ...terms,
      [actorId]: {
        ...terms[actorId],
        benefits: terms[actorId].benefits.filter((_, i) => i !== index),
      },
    };
  }

  // Handle form submission
  async function handleSubmit() {
    // Form validation
    if (!title.trim()) {
      console.log('Validation error: Missing title');
      toaster.error({
        title: 'Validation Error',
        description: 'Please enter a title for the agreement',
      } as ToasterOptions);
      return;
    }

    if (!description.trim()) {
      toaster.error({
        title: 'Validation Error',
        description: 'Please enter a description for the agreement',
      } as ToasterOptions);
      return;
    }

    if (selectedParties.length < 1) {
      toaster.error({
        title: 'Validation Error',
        description: 'Please select at least one party for the agreement',
      } as ToasterOptions);
      return;
    }

    // Validate that each party has at least one obligation or benefit
    for (const actorId of selectedParties) {
      // Ensure terms[actorId] exists
      if (!terms[actorId]) {
        terms = {
          ...terms,
          [actorId]: { obligations: [], benefits: [] },
        };
      }

      if (terms[actorId].obligations.length === 0 && terms[actorId].benefits.length === 0) {
        const actor = actorsList.find((a: ActorWithCard) => a.actor_id === actorId);
        toaster.error({
          title: 'Validation Error',
          description: `${actor?.card?.role_title || actor?.custom_name || 'Actor'} needs at least one obligation or benefit`,
        } as ToasterOptions);
        return;
      }
    }

    isSubmitting = true;
    try {
      // Ensure we have a valid gameId
      if (!gameId) {
        throw new Error('Missing gameId');
      }

      // Ensure each actor in selectedParties exists
      for (const actorId of selectedParties) {
        if (!actorsList.find((a: ActorWithCard) => a.actor_id === actorId)) {
          throw new Error(`Actor ${actorId} not found in actorsList`);
        }
      }

      // Check if any actors are missing card references
      for (const actorId of selectedParties) {
        const actor = actorsList.find((a: ActorWithCard) => a.actor_id === actorId);

        if (!actor?.card) {
          throw new Error(
            `Actor ${actorId} (${actor?.card?.role_title || actor?.custom_name || 'Unknown'}) is missing card reference`
          );
        }

        if (!actor.cards_by_game || !actor.cards_by_game[gameId]) {
          throw new Error(
            `Actor ${actor?.card?.role_title || actor?.custom_name || actorId} is missing the required card reference for this game`
          );
        }

        console.log(`Actor ${actor.actor_id} has valid game card reference: ${actor.cards_by_game[gameId]}`);
      }

      // Ensure user is logged in
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('You must be logged in to create an agreement. Please log in first.');
      }

      // Filter out invalid actors
      const validParties = selectedParties.filter((actorId) => {
        const actor = actorsList.find((a: ActorWithCard) => a.actor_id === actorId);
        return actor && actor.card?.card_id && actor.cards_by_game && actor.cards_by_game[gameId];
      });

      if (validParties.length === 0) {
        throw new Error('No valid actors selected. All actors must have a valid card reference for this game.');
      }

      if (validParties.length !== selectedParties.length) {
        console.warn(`Filtered out ${selectedParties.length - validParties.length} invalid actors`);
        const removedActors = selectedParties.filter((actorId) => !validParties.includes(actorId));
        console.warn('Removed actor IDs:', removedActors);

        selectedParties = validParties;
        const newTerms: AgreementTerms = {};
        for (const actorId of validParties) {
          if (terms[actorId]) {
            newTerms[actorId] = terms[actorId];
          }
        }
        terms = newTerms;
      }

      // Validate terms format
      for (const actorId of selectedParties) {
        if (!terms[actorId] || !Array.isArray(terms[actorId].obligations) || !Array.isArray(terms[actorId].benefits)) {
          throw new Error(`Terms for actor ${actorId} are invalid. Each actor must have obligations and benefits arrays.`);
        }

        const actor = actorsList.find((a: ActorWithCard) => a.actor_id === actorId);
        console.log('Actor structure:', {
          actorId,
          actorName: actor?.card?.role_title || actor?.custom_name || actorId,
          cardId: actor?.card?.card_id,
          gameCardRef: actor?.cards_by_game?.[gameId],
        });
      }

      // Create agreement
      const result = await createAgreement(gameId, title, description, selectedParties, terms);

      if (result) {
        toaster.success({
          title: 'Success',
          description: 'Agreement created successfully',
        } as ToasterOptions);
        resetForm();
        modalOpen = false;
      } else {
        throw new Error('Failed to create agreement - returned null');
      }
    } catch (error: unknown) {
      console.error('Error creating agreement:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('must be logged in')) {
        toaster.error({
          title: 'Authentication Required',
          description: errorMessage,
        } as ToasterOptions);
      } else {
        toaster.error({
          title: 'Error',
          description: `Failed to create agreement: ${errorMessage}`,
        } as ToasterOptions);
      }
    } finally {
      isSubmitting = false;
    }
  }

  // Close the modal
  function closeModal() {
    resetForm();
    modalOpen = false;
  }

  // Open the modal
  export function openModal() {
    resetForm();
    modalOpen = true;
  }

  // Get actor name or title
  function getActorName(actorId: string) {
    const actor = actorsList.find((a: ActorWithCard) => a.actor_id === actorId);
    return actor?.card?.role_title || actor?.custom_name || 'Unknown Actor';
  }
</script>

<Modal
  open={modalOpen}
  onOpenChange={(e) => (modalOpen = e.open)}
  backdropClasses="backdrop-blur-lg bg-surface-100-900/50"
>
  {#snippet trigger()}{/snippet}

  {#snippet content()}
    <div
      class="card bg-surface-50-950 p-4 space-y-4 shadow-xl backdrop-blur-sm border border-surface-200-700/30 max-w-screen-lg w-full max-h-[90vh] overflow-y-auto rounded-lg"
    >
      <header class="flex justify-between items-center">
        <h2 class="h2 text-primary-700-300">Create New Agreement</h2>
        <button class="btn-icon tonal" onclick={closeModal}>
          <icons.X />
        </button>
      </header>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Agreement Details -->
        <div class="space-y-4">
          <label class="label">
            <span>Agreement Title</span>
            <input type="text" class="input" placeholder="Enter a memorable title..." bind:value={title} />
          </label>

          <label class="label">
            <span>Agreement Description</span>
            <textarea
              class="textarea"
              placeholder="Briefly describe this agreement..."
              rows="3"
              bind:value={description}
            ></textarea>
          </label>

          <div class="card bg-surface-100-800 p-4 space-y-2 border border-surface-200-700/30">
            <h3 class="h3 text-primary-700-300">Agreement Type</h3>
            <div class="flex flex-col gap-2">
              <label class="flex items-center space-x-2">
                <input
                  type="radio"
                  name="agreement-type"
                  value="asymmetric"
                  checked={agreementType === 'asymmetric'}
                  onchange={() => (agreementType = 'asymmetric')}
                />
                <span>Asymmetric (Different obligations and benefits)</span>
              </label>
              <label class="flex items-center space-x-2">
                <input
                  type="radio"
                  name="agreement-type"
                  value="symmetric"
                  checked={agreementType === 'symmetric'}
                  onchange={() => (agreementType = 'symmetric')}
                />
                <span>Symmetric (Shared obligations and benefits)</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Party Selection -->
        <div class="card bg-surface-100-800 p-4 space-y-4 border border-surface-200-700/30">
          <h3 class="h3 text-primary-700-300">Select Parties</h3>
          <div class="max-h-40 overflow-y-auto space-y-2">
            {#each actorsList as actor (actor.actor_id)}
              <!-- Compute hasValidCardRef directly in the #each block -->
              <div class="flex items-center space-x-2">
                {#if actor.card?.card_id && actor.cards_by_game && actor.cards_by_game[gameId]}
                  <button
                    class="btn filled bg-primary-500 text-white btn-sm {actor.actor_id === currentActorId ? 'cursor-default' : ''}"
                    onclick={() => toggleParty(actor.actor_id)}
                    title={actor.actor_id === currentActorId ? 'This is your actor (always included)' : ''}
                  >
                    {selectedParties.includes(actor.actor_id) ? '✓' : '+'}
                    {actor.actor_id === currentActorId ? ' (You)' : ''}
                  </button>
                {:else}
                  <button
                    class="btn tonal btn-sm opacity-50 cursor-not-allowed"
                    title="This actor cannot be added (invalid or missing card reference for this game)"
                    disabled
                  >
                    {selectedParties.includes(actor.actor_id) ? '✓' : '+'}
                    {actor.actor_id === currentActorId ? ' (You)' : ''}
                  </button>
                {/if}
                <span
                  class="{!(actor.card?.card_id && actor.cards_by_game && actor.cards_by_game[gameId]) ? 'opacity-50' : ''} {actor.actor_id === currentActorId ? 'font-semibold' : ''}"
                >
                  {actor.card?.role_title || actor.custom_name || 'Unnamed Actor'}
                </span>
                {#if actor.card?.card_category}
                  <span class="badge tonal">{actor.card.card_category}</span>
                {/if}
                {#if !actor.card?.card_id}
                  <span class="badge tonal text-error-500 text-xs">Invalid card reference</span>
                {:else if !actor.cards_by_game || !actor.cards_by_game[gameId]}
                  <span class="badge tonal text-warning-500 text-xs">Missing game reference</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Terms Section -->
      {#if selectedParties.length > 0}
        <div class="card bg-surface-100-800 p-4 space-y-4 border border-surface-200-700/30">
          <h3 class="h3 text-primary-700-300">Agreement Terms</h3>
          <div class="space-y-6">
            {#each selectedParties as actorId (actorId)}
              <div class="card bg-surface-200-700 p-4 border border-surface-300-600/30 shadow-sm">
                <h4 class="h4 mb-2 text-secondary-700-300">{getActorName(actorId)}</h4>

                <!-- Obligations -->
                <div class="mb-4">
                  <h5 class="h5 text-primary-600-400">Obligations</h5>
                  <div class="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      class="input"
                      placeholder="What must this actor provide or do?"
                      bind:value={newObligations[actorId]}
                      onblur={() => newObligations[actorId]?.trim() && addObligation(actorId)}
                      onkeydown={(e) => e.key === 'Enter' && addObligation(actorId)}
                    />
                    <button class="btn-icon filled bg-primary-500 text-white" onclick={() => addObligation(actorId)}>
                      <icons.Plus />
                    </button>
                  </div>

                  <ul class="list-disc list-inside space-y-1">
                    {#each terms[actorId]?.obligations || [] as obligation, i}
                      <li class="flex items-center justify-between">
                        <span>{obligation}</span>
                        <button
                          class="btn-icon tonal text-error-500 btn-sm"
                          onclick={() => removeObligation(actorId, i)}
                        >
                          <icons.Trash2 class="w-4 h-4" />
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>

                <!-- Benefits -->
                <div>
                  <h5 class="h5 text-secondary-600-400">Benefits</h5>
                  <div class="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      class="input"
                      placeholder="What does this actor receive?"
                      bind:value={newBenefits[actorId]}
                      onblur={() => newBenefits[actorId]?.trim() && addBenefit(actorId)}
                      onkeydown={(e) => e.key === 'Enter' && addBenefit(actorId)}
                    />
                    <button class="btn-icon filled bg-secondary-500 text-white" onclick={() => addBenefit(actorId)}>
                      <icons.Plus />
                    </button>
                  </div>

                  <ul class="list-disc list-inside space-y-1">
                    {#each terms[actorId]?.benefits || [] as benefit, i}
                      <li class="flex items-center justify-between">
                        <span>{benefit}</span>
                        <button
                          class="btn-icon tonal text-error-500 btn-sm"
                          onclick={() => removeBenefit(actorId, i)}
                        >
                          <icons.Trash2 class="w-4 h-4" />
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <footer class="flex justify-end gap-4">
        <button type="button" class="btn tonal" onclick={closeModal}>Cancel</button>
        <button
          type="button"
          class="btn filled bg-primary-500 text-white"
          onclick={handleSubmit}
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <icons.Loader class="animate-spin mr-2" />
            Creating...
          {:else}
            Create Agreement
          {/if}
        </button>
      </footer>
    </div>
  {/snippet}
</Modal>