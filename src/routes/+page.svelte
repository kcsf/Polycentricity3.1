<script lang="ts">
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  import { onMount } from 'svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import { loadIcons } from '$lib/stores/iconStore';
  import type { Card } from '$lib/types';
  import { 
    Leaf, 
    Globe, 
    Users, 
    Sparkles, 
    Check 
  } from '@lucide/svelte';

  let iconNames = $state<string[]>([]);
  let loaded = $state(false);

  onMount(async () => {
    try {
      const gun = getGun();
      if (!gun) return;

      await new Promise<void>((resolve) => {
        try {
          // Use explicit error handling and type checking to prevent Gun.js internal errors
          gun
            .get(nodes.cards)
            .map()
            .once((cardData, cardId: string) => {
              try {
                // Add strict type checking to prevent issues with malformed data
                if (cardId && 
                    cardId !== '_' && 
                    cardData && 
                    typeof cardData === 'object' && 
                    !Array.isArray(cardData) &&
                    cardData.icon &&
                    typeof cardData.icon === 'string') {
                  iconNames = [...iconNames, cardData.icon];
                }
              } catch (innerError) {
                console.error(`Error processing card ${cardId}:`, innerError);
                console.log('Problem data:', JSON.stringify(cardData));
              }
            });
        } catch (gunError) {
          console.error('Error in Gun map() query:', gunError);
        }
        setTimeout(resolve, 1000);
      });

      const uniqueIconNames = [...new Set(iconNames)];
      await loadIcons(uniqueIconNames);
      
      // Set loaded state for animation
      setTimeout(() => {
        loaded = true;
      }, 100);
    } catch (error) {
      console.error('Error loading icons:', error);
    }
  });
</script>

<div class="min-h-screen w-screen flex flex-col bg-linear-to-br from-surface-50-950 to-surface-200-800 -mx-4 md:-mx-8">
  <!-- Hero Section -->
  <div class="flex-grow flex items-center justify-center min-h-[calc(90vh-var(--app-bar-height))] pt-[var(--app-bar-height)]">
    <div class="card p-8 variant-glass-surface backdrop-blur-lg border border-surface-300 dark:border-surface-600 shadow-xl max-w-4xl mx-4">
      <div class="text-center">
        <div class="flex justify-center mb-6">
          <div class="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center">
            <Leaf class="w-10 h-10 text-primary-500" />
          </div>
        </div>
        <h1 class="h1 text-primary-500 mb-2">Polycentricity3</h1>
        <h3 class="h3 mb-6">A Decentralized Eco-Village Simulation</h3>
        <p class="text-lg max-w-2xl mx-auto mb-8">
          Design, negotiate, and build a sustainable community through collaborative decision-making,
          strategic resource management, and value-driven partnerships.
        </p>
        <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <a href="/register" class="btn btn-lg variant-filled-primary">Get Started</a>
          <a href="/login" class="btn btn-lg variant-ghost-surface">Sign In</a>
        </div>
      </div>
    </div>
  </div>

  <!-- Features Section -->
  <div class="container mx-auto px-4 py-16">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      <!-- Feature 1 -->
      <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300 dark:border-surface-600 shadow-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center mr-4">
            <Globe class="w-6 h-6 text-primary-500" />
          </div>
          <div>
            <h3 class="h3 mb-2">Decentralized Platform</h3>
            <p>Built on Gun.js for resilient peer-to-peer data synchronization and community governance.</p>
          </div>
        </div>
      </div>

      <!-- Feature 2 -->
      <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300 dark:border-surface-600 shadow-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-secondary-500/20 flex items-center justify-center mr-4">
            <Users class="w-6 h-6 text-secondary-500" />
          </div>
          <div>
            <h3 class="h3 mb-2">Collaborative Decision-Making</h3>
            <p>Form agreements, build coalitions, and work together to solve complex sustainability challenges.</p>
          </div>
        </div>
      </div>

      <!-- Feature 3 -->
      <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300 dark:border-surface-600 shadow-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-tertiary-500/20 flex items-center justify-center mr-4">
            <Sparkles class="w-6 h-6 text-tertiary-500" />
          </div>
          <div>
            <h3 class="h3 mb-2">Dynamic Visualizations</h3>
            <p>Interactive D3.js visualizations help track community relationships, resources, and outcomes.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Call to Action -->
    <div class="card p-8 variant-glass-surface text-center backdrop-blur-lg border border-surface-300 dark:border-surface-600 shadow-lg mb-12">
      <h2 class="h2 mb-4">Ready to Build a Sustainable Future?</h2>
      <p class="text-lg mb-6">Join our growing community of sustainability enthusiasts, policy makers, and problem solvers.</p>
      <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <a href="/dashboard" class="btn variant-filled-secondary">View Dashboard</a>
        <a href="/games" class="btn variant-filled-tertiary">Browse Games</a>
      </div>
    </div>

    <!-- FAQ Section -->
    <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300 dark:border-surface-600 shadow-lg mb-12">
      <h2 class="h2 text-center mb-6">Frequently Asked Questions</h2>
      <div class="space-y-4">
        <!-- FAQ 1 -->
        <div class="card p-4 variant-soft">
          <div class="font-bold flex items-center">
            <Check class="w-5 h-5 text-primary-500 mr-2" />
            What is Polycentricity?
          </div>
          <p class="p-2">
            Polycentricity is an immersive eco-village simulation platform that enables collaborative
            sustainability planning. Players take on various roles to design, negotiate, and build a thriving
            community while balancing ecological, social, and economic factors.
          </p>
        </div>

        <!-- FAQ 2 -->
        <div class="card p-4 variant-soft">
          <div class="font-bold flex items-center">
            <Check class="w-5 h-5 text-primary-500 mr-2" />
            How do I get started?
          </div>
          <p class="p-2">
            Simply register for an account, join an existing game or create a new one, select a role card
            that represents your skills and values, and begin collaborating with other players to build your
            sustainable community.
          </p>
        </div>

        <!-- FAQ 3 -->
        <div class="card p-4 variant-soft">
          <div class="font-bold flex items-center">
            <Check class="w-5 h-5 text-primary-500 mr-2" />
            Is this a competitive game?
          </div>
          <p class="p-2">
            While there are competitive elements, Polycentricity primarily focuses on collaboration. Success
            is measured by how well the community thrives collectively, not by individual achievements.
          </p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="text-center py-8">
      <div class="flex justify-center space-x-4 mb-4">
        <a href="/about" class="anchor">About</a>
        <a href="/docs" class="anchor">Documentation</a>
        <a href="https://github.com/your-repo" class="anchor">GitHub</a>
      </div>
      <p class="text-sm opacity-70">© 2025 Polycentricity. All rights reserved.</p>
      <div class="flex justify-center space-x-3 mt-2">
        <a href="/privacy" class="text-xs opacity-50 hover:opacity-100">Privacy Policy</a>
        <a href="/terms" class="text-xs opacity-50 hover:opacity-100">Terms of Service</a>
        <a href="/license" class="text-xs opacity-50 hover:opacity-100">License</a>
      </div>
    </footer>
  </div>
</div>