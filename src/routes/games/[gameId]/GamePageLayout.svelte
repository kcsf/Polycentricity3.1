<script lang="ts">
    import { goto } from '$app/navigation';
    import { fade, slide } from 'svelte/transition';
    import * as icons from '@lucide/svelte';
    import { userStore } from '$lib/stores/userStore';
    import type { Game, ActorWithCard } from '$lib/types';
    import ChatBox from '$lib/components/ChatBox.svelte';
    import PlayersList from '$lib/components/game/PlayersList.svelte';
    import type { ComponentProps, SvelteComponent } from 'svelte';
    import D3CardBoard from '$lib/components/game/D3CardBoard.svelte';
    import { Navigation } from '@skeletonlabs/skeleton-svelte';

    // Props
    const { game, gameId, playerRole, content } = $props<{
        game: Game;
        gameId: string;
        playerRole: ActorWithCard;
        content?: typeof SvelteComponent<any>;
    }>();

    // State
    let leftExpanded = $state(false);
    let rightExpanded = $state(false);
    let currentZoom = $state(1);
    let searchQuery = $state('');
    let gameInfoExpanded = $state(true);
    let yourRoleExpanded = $state(true);
    let playersExpanded = $state(true);
    let chatExpanded = $state(true);

    // Zoom controls
    function zoomIn() {
        currentZoom = Math.min(currentZoom + 0.2, 2);
    }

    function zoomOut() {
        currentZoom = Math.max(currentZoom - 0.2, 0.5);
    }

    function resetZoom() {
        currentZoom = 1;
    }

    function handleSearch() {
        alert(`Search functionality coming soon. You searched for: ${searchQuery}`);
    }

    function toggleLeftSidebar() {
        leftExpanded = !leftExpanded;
    }

    function toggleRightSidebar() {
        rightExpanded = !rightExpanded;
    }

    function formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleDateString();
    }

    function getFormattedGameAge(createdAt: number): string {
        const now = Date.now();
        const diffInDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        return `${diffInDays} days`;
    }
</script>

<div class="game-page-layout flex h-[calc(100vh-var(--app-bar-height,64px))] bg-surface-100-800-token overflow-hidden">
    <!-- Left Navigation Rail - Game Info & Player Role -->
    <Navigation.Rail expanded={leftExpanded} 
                     header={
                         <Navigation.Tile labelExpanded="Game Menu" title="Toggle Menu Width" onclick={toggleLeftSidebar}>
                             <icons.Menu />
                         </Navigation.Tile>
                     }>
        
        <!-- Game Info Section -->
        <Navigation.Tile labelExpanded="Game Info" active={gameInfoExpanded} 
                        onclick={() => gameInfoExpanded = !gameInfoExpanded}>
            <icons.Info />
        </Navigation.Tile>
        
        {#if gameInfoExpanded}
            <div class="px-4 py-2 space-y-2" transition:slide={{ duration: 200 }}>
                <div class="card p-3 bg-surface-200">
                    <div class="grid grid-cols-2 gap-2">
                        <div class="text-sm">Status:</div>
                        <div class="text-sm font-bold">{game.status || 'Unknown'}</div>
                        <div class="text-sm">Game Age:</div>
                        <div class="text-sm font-bold">{getFormattedGameAge(game.created_at)}</div>
                        <div class="text-sm">Created:</div>
                        <div class="text-sm font-bold">{formatDate(game.created_at)}</div>
                        <div class="text-sm">Players:</div>
                        <div class="text-sm font-bold">{Object.keys(game.players || {}).length}/{game.max_players || 10}</div>
                        <div class="text-sm">Deck Type:</div>
                        <div class="text-sm font-bold">{game.deck_type || 'Standard'}</div>
                    </div>
                </div>
            </div>
        {/if}
        
        <!-- Role Card Section -->
        <Navigation.Tile labelExpanded="Your Role Card" active={yourRoleExpanded} 
                        onclick={() => yourRoleExpanded = !yourRoleExpanded}>
            <icons.User />
        </Navigation.Tile>
        
        {#if yourRoleExpanded}
            <div class="px-4 py-2" transition:slide={{ duration: 200 }}>
                {#if playerRole?.card}
                    <div class="card overflow-hidden rounded-md shadow-md bg-surface-200">
                        <header class="relative p-2 text-white bg-gradient-to-r from-primary-500 to-primary-700 rounded-t-md">
                            <div class="absolute left-2 top-2 bg-surface-900/50 rounded-full p-1">
                                <icons.User class="w-5 h-5" />
                            </div>
                            <div class="flex items-center justify-between pl-10">
                                <h3 class="text-base font-bold truncate">
                                    {playerRole.card.role_title || 'Unnamed Card'}
                                    {#if playerRole.custom_name && playerRole.custom_name !== playerRole.card.role_title}
                                        <span class="text-xs opacity-75">({playerRole.custom_name})</span>
                                    {/if}
                                </h3>
                                {#if playerRole.card.card_number}
                                    <span class="badge bg-surface-100 text-surface-900 text-xs px-2 py-0.5 rounded-full">{playerRole.card.card_number}</span>
                                {/if}
                            </div>
                            <div class="flex items-center gap-2 text-xs mt-1 pl-10">
                                <span>{playerRole.card.card_category || 'Card'}</span>
                                <span class="badge bg-white/20 text-white ml-auto px-2 py-0.5 rounded-full">{playerRole.actor_type || 'Custom'}</span>
                            </div>
                        </header>

                        <div class="p-2 space-y-2">
                            {#if playerRole.card.backstory}
                                <div>
                                    <h4 class="text-xs font-semibold text-surface-700">Backstory</h4>
                                    <p class="text-xs text-surface-900">{playerRole.card.backstory}</p>
                                </div>
                            {/if}

                            {#if playerRole.card._valueNames && playerRole.card._valueNames.length > 0}
                                <div>
                                    <h4 class="text-xs font-semibold text-surface-700">Values</h4>
                                    <ul class="list-disc list-inside text-xs text-surface-900">
                                        {#each playerRole.card._valueNames as value}
                                            <li>{value}</li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}

                            {#if playerRole.card.goals}
                                <div>
                                    <h4 class="text-xs font-semibold text-surface-700">Goals</h4>
                                    <p class="text-xs text-surface-900">{playerRole.card.goals}</p>
                                </div>
                            {/if}

                            {#if playerRole.card._capabilityNames && playerRole.card._capabilityNames.length > 0}
                                <div>
                                    <h4 class="text-xs font-semibold text-surface-700">Capabilities</h4>
                                    <div class="flex flex-wrap gap-1">
                                        {#each playerRole.card._capabilityNames as capability}
                                            <span class="badge variant-soft-secondary text-xs">{capability}</span>
                                        {/each}
                                    </div>
                                </div>
                            {/if}

                            {#if playerRole.card.resources}
                                <div>
                                    <h4 class="text-xs font-semibold text-surface-700">Resources</h4>
                                    <p class="text-xs text-surface-900">{playerRole.card.resources}</p>
                                </div>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="card p-4 bg-surface-200 text-center">
                        <icons.User class="w-12 h-12 mx-auto mb-3 text-surface-500" />
                        <h3 class="text-base font-bold text-surface-900 mb-2">No Role Card Assigned</h3>
                        <p class="text-xs text-surface-700 mb-4">Join this game to select a role card</p>
                        <button class="btn btn-sm variant-filled-primary w-full" onclick={() => goto(`/games/${gameId}/details`)}>
                            <icons.UserPlus class="w-4 h-4 mr-2" />
                            Join Game
                        </button>
                    </div>
                {/if}
            </div>
        {/if}
    </Navigation.Rail>

    <!-- Main Content Area -->
    <div class="flex-1 relative overflow-hidden">
        <!-- Top Controls -->
        <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex justify-center">
            <div class="relative flex max-w-md">
                <input 
                    type="text" 
                    bind:value={searchQuery}
                    placeholder="Search nodes..." 
                    class="input pl-4 pr-3 py-2 w-full h-10 rounded-l-md shadow-md border border-surface-300"
                />
                <button 
                    class="btn variant-filled-primary rounded-l-none px-3"
                    onclick={handleSearch}
                    aria-label="Search"
                >
                    <icons.Search size={20} />
                </button>
            </div>
        </div>
        
        <!-- Zoom Controls -->
        <div class="absolute top-4 right-20 z-10 flex items-center space-x-1">
            <button 
                class="btn variant-filled-surface p-2 !rounded-md"
                onclick={zoomOut} 
                aria-label="Zoom out"
            >
                <icons.ZoomOut size={18} />
            </button>
            <button 
                class="btn variant-filled-surface p-2 !rounded-md"
                onclick={resetZoom} 
                aria-label="Reset zoom"
            >
                <icons.Maximize size={18} />
            </button>
            <button 
                class="btn variant-filled-surface p-2 !rounded-md"
                onclick={zoomIn} 
                aria-label="Zoom in"
            >
                <icons.ZoomIn size={18} />
            </button>
        </div>
        
        <!-- New Agreement Button -->
        <div class="absolute top-14 right-4 z-10">
            <button 
                class="btn variant-filled-primary"
                onclick={() => goto(`/games/${gameId}/agreements`)}
            >
                <icons.Plus size={18} class="mr-2" />
                New Agreement
            </button>
        </div>
        
        <!-- D3 Visualization -->
        <div class="w-full h-full pt-20">
            <D3CardBoard {gameId} activeActorId={playerRole?.actor_id} />
        </div>
    </div>

    <!-- Right Navigation Rail - Players & Chat -->
    <Navigation.Rail expanded={rightExpanded} position="right"
                     header={
                         <Navigation.Tile labelExpanded="Players" title="Toggle Players Menu" onclick={toggleRightSidebar}>
                             <icons.Users />
                         </Navigation.Tile>
                     }>
        
        <!-- Players List Section -->
        <Navigation.Tile labelExpanded="Player List" active={playersExpanded} 
                        onclick={() => playersExpanded = !playersExpanded}>
            <icons.UsersRound />
        </Navigation.Tile>
        
        {#if playersExpanded}
            <div class="px-4 py-2" transition:slide={{ duration: 200 }}>
                <div class="card p-2 bg-surface-200">
                    <PlayersList 
                        {game} 
                        highlightCurrentUser={true} 
                        currentUserId={$userStore.user?.user_id || null} 
                        compact={true}
                    />
                </div>
            </div>
        {/if}
        
        <!-- Chat Section -->
        <Navigation.Tile labelExpanded="Group Chat" active={chatExpanded} 
                        onclick={() => chatExpanded = !chatExpanded}>
            <icons.MessageSquare />
        </Navigation.Tile>
        
        {#if chatExpanded}
            <div class="px-4 py-2 flex-1" transition:slide={{ duration: 200 }}>
                <div class="card p-2 bg-surface-200 flex flex-col h-64">
                    <ChatBox {gameId} chatType="group" compact={true} />
                </div>
            </div>
        {/if}
    </Navigation.Rail>
</div>

