<script lang="ts">
  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import * as icons from '@lucide/svelte';
  import { createAgreement } from '$lib/services/gameService';
  import { getCurrentUser } from '$lib/services/authService';
  import type { Actor, ActorWithCard } from '$lib/types';
  import { toaster } from '$lib/utils/toaster-svelte';

  // Props
  const { gameId, actorsList, currentActorId } = $props<{
    gameId: string;
    actorsList: ActorWithCard[];
    currentActorId: string;
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
    if (selectedParties.includes(actorId)) {
      // Remove actor and its terms
      selectedParties = selectedParties.filter(id => id !== actorId);
      
      // Create a new terms object without the removed actor
      const newTerms = {};
      for (const id in terms) {
        if (id !== actorId) {
          newTerms[id] = terms[id];
        }
      }
      terms = newTerms;
      
      // Create new input objects without the removed actor
      const newObligationsObj = {};
      for (const id in newObligations) {
        if (id !== actorId) {
          newObligationsObj[id] = newObligations[id];
        }
      }
      newObligations = newObligationsObj;
      
      const newBenefitsObj = {};
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
        [actorId]: { obligations: [], benefits: [] }
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
        [actorId]: { obligations: [], benefits: [] }
      };
    }
    
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
    
    // Initialize terms[actorId] if it doesn't exist
    if (!terms[actorId]) {
      terms = {
        ...terms,
        [actorId]: { obligations: [], benefits: [] }
      };
    }
    
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
    if (!terms[actorId]) {
      console.error(`Cannot remove obligation - terms[${actorId}] does not exist`);
      return;
    }
    
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
    if (!terms[actorId]) {
      console.error(`Cannot remove benefit - terms[${actorId}] does not exist`);
      return;
    }
    
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
      console.log('Validation error: Missing title');
      toaster.error({
        title: 'Validation Error',
        description: 'Please enter a title for the agreement',
        classes: 'bg-white dark:bg-gray-800 rounded border border-red-500 dark:border-red-700 shadow-lg'
      });
      return;
    }

    if (!description.trim()) {
      toaster.error({
        title: 'Validation Error',
        description: 'Please enter a description for the agreement',
        classes: 'bg-white dark:bg-gray-800 rounded border border-red-500 dark:border-red-700 shadow-lg'
      });
      return;
    }

    if (selectedParties.length < 1) {
      toaster.error({
        title: 'Validation Error',
        description: 'Please select at least one party for the agreement',
        classes: 'bg-white dark:bg-gray-800 rounded border border-red-500 dark:border-red-700 shadow-lg'
      });
      return;
    }

    // Validate that each party has at least one obligation or benefit
    for (const actorId of selectedParties) {
      // Ensure terms[actorId] exists
      if (!terms[actorId]) {
        terms = {
          ...terms,
          [actorId]: { obligations: [], benefits: [] }
        };
      }
      
      if (terms[actorId].obligations.length === 0 && terms[actorId].benefits.length === 0) {
        const actor = actorsList.find(a => a.actor_id === actorId);
        toaster.error({
          title: 'Validation Error',
          description: `${actor?.custom_name || actor?.card?.role_title || 'Actor'} needs at least one obligation or benefit`,
          classes: 'bg-white dark:bg-gray-800 rounded border border-red-500 dark:border-red-700 shadow-lg'
        });
        return;
      }
    }

    isSubmitting = true;
    try {
      // Prepare data for submission
      const payload = {
        gameId,
        title,
        description,
        selectedParties,
        terms
      };
      
      console.log('Creating agreement with:', payload);
      
      // Ensure we have a valid gameId
      if (!gameId) {
        throw new Error('Missing gameId');
      }
      
      // Ensure each actor in selectedParties actually exists in the system
      for (const actorId of selectedParties) {
        if (!actorsList.find(a => a.actor_id === actorId)) {
          throw new Error(`Actor ${actorId} not found in actorsList`);
        }
      }
      
      // Check if any actors are missing card references or have invalid game-specific card references
      for (const actorId of selectedParties) {
        const actor = actorsList.find(a => a.actor_id === actorId);
        
        // Basic card association check
        if (!actor?.card) {
          throw new Error(`Actor ${actorId} (${actor?.custom_name || 'Unknown'}) is missing card reference`);
        }
        
        // Game-specific card reference check (critical for saving in database)
        if (!actor.cards_by_game || !actor.cards_by_game[gameId]) {
          throw new Error(`Actor ${actor?.custom_name || actor?.card?.role_title || actorId} is missing the required card reference for this game. This is needed for database storage.`);
        }
        
        // Log the found card reference for debugging
        console.log(`Actor ${actor.actor_id} has valid game card reference: ${actor.cards_by_game[gameId]}`);
      }
      
      // First, ensure the user is logged in by checking if getCurrentUser() returns something
      const user = await getCurrentUser();
      console.log('Current user for createAgreement:', user);
      
      // Throw a user-friendly error if not logged in
      if (!user) {
        throw new Error('You must be logged in to create an agreement. Please log in first.');
      }
      
      // Filter out any actors that don't have valid card references before submitting
      const validParties = selectedParties.filter(actorId => {
        const actor = actorsList.find(a => a.actor_id === actorId);
        return actor && actor.card?.card_id && actor.cards_by_game && actor.cards_by_game[gameId];
      });
      
      // If no valid parties remain, show an error
      if (validParties.length === 0) {
        throw new Error('No valid actors selected. All selected actors must have a valid card reference for this game.');
      }
      
      // If some parties were filtered out, update the selectedParties list and terms
      if (validParties.length !== selectedParties.length) {
        console.warn(`Filtered out ${selectedParties.length - validParties.length} invalid actors from selected parties.`);
        const removedActors = selectedParties.filter(actorId => !validParties.includes(actorId));
        console.warn('Removed actor IDs:', removedActors);
        
        // Update the selected parties list
        selectedParties = validParties;
        
        // Remove terms for invalid actors
        const newTerms = {};
        for (const actorId of validParties) {
          if (terms[actorId]) {
            newTerms[actorId] = terms[actorId];
          }
        }
        terms = newTerms;
      }
      
      // Check if we have the correct terms structure before calling the API
      console.log('About to call createAgreement with exact params:');
      console.log('- gameId:', gameId);
      console.log('- title:', title);
      console.log('- description:', description);
      console.log('- parties (selectedParties):', selectedParties);
      console.log('- terms (stringified):', JSON.stringify(terms));
      
      // Validate the terms format - ensuring each party has obligations and benefits arrays
      for (const actorId of selectedParties) {
        if (!terms[actorId] || !Array.isArray(terms[actorId].obligations) || !Array.isArray(terms[actorId].benefits)) {
          throw new Error(`Terms for actor ${actorId} are invalid. Each actor must have obligations and benefits arrays.`);
        }
        
        // Get basic actor info for better error messages
        const actor = actorsList.find(a => a.actor_id === actorId);
        const actorName = actor?.custom_name || actor?.card?.role_title || actorId;
        
        // Add a more helpful error to log internal actor structure for debugging
        console.log('Actor structure for debugging:', {
          actorId,
          actorName,
          cardId: actor?.card?.card_id,
          gameCardRef: actor?.cards_by_game?.[gameId]
        });
      }
      
      // Create agreement using gameService - matching the exact parameter order and types
      // Note: gameService expects the correct terms format, the conversion to strings happens in the service
      const result = await createAgreement(
        gameId,
        title,
        description,
        selectedParties,
        terms
      );
      
      console.log('Agreement creation result:', result);

      if (result) {
        toaster.success({
          title: 'Success',
          description: 'Agreement created successfully',
          classes: 'bg-white dark:bg-gray-800 rounded border border-green-500 dark:border-green-700 shadow-lg'
        });
        resetForm();
        modalOpen = false;
      } else {
        console.error('Failed to create agreement - returned null');
        toaster.error({
          title: 'Error',
          description: 'Failed to create agreement',
          classes: 'bg-white dark:bg-gray-800 rounded border border-red-500 dark:border-red-700 shadow-lg'
        });
      }
    } catch (error) {
      console.error('Error creating agreement:', error);
      
      // Special case for authentication errors
      if (error?.message?.includes('must be logged in')) {
        toaster.error({
          title: 'Authentication Required',
          description: error.message,
          classes: 'bg-white dark:bg-gray-800 rounded border border-yellow-500 dark:border-yellow-700 shadow-lg'
        });
      } else {
        toaster.error({
          title: 'Error',
          description: `Failed to create agreement: ${error?.message || 'Unknown error'}`,
          classes: 'bg-white dark:bg-gray-800 rounded border border-red-500 dark:border-red-700 shadow-lg'
        });
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
    const actor = actorsList.find(a => a.actor_id === actorId);
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
    <div class="card bg-surface-50-950 p-4 space-y-4 shadow-xl backdrop-blur-sm border border-surface-200-700/30 max-w-screen-lg w-full max-h-[90vh] overflow-y-auto rounded-lg">
      <header class="flex justify-between items-center">
        <h2 class="h2 text-primary-700-300">Create New Agreement</h2>
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
          
          <div class="card bg-surface-100-800 p-4 space-y-2 border border-surface-200-700/30">
            <h3 class="h3 text-primary-700-300">Agreement Type</h3>
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
        <div class="card bg-surface-100-800 p-4 space-y-4 border border-surface-200-700/30">
          <h3 class="h3 text-primary-700-300">Select Parties</h3>
          <div class="max-h-40 overflow-y-auto space-y-2">
            {#each actorsList as actor}
              {#each [actor] as a}
                {#if true}
                  {@const hasValidCardRef = a.card?.card_id && a.cards_by_game && a.cards_by_game[gameId]}
                  <div class="flex items-center space-x-2">
                    <!-- 
                      Disable party selection if actor:
                      1. Doesn't have a valid card reference, or
                      2. Doesn't have cards_by_game data structure with an entry for this game
                    -->
                    <button 
                      class="btn {selectedParties.includes(a.actor_id) ? 'variant-filled-primary' : 'variant-soft'} btn-sm {!hasValidCardRef ? 'opacity-50 cursor-not-allowed' : ''}"
                      onclick={() => hasValidCardRef ? toggleParty(a.actor_id) : null}
                      title={!hasValidCardRef ? 'This actor cannot be added (invalid or missing card reference for this game)' : ''}
                    >
                      {selectedParties.includes(a.actor_id) ? '✓' : '+'}
                    </button>
                    <span class="{!hasValidCardRef ? 'opacity-50' : ''}">{a.card?.role_title || a.custom_name || 'Unnamed Actor'}</span>
                    {#if a.card?.card_category}
                      <span class="badge variant-soft">{a.card.card_category}</span>
                    {/if}
                    {#if !a.card?.card_id}
                      <span class="badge variant-soft-error text-xs">Invalid card reference</span>
                    {:else if !a.cards_by_game || !a.cards_by_game[gameId]}
                      <span class="badge variant-soft-warning text-xs">Missing game reference</span>
                    {/if}
                  </div>
                {/if}
              {/each}
            {/each}
          </div>
        </div>
      </div>
      
      <!-- Terms Section - Only show if parties are selected -->
      {#if selectedParties.length > 0}
        <div class="card bg-surface-100-800 p-4 space-y-4 border border-surface-200-700/30">
          <h3 class="h3 text-primary-700-300">Agreement Terms</h3>
          <div class="space-y-6">
            {#each selectedParties as actorId}
              <div class="card bg-surface-200-700 p-4 border border-surface-300-600/30 shadow-sm">
                <h4 class="h4 mb-2 text-secondary-700-300">{getActorName(actorId)}</h4>
                
                <!-- Obligations -->
                <div class="mb-4">
                  <h5 class="h5 text-primary-600-400">Obligations</h5>
                  <!-- Add new obligation -->
                  <div class="flex items-center space-x-2 mb-2">
                    <input 
                      type="text" 
                      class="input" 
                      placeholder="What must this actor provide or do?"
                      bind:value={newObligations[actorId]}
                      onblur={() => newObligations[actorId]?.trim() && addObligation(actorId)}
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
                  <h5 class="h5 text-secondary-600-400">Benefits</h5>
                  <!-- Add new benefit -->
                  <div class="flex items-center space-x-2 mb-2">
                    <input 
                      type="text" 
                      class="input" 
                      placeholder="What does this actor receive?"
                      bind:value={newBenefits[actorId]}
                      onblur={() => newBenefits[actorId]?.trim() && addBenefit(actorId)}
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