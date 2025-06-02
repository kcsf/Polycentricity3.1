<!--
Database Wipe Control Component
Allows admins to set cutoff dates for clearing local storage of returning users
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { getWipeCutoffDate, setWipeCutoffDate } from '$lib/services/localStorageService';

  let cutoffDate = $state<string>('');
  let currentCutoffDate = $state<number | null>(null);
  let isLoading = $state(false);
  let message = $state<string>('');

  onMount(async () => {
    await loadCurrentCutoffDate();
  });

  async function loadCurrentCutoffDate() {
    try {
      isLoading = true;
      currentCutoffDate = await getWipeCutoffDate();
      if (currentCutoffDate) {
        cutoffDate = new Date(currentCutoffDate).toISOString().slice(0, 16);
      }
    } catch (error) {
      console.error('Error loading cutoff date:', error);
      message = 'Error loading current cutoff date';
    } finally {
      isLoading = false;
    }
  }

  async function handleSetCutoffDate() {
    if (!cutoffDate) {
      message = 'Please select a date and time';
      return;
    }

    try {
      isLoading = true;
      const timestamp = new Date(cutoffDate).getTime();
      const success = await setWipeCutoffDate(timestamp);
      
      if (success) {
        message = `Database wipe cutoff date set to ${new Date(timestamp).toLocaleString()}`;
        currentCutoffDate = timestamp;
      } else {
        message = 'Failed to set cutoff date';
      }
    } catch (error) {
      console.error('Error setting cutoff date:', error);
      message = 'Error setting cutoff date';
    } finally {
      isLoading = false;
    }
  }

  async function handleClearCutoffDate() {
    try {
      isLoading = true;
      const success = await setWipeCutoffDate(0);
      
      if (success) {
        message = 'Database wipe cutoff date cleared';
        currentCutoffDate = null;
        cutoffDate = '';
      } else {
        message = 'Failed to clear cutoff date';
      }
    } catch (error) {
      console.error('Error clearing cutoff date:', error);
      message = 'Error clearing cutoff date';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="card p-4 space-y-4">
  <div class="card-header">
    <h3 class="h3">Database Wipe Control</h3>
    <p class="text-sm opacity-75">
      Set a cutoff date to automatically clear local storage for users who haven't logged in since then.
      Users with no last_login timestamp will also have their storage cleared.
    </p>
  </div>

  <div class="space-y-4">
    {#if currentCutoffDate}
      <div class="alert preset-filled-warning">
        <div class="alert-message">
          <h4 class="h4">Current Cutoff Date</h4>
          <p>{new Date(currentCutoffDate).toLocaleString()}</p>
          <p class="text-xs opacity-75">
            Users who last logged in before this date (or have no last_login) will have their local storage cleared.
          </p>
        </div>
      </div>
    {:else}
      <div class="alert preset-filled-surface">
        <div class="alert-message">
          <p>No database wipe cutoff date is currently set.</p>
        </div>
      </div>
    {/if}

    <div class="grid grid-cols-1 gap-4">
      <div class="space-y-2">
        <label for="cutoff-date" class="label">Set New Cutoff Date</label>
        <input
          id="cutoff-date"
          type="datetime-local"
          bind:value={cutoffDate}
          disabled={isLoading}
          class="input"
        />
      </div>
      
      <div class="space-y-2 flex flex-col justify-end">
        <button
          class="btn preset-filled-primary"
          onclick={handleSetCutoffDate}
          disabled={isLoading || !cutoffDate}
        >
          {isLoading ? 'Setting...' : 'Set Cutoff Date'}
        </button>
        
        {#if currentCutoffDate}
          <button
            class="btn preset-filled-warning"
            onclick={handleClearCutoffDate}
            disabled={isLoading}
          >
            {isLoading ? 'Clearing...' : 'Clear Cutoff Date'}
          </button>
        {/if}
      </div>
    </div>

    {#if message}
      <div class="alert preset-filled-primary">
        <div class="alert-message">
          <p>{message}</p>
        </div>
      </div>
    {/if}

    <div class="card preset-tonal p-4">
      <h4 class="h4 mb-2">How It Works</h4>
      <ul class="list space-y-1 text-sm">
        <li>
          <span class="preset-filled-surface badge-icon">1</span>
          <span>When users visit the app, their last_login timestamp is checked</span>
        </li>
        <li>
          <span class="preset-filled-surface badge-icon">2</span>
          <span>If last_login is before the cutoff date OR is missing/null, local storage is cleared</span>
        </li>
        <li>
          <span class="preset-filled-surface badge-icon">3</span>
          <span>Users will need to log in again to restore their session</span>
        </li>
        <li>
          <span class="preset-filled-surface badge-icon">4</span>
          <span>This ensures they get fresh data after a database wipe</span>
        </li>
      </ul>
    </div>
  </div>
</div>