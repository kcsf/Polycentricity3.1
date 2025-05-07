<script lang="ts">
  import { toastStore, type Toast } from '$lib/utils/toast';
  import { fly } from 'svelte/transition';
  import { CheckCircle, AlertCircle, Info, XCircle, X } from '@lucide/svelte';

  // Toast store
  let toasts = $state<Toast[]>([]);
  
  // Subscribe to toast store
  $effect(() => {
    const unsubscribe = toastStore.subscribe(value => {
      toasts = value;
    });
    
    return () => {
      unsubscribe();
    };
  });
  
  // Handle close toast
  function closeToast(id: string) {
    toastStore.remove(id);
  }
  
  // Get the appropriate icon based on toast type
  function getIconComponent(type: Toast['type']) {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'error':
        return XCircle;
      case 'warning':
        return AlertCircle;
      case 'info':
      default:
        return Info;
    }
  }
  
  // Get the appropriate color classes based on toast type
  function getColorClasses(type: Toast['type']) {
    switch (type) {
      case 'success':
        return 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-200 dark:border-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800';
    }
  }
</script>

<div class="fixed bottom-4 right-4 z-50 space-y-2">
  {#each toasts as toast (toast.id)}
    <div
      transition:fly={{ y: 20, duration: 300 }}
      class="flex items-center p-3 rounded-lg shadow-md border {getColorClasses(toast.type)}"
      role="alert"
    >
      {#if toast.type === 'success'}
        <CheckCircle class="w-5 h-5 mr-2" />
      {:else if toast.type === 'error'}
        <XCircle class="w-5 h-5 mr-2" />
      {:else if toast.type === 'warning'}
        <AlertCircle class="w-5 h-5 mr-2" />
      {:else}
        <Info class="w-5 h-5 mr-2" />
      {/if}
      <span class="text-sm font-medium">{toast.message}</span>
      <button
        class="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex items-center justify-center"
        onclick={() => closeToast(toast.id)}
        aria-label="Close toast"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  {/each}
</div>