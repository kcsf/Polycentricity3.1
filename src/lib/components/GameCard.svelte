<script lang="ts">
    import { goto } from '$app/navigation';
    import { userStore, setError } from '$lib/stores/userStore';
    import { joinGame, leaveGame, deleteGame } from '$lib/services/gameService';
    import { userGamesStore, setUserGames } from '$lib/stores/gameStore';
    import { getSet, getField, nodes } from '$lib/services/gunService';
    import type { Game, Actor } from '$lib/types';
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
      Sparkles,
      Trash2
    } from '@lucide/svelte';

    const { game, showActions = true, isUserGame = false } = $props<{
      game: Game;
      showActions?: boolean;
      isUserGame?: boolean;
    }>();

    let isJoining = $state(false);
    let isLeaving = $state(false);
    let isDeleting = $state(false);
    let actionError = $state('');
    let userActors = $state<string[]>([]);
    let gameActors = $state<string[]>([]);
    let isInPlayerActorMap = $state(false);
    let hasActorInGame = $state(false);

   // Count actors from game.actors_ref, mirroring the original structure
    const playerCount = $derived(Object.keys(game.actors_ref || {}).length);
    const isFull = $derived(game.max_players && playerCount >= game.max_players);

    // Simplify isCreator to avoid TypeScript warning
    const isCreator = $derived(
      Boolean($userStore.user && game.creator_ref === $userStore.user.user_id)
    );
    const isInPlayersList = $derived(
      Boolean($userStore.user && game.players?.[$userStore.user.user_id] === true)
    );

    // Fetch user’s actors and check game association
    async function fetchUserGameStatus() {
      if (!$userStore.user) {
        isInPlayerActorMap = false;
        hasActorInGame = false;
        return;
      }

      const userId = $userStore.user.user_id;

      try {
        // Load user’s actor IDs
        const actorRefs = await getSet(`${nodes.users}/${userId}`, "actors_ref");
        userActors = actorRefs.map(ref =>
          ref.includes("/") ? ref.split("/").pop()! : ref
        ).filter(id => id);
        console.log(`[GameCard] User ${userId} actors:`, userActors);

        // Load player_actor_map and check for non-null entry
        const pamRaw = (await getField<Record<string, string | null>>(
          `${nodes.games}/${game.game_id}`,
          "player_actor_map"
        )) || {};
        isInPlayerActorMap = pamRaw[userId] != null;
        console.log(
          `[GameCard] Game ${game.game_id} - isInPlayerActorMap: ${isInPlayerActorMap}`
        );

        // Load game’s actors_ref and check for user’s actors
        const gameActorRefs = await getSet(`${nodes.games}/${game.game_id}`, "actors_ref");
        const gameActorIds = gameActorRefs.map(ref =>
          ref.includes("/") ? ref.split("/").pop()! : ref
        ).filter(id => id);
        gameActors = gameActorIds;
        hasActorInGame = userActors.some(aid => gameActorIds.includes(aid));
        console.log(
          `[GameCard] Game ${game.game_id} - hasActorInGame: ${hasActorInGame}`
        );
      } catch (err) {
        console.error(
          `[GameCard] Error fetching user game status for ${game.game_id}:`,
          err
        );
        isInPlayerActorMap = false;
        hasActorInGame = false;
      }
    }

    // Run async fetch when user or game changes
    $effect(() => {
      if ($userStore.user && game.game_id) {
        fetchUserGameStatus();
      }
    });

    // Explicitly evaluate derived values as booleans
    const isUserInGame = $derived(
      isCreator ||
      isInPlayersList ||
      isInPlayerActorMap ||
      hasActorInGame ||
      isUserGame
    );

    const canJoin = $derived(
      !isUserInGame && !isFull && game.status === GameStatus.ACTIVE
    );

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
        return;
      }
      if (!$userStore.user) {
        actionError = 'Please log in to leave the game.';
        setError(actionError);
        await goto('/login');
        return;
      }

      try {
        isLeaving = true;
        actionError = '';
        const success = await leaveGame(game.game_id);
        if (success) {
          const updated = $userGamesStore.filter(g => g.game_id !== game.game_id);
          setUserGames(updated);
          await goto('/dashboard');
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

    async function handleDeleteGame() {
      if (!confirm(`Are you sure you want to delete "${game.name}"? This action cannot be undone.`)) {
        return;
      }

      console.log(`[GameCard] Deleting game with gameId: ${game.game_id}`);
      if (!game.game_id) {
        console.error(`[GameCard] gameId is undefined for game:`, game);
        actionError = 'Invalid game ID. Please try again.';
        setError(actionError);
        return;
      }
      if (!$userStore.user) {
        actionError = 'Please log in to delete the game.';
        setError(actionError);
        await goto('/login');
        return;
      }

      try {
        isDeleting = true;
        actionError = '';
        const success = await deleteGame(game.game_id);
        if (success) {
          console.log(`Successfully deleted game: ${game.game_id}`);
          // Refresh the page to reload the games list
          window.location.reload();
        } else {
          actionError = 'Failed to delete game. Please try again.';
          setError(actionError);
        }
      } catch (err) {
        console.error('Error deleting game:', err);
        actionError = 'Failed to delete game. Please try again.';
        setError(actionError);
      } finally {
        isDeleting = false;
      }
    }
</script>

<div class="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200 flex flex-col h-full">
    <!-- Game Banner & Header -->
    <div class="relative bg-gray-100 dark:bg-gray-700 p-5 border-b border-gray-200 dark:border-gray-600">
        <!-- Status Badge -->
        <div class="absolute top-3 right-3 flex items-center gap-2">
            <span class="inline-flex items-center px-2 py-1 rounded text-sm font-medium {getStatusBadgeVariant(game.status)}">
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
                {/if}
                {game.status}
            </span>
            {#if isCreator}
                <span class="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-yellow-500/20 text-yellow-500">
                    <Crown size={14} class="mr-1" />
                    Creator
                </span>
            {/if}
        </div>

        <!-- Game Title -->
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 pr-16">{game.name}</h3>

        <!-- Date & Players Info -->
        <div class="flex flex-wrap justify-between items-center mt-3 text-xs text-gray-600 dark:text-gray-400">
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
                    <span class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-500">Full</span>
                {/if}
            </div>
        </div>
    </div>

    <!-- Game Details Section -->
    <div class="p-5 flex-grow flex flex-col">
        <!-- Game Properties -->
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="flex flex-col">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Deck Type</p>
                <div class="flex items-center">
                    <LayoutGrid size={16} class="mr-2 text-gray-500" />
                    <p class="text-sm text-gray-900 dark:text-gray-100 capitalize">{deckTypeDisplay}</p>
                </div>
            </div>
            <div class="flex flex-col">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Role Assignment</p>
                <div class="flex items-center">
                    <SwitchCamera size={16} class="mr-2 text-gray-500" />
                    <p class="text-sm text-gray-900 dark:text-gray-100">{roleAssignmentDisplay}</p>
                </div>
            </div>
        </div>

        <!-- Game Description -->
        {#if game.description}
            <div class="mb-4">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Description</p>
                <p class="text-sm text-gray-700 dark:text-gray-300">{game.description}</p>
            </div>
        {/if}

        <!-- Spacer -->
        <div class="flex-grow"></div>

        <!-- Action Buttons -->
        {#if showActions}
            <div class="flex flex-col sm:flex-row gap-2 mt-3">
                {#if isUserInGame}
                    <button
                        class="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                        onclick={enterGame}
                    >
                        <LogIn size={18} class="inline mr-2" />
                        Enter Game
                    </button>
                    {#if !isCreator}
                        <button
                            class="flex-1 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
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
                    {:else}
                        <button
                            class="flex-1 bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                            onclick={handleDeleteGame}
                            disabled={isDeleting}
                        >
                            {#if isDeleting}
                                <svg class="animate-spin w-4 h-4 inline mr-2" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                </svg>
                                Deleting...
                            {:else}
                                <Trash2 size={18} class="inline mr-2" />
                                Delete Game
                            {/if}
                        </button>
                    {/if}
                {:else if game.status === GameStatus.ACTIVE}
                    <button
                        class="flex-1 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
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
                        class="flex-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded"
                        onclick={handleViewDetails}
                    >
                        <Info size={18} class="inline mr-2" />
                        Details
                    </button>
                {:else}
                    <button
                        class="flex-1 border border-blue-500 hover:bg-blue-500/10 text-blue-500 font-bold py-2 px-4 rounded"
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