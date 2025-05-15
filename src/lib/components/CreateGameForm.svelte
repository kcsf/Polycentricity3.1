<script lang="ts">
    import { createGame } from '$lib/services/gameService';
    import type { Game, Deck } from '$lib/types';
    import * as icons from '@lucide/svelte';

    // Define props interface
    interface Props {
        decks: Deck[];
        onCreated: (gameId: string) => void;
        onStatusUpdate: (status: 'idle' | 'creating' | 'success' | 'error', message?: string) => void;
    }

    // Declare props
    const { decks, onCreated, onStatusUpdate }: Props = $props();

    let gameName = $state('');
    let deckRef = $state(decks.length > 0 ? decks[0].deck_id : '');
    let roleAssignment = $state<"player-choice" | "random">('player-choice');
    let maxPlayers = $state<number | undefined>(undefined);
    let isCreating = $state(false);
    let error = $state('');

    async function handleSubmit() {
        if (!gameName.trim()) {
            error = 'Please enter a game name';
            onStatusUpdate('error', error);
            return;
        }

        if (!deckRef) {
            error = 'Please select a deck';
            onStatusUpdate('error', error);
            return;
        }

        try {
            isCreating = true;
            error = '';
            onStatusUpdate('creating', 'Creating game...');

            const game: Game | null = await createGame(
                gameName.trim(),
                deckRef,
                roleAssignment,
                maxPlayers
            );

            if (!game) {
                error = 'Failed to create game. Please try again.';
                onStatusUpdate('error', error);
                return;
            }

            onStatusUpdate('success', 'Game created successfully!');
            onCreated(game.game_id);

        } catch (err: unknown) {
            console.error('Error creating game:', err);
            error = `Failed to create game: ${err instanceof Error ? err.message : 'Unknown error'}`;
            onStatusUpdate('error', error);
        } finally {
            isCreating = false;
        }
    }
</script>

<div class="card p-6 bg-surface-100-800-token space-y-6">
    <form onsubmit={event => { event.preventDefault(); handleSubmit(); }}>
        {#if error}
            <div class="alert variant-filled-error p-4 mb-4">
                <icons.AlertCircle size={20} class="mr-2" />
                <span>{error}</span>
            </div>
        {/if}

        {#if isCreating}
            <div class="alert variant-filled-primary p-4 mb-4">
                <span class="loading loading-spinner loading-md text-primary-500 mr-2"></span>
                <span>Creating game... This may take a moment.</span>
            </div>
        {/if}

        <!-- Game Name -->
        <div class="space-y-2 mb-4">
            <label class="label">
                <span class="font-medium">Game Name</span>
                <input
                    type="text"
                    class="input"
                    placeholder="e.g., Eco-Village Simulation"
                    bind:value={gameName}
                    disabled={isCreating}
                />
            </label>
        </div>

        <!-- Deck Selection -->
        <div class="space-y-2 mb-4">
            <label class="label">
                <span class="font-medium">Select Deck</span>
                <select class="select" bind:value={deckRef} disabled={isCreating || decks.length === 0}>
                    {#if decks.length === 0}
                        <option value="" disabled>No decks available</option>
                    {:else}
                        {#each decks as deck}
                            <option value={deck.deck_id}>{deck.name}</option>
                        {/each}
                    {/if}
                </select>
            </label>
        </div>

        <!-- Role Assignment -->
        <div class="space-y-2 mb-4">
            <label class="label">
                <span class="font-medium">Role Assignment</span>
                <select class="select" bind:value={roleAssignment} disabled={isCreating}>
                    <option value="player-choice">Player Choice</option>
                    <option value="random">Random</option>
                </select>
            </label>
        </div>

        <!-- Max Players -->
        <div class="space-y-2 mb-6">
            <label class="label">
                <span class="font-medium">Max Players (Optional)</span>
                <input
                    type="number"
                    class="input"
                    placeholder="e.g., 5"
                    min="1"
                    bind:value={maxPlayers}
                    disabled={isCreating}
                />
            </label>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end">
            <button type="submit" class="btn variant-filled-primary" disabled={isCreating || decks.length === 0}>
                <icons.Plus size={18} class="mr-2" />
                {isCreating ? 'Creating...' : 'Create Game'}
            </button>
        </div>
    </form>
</div>