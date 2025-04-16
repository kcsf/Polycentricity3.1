<!-- src/lib/components/Header.svelte -->
<script lang="ts">
  import { userStore } from '$lib/stores/userStore';
  import { logoutUser } from '$lib/services/authService';
  import { goto } from '$app/navigation';
  import { Sun, Moon, Menu, X, Sprout, LogOut, Gamepad2, Settings, LayoutDashboard } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import themeStore from '$lib/stores/themeStore';
  import { browser } from '$app/environment';

  // Define props using $props() for Svelte 5 runes mode
  const { toggleTheme } = $props<{ toggleTheme: () => void }>();

  // Subscribe to theme store to get current theme
  let isDarkMode = $state<boolean>(false);

  // Use $effect to handle theme subscription
  $effect(() => {
    if (browser) {
      return themeStore.subscribe(theme => {
        isDarkMode = theme === 'dark';
      });
    }
  });

  // Mobile menu state
  let isMenuOpen = $state(false);

  // Toggle mobile menu
  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }

  // Handle logout
  function handleLogout() {
    logoutUser();
    isMenuOpen = false;
    goto('/');
  }

  // Handle click on navigation link (for mobile)
  function handleNavClick() {
    isMenuOpen = false;
  }
</script>

<header class="bg-surface-50-900 border-b border-surface-200-700/50 sticky top-0 z-50 transition-all duration-200">
  <div class="container mx-auto flex justify-between items-center h-16 px-4">
    <!-- Logo and Brand -->
    <a href="/" class="flex items-center space-x-2 h-full">
      <div class="grid place-items-center w-10 h-10 rounded-full bg-primary-500/20 text-primary-600 dark:text-primary-400">
        <Sprout size={24} strokeWidth={2} />
      </div>
      <span class="text-xl font-bold bg-gradient-to-br from-primary-500 to-tertiary-500 bg-clip-text text-transparent">
        Polycentricity<span class="text-primary-500 font-extrabold">3</span>
      </span>
    </a>
    
    <!-- Desktop Navigation -->
    <nav class="hidden lg:flex items-center space-x-1">
      <a href="/" class="flex items-center space-x-1 px-3 py-2 rounded-full transition-all hover:bg-primary-500/10">
        <Sprout size={18} />
        <span>Home</span>
      </a>
      
      <a href="/dashboard" class="flex items-center space-x-1 px-3 py-2 rounded-full transition-all hover:bg-primary-500/10">
        <LayoutDashboard size={18} />
        <span>Dashboard</span>
      </a>
      
      <a href="/games" class="flex items-center space-x-1 px-3 py-2 rounded-full transition-all hover:bg-primary-500/10">
        <Gamepad2 size={18} />
        <span>Games</span>
      </a>
      
      <a href="/admin" class="flex items-center space-x-1 px-3 py-2 rounded-full transition-all hover:bg-primary-500/10">
        <Settings size={18} />
        <span>Admin</span>
      </a>
    </nav>
    
    <!-- Right Side Actions -->
    <div class="flex items-center space-x-2">
      <!-- Theme Toggle -->
      <button 
        class="p-2 rounded-full hover:bg-surface-500/10 transition-colors duration-200"
        on:click={toggleTheme}
        aria-label="Toggle theme"
      >
        {#if isDarkMode}
          <Sun size={20} class="text-yellow-400" />
        {:else}
          <Moon size={20} class="text-indigo-600" />
        {/if}
      </button>
      
      <!-- Auth Actions -->
      <div class="hidden lg:flex items-center space-x-2">
        {#if $userStore.isAuthenticated}
          <button 
            class="flex items-center space-x-1 px-3 py-2 text-error-500 hover:bg-error-500/10 rounded-full transition-all"
            on:click={handleLogout}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        {:else}
          <a 
            href="/login" 
            class="px-3 py-2 hover:bg-primary-500/10 rounded-full transition-all"
          >
            Login
          </a>
          <a 
            href="/register" 
            class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-full transition-all"
          >
            Register
          </a>
        {/if}
      </div>
      
      <!-- Mobile Menu Button -->
      <button 
        class="p-2 rounded-full hover:bg-surface-500/10 lg:hidden transition-colors duration-200"
        on:click={toggleMenu}
        aria-label="Toggle menu"
      >
        {#if isMenuOpen}
          <X size={24} />
        {:else}
          <Menu size={24} />
        {/if}
      </button>
    </div>
  </div>
  
  <!-- Mobile Menu -->
  {#if isMenuOpen}
    <button class="fixed inset-0 bg-surface-900/40 backdrop-blur-sm z-40 lg:hidden cursor-default" 
           on:click={toggleMenu}
           on:keydown={(e) => e.key === 'Escape' && toggleMenu()}
           aria-label="Close menu overlay">
    </button>
    <div class="lg:hidden fixed inset-y-0 right-0 z-50 w-64 bg-surface-100-800-token shadow-xl transform transition-transform duration-300 ease-in-out {isMenuOpen ? 'translate-x-0' : 'translate-x-full'}">
      <div class="p-5 flex flex-col h-full">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold">Menu</h2>
          <button on:click={toggleMenu} class="p-1">
            <X size={24} />
          </button>
        </div>
        
        <nav class="flex flex-col space-y-2">
          <a href="/" class="flex items-center space-x-2 p-3 rounded-lg hover:bg-primary-500/10" on:click={handleNavClick}>
            <Sprout size={20} />
            <span>Home</span>
          </a>
          <a href="/dashboard" class="flex items-center space-x-2 p-3 rounded-lg hover:bg-primary-500/10" on:click={handleNavClick}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </a>
          <a href="/games" class="flex items-center space-x-2 p-3 rounded-lg hover:bg-primary-500/10" on:click={handleNavClick}>
            <Gamepad2 size={20} />
            <span>Games</span>
          </a>
          <a href="/admin" class="flex items-center space-x-2 p-3 rounded-lg hover:bg-primary-500/10" on:click={handleNavClick}>
            <Settings size={20} />
            <span>Admin</span>
          </a>
        </nav>
        
        <div class="mt-auto pt-5 border-t border-surface-300-600/20">
          {#if $userStore.isAuthenticated}
            <button 
              class="flex items-center w-full space-x-2 p-3 text-error-500 hover:bg-error-500/10 rounded-lg"
              on:click={handleLogout}
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          {:else}
            <div class="flex flex-col space-y-2">
              <a href="/login" class="w-full p-3 text-center rounded-lg hover:bg-primary-500/10" on:click={handleNavClick}>
                Login
              </a>
              <a href="/register" class="w-full p-3 text-center bg-primary-500 hover:bg-primary-600 text-white rounded-lg" on:click={handleNavClick}>
                Register
              </a>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</header>