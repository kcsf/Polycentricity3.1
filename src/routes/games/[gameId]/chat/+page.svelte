<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	import { currentGameStore } from '$lib/stores/gameStore';
	import { getGame, subscribeToGame } from '$lib/services/gameService';
	import { getChatParticipants } from '$lib/services/chatService';
	import type { Game } from '$lib/types';
	import ChatBox from '$lib/components/ChatBox.svelte';
	
	// Extract gameId from the URL
	const gameId = $page.params.gameId;
	
	let game: Game | null = null;
	let isLoading = true;
	let error = '';
	let unsubscribe: () => void;
	let activeChat: 'group' | 'private' = 'group';
	let selectedUserId: string | undefined = undefined;
	let participants: string[] = [];
	
	onMount(async () => {
		// Check if user is authenticated
		if (!$userStore.user) {
			goto('/login');
			return;
		}
		
		// Load game data
		try {
			game = await getGame(gameId);
			
			if (game) {
				currentGameStore.set(game);
				
				// Subscribe to game updates
				unsubscribe = subscribeToGame(gameId, (updatedGame) => {
					game = updatedGame;
					currentGameStore.set(updatedGame);
				});
				
				// Get chat participants
				participants = await getChatParticipants(gameId);
			} else {
				error = 'Game not found';
			}
		} catch (err) {
			console.error('Error loading game:', err);
			error = 'Failed to load game data';
		} finally {
			isLoading = false;
		}
	});
	
	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});
	
	function switchToGroupChat() {
		activeChat = 'group';
		selectedUserId = undefined;
	}
	
	function switchToPrivateChat(userId: string) {
		if (userId === $userStore.user?.user_id) return;
		
		activeChat = 'private';
		selectedUserId = userId;
	}
	
	function isCurrentUser(userId: string): boolean {
		return $userStore.user?.user_id === userId;
	}
</script>

<div class="container mx-auto p-4">
	<div class="flex items-center mb-6">
		<a href="/games/{gameId}" class="btn btn-sm variant-ghost-surface mr-2">
			<span class="material-symbols-outlined">arrow_back</span>
		</a>
		<h1 class="h1">{game ? game.name : 'Game'} - Chat</h1>
	</div>
	
	{#if isLoading}
		<div class="card p-8 text-center">
			<p>Loading chat...</p>
		</div>
	{:else if error}
		<div class="alert variant-filled-error mb-4">
			<p>{error}</p>
			<div class="mt-4">
				<a href="/games" class="btn variant-ghost-surface">Back to Games</a>
			</div>
		</div>
	{:else if game}
		<div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
			<!-- Participants sidebar -->
			<div class="lg:col-span-1">
				<div class="card p-4">
					<h2 class="h2 mb-4">Chats</h2>
					
					<ul class="space-y-2">
						<li>
							<button 
								class="w-full text-left p-2 rounded {activeChat === 'group' ? 'bg-primary-500 text-white' : 'hover:bg-surface-100-800-token'}"
								on:click={switchToGroupChat}
							>
								Group Chat
							</button>
						</li>
						
						<li class="pt-2">
							<p class="text-sm font-semibold pb-1">Private Messages</p>
							{#if participants.length <= 1}
								<p class="text-sm opacity-70">No other participants yet</p>
							{:else}
								<ul class="space-y-1">
									{#each participants as participantId}
										{#if !isCurrentUser(participantId)}
											<li>
												<button 
													class="w-full text-left p-2 rounded {activeChat === 'private' && selectedUserId === participantId ? 'bg-primary-500 text-white' : 'hover:bg-surface-100-800-token'}"
													on:click={() => switchToPrivateChat(participantId)}
												>
													{participantId.substring(0, 8)}...
												</button>
											</li>
										{/if}
									{/each}
								</ul>
							{/if}
						</li>
					</ul>
				</div>
			</div>
			
			<!-- Chat main area -->
			<div class="lg:col-span-3 h-[calc(100vh-200px)]">
				{#if activeChat === 'group'}
					<ChatBox {gameId} chatType="group" />
				{:else if activeChat === 'private' && selectedUserId}
					<ChatBox {gameId} chatType="private" otherUserId={selectedUserId} />
				{/if}
			</div>
		</div>
	{:else}
		<div class="alert variant-filled-warning">
			<p>Game could not be found. It may have been deleted.</p>
			<div class="mt-4">
				<a href="/games" class="btn variant-ghost-surface">Back to Games</a>
			</div>
		</div>
	{/if}
</div>
