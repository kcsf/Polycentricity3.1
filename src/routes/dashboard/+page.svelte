<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  import { userGamesStore, setUserGames } from '$lib/stores/gameStore';
  import { getAllGames } from '$lib/services/gameService';
  import { getCollection, get, getSet, getField, nodes } from '$lib/services/gunService';
  import type { Actor, Game } from '$lib/types';
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
  const gamesCreated = derived(userGamesStore, gs =>
    gs.filter(g => g._isUserCreated === true).length
  );
  const gamesJoined = derived(userGamesStore, gs =>
    gs.filter(g => !g._isPlaceholder).length
  );

  // fetch user's actors
  async function fetchUserActors(): Promise<Actor[]> {
    if (!$userStore.user) return [];
    const userId = $userStore.user.user_id;
    try {
      const actorRefs = await getSet(`${nodes.users}/${userId}`, "actors_ref");
      if (actorRefs.length > 0) {
        const userActors = await Promise.all(
          actorRefs.map(async ref => {
            const actorId = ref.split('/').pop()!;
            return await get<Actor>(`${nodes.actors}/${actorId}`);
          })
        );
        return userActors.filter((a): a is Actor => !!a);
      }
      const allActors = await getCollection<Actor>(nodes.actors);
      return allActors.filter(a => a.user_ref === userId);
    } catch {
      return [];
    }
  }

  // fetch user's games (now accepts the `actors` array to detect actor‐joins)
  async function fetchUserGames(actors: Actor[]): Promise<Game[]> {
    if (!$userStore.user) return [];
    const userId = $userStore.user.user_id;
    const allGames = await getAllGames();

    // load their game‐refs
    const gameRefsRaw = await getSet(`${nodes.users}/${userId}`, "games_ref");
    const gameRefIds = gameRefsRaw.map(r => r.split('/').pop()!).filter(id => !!id);

    const candidateGames = await Promise.all(
      allGames.map(async game => {
        const isCreator = game.creator_ref === userId;
        const isPlayer = game.players?.[userId] === true;
        const isInRefs = gameRefIds.includes(game.game_id);

        // did they join via an actor?
        const hasActorInGame = actors.some(a => a.games_ref?.[game.game_id]);

        // did they join via the player_actor_map?
        const pamRaw = (await getField<Record<string, any>>(
          `${nodes.games}/${game.game_id}`,
          "player_actor_map"
        )) || {};
        const isInPam = pamRaw[userId] != null;

        return {
          ...game,
          _isUserCreated: isCreator,
          _included: isCreator || isPlayer || isInRefs || isInPam || hasActorInGame,
        };
      })
    );

    return candidateGames.filter(g => g._included);
  }

  // calculate cards owned
  async function calculateCardsOwned(userActors: Actor[]): Promise<number> {
    try {
      const counts = await Promise.all(
        userActors.map(a => {
          const m = a.cards_by_game || {};
          return Object.values(m).filter(id => !!id).length;
        })
      );
      return counts.reduce((sum, x) => sum + x, 0);
    } catch {
      return 0;
    }
  }

  // load everything
  async function loadDashboard() {
    if (!$userStore.user) return;
    isLoading = true;
    try {
      actors = await fetchUserActors();
      const userGames = await fetchUserGames(actors);
      cardsOwnedCount = await calculateCardsOwned(actors);
      setUserGames(userGames);
    } catch (e) {
      console.error('[Dashboard] load error', e);
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

  onMount(() => { /* no-op */ });

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
              <!-- Since games in userGamesStore are already filtered for user membership, 
                   pass isUserGame=true to force "Enter Game" button -->
                <GameCard {game} showActions={true} />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Modals -->
  <ProfileUpdateModal 
    open={profileModalOpen} 
    onclose={() => profileModalOpen = false}
  />
  <ActorEditModal bind:open={actorEditModalOpen} bind:actor={selectedActor} />
</div>