<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { onMount } from 'svelte';
  import { initializeGun } from '$lib/services/gunService';
  import { toggleTheme } from '$lib/stores/themeStore';

  onMount(() => {
    // Initialize Gun.js when app loads
    initializeGun();
    
    // Measure the actual header height and set the CSS variable without logging
    const headerElement = document.querySelector('header');
    if (headerElement) {
      const headerHeight = headerElement.offsetHeight;
      document.documentElement.style.setProperty('--app-bar-height', `${headerHeight}px`);
    }
    
    // Override Gun's console.log with a no-op function to prevent welcome message
    // This is a bit of a hack, but Gun.js has hardcoded console.log calls we need to silence
    const originalConsoleLog = console.log;
    console.log = function(...args) {
      // Filter out Gun.js welcome message
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Hello wonderful person')) {
        return; // don't log the welcome message
      }
      // Otherwise, pass through to the original console.log
      originalConsoleLog.apply(console, args);
    };
  });
</script>

<!-- Set a default app-bar-height that will be overridden by JavaScript -->
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