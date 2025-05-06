<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { initializeAuth } from '$lib/services/authService';
  import { userStore } from '$lib/stores/userStore';
  import { toggleTheme } from '$lib/stores/themeStore';
  import { get } from 'svelte/store';
  import { Toaster } from '@skeletonlabs/skeleton-svelte';
  import { toaster } from '$lib/utils/toaster-svelte';

  let { children } = $props();
  let isAuthenticated = $state(get(userStore).isAuthenticated);

  // Update header height and initialize auth
  $effect(() => {
    const headerEl = document.querySelector('header');
    if (headerEl) {
      const height = headerEl.offsetHeight;
      document.documentElement.style.setProperty('--app-bar-height', `${height}px`);
    }

    initializeAuth().catch(error => {
      console.error('Auth error:', error);
    });

    isAuthenticated = get(userStore).isAuthenticated;
  });
</script>

<div class="flex flex-col min-h-screen">
  <Header {toggleTheme} />
  <main class="flex-grow container mx-auto p-4">
    {@render children()}
  </main>
  <Footer />
  <Toaster {toaster}></Toaster>
</div>