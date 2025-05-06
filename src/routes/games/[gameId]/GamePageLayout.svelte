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

    // Props
    const { game, gameId, playerRole, content } = $props<{
        game: Game;
        gameId: string;
        playerRole: ActorWithCard;
        content?: typeof SvelteComponent<any>;
    }>();

    // State
    let leftSidebarOpen = $state(false);
    let rightSidebarOpen = $state(false);
    let currentZoom = $state(1);
    let searchQuery = $state('');
    let gameInfoExpanded = $state(false);
    let yourRoleExpanded = $state(false);
    let playersExpanded = $state(false);
    let chatExpanded = $state(true);

    // DOM references
    let leftSidebarElement = $state<HTMLElement | null>(null);
    let rightSidebarElement = $state<HTMLElement | null>(null);
    let leftToggleButton = $state<HTMLElement | null>(null);
    let rightToggleButton = $state<HTMLElement | null>(null);

    // Handle click outside to close sidebars
    function handleClickOutside(event: MouseEvent) {
        if (leftSidebarOpen && 
            leftSidebarElement && 
            !leftSidebarElement.contains(event.target as Node) &&
            leftToggleButton && 
            !leftToggleButton.contains(event.target as Node)) {
            leftSidebarOpen = false;
        }

        if (rightSidebarOpen && 
            rightSidebarElement && 
            !rightSidebarElement.contains(event.target as Node) &&
            rightToggleButton && 
            !rightToggleButton.contains(event.target as Node)) {
            rightSidebarOpen = false;
        }
    }

    // Setup document event listeners
    $effect(() => {
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    });

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
        leftSidebarOpen = !leftSidebarOpen;
    }

    function toggleRightSidebar() {
        rightSidebarOpen = !rightSidebarOpen;
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

<div class="game-page-layout relative flex flex-col overflow-hidden bg-surface-100-800" style="height: calc(100vh - var(--app-bar-height, 64px))">
    <!-- Left Sidebar Toggle -->
    <button 
        bind:this={leftToggleButton}
        class="btn absolute top-4 left-4 z-50 bg-surface-200 rounded-md p-2 shadow-md border border-surface-300 hover:bg-surface-300 transition-colors" 
        onclick={toggleLeftSidebar}
        aria-label="Toggle left sidebar"
    >
        <icons.Menu size={20} />
    </button>

    <!-- Search Bar -->
    <div class="absolute top-4 left-16 right-16 z-10 flex justify-center">
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

    <!-- Right Controls -->
    <div class="absolute top-4 right-4 z-50 flex items-center space-x-2">
        <button 
            class="btn variant-filled-surface p-2"
            onclick={zoomOut} 
            aria-label="Zoom out"
        >
            <icons.ZoomOut size={20} />
        </button>
        <button 
            class="btn variant-filled-surface p-2"
            onclick={resetZoom} 
            aria-label="Reset zoom"
        >
            <icons.Maximize size={20} />
        </button>
        <button 
            class="btn variant-filled-surface p-2"
            onclick={zoomIn} 
            aria-label="Zoom in"
        >
            <icons.ZoomIn size={20} />
        </button>
        <button 
            class="btn variant-filled-primary flex items-center"
            onclick={() => goto(`/games/${gameId}/agreements`)}
            aria-label="New agreement"
        >
            <icons.Plus size={20} class="mr-2" />
            <span class="hidden md:inline">New Agreement</span>
        </button>
        <button 
            bind:this={rightToggleButton}
            class="btn variant-filled-surface p-2"
            onclick={toggleRightSidebar}
            aria-label="Toggle players"
        >
            <icons.Users size={20} />
        </button>
    </div>

    <!-- Main Content Area with Sidebars -->
    <div class="flex-1 flex relative overflow-hidden pt-16">
        <!-- Main D3 Visualization Area -->
        <div class="flex-1 relative" style="transition: margin 0.3s ease-in-out;"
             class:ml-72={leftSidebarOpen}
             class:mr-72={rightSidebarOpen}>
            <D3CardBoard {gameId} activeActorId={playerRole?.actor_id} />
        </div>
    </div>
    
    <!-- Overlays (placed outside of the main content to ensure they appear on top) -->
    
    <!-- Left Sidebar Overlay -->
    <div class="fixed inset-0 bg-black/30 z-30" 
         class:hidden={!leftSidebarOpen}
         onclick={toggleLeftSidebar}></div>
         
    <!-- Right Sidebar Overlay -->
    <div class="fixed inset-0 bg-black/30 z-30" 
         class:hidden={!rightSidebarOpen}
         onclick={toggleRightSidebar}></div>
    
    <!-- Left Sidebar -->
    <aside 
        bind:this={leftSidebarElement}
        class="fixed top-0 bottom-0 -left-72 w-72 max-w-[90vw] bg-surface-100-800 shadow-xl z-40 
               transition-all duration-300 overflow-y-auto"
        class:left-0={leftSidebarOpen}
        style="margin-top: var(--app-bar-height, 64px); height: calc(100vh - var(--app-bar-height, 64px));"
    >
        <div class="p-4 flex-1 space-y-4">
            <!-- Game Info Section -->
            <div class="card p-3">
                <div 
                    class="flex justify-between items-center cursor-pointer" 
                    onclick={() => gameInfoExpanded = !gameInfoExpanded}
                    onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault(); 
                            gameInfoExpanded = !gameInfoExpanded;
                        }
                    }} 
                    role="button"
                    tabindex="0"
                    aria-expanded={gameInfoExpanded}
                >
                    <h3 class="h4 flex items-center">
                        <icons.Info size={16} class="mr-2" />
                        Game Info
                    </h3>
                    <div>
                        {#if gameInfoExpanded}
                            <icons.ChevronUp size={20} />
                        {:else}
                            <icons.ChevronDown size={20} />
                        {/if}
                    </div>
                </div>

                {#if gameInfoExpanded}
                    <div class="mt-3 space-y-2" transition:slide={{ duration: 200 }}>
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
                {/if}
            </div>

            <!-- Your Role Card Section -->
            <div class="card p-3">
                <div 
                    class="flex justify-between items-center cursor-pointer" 
                    onclick={() => yourRoleExpanded = !yourRoleExpanded}
                    onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault(); 
                            yourRoleExpanded = !yourRoleExpanded;
                        }
                    }} 
                    role="button"
                    tabindex="0"
                    aria-expanded={yourRoleExpanded}
                >
                    <h3 class="h4 flex items-center">
                        <icons.User size={16} class="mr-2" />
                        Your Role Card
                    </h3>
                    <div>
                        {#if yourRoleExpanded}
                            <icons.ChevronUp size={20} />
                        {:else}
                            <icons.ChevronDown size={20} />
                        {/if}
                    </div>
                </div>

                {#if yourRoleExpanded}
                    <div class="mt-3" transition:slide={{ duration: 200 }}>
                        {#if playerRole.card}
                            <div class="card overflow-hidden rounded-md shadow-md bg-surface-200 border border-surface-300">
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

                                    {#if playerRole.card.intellectual_property}
                                        <div>
                                            <h4 class="text-xs font-semibold text-surface-700">IP</h4>
                                            <p class="text-xs text-surface-900">{playerRole.card.intellectual_property}</p>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {:else}
                            <div class="card p-4 bg-surface-200 border border-surface-300 text-center">
                                <icons.User class="w-12 h-12 mx-auto mb-3 text-surface-500" />
                                <h3 class="text-base font-bold text-surface-900 mb-2">No Role Card Assigned</h3>
                                <p class="text-xs text-surface-700 mb-4">Join this game to select a role card and start playing</p>
                                <button class="btn btn-sm variant-filled-primary w-full" onclick={() => goto(`/games/${gameId}/details`)}>
                                    <icons.UserPlus class="w-4 h-4 mr-2" />
                                    Join Game
                                </button>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </aside>

    <!-- Right Sidebar -->
    <aside 
        bind:this={rightSidebarElement}
        class="fixed top-0 bottom-0 -right-72 w-72 max-w-[90vw] bg-surface-100-800 shadow-xl z-40 
               transition-all duration-300 overflow-y-auto"
        class:right-0={rightSidebarOpen}
        style="margin-top: var(--app-bar-height, 64px); height: calc(100vh - var(--app-bar-height, 64px));"
    >
        <div class="p-4 flex-1 space-y-4">
            <!-- Players List Section -->
            <div class="card p-3">
                <div 
                    class="flex justify-between items-center cursor-pointer" 
                    onclick={() => playersExpanded = !playersExpanded}
                    onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault(); 
                            playersExpanded = !playersExpanded;
                        }
                    }} 
                    role="button"
                    tabindex="0"
                    aria-expanded={playersExpanded}
                >
                    <h3 class="h4 flex items-center">
                        <icons.Users size={16} class="mr-2" />
                        Players
                    </h3>
                    <div>
                        {#if playersExpanded}
                            <icons.ChevronUp size={20} />
                        {:else}
                            <icons.ChevronDown size={20} />
                        {/if}
                    </div>
                </div>

                {#if playersExpanded}
                    <div class="mt-3" transition:slide={{ duration: 200 }}>
                        <PlayersList 
                            {game} 
                            highlightCurrentUser={true} 
                            currentUserId={$userStore.user?.user_id || null} 
                            compact={true}
                        />
                    </div>
                {/if}
            </div>

            <!-- Chat Section -->
            <div class="card p-3 flex-1 flex flex-col">
                <div 
                    class="flex justify-between items-center cursor-pointer" 
                    onclick={() => chatExpanded = !chatExpanded}
                    onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault(); 
                            chatExpanded = !chatExpanded;
                        }
                    }} 
                    role="button"
                    tabindex="0"
                    aria-expanded={chatExpanded}
                >
                    <h3 class="h4 flex items-center">
                        <icons.MessageSquare size={16} class="mr-2" />
                        Group Chat
                    </h3>
                    <div>
                        {#if chatExpanded}
                            <icons.ChevronUp size={20} />
                        {:else}
                            <icons.ChevronDown size={20} />
                        {/if}
                    </div>
                </div>

                {#if chatExpanded}
                    <div class="mt-3 flex-1 flex flex-col" transition:slide={{ duration: 200 }}>
                        <div class="chat-container h-64 flex-1">
                            <ChatBox {gameId} chatType="group" compact={true} />
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </aside>
</div>

