<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    
    const gameId = $page.params.gameId;
    
    onMount(() => {
        // Redirect to the details page where actor selection is now available
        goto(`/games/${gameId}/details`);
    });
</script>

<div class="container mx-auto p-8 text-center">
    <div class="card p-8 bg-surface-100-800-token">
        <div class="flex flex-col items-center justify-center">
            <div class="spinner-third w-10 h-10 mb-4"></div>
            <h2 class="h2 mb-2">Redirecting...</h2>
            <p class="mb-4 text-surface-300">
                Actor selection is now available on the game details page.
            </p>
        </div>
    </div>
</div>