<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import gameStore from '$lib/stores/enhancedGameStore';
  import type { ActorWithPosition, AgreementWithPosition } from '$lib/stores/enhancedGameStore';
  import * as icons from 'lucide-svelte';
  
  // Props
  export let editMode = false;
  export let agreement: AgreementWithPosition | null = null;
  
  // Create event dispatcher
  const dispatch = createEventDispatcher();
  
  // State
  let title = '';
  let description = '';
  let terms: string[] = [''];
  let selectedParties: Record<string, boolean> = {};
  let obligations: { fromActorId: string, description: string }[] = [];
  let benefits: { toActorId: string, description: string }[] = [];
  
  // New obligation/benefit input fields
  let newObligations: Record<string, string> = {};
  let newBenefits: Record<string, string> = {};
  
  // Subscribe to actor store
  let actors: ActorWithPosition[] = [];
  const unsubscribeActors = gameStore.actors.subscribe(value => {
    actors = value;
    
    // Initialize selectedParties record if not in edit mode
    if (!editMode) {
      selectedParties = actors.reduce((acc, actor) => {
        acc[actor.actor_id] = false;
        return acc;
      }, {} as Record<string, boolean>);
    }
  });
  
  // Initialize form when in edit mode
  $: if (editMode && agreement) {
    title = agreement.title;
    description = agreement.description;
    terms = [...agreement.terms];
    
    // Set selected parties
    selectedParties = actors.reduce((acc, actor) => {
      acc[actor.actor_id] = agreement?.parties.includes(actor.actor_id) || false;
      return acc;
    }, {} as Record<string, boolean>);
    
    // Initialize obligations and benefits
    obligations = [...agreement.obligations];
    benefits = [...agreement.benefits];
  }
  
  // Close the modal
  function closeModal() {
    dispatch('close');
  }
  
  // Add a new term
  function addTerm() {
    terms = [...terms, ''];
  }
  
  // Remove a term
  function removeTerm(index: number) {
    terms = terms.filter((_, i) => i !== index);
  }
  
  // Handle term input changes
  function updateTerm(index: number, value: string) {
    terms[index] = value;
    terms = [...terms]; // Trigger reactivity
  }
  
  // Add an obligation
  function addObligation(actorId: string) {
    if (newObligations[actorId] && newObligations[actorId].trim()) {
      obligations = [...obligations, {
        fromActorId: actorId,
        description: newObligations[actorId]
      }];
      newObligations[actorId] = '';
    }
  }
  
  // Remove an obligation
  function removeObligation(index: number) {
    obligations = obligations.filter((_, i) => i !== index);
  }
  
  // Add a benefit
  function addBenefit(actorId: string) {
    if (newBenefits[actorId] && newBenefits[actorId].trim()) {
      benefits = [...benefits, {
        toActorId: actorId,
        description: newBenefits[actorId]
      }];
      newBenefits[actorId] = '';
    }
  }
  
  // Remove a benefit
  function removeBenefit(index: number) {
    benefits = benefits.filter((_, i) => i !== index);
  }
  
  // Save the agreement
  async function saveAgreement() {
    // Get selected parties
    const parties = Object.entries(selectedParties)
      .filter(([_, selected]) => selected)
      .map(([actorId]) => actorId);
    
    if (parties.length < 2) {
      alert('An agreement needs at least 2 parties');
      return;
    }
    
    if (title.trim() === '') {
      alert('Title is required');
      return;
    }
    
    // Filter out empty terms
    const filteredTerms = terms.filter(term => term.trim() !== '');
    
    if (filteredTerms.length === 0) {
      alert('At least one term is required');
      return;
    }
    
    // Prepare agreement data
    const agreementData = {
      title,
      description,
      parties,
      terms: filteredTerms,
      status: 'proposed' as const,
      obligations,
      benefits
    };
    
    if (editMode && agreement) {
      // Update existing agreement
      await gameStore.updateAgreement(agreement.id, agreementData);
    } else {
      // Create new agreement
      await gameStore.createAgreement(agreementData);
    }
    
    // Close modal
    closeModal();
  }
  
  // Get actor name
  function getActorName(actorId: string): string {
    const actor = actors.find(a => a.actor_id === actorId);
    return actor ? actor.role_title : 'Unknown Actor';
  }
  
  // Clean up on destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    unsubscribeActors();
  });
</script>

<div class="modal-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div class="modal-container w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-800 rounded-lg shadow-xl">
    <div class="p-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
      <h2 class="text-xl font-semibold">{editMode ? 'Edit' : 'Create'} Agreement</h2>
      <button class="btn btn-sm btn-icon variant-ghost-surface" on:click={closeModal}>
        <svelte:component this={icons.X} class="w-4 h-4" />
      </button>
    </div>
    
    <div class="p-4">
      <form on:submit|preventDefault={saveAgreement} class="space-y-4">
        <!-- Title and Description -->
        <div class="form-group">
          <label for="title" class="form-label">Title</label>
          <input
            type="text"
            id="title"
            bind:value={title}
            class="input w-full"
            placeholder="Agreement Title"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="description" class="form-label">Description</label>
          <textarea
            id="description"
            bind:value={description}
            class="textarea w-full"
            placeholder="Describe the purpose of this agreement"
            rows="3"
          ></textarea>
        </div>
        
        <!-- Parties Selection -->
        <div class="form-group">
          <label class="form-label">Parties</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            {#each actors as actor}
              <label class="flex items-center space-x-2 p-2 border rounded hover:bg-surface-100 dark:hover:bg-surface-700">
                <input
                  type="checkbox"
                  bind:checked={selectedParties[actor.actor_id]}
                  class="checkbox"
                />
                <span>{actor.role_title}</span>
              </label>
            {/each}
          </div>
        </div>
        
        <!-- Terms -->
        <div class="form-group">
          <label class="form-label">Terms</label>
          <div class="space-y-2">
            {#each terms as term, index}
              <div class="flex space-x-2">
                <input
                  type="text"
                  value={term}
                  on:input={(e) => updateTerm(index, e.currentTarget.value)}
                  placeholder="Enter a term of the agreement"
                  class="input flex-grow"
                />
                <button
                  type="button"
                  class="btn btn-sm btn-icon variant-ghost-error"
                  on:click={() => removeTerm(index)}
                  disabled={terms.length === 1}
                >
                  <svelte:component this={icons.X} class="w-4 h-4" />
                </button>
              </div>
            {/each}
            
            <button
              type="button"
              class="btn btn-sm variant-ghost-primary"
              on:click={addTerm}
            >
              Add Term
            </button>
          </div>
        </div>
        
        <!-- Obligations -->
        <div class="form-group">
          <label class="form-label">Obligations</label>
          
          <div class="space-y-4">
            {#each Object.entries(selectedParties).filter(([_, selected]) => selected) as [actorId, _]}
              <div class="p-3 border rounded">
                <h4 class="font-semibold mb-2">{getActorName(actorId)}'s Obligations</h4>
                
                <!-- Input for new obligation -->
                <div class="flex space-x-2 mb-2">
                  <input
                    type="text"
                    bind:value={newObligations[actorId]}
                    placeholder="Add an obligation..."
                    class="input flex-grow"
                  />
                  <button
                    type="button"
                    class="btn btn-sm variant-filled-primary"
                    on:click={() => addObligation(actorId)}
                  >
                    Add
                  </button>
                </div>
                
                <!-- List of existing obligations -->
                <ul class="space-y-1">
                  {#each obligations.filter(o => o.fromActorId === actorId) as obligation, index}
                    <li class="flex justify-between items-center p-2 bg-surface-100 dark:bg-surface-700 rounded">
                      <span>{obligation.description}</span>
                      <button
                        type="button"
                        class="btn btn-sm btn-icon variant-ghost-error"
                        on:click={() => removeObligation(index)}
                      >
                        <svelte:component this={icons.X} class="w-3 h-3" />
                      </button>
                    </li>
                  {/each}
                </ul>
              </div>
            {/each}
          </div>
        </div>
        
        <!-- Benefits -->
        <div class="form-group">
          <label class="form-label">Benefits</label>
          
          <div class="space-y-4">
            {#each Object.entries(selectedParties).filter(([_, selected]) => selected) as [actorId, _]}
              <div class="p-3 border rounded">
                <h4 class="font-semibold mb-2">{getActorName(actorId)}'s Benefits</h4>
                
                <!-- Input for new benefit -->
                <div class="flex space-x-2 mb-2">
                  <input
                    type="text"
                    bind:value={newBenefits[actorId]}
                    placeholder="Add a benefit..."
                    class="input flex-grow"
                  />
                  <button
                    type="button"
                    class="btn btn-sm variant-filled-primary"
                    on:click={() => addBenefit(actorId)}
                  >
                    Add
                  </button>
                </div>
                
                <!-- List of existing benefits -->
                <ul class="space-y-1">
                  {#each benefits.filter(b => b.toActorId === actorId) as benefit, index}
                    <li class="flex justify-between items-center p-2 bg-surface-100 dark:bg-surface-700 rounded">
                      <span>{benefit.description}</span>
                      <button
                        type="button"
                        class="btn btn-sm btn-icon variant-ghost-error"
                        on:click={() => removeBenefit(index)}
                      >
                        <svelte:component this={icons.X} class="w-3 h-3" />
                      </button>
                    </li>
                  {/each}
                </ul>
              </div>
            {/each}
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex justify-end space-x-2 pt-4 border-t border-surface-200 dark:border-surface-700">
          <button
            type="button"
            class="btn variant-ghost-surface"
            on:click={closeModal}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn variant-filled-primary"
          >
            {editMode ? 'Update' : 'Create'} Agreement
          </button>
        </div>
      </form>
    </div>
  </div>
</div>