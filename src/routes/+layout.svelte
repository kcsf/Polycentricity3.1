<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { onMount } from 'svelte';
  import { initializeGun } from '$lib/services/gunService';
  import { initializeAuth, loginUser } from '$lib/services/authService';
  import { userStore } from '$lib/stores/userStore';
  import { getAllGames } from '$lib/services/gameService';
  import { toggleTheme } from '$lib/stores/themeStore';

  // Initialize on mount - simple approach without Runes for now
  onMount(async () => {
    initializeGun();
    
    const headerEl = document.querySelector('header');
    if (headerEl) {
      const height = headerEl.offsetHeight;
      document.documentElement.style.setProperty('--app-bar-height', `${height}px`);
    }
    
    try {
      await initializeAuth();
      
      // Try admin login if not authenticated
      if (!$userStore.isAuthenticated) {
        try {
          await loginUser('bjorn@endogon.com', 'admin123');
          console.log('Admin login successful');
          
          // Pre-fetch games for faster dashboard loading
          getAllGames().then(games => {
            console.log(`Pre-fetched ${games.length} games`);
          });
        } catch (error) {
          console.warn('Admin login failed:', error);
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  });
</script>

<style>
  :global(:root) {
    --app-bar-height: 64px;
  }
</style>

<div class="flex flex-col min-h-screen">
  <Header {toggleTheme} />
  <main class="flex-grow container mx-auto p-4">
    <slot />
  </main>
  <Footer />
</div>