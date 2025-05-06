<script lang="ts">
    import type { Game } from '$lib/types';
    import { getRandomPastelColor, getInitials } from '$lib/utils/helpers';
    
    // Convert to Svelte 5 Runes syntax with $props()
    const {
        game,
        highlightCurrentUser = true,
        currentUserId = null as string | null,
        compact = false // For compact mode in sidebars
    } = $props<{
        game: Game;
        highlightCurrentUser?: boolean;
        currentUserId?: string | null;
        compact?: boolean;
    }>();
    
    // Local state with Svelte 5 Runes
    let playerIds = $state<string[]>([]);
    
    // Use $derived instead of reactive declaration
    $effect(() => {
        // Handle both array and object formats for players
        if (Array.isArray(game.players)) {
            playerIds = game.players;
        } else {
            playerIds = Object.keys(game.players || {});
        }
    });
</script>

<div class="players-list {!compact ? 'card p-4 bg-surface-50-800 border border-surface-200-700' : ''}">
    {#if !compact}
        <h3 class="h3 mb-4 text-primary-500-400">Players ({playerIds.length})</h3>
    {/if}
    
    {#if playerIds.length === 0}
        <p class="text-surface-600-400">No players have joined yet.</p>
    {:else}
        <div class="space-y-2">
            {#each playerIds as playerId}
                {@const isCurrentUser = highlightCurrentUser && currentUserId === playerId}
                {@const avatarBg = getRandomPastelColor()}
                {@const initials = getInitials(playerId)}
                
                <div class="flex items-center p-{compact ? '2' : '3'} rounded-lg {isCurrentUser ? 'bg-primary-900/20' : 'bg-surface-100-800-token'}">
                    <div 
                        class="avatar w-{compact ? '6' : '8'} h-{compact ? '6' : '8'} rounded-full flex items-center justify-center text-{compact ? 'xs' : 'sm'} font-bold text-white"
                        style="background-color: {avatarBg};"
                    >
                        {initials}
                    </div>
                    <div class="ml-2 overflow-hidden">
                        <p class="text-{compact ? 'xs' : 'sm'} truncate {isCurrentUser ? 'font-bold' : ''}">{playerId}</p>
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