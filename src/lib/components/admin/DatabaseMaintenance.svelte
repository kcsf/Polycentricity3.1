<script lang="ts">
    import { Button, Accordion, AccordionItem, ProgressRadial } from '@skeletonlabs/skeleton';
    import { initializeBidirectionalRelationships } from '$lib/services/deckService';
    import { onMount } from 'svelte';
    
    let isBidirectionalInProgress = false;
    let bidirectionalResult: { success: boolean; processed: number } | null = null;
    
    async function handleInitializeBidirectional() {
        isBidirectionalInProgress = true;
        bidirectionalResult = null;
        
        try {
            bidirectionalResult = await initializeBidirectionalRelationships();
        } catch (error) {
            console.error('Error initializing bidirectional relationships:', error);
            bidirectionalResult = { success: false, processed: 0 };
        } finally {
            isBidirectionalInProgress = false;
        }
    }
    
    onMount(() => {
        // Component initialization
    });
</script>

<div class="space-y-4">
    <h2 class="h2 mb-4">Database Maintenance</h2>
    
    <Accordion>
        <AccordionItem>
            <svelte:fragment slot="lead">🔄</svelte:fragment>
            <svelte:fragment slot="summary">Bidirectional Relationships</svelte:fragment>
            <svelte:fragment slot="content">
                <div class="space-y-4 p-4">
                    <p>Initialize bidirectional relationships between cards and decks. This ensures that cards know which decks they belong to, and decks know which cards they contain.</p>
                    
                    <div class="flex flex-col gap-2">
                        <p class="text-sm">Enables traversal in both directions:</p>
                        <pre class="bg-surface-800 p-2 rounded-md text-xs">
// Find all decks for a card
gun.get('cards').get('card_id').get('decks')

// Find all cards in a deck
gun.get('decks').get('deck_id').get('cards')
                        </pre>
                    </div>
                    
                    {#if isBidirectionalInProgress}
                        <div class="flex items-center justify-center p-4">
                            <ProgressRadial width="w-12" />
                            <p class="ml-4">Initializing bidirectional relationships...</p>
                        </div>
                    {:else}
                        <Button color="primary" on:click={handleInitializeBidirectional}>
                            Initialize Bidirectional Relationships
                        </Button>
                        
                        {#if bidirectionalResult}
                            <div class="{bidirectionalResult.success ? 'bg-success-500/20' : 'bg-error-500/20'} p-4 rounded-md mt-4">
                                <p>
                                    {bidirectionalResult.success 
                                        ? `Successfully processed ${bidirectionalResult.processed} card-deck relationships` 
                                        : 'Failed to initialize bidirectional relationships'}
                                </p>
                            </div>
                        {/if}
                    {/if}
                </div>
            </svelte:fragment>
        </AccordionItem>
    </Accordion>
</div>