<script lang="ts">
	import { get } from 'svelte/store';
	import { userStore } from '$lib/stores/userStore';
	import type { User, UserSession } from '$lib/types';

	// Define props using $props()
	let { open = false } = $props<{
		open: boolean;
	}>();

	// Local form state
	let name = $state(get(userStore)?.user?.name || '');
	let email = $state(get(userStore)?.user?.email || '');
	let role = $state(get(userStore)?.user?.role || 'Member');
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	// Handle form submission
	async function handleSubmit() {
		isSubmitting = true;
		errorMessage = '';

		try {
			// For now, just mock the update - we'll add real implementation later
			await new Promise(resolve => setTimeout(resolve, 500));

			// Update user in store
			userStore.update((state: UserSession) => ({
				...state,
				user: {
					...state.user!,
					name,
					email,
					role
				}
			}));

			// Emit custom event to notify parent of close
			dispatchEvent(new CustomEvent('updateOpen', { detail: { open: false } }));
		} catch (error) {
			console.error('Failed to update profile:', error);
			errorMessage = 'Failed to update profile. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	// Handle cancel
	function handleCancel() {
		// Emit custom event to notify parent of close
		dispatchEvent(new CustomEvent('updateOpen', { detail: { open: false } }));
	}
</script>

{#if open}
<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
	<div class="bg-surface-50 dark:bg-surface-900 p-6 rounded-lg shadow-xl max-w-lg w-full">
		<header class="mb-4">
			<h3 class="text-xl font-bold text-primary-700 dark:text-primary-300">Update Profile</h3>
			<p class="text-sm text-surface-600 dark:text-surface-400">Update your account details below</p>
		</header>

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Name -->
			<div class="space-y-1">
				<label for="name-input" class="text-sm font-medium">
					Name
				</label>
				<input
					id="name-input"
					type="text"
					class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded"
					placeholder="Your name"
					value={name}
					oninput={(e) => (name = e.currentTarget.value)}
					required
				/>
			</div>

			<!-- Email Address -->
			<div class="space-y-1">
				<label for="email-input" class="text-sm font-medium">
					Email Address
				</label>
				<input
					id="email-input"
					type="email"
					class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded"
					placeholder="your.email@example.com"
					value={email}
					oninput={(e) => (email = e.currentTarget.value)}
					required
				/>
			</div>

			<!-- Role -->
			<div class="space-y-1">
				<label for="role-select" class="text-sm font-medium">
					Role
				</label>
				<select 
					id="role-select"
					value={role}
					onchange={(e) => (role = e.currentTarget.value as 'Guest' | 'Member' | 'Admin')}
					class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded"
				>
					<option value="Guest">Guest</option>
					<option value="Member">Member</option>
					<option value="Admin">Admin</option>
				</select>
			</div>

			<!-- Error message -->
			{#if errorMessage}
				<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
					<span>{errorMessage}</span>
				</div>
			{/if}

			<!-- Form Actions -->
			<div class="flex justify-end gap-4 pt-2">
				<button
					type="button"
					class="px-4 py-2 border border-surface-300 dark:border-surface-600 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
					onclick={handleCancel}
					disabled={isSubmitting}
				>
					Cancel
				</button>
				<button 
					type="submit" 
					class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded"
					disabled={isSubmitting}
				>
					{#if isSubmitting}
						Saving...
					{:else}
						Save Changes
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
{/if}