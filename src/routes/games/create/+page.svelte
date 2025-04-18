<script lang="ts">
        import { onMount } from 'svelte';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import CreateGameForm from '$lib/components/CreateGameForm.svelte';
        import { ArrowLeft } from 'lucide-svelte';
        
        // Temporarily disabled authentication check for development
        // onMount(() => {
        //         // Check if user is authenticated
        //         if (!$userStore.user) {
        //                 goto('/login');
        //         }
        // });
        
        // Status management for game creation
        let creationStatus = $state('idle'); // 'idle', 'creating', 'success', 'error', 'timeout'
        let createdGameId = $state('');
        
        async function handleGameCreated(event: CustomEvent<{ gameId: string }>) {
                const { gameId } = event.detail;
                
                // Handle timeout case
                if (gameId === 'timeout') {
                    console.log('Game creation timed out, redirecting to games list');
                    creationStatus = 'timeout';
                    // Wait a moment to show the timeout message before redirecting
                    setTimeout(() => {
                        goto('/games');
                    }, 3000);
                    return;
                }
                
                // Normal case - wait a second to ensure Gun.js has time to sync
                console.log(`Game created, navigating to game: ${gameId}`);
                creationStatus = 'success';
                createdGameId = gameId;
                
                // Wait a short time to ensure Gun.js has synced data before navigating
                setTimeout(() => {
                    goto(`/games/${gameId}`);
                }, 2000);
        }
</script>

<div class="container mx-auto p-4">
        <div class="flex items-center mb-6">
                <a href="/games" class="btn btn-sm variant-ghost-surface mr-2">
                        <ArrowLeft size={18} />
                </a>
                <h1 class="h1">Create New Game</h1>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div class="lg:col-span-1">
                        <div class="card p-4">
                                <h3 class="h3 mb-3">About Game Creation</h3>
                                <p class="mb-3 text-sm">
                                        Create a new game session where players can collaborate to build an eco-village or other
                                        sustainable projects.
                                </p>
                                <h4 class="h4 mb-2 text-base">Game Types:</h4>
                                <ul class="list-disc list-inside mb-3 space-y-1 text-sm">
                                        <li>
                                                <strong>Eco-Village:</strong> Build a self-sufficient community focused on sustainability
                                        </li>
                                        <li>
                                                <strong>Community Garden:</strong> Collaborate on an urban agriculture project
                                        </li>
                                </ul>
                                <p class="mb-2 text-sm">
                                        After creating your game, you'll be able to:
                                </p>
                                <ul class="list-disc list-inside space-y-1 text-sm">
                                        <li>Invite players to join</li>
                                        <li>Assign or let players choose roles</li>
                                        <li>Start making agreements and decisions</li>
                                        <li>Chat with other participants</li>
                                </ul>
                        </div>
                </div>
                
                <div class="lg:col-span-2">
                        {#if creationStatus === 'success'}
                                <div class="card p-4 mb-4 variant-filled-success">
                                        <div class="flex items-center">
                                                <div class="mr-2">✓</div>
                                                <div>
                                                        <p class="font-semibold">Game created successfully!</p>
                                                        <p class="text-sm">Redirecting to your new game...</p>
                                                </div>
                                        </div>
                                </div>
                        {:else if creationStatus === 'timeout'}
                                <div class="card p-4 mb-4 variant-filled-warning">
                                        <div class="flex items-center">
                                                <div class="mr-2">⚠️</div>
                                                <div>
                                                        <p class="font-semibold">Game creation is taking longer than expected</p>
                                                        <p class="text-sm">Redirecting to games list. Your game may still be created in the background.</p>
                                                </div>
                                        </div>
                                </div>
                        {/if}
                        
                        <CreateGameForm on:created={handleGameCreated} />
                </div>
        </div>
</div>
