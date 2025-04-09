<script lang="ts">
	import type { Actor } from '$lib/types';
	
	export let actor: Actor;
	export let isAssigned: boolean = false;
	export let onSelect: ((actorId: string) => void) | undefined = undefined;
	
	function handleSelect() {
		if (onSelect) {
			onSelect(actor.actor_id);
		}
	}
</script>

<div class="card p-4 shadow-lg {isAssigned ? 'variant-filled-primary' : ''} h-full flex flex-col">
	<header class="card-header">
		<h3 class="h3">{actor.role_title}</h3>
	</header>
	<section class="p-4 flex-grow">
		<p class="mb-2">{actor.backstory}</p>
		
		{#if actor.values && actor.values.length > 0}
			<div class="mb-2">
				<h4 class="h4 mb-1">Values:</h4>
				<ul class="list-disc list-inside">
					{#each actor.values as value}
						<li>{value}</li>
					{/each}
				</ul>
			</div>
		{/if}
		
		{#if actor.goals && actor.goals.length > 0}
			<div class="mb-2">
				<h4 class="h4 mb-1">Goals:</h4>
				<ul class="list-disc list-inside">
					{#each actor.goals as goal}
						<li>{goal}</li>
					{/each}
				</ul>
			</div>
		{/if}
		
		{#if actor.skills && actor.skills.length > 0}
			<div class="mb-2">
				<h4 class="h4 mb-1">Skills:</h4>
				<div class="flex flex-wrap gap-1">
					{#each actor.skills as skill}
						<span class="badge variant-soft-secondary">{skill}</span>
					{/each}
				</div>
			</div>
		{/if}
		
		{#if actor.resources && actor.resources.length > 0}
			<div class="mb-2">
				<h4 class="h4 mb-1">Resources:</h4>
				<div class="flex flex-wrap gap-1">
					{#each actor.resources as resource}
						<span class="badge variant-soft-tertiary">{resource}</span>
					{/each}
				</div>
			</div>
		{/if}
	</section>
	
	{#if onSelect && !isAssigned}
		<footer class="card-footer">
			<button class="btn variant-filled-primary w-full" on:click={handleSelect}>
				Select Role
			</button>
		</footer>
	{/if}
</div>
