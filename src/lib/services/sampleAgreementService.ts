import type { Card, Agreement, AgreementWithPosition } from '$lib/types';
import { nodes } from './gun-db';
import Gun from 'gun';

/**
 * Generates sample agreements between cards for demonstration purposes
 * 
 * @param cards - Array of card objects to create agreements between
 * @param gameId - ID of the game to associate agreements with
 * @param onlySave - If true, agreements are only saved to the database, not returned
 * @returns AgreementWithPosition[] - Array of agreement objects with position info
 */
export async function generateSampleAgreements(
  cards: Card[],
  gameId: string,
  onlySave: boolean = false
): Promise<AgreementWithPosition[]> {
  console.log("Generating sample agreements for cards:", {
    cardCount: cards.length,
    gameId,
    onlySave
  });
  
  if (!cards || cards.length < 2) {
    console.warn("Not enough cards to generate sample agreements");
    return [];
  }
  
  const gun = Gun();
  const agreements: AgreementWithPosition[] = [];

  // Create a map for actor to card mapping
  const actorCardMap = new Map<string, string>();
  
  // Fill the actor-card map
  cards.forEach(card => {
    if (card.actor_id) {
      actorCardMap.set(card.actor_id, card.card_id);
    } else {
      // If card doesn't have actor ID, create a synthetic one
      actorCardMap.set(`actor_${card.card_id}`, card.card_id);
    }
  });
  
  // Create agreements between consecutive pairs of cards
  // For demo purposes, we'll create agreements between cards in sequence
  // In a real application, you'd want more sophisticated logic for agreement creation
  for (let i = 0; i < Math.min(3, cards.length - 1); i++) {
    const card1 = cards[i];
    const card2 = cards[(i + 1) % cards.length];
    
    // Create synthetic actor IDs if cards don't have them
    const actorId1 = card1.actor_id || `actor_${card1.card_id}`;
    const actorId2 = card2.actor_id || `actor_${card2.card_id}`;
    
    // Generate a unique agreement ID
    const agreementId = `agreement_${gameId}_${Date.now()}_${i}`;
    
    // Create a test agreement
    const sampleAgreement: AgreementWithPosition = {
      agreement_id: agreementId,
      game_id: gameId,
      title: `Agreement ${i + 1}`,
      description: `Sample agreement between ${card1.role_title} and ${card2.role_title}`,
      obligations: [
        {
          id: `ob_${agreementId}_1`,
          fromActorId: actorId1,
          toActorId: actorId2,
          text: `Obligation from ${card1.role_title} to ${card2.role_title}`
        }
      ],
      benefits: [
        {
          id: `ben_${agreementId}_1`,
          fromActorId: actorId2,
          toActorId: actorId1,
          text: `Benefit from ${card2.role_title} to ${card1.role_title}`
        }
      ],
      parties: {
        [actorId1]: true,
        [actorId2]: true
      },
      position: {
        // Place agreement roughly midway between the two cards
        x: ((card1.position?.x || 0) + (card2.position?.x || 0)) / 2,
        y: ((card1.position?.y || 0) + (card2.position?.y || 0)) / 2
      },
      created_at: Date.now(),
      // These properties are added for Gun.js
      _: {
        '#': `agreements/${agreementId}`
      }
    };
    
    // Save agreement to Gun.js if requested
    if (onlySave) {
      try {
        gun.get(nodes.agreements).get(agreementId).put(sampleAgreement);
        
        // Also add to the game's agreements object
        gun.get(nodes.games).get(gameId).get('agreements').get(agreementId).put({ '#': `agreements/${agreementId}` });
        
        console.log(`Saved sample agreement ${agreementId} to database`);
      } catch (error) {
        console.error(`Error saving sample agreement ${agreementId}:`, error);
      }
    }
    
    agreements.push(sampleAgreement);
  }

  return agreements;
}

/**
 * Updates a game with sample agreements between its assigned cards
 * 
 * @param gameId - ID of the game to add agreements to
 * @returns Promise<{success: boolean, count: number, error?: string}>
 */
export async function addSampleAgreementsToGame(gameId: string): Promise<{success: boolean, count: number, error?: string}> {
  console.log(`Adding sample agreements to game ${gameId}`);
  
  try {
    const gun = Gun();
    
    // Get the game
    const gamePromise = new Promise<{cards: Card[], id: string}>((resolve, reject) => {
      gun.get(nodes.games).get(gameId).once(gameData => {
        if (!gameData) {
          reject(new Error(`Game ${gameId} not found`));
          return;
        }
        
        // Get the cards associated with this game
        const cards: Card[] = [];
        let actorsProcessed = 0;
        
        // Exit immediately if no actors
        if (!gameData.actors || Object.keys(gameData.actors).length === 0) {
          resolve({cards, id: gameId});
          return;
        }
        
        const actorIds = Object.keys(gameData.actors);
        
        actorIds.forEach(actorId => {
          gun.get(nodes.actors).get(actorId).once(actorData => {
            if (actorData && actorData.card_id) {
              gun.get(nodes.cards).get(actorData.card_id).once(cardData => {
                if (cardData) {
                  // Add a position property if missing
                  if (!cardData.position) {
                    cardData.position = {
                      x: Math.random() * 800, 
                      y: Math.random() * 600
                    };
                  }
                  
                  // Set actor_id on the card
                  cardData.actor_id = actorId;
                  
                  cards.push(cardData as Card);
                }
                
                actorsProcessed++;
                if (actorsProcessed === actorIds.length) {
                  resolve({cards, id: gameId});
                }
              });
            } else {
              actorsProcessed++;
              if (actorsProcessed === actorIds.length) {
                resolve({cards, id: gameId});
              }
            }
          });
        });
      });
    });
    
    const {cards, id} = await gamePromise;
    
    if (cards.length < 2) {
      return {
        success: false,
        count: 0,
        error: "Not enough cards assigned to actors in this game to create agreements"
      };
    }
    
    // Generate and save sample agreements
    const agreements = await generateSampleAgreements(cards, id, true);
    
    return {
      success: true,
      count: agreements.length
    };
    
  } catch (error) {
    console.error("Error adding sample agreements to game:", error);
    return {
      success: false,
      count: 0,
      error: error.message || "Unknown error creating sample agreements"
    };
  }
}