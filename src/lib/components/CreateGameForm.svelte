<script lang="ts">
        import { createEventDispatcher } from 'svelte';
        import { createGame } from '$lib/services/gameService';
        
        const dispatch = createEventDispatcher<{
                created: { gameId: string }
        }>();
        
        let gameName = '';
        let deckOption = 'predefined'; // 'predefined' or 'custom'
        let deckType = 'eco-village';
        let roleAssignment = 'random'; // 'random' or 'player-choice'
        let isCreating = false;
        let error = '';
        
        const predefinedDeckTypes = [
                { value: 'eco-village', label: 'Eco-Village' },
                { value: 'community-garden', label: 'Community Garden' }
        ];
        
        async function handleSubmit() {
                if (!gameName.trim()) {
                        error = 'Please enter a game name';
                        return;
                }
                
                isCreating = true;
                error = '';
                
                // Set a timeout to handle stalled game creation
                const timeoutId = setTimeout(() => {
                        if (isCreating) {
                                // Force navigation to games page if taking too long
                                console.log('Game creation is taking too long, redirecting to games list');
                                isCreating = false;
                                dispatch('created', { gameId: 'timeout' });
                        }
                }, 5000);
                
                try {
                        // If custom deck is selected but no implementation yet, fallback to predefined
                        const selectedDeckType = deckOption === 'custom' ? 'custom' : deckType;
                        
                        console.log(`Starting game creation: ${gameName}, ${selectedDeckType}, ${roleAssignment}`);
                        const game = await createGame(
                                gameName, 
                                selectedDeckType, 
                                roleAssignment
                        );
                        
                        // Clear the timeout since we got a response
                        clearTimeout(timeoutId);
                        
                        if (game) {
                                console.log(`Game created successfully: ${game.game_id}`);
                                dispatch('created', { gameId: game.game_id });
                        } else {
                                console.error('Game creation returned null');
                                error = 'Failed to create game. Please try again.';
                        }
                } catch (err) {
                        // Clear the timeout since we got a response
                        clearTimeout(timeoutId);
                        console.error('Error creating game:', err);
                        error = 'An error occurred while creating the game';
                } finally {
                        // Clear the timeout as a backup
                        clearTimeout(timeoutId);
                        isCreating = false;
                }
        }
</script>

<div class="card p-4 shadow bg-surface-900/80 backdrop-blur-sm">
        <header class="card-header">
                <h3 class="h3">Create New Game</h3>
        </header>
        
        <div class="p-4">
                <form on:submit|preventDefault={handleSubmit}>
                        {#if error}
                                <div class="alert variant-ghost-secondary mb-4">
                                        <p class="text-secondary-200 text-sm">{error}</p>
                                </div>
                        {/if}
                        
                        <label class="label mb-4">
                                <span>Game Name</span>
                                <input 
                                        type="text" 
                                        class="input" 
                                        bind:value={gameName} 
                                        placeholder="Enter a name for your game"
                                        required
                                />
                        </label>
                        
                        <div class="space-y-4 mb-4">
                                <span class="font-semibold">Deck Type</span>
                                
                                <div class="flex gap-4">
                                        <label class="flex items-center space-x-2">
                                                <input 
                                                        type="radio" 
                                                        bind:group={deckOption} 
                                                        name="deckOption" 
                                                        value="predefined" 
                                                        class="radio"
                                                />
                                                <span>Predefined Deck</span>
                                        </label>
                                        
                                        <label class="flex items-center space-x-2">
                                                <input 
                                                        type="radio" 
                                                        bind:group={deckOption} 
                                                        name="deckOption" 
                                                        value="custom" 
                                                        class="radio" 
                                                />
                                                <span>Custom Deck</span>
                                        </label>
                                </div>
                                
                                {#if deckOption === 'predefined'}
                                        <label class="label mt-2">
                                                <span class="text-sm opacity-75">Select Deck</span>
                                                <select class="select" bind:value={deckType}>
                                                        {#each predefinedDeckTypes as type}
                                                                <option value={type.value}>{type.label}</option>
                                                        {/each}
                                                </select>
                                        </label>
                                {:else}
                                        <div class="alert variant-ghost-primary mt-2">
                                                <p>Custom deck options will be available soon!</p>
                                        </div>
                                {/if}
                        </div>
                        
                        <div class="space-y-4 mb-6">
                                <span class="font-semibold">Role Assignment</span>
                                
                                <div class="flex gap-4">
                                        <label class="flex items-center space-x-2">
                                                <input 
                                                        type="radio" 
                                                        bind:group={roleAssignment} 
                                                        name="roleAssignment" 
                                                        value="random" 
                                                        class="radio"
                                                />
                                                <span>Random Assignment</span>
                                        </label>
                                        
                                        <label class="flex items-center space-x-2">
                                                <input 
                                                        type="radio" 
                                                        bind:group={roleAssignment} 
                                                        name="roleAssignment" 
                                                        value="player-choice" 
                                                        class="radio"
                                                />
                                                <span>Player's Choice</span>
                                        </label>
                                </div>
                        </div>
                        
                        <div class="flex justify-end">
                                <button 
                                        type="submit" 
                                        class="btn variant-filled-primary" 
                                        disabled={isCreating}
                                >
                                        {isCreating ? 'Creating...' : 'Create Game'}
                                </button>
                        </div>
                </form>
        </div>
</div>
