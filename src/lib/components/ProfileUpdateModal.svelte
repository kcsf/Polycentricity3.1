<script lang="ts">
  import { getGun, getUser } from '$lib/services/gunService';
  import { userStore } from '$lib/stores/userStore';
  import type { User, UserSession } from '$lib/types';
  import { X } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';

  const { open = false } = $props<{ open: boolean }>();
  const dispatch = createEventDispatcher();

  // Form state
  let name = $state('');
  let email = $state('');
  let role = $state('Member');
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // Track initialization
  let isInitialized = $state(false);

  // Initialize form
  $effect(() => {
    const user = $userStore.user;
    if (open && user?.user_id && !isInitialized) {
      name = user.name || '';
      email = user.email || '';
      role = user.role || 'Member';
      isInitialized = true;
      console.log('Form initialized:', { name, email, role });
    }
  });

  // Reset messages
  $effect(() => {
    if (open) {
      errorMessage = '';
      successMessage = '';
      console.log('Modal opened:', { name, email, role });
    }
  });

  // Debug input
  function logInput(field: string, value: string) {
    console.log(`Input changed: ${field} = ${value}`);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    const user = $userStore.user;
    if (!user?.user_id) {
      errorMessage = 'No user logged in';
      console.log('Submit failed: No user in userStore');
      return;
    }

    isSubmitting = true;
    errorMessage = '';
    successMessage = '';

    try {
      const gun = getGun();
      const gunUser = getUser();

      console.log('Gun initialized:', !!gun);
      console.log('Gun user initialized:', !!gunUser, gunUser?.is?.pub || 'No pub key');

      if (!gun) {
        throw new Error('Gun not initialized');
      }
      if (!gunUser || !gunUser.is) {
        throw new Error('User not authenticated');
      }

      // Clean data for public write
      const updatedData: User = {
        user_id: user.user_id,
        name,
        email,
        role,
        created_at: user.created_at,
        updated_at: Date.now(),
      };

      console.log('Submitting data:', updatedData);

      // Update SEA-encrypted profile
      await new Promise<void>((resolve, reject) => {
        gunUser.get('profile').put(updatedData, (ack: any) => {
          console.log('SEA profile write ack:', ack);
          if (ack.err) {
            reject(new Error(`SEA profile write failed: ${ack.err}`));
          } else {
            resolve();
          }
        });
      });

      // Update public record with Promise wrapper
      console.log('Writing to public users node:', user.user_id);
      await new Promise<void>((resolve, reject) => {
        gun.get('users').get(user.user_id).put(updatedData, (ack: any) => {
          console.log('Public users write ack:', ack);
          if (ack.err) {
            reject(new Error(`Public write failed: ${ack.err}`));
          } else {
            resolve();
          }
        });
      });

      // Update store
      console.log('Updating userStore');
      userStore.update((state: UserSession) => ({
        ...state,
        user: updatedData,
      }));

      successMessage = 'Profile updated successfully!';
      console.log('Submit successful, closing modal');
      setTimeout(() => dispatch('update:open', false), 1500);
    } catch (error) {
      console.error('Submit error:', error);
      errorMessage = `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    dispatch('update:open', false);
    isInitialized = false;
  }
</script>

{#if open}
<div class="fixed inset-0 bg-surface-950-50/90 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
  <div class="card bg-surface-50-950/90 p-6 shadow-xl max-w-lg w-full m-4">
    <header class="flex justify-between items-start mb-4">
      <div>
        <h3 class="h3 text-primary-500">Update Profile</h3>
        <p class="text-sm opacity-80">Update your account details below</p>
      </div>
      <button 
        type="button" 
        class="btn-icon preset-tonal-surface"
        onclick={handleCancel}
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </header>

    <form onsubmit={handleSubmit} class="space-y-5">
      <!-- Name -->
      <div class="space-y-2">
        <label for="name-input" class="label font-medium text-surface-900-100">
          Name
        </label>
        <input
          id="name-input"
          type="text"
          class="input rounded-md border-primary-500/30 bg-surface-100-900 text-surface-900-100"
          placeholder="Your name"
          bind:value={name}
          oninput={(e) => logInput('name', e.currentTarget.value)}
          required
        />
      </div>

      <!-- Email -->
      <div class="space-y-2">
        <label for="email-input" class="label font-medium text-surface-900-100">
          Email Address
        </label>
        <input
          id="email-input"
          type="email"
          class="input rounded-md border-primary-500/30 bg-surface-100-900 text-surface-900-100"
          placeholder="your.email@example.com"
          bind:value={email}
          oninput={(e) => logInput('email', e.currentTarget.value)}
          required
        />
      </div>

      <!-- Role -->
      <div class="space-y-2">
        <label for="role-select" class="label font-medium text-surface-900-100">
          Role
        </label>
        <select 
          id="role-select"
          bind:value={role}
          oninput={(e) => logInput('role', e.currentTarget.value)}
          class="select rounded-md border-primary-500/30 bg-surface-100-900 text-surface-900-100"
        >
          <option value="Guest">Guest</option>
          <option value="Member">Member</option>
          <option value="Admin">Admin</option>
        </select>
      </div>

      <!-- Messages -->
      {#if errorMessage}
        <div class="alert preset-filled-error bg-error-500-100 text-error-900-50">
          <span>{errorMessage}</span>
        </div>
      {/if}
      {#if successMessage}
        <div class="alert preset-filled-success bg-success-500-100 text-success-900-50">
          <span>{successMessage}</span>
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex justify-end gap-4 pt-4">
        <button
          type="button"
          class="btn preset-tonal-surface"
          onclick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          class="btn preset-tonal-secondary"
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <span class="animate-pulse">Saving...</span>
          {:else}
            Save Changes
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
{/if}