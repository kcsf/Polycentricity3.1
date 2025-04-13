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
  });
</script>

<div class="flex flex-col min-h-screen">
  <Header {toggleTheme} />
  <main class="flex-grow container mx-auto p-4">
    <slot />
  </main>
  <Footer />
</div>