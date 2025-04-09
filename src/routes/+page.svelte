<script lang="ts">
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	import { onMount } from 'svelte';

	onMount(() => {
		// Check if user is already logged in, redirect to dashboard if true
		if ($userStore.user) {
			goto('/dashboard');
		}
	});
</script>

<div class="container h-full mx-auto flex justify-center items-center">
	<div class="card p-4 w-full max-w-md">
		<header class="card-header text-center">
			<h1 class="h1">Polycentricity3</h1>
			<h3 class="h3 py-2">A Decentralized Eco-Village Simulation</h3>
		</header>
		<section class="p-4 space-y-4">
			<div class="flex justify-center space-x-4">
				<a href="/login" class="btn variant-filled-primary w-1/2">Login</a>
				<a href="/register" class="btn variant-filled-secondary w-1/2">Register</a>
			</div>
			<div class="pt-4">
				<p class="text-center">
					Collaborate with others to build a sustainable eco-village through role-playing, strategy, and teamwork.
				</p>
			</div>
		</section>
	</div>
</div>
