<script lang="ts">
  import { Menu, X } from 'svelte-lucide';
  
  // Bind this to make it controllable from parent component
  export let showSidebar = false;
  
  function toggleSidebar() {
    showSidebar = !showSidebar;
  }
</script>

<div class="sidebar-menu fixed left-4 top-4 z-50 md:hidden">
  {#if !showSidebar}
    <button 
      on:click={toggleSidebar}
      class="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-gray-100"
      aria-label="Open Sidebar"
    >
      <Menu class="w-5 h-5 text-gray-700" />
    </button>
  {:else}
    <button 
      on:click={toggleSidebar}
      class="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-gray-100"
      aria-label="Close Sidebar"
    >
      <X class="w-5 h-5 text-gray-700" />
    </button>
  {/if}
</div>