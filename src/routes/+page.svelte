<script lang="ts">
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  import { onMount } from 'svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import { loadIcons } from '$lib/stores/iconStore';

  onMount(async () => {
    try {
      const gun = getGun();
      if (!gun) return;

      const iconNames: string[] = [];
      await new Promise<void>((resolve) => {
        gun
          .get(nodes.cards)
          .map()
          .once((cardData: any, cardId: string) => {
            if (cardData && cardData.icon) {
              iconNames.push(cardData.icon);
            }
          });
        setTimeout(resolve, 1000);
      });

      const uniqueIconNames = [...new Set(iconNames)];
      await loadIcons(uniqueIconNames);
    } catch (error) {
      console.error('Error loading icons:', error);
    }
  });
</script>

<div class="container h-full mx-auto flex justify-center items-center">
  <div class="bg-white shadow-md rounded-lg p-6 w-full max-w-md">
    <header class="text-center">
      <h1 class="text-3xl font-bold">Polycentricity3</h1>
      <h3 class="text-xl py-2">A Decentralized Eco-Village Simulation</h3>
    </header>
    <section class="p-4 space-y-4">
      <div class="flex justify-center space-x-4">
        <a href="/login" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-1/2 text-center">Login</a>
        <a href="/register" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-1/2 text-center">Register</a>
      </div>
      <div class="flex justify-center space-x-4 pt-2">
        <a href="/dashboard" class="bg-amber-500 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded w-1/2 text-center">Dashboard</a>
        <a href="/games" class="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-1/2 text-center">Games</a>
      </div>
      <div class="pt-4">
        <p class="text-center">
          Collaborate with others to build a sustainable eco-village through role-playing, strategy, and teamwork.
        </p>
      </div>            
    </section>
  </div>
</div>