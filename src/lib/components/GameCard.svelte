<script lang="ts">
        import type { Game } from '$lib/types';
        import { GameStatus } from '$lib/types';
        import { goto } from '$app/navigation';
        import { formatDateTime } from '$lib/utils/helpers';
        import { userStore } from '$lib/stores/userStore';
        import * as icons from 'svelte-lucide';
        import { joinGame, leaveGame } from '$lib/services/gameService';
        
        export let game: Game;
        export let showActions = true; // Whether to show action buttons
        
        let isJoining = false;
        let isLeaving = false;
        let actionError = '';
        
        // Computed properties for game state
        $: playerCount = Object.keys(game.players || {}).length;
        $: isFull = game.max_players && playerCount >= game.max_players;
        $: isUserInGame = $userStore.user && game.players && $userStore.user.user_id in game.players;
        $: canJoin = !isUserInGame && !isFull && game.status === GameStatus.ACTIVE;
        $: isCreator = $userStore.user && game.creator === $userStore.user.user_id;
        
        // Format the role assignment type for display
        $: roleAssignmentDisplay = game.role_assignment_type ? 
            (game.role_assignment_type === 'player-choice' ? 'Player Choice' : 'Random') : 
            'Random';
            
        // Get a user-friendly deck type name
        $: deckTypeDisplay = {
            'eco-village': 'Eco-Village',
            'community-garden': 'Community Garden',
            'custom': 'Custom Deck'
        }[game.deck_type] || game.deck_type;
        
        function getStatusBadgeVariant(status: GameStatus): string {
                switch (status) {
                        case GameStatus.CREATED:
                                return 'variant-soft-primary';
                        case GameStatus.SETUP:
                                return 'variant-soft-warning';
                        case GameStatus.ACTIVE:
                                return 'variant-filled-success';
                        case GameStatus.PAUSED:
                                return 'variant-soft-tertiary';
                        case GameStatus.COMPLETED:
                                return 'variant-soft-surface';
                        default:
                                return 'variant-soft-primary';
                }
        }
        
        function getStatusIcon(status: GameStatus) {
            switch (status) {
                case GameStatus.CREATED:
                    return icons.FileSparkles;
                case GameStatus.SETUP:
                    return icons.Settings;
                case GameStatus.ACTIVE:
                    return icons.Play;
                case GameStatus.PAUSED:
                    return icons.Pause;
                case GameStatus.COMPLETED:
                    return icons.CheckCircle;
                default:
                    return icons.FileSparkles;
            }
        }
        
        function enterGame() {
                goto(`/games/${game.game_id}`);
        }
        
        async function handleJoinGame() {
                if (!$userStore.user) {
                        goto('/login');
                        return;
                }
                
                try {
                        isJoining = true;
                        actionError = '';
                        
                        // Direct to game join page instead of directly joining
                        // This will allow for actor selection/creation
                        goto(`/games/${game.game_id}/join`);
                } catch (err) {
                        console.error('Error joining game:', err);
                        actionError = 'Failed to join game. Please try again.';
                } finally {
                        isJoining = false;
                }
        }
        
        async function handleLeaveGame() {
            if (!$userStore.user) {
                goto('/login');
                return;
            }
            
            try {
                isLeaving = true;
                actionError = '';
                
                const success = await leaveGame(game.game_id);
                if (success) {
                    // Update UI to reflect the user has left
                    // This will be handled by reactivity once the game store updates
                } else {
                    actionError = 'Failed to leave game. Please try again.';
                }
            } catch (err) {
                console.error('Error leaving game:', err);
                actionError = 'Failed to leave game. Please try again.';
            } finally {
                isLeaving = false;
            }
        }
        
        // Get the day's difference between now and the game created date
        function getDaysSinceCreation(): string {
            const now = new Date();
            const created = new Date(game.created_at);
            const diffTime = Math.abs(now.getTime() - created.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            return `${diffDays} days ago`;
        }
        
        // Get date formatted to be more human readable
        $: createdDate = new Date(game.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
</script>

<div class="card p-0 shadow-xl hover:shadow-2xl transition-all duration-200 bg-surface-50 dark:bg-surface-900 border border-surface-200-700-token overflow-hidden flex flex-col h-full">
        <!-- Game Banner & Header -->
        <div class="relative bg-primary-500/10 dark:bg-primary-500/20 p-5 border-b border-surface-200-700-token">
            <!-- Status Badge -->
            <div class="absolute top-3 right-3 flex items-center gap-2">
                <div class="badge {getStatusBadgeVariant(game.status)} font-medium">
                    <svelte:component this={getStatusIcon(game.status)} size={14} class="mr-1" />
                    {game.status}
                </div>
                
                {#if isCreator}
                    <div class="badge variant-filled-secondary">
                        <icons.Crown size={14} class="mr-1" />
                        Creator
                    </div>
                {/if}
            </div>
            
            <!-- Game Title -->
            <h3 class="h3 text-primary-700 dark:text-primary-300 pr-16">{game.name}</h3>
            
            <!-- Date & Players Info -->
            <div class="flex flex-wrap justify-between items-center mt-3 text-xs text-surface-700 dark:text-surface-300">
                <div class="flex items-center">
                    <icons.Calendar size={14} class="mr-1" />
                    <span class="mr-1">{createdDate}</span>
                    <span class="opacity-75">({getDaysSinceCreation()})</span>
                </div>
                
                <div class="flex items-center mt-1 sm:mt-0">
                    <icons.Users size={14} class="mr-1" />
                    <span>
                        {playerCount} {game.max_players ? `/ ${game.max_players}` : 'players'}
                    </span>
                    {#if isFull}
                        <div class="badge variant-filled-warning text-xs ml-2">Full</div>
                    {/if}
                </div>
            </div>
        </div>
        
        <!-- Game Details Section -->
        <div class="p-5 flex-grow flex flex-col">
            <!-- Game Properties -->
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="flex flex-col">
                    <p class="text-xs font-semibold text-tertiary-500 dark:text-tertiary-400 mb-1">Deck Type</p>
                    <div class="flex items-center">
                        <icons.LayoutGrid size={16} class="mr-2 text-tertiary-500" />
                        <p class="text-sm text-surface-900 dark:text-surface-50 capitalize">{deckTypeDisplay}</p>
                    </div>
                </div>
                
                <div class="flex flex-col">
                    <p class="text-xs font-semibold text-tertiary-500 dark:text-tertiary-400 mb-1">Role Assignment</p>
                    <div class="flex items-center">
                        <icons.SwitchCamera size={16} class="mr-2 text-tertiary-500" />
                        <p class="text-sm text-surface-900 dark:text-surface-50">{roleAssignmentDisplay}</p>
                    </div>
                </div>
            </div>
            
            <!-- Game Description -->
            {#if game.description}
                <div class="mb-4">
                    <p class="text-xs font-semibold text-tertiary-500 dark:text-tertiary-400 mb-1">Description</p>
                    <p class="text-sm text-surface-700-300-token">{game.description || 'No description provided.'}</p>
                </div>
            {/if}
            
            <!-- Spacer to push buttons to bottom when description is short -->
            <div class="flex-grow"></div>
            
            <!-- Action Buttons Section -->
            {#if showActions}
                <div class="flex flex-col sm:flex-row gap-2 mt-3">
                    {#if isUserInGame}
                        <button class="btn variant-filled-primary flex-1" on:click={enterGame}>
                            <icons.LogIn size={18} class="mr-2" />
                            View Game
                        </button>
                        
                        {#if !isCreator}
                            <button 
                                class="btn variant-soft-error" 
                                on:click={handleLeaveGame}
                                disabled={isLeaving}
                            >
                                {#if isLeaving}
                                    <div class="spinner-third w-4 h-4 mr-2"></div>
                                    Leaving...
                                {:else}
                                    <icons.LogOut size={18} class="mr-2" />
                                    Leave
                                {/if}
                            </button>
                        {/if}
                    {:else if game.status === GameStatus.ACTIVE}
                        <button 
                            class="btn variant-filled-success flex-1" 
                            on:click={handleJoinGame} 
                            disabled={isJoining || isFull}
                        >
                            {#if isJoining}
                                <div class="spinner-third w-4 h-4 mr-2"></div>
                                Joining...
                            {:else}
                                <icons.UserPlus size={18} class="mr-2" />
                                Join Game
                            {/if}
                        </button>
                        
                        <button class="btn variant-ghost" on:click={enterGame}>
                            <icons.Info size={18} class="mr-2" />
                            Details
                        </button>
                    {:else}
                        <button class="btn variant-ghost-primary flex-1" on:click={enterGame}>
                            <icons.Info size={18} class="mr-2" />
                            View Details
                        </button>
                    {/if}
                </div>
            {/if}
        </div>
        
        {#if actionError}
            <div class="p-3 bg-error-500/10 border-t border-error-500/20 text-error-500 text-sm text-center">
                {actionError}
            </div>
        {/if}
</div>
