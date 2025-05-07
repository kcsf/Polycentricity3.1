<script lang="ts">
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  import { onMount } from 'svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import { loadIcons } from '$lib/stores/iconStore';
  import type { Card } from '$lib/types';

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

<div class="bg-gradient-to-b from-surface-900 to-surface-800 min-h-screen flex items-center justify-center">
  <div class="container px-4 py-16">
    
    <!-- Header Section -->
    <div class="card p-8 variant-glass-surface backdrop-blur-lg border border-surface-300-600-token/20 shadow-xl mb-12">
      <div class="text-center">
        <div class="flex justify-center mb-6">
          <div class="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-primary-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>
          </div>
        </div>
        <h1 class="h1 text-primary-500 mb-2">Polycentricity3</h1>
        <h3 class="h3 mb-6">A Decentralized Eco-Village Simulation</h3>
        <p class="text-lg max-w-2xl mx-auto mb-8">
          Design, negotiate, and build a sustainable community through collaborative decision-making, strategic resource management, and value-driven partnerships.
        </p>
        <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <a href="/register" class="btn btn-lg variant-filled-primary">Get Started</a>
          <a href="/login" class="btn btn-lg variant-ghost-surface">Sign In</a>
        </div>
      </div>
    </div>
    
    <!-- Features Section -->
    <div class="grid grid-cols-1 gap-6 mb-12">
      <!-- Feature 1 -->
      <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600-token/20 shadow-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-primary-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          </div>
          <div>
            <h3 class="h3 mb-2">Decentralized Platform</h3>
            <p>Built on Gun.js for resilient peer-to-peer data synchronization and community governance.</p>
          </div>
        </div>
      </div>
      
      <!-- Feature 2 -->
      <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600-token/20 shadow-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-secondary-500/20 flex items-center justify-center mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-secondary-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div>
            <h3 class="h3 mb-2">Collaborative Decision-Making</h3>
            <p>Form agreements, build coalitions, and work together to solve complex sustainability challenges.</p>
          </div>
        </div>
      </div>
      
      <!-- Feature 3 -->
      <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600-token/20 shadow-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-tertiary-500/20 flex items-center justify-center mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-tertiary-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>
          </div>
          <div>
            <h3 class="h3 mb-2">Dynamic Visualizations</h3>
            <p>Interactive D3.js visualizations help track community relationships, resources, and outcomes.</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Call to Action -->
    <div class="card p-8 variant-glass-surface text-center backdrop-blur-lg border border-surface-300-600-token/20 shadow-lg mb-12">
      <h2 class="h2 mb-4">Ready to Build a Sustainable Future?</h2>
      <p class="text-lg mb-6">Join our growing community of sustainability enthusiasts, policy makers, and problem solvers.</p>
      <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <a href="/dashboard" class="btn variant-filled-secondary">View Dashboard</a>
        <a href="/games" class="btn variant-filled-tertiary">Browse Games</a>
      </div>
    </div>
    
    <!-- FAQ Section -->
    <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600-token/20 shadow-lg mb-12">
      <h2 class="h2 text-center mb-6">Frequently Asked Questions</h2>
      
      <div class="space-y-4">
        <!-- FAQ 1 -->
        <div class="card p-4 variant-soft">
          <div class="font-bold flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-primary-500 mr-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>
            What is Polycentricity?
          </div>
          <p class="p-2">Polycentricity is an immersive eco-village simulation platform that enables collaborative sustainability planning. Players take on various roles to design, negotiate, and build a thriving community while balancing ecological, social, and economic factors.</p>
        </div>
        
        <!-- FAQ 2 -->
        <div class="card p-4 variant-soft">
          <div class="font-bold flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-primary-500 mr-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>
            How do I get started?
          </div>
          <p class="p-2">Simply register for an account, join an existing game or create a new one, select a role card that represents your skills and values, and begin collaborating with other players to build your sustainable community.</p>
        </div>
        
        <!-- FAQ 3 -->
        <div class="card p-4 variant-soft">
          <div class="font-bold flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-primary-500 mr-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>
            Is this a competitive game?
          </div>
          <p class="p-2">While there are competitive elements, Polycentricity primarily focuses on collaboration. Success is measured by how well the community thrives collectively, not by individual achievements.</p>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <footer class="text-center">
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