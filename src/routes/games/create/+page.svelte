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
                
                // Update UI immediately, then navigate after a brief delay
                console.log(`Game created, preparing to navigate to: ${gameId}`);
                creationStatus = 'success';
                createdGameId = gameId;
                
                // Brief delay to ensure the UI shows success before redirecting
                setTimeout(() => {
                    goto(`/games/${gameId}`);
                }, 500);
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
                        {:else if creationStatus === 'timeout' || creationStatus === 'background'}
                                <div class="card p-4 mb-4 variant-filled-warning">
                                        <div class="flex items-center">
                                                <div class="mr-2">⚠️</div>
                                                <div>
                                                        <p class="font-semibold">Game creation is continuing in the background</p>
                                                        <p class="text-sm">You'll be redirected to games list. Your game will appear there when completed.</p>
                                                </div>
                                        </div>
                                </div>
                        {:else if creationStatus === 'error'}
                                <div class="card p-4 mb-4 variant-filled-error">
                                        <div class="flex items-center">
                                                <div class="mr-2">✗</div>
                                                <div>
                                                        <p class="font-semibold">Failed to create game</p>
                                                        <p class="text-sm">Please check the form for errors and try again.</p>
                                                </div>
                                        </div>
                                </div>
                        {:else if creationStatus === 'creating'}
                                <div class="card p-4 mb-4 variant-filled-primary">
                                        <div class="flex items-center">
                                                <div class="mr-2 spinner-third w-4 h-4"></div>
                                                <div>
                                                        <p class="font-semibold">Creating your game...</p>
                                                        <p class="text-sm">This may take a few moments.</p>
                                                </div>
                                        </div>
                                </div>
                        {/if}
                        
                        <CreateGameForm 
                                on:created={handleGameCreated}
                                on:statusUpdate={(e) => creationStatus = e.detail.status}
                        />
                </div>
        </div>
</div>
