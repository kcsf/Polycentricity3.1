<script lang="ts">
  import D3CardBoard from './D3CardBoard.svelte';
  import { getGameContext } from '$lib/services/gameService';
  import { currentGameStore } from '$lib/stores/gameStore';
  import type { Card, GameContext } from '$lib/types';
  
  // Use Svelte 5 Runes for props
  const { gameId, activeActorId = undefined } = $props<{ 
    gameId: string;
    activeActorId?: string | null;
  }>();
  
  // Local state with Svelte 5 Runes
  let isLoading = $state(true);
  let error = $state('');
  let cards = $state<Card[]>([]);
  
  // Use $effect instead of onMount for initialization (Svelte 5 Runes)
  $effect(async () => {
    console.log(`CardBoard: Initializing for game ${gameId}`);
    try {
      // This is just for UI feedback, the actual card loading happens in D3CardBoard
      isLoading = true;
      console.log(`CardBoard: Loading cards for game ${gameId}`);
      
      // Get available cards from gameContext
      const gameContext = await getGameContext(gameId);
      const availableCards = gameContext?.availableCards || [];
      console.log(`CardBoard: Loaded ${availableCards.length} cards`);
      
      if (availableCards.length === 0) {
        console.warn(`CardBoard: No cards available for game ${gameId}`);
      } else {
        console.log(`CardBoard: First card:`, availableCards[0]);
      }
      
      // Set cards to pass to D3CardBoard
      cards = availableCards;
      
      // Log the active actor for debugging
      if (activeActorId) {
        console.log(`CardBoard: Active actor: ${activeActorId}`);
      }
      
      isLoading = false;
    } catch (err) {
      console.error('CardBoard: Error initializing:', err);
      error = 'Failed to load card data';
      isLoading = false;
    }
  });
</script>

<div class="card-board-wrapper w-full h-full relative">
  {#if isLoading}
    <div class="loading-container flex items-center justify-center p-8 h-full">
      <div class="spinner variant-soft-primary w-12 h-12 rounded-full animate-spin"></div>
    </div>
  {:else if error}
    <div class="error-container p-8 text-center">
      <p class="text-error-500-400">{error}</p>
      <button class="btn variant-filled-primary mt-4" onclick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  {:else}
    <D3CardBoard {gameId} {activeActorId} {cards} />
  {/if}
</div>

<style>
  .card-board-wrapper {
    min-height: 500px;
    border-radius: 0.5rem;
    overflow: hidden;
    background-color: rgb(var(--color-surface-500) / 0.05);
  }
  
  .loading-container, .error-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgb(var(--color-surface-500) / 0.05);
  }
  
  .spinner {
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: rgb(var(--color-primary-500));
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>