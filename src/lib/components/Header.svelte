<script lang="ts">
	import { AppBar, LightSwitch } from '@skeletonlabs/skeleton';
	import { userStore } from '$lib/stores/userStore';
	import { logoutUser } from '$lib/services/authService';
	import { goto } from '$app/navigation';
	
	function handleLogout() {
		logoutUser();
		goto('/');
	}
</script>

<AppBar>
	<svelte:fragment slot="lead">
		<a href="/" class="text-xl font-bold flex items-center space-x-2">
			<span class="text-primary-500">Polycentricity3</span>
		</a>
	</svelte:fragment>
	<svelte:fragment slot="trail">
		{#if $userStore.isAuthenticated}
			<div class="hidden md:flex items-center space-x-4">
				<a href="/dashboard" class="btn btn-sm variant-ghost-surface">Dashboard</a>
				<a href="/games" class="btn btn-sm variant-ghost-surface">Games</a>
				<button class="btn btn-sm variant-ghost-error" on:click={handleLogout}>Logout</button>
			</div>
			<div class="md:hidden">
				<button class="btn btn-sm variant-ghost-surface">
					<span class="material-symbols-outlined">menu</span>
				</button>
				<div class="dropdown-menu">
					<a href="/dashboard" class="dropdown-item">Dashboard</a>
					<a href="/games" class="dropdown-item">Games</a>
					<button class="dropdown-item" on:click={handleLogout}>Logout</button>
				</div>
			</div>
		{:else}
			<div class="flex items-center space-x-2">
				<a href="/login" class="btn btn-sm variant-ghost-surface">Login</a>
				<a href="/register" class="btn btn-sm variant-filled-primary">Register</a>
			</div>
		{/if}
		<LightSwitch />
	</svelte:fragment>
</AppBar>
