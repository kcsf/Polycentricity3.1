<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { initializeAuth } from '$lib/services/authService';
  import { userStore } from '$lib/stores/userStore';
  import { toggleTheme } from '$lib/stores/themeStore';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  let { children } = $props();
  let isAuthenticated = $state(get(userStore).isAuthenticated);

  // Derive whether the current route is the home page
  let isHomePage = $derived($page.url.pathname === '/');
  
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
  <main class="flex-grow" class:isHomePage>
    <div class="{isHomePage ? 'w-full p-0 m-0' : 'container mx-auto p-4'}">
      {@render children()}
    </div>
  </main>
  <Footer />
  <Toast />
</div>

<style>
  .isHomePage {
    width: 100%;
    padding: 0;
    margin: 0;
  }
</style>