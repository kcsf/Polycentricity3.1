<script lang="ts">
    import { goto } from '$app/navigation';
    import { userStore, setError } from '$lib/stores/userStore';
    import { joinGame, leaveGame } from '$lib/services/gameService';
    import type { Game } from '$lib/types';
    import { GameStatus } from '$lib/types';
    import {
      Calendar,
      Users,
      LayoutGrid,
      SwitchCamera,
      LogIn,
      LogOut,
      UserPlus,
      Info,
      Crown,
      Play,
      Pause,
      CheckCircle,
      Settings,
      Sparkles
    } from '@lucide/svelte';
  
    const { game, showActions = true } = $props<{ game: Game; showActions?: boolean }>();
  
    let isJoining = $state(false);
    let isLeaving = $state(false);
    let actionError = $state('');

    // Computed properties
    const playerCount = $derived(Object.keys(game.players || {}).length);
    const isFull = $derived(game.max_players && playerCount >= game.max_players);
    const isUserInGame = $derived($userStore.user && game.players && $userStore.user.user_id in game.players);
    const canJoin = $derived(!isUserInGame && !isFull && game.status === GameStatus.ACTIVE);
    const isCreator = $derived($userStore.user && game.creator_ref === $userStore.user.user_id);
    const roleAssignmentDisplay = $derived(
      game.role_assignment_type
        ? (game.role_assignment_type === 'player-choice' ? 'Player Choice' : 'Random')
        : 'Random'
    );
    const deckTypeDisplay = $derived(
      ({
        'eco-village': 'Eco-Village',
        'community-garden': 'Community Garden',
        custom: 'Custom Deck'
      } as Record<string, string>)[game.deck_type] || game.deck_type
    );
    const createdDate = $derived(
      new Date(game.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    );
  
    function getStatusBadgeVariant(status: GameStatus): string {
      switch (status) {
        case GameStatus.CREATED:
          return 'bg-blue-500/20 text-blue-500';
        case GameStatus.SETUP:
          return 'bg-yellow-500/20 text-yellow-500';
        case GameStatus.ACTIVE:
          return 'bg-green-500/20 text-green-500';
        case GameStatus.PAUSED:
          return 'bg-purple-500/20 text-purple-500';
        case GameStatus.COMPLETED:
          return 'bg-gray-500/20 text-gray-500';
        default:
          return 'bg-blue-500/20 text-blue-500';
      }
    }
  
    const statusIcons: Record<GameStatus, typeof Sparkles> = {
      [GameStatus.CREATED]: Sparkles,
      [GameStatus.SETUP]: Settings,
      [GameStatus.ACTIVE]: Play,
      [GameStatus.PAUSED]: Pause,
      [GameStatus.COMPLETED]: CheckCircle
    };
  
    function getDaysSinceCreation(): string {
      const now = new Date();
      const created = new Date(game.created_at);
      const diffTime = Math.abs(now.getTime() - created.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays} days ago`;
    }
  
    async function enterGame() {
        console.log(`[GameCard] Entering game with gameId: ${game.game_id}`);
        if (!game.game_id) {
            console.error(`[GameCard] gameId is undefined for game:`, game);
            actionError = 'Invalid game ID. Please try again.';
            setError(actionError);
            goto('/games');
            return;
        }
        try {
            await goto(`/games/${game.game_id}`);
        } catch (err) {
            console.error('Error navigating to game:', err);
            actionError = 'Failed to navigate to game. Please try again.';
            setError(actionError);
        }
    }
  
    async function handleJoinGame() {
        console.log(`[GameCard] Joining game with gameId: ${game.game_id}`);
        if (!game.game_id) {
            console.error(`[GameCard] gameId is undefined for game:`, game);
            actionError = 'Invalid game ID. Please try again.';
            setError(actionError);
            goto('/games');
            return;
        }
        if (!$userStore.user) {
            await goto('/login');
            return;
        }
  
        try {
            isJoining = true;
            actionError = '';
            const success = await joinGame(game.game_id);
            if (success) {
                await goto(`/games/${game.game_id}/details`);
            } else {
                actionError = 'Failed to join game. Please try again.';
                setError(actionError);
            }
        } catch (err) {
            console.error('Error joining game:', err);
            actionError = 'Failed to join game. Please try again.';
            setError(actionError);
        } finally {
            isJoining = false;
        }
    }
  
    async function handleLeaveGame() {
        console.log(`[GameCard] Leaving game with gameId: ${game.game_id}`);
        if (!game.game_id) {
            console.error(`[GameCard] gameId is undefined for game:`, game);
            actionError = 'Invalid game ID. Please try again.';
            setError(actionError);
            goto('/games');
            return;
        }
        if (!$userStore.user) {
            await goto('/login');
            return;
        }
  
        try {
            isLeaving = true;
            actionError = '';
            const success = await leaveGame(game.game_id);
            if (success) {
                window.location.reload(); // Reload for fresh data
            } else {
                actionError = 'Failed to leave game. Please try again.';
                setError(actionError);
            }
        } catch (err) {
            console.error('Error leaving game:', err);
            actionError = 'Failed to leave game. Please try again.';
            setError(actionError);
        } finally {
            isLeaving = false;
        }
    }

    async function handleViewDetails() {
        console.log(`[GameCard] Viewing details for gameId: ${game.game_id}`);
        if (!game.game_id) {
            console.error(`[GameCard] gameId is undefined for game:`, game);
            actionError = 'Invalid game ID. Please try again.';
            setError(actionError);
            goto('/games');
            return;
        }
        try {
            await goto(`/games/${game.game_id}/details`);
        } catch (err) {
            console.error('Error navigating to game details:', err);
            actionError = 'Failed to navigate to game details. Please try again.';
            setError(actionError);
        }
    }
</script>
  
<div class="card bg-surface-50-950/90 shadow-lg hover:shadow-xl transition-all duration-200 hover:translate-y-[-2px] flex flex-col h-full">
    <!-- Game Banner & Header -->
    <div class="relative p-5 border-b border-surface-300-600-token bg-surface-100-800-token">
        <!-- Status Badge -->
        <div class="absolute top-3 right-3 flex items-center gap-2">
            <span class="badge flex items-center" class:variant-soft-primary={game.status === GameStatus.CREATED}
                  class:variant-soft-warning={game.status === GameStatus.SETUP}
                  class:variant-soft-success={game.status === GameStatus.ACTIVE}
                  class:variant-soft-tertiary={game.status === GameStatus.PAUSED}
                  class:variant-soft-surface={game.status === GameStatus.COMPLETED}>
                {#if game.status === GameStatus.CREATED}
                    <Sparkles size={14} class="mr-1" />
                {:else if game.status === GameStatus.SETUP}
                    <Settings size={14} class="mr-1" />
                {:else if game.status === GameStatus.ACTIVE}
                    <Play size={14} class="mr-1" />
                {:else if game.status === GameStatus.PAUSED}
                    <Pause size={14} class="mr-1" />
                {:else if game.status === GameStatus.COMPLETED}
                    <CheckCircle size={14} class="mr-1" />
                {:else}
                    <Sparkles size={14} class="mr-1" />
                {/if}
                {game.status}
            </span>
            {#if isCreator}
                <span class="badge variant-soft-warning flex items-center">
                    <Crown size={14} class="mr-1" />
                    Creator
                </span>
            {/if}
        </div>
  
        <!-- Game Title -->
        <h3 class="h3 pr-16">{game.name}</h3>
  
        <!-- Date & Players Info -->
        <div class="flex flex-wrap justify-between items-center mt-3 text-xs opacity-75">
            <div class="flex items-center">
                <Calendar size={14} class="mr-1" />
                <span class="mr-1">{createdDate}</span>
                <span class="opacity-75">({getDaysSinceCreation()})</span>
            </div>
            <div class="flex items-center mt-1 sm:mt-0">
                <Users size={14} class="mr-1" />
                <span>
                    {playerCount} {game.max_players ? `/ ${game.max_players}` : 'players'}
                </span>
                {#if isFull}
                    <span class="ml-2 badge variant-filled-error text-xs">Full</span>
                {/if}
            </div>
        </div>
    </div>
  
    <!-- Game Details Section -->
    <div class="p-5 flex-grow flex flex-col">
        <!-- Game Properties -->
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="flex flex-col">
                <p class="text-xs font-semibold opacity-75 mb-1">Deck Type</p>
                <div class="flex items-center">
                    <LayoutGrid size={16} class="mr-2 opacity-75" />
                    <p class="text-sm capitalize">{deckTypeDisplay}</p>
                </div>
            </div>
            <div class="flex flex-col">
                <p class="text-xs font-semibold opacity-75 mb-1">Role Assignment</p>
                <div class="flex items-center">
                    <SwitchCamera size={16} class="mr-2 opacity-75" />
                    <p class="text-sm">{roleAssignmentDisplay}</p>
                </div>
            </div>
        </div>
  
        <!-- Game Description -->
        {#if game.description}
            <div class="mb-4">
                <p class="text-xs font-semibold opacity-75 mb-1">Description</p>
                <p class="text-sm opacity-90">{game.description}</p>
            </div>
        {/if}
  
        <!-- Spacer -->
        <div class="flex-grow"></div>
  
        <!-- Action Buttons -->
        {#if showActions}
            <div class="flex flex-col sm:flex-row gap-2 mt-3">
                {#if isUserInGame}
                    <button
                        class="btn flex-1 preset-filled-primary"
                        onclick={enterGame}
                    >
                        <LogIn size={18} class="inline mr-2" />
                        Enter Game
                    </button>
                    {#if !isCreator}
                        <button
                            class="btn flex-1 preset-filled-error"
                            onclick={handleLeaveGame}
                            disabled={isLeaving}
                        >
                            {#if isLeaving}
                                <svg class="animate-spin w-4 h-4 inline mr-2" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                </svg>
                                Leaving...
                            {:else}
                                <LogOut size={18} class="inline mr-2" />
                                Leave
                            {/if}
                        </button>
                    {/if}
                {:else if game.status === GameStatus.ACTIVE}
                    <button
                        class="btn flex-1 preset-filled-success"
                        onclick={handleJoinGame}
                        disabled={isJoining || isFull}
                    >
                        {#if isJoining}
                            <svg class="animate-spin w-4 h-4 inline mr-2" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                            </svg>
                            Joining...
                        {:else}
                            <UserPlus size={18} class="inline mr-2" />
                            Join Game
                        {/if}
                    </button>
                    <button
                        class="btn flex-1 preset-tonal-surface"
                        onclick={handleViewDetails}
                    >
                        <Info size={18} class="inline mr-2" />
                        Details
                    </button>
                {:else}
                    <button
                        class="btn flex-1 preset-tonal-primary"
                        onclick={handleViewDetails}
                    >
                        <Info size={18} class="inline mr-2" />
                        View Details
                    </button>
                {/if}
            </div>
        {/if}
    </div>
  
    {#if actionError}
        <div class="p-3 bg-red-500/10 border-t border-red-500/20 text-red-500 text-sm text-center">
            {actionError}
        </div>
    {/if}
</div>