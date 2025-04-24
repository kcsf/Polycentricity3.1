<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { getGame, isGameFull } from '$lib/services/gameService';
    import { userStore } from '$lib/stores/userStore';
    import type { Game } from '$lib/types';
    import { GameStatus } from '$lib/types';
    import * as icons from '@lucide/svelte';
    
    const gameId = $page.params.gameId;
    
    // Use Svelte 5 Runes for state variables
    let game = $state<Game | null>(null);
    let isLoading = $state(true);
    let errorMessage = $state('');
    let isFull = $state(false);
    let isJoining = $state(false);
    
    // Use an effect to load data when the component mounts
    $effect(async () => {
        try {
            isLoading = true;
            
            // Load game data
            const loadedGame = await getGame(gameId);
            game = loadedGame;
            
            if (!game) {
                errorMessage = 'Game not found';
                return;
            }
            
            // Check if game is full
            isFull = await isGameFull(gameId);
        } catch (err) {
            console.error('Error loading game:', err);
            errorMessage = 'Failed to load game data';
        } finally {
            isLoading = false;
        }
    });
    
    function goBack() {
        goto('/games');
    }
    
    function handleJoinGame() {
        if (!$userStore.user) {
            goto('/login');
            return;
        }
        
        isJoining = true;
        goto(`/games/${gameId}/join`);
    }
    
    function viewGame() {
        goto(`/games/${gameId}`);
    }
    
    // Get the day's difference between now and the game created date
    function getDaysSinceCreation(createdTimestamp: number): string {
        const now = new Date();
        const created = new Date(createdTimestamp);
        const diffTime = Math.abs(now.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        return `${diffDays} days ago`;
    }
</script>

<div class="container mx-auto p-4">
    <div class="bg-gradient-to-r from-primary-900/30 to-tertiary-900/30 p-6 rounded-lg mb-8 shadow-lg">
        <div class="flex justify-between items-center">
            <div>
                <h1 class="h1 text-primary-400 mb-2">Game Details</h1>
                <p class="text-surface-300">
                    {#if game}
                        Viewing details for "{game.name}"
                    {:else}
                        Loading game details...
                    {/if}
                </p>
            </div>
            <button class="btn variant-ghost-surface" onclick={goBack}>
                <icons.ArrowLeft size={20} class="mr-2" />
                Back to Games
            </button>
        </div>
    </div>
    
    {#if isLoading}
        <div class="card p-8 text-center bg-surface-100-800-token">
            <div class="flex justify-center items-center h-32">
                <div class="spinner-third w-8 h-8"></div>
                <p class="ml-4 text-lg">Loading game data...</p>
            </div>
        </div>
    {:else if errorMessage}
        <div class="alert variant-filled-error p-4 mb-4">
            <icons.AlertCircle size={20} />
            <span>{errorMessage}</span>
        </div>
        <div class="flex justify-center mt-4">
            <button class="btn variant-filled-primary" onclick={goBack}>
                <icons.ArrowLeft size={20} class="mr-2" />
                Back to Games
            </button>
        </div>
    {:else if game}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Game Details Card -->
            <div class="card p-6 bg-surface-100-800-token lg:col-span-2">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="h2 text-primary-500">{game.name}</h2>
                    <div class="badge {game.status === GameStatus.ACTIVE ? 'variant-filled-success' : 'variant-filled-warning'} text-sm">
                        <svelte:component this={getGameStatusIcon(game.status)} size={16} class="mr-1" />
                        {game.status}
                    </div>
                </div>
                
                {#if game.description}
                    <div class="mb-6 p-4 rounded-lg bg-surface-200-700-token/30">
                        <p class="italic">{game.description}</p>
                    </div>
                {/if}
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 class="font-semibold text-tertiary-500 mb-2">Game Info</h3>
                        <ul class="space-y-3">
                            <li class="flex items-center">
                                <icons.Calendar class="mr-3 text-tertiary-500" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Created</span>
                                    <span class="text-sm opacity-80">
                                        {new Date(game.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                        ({getDaysSinceCreation(game.created_at)})
                                    </span>
                                </div>
                            </li>
                            <li class="flex items-center">
                                <icons.Users class="mr-3 text-tertiary-500" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Players</span>
                                    <span class="text-sm opacity-80">
                                        {Object.keys(game.players || {}).length} 
                                        {game.max_players ? `/ ${game.max_players}` : 'players'}
                                        {#if isFull}
                                            <span class="badge variant-filled-warning text-xs ml-1">Full</span>
                                        {/if}
                                    </span>
                                </div>
                            </li>
                            <li class="flex items-center">
                                <icons.LayoutGrid class="mr-3 text-tertiary-500" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Deck Type</span>
                                    <span class="text-sm opacity-80 capitalize">
                                        {game.deck_type === 'eco-village' ? 'Eco-Village' :
                                         game.deck_type === 'community-garden' ? 'Community Garden' :
                                         game.deck_type}
                                    </span>
                                </div>
                            </li>
                            <li class="flex items-center">
                                <icons.SwitchCamera class="mr-3 text-tertiary-500" size={18} />
                                <div>
                                    <span class="block text-sm font-medium">Role Assignment</span>
                                    <span class="text-sm opacity-80">
                                        {game.role_assignment_type === 'player-choice' ? 'Player Choice' : 'Random'}
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </div>
                    
                    <div>
                        <h3 class="font-semibold text-tertiary-500 mb-2">Game Actions</h3>
                        
                        <div class="p-5 bg-surface-200-700-token/30 rounded-lg">
                            {#if game.status === GameStatus.ACTIVE && !isFull}
                                <p class="mb-4 text-sm">This game is currently active. You can join now to participate with other players.</p>
                                <button 
                                    class="btn variant-filled-success w-full mb-3" 
                                    onclick={handleJoinGame}
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
                                
                                <button class="btn variant-ghost w-full" onclick={viewGame}>
                                    <icons.ArrowRight size={18} class="mr-2" />
                                    View Game
                                </button>
                            {:else if game.status === GameStatus.ACTIVE && isFull}
                                <p class="mb-4 text-sm text-warning-500">This game is currently full. You can view the game, but cannot join until a player leaves.</p>
                                <button class="btn variant-ghost-primary w-full" onclick={viewGame}>
                                    <icons.ArrowRight size={18} class="mr-2" />
                                    View Game
                                </button>
                            {:else}
                                <p class="mb-4 text-sm">This game is {game.status.toLowerCase()}. You can view the game, but joining is only available for active games.</p>
                                <button class="btn variant-ghost-primary w-full" onclick={viewGame}>
                                    <icons.ArrowRight size={18} class="mr-2" />
                                    View Game
                                </button>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Rules & Instructions Card -->
            <div class="card p-6 bg-surface-100-800-token">
                <h3 class="h3 mb-4 text-secondary-500">How To Play</h3>
                
                <div class="space-y-4">
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">1. Join the Game</h4>
                        <p class="text-sm">Click "Join Game" to enter the game and select your actor role.</p>
                    </div>
                    
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">2. Select Your Actor</h4>
                        <p class="text-sm">Choose a role from the available options. Each actor has unique values, capabilities, and goals.</p>
                    </div>
                    
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">3. Interact With Others</h4>
                        <p class="text-sm">Collaborate with other players to achieve collective goals while managing your individual objectives.</p>
                    </div>
                    
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">4. Create Agreements</h4>
                        <p class="text-sm">Establish formal agreements with other actors to exchange benefits and obligations.</p>
                    </div>
                    
                    <div>
                        <h4 class="font-semibold text-secondary-400 mb-1">5. Chat & Communicate</h4>
                        <p class="text-sm">Use the chat system to communicate with all players or privately with specific actors.</p>
                    </div>
                </div>
                
                <div class="mt-6 p-4 bg-secondary-500/10 rounded-lg">
                    <h4 class="font-semibold text-secondary-400 mb-2">Game Objective</h4>
                    <p class="text-sm">Create a thriving, sustainable community by balancing individual and collective needs through effective collaboration and resource management.</p>
                </div>
            </div>
        </div>
    {/if}
</div>

<script context="module">
    function getGameStatusIcon(status: GameStatus) {
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
</script>