<script lang="ts">
  import { onMount } from 'svelte';
  import { 
  AlertTriangle, 
  CheckCircle, 
  Database, 
  FileText,
  FilePen, 
  HardDrive, 
  Network,
  RefreshCcw,
  RefreshCw, 
  Shield, 
  Radiation,
  Trash2,
  UserCog,
  UserX,
  Users,
  Wrench
} from '@lucide/svelte';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import AdminTools from './AdminTools.svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import { initializeSampleData, verifySampleData } from '$lib/services/sampleDataService';
  
  // Sample data initialization variables
  let isInitializingSample = $state(false);
  let sampleDataError = $state<string | null>(null);
  let sampleDataSuccess = $state(false);
  let sampleDataResult = $state<{ success: boolean; message: string } | null>(null);
  
  // For accordion sections - empty array means all accordions are closed by default
  let accordionValue = $state([]);
  
  // Cleanup functions
  import { 
    cleanupAllUsers, 
    cleanupAllGames, 
    cleanupAllDecks, 
    cleanupAllCards, 
    cleanupAllActors,
    cleanupAllAgreements
  } from '$lib/services/cleanupService';
  
  let cleanupLoading = $state(false);
  let cleanupError = $state<string | null>(null);
  let cleanupSuccess = $state(false);
  let cleanupResult = $state<{ success: boolean; removed: number } | null>(null);
  
  async function handleCleanupGames() {
    if (!confirm('Are you sure you want to remove ALL games? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all games');
      cleanupResult = await cleanupAllGames();
      console.log('Games cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
    } catch (err) {
      console.error('Error cleaning up games:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  async function handleCleanupDecks() {
    if (!confirm('Are you sure you want to remove ALL decks? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all decks');
      cleanupResult = await cleanupAllDecks();
      console.log('Decks cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
      
    } catch (err) {
      console.error('Error cleaning up decks:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  async function handleCleanupCards() {
    if (!confirm('Are you sure you want to remove ALL cards? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all cards');
      cleanupResult = await cleanupAllCards();
      console.log('Cards cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
      
    } catch (err) {
      console.error('Error cleaning up cards:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  async function handleCleanupUsers() {
    if (!confirm('Are you sure you want to remove ALL users except your current user? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all users');
      cleanupResult = await cleanupAllUsers();
      console.log('Users cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
    } catch (err) {
      console.error('Error cleaning up users:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  async function handleCleanupActors() {
    if (!confirm('Are you sure you want to remove ALL actors? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all actors');
      cleanupResult = await cleanupAllActors();
      console.log('Actors cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
    } catch (err) {
      console.error('Error cleaning up actors:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  async function handleCleanupAgreements() {
    if (!confirm('Are you sure you want to remove ALL agreements? This action cannot be undone.')) {
      return;
    }
    
    cleanupLoading = true;
    cleanupError = null;
    cleanupSuccess = false;
    
    try {
      console.log('Starting cleanup of all agreements');
      cleanupResult = await cleanupAllAgreements();
      console.log('Agreements cleanup complete', cleanupResult);
      cleanupSuccess = cleanupResult.success;
    } catch (err) {
      console.error('Error cleaning up agreements:', err);
      cleanupError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cleanupLoading = false;
    }
  }
  
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  

  
  // Variables for card enhancement function
  let isEnhancingCards = $state(false);
  let cardEnhanceError = $state<string | null>(null);
  let cardEnhanceSuccess = $state(false);
  let cardEnhanceResult = $state<{ success: boolean; cardsUpdated: number } | null>(null);
  
  // Enhance cards with values and capabilities function
  async function enhanceCardValues() {
    if (!confirm('Are you sure you want to enhance all cards with additional values and capabilities? This will ensure each card has at least 3 values and 3 capabilities.')) {
      return;
    }
    
    isEnhancingCards = true;
    cardEnhanceError = null;
    cardEnhanceSuccess = false;
    
    try {
      console.log('Starting card value and capability enhancement...');
      cardEnhanceResult = await enhanceCardValuesAndCapabilities();
      console.log('Card enhancement complete', cardEnhanceResult);
      cardEnhanceSuccess = cardEnhanceResult.success;
      
      // Dispatch a custom event for parent components
      dispatch('cardsEnhanced', cardEnhanceResult);
    } catch (err) {
      console.error('Error enhancing cards:', err);
      cardEnhanceError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      isEnhancingCards = false;
    }
  }

  // Initialize sample data function
  async function initializeSampleDataFunction() {
    if (!confirm('Are you sure you want to initialize sample data? This will add new sample users, cards, decks, games, actors, agreements, and node positions.')) {
      return;
    }
    
    isInitializingSample = true;
    sampleDataError = null;
    sampleDataSuccess = false;
    
    try {
      console.log('Starting sample data initialization...');
      sampleDataResult = await initializeSampleData();
      console.log('Sample data initialization complete', sampleDataResult);
      sampleDataSuccess = sampleDataResult.success;
      
      // Dispatch a custom event for parent components
      dispatch('sampleDataInitialized', sampleDataResult);
    } catch (err) {
      console.error('Error initializing sample data:', err);
      sampleDataError = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      isInitializingSample = false;
    }
  }
  
  // Helper function to log current game relationships for debugging
  async function logCurrentGameRelationships() {
    const gun = getGun();
    if (!gun) return;
    
    return new Promise<void>(resolve => {
      let gamesFound = 0;
      let gamesWithUsers = 0;
      let gamesWithActors = 0;
      let gamesWithDecks = 0;
      
      gun.get(nodes.games).map().once((gameData, gameId) => {
        if (!gameData) return;
        
        gamesFound++;
        console.log(`Checking game ${gameId} relationships`);
        
        // Check for player references
        if (gameData.player_refs) {
          console.log(`- Game ${gameId} has player_refs:`, gameData.player_refs);
          gamesWithUsers++;
        }
        
        // Check for actor references
        if (gameData.actor_refs) {
          console.log(`- Game ${gameId} has actor_refs:`, gameData.actor_refs);
          gamesWithActors++;
        }
        
        // Check for deck references
        if (gameData.deck_ref) {
          console.log(`- Game ${gameId} has deck_ref:`, gameData.deck_ref);
          gamesWithDecks++;
        }
      });
      
      // Give it a moment to fetch data before resolving
      setTimeout(() => {
        console.log('Game relationship check complete:', {
          gamesFound,
          gamesWithUsers,
          gamesWithActors,
          gamesWithDecks
        });
        resolve();
      }, 1000);
    });
  }
  
  onMount(() => {
    // No initialization needed
  });
</script>

<div class="p-2">
  <div class="card p-4 bg-surface-100-800-token mb-4">
    <div class="flex items-center space-x-4">
      <Wrench class="text-primary-500" />
      <div>
        <h3 class="h4">Database Maintenance</h3>
        <p class="text-sm">Utilities for maintaining and optimizing your Gun.js database.</p>
      </div>
    </div>
  </div>
  
  <Accordion value={accordionValue} onValueChange={(e) => (accordionValue = e.value)} multiple>
    <!-- Schema Section -->
    <Accordion.Item value="schema">
      {#snippet lead()}
        <Database size={24} />
      {/snippet}
      
      {#snippet control()}Database Schema{/snippet}
      
      {#snippet panel()}
        <div class="p-4 bg-primary-500/10 border border-primary-500 rounded mb-4">
          <h4 class="font-semibold mb-2 flex items-center">
            <Database class="w-5 h-5 mr-2 text-primary-500" />
            Database Schema Management
          </h4>
          <p class="text-sm mb-4">
            Access the Database Schema page for detailed documentation, initialization, and verification tools.
          </p>
          <a href="/database-schema" class="btn variant-filled-primary w-full">
            <FileText class="w-4 h-4 mr-2" />
            View Database Schema
          </a>
        </div>
      {/snippet}
    </Accordion.Item>
    
    <hr class="hr" />
    
    <!-- Admin Tools Section -->
    <Accordion.Item value="admin">
      {#snippet lead()}
        <UserCog size={24} />
      {/snippet}
      
      {#snippet control()}Admin Tools{/snippet}
      
      {#snippet panel()}
        <div class="card p-4 bg-surface-200-800 border border-surface-300-600 mt-4">
          <div class="p-4 bg-primary-500/10 border border-primary-500 rounded mb-4">
            <h4 class="font-semibold mb-2 flex items-center">
              <Database class="w-5 h-5 mr-2 text-primary-500" />
              Sample Data Management
            </h4>
            <p class="text-sm mb-4">
              Initialize or reinitialize sample data for the application. This will create users, cards, decks, games,
              actors, agreements, chat messages, and proper relationships between them.
            </p>
            
            {#if isInitializingSample}
              <div class="flex items-center justify-center p-6">
                <div class="spinner-third w-8 h-8"></div>
                <span class="ml-3">Initializing Sample Data...</span>
              </div>
            {:else if sampleDataError}
              <div class="alert variant-filled-error">
                <AlertTriangle class="w-5 h-5" />
                <div class="alert-message">
                  <h3 class="h4">Error</h3>
                  <p>{sampleDataError}</p>
                </div>
                <div class="alert-actions">
                  <button class="btn variant-filled" onclick={initializeSampleDataFunction}>Retry</button>
                </div>
              </div>
            {:else if sampleDataSuccess}
              <div class="alert variant-filled-success">
                <CheckCircle class="w-5 h-5" />
                <div class="alert-message">
                  <h3 class="h4">Success</h3>
                  <p>{sampleDataResult?.message || "Sample data initialized successfully"}</p>
                </div>
              </div>
            {/if}
            
            <button 
              class="btn variant-filled-primary w-full mt-4" 
              onclick={initializeSampleDataFunction}
              disabled={isInitializingSample}
            >
              <RefreshCcw class="w-4 h-4 mr-2" />
              Reinitialize Sample Data
            </button>
          </div>
          
          <AdminTools />
        </div>
      {/snippet}
    </Accordion.Item>

    <hr class="hr" />
    
    <!-- Cleanup Section -->
    <Accordion.Item value="cleanup">
      {#snippet lead()}
        <Trash2 size={24} />
      {/snippet}
      
      {#snippet control()}Database Cleanup{/snippet}
      
      {#snippet panel()}
        <div class="p-4 bg-surface-100-800-token rounded mb-4 mt-4">
          <h4 class="font-semibold mb-2">⚠️ Danger Zone</h4>
          <p class="text-sm mb-4">
            These actions will permanently remove data from your database. Use with caution.
          </p>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Games</h5>
              <p class="text-xs mb-4">
                This will permanently delete all games in the database. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full" 
                onclick={handleCleanupGames}
                disabled={cleanupLoading}
              >
                <Trash2 class="w-4 h-4 mr-2" />
                Remove All Games
              </button>
            </div>
            
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Users</h5>
              <p class="text-xs mb-4">
                This will permanently delete all users except your current user. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full" 
                onclick={handleCleanupUsers}
                disabled={cleanupLoading}
              >
                <UserX class="w-4 h-4 mr-2" />
                Remove All Users
              </button>
            </div>
            
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Decks</h5>
              <p class="text-xs mb-4">
                This will permanently delete all decks in the database. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full" 
                onclick={handleCleanupDecks}
                disabled={cleanupLoading}
              >
                <Database class="w-4 h-4 mr-2" />
                Remove All Decks
              </button>
            </div>
            
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Cards</h5>
              <p class="text-xs mb-4">
                This will permanently delete all cards in the database. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full" 
                onclick={handleCleanupCards}
                disabled={cleanupLoading}
              >
                <FileText class="w-4 h-4 mr-2" />
                Remove All Cards
              </button>
            </div>
            
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Actors</h5>
              <p class="text-xs mb-4">
                This will permanently delete all actors in the database. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full" 
                onclick={handleCleanupActors}
                disabled={cleanupLoading}
              >
                <Users class="w-4 h-4 mr-2" />
                Remove All Actors
              </button>
            </div>
            
            <div class="p-4 bg-error-500/10 border border-error-500 rounded">
              <h5 class="font-semibold mb-2">Remove All Agreements</h5>
              <p class="text-xs mb-4">
                This will permanently delete all agreements in the database. This action cannot be undone.
              </p>
              <button 
                type="button"
                class="btn preset-filled-primary-500 w-full"
                onclick={handleCleanupAgreements}
                disabled={cleanupLoading}
              >
                <FileText class="w-4 h-4 mr-2" />
                Remove All Agreements
              </button>
            </div>
          </div>
          
          {#if cleanupLoading}
            <div class="flex items-center justify-center p-6 mt-4">
              <div class="spinner-third w-8 h-8"></div>
              <span class="ml-3">Processing cleanup operation...</span>
            </div>
          {:else if cleanupError}
            <div class="alert variant-filled-error mt-4">
              <AlertTriangle class="w-5 h-5" />
              <div class="alert-message">
                <h3 class="h4">Error</h3>
                <p>{cleanupError}</p>
              </div>
            </div>
          {:else if cleanupSuccess}
            <div class="alert variant-filled-success mt-4">
              <CheckCircle class="w-5 h-5" />
              <div class="alert-message">
                <h3 class="h4">Success</h3>
                <p>Successfully removed {cleanupResult?.removed} items.</p>
              </div>
            </div>
          {/if}
        </div>
      {/snippet}
    </Accordion.Item>
    
    <!-- End of Accordion -->
  </Accordion>
</div>