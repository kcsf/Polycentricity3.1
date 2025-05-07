<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  import { userGamesStore, setUserGames } from '$lib/stores/gameStore';
  import { getAllGames, getGame } from '$lib/services/gameService';
  import { getCollection, get, getSet, nodes } from '$lib/services/gunService';
  import type { Actor, Game, Card } from '$lib/types';
  import * as icons from '@lucide/svelte';
  import UserCard from '$lib/components/UserCard.svelte';
  import GameCard from '$lib/components/GameCard.svelte';
  import ProfileUpdateModal from '$lib/components/ProfileUpdateModal.svelte';
  import ActorEditModal from '$lib/components/ActorEditModal.svelte';
  import { derived } from 'svelte/store';

  // local component state
  let isLoading = $state(true);
  let actors = $state<Actor[]>([]);
  let profileModalOpen = $state(false);
  let actorEditModalOpen = $state(false);
  let selectedActor = $state<Actor | null>(null);
  let cardsOwnedCount = $state(0);

  // derive stores for metrics display
  const gamesCreated = derived(userGamesStore, (gs) => {
    return gs.filter(g => g.creator_ref === $userStore.user?.user_id).length;
  });

  const gamesJoined = derived(userGamesStore, (gs) => {
    return gs.length;
  });

  /**
   * Enhanced function to fetch user's actors with optimal performance
   * Uses Gun's reference sets to get actors connected to the user
   */
  async function fetchUserActors(): Promise<Actor[]> {
    if (!$userStore.user) return [];
    const userId = $userStore.user.user_id;
    
    try {
      // First check if user has actors_ref set
      const actorRefs = await getSet(`${nodes.users}/${userId}`, "actors_ref");
      console.log(`[Dashboard] Found ${actorRefs.length} actor references for user ${userId}`);
      
      // If user has actor references, fetch those specific actors
      if (actorRefs.length > 0) {
        const userActors = await Promise.all(
          actorRefs.map(async (ref) => {
            // Extract actor ID from reference path
            const actorId = ref.includes('/') ? ref.split('/').pop()! : ref;
            return await get<Actor>(`${nodes.actors}/${actorId}`);
          })
        );
        // Filter out any nulls from failed fetches
        return userActors.filter((actor): actor is Actor => actor !== null);
      }
      
      // Fallback: query all actors and filter by user reference
      const allActors = await getCollection<Actor>(nodes.actors);
      return allActors.filter(actor => actor.user_ref === userId);
    } catch (error) {
      console.error('[Dashboard] Error fetching user actors:', error);
      return [];
    }
  }

  /**
   * Enhanced function to fetch user's games with proper player references
   * Uses both creator_ref and players map for accurate game listing
   */
  async function fetchUserGames(): Promise<Game[]> {
    if (!$userStore.user) return [];
    const userId = $userStore.user.user_id;
    
    try {
      // Get all games for evaluation
      const allGames = await getAllGames();
      console.log(`[Dashboard] Found ${allGames.length} total games`);
      
      // First check user's games_ref set if available
      const gameRefs = await getSet(`${nodes.users}/${userId}`, "games_ref");
      console.log(`[Dashboard] Found ${gameRefs.length} game references for user ${userId}`);
      
      // Return games where:
      // 1. User is the creator, OR
      // 2. User is in the players map, OR
      // 3. Game is in the user's games_ref set, OR
      // 4. User has an actor in this game
      const userGames = allGames.filter(game => 
        game.creator_ref === userId || 
        (game.players && game.players[userId]) ||
        gameRefs.some(ref => {
          const gameId = ref.includes('/') ? ref.split('/').pop()! : ref;
          return gameId === game.game_id;
        }) ||
        actors.some(a => a.game_ref === game.game_id)
      );
      
      console.log(`[Dashboard] Filtered to ${userGames.length} user games`);
      return userGames;
    } catch (error) {
      console.error('[Dashboard] Error fetching user games:', error);
      return [];
    }
  }
  
  /**
   * Enhanced function to calculate accurate card ownership count
   * Checks both direct card_ref and cards_by_game map
   */
  async function calculateCardsOwned(userActors: Actor[]): Promise<number> {
    try {
      // Count cards owned directly through card_ref
      const directCardRefs = userActors.filter(a => !!a.card_ref).length;
      
      // Get cards from cards_by_game maps
      const cardsFromMap = await Promise.all(
        userActors.map(async (actor) => {
          if (!actor.cards_by_game) return 0;
          // Count valid card references
          const cardIds = Object.values(actor.cards_by_game).filter(id => !!id);
          return cardIds.length;
        })
      );
      
      const totalCardsFromMap = cardsFromMap.reduce((sum, count) => sum + count, 0);
      const total = Math.max(directCardRefs, totalCardsFromMap);
      
      console.log(`[Dashboard] Found ${total} cards owned by user's actors`);
      return total;
    } catch (error) {
      console.error('[Dashboard] Error calculating cards owned:', error);
      return 0;
    }
  }

  // load everything in parallel with enhanced relationship detection
  async function loadDashboard() {
    if (!$userStore.user) return;
    isLoading = true;

    try {
      // First load actors to establish relationships
      actors = await fetchUserActors();
      console.log(`[Dashboard] Loaded ${actors.length} actors for user ${$userStore.user.user_id}`);
      
      // Then load games using enhanced detection with actor relationships
      const userGames = await fetchUserGames();
      console.log(`[Dashboard] Loaded ${userGames.length} games for user ${$userStore.user.user_id}`);
      
      // Calculate cards owned for metrics display
      cardsOwnedCount = await calculateCardsOwned(actors);
      
      // Update game store
      setUserGames(userGames);
    } catch (error) {
      console.error('[Dashboard] Error loading dashboard:', error);
    } finally {
      isLoading = false;
    }
  }

  // react to auth state
  $effect(() => {
    if ($userStore.user?.user_id) {
      loadDashboard();
    } else if (!$userStore.isLoading) {
      goto('/login');
    }
  });

  onMount(() => {
    /* nothing to clean up */
  });

  function openProfileUpdateModal() {
    profileModalOpen = true;
  }

  function openActorEditModal(actor: Actor) {
    selectedActor = actor;
    actorEditModalOpen = true;
  }
</script>

<div class="container mx-auto px-4 py-6">
  <!-- Profile header with stats -->
  {#if $userStore.user}
    <div class="mb-8">
      <UserCard 
        user={$userStore.user} 
        showDetails={true}
        onUpdateProfile={openProfileUpdateModal}
      />
    </div>
  {/if}

  <!-- Stats -->
  <div class="card overflow-hidden shadow-sm mb-8">
    <div class="grid grid-cols-1 divide-y border-t sm:grid-cols-4 sm:divide-x sm:divide-y-0">
      <div class="px-6 py-5 text-center">
        <div class="flex flex-col items-center">
          <icons.Gamepad2 size={20} class="mb-2 text-primary-500" />
          <span class="text-xl font-medium text-surface-900-50">{$gamesJoined}</span>
          <span class="text-sm text-surface-600-300">Games Joined</span>
        </div>
      </div>
      
      <div class="px-6 py-5 text-center">
        <div class="flex flex-col items-center">
          <icons.FileCode size={20} class="mb-2 text-secondary-500" />
          <span class="text-xl font-medium text-surface-900-50">{$gamesCreated}</span>
          <span class="text-sm text-surface-600-300">Games Created</span>
        </div>
      </div>
      
      <div class="px-6 py-5 text-center">
        <div class="flex flex-col items-center">
          <icons.User size={20} class="mb-2 text-tertiary-500" />
          <span class="text-xl font-medium text-surface-900-50">{actors.length}</span>
          <span class="text-sm text-surface-600-300">Actors</span>
        </div>
      </div>
      
      <div class="px-6 py-5 text-center">
        <div class="flex flex-col items-center">
          <icons.CreditCard size={20} class="mb-2 text-success-500" />
          <span class="text-xl font-medium text-surface-900-50">{cardsOwnedCount}</span>
          <span class="text-sm text-surface-600-300">Cards Owned</span>
        </div>
      </div>
    </div>
  </div>

  {#if isLoading}
    <div class="text-center py-8">
      <icons.Loader size={32} class="animate-spin mx-auto mb-4" />
      Loading dashboard...
    </div>
  {:else}
    <div class="grid md:grid-cols-4 gap-6">
      <!-- Actors list -->
      <div class="md:col-span-1 space-y-4">
        <h2 class="h3">Your Actors</h2>
        {#if actors.length === 0}
          <div class="text-center p-6 border rounded">
            <icons.User size={48} class="mx-auto mb-2 opacity-50" />
            <p>No actors yet. Join a game to get assigned.</p>
          </div>
        {:else}
          {#each actors as actor}
            <div class="card p-4 flex justify-between items-center">
              <div>
                <div class="font-bold">{actor.custom_name || 'Unnamed'}</div>
                <div class="text-xs opacity-70">Type: {actor.actor_type}</div>
              </div>
              <button
                class="btn-icon variant-soft-tertiary"
                title="Edit actor"
                onclick={() => openActorEditModal(actor)}
              >
                <icons.Pencil size={16} />
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Games list -->
      <div class="md:col-span-3 space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="h3">Your Games</h2>
          <div class="flex gap-2">
            <a href="/games" class="btn variant-filled-secondary">
              <icons.Search size={16} class="mr-1" /> Browse
            </a>
            <a href="/games/create" class="btn variant-filled-secondary">
              <icons.Plus size={16} class="mr-1" /> Create
            </a>
          </div>
        </div>

        {#if $userGamesStore.length === 0}
          <div class="text-center p-10 border rounded">
            <icons.Gamepad2 size={64} class="mx-auto mb-4 opacity-50" />
            <p>You haven't joined or created any games yet.</p>
            <div class="mt-4 flex justify-center gap-2">
              <a href="/games" class="btn variant-filled-primary">
                <icons.Search size={16} class="mr-1" /> Find Games
              </a>
              <a href="/games/create" class="btn variant-filled-primary">
                <icons.Plus size={16} class="mr-1" /> New Game
              </a>
            </div>
          </div>
        {:else}
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each $userGamesStore as game (game.game_id)}
              <GameCard {game} />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Modals -->
  <ProfileUpdateModal 
    open={profileModalOpen} 
    on:update:open={(e) => profileModalOpen = e.detail} 
  />
  <ActorEditModal bind:open={actorEditModalOpen} bind:actor={selectedActor} />
</div>