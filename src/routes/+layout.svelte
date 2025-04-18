<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { onMount } from 'svelte';
  import { initializeGun } from '$lib/services/gunService';
  import { initializeAuth, loginUser } from '$lib/services/authService';
  import { userStore } from '$lib/stores/userStore';
  import { getAllGames } from '$lib/services/gameService';
  import { toggleTheme } from '$lib/stores/themeStore';

  // Initialize app when component mounts
  onMount(async () => {
    // Start Gun.js database
    initializeGun();
    
    // Set header height for layout calculations
    const headerEl = document.querySelector('header');
    if (headerEl) {
      const height = headerEl.offsetHeight;
      document.documentElement.style.setProperty('--app-bar-height', `${height}px`);
    }
    
    // Handle authentication
    try {
      await initializeAuth();
      
      // Auto-login as admin for development
      if (!$userStore.isAuthenticated) {
        try {
          await loginUser('bjorn@endogon.com', 'admin123');
          console.log('Admin login successful');
          
          // Preload games data for faster dashboard loading
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
    <slot></slot>
  </main>
  <Footer />
</div>