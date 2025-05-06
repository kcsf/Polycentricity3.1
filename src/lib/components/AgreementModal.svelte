<script lang="ts">
  import { Modal, getToastStore } from '@skeletonlabs/skeleton-svelte';
  import * as icons from '@lucide/svelte';
  import { createAgreement } from '$lib/services/gameService';
  import type { Actor, ActorWithCard } from '$lib/types';
  
  // Get toast store for notifications
  const toastStore = getToastStore();

  // Props
  const { gameId, actorsList } = $props<{
    gameId: string;
    actorsList: ActorWithCard[];
  }>();

  // State
  let modalOpen = $state(false);
  let selectedParties = $state<string[]>([]);
  let terms = $state<Record<string, { obligations: string[]; benefits: string[] }>>({});
  let newObligations = $state<Record<string, string>>({});
  let newBenefits = $state<Record<string, string>>({});
  let title = $state('');
  let description = $state('');
  let agreementType = $state<'symmetric' | 'asymmetric'>('asymmetric');
  let isSubmitting = $state(false);

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
  }

  // Toggle party selection
  function toggleParty(actorId: string) {
    if (selectedParties.includes(actorId)) {
      // Remove actor and its terms
      selectedParties = selectedParties.filter(id => id !== actorId);
      const { [actorId]: _, ...restTerms } = terms;
      terms = restTerms;
      const { [actorId]: __, ...restObligations } = newObligations;
      newObligations = restObligations;
      const { [actorId]: ___, ...restBenefits } = newBenefits;
      newBenefits = restBenefits;
    } else {
      // Add actor with empty terms
      selectedParties = [...selectedParties, actorId];
      terms = {
        ...terms,
        [actorId]: { obligations: [], benefits: [] }
      };
      newObligations = { ...newObligations, [actorId]: '' };
      newBenefits = { ...newBenefits, [actorId]: '' };
    }
  }

  // Add a new obligation
  function addObligation(actorId: string) {
    if (!newObligations[actorId]?.trim()) return;
    
    terms = {
      ...terms,
      [actorId]: {
        ...terms[actorId],
        obligations: [...terms[actorId].obligations, newObligations[actorId]]
      }
    };
    newObligations = { ...newObligations, [actorId]: '' };
  }

  // Add a new benefit
  function addBenefit(actorId: string) {
    if (!newBenefits[actorId]?.trim()) return;
    
    terms = {
      ...terms,
      [actorId]: {
        ...terms[actorId],
        benefits: [...terms[actorId].benefits, newBenefits[actorId]]
      }
    };
    newBenefits = { ...newBenefits, [actorId]: '' };
  }

  // Remove an obligation
  function removeObligation(actorId: string, index: number) {
    terms = {
      ...terms,
      [actorId]: {
        ...terms[actorId],
        obligations: terms[actorId].obligations.filter((_, i) => i !== index)
      }
    };
  }

  // Remove a benefit
  function removeBenefit(actorId: string, index: number) {
    terms = {
      ...terms,
      [actorId]: {
        ...terms[actorId],
        benefits: terms[actorId].benefits.filter((_, i) => i !== index)
      }
    };
  }

  // Handle form submission
  async function handleSubmit() {
    // Form validation
    if (!title.trim()) {
      toastStore.trigger({ message: 'Please enter a title for the agreement', background: 'variant-filled-error' });
      return;
    }

    if (!description.trim()) {
      toastStore.trigger({ message: 'Please enter a description for the agreement', background: 'variant-filled-error' });
      return;
    }

    if (selectedParties.length < 1) {
      toastStore.trigger({ message: 'Please select at least one party for the agreement', background: 'variant-filled-error' });
      return;
    }

    // Validate that each party has at least one obligation or benefit
    for (const actorId of selectedParties) {
      if (terms[actorId].obligations.length === 0 && terms[actorId].benefits.length === 0) {
        const actor = actorsList.find(a => a.actor_id === actorId);
        toastStore.trigger({ 
          message: `${actor?.custom_name || actor?.card?.role_title || 'Actor'} needs at least one obligation or benefit`,
          background: 'variant-filled-error'
        });
        return;
      }
    }

    isSubmitting = true;
    try {
      // Create agreement using gameService
      const result = await createAgreement(
        gameId,
        title,
        description,
        selectedParties,
        terms
      );

      if (result) {
        toastStore.trigger({ message: 'Agreement created successfully', background: 'variant-filled-success' });
        resetForm();
        modalOpen = false;
      } else {
        toastStore.trigger({ message: 'Failed to create agreement', background: 'variant-filled-error' });
      }
    } catch (error) {
      console.error('Error creating agreement:', error);
      toastStore.trigger({ message: 'An error occurred while creating the agreement', background: 'variant-filled-error' });
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
    const actor = actorsList.find(a => a.actor_id === actorId);
    return actor?.custom_name || actor?.card?.role_title || 'Unknown Actor';
  }
</script>

<Modal
  open={modalOpen}
  onOpenChange={(e) => (modalOpen = e.open)}
  backdropClasses="backdrop-blur-sm"
>
  {#snippet trigger()}{/snippet}
  
  {#snippet content()}
    <div class="card bg-surface-100-800-token p-4 space-y-4 shadow-xl max-w-screen-lg w-full max-h-[90vh] overflow-y-auto">
      <header class="flex justify-between items-center">
        <h2 class="h2">Create New Agreement</h2>
        <button class="btn-icon variant-soft" onclick={closeModal}>
          <icons.X />
        </button>
      </header>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Agreement Details -->
        <div class="space-y-4">
          <label class="label">
            <span>Agreement Title</span>
            <input 
              type="text" 
              class="input" 
              placeholder="Enter a memorable title..."
              bind:value={title}
            />
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
          
          <div class="card p-4 space-y-2">
            <h3 class="h3">Agreement Type</h3>
            <div class="flex flex-col gap-2">
              <label class="flex items-center space-x-2">
                <input 
                  type="radio" 
                  name="agreement-type" 
                  value="asymmetric" 
                  checked={agreementType === 'asymmetric'}
                  onchange={() => agreementType = 'asymmetric'} 
                />
                <span>Asymmetric (Different obligations and benefits)</span>
              </label>
              <label class="flex items-center space-x-2">
                <input 
                  type="radio" 
                  name="agreement-type" 
                  value="symmetric" 
                  checked={agreementType === 'symmetric'}
                  onchange={() => agreementType = 'symmetric'} 
                />
                <span>Symmetric (Shared obligations and benefits)</span>
              </label>
            </div>
          </div>
        </div>
        
        <!-- Party Selection -->
        <div class="card p-4 space-y-4">
          <h3 class="h3">Select Parties</h3>
          <div class="max-h-40 overflow-y-auto space-y-2">
            {#each actorsList as actor}
              <div class="flex items-center space-x-2">
                <button 
                  class="btn {selectedParties.includes(actor.actor_id) ? 'variant-filled-primary' : 'variant-soft'} btn-sm"
                  onclick={() => toggleParty(actor.actor_id)}
                >
                  {selectedParties.includes(actor.actor_id) ? '✓' : '+'}
                </button>
                <span>{actor.custom_name || actor.card?.role_title || 'Unnamed Actor'}</span>
                {#if actor.card?.card_category}
                  <span class="badge variant-soft">{actor.card.card_category}</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
      
      <!-- Terms Section - Only show if parties are selected -->
      {#if selectedParties.length > 0}
        <div class="card p-4 space-y-4">
          <h3 class="h3">Agreement Terms</h3>
          <div class="space-y-6">
            {#each selectedParties as actorId}
              <div class="card p-4 variant-soft">
                <h4 class="h4 mb-2">{getActorName(actorId)}</h4>
                
                <!-- Obligations -->
                <div class="mb-4">
                  <h5 class="h5 text-primary-500">Obligations</h5>
                  <!-- Add new obligation -->
                  <div class="flex items-center space-x-2 mb-2">
                    <input 
                      type="text" 
                      class="input" 
                      placeholder="What must this actor provide or do?"
                      bind:value={newObligations[actorId]}
                      onkeydown={(e) => e.key === 'Enter' && addObligation(actorId)}
                    />
                    <button 
                      class="btn-icon variant-filled-primary"
                      onclick={() => addObligation(actorId)}
                    >
                      <icons.Plus />
                    </button>
                  </div>
                  
                  <!-- List of obligations -->
                  <ul class="list-disc list-inside space-y-1">
                    {#each terms[actorId]?.obligations || [] as obligation, i}
                      <li class="flex items-center justify-between">
                        <span>{obligation}</span>
                        <button 
                          class="btn-icon variant-soft-error btn-sm"
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
                  <h5 class="h5 text-secondary-500">Benefits</h5>
                  <!-- Add new benefit -->
                  <div class="flex items-center space-x-2 mb-2">
                    <input 
                      type="text" 
                      class="input" 
                      placeholder="What does this actor receive?"
                      bind:value={newBenefits[actorId]}
                      onkeydown={(e) => e.key === 'Enter' && addBenefit(actorId)}
                    />
                    <button 
                      class="btn-icon variant-filled-secondary"
                      onclick={() => addBenefit(actorId)}
                    >
                      <icons.Plus />
                    </button>
                  </div>
                  
                  <!-- List of benefits -->
                  <ul class="list-disc list-inside space-y-1">
                    {#each terms[actorId]?.benefits || [] as benefit, i}
                      <li class="flex items-center justify-between">
                        <span>{benefit}</span>
                        <button 
                          class="btn-icon variant-soft-error btn-sm"
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
        <button type="button" class="btn variant-soft" onclick={closeModal}>Cancel</button>
        <button 
          type="button" 
          class="btn variant-filled-primary" 
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