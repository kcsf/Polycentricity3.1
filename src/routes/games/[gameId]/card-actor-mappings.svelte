<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { getCollection, nodes } from '$lib/services/gunService';
    import { getGameContext, getGameActors, getCard } from '$lib/services/gameService';
    import type { Actor, Card } from '$lib/types';

    const gameId = $page.params.gameId;
    
    let isLoading = $state(true);
    let actors = $state<Actor[]>([]);
    let cardActorMappings = $state<{cardId: string, cardName: string, actorId: string, actorName: string}[]>([]);
    let error = $state<string | null>(null);
    
    $effect(async () => {
        try {
            isLoading = true;
            
            // Get all actors in the game
            actors = await getGameActors(gameId);
            
            // Create mappings array
            const mappings = [];
            
            // For each actor with a card, get card details and create mapping
            for (const actor of actors) {
                if (actor.card_ref) {
                    try {
                        const card = await getCard(actor.card_ref, true);
                        if (card) {
                            mappings.push({
                                cardId: card.card_id,
                                cardName: card.name,
                                actorId: actor.actor_id,
                                actorName: actor.name || actor.actor_type || 'Unnamed Actor'
                            });
                        }
                    } catch (err) {
                        console.error(`Error loading card ${actor.card_ref} for actor ${actor.actor_id}:`, err);
                    }
                }
            }
            
            cardActorMappings = mappings;
            
        } catch (err) {
            console.error('Error loading card-actor mappings:', err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            isLoading = false;
        }
    });
</script>

<div class="container mx-auto p-4">
    <div class="bg-gradient-to-r from-primary-900/30 to-tertiary-900/30 p-6 rounded-lg mb-8 shadow-lg">
        <div class="flex justify-between items-center">
            <h1 class="h1 text-primary-400 mb-2">Card-Actor Mappings</h1>
            <a href="/games/{gameId}/details" class="btn variant-ghost-surface">
                Back to Game Details
            </a>
        </div>
    </div>
    
    {#if isLoading}
        <div class="card p-8 text-center bg-surface-100-800-token">
            <div class="flex justify-center items-center h-32">
                <div class="spinner-third w-8 h-8"></div>
                <p class="ml-4 text-lg">Loading card-actor mappings...</p>
            </div>
        </div>
    {:else if error}
        <div class="alert variant-filled-error p-4 mb-4">
            <span class="text-xl">⚠️</span>
            <div class="alert-message">
                <h4 class="h4">Error</h4>
                <p>{error}</p>
            </div>
        </div>
    {:else if cardActorMappings.length === 0}
        <div class="card p-6 variant-ghost-surface text-center">
            <span class="text-5xl mb-4 block">📋</span>
            <h4 class="h4 mb-2">No Card-Actor Mappings Found</h4>
            <p class="text-sm max-w-lg mx-auto">
                There are no cards assigned to actors in this game yet.
            </p>
        </div>
    {:else}
        <div class="card p-6 bg-surface-100-800-token">
            <h3 class="h3 mb-4">Actor-Card Assignments</h3>
            
            <div class="table-container">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Actor ID</th>
                            <th>Actor Name</th>
                            <th>Card ID</th>
                            <th>Card Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each cardActorMappings as mapping}
                            <tr>
                                <td class="font-mono text-xs">{mapping.actorId}</td>
                                <td>{mapping.actorName}</td>
                                <td class="font-mono text-xs">{mapping.cardId}</td>
                                <td>{mapping.cardName}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-6 p-4 bg-surface-200-700-token/30 rounded-lg text-sm">
                <h4 class="font-semibold mb-2">Summary</h4>
                <p>Found {cardActorMappings.length} actor(s) with assigned cards out of {actors.length} total actors in the game.</p>
            </div>
        </div>
    {/if}
</div>

<style>
    .table-container {
        overflow-x: auto;
    }
    
    .table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .table th, .table td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--color-surface-300-600-token);
    }
    
    .table th {
        background-color: var(--color-surface-200-700-token);
        font-weight: 600;
    }
    
    .table-hover tr:hover td {
        background-color: var(--color-surface-100-800-token);
    }
</style>