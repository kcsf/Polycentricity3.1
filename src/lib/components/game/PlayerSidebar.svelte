<script lang="ts">
  import { onDestroy } from 'svelte';
  import { currentGameStore } from '$lib/stores/gameStore';
  import type { ActorWithCard, Game } from '$lib/types';
  import { getGameContext } from '$lib/services/gameService';

  const { showSidebar } = $props<{ showSidebar: boolean }>();

  let actors = $state<ActorWithCard[]>([]);
  let activeActorId = $state<string | null>(null);

  const unsubscribe = currentGameStore.subscribe((game: Game | null) => {
    if (!game) {
      actors = [];
      activeActorId = null;
      return;
    }
    getGameContext(game.game_id).then((context) => {
      actors = context?.actors ?? [];
      activeActorId = actors.length > 0 ? actors[0].actor_id : null;
    });
  });

  onDestroy(() => unsubscribe());

  function selectActor(actorId: string) {
    activeActorId = actorId;
  }

  function handleKeydown(event: KeyboardEvent, actorId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectActor(actorId);
    }
  }
</script>

<aside
  class="sidebar w-64 h-full overflow-auto transition-all duration-300 transform {showSidebar
    ? 'translate-x-0'
    : '-translate-x-full'} md:translate-x-0 bg-surface-50-950 border-r border-surface-200-700/30"
>
  <div class="p-4">
    <h2 class="font-semibold text-lg mb-4 text-primary-700-300">Actors</h2>

    <div class="space-y-4">
      {#each actors as actor (actor.actor_id)}
        <div
          class="p-3 rounded-lg border cursor-pointer transition-colors {actor.actor_id === activeActorId
            ? 'filled bg-primary-500/10 border-primary-500'
            : 'tonal hover:bg-surface-100'}"
          role="button"
          tabindex="0"
          onclick={() => selectActor(actor.actor_id)}
          onkeydown={(e) => handleKeydown(e, actor.actor_id)}
        >
          <h3 class="font-medium text-gray-800-200">{actor.card?.role_title || actor.custom_name || 'Unnamed Actor'}</h3>
          <div class="text-xs text-gray-500-400 mt-1">Role: {actor.card?.role_title || 'None'}</div>
          <p class="text-sm text-gray-600-300 mt-2">{actor.card?.backstory || 'No backstory available'}</p>
        </div>
      {/each}
    </div>
  </div>
</aside>