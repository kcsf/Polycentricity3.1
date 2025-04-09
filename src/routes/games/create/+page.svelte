<script lang="ts">
        import { onMount } from 'svelte';
        import { goto } from '$app/navigation';
        import { userStore } from '$lib/stores/userStore';
        import CreateGameForm from '$lib/components/CreateGameForm.svelte';
        import { ArrowLeft } from 'svelte-lucide';
        
        // Temporarily disabled authentication check for development
        // onMount(() => {
        //         // Check if user is authenticated
        //         if (!$userStore.user) {
        //                 goto('/login');
        //         }
        // });
        
        function handleGameCreated(event: CustomEvent<{ gameId: string }>) {
                const { gameId } = event.detail;
                
                // Handle timeout case
                if (gameId === 'timeout') {
                    console.log('Game creation timed out, redirecting to games list');
                    goto('/games');
                    return;
                }
                
                // Normal case - navigate to the new game
                console.log(`Game created, navigating to game: ${gameId}`);
                goto(`/games/${gameId}`);
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
                        <CreateGameForm on:created={handleGameCreated} />
                </div>
        </div>
</div>
