<script lang="ts">
	import type { User } from '$lib/types';
	import { getInitials, stringToColor } from '$lib/utils/helpers';
	
	export let user: User;
	export let showDetails: boolean = true;
	
	$: initials = getInitials(user.name);
	$: avatarColor = stringToColor(user.user_id);
</script>

<div class="card p-4 shadow-lg">
	<div class="flex items-center space-x-4">
		<div 
			class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
			style="background-color: {avatarColor};"
		>
			{initials}
		</div>
		<div>
			<h3 class="font-bold">{user.name}</h3>
			{#if showDetails}
				<p class="text-sm opacity-70">{user.email}</p>
			{/if}
		</div>
	</div>
	{#if showDetails}
		<div class="mt-4 p-2 bg-surface-100-800-token rounded">
			<p class="text-xs">User ID: {user.user_id}</p>
			<p class="text-xs">Joined: {new Date(user.created_at).toLocaleDateString()}</p>
		</div>
	{/if}
</div>
