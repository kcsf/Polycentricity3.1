<script lang="ts">
  import type { Game, ActorWithCard } from '$lib/types';
  import { getRandomPastelColor, getInitials } from '$lib/utils/helpers';

  const {
    game,
    actorsList = [] as ActorWithCard[],
    presenceMap = {} as Record<string, boolean>,
    highlightCurrentUser = true,
    currentUserId = null as string | null,
    compact = false
  } = $props<{
    game: Game;
    actorsList?: ActorWithCard[];
    presenceMap?: Record<string, boolean>;
    highlightCurrentUser?: boolean;
    currentUserId?: string | null;
    compact?: boolean;
  }>();

  // Derived state: each player’s id, online status, and display name
  let players = $state<{ id: string; online: boolean; name: string }[]>([]);

  // Recompute players whenever actorsList or presenceMap changes
  $effect(() => {
    players = actorsList.map((actor: ActorWithCard) => {
      const id = actor.user_ref;
      return {
        id,
        online: presenceMap[id] ?? false,
        name: actor.card?.role_title ?? actor.custom_name ?? id
      };
    });
  });
</script>

<div class="players-list {compact ? '' : 'card p-4 bg-surface-50-800 border border-surface-200-700'}">
  {#if !compact}
    <h3 class="h3 mb-4 text-primary-500-400">Players ({players.length})</h3>
  {/if}

  {#if players.length === 0}
    <p class="text-surface-600-400">No players have joined yet.</p>
  {:else}
    <div class="space-y-2">
      {#each players as player}
        {@const isCurrentUser = highlightCurrentUser && currentUserId === player.id}
        {@const avatarBg = getRandomPastelColor()}
        {@const initials = getInitials(player.name)}
        <div class="flex items-center {compact ? 'p-2' : 'p-3'} rounded-lg {isCurrentUser ? 'bg-primary-900/20' : 'bg-surface-100-800-token'}">
          <div class="relative">
            <div
              class="avatar {compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} rounded-full flex items-center justify-center font-bold text-white border-2 {player.online ? 'border-green-500' : 'border-gray-400'}"
              style="background-color: {avatarBg};"
            >
              {initials}
            </div>
          </div>
          <div class="ml-2 overflow-hidden">
            <p class="{compact ? 'text-xs' : 'text-sm'} truncate {isCurrentUser ? 'font-bold' : ''}">{player.name}</p>
            {#if isCurrentUser}
              <span class="badge variant-soft-primary text-xs ml-1">You</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .avatar {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
</style>
