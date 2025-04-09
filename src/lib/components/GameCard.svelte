<script lang="ts">
	import type { Game } from '$lib/types';
	import { GameStatus } from '$lib/types';
	import { goto } from '$app/navigation';
	import { formatDateTime } from '$lib/utils/helpers';
	
	export let game: Game;
	
	function getStatusBadgeVariant(status: GameStatus): string {
		switch (status) {
			case GameStatus.CREATED:
				return 'variant-soft-primary';
			case GameStatus.SETUP:
				return 'variant-soft-warning';
			case GameStatus.ACTIVE:
				return 'variant-soft-success';
			case GameStatus.PAUSED:
				return 'variant-soft-tertiary';
			case GameStatus.COMPLETED:
				return 'variant-soft-surface';
			default:
				return 'variant-soft-primary';
		}
	}
	
	function enterGame() {
		goto(`/games/${game.game_id}`);
	}
</script>

<div class="card p-4 shadow-lg hover:shadow-xl transition-all duration-200">
	<header class="card-header">
		<h3 class="h3">{game.name}</h3>
		<div class="badge {getStatusBadgeVariant(game.status)}">
			{game.status}
		</div>
	</header>
	<section class="p-4">
		<div class="grid grid-cols-2 gap-2">
			<div>
				<p class="text-sm font-semibold">Players:</p>
				<p class="text-sm">{game.players.length} joined</p>
			</div>
			<div>
				<p class="text-sm font-semibold">Deck Type:</p>
				<p class="text-sm">{game.deck_type}</p>
			</div>
			<div>
				<p class="text-sm font-semibold">Created:</p>
				<p class="text-sm">{formatDateTime(game.created_at)}</p>
			</div>
		</div>
	</section>
	<footer class="card-footer flex justify-end">
		<button class="btn variant-filled-primary" on:click={enterGame}>
			Enter Game
		</button>
	</footer>
</div>
