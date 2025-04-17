import type { Agreement, Card } from '$lib/types';
import gun from './gun-db';
import { getCurrentUser } from './authService';
import { getGame, getGameActors, getAvailableCardsForGame } from './gameService';
import { uniqueId } from 'lodash-es';

// Define database nodes for consistent access
const nodes = {
  agreements: 'agreements',
  games: 'games',
  cards: 'cards',
  actors: 'actors'
};

/**
 * Generates sample agreements between cards for demonstration purposes
 * 
 * @param cards - Array of card objects to create agreements between
 * @param gameId - ID of the game to associate agreements with
 * @param onlySave - If true, agreements are only saved to the database, not returned
 * @returns Agreement[] - Array of agreement objects
 */
export async function generateSampleAgreements(
  cards: Card[],
  gameId: string,
  onlySave: boolean = false
): Promise<Agreement[]> {
  if (!cards || cards.length < 2) {
    throw new Error('Need at least 2 cards to create sample agreements');
  }

  console.log(`Generating sample agreements for ${cards.length} cards in game ${gameId}`);
  
  const agreements: Agreement[] = [];
  const user = getCurrentUser();
  const userId = user?.user_id || 'anonymous';
  
  // Shuffle and pick cards
  const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
  
  // We'll only use a subset of cards to avoid too many agreements
  const maxAgreements = Math.min(Math.floor(cards.length / 2), 5);
  
  for (let i = 0; i < maxAgreements; i++) {
    const card1 = shuffledCards[i * 2];
    const card2 = shuffledCards[i * 2 + 1];
    
    if (!card1 || !card2) continue;
    
    // Create a unique agreement ID
    const agreementId = `agmt_${uniqueId()}`;
    
    // Create a sample agreement between these two cards
    const sampleAgreement: Agreement = {
      agreement_id: agreementId,
      title: `Sample Agreement ${i+1}`,
      summary: `A sample agreement between ${card1.role_title || 'Card 1'} and ${card2.role_title || 'Card 2'}`,
      type: Math.random() > 0.5 ? 'symmetric' : 'asymmetric',
      status: 'accepted', // Use 'accepted' since 'active' is not in the enum
      created_at: Date.now(),
      created_by: userId,
      game_id: gameId,
      
      // Set the parties involved (using card IDs)
      parties: {
        [card1.card_id || 'unknown']: true,
        [card2.card_id || 'unknown']: true
      },
      
      // Define obligations for each party (convert array to string for type compatibility)
      obligations: {
        [card1.card_id || 'unknown']: `Provide ${getRandomResource()}; Share ${getRandomKnowledge()}`,
        [card2.card_id || 'unknown']: `Contribute ${getRandomService()}; Offer ${getRandomResource()}`
      },
      
      // Define benefits for each party (convert array to string for type compatibility)
      benefits: {
        [card1.card_id || 'unknown']: `Receive ${getRandomService()}; Access to ${getRandomResource()}`,
        [card2.card_id || 'unknown']: `Gain ${getRandomKnowledge()}; Obtain ${getRandomResource()}`
      }
    };
    
    // Save the agreement to the database
    if (onlySave || true) {  // Always save for now
      console.log(`Creating agreement ${agreementId} between ${card1.role_title} and ${card2.role_title}`);
      
      // Save the agreement to the database
      gun.get(nodes.agreements).get(agreementId).put(sampleAgreement);
      
      // Add agreement reference to the game - this is the key path that the visualization uses
      gun.get(nodes.games).get(gameId).get('agreements').get(agreementId).put(true);
      
      // Add agreement reference to each party's card
      gun.get(nodes.cards).get(card1.card_id || 'unknown').get('agreements').get(agreementId).put(true);
      gun.get(nodes.cards).get(card2.card_id || 'unknown').get('agreements').get(agreementId).put(true);
      
      // Add the parties to the cards map for relationship visualization
      if (card1.actor_id && card2.actor_id) {
        gun.get(nodes.actors).get(card1.actor_id).get('agreements').get(agreementId).put(true);
        gun.get(nodes.actors).get(card2.actor_id).get('agreements').get(agreementId).put(true);
      }
    }
    
    agreements.push(sampleAgreement);
  }
  
  console.log(`Generated ${agreements.length} sample agreements`);
  return agreements;
}

/**
 * Updates a game with sample agreements between its assigned cards
 * 
 * @param gameId - ID of the game to add agreements to
 * @returns Promise<{success: boolean, count: number, error?: string}>
 */
export async function addSampleAgreementsToGame(gameId: string): Promise<{success: boolean, count: number, error?: string}> {
  try {
    // Validate game ID
    if (!gameId) {
      return { success: false, count: 0, error: 'No game ID provided' };
    }
    
    // Fetch the game data
    const gameData = await getGame(gameId);
    if (!gameData) {
      return { success: false, count: 0, error: 'Game not found' };
    }
    
    // Get cards available in this game
    const gameCards = await getAvailableCardsForGame(gameId);
    
    // Check if we have enough cards
    if (!gameCards || gameCards.length < 2) {
      return { 
        success: false, 
        count: 0, 
        error: `Not enough cards in the game (found ${gameCards?.length || 0}, need at least 2)` 
      };
    }
    
    // Generate sample agreements
    const agreements = await generateSampleAgreements(gameCards, gameId, true);
    
    return { 
      success: true, 
      count: agreements.length
    };
    
  } catch (error) {
    console.error('Error adding sample agreements:', error);
    return { 
      success: false, 
      count: 0, 
      error: typeof error === 'object' && error !== null && 'message' in error 
        ? String(error.message) 
        : 'Unknown error creating agreements'
    };
  }
}

// Helper functions to generate random content
function getRandomResource(): string {
  const resources = [
    'seeds', 'tools', 'compost', 'water collection system', 
    'soil amendments', 'renewable energy system', 'greenhouse space',
    'land access', 'farming equipment', 'storage space'
  ];
  return resources[Math.floor(Math.random() * resources.length)];
}

function getRandomService(): string {
  const services = [
    'educational workshops', 'volunteer labor', 'marketing support', 
    'technical assistance', 'transportation', 'distribution network',
    'community outreach', 'project management', 'grant writing support',
    'food processing facilities'
  ];
  return services[Math.floor(Math.random() * services.length)];
}

function getRandomKnowledge(): string {
  const knowledge = [
    'seed saving techniques', 'permaculture design principles', 'composting methods',
    'regenerative farming practices', 'food preservation skills', 'water management strategies',
    'community organizing approaches', 'traditional ecological knowledge', 'natural building skills',
    'agroforestry systems'
  ];
  return knowledge[Math.floor(Math.random() * knowledge.length)];
}