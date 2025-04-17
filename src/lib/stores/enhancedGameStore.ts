import { derived, get, writable } from 'svelte/store';
import type { Game, Actor, Agreement } from '$lib/types';
import { getGun, nodes, generateId } from '$lib/services/gunService';
import { userStore } from '$lib/stores/userStore';
import { getPlayerRole } from '$lib/services/gameService';

// Types for node positions
export interface NodePosition {
    x: number;
    y: number;
}

export interface ActorWithPosition extends Actor {
    position?: NodePosition;
}

export interface AgreementWithPosition extends Omit<Agreement, 'obligations' | 'benefits'> {
    id: string; // Match the ID field used in the application
    position?: NodePosition;
    parties: Record<string, boolean>; // actor_ids as keys with boolean values
    terms?: string; // Optional terms field
    description?: string; // Optional description field
    status: 'proposed' | 'accepted' | 'rejected' | 'completed';
    obligations: {
        id: string;
        fromActorId: string;
        description: string;
    }[];
    benefits: {
        id: string;
        toActorId: string;
        description: string;
    }[];
}

// State for agreement creation modal
export interface AgreementModalState {
    visible: boolean;
    editMode: boolean;
    agreement?: AgreementWithPosition | null;
}

// Stores
export const actors = writable<ActorWithPosition[]>([]);
export const agreements = writable<AgreementWithPosition[]>([]);
export const activeActorId = writable<string | null>(null);
export const activeGameId = writable<string | null>(null);
export const selectedNodeId = writable<string | null>(null);
export const selectedNodeType = writable<'actor' | 'agreement' | null>(null);
export const agreementModal = writable<AgreementModalState>({
    visible: false,
    editMode: false,
    agreement: null
});

// Selected node as a derived store
export const selectedNode = derived(
    [selectedNodeId, selectedNodeType, actors, agreements],
    ([$selectedNodeId, $selectedNodeType, $actors, $agreements]) => {
        if (!$selectedNodeId || !$selectedNodeType) return null;
        
        if ($selectedNodeType === 'actor') {
            return $actors.find(actor => actor.actor_id === $selectedNodeId) || null;
        } else if ($selectedNodeType === 'agreement') {
            return $agreements.find(agreement => agreement.id === $selectedNodeId) || null;
        }
        
        return null;
    }
);

const gun = getGun();

// Initialize the game board with data for a specific game
export async function initializeGameBoard(gameId: string) {
    if (!gameId) return;
    
    activeGameId.set(gameId);
    
    // Get the current user id
    const currentUser = get(userStore).user;
    if (!currentUser) {
        console.warn('No user is currently authenticated');
        return;
    }
    
    // Load the player's role (actor)
    const playerRole = await getPlayerRole(gameId, currentUser.user_id);
    if (playerRole) {
        // Set this player's actor as active
        activeActorId.set(playerRole.actor_id);
        
        // Convert to ActorWithPosition and add position data if available
        const actorWithPos: ActorWithPosition = {
            ...playerRole,
            position: await getNodePosition(playerRole.actor_id)
        };
        
        // Update the actors store
        actors.update(current => {
            // Remove the actor if it already exists
            const filtered = current.filter(a => a.actor_id !== playerRole.actor_id);
            // Add the updated actor
            return [...filtered, actorWithPos];
        });
    }
    
    // Load all agreements for this game
    loadAgreements(gameId);
    
    // Subscribe to future agreement changes
    subscribeToAgreements(gameId);
}

// Load agreements for a game
export async function loadAgreements(gameId: string) {
    if (!gameId) return;
    
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error('Gun.js instance not available');
        return;
    }
    
    return new Promise<void>((resolve) => {
        const agreementsList: AgreementWithPosition[] = [];
        
        gunInstance.get(nodes.agreements).map().once(async (agreement: any, agreementId: string) => {
            if (agreement && agreement.game_id === gameId) {
                // Get position data if available
                const position = await getNodePosition(agreementId);
                
                // Transform to AgreementWithPosition
                const agreementWithPos: AgreementWithPosition = {
                    id: agreementId,
                    game_id: agreement.game_id,
                    title: agreement.title || '',
                    parties: agreement.parties || {},
                    status: agreement.status || 'proposed',
                    created_at: agreement.created_at || Date.now(),
                    updated_at: agreement.updated_at || Date.now(),
                    description: agreement.description || '',
                    terms: agreement.terms || '',
                    position,
                    obligations: [], // We'll load these separately
                    benefits: []     // We'll load these separately
                };
                
                // Load obligations and benefits
                await loadAgreementRelations(agreementWithPos);
                
                agreementsList.push(agreementWithPos);
                
                // Update the agreements store
                agreements.set(agreementsList);
            }
        });
        
        // Resolve after a short delay to ensure Gun.js has time to return data
        setTimeout(() => resolve(), 500);
    });
}

// Subscribe to agreement changes
export function subscribeToAgreements(gameId: string) {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error('Gun.js instance not available');
        return;
    }
    
    gunInstance.get(nodes.agreements).map().on(async (agreement: any, agreementId: string) => {
        if (agreement && agreement.game_id === gameId) {
            // Get position data if available
            const position = await getNodePosition(agreementId);
            
            // Transform to AgreementWithPosition
            const agreementWithPos: AgreementWithPosition = {
                id: agreementId,
                game_id: agreement.game_id,
                title: agreement.title || '',
                parties: agreement.parties || {},
                status: agreement.status || 'proposed',
                created_at: agreement.created_at || Date.now(),
                updated_at: agreement.updated_at || Date.now(),
                description: agreement.description || '',
                terms: agreement.terms || '',
                position,
                obligations: [], // We'll load these separately
                benefits: []     // We'll load these separately
            };
            
            // Load obligations and benefits
            await loadAgreementRelations(agreementWithPos);
            
            // Update the agreements store
            agreements.update(current => {
                // Remove the agreement if it already exists
                const filtered = current.filter(a => a.id !== agreementId);
                // Add the updated agreement
                return [...filtered, agreementWithPos];
            });
        }
    });
}

// Load obligations and benefits for an agreement
async function loadAgreementRelations(agreement: AgreementWithPosition) {
    if (!gun) return Promise.resolve();
    
    return new Promise<void>((resolve) => {
        const gunInstance = getGun();
        
        // Load obligations from custom node path
        gunInstance.get('obligations').map().once((obligation: any, obligationId: string) => {
            if (obligation && obligation.agreementId === agreement.id) {
                agreement.obligations.push({
                    id: obligationId,
                    fromActorId: obligation.fromActorId,
                    description: obligation.description
                });
            }
        });
        
        // Load benefits from custom node path
        gunInstance.get('benefits').map().once((benefit: any, benefitId: string) => {
            if (benefit && benefit.agreementId === agreement.id) {
                agreement.benefits.push({
                    id: benefitId,
                    toActorId: benefit.toActorId,
                    description: benefit.description
                });
            }
        });
        
        // Resolve after a short delay to ensure Gun.js has time to return data
        setTimeout(() => resolve(), 300);
    });
}

// Get position data for a node
async function getNodePosition(nodeId: string): Promise<NodePosition | undefined> {
    if (!gun) return Promise.resolve(undefined);
    
    return new Promise((resolve) => {
        const gunInstance = getGun();
        gunInstance.get(nodes.positions).get(nodeId).once((position: NodePosition) => {
            resolve(position);
        });
        
        // Resolve with undefined after a timeout if no position is found
        setTimeout(() => resolve(undefined), 300);
    });
}

// Update a node's position in the database
export function updateNodePosition(nodeId: string, x: number, y: number) {
    const position = { x, y };
    
    // Save to Gun.js if available
    const gunInstance = getGun();
    if (gunInstance) {
        gunInstance.get(nodes.positions).get(nodeId).put(position);
    }
    
    // Update local stores
    actors.update(current => {
        return current.map(actor => {
            if (actor.actor_id === nodeId) {
                return { ...actor, position };
            }
            return actor;
        });
    });
    
    agreements.update(current => {
        return current.map(agreement => {
            if (agreement.id === nodeId) {
                return { ...agreement, position };
            }
            return agreement;
        });
    });
}

// Select a node (actor or agreement)
export function selectNode(nodeId: string, nodeType: 'actor' | 'agreement') {
    selectedNodeId.set(nodeId);
    selectedNodeType.set(nodeType);
    
    // If it's an actor, also update activeActorId
    if (nodeType === 'actor') {
        activeActorId.set(nodeId);
    }
}

// Clear selected node
export function clearSelectedNode() {
    selectedNodeId.set(null);
    selectedNodeType.set(null);
}

// Toggle agreement modal
export function toggleAgreementModal(editMode = false, agreement: AgreementWithPosition | null = null) {
    agreementModal.update(state => ({
        visible: !state.visible,
        editMode,
        agreement
    }));
}

// Create a new agreement
export async function createAgreement(agreement: Omit<AgreementWithPosition, 'id' | 'created_at' | 'updated_at'>) {
    const gameId = get(activeGameId);
    if (!gameId) {
        console.error('No active game to create an agreement for');
        return null;
    }
    
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error('Gun.js instance not available');
        return null;
    }
    
    const agreementId = generateId();
    const timestamp = Date.now();
    
    // Extract all properties except game_id from the agreement parameter
    const { game_id: _, ...agreementProps } = agreement as any;
    
    const newAgreement: AgreementWithPosition = {
        id: agreementId,
        game_id: gameId,
        created_at: timestamp,
        updated_at: timestamp,
        ...agreementProps
    };
    
    // Save to Gun.js
    gunInstance.get(nodes.agreements).get(agreementId).put({
        id: agreementId,
        game_id: gameId,
        title: newAgreement.title,
        description: newAgreement.description,
        parties: newAgreement.parties,
        terms: newAgreement.terms,
        status: newAgreement.status,
        created_at: timestamp,
        updated_at: timestamp
    });
    
    // Save obligations
    for (const obligation of newAgreement.obligations) {
        const obligationId = generateId();
        gunInstance.get('obligations').get(obligationId).put({
            id: obligationId,
            agreementId: agreementId,
            fromActorId: obligation.fromActorId,
            description: obligation.description
        });
    }
    
    // Save benefits
    for (const benefit of newAgreement.benefits) {
        const benefitId = generateId();
        gunInstance.get('benefits').get(benefitId).put({
            id: benefitId,
            agreementId: agreementId,
            toActorId: benefit.toActorId,
            description: benefit.description
        });
    }
    
    return newAgreement;
}

// Update an existing agreement
export async function updateAgreement(agreementId: string, updates: Partial<Omit<AgreementWithPosition, 'id' | 'created_at'>>) {
    const timestamp = Date.now();
    
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error('Gun.js instance not available');
        return;
    }
    
    // Update in Gun.js
    gunInstance.get(nodes.agreements).get(agreementId).put({
        ...updates,
        updated_at: timestamp
    });
    
    // Handle relationship updates if needed
    if (updates.obligations) {
        // First delete existing obligations
        gunInstance.get('obligations').map().once((obligation: any, obligationId: string) => {
            if (obligation && obligation.agreementId === agreementId) {
                gunInstance.get('obligations').get(obligationId).put(null);
            }
        });
        
        // Then add the new ones
        for (const obligation of updates.obligations) {
            const obligationId = generateId();
            gunInstance.get('obligations').get(obligationId).put({
                id: obligationId,
                agreementId: agreementId,
                fromActorId: obligation.fromActorId,
                description: obligation.description
            });
        }
    }
    
    if (updates.benefits) {
        // First delete existing benefits
        gunInstance.get('benefits').map().once((benefit: any, benefitId: string) => {
            if (benefit && benefit.agreementId === agreementId) {
                gunInstance.get('benefits').get(benefitId).put(null);
            }
        });
        
        // Then add the new ones
        for (const benefit of updates.benefits) {
            const benefitId = generateId();
            gunInstance.get('benefits').get(benefitId).put({
                id: benefitId,
                agreementId: agreementId,
                toActorId: benefit.toActorId,
                description: benefit.description
            });
        }
    }
    
    // Update local store
    agreements.update(current => {
        return current.map(agreement => {
            if (agreement.id === agreementId) {
                return { 
                    ...agreement, 
                    ...updates, 
                    updated_at: timestamp 
                };
            }
            return agreement;
        });
    });
}

// Delete an agreement
export async function deleteAgreement(agreementId: string) {
    const gunInstance = getGun();
    if (!gunInstance) {
        console.error('Gun.js instance not available');
        return;
    }
    
    // Delete from Gun.js
    gunInstance.get(nodes.agreements).get(agreementId).put(null);
    
    // Also delete associated obligations and benefits
    gunInstance.get('obligations').map().once((obligation: any, obligationId: string) => {
        if (obligation && obligation.agreementId === agreementId) {
            gunInstance.get('obligations').get(obligationId).put(null);
        }
    });
    
    gunInstance.get('benefits').map().once((benefit: any, benefitId: string) => {
        if (benefit && benefit.agreementId === agreementId) {
            gunInstance.get('benefits').get(benefitId).put(null);
        }
    });
    
    // Update local store
    agreements.update(current => current.filter(agreement => agreement.id !== agreementId));
}

// Explicitly set the active actor ID
export function setActiveActorId(actorId: string | null) {
    console.log(`Setting active actor ID to: ${actorId}`);
    activeActorId.set(actorId);
}

// Export a combined store for D3GameBoard
export default {
    actors,
    agreements,
    activeActorId,
    selectedNode,
    selectedNodeType,
    updateNodePosition,
    selectNode,
    clearSelectedNode,
    toggleAgreementModal,
    createAgreement,
    updateAgreement,
    deleteAgreement,
    initializeGameBoard,
    setActiveActorId
};