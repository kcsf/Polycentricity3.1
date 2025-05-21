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
  import { page } from '$app/stores';
  import { pokePresence } from '$lib/services/userService';
  import { onMount } from 'svelte';

  const { children } = $props();

  let isAuthenticated = $state(false);
  let currentUserId = $state<string | null>(null);
  let isHomePage = $derived($page.url.pathname === '/');

  // Sync auth state
  $effect(() => {
    const user = get(userStore);
    isAuthenticated = user.isAuthenticated;
    currentUserId = user.user?.user_id ?? null;
  });

  // Header sizing and auth initialization
  $effect(() => {
    const headerEl = document.querySelector('header');
    if (headerEl) {
      document.documentElement.style.setProperty(
        '--app-bar-height',
        `${headerEl.offsetHeight}px`
      );
    }
    initializeAuth().catch((error) => console.error('Auth error:', error));
  });

  // Heartbeat presence update
  let timer: number;
  onMount(() => {
    function heartbeat() {
      if (currentUserId) pokePresence(currentUserId);
    }
    // initial heartbeat
    heartbeat();
    // interval every minute via browser timer
    timer = window.setInterval(heartbeat, 60_000);

    // also update on user interactions
    window.addEventListener('keydown', heartbeat);
    window.addEventListener('click', heartbeat);

    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', heartbeat);
      window.removeEventListener('click', heartbeat);
    };
  });
</script>

<div class="flex flex-col min-h-screen">
  <Header {toggleTheme} />
  <main class="flex-grow" class:isHomePage>
    <div class="{isHomePage ? 'w-full p-0 m-0' : 'container mx-auto p-0'}">
      {@render children()}
    </div>
  </main>
  <Footer />
  <Toaster {toaster} />
</div>

<style>
  .isHomePage {
    width: 100%;
    padding: 0;
    margin: 0;
  }
</style>
