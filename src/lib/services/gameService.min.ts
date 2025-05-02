import {
  getGun,
  nodes,
  getCollection,
  putSigned,
  createRelationship,
  buildShardedPath,
  generateId,
  get,
} from "./gunService";
import { getCurrentUser } from "./authService";
import { currentGameStore } from "../stores/gameStore";
import type {
  Game,
  Actor,
  ActorWithCard,
  Card,
  CardWithPosition,
  Agreement,
  AgreementWithPosition,
  NodePosition,
} from "$lib/types";
import { GameStatus, AgreementStatus } from "$lib/types";

// Utility for random position (for D3 visualizations)
function randomPos(): { x: number; y: number } {
  return { x: Math.random() * 800, y: Math.random() * 600 };
}

export async function getGame(gameId: string): Promise<Game | null> {
  const data = await get<Game>(`${nodes.games}/${gameId}`);
  return data ? { ...data, game_id: gameId } : null;
}

/**
 * Get actors for a game directly, bypassing actors_ref
 */
export async function getActorsDirectly(gameId: string): Promise<ActorWithCard[]> {
  const gun = getGun();
  if (!gun) return [];
  
  try {
    // Get all actors first
    const allActors = await getCollection<Actor>(nodes.actors);
    console.log(`[getActorsDirectly] Found ${allActors.length} total actors`);
    
    // Filter to those belonging to this game
    const gameActors = allActors.filter(actor => 
      actor.games_ref && 
      actor.games_ref[gameId] === true
    );
    
    console.log(`[getActorsDirectly] Found ${gameActors.length} actors for game ${gameId}`);
    
    // Enhance actors with card data
    const actorsWithCards: ActorWithCard[] = [];
    
    for (const actor of gameActors) {
      const cardId = actor.cards_by_game?.[gameId];
      let card: CardWithPosition | undefined;
      
      if (cardId) {
        const rawCard = await get<Card>(`${nodes.cards}/${cardId}`);
        if (rawCard) {
          card = { ...rawCard, position: randomPos() };
        }
      }
      
      actorsWithCards.push({
        ...actor,
        card,
        position: randomPos()
      });
    }
    
    return actorsWithCards;
  } catch (err) {
    console.error(`[getActorsDirectly] Error:`, err);
    return [];
  }
}