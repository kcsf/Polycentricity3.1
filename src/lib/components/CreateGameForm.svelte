<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { createGame } from '$lib/services/gameService';
	
	const dispatch = createEventDispatcher<{
		created: { gameId: string }
	}>();
	
	let gameName = '';
	let deckType = 'eco-village';
	let isCreating = false;
	let error = '';
	
	const deckTypes = [
		{ value: 'eco-village', label: 'Eco-Village' },
		{ value: 'community-garden', label: 'Community Garden' },
		{ value: 'cooperative-business', label: 'Cooperative Business' }
	];
	
	async function handleSubmit() {
		if (!gameName.trim()) {
			error = 'Please enter a game name';
			return;
		}
		
		isCreating = true;
		error = '';
		
		try {
			const game = await createGame(gameName, deckType);
			
			if (game) {
				console.log(`Game created: ${game.game_id}`);
				dispatch('created', { gameId: game.game_id });
			} else {
				error = 'Failed to create game. Please try again.';
			}
		} catch (err) {
			console.error('Error creating game:', err);
			error = 'An error occurred while creating the game';
		} finally {
			isCreating = false;
		}
	}
</script>

<div class="card p-4 shadow">
	<header class="card-header">
		<h3 class="h3">Create New Game</h3>
	</header>
	
	<div class="p-4">
		<form on:submit|preventDefault={handleSubmit}>
			{#if error}
				<div class="alert variant-filled-error mb-4">
					<p>{error}</p>
				</div>
			{/if}
			
			<label class="label mb-4">
				<span>Game Name</span>
				<input 
					type="text" 
					class="input" 
					bind:value={gameName} 
					placeholder="Enter a name for your game"
					required
				/>
			</label>
			
			<label class="label mb-4">
				<span>Deck Type</span>
				<select class="select" bind:value={deckType}>
					{#each deckTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</label>
			
			<div class="flex justify-end">
				<button 
					type="submit" 
					class="btn variant-filled-primary" 
					disabled={isCreating}
				>
					{isCreating ? 'Creating...' : 'Create Game'}
				</button>
			</div>
		</form>
	</div>
</div>
