<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	import CreateGameForm from '$lib/components/CreateGameForm.svelte';
	
	onMount(() => {
		// Check if user is authenticated
		if (!$userStore.user) {
			goto('/login');
		}
	});
	
	function handleGameCreated(event: CustomEvent<{ gameId: string }>) {
		const { gameId } = event.detail;
		goto(`/games/${gameId}`);
	}
</script>

<div class="container mx-auto p-4">
	<div class="flex items-center mb-6">
		<a href="/games" class="btn btn-sm variant-ghost-surface mr-2">
			<span class="material-symbols-outlined">arrow_back</span>
		</a>
		<h1 class="h1">Create New Game</h1>
	</div>
	
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
		<div class="lg:col-span-1">
			<div class="card p-4">
				<h3 class="h3 mb-4">About Game Creation</h3>
				<p class="mb-4">
					Create a new game session where players can collaborate to build an eco-village or other
					sustainable projects.
				</p>
				<h4 class="h4 mb-2">Game Types:</h4>
				<ul class="list-disc list-inside mb-4 space-y-2">
					<li>
						<strong>Eco-Village:</strong> Build a self-sufficient community focused on sustainability
					</li>
					<li>
						<strong>Community Garden:</strong> Collaborate on an urban agriculture project
					</li>
					<li>
						<strong>Cooperative Business:</strong> Create a worker-owned cooperative enterprise
					</li>
				</ul>
				<p class="mb-2">
					After creating your game, you'll be able to:
				</p>
				<ul class="list-disc list-inside space-y-1">
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
