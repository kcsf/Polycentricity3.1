<script lang="ts">
        import { createEventDispatcher } from 'svelte';
        import { createGame } from '$lib/services/gameService';
        
        const dispatch = createEventDispatcher<{
                created: { gameId: string };
                statusUpdate: { status: string };
        }>();
        
        // Use Svelte 5 RUNES state
        let gameName = $state('');
        let deckOption = $state('predefined'); // 'predefined' or 'custom'
        let deckType = $state('eco-village');
        let roleAssignment = $state('random'); // 'random' or 'player-choice'
        let isCreating = $state(false);
        let error = $state('');
        
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
                
                // Update creator status through event
                dispatch('statusUpdate', { status: 'creating' });
                
                // Set a very short timeout just for safety in case something goes wrong
                // This timeout should never be triggered in normal operation
                const timeoutId = setTimeout(() => {
                        if (isCreating) {
                                // This should only happen if there's a serious error
                                console.log('Game creation is taking longer than expected but continuing in background');
                                isCreating = false;
                                dispatch('statusUpdate', { status: 'background' });
                                
                                // Don't redirect immediately - set a flag to indicate background operation
                                // and let the game continue creating in the background
                                localStorage.setItem('game_creating_background', 'true');
                                dispatch('created', { gameId: 'background' });
                        }
                }, 30000); // Much longer timeout as a safety fallback only
                
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
                                dispatch('statusUpdate', { status: 'success' });
                                dispatch('created', { gameId: game.game_id });
                        } else {
                                console.error('Game creation returned null');
                                dispatch('statusUpdate', { status: 'error' });
                                error = 'Failed to create game. Please try again.';
                        }
                } catch (err) {
                        // Clear the timeout since we got a response
                        clearTimeout(timeoutId);
                        console.error('Error creating game:', err);
                        dispatch('statusUpdate', { status: 'error' });
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
                <form onsubmit={e => { e.preventDefault(); handleSubmit(); }}>
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
