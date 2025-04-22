<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  import { userGamesStore, setUserGames } from '$lib/stores/gameStore';
  import { getUserActors, getAllGames } from '$lib/services/gameService';
  import type { Actor, Game } from '$lib/types';
  import * as icons from '@lucide/svelte';
  import UserCard from '$lib/components/UserCard.svelte';
  import GameCard from '$lib/components/GameCard.svelte';
  import ProfileUpdateModal from '$lib/components/ProfileUpdateModal.svelte';
  import ActorEditModal from '$lib/components/ActorEditModal.svelte';
  import { derived } from 'svelte/store'; // Import derived from svelte/store

  // local component state
  let isLoading = $state(true);
  let actors = $state<Actor[]>([]);
  let profileModalOpen = $state(false);
  let actorEditModalOpen = $state(false);
  let selectedActor = $state<Actor | null>(null);

  // derive stores
  const gamesCreated = derived(userGamesStore, (gs) => {
    return gs.filter(g => g.creator_ref === $userStore.user?.user_id).length;
  });

  const gamesJoined = derived(userGamesStore, (gs) => {
    return gs.length;
  });

  // load everything in parallel
  async function loadDashboard() {
    if (!$userStore.user) return;
    isLoading = true;

    const [userActors, allGames] = await Promise.all([
      getUserActors(),
      getAllGames()
    ]);

    actors = userActors;

    // build list of this user’s games
    const userGames: Game[] = allGames.filter(
      g =>
        g.creator_ref === $userStore.user!.user_id ||
        userActors.some(a => a.game_ref === g.game_id)
    );

    setUserGames(userGames);
    isLoading = false;
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
  <!-- Profile header -->
  {#if $userStore.user}
    <div class="mb-6">
      <UserCard user={$userStore.user} />
      <div class="mt-4 flex gap-4">
        <button class="btn variant-soft-primary" onclick={openProfileUpdateModal}>
          <icons.UserCog size={16} class="mr-2" /> Update Profile
        </button>
      </div>
    </div>
  {/if}

  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    <div class="card p-4 text-center">
      <icons.Gamepad2 size={24} class="mx-auto mb-2" />
      <div class="text-xl font-bold">{$gamesJoined}</div>
      <div class="text-sm opacity-70">Games Joined</div>
    </div>
    <div class="card p-4 text-center">
      <icons.FileCode size={24} class="mx-auto mb-2" />
      <div class="text-xl font-bold">{$gamesCreated}</div>
      <div class="text-sm opacity-70">Games Created</div>
    </div>
    <div class="card p-4 text-center">
      <icons.User size={24} class="mx-auto mb-2" />
      <div class="text-xl font-bold">{actors.length}</div>
      <div class="text-sm opacity-70">Actors</div>
    </div>
    <div class="card p-4 text-center">
      <icons.CreditCard size={24} class="mx-auto mb-2" />
      <div class="text-xl font-bold">{actors.filter(a => !!a.card_ref).length}</div>
      <div class="text-sm opacity-70">Cards Owned</div>
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
            <p>You haven’t joined or created any games yet.</p>
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
  <ProfileUpdateModal bind:open={profileModalOpen} />
  <ActorEditModal bind:open={actorEditModalOpen} bind:actor={selectedActor} />
</div>