<script lang="ts">
    import type { Game, Actor } from '$lib/types';
    import { getPlayerRole, assignRole } from '$lib/services/gameService';
    import RoleCard from '$lib/components/RoleCard.svelte';
    
    export let game: Game;
    export let userId: string;
    
    let isLoading = true;
    let error = '';
    let playerRole: Actor | null = null;
    let availableRoles: Actor[] = [];
    let isAssigning = false;
    
    // Fetch player role and available roles
    async function loadRoles() {
        isLoading = true;
        error = '';
        
        try {
            // Get player's current role if they have one
            playerRole = await getPlayerRole(game.game_id, userId);
            
            // Get available roles (this would need to be implemented in your service)
            // For now, we'll just have a placeholder
            availableRoles = []; // This should be populated with available roles from the deck
        } catch (err) {
            console.error('Error loading roles:', err);
            error = 'Failed to load role information';
        } finally {
            isLoading = false;
        }
    }
    
    // Handle role selection
    async function selectRole(actorId: string) {
        if (isAssigning) return;
        
        isAssigning = true;
        error = '';
        
        try {
            const success = await assignRole(game.game_id, userId, actorId);
            
            if (success) {
                // Reload roles to get the updated player role
                await loadRoles();
            } else {
                error = 'Failed to assign role. Please try again.';
            }
        } catch (err) {
            console.error('Error assigning role:', err);
            error = 'An error occurred while assigning role';
        } finally {
            isAssigning = false;
        }
    }
    
    // Load roles when component mounts or game changes
    $: if (game && userId) {
        loadRoles();
    }
</script>

<div class="role-selector card p-4 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
    <h3 class="h3 mb-4 text-primary-500 dark:text-primary-400">Your Role</h3>
    
    {#if isLoading}
        <div class="flex justify-center items-center p-8">
            <div class="spinner-third w-8 h-8"></div>
            <p class="ml-4">Loading role information...</p>
        </div>
    {:else if error}
        <div class="alert variant-ghost-error p-4 mb-4">
            <p>{error}</p>
        </div>
    {:else if playerRole}
        <div class="mb-4">
            <RoleCard actor={playerRole} isAssigned={true} />
        </div>
        
        <p class="text-sm text-surface-600 dark:text-surface-400">
            You are playing as <span class="font-bold">{playerRole.role_title}</span>. 
            Make decisions and interact with other players based on your role's values and goals.
        </p>
    {:else if game.role_assignment_type === 'player-choice'}
        <div class="alert variant-ghost-primary mb-4">
            <p>You haven't selected a role yet. Choose one from the available roles below:</p>
        </div>
        
        {#if availableRoles.length === 0}
            <p class="text-sm text-surface-600 dark:text-surface-400">
                No roles are currently available. Please check back later or contact the game creator.
            </p>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#each availableRoles as role}
                    <button 
                        class="text-left"
                        on:click={() => selectRole(role.actor_id)}
                        disabled={isAssigning}
                    >
                        <RoleCard actor={role} isAssigned={false} />
                    </button>
                {/each}
            </div>
        {/if}
    {:else}
        <div class="alert variant-ghost-warning p-4">
            <p>Roles will be assigned by the game creator or randomly distributed when the game begins.</p>
        </div>
    {/if}
</div>