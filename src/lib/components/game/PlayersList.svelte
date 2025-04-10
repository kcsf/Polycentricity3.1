<script lang="ts">
    import type { Game } from '$lib/types';
    import { getRandomPastelColor, getInitials } from '$lib/utils/helpers';
    
    export let game: Game;
    export let highlightCurrentUser = true;
    export let currentUserId: string | null = null;
    
    let playerIds: string[] = [];
    
    $: {
        // Handle both array and object formats for players
        if (Array.isArray(game.players)) {
            playerIds = game.players;
        } else {
            playerIds = Object.keys(game.players || {});
        }
    }
</script>

<div class="players-list card p-4 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
    <h3 class="h3 mb-4 text-primary-500 dark:text-primary-400">Players ({playerIds.length})</h3>
    
    {#if playerIds.length === 0}
        <p class="text-surface-600 dark:text-surface-400">No players have joined yet.</p>
    {:else}
        <div class="space-y-2">
            {#each playerIds as playerId}
                {@const isCurrentUser = highlightCurrentUser && currentUserId === playerId}
                {@const avatarBg = getRandomPastelColor()}
                {@const initials = getInitials(playerId)}
                
                <div class="flex items-center p-3 rounded-lg {isCurrentUser ? 'bg-primary-900/20' : 'bg-surface-100-800-token'}">
                    <div 
                        class="avatar w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style="background-color: {avatarBg};"
                    >
                        {initials}
                    </div>
                    <div class="ml-3 overflow-hidden">
                        <p class="text-sm truncate {isCurrentUser ? 'font-bold' : ''}">{playerId}</p>
                        {#if isCurrentUser}
                            <span class="badge variant-soft-primary text-xs">You</span>
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