<script lang="ts">
    import { goto } from '$app/navigation';
    import { fade, slide } from 'svelte/transition';
    import * as icons from '@lucide/svelte';
    import { userStore } from '$lib/stores/userStore';
    import { subscribeToLastActive } from '$lib/services/userService';
    import { updateAgreement } from '$lib/services/gameService';
    import type { Game, ActorWithCard } from '$lib/types';
    import ChatBox from '$lib/components/ChatBox.svelte';
    import PlayersList from '$lib/components/game/PlayersList.svelte';
    import type { ComponentProps, SvelteComponent } from 'svelte';
    import D3CardBoard from '$lib/components/game/D3CardBoard.svelte';
    import AgreementModal from '$lib/components/AgreementModal.svelte';
    import { onMount, onDestroy } from 'svelte';

   // Props
   const { game, gameId, playerRole, gameContext, content, actors } = $props<{
    game: Game;
    gameId: string;
    playerRole: ActorWithCard;
    gameContext: GameContext;
    content?: typeof SvelteComponent<any>;
    actors: ActorWithCard[];
  }>();

  // Local reactive presence map
  let presenceMap = $state<Record<string, boolean>>({});
  // Hold unsubscribe functions
  const unsubs: (() => void)[] = [];

  onMount(() => {
    actors.forEach((actor: ActorWithCard) => {
      const uid = actor.user_ref;
      if (!uid) return;            // skip if null
      presenceMap[uid] = false;     // start offline

      const unsub = subscribeToLastActive(uid, (ts: number) => {
        presenceMap[uid] = Date.now() - ts < 5 * 60_000;
      });
      unsubs.push(unsub);
    });
  });

  onDestroy(() => {
    unsubs.forEach((fn) => fn());
  });

    // References
    let agreementModal: { openModal: () => void } | undefined;

    // State
    let leftExpanded = $state(false);
    let rightExpanded = $state(false);
    let searchQuery = $state('');
    let gameInfoExpanded = $state(false);
    let agreementsExpanded = $state(false);
    let yourRoleExpanded = $state(false);
    let playersExpanded = $state(false);
    let chatExpanded = $state(false);

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

    // Handle agreement status change
    async function handleStatusChange(agreementId: string, newStatus: string) {
        try {
            console.log(`[GamePageLayout] Updating agreement ${agreementId} status to: ${newStatus}`);
            await updateAgreement(agreementId, { status: newStatus });
            console.log(`[GamePageLayout] Successfully updated agreement ${agreementId} status to: ${newStatus}`);
        } catch (error) {
            console.error(`[GamePageLayout] Failed to update agreement status:`, error);
        }
    }



</script>

<div class="game-page-layout flex h-[calc(100vh-var(--app-bar-height,64px))] bg-surface-100-900 overflow-hidden">
    <!-- Left Navigation Rail - Game Info & Player Role -->
    <div class="h-full border-r border-surface-300-700 bg-surface-50-950 flex flex-col {leftExpanded ? 'w-64' : 'w-0'} transition-all duration-200 overflow-hidden">
        <!-- Header with hamburger menu -->
        <div class="p-3 flex justify-between items-center border-b border-surface-300-700">
            <button class="btn btn-sm variant-soft-surface p-2" onclick={toggleLeftSidebar}>
                <icons.Menu class="w-5 h-5" />
            </button>
            {#if leftExpanded}
                <span class="font-semibold">Game Menu</span>
            {/if}
        </div>
        
        <!-- Main navigation items -->
        <div class="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <!-- Game Info Section -->
            <button 
                class="flex items-center gap-3 p-3 hover:bg-primary-500/20 transition-colors {gameInfoExpanded ? 'bg-primary-500/20' : ''}" 
                onclick={() => gameInfoExpanded = !gameInfoExpanded}
            >
                <div class="flex-shrink-0">
                    <icons.Info class="w-5 h-5" />
                </div>
                {#if leftExpanded}
                    <span class="text-sm font-medium">Game Info</span>
                {/if}
            </button>
            
            {#if gameInfoExpanded}
                <div class="px-4 py-2 space-y-2" transition:slide={{ duration: 200 }}>
                    <div class="card p-3 bg-surface-200-800">
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
            
            <!-- Agreements Section -->
            <button 
                class="flex items-center gap-3 p-3 hover:bg-primary-500/20 transition-colors {agreementsExpanded ? 'bg-primary-500/20' : ''}" 
                onclick={() => agreementsExpanded = !agreementsExpanded}
            >
                <div class="flex-shrink-0">
                    <icons.FileText class="w-5 h-5" />
                </div>
                {#if leftExpanded}
                    <span class="text-sm font-medium">Agreements</span>
                {/if}
            </button>
            
            {#if agreementsExpanded}
                <div class="px-4 py-2 space-y-2" transition:slide={{ duration: 200 }}>
                    {#if gameContext?.agreements && playerRole}
                        {@const playerAgreements = gameContext.agreements.filter(agreement => {
                            // Check if partyItems exists and contains the actor
                            if (agreement.partyItems && Array.isArray(agreement.partyItems)) {
                                return agreement.partyItems.some(party => party.actorId === playerRole.actor_id);
                            }
                            // Fallback: check if parties is an array and contains the actor
                            if (Array.isArray(agreement.parties)) {
                                return agreement.parties.includes(playerRole.actor_id);
                            }
                            return false;
                        })}
                        
                        {#if playerAgreements.length > 0}
                            {#each playerAgreements as agreement}
                                <div class="card p-3 bg-surface-200-800 border border-surface-300-600">
                                    <div class="flex flex-col space-y-1">
                                        <h4 class="text-sm font-semibold text-surface-900-50 truncate">
                                            {agreement.title || 'Untitled Agreement'}
                                        </h4>
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-surface-700-300">Status:</span>
                                            <select 
                                                class="select text-xs px-2 py-1 bg-surface-300-700 border border-surface-400-600 rounded"
                                                value={agreement.status || 'proposed'}
                                                onchange={(e) => handleStatusChange(agreement.agreement_id, e.target.value)}
                                            >
                                                <option value="proposed">proposed</option>
                                                <option value="active">active</option>
                                                <option value="pending">pending</option>
                                                <option value="rejected">rejected</option>
                                                <option value="completed">completed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        {:else}
                            <div class="card p-3 bg-surface-200-800 text-center">
                                <p class="text-xs text-surface-600-400">No agreements involving your actor yet.</p>
                            </div>
                        {/if}
                    {:else}
                        <div class="card p-3 bg-surface-200-800 text-center">
                            <p class="text-xs text-surface-600-400">Loading agreements...</p>
                        </div>
                    {/if}
                </div>
            {/if}
            
            <!-- Role Card Section -->
            <button 
                class="flex items-center gap-3 p-3 hover:bg-primary-500/20 transition-colors {yourRoleExpanded ? 'bg-primary-500/20' : ''}" 
                onclick={() => yourRoleExpanded = !yourRoleExpanded}
            >
                <div class="flex-shrink-0">
                    <icons.User class="w-5 h-5" />
                </div>
                {#if leftExpanded}
                    <span class="text-sm font-medium">Your Role Card</span>
                {/if}
            </button>
                
            {#if yourRoleExpanded}
                <div class="px-4 py-2" transition:slide={{ duration: 200 }}>
                    {#if playerRole?.card}
                        <div class="card overflow-hidden rounded-md shadow-md bg-surface-200-800">
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
                                        <h4 class="text-xs font-semibold text-surface-700-300">Backstory</h4>
                                        <p class="text-xs text-surface-900-50">{playerRole.card.backstory}</p>
                                    </div>
                                {/if}

                                {#if playerRole.card._valueNames && playerRole.card._valueNames.length > 0}
                                    <div>
                                        <h4 class="text-xs font-semibold text-surface-700-300">Values</h4>
                                        <ul class="list-disc list-inside text-xs text-surface-900-50">
                                            {#each playerRole.card._valueNames as value}
                                                <li>{value}</li>
                                            {/each}
                                        </ul>
                                    </div>
                                {/if}

                                {#if playerRole.card.goals}
                                    <div>
                                        <h4 class="text-xs font-semibold text-surface-700-300">Goals</h4>
                                        <p class="text-xs text-surface-900-50">{playerRole.card.goals}</p>
                                    </div>
                                {/if}

                                {#if playerRole.card._capabilityNames && playerRole.card._capabilityNames.length > 0}
                                    <div>
                                        <h4 class="text-xs font-semibold text-surface-700-300">Capabilities</h4>
                                        <div class="flex flex-wrap gap-1">
                                            {#each playerRole.card._capabilityNames as capability}
                                                <span class="badge variant-soft-secondary text-xs">{capability}</span>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}

                                {#if playerRole.card.resources}
                                    <div>
                                        <h4 class="text-xs font-semibold text-surface-700-300">Resources</h4>
                                        <p class="text-xs text-surface-900-50">{playerRole.card.resources}</p>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {:else}
                        <div class="card p-4 bg-surface-200-800 text-center">
                            <icons.User class="w-12 h-12 mx-auto mb-3 text-surface-500" />
                            <h3 class="text-base font-bold text-surface-900-50 mb-2">No Role Card Assigned</h3>
                            <p class="text-xs text-surface-700-300 mb-4">Join this game to select a role card</p>
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

    <!-- Main Content Area -->
    <div class="flex-1 relative overflow-hidden">
        <!-- Floating sidebar toggle buttons (visible when sidebars are closed) -->
        {#if !leftExpanded}
            <button 
                class="absolute left-4 top-4 z-20 btn btn-sm variant-filled p-2 rounded-full shadow-xl"
                onclick={toggleLeftSidebar}
            >
                <icons.Menu class="w-5 h-5" />
            </button>
        {/if}
        
        {#if !rightExpanded}
            <button 
                class="absolute right-4 top-4 z-20 btn btn-sm variant-filled p-2 rounded-full shadow-xl"
                onclick={toggleRightSidebar}
            >
                <icons.Users class="w-5 h-5" />
            </button>
        {/if}
        
        <!-- Top Controls - Search Bar -->
        <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex justify-center">
            <div class="relative flex max-w-md">
                <input 
                    type="text" 
                    bind:value={searchQuery}
                    placeholder="Search nodes..." 
                    class="input pl-4 pr-3 py-2 w-full h-10 rounded-l-md shadow-md border border-surface-300-700"
                />
                <button 
                    class="btn preset-filled-primary-500 rounded-l-none px-3"
                    onclick={handleSearch}
                    aria-label="Search"
                >
                    <icons.Search size={20} />
                </button>
            </div>
        </div>
        
        <!-- New Agreement Button - Positioned to avoid sidebar overlap -->
        <div class="absolute top-4 {!rightExpanded ? 'right-20' : 'right-10'} z-10">
            <button 
                class="btn preset-filled-primary-500 flex items-center gap-2 shadow-lg"
                onclick={() => agreementModal?.openModal()}
            >
                <icons.Plus size={18} class="mr-2" />
                New Agreement
            </button>
        </div>
        
        <!-- D3 Visualization -->
        <div class="w-full h-full pt-20">
            <D3CardBoard {gameId} {gameContext} activeActorId={playerRole?.actor_id} />
        </div>
    </div>

    <!-- Right Navigation Rail - Players & Chat -->
    <div class="h-full border-l border-surface-300-700 bg-surface-50-950 flex flex-col {rightExpanded ? 'w-64' : 'w-0'} transition-all duration-200 overflow-hidden">
        <!-- Header with players icon -->
        <div class="p-3 flex justify-between items-center border-b border-surface-300-700">
            {#if rightExpanded}
                <span class="font-semibold">Players</span>
            {/if}
            <button class="btn btn-sm variant-soft-surface p-2 ml-auto" onclick={toggleRightSidebar}>
                <icons.Users class="w-5 h-5" />
            </button>
        </div>
        
        <!-- Main navigation items -->
        <div class="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <!-- Players List Section -->
            <button 
                class="flex items-center gap-3 p-3 hover:bg-primary-500/20 transition-colors {playersExpanded ? 'bg-primary-500/20' : ''}" 
                onclick={() => playersExpanded = !playersExpanded}
            >
                <div class="flex-shrink-0">
                    <icons.UsersRound class="w-5 h-5" />
                </div>
                {#if rightExpanded}
                    <span class="text-sm font-medium">Player List</span>
                {/if}
            </button>
            
            {#if playersExpanded}
                <div class="px-4 py-2" transition:slide={{ duration: 200 }}>
                    <div class="card p-2 bg-surface-200-800">
                        <PlayersList 
                            {game}
                            actorsList={actors}
                            presenceMap={presenceMap}
                            highlightCurrentUser={true} 
                            currentUserId={$userStore.user?.user_id || null} 
                            compact={true}
                        />
                    </div>
                </div>
            {/if}
            
            <!-- Chat Section -->
            <button 
                class="flex items-center gap-3 p-3 hover:bg-primary-500/20 transition-colors {chatExpanded ? 'bg-primary-500/20' : ''}" 
                onclick={() => chatExpanded = !chatExpanded}
            >
                <div class="flex-shrink-0">
                    <icons.MessageSquare class="w-5 h-5" />
                </div>
                {#if rightExpanded}
                    <span class="text-sm font-medium">Group Chat</span>
                {/if}
            </button>
            
            {#if chatExpanded}
                <div class="px-4 py-2 flex-1" transition:slide={{ duration: 200 }}>
                    <div class="card p-2 bg-surface-200-800 flex flex-col h-64">
                        <ChatBox {gameId} chatType="group" compact={true} />
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>

<!-- Agreement Modal -->
<AgreementModal 
    {gameId} 
    actorsList={actors}
    currentActorId={playerRole.actor_id}
    bind:this={agreementModal}
/>

