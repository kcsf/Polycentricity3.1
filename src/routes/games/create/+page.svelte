<script lang="ts">
    import { goto } from '$app/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { getCollection, nodes } from '$lib/services/gunService'; // Added nodes import
    import type { User, Deck } from '$lib/types';
    import CreateGameForm from '$lib/components/CreateGameForm.svelte';
    import * as icons from '@lucide/svelte';

    // Define props interface for CreateGameForm
    interface CreateGameFormProps {
        decks: Deck[];
        onCreated: (gameId: string) => void;
        onStatusUpdate: (status: 'idle' | 'creating' | 'success' | 'error', message?: string) => void;
    }

    // State variables
    let isLoading = $state(false);
    let errorMessage = $state('');
    let successMessage = $state('');
    let decks = $state<Deck[]>([]);

    // Load available decks
    $effect(() => {
        const loadDecks = async () => {
            try {
                decks = await getCollection<Deck>(nodes.decks);
                console.log(`[CreateGamePage] Loaded ${decks.length} decks:`, decks);
            } catch (err) {
                console.error('[CreateGamePage] Error loading decks:', err);
                errorMessage = 'Failed to load decks. Please try again.';
            }
        };
        loadDecks();
    });

    // Mock user for development if userStore is empty
    const currentUser = $derived<User | null>(
        $userStore.user || {
            user_id: 'u_temp',
            name: 'Temp User',
            email: 'temp@example.com',
            role: 'Member',
            created_at: Date.now()
        }
    );

    // Navigate back to games list
    function goBack() {
        goto('/games');
    }

    // Handle game creation success
    function handleCreated(gameId: string) {
        successMessage = 'Game created successfully! Redirecting...';
        setTimeout(() => {
            goto(`/games/${gameId}/details`);
        }, 1000);
    }

    // Handle status updates from the form
    function handleStatusUpdate(status: 'idle' | 'creating' | 'success' | 'error', message?: string) {
        isLoading = status === 'creating';
        if (status === 'error' && message) {
            errorMessage = message;
        } else if (status === 'success' && message) {
            successMessage = message;
        } else {
            errorMessage = '';
            successMessage = '';
        }
    }
</script>

<div class="container mx-auto p-6 space-y-6">
    <!-- Header Section -->
    <div class="card bg-gradient-to-r from-primary-900/30 to-tertiary-900/30 p-6 rounded-lg shadow-xl">
        <div class="flex items-center">
            <button class="btn btn-sm variant-ghost-surface mr-3" onclick={goBack}>
                <icons.ArrowLeft size={18} />
            </button>
            <h1 class="h1 text-primary-400">Create New Game</h1>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- About Game Creation -->
        <div class="lg:col-span-1">
            <div class="card p-6 bg-surface-100-800-token space-y-4">
                <h3 class="h3 text-primary-500">About Game Creation</h3>
                <p class="text-sm text-surface-300">
                    Create a new game session where players can collaborate to build an eco-village or other sustainable projects.
                </p>
                <h4 class="h4 text-base text-tertiary-500">Available Decks:</h4>
                {#if decks.length > 0}
                    <ul class="list-disc list-inside space-y-1 text-sm text-surface-300">
                        {#each decks as deck}
                            <li>
                                <strong>{deck.name}:</strong> {deck.description || 'No description available'}
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p class="text-sm text-warning-500">No decks available. Please create a deck first.</p>
                {/if}
                <p class="text-sm text-surface-300">
                    After creating your game, you'll be able to:
                </p>
                <ul class="list-disc list-inside space-y-1 text-sm text-surface-300">
                    <li>Invite players to join</li>
                    <li>Assign or let players choose roles</li>
                    <li>Start making agreements and decisions</li>
                    <li>Chat with other participants</li>
                </ul>
            </div>
        </div>

        <!-- Game Creation Form -->
        <div class="lg:col-span-2">
            {#if successMessage}
                <div class="alert variant-filled-success p-4 mb-4">
                    <icons.CheckCircle size={20} class="mr-2" />
                    <span>{successMessage}</span>
                </div>
            {/if}

            {#if errorMessage}
                <div class="alert variant-filled-error p-4 mb-4">
                    <icons.AlertCircle size={20} class="mr-2" />
                    <span>{errorMessage}</span>
                </div>
            {/if}

            {#if isLoading}
                <div class="alert variant-filled-primary p-4 mb-4">
                    <span class="loading loading-spinner loading-md text-primary-500 mr-2"></span>
                    <span>Creating your game... This may take a moment.</span>
                </div>
            {/if}

            <CreateGameForm decks={decks} onCreated={handleCreated} onStatusUpdate={handleStatusUpdate} />
        </div>
    </div>
</div>