<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { 
    Menu, 
    Search, 
    ZoomIn, 
    ZoomOut, 
    Plus, 
    User, 
    UserPlus,
    Users,
    MessageSquare,
    Info,
    ChevronDown,
    ChevronUp,
    Maximize
  } from 'lucide-svelte';
  import gameStore, { activeActorId } from '$lib/stores/enhancedGameStore';
  import { userStore } from '$lib/stores/userStore';
  import type { Game, Actor, Card } from '$lib/types';
  import { getCard } from '$lib/services/gameService';
  import { getCardValueNames } from '$lib/services/valueService';
  import { getCardCapabilityNames } from '$lib/services/capabilityService';
  
  // Components
  import GameBoard from '$lib/components/game/GameBoard.svelte';
  import D3GameBoardIntegrated from '$lib/components/game/D3GameBoardIntegrated.svelte';
  import CardBoard from '$lib/components/game/CardBoard.svelte';
  import ChatBox from '$lib/components/ChatBox.svelte';
  import PlayersList from '$lib/components/game/PlayersList.svelte';
  import RoleCard from '$lib/components/RoleCard.svelte';

  // Props
  export let game: Game;
  export let gameId: string;
  export let playerRole: Actor | null = null;
  
  // Local state
  let viewMode: 'actors' | 'cards' = 'cards';
  let leftSidebarOpen = false;
  let rightSidebarOpen = false;
  let currentZoom = 1;
  let searchQuery = '';
  let gameInfoExpanded = false;
  let yourRoleExpanded = false;
  let boardViewExpanded = false;
  let playersExpanded = false;
  let chatExpanded = true;
  
  // Card data for the player role
  let playerCard: Card | null = null;
  let playerCardValues: string[] = [];
  let playerCardCapabilities: string[] = [];
  
  // Using imported getCardValueNames and getCardCapabilityNames from services
  
  // References to sidebar elements for click-outside detection
  let leftSidebarElement: HTMLElement;
  let rightSidebarElement: HTMLElement;
  let leftToggleButton: HTMLElement;
  let rightToggleButton: HTMLElement;
  
  // Handle click outside to close sidebars
  function handleClickOutside(event: MouseEvent) {
    // Check if clicking outside left sidebar
    if (leftSidebarOpen && 
        leftSidebarElement && 
        !leftSidebarElement.contains(event.target as Node) &&
        leftToggleButton && !leftToggleButton.contains(event.target as Node)) {
      leftSidebarOpen = false;
      console.log('Closing left sidebar (clicked outside)');
    }
    
    // Check if clicking outside right sidebar
    if (rightSidebarOpen && 
        rightSidebarElement && 
        !rightSidebarElement.contains(event.target as Node) &&
        rightToggleButton && !rightToggleButton.contains(event.target as Node)) {
      rightSidebarOpen = false;
      console.log('Closing right sidebar (clicked outside)');
    }
  }
  
  onMount(() => {
    // Add global click handler for closing sidebars when clicking outside
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      // Cleanup the event listener on component destroy
      document.removeEventListener('click', handleClickOutside);
    };
  });
  
  // Subscribe to changes in left sidebar state
  $: {
    if (leftSidebarOpen) {
      console.log('Left sidebar is now OPEN');
    } else {
      console.log('Left sidebar is now CLOSED');
    }
  }
  
  // Subscribe to changes in right sidebar state
  $: {
    if (rightSidebarOpen) {
      console.log('Right sidebar is now OPEN');
    } else {
      console.log('Right sidebar is now CLOSED');
    }
  }
  
  // Fetch card data when playerRole changes
  $: {
    async function fetchCardData() {
      if (playerRole && playerRole.card_id) {
        // Fetching card data for player role
        // Get the card data
        playerCard = await getCard(playerRole.card_id);
        
        if (playerCard) {
          // Card data retrieved successfully
          
          // Get the value and capability names
          playerCardValues = await getCardValueNames(playerCard);
          console.log('Retrieved values for card:', playerCardValues);
          
          playerCardCapabilities = await getCardCapabilityNames(playerCard);
          console.log('Retrieved capabilities for card:', playerCardCapabilities);
        } else {
          console.error(`Failed to load card data for card_id: ${playerRole.card_id}`);
          playerCard = null;
          playerCardValues = [];
          playerCardCapabilities = [];
        }
      } else {
        playerCard = null;
        playerCardValues = [];
        playerCardCapabilities = [];
      }
    }
    
    fetchCardData();
  }
  
  // Handle zoom in/out
  function zoomIn() {
    currentZoom = Math.min(currentZoom + 0.2, 2);
    console.log(`Zooming in: ${currentZoom}`);
  }
  
  function zoomOut() {
    currentZoom = Math.max(currentZoom - 0.2, 0.5);
    console.log(`Zooming out: ${currentZoom}`);
  }
  
  function resetZoom() {
    currentZoom = 1;
    console.log('Zoom reset');
  }
  
  function handleSearch() {
    console.log(`Searching for nodes containing: ${searchQuery}`);
    // This will be implemented after we integrate the proper search functionality
    alert(`Search functionality coming soon. You searched for: ${searchQuery}`);
  }
  
  function toggleLeftSidebar() {
    console.log('Toggling left sidebar');
    leftSidebarOpen = !leftSidebarOpen;
  }
  
  function toggleRightSidebar() {
    console.log('Toggling right sidebar');
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

<div class="game-page-layout relative flex flex-col overflow-hidden bg-surface-50-900-token" style="z-index: 10; height: calc(100vh - var(--app-bar-height, 64px))">
  <!-- Left Sidebar Toggle (Always Visible) -->
  <button 
    bind:this={leftToggleButton}
    class="btn-sidebar-toggle absolute top-4 left-4 z-20 bg-surface-200 dark:bg-surface-700 rounded-md p-2 shadow-md border border-surface-300 dark:border-surface-600 hover:bg-surface-300 dark:hover:bg-surface-800 transition-colors" 
    onclick={toggleLeftSidebar}
    aria-label="Toggle left sidebar"
  >
    <Menu size={20} />
  </button>
  
  <!-- Top Search Bar (Matches First Design) -->
  <div class="search-container absolute top-4 left-16 right-16 z-10 flex justify-center">
    <div class="relative flex max-w-md">
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="Search nodes..." 
        class="input pl-4 pr-3 py-2 w-full h-10 rounded-l-md shadow-md border border-surface-300 dark:border-surface-600"
      />
      <button 
        class="bg-surface-200 dark:bg-surface-700 border-y border-r border-surface-300 dark:border-surface-600 px-3 rounded-r-md shadow-md flex items-center justify-center hover:bg-surface-300 dark:hover:bg-surface-800 transition-colors"
        onclick={handleSearch}
        aria-label="Search"
      >
        <Search size={20} />
      </button>
    </div>
  </div>
  
  <!-- Right Controls -->
  <div class="controls-container absolute top-4 right-4 z-20 flex items-center space-x-2">
    <button 
      class="bg-surface-200 dark:bg-surface-700 p-2 rounded-md shadow-md border border-surface-300 dark:border-surface-600 hover:bg-surface-300 dark:hover:bg-surface-800 transition-colors" 
      onclick={zoomOut} 
      aria-label="Zoom out"
    >
      <ZoomOut size={20} />
    </button>
    <button 
      class="bg-surface-200 dark:bg-surface-700 p-2 rounded-md shadow-md border border-surface-300 dark:border-surface-600 hover:bg-surface-300 dark:hover:bg-surface-800 transition-colors" 
      onclick={resetZoom} 
      aria-label="Reset zoom"
    >
      <Maximize size={20} />
    </button>
    <button 
      class="bg-surface-200 dark:bg-surface-700 p-2 rounded-md shadow-md border border-surface-300 dark:border-surface-600 hover:bg-surface-300 dark:hover:bg-surface-800 transition-colors" 
      onclick={zoomIn} 
      aria-label="Zoom in"
    >
      <ZoomIn size={20} />
    </button>
    <button 
      class="bg-primary-500 hover:bg-primary-600 text-white p-2 rounded-md shadow-md border border-primary-600 flex items-center transition-colors" 
      aria-label="New agreement"
    >
      <Plus size={20} />
      <span class="ml-1 mr-1 hidden md:inline">New Agreement</span>
    </button>
    <button 
      bind:this={rightToggleButton}
      class="bg-surface-200 dark:bg-surface-700 p-2 rounded-md shadow-md border border-surface-300 dark:border-surface-600 hover:bg-surface-300 dark:hover:bg-surface-800 transition-colors" 
      onclick={toggleRightSidebar}
      aria-label="Toggle players"
    >
      <Users size={20} />
    </button>
  </div>
  
  <!-- Main Content Area with Sidebars -->
  <div class="main-content-area flex-1 flex relative overflow-hidden pt-16">
    <!-- Left Sidebar (Game Info, Role, View Toggle) -->
    <aside 
      bind:this={leftSidebarElement}
      class="left-sidebar bg-surface-700/90 w-72 shadow-lg absolute inset-y-0 -left-72 transition-all duration-300 z-10 flex flex-col h-full overflow-y-auto"
      class:left-0={leftSidebarOpen}
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
            aria-controls="gameInfoContent"
          >
            <h3 class="h4 flex items-center">
              <Info size={16} class="mr-2" />
              Game Info
            </h3>
            <div class="text-xl">
              {#if gameInfoExpanded}
                <ChevronUp size={20} />
              {:else}
                <ChevronDown size={20} />
              {/if}
            </div>
          </div>
          
          {#if gameInfoExpanded}
            <div class="mt-3 space-y-2" transition:slide={{ duration: 200 }}>
              <div class="grid grid-cols-2 gap-2">
                <div class="text-sm">Status:</div>
                <div class="text-sm font-bold">{game?.status || 'Unknown'}</div>
                
                <div class="text-sm">Game Age:</div>
                <div class="text-sm font-bold">
                  {game ? getFormattedGameAge(game.created_at) : '0 days'}
                </div>
                
                <div class="text-sm">Created:</div>
                <div class="text-sm font-bold">
                  {game ? formatDate(game.created_at) : 'Unknown'}
                </div>
                
                <div class="text-sm">Players:</div>
                <div class="text-sm font-bold">
                  {game?.players ? Object.keys(game.players).length : 0} / {game?.max_players || 10}
                </div>
                
                <div class="text-sm">Deck Type:</div>
                <div class="text-sm font-bold">{game?.deck_type || 'Standard'}</div>
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
            aria-controls="yourRoleContent"
          >
            <h3 class="h4 flex items-center">
              <User size={16} class="mr-2" />
              Your Role Card
            </h3>
            <div class="text-xl">
              {#if yourRoleExpanded}
                <ChevronUp size={20} />
              {:else}
                <ChevronDown size={20} />
              {/if}
            </div>
          </div>
          
          {#if yourRoleExpanded}
            <div class="mt-3" transition:slide={{ duration: 200 }}>
              {#if playerRole}
                <!-- Updated Role Card with new design matching admin deck browser -->
                <div class="card overflow-hidden rounded-md shadow-md bg-surface-200-800/90 border border-surface-300-600">
                  <!-- Card header with gradient background based on category -->
                  <header class="relative p-2 text-white bg-gradient-to-r from-primary-500 to-primary-700 rounded-t-md">
                    <div class="absolute left-2 top-2 bg-surface-900/50 rounded-full p-1">
                      <svelte:component this={User} class="w-5 h-5" />
                    </div>
                    <div class="flex items-center justify-between pl-10">
                      <h3 class="text-base font-bold truncate">
                        {#if playerCard}
                          {playerCard.role_title || 'Unnamed Card'}
                          {#if playerRole.custom_name && playerRole.custom_name !== playerCard.role_title}
                            <span class="text-xs opacity-75">({playerRole.custom_name})</span>
                          {/if}
                        {:else}
                          {playerRole.custom_name || 'Unnamed Role'}
                        {/if}
                      </h3>
                      {#if playerCard && playerCard.card_number}
                        <span class="badge bg-surface-100-800 text-surface-900-50 text-xs px-2 py-0.5 rounded-full">{playerCard.card_number}</span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2 text-xs mt-1 pl-10">
                      {#if playerCard}
                        <span>{playerCard.card_category || 'Card'}</span>
                      {:else}
                        <span>{playerRole.type || 'Actor'}</span>
                      {/if}
                      <span class="badge bg-white/20 text-white ml-auto px-2 py-0.5 rounded-full">{playerRole.actor_type || 'Custom'}</span>
                    </div>
                  </header>
                  
                  <!-- Card body with card details -->
                  <div class="p-2 space-y-2">
                    <!-- Backstory -->
                    {#if playerCard && playerCard.backstory}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Backstory</h4>
                        <p class="text-xs text-surface-900-50">{playerCard.backstory}</p>
                      </div>
                    {/if}
                    
                    <!-- Values -->
                    {#if playerCardValues && playerCardValues.length > 0}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Values</h4>
                        <ul class="list-disc list-inside text-xs text-surface-900-50">
                          {#each playerCardValues as value}
                            <li>{value}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                    
                    <!-- Goals -->
                    {#if playerCard && playerCard.goals}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Goals</h4>
                        <p class="text-xs text-surface-900-50">{playerCard.goals}</p>
                      </div>
                    {/if}
                    
                    <!-- Capabilities -->
                    {#if playerCardCapabilities && playerCardCapabilities.length > 0}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Capabilities</h4>
                        <div class="flex flex-wrap gap-1">
                          {#each playerCardCapabilities as capability}
                            <span class="badge variant-soft-secondary text-xs">{capability}</span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    
                    <!-- Resources -->
                    {#if playerCard && playerCard.rivalrous_resources}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">Resources</h4>
                        <p class="text-xs text-surface-900-50">{playerCard.rivalrous_resources}</p>
                      </div>
                    {/if}
                    
                    <!-- IP -->
                    {#if playerCard && playerCard.intellectual_property}
                      <div>
                        <h4 class="text-xs font-semibold text-surface-700-300">IP</h4>
                        <p class="text-xs text-surface-900-50">{playerCard.intellectual_property}</p>
                      </div>
                    {/if}
                    
                    <!-- Fallback to Actor data if Card data is not available -->
                    {#if !playerCard}
                      {#if playerRole.backstory}
                        <div>
                          <h4 class="text-xs font-semibold text-surface-700-300">Backstory</h4>
                          <p class="text-xs text-surface-900-50">{playerRole.backstory}</p>
                        </div>
                      {/if}
                      
                      {#if playerRole.values && playerRole.values.length > 0}
                        <div>
                          <h4 class="text-xs font-semibold text-surface-700-300">Values</h4>
                          <ul class="list-disc list-inside text-xs text-surface-900-50">
                            {#each playerRole.values as value}
                              <li>{value}</li>
                            {/each}
                          </ul>
                        </div>
                      {/if}
                      
                      {#if playerRole.capabilities && playerRole.capabilities.length > 0}
                        <div>
                          <h4 class="text-xs font-semibold text-surface-700-300">Capabilities</h4>
                          <div class="flex flex-wrap gap-1">
                            {#each playerRole.capabilities as capability}
                              <span class="badge variant-soft-secondary text-xs">{capability}</span>
                            {/each}
                          </div>
                        </div>
                      {/if}
                      
                      {#if playerRole.rivalrous_resources}
                        <div>
                          <h4 class="text-xs font-semibold text-surface-700-300">Resources</h4>
                          <p class="text-xs text-surface-900-50">{playerRole.rivalrous_resources}</p>
                        </div>
                      {/if}
                      
                      {#if playerRole.intellectual_property}
                        <div>
                          <h4 class="text-xs font-semibold text-surface-700-300">IP</h4>
                          <p class="text-xs text-surface-900-50">{playerRole.intellectual_property}</p>
                        </div>
                      {/if}
                    {/if}
                  </div>
                </div>
              {:else}
                <div class="card p-4 bg-surface-200-800/90 border border-surface-300-600 text-center">
                  <svelte:component this={User} class="w-12 h-12 mx-auto mb-3 text-surface-500-400" />
                  <h3 class="text-base font-bold text-surface-900-50 mb-2">No Role Card Assigned</h3>
                  <p class="text-xs text-surface-700-300 mb-4">Join this game to select a role card and start playing</p>
                  <a href="/games/{gameId}/join" class="btn btn-sm variant-filled-primary w-full">
                    <svelte:component this={UserPlus} class="w-4 h-4 mr-2" />
                    Join Game
                  </a>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        
        <!-- Board View Section -->
        <div class="card p-3">
          <div 
            class="flex justify-between items-center cursor-pointer" 
            onclick={() => boardViewExpanded = !boardViewExpanded}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); 
                boardViewExpanded = !boardViewExpanded;
              }
            }} 
            role="button"
            tabindex="0"
            aria-expanded={boardViewExpanded}
            aria-controls="boardViewContent"
          >
            <h3 class="h4">Board View</h3>
            <div class="text-xl">
              {#if boardViewExpanded}
                <ChevronUp size={20} />
              {:else}
                <ChevronDown size={20} />
              {/if}
            </div>
          </div>
          
          {#if boardViewExpanded}
            <div class="mt-3 grid grid-cols-2 gap-2" transition:slide={{ duration: 200 }}>
              <button 
                class="btn btn-sm {viewMode === 'actors' ? 'variant-filled-primary' : 'variant-ghost'}"
                onclick={() => viewMode = 'actors'}
              >
                Actor View
              </button>
              <button 
                class="btn btn-sm {viewMode === 'cards' ? 'variant-filled-primary' : 'variant-ghost'}"
                onclick={() => viewMode = 'cards'}
              >
                Card View
              </button>
            </div>
          {/if}
        </div>
      </div>
    </aside>
    
    <!-- Main Board Visualization -->
    <main class="flex-1 overflow-hidden" style="transform: scale({currentZoom}); transform-origin: center center;">
      {#if viewMode === 'actors'}
        <GameBoard {gameId} activeActorId={playerRole?.actor_id} />
      {:else}
        <CardBoard {gameId} activeActorId={playerRole?.actor_id} />
      {/if}
    </main>
    
    <!-- Right Sidebar (Players and Chat) -->
    <aside 
      bind:this={rightSidebarElement}
      class="right-sidebar bg-surface-700/90 w-72 shadow-lg absolute inset-y-0 -right-72 transition-all duration-300 z-10 flex flex-col h-full overflow-y-auto"
      class:right-0={rightSidebarOpen}
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
            aria-controls="playersContent"
          >
            <h3 class="h4 flex items-center">
              <Users size={16} class="mr-2" />
              Players
            </h3>
            <div class="text-xl">
              {#if playersExpanded}
                <ChevronUp size={20} />
              {:else}
                <ChevronDown size={20} />
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
            aria-controls="chatContent"
          >
            <h3 class="h4 flex items-center">
              <MessageSquare size={16} class="mr-2" />
              Group Chat
            </h3>
            <div class="text-xl">
              {#if chatExpanded}
                <ChevronUp size={20} />
              {:else}
                <ChevronDown size={20} />
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
</div>

<style>
  .game-page-layout {
    --sidebar-width: 18rem;
    background-color: rgb(var(--color-surface-900) / 0.1);
  }
  
  .left-sidebar, .right-sidebar {
    width: var(--sidebar-width);
    max-width: 90vw;
    top: 0; /* Make sure sidebars start from the very top */
    bottom: 0; /* Ensure sidebars extend to bottom */
    height: 100% !important; /* Force full height */
    z-index: 50 !important; /* Higher z-index to ensure they appear above other elements */
  }
  
  .left-sidebar {
    left: calc(-1 * var(--sidebar-width));
  }
  
  .left-sidebar.left-0 {
    left: 0 !important;
  }
  
  .right-sidebar {
    right: calc(-1 * var(--sidebar-width));
  }
  
  .right-sidebar.right-0 {
    right: 0 !important;
  }
  
  .main-content-area {
    transition: all 0.3s ease;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
  }
</style>