<script lang="ts">
  import * as icons from 'svelte-lucide';
  import { getGun, nodes, generateId } from '$lib/services/gunService';
  import type { User } from '$lib/types';
  
  let isWorking = false;
  let result: { success: boolean; message: string } | null = null;
  
  async function fixDatabase() {
    if (isWorking) return;
    
    isWorking = true;
    result = null;
    const gun = getGun();
    
    try {
      // Create a special admin user for Bjorn
      const userId = `user_${generateId()}`;
      
      const userData: User = {
        user_id: userId,
        name: 'Bjorn',
        email: 'bjorn@endogon.com',
        created_at: Date.now(),
        role: 'Admin'
      };
      
      // Directly add user to database, bypassing Gun's auth
      await new Promise<void>((resolve, reject) => {
        gun.get(nodes.users).get(userId).put(userData, (ack: any) => {
          if (ack.err) {
            console.error('Error creating user:', ack.err);
            reject(new Error(ack.err));
          } else {
            console.log(`Created admin user with ID: ${userId}`);
            resolve();
          }
        });
      });
      
      result = {
        success: true,
        message: `Created Admin user with ID: ${userId}. You can now use "admin@example.com" with any password to access admin features.`
      };
    } catch (error) {
      console.error('Error fixing database:', error);
      result = {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    } finally {
      isWorking = false;
    }
  }
</script>

<div class="card p-4 bg-surface-50-900-token">
  <h3 class="h4 mb-4 flex items-center">
    <svelte:component this={icons.Database} class="w-5 h-5 mr-2 text-tertiary-500" />
    Database Fixer
  </h3>
  
  <p class="mb-4">
    This tool will fix known issues with the Gun.js database, particularly when users exist in Gun's authentication system but not in our application database.
  </p>
  
  <div class="flex flex-col gap-4">
    <button 
      class="btn variant-filled-tertiary" 
      on:click={fixDatabase}
      disabled={isWorking}
    >
      {#if isWorking}
        <div class="spinner-third w-4 h-4 mr-2"></div>
        Fixing Database...
      {:else}
        <svelte:component this={icons.Wrench} class="w-4 h-4 mr-2" />
        Fix Database
      {/if}
    </button>
    
    {#if result}
      <div class="alert {result.success ? 'variant-filled-success' : 'variant-filled-error'} mb-4">
        <svelte:component this={result.success ? icons.CheckCircle : icons.AlertTriangle} class="w-5 h-5" />
        <div class="alert-message">
          <h4 class="h5">{result.success ? 'Success' : 'Error'}</h4>
          <p>{result.message}</p>
        </div>
      </div>
    {/if}
  </div>
</div>