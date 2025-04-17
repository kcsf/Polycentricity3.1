<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import D3CardBoard from './D3CardBoard.svelte';
  import { getAvailableCardsForGame } from '$lib/services/gameService';
  import type { Card } from '$lib/types';
  
  export let gameId: string;
  export let activeActorId: string | undefined = undefined;
  
  let isLoading = true;
  let error = '';
  let cards: Card[] = [];
  let d3CardBoardComponent: D3CardBoard;
  
  // Function to refresh the board - called by parent or when new agreements are added
  export async function refreshBoard() {
    console.log(`CardBoard: Refreshing board for game ${gameId}`);
    try {
      // This is just for UI feedback, the actual card loading happens in D3CardBoard
      isLoading = true;
      
      // Pre-load cards
      const availableCards = await getAvailableCardsForGame(gameId);
      console.log(`CardBoard: Loaded ${availableCards.length} cards for refresh`);
      
      // Set cards to pass to D3CardBoard
      cards = availableCards;
      
      // Tell D3CardBoard to refresh its visualization
      if (d3CardBoardComponent) {
        d3CardBoardComponent.refreshVisualization();
      }
      
      isLoading = false;
    } catch (err) {
      console.error('CardBoard: Error refreshing:', err);
      isLoading = false;
    }
  }
  
  onMount(async () => {
    console.log(`CardBoard: Initializing for game ${gameId}`);
    try {
      // This is just for UI feedback, the actual card loading happens in D3CardBoard
      isLoading = true;
      console.log(`CardBoard: Loading cards for game ${gameId}`);
      
      // Pre-load cards (also happens in D3CardBoard, but this gives better error handling)
      const availableCards = await getAvailableCardsForGame(gameId);
      console.log(`CardBoard: Loaded ${availableCards.length} cards`);
      
      if (availableCards.length === 0) {
        console.warn(`CardBoard: No cards available for game ${gameId}`);
      } else {
        console.log(`CardBoard: First card:`, availableCards[0]);
      }
      
      // Set cards to pass to D3CardBoard
      cards = availableCards;
      
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
      <p class="text-error-500">{error}</p>
      <button class="btn variant-filled-primary mt-4" on:click={() => window.location.reload()}>
        Retry
      </button>
    </div>
  {:else}
    <D3CardBoard 
      bind:this={d3CardBoardComponent} 
      {gameId} 
      {activeActorId} 
      {cards} 
    />
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