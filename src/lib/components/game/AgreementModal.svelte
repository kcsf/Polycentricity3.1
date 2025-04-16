<script lang="ts">
  import { gameStore, AgreementType } from '@/store/gameStore';
  import type { Actor } from '@/store/gameStore';
  import { v4 as uuidv4 } from 'uuid';
  import { Plus, Trash2, X } from 'lucide-svelte';
  
  // Form data
  let title = '';
  let summary = '';
  let type: AgreementType = AgreementType.Bilateral;
  let selectedParties: string[] = [];
  let partyTerms: Record<string, {
    actorId: string;
    obligations: { id: string; text: string }[];
    benefits: { id: string; text: string }[];
  }> = {};
  let newObligation: Record<string, string> = {};
  let newBenefit: Record<string, string> = {};
  
  // Validation errors
  let errors: Record<string, string> = {};
  
  // Store subscriptions
  let showModal = false;
  let actors: Actor[] = [];
  
  const unsubscribeModal = gameStore.showAgreementModal.subscribe(value => {
    showModal = value;
    if (value) {
      // Reset form when modal is opened
      resetForm();
    }
  });
  
  const unsubscribeActors = gameStore.actors.subscribe(value => {
    actors = value;
  });
  
  function resetForm() {
    title = '';
    summary = '';
    type = AgreementType.Bilateral;
    selectedParties = [];
    partyTerms = {};
    newObligation = {};
    newBenefit = {};
    errors = {};
  }
  
  function closeModal() {
    resetForm();
    gameStore.toggleAgreementModal();
  }
  
  function toggleParty(actorId: string) {
    const index = selectedParties.indexOf(actorId);
    if (index !== -1) {
      // Remove party
      selectedParties = selectedParties.filter(id => id !== actorId);
      // Remove party terms
      const { [actorId]: _, ...rest } = partyTerms;
      partyTerms = rest;
    } else {
      // Add party
      selectedParties = [...selectedParties, actorId];
      // Initialize terms
      partyTerms = {
        ...partyTerms,
        [actorId]: {
          actorId,
          obligations: [],
          benefits: []
        }
      };
    }
  }
  
  function addObligation(actorId: string) {
    if (!newObligation[actorId]?.trim()) return;
    
    partyTerms = {
      ...partyTerms,
      [actorId]: {
        ...partyTerms[actorId],
        obligations: [
          ...partyTerms[actorId].obligations,
          { id: uuidv4(), text: newObligation[actorId] }
        ]
      }
    };
    
    newObligation = {
      ...newObligation,
      [actorId]: ''
    };
  }
  
  function removeObligation(actorId: string, obligationId: string) {
    partyTerms = {
      ...partyTerms,
      [actorId]: {
        ...partyTerms[actorId],
        obligations: partyTerms[actorId].obligations.filter(o => o.id !== obligationId)
      }
    };
  }
  
  function addBenefit(actorId: string) {
    if (!newBenefit[actorId]?.trim()) return;
    
    partyTerms = {
      ...partyTerms,
      [actorId]: {
        ...partyTerms[actorId],
        benefits: [
          ...partyTerms[actorId].benefits,
          { id: uuidv4(), text: newBenefit[actorId] }
        ]
      }
    };
    
    newBenefit = {
      ...newBenefit,
      [actorId]: ''
    };
  }
  
  function removeBenefit(actorId: string, benefitId: string) {
    partyTerms = {
      ...partyTerms,
      [actorId]: {
        ...partyTerms[actorId],
        benefits: partyTerms[actorId].benefits.filter(b => b.id !== benefitId)
      }
    };
  }
  
  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }
    
    if (!summary.trim()) {
      newErrors.summary = 'Summary is required';
    } else if (summary.length < 10) {
      newErrors.summary = 'Summary should be at least 10 characters';
    }
    
    if (selectedParties.length === 0) {
      newErrors.parties = 'At least one party must be selected';
    }
    
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }
  
  function submitForm() {
    if (!validate()) return;
    
    // Format obligations and benefits for the agreement
    const obligations = Object.values(partyTerms).flatMap(party => 
      party.obligations.map(obligation => ({
        id: obligation.id,
        description: obligation.text,
        fromActorId: party.actorId,
      }))
    );
    
    const benefits = Object.values(partyTerms).flatMap(party => 
      party.benefits.map(benefit => ({
        id: benefit.id,
        description: benefit.text,
        toActorId: party.actorId,
      }))
    );
    
    // Create the new agreement
    const newAgreement = {
      id: uuidv4(),
      title,
      summary,
      type,
      parties: selectedParties,
      obligations,
      benefits,
      position: { x: 200, y: 200 }
    };
    
    // Add to store and close modal
    gameStore.addAgreement(newAgreement);
    closeModal();
  }
  
  function getActorName(actorId: string): string {
    const actor = actors.find(a => a.id === actorId);
    return actor ? actor.name : 'Unknown Actor';
  }
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 bg-black/80 flex justify-center items-center">
    <div class="bg-[#FCFCF7] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-lg">
      <div class="p-4 border-b flex justify-between items-center">
        <h2 class="text-xl font-bold">Create New Agreement</h2>
        <button 
          on:click={closeModal}
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200"
          aria-label="Close Modal"
        >
          <X class="w-5 h-5 text-gray-700" />
        </button>
      </div>
      
      <div class="p-4 space-y-4">
        <!-- Agreement Basic Info -->
        <div>
          <label for="title" class="block text-sm font-medium mb-1">Agreement Title</label>
          <input
            id="title"
            type="text"
            bind:value={title}
            placeholder="Enter a memorable title..."
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {#if errors.title}
            <p class="text-xs text-red-500 mt-1">{errors.title}</p>
          {/if}
        </div>
        
        <div>
          <label for="summary" class="block text-sm font-medium mb-1">Agreement Summary</label>
          <textarea
            id="summary"
            bind:value={summary}
            placeholder="Briefly describe this agreement..."
            rows="2"
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
          ></textarea>
          {#if errors.summary}
            <p class="text-xs text-red-500 mt-1">{errors.summary}</p>
          {/if}
        </div>
        
        <!-- Agreement Type -->
        <div>
          <label class="block text-sm font-medium mb-1">Agreement Type</label>
          <div class="grid grid-cols-2 gap-3 mt-1">
            <div class={`border rounded p-3 cursor-pointer hover:border-primary flex items-center ${type === AgreementType.Bilateral ? 'border-primary bg-primary/5' : ''}`}>
              <input
                type="radio"
                id="bilateral"
                bind:group={type}
                value={AgreementType.Bilateral}
                class="mr-2"
              />
              <div>
                <label for="bilateral" class="font-medium">Bilateral</label>
                <p class="text-xs text-gray-500">Between two parties</p>
              </div>
            </div>
            
            <div class={`border rounded p-3 cursor-pointer hover:border-primary flex items-center ${type === AgreementType.Multilateral ? 'border-primary bg-primary/5' : ''}`}>
              <input
                type="radio"
                id="multilateral"
                bind:group={type}
                value={AgreementType.Multilateral}
                class="mr-2"
              />
              <div>
                <label for="multilateral" class="font-medium">Multilateral</label>
                <p class="text-xs text-gray-500">Three or more parties</p>
              </div>
            </div>
            
            <div class={`border rounded p-3 cursor-pointer hover:border-primary flex items-center ${type === AgreementType.Symmetric ? 'border-primary bg-primary/5' : ''}`}>
              <input
                type="radio"
                id="symmetric"
                bind:group={type}
                value={AgreementType.Symmetric}
                class="mr-2"
              />
              <div>
                <label for="symmetric" class="font-medium">Symmetric</label>
                <p class="text-xs text-gray-500">Equal terms for all parties</p>
              </div>
            </div>
            
            <div class={`border rounded p-3 cursor-pointer hover:border-primary flex items-center ${type === AgreementType.Asymmetric ? 'border-primary bg-primary/5' : ''}`}>
              <input
                type="radio"
                id="asymmetric"
                bind:group={type}
                value={AgreementType.Asymmetric}
                class="mr-2"
              />
              <div>
                <label for="asymmetric" class="font-medium">Asymmetric</label>
                <p class="text-xs text-gray-500">Unequal terms between parties</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Parties Involved -->
        <div>
          <label class="block text-sm font-medium mb-1">Parties Involved</label>
          <div class="flex flex-wrap gap-2 mb-2">
            {#each selectedParties as actorId}
              <span class="bg-primary/10 text-primary px-2 py-1 rounded-full text-sm flex items-center">
                {getActorName(actorId)}
                <button 
                  type="button"
                  on:click={() => toggleParty(actorId)}
                  class="ml-1 text-primary/70 hover:text-primary h-5 w-5 p-0 flex items-center justify-center"
                >
                  <X class="h-3 w-3" />
                </button>
              </span>
            {/each}
          </div>
          
          {#if errors.parties}
            <p class="text-xs text-red-500 mb-2">{errors.parties}</p>
          {/if}
          
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Available Actors</label>
            <div class="flex flex-wrap gap-2 mt-1">
              {#each actors as actor}
                <button
                  type="button"
                  class={`px-3 py-1 text-sm rounded-md border ${selectedParties.includes(actor.id) ? 'bg-primary/10 border-primary text-primary' : 'border-gray-300 hover:border-gray-400'}`}
                  on:click={() => toggleParty(actor.id)}
                >
                  {actor.name}
                </button>
              {/each}
            </div>
          </div>
        </div>
        
        <!-- Agreement Details - Per Party -->
        {#if selectedParties.length > 0}
          <div class="space-y-4">
            {#each selectedParties as actorId}
              <div class="border rounded-lg p-4 bg-white">
                <h3 class="font-medium mb-3">{getActorName(actorId)}</h3>
                
                <div class="mb-3">
                  <label class="block text-sm font-medium mb-1">Obligations</label>
                  <div class="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      bind:value={newObligation[actorId] || ''}
                      placeholder="Add an obligation..."
                      class="flex-grow px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      on:click={() => addObligation(actorId)}
                      class="bg-primary text-white p-2 h-9 w-9 rounded flex items-center justify-center"
                    >
                      <Plus class="h-4 w-4" />
                    </button>
                  </div>
                  
                  <ul class="space-y-1">
                    {#each partyTerms[actorId]?.obligations || [] as obligation}
                      <li class="flex items-center justify-between bg-primary/5 p-2 rounded">
                        <span class="text-sm">{obligation.text}</span>
                        <button
                          type="button"
                          on:click={() => removeObligation(actorId, obligation.id)}
                          class="text-gray-500 hover:text-gray-700 h-6 w-6 flex items-center justify-center"
                        >
                          <Trash2 class="h-4 w-4" />
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
                
                <div>
                  <label class="block text-sm font-medium mb-1">Benefits</label>
                  <div class="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      bind:value={newBenefit[actorId] || ''}
                      placeholder="Add a benefit..."
                      class="flex-grow px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      on:click={() => addBenefit(actorId)}
                      class="bg-accent text-white p-2 h-9 w-9 rounded flex items-center justify-center"
                    >
                      <Plus class="h-4 w-4" />
                    </button>
                  </div>
                  
                  <ul class="space-y-1">
                    {#each partyTerms[actorId]?.benefits || [] as benefit}
                      <li class="flex items-center justify-between bg-accent/5 p-2 rounded">
                        <span class="text-sm">{benefit.text}</span>
                        <button
                          type="button"
                          on:click={() => removeBenefit(actorId, benefit.id)}
                          class="text-gray-500 hover:text-gray-700 h-6 w-6 flex items-center justify-center"
                        >
                          <Trash2 class="h-4 w-4" />
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="p-4 border-t flex justify-end space-x-3">
        <button 
          type="button" 
          on:click={closeModal}
          class="px-4 py-2 border rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button 
          type="button"
          on:click={submitForm}
          disabled={selectedParties.length === 0}
          class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Agreement
        </button>
      </div>
    </div>
  </div>
{/if}