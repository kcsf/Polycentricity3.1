<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as icons from '@lucide/svelte';
  import { getActors, createAgreement, updateAgreement } from '$lib/services/gameService';
  import type { Actor, Agreement } from '$lib/types';
  
  // Define position type
  interface Position {
    x: number;
    y: number;
  }
  
  // Define types used in this component
  interface ActorWithPosition extends Actor {
    position?: Position;
  }
  
  interface AgreementWithPosition extends Agreement {
    position?: Position;
  }
  
  // Props using Svelte 5 Runes
  const { editMode = false, agreement = null } = $props<{
    editMode?: boolean;
    agreement?: AgreementWithPosition | null;
  }>();
  
  // Create event dispatcher
  const dispatch = createEventDispatcher();
  
  // State with Svelte 5 Runes
  let title = $state('');
  let description = $state('');
  let terms = $state<string[]>(['']);
  let selectedParties = $state<Record<string, boolean>>({});
  let obligations = $state<{ fromActorId: string, description: string, id?: string }[]>([]);
  let benefits = $state<{ toActorId: string, description: string, id?: string }[]>([]);
  
  // New obligation/benefit input fields
  let newObligations = $state<Record<string, string>>({});
  let newBenefits = $state<Record<string, string>>({});
  
  // State for actors
  let actors = $state<ActorWithPosition[]>([]);
  let gameId = $state<string | null>(null);
  let isLoading = $state(true);
  
  // Fetch actors when the component is mounted
  $effect(async () => {
    if (agreement) {
      // If we have an agreement, we can derive the gameId
      gameId = agreement.game_id;
    }
    
    if (gameId) {
      try {
        isLoading = true;
        const fetchedActors = await getActors(gameId);
        actors = fetchedActors.map(actor => ({
          ...actor,
          position: actor.position || undefined
        }));
        
        // Initialize selectedParties record if not in edit mode
        if (!editMode) {
          const initialSelectedParties: Record<string, boolean> = {};
          actors.forEach(actor => {
            initialSelectedParties[actor.actor_id] = false;
          });
          selectedParties = initialSelectedParties;
        }
        
        isLoading = false;
      } catch (error) {
        console.error('Failed to fetch actors:', error);
        isLoading = false;
      }
    }
  });
  
  // Initialize form when in edit mode
  $effect(() => {
    if (editMode && agreement && actors.length > 0) {
      title = agreement.title;
      description = agreement.description;
      terms = [...agreement.terms];
      
      // Set selected parties
      const initialSelectedParties: Record<string, boolean> = {};
      actors.forEach(actor => {
        initialSelectedParties[actor.actor_id] = agreement.parties.includes(actor.actor_id);
      });
      selectedParties = initialSelectedParties;
      
      // Initialize obligations and benefits
      obligations = [...agreement.obligations];
      benefits = [...agreement.benefits];
    }
  });
  
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
  
  // Save the agreement using gameService
  async function saveAgreement(event?: Event) {
    if (event) event.preventDefault();
    
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
    
    if (!gameId) {
      console.error('Cannot save agreement - gameId is null');
      alert('Error: Cannot determine which game this agreement belongs to');
      return;
    }
    
    try {
      // Prepare agreement data
      const agreementData = {
        game_id: gameId,
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
        await updateAgreement(agreement.id, agreementData);
        console.log(`Agreement ${agreement.id} updated successfully`);
      } else {
        // Create new agreement
        const newAgreement = await createAgreement(agreementData);
        console.log('New agreement created with ID:', newAgreement?.id);
      }
      
      // Close modal
      closeModal();
    } catch (error) {
      console.error('Failed to save agreement:', error);
      alert('Error saving agreement. Please try again.');
    }
  }
  
  // Get actor name
  function getActorName(actorId: string): string {
    const actor = actors.find(a => a.actor_id === actorId);
    return actor ? actor.role_title : 'Unknown Actor';
  }
  
  // No cleanup needed with Runes
</script>

<div class="modal-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div class="modal-container w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-800 rounded-lg shadow-xl">
    <div class="p-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
      <h2 class="text-xl font-semibold">{editMode ? 'Edit' : 'Create'} Agreement</h2>
      <button class="btn btn-sm btn-icon variant-ghost-surface" onclick={closeModal}>
        <svelte:component this={icons.X} class="w-4 h-4" />
      </button>
    </div>
    
    <div class="p-4">
      <form onsubmit={(e) => { e.preventDefault(); saveAgreement(e); }} class="space-y-4">
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
          <legend id="parties-group-label" class="form-label">Parties</legend>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2" role="group" aria-labelledby="parties-group-label">
            {#each actors as actor}
              <label class="flex items-center space-x-2 p-2 border rounded hover:bg-surface-100 dark:hover:bg-surface-700">
                <input
                  type="checkbox"
                  bind:checked={selectedParties[actor.actor_id]}
                  class="checkbox"
                  aria-labelledby="parties-group-label"
                  id={`party-checkbox-${actor.actor_id}`}
                />
                <span>{actor.role_title}</span>
              </label>
            {/each}
          </div>
        </div>
        
        <!-- Terms -->
        <fieldset class="form-group">
          <legend id="terms-group-label" class="form-label">Terms</legend>
          <div class="space-y-2" role="group" aria-labelledby="terms-group-label">
            {#each terms as term, index}
              <div class="flex space-x-2">
                <input
                  type="text"
                  value={term}
                  oninput={(e) => updateTerm(index, e.currentTarget.value)}
                  placeholder="Enter a term of the agreement"
                  class="input flex-grow"
                  aria-label={`Term ${index + 1}`}
                />
                <button
                  type="button"
                  class="btn btn-sm btn-icon variant-ghost-error"
                  onclick={() => removeTerm(index)}
                  disabled={terms.length === 1}
                  aria-label={`Remove term ${index + 1}`}
                >
                  <svelte:component this={icons.X} class="w-4 h-4" />
                </button>
              </div>
            {/each}
            
            <button
              type="button"
              class="btn btn-sm variant-ghost-primary"
              onclick={addTerm}
            >
              Add Term
            </button>
          </div>
        </fieldset>
        
        <!-- Obligations -->
        <fieldset class="form-group">
          <legend id="obligations-group-label" class="form-label">Obligations</legend>
          
          <div class="space-y-4" role="group" aria-labelledby="obligations-group-label">
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
                    aria-label={`New obligation for ${getActorName(actorId)}`}
                  />
                  <button
                    type="button"
                    class="btn btn-sm variant-filled-primary"
                    onclick={() => addObligation(actorId)}
                    aria-label={`Add obligation for ${getActorName(actorId)}`}
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
                        onclick={() => removeObligation(index)}
                        aria-label={`Remove obligation ${index + 1}`}
                      >
                        <svelte:component this={icons.X} class="w-3 h-3" />
                      </button>
                    </li>
                  {/each}
                </ul>
              </div>
            {/each}
          </div>
        </fieldset>
        
        <!-- Benefits -->
        <fieldset class="form-group">
          <legend id="benefits-group-label" class="form-label">Benefits</legend>
          
          <div class="space-y-4" role="group" aria-labelledby="benefits-group-label">
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
                    aria-label={`New benefit for ${getActorName(actorId)}`}
                  />
                  <button
                    type="button"
                    class="btn btn-sm variant-filled-primary"
                    onclick={() => addBenefit(actorId)}
                    aria-label={`Add benefit for ${getActorName(actorId)}`}
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
                        onclick={() => removeBenefit(index)}
                        aria-label={`Remove benefit ${index + 1}`}
                      >
                        <svelte:component this={icons.X} class="w-3 h-3" />
                      </button>
                    </li>
                  {/each}
                </ul>
              </div>
            {/each}
          </div>
        </fieldset>
        
        <!-- Actions -->
        <div class="flex justify-end space-x-2 pt-4 border-t border-surface-200 dark:border-surface-700">
          <button
            type="button"
            class="btn variant-ghost-surface"
            onclick={closeModal}
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