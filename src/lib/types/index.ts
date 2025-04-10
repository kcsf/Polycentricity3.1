// User interface
export interface User {
    user_id: string;
    name: string;
    email: string;
    magic_key?: string;
    devices?: string; // Changed from string[] to string to avoid Gun.js storage issues
    created_at: number;
    role?: 'Guest' | 'Member' | 'Admin'; // Default is 'Guest'
}

// Game interface
export interface Game {
    game_id: string;
    name: string;
    creator: string; // user_id of creator
    deck_id: string; // Reference to deck used in this game
    role_assignment: 'random' | 'choice'; // How roles are assigned
    players: Record<string, boolean> | string[]; // Object with user_id keys, or array of user_ids for backward compatibility
    created_at: number;
    status: GameStatus;
}

// Card interface (static role templates)
export interface Card {
    card_id: string;
    role_title: string;
    backstory: string;
    values: string[];
    goals: string[];
    obligations?: string;
    capabilities?: string;
    intellectual_property?: string;
    rivalrous_resources?: string;
    card_category: 'Funders' | 'Providers' | 'Supporters';
    type: 'DAO' | 'Practice' | 'Individual' | string;
}

// Deck interface (collection of cards)
export interface Deck {
    deck_id: string;
    name: string;
    cards: Record<string, boolean> | string[]; // Card IDs
    creator: string; // user_id
}

// Actor interface (instance of card in game)
export interface Actor {
    actor_id: string;
    game_id: string;
    user_id: string;
    card_id: string;
}

// Chat message interface
export interface ChatMessage {
    id: string;
    game_id: string;
    user_id: string;
    user_name: string;
    content: string;
    timestamp: number;
    type: 'group' | 'private';
    recipient_id?: string; // For private messages
}

// Chat room interface
export interface ChatRoom {
    game_id: string;
    type: 'group' | 'private';
    participants: string[]; // user_ids
    messages: ChatMessage[];
}

// Game status enum
export enum GameStatus {
    CREATED = 'created',
    SETUP = 'setup',
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed'
}

// User session
export interface UserSession {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

// Role assignment
export interface RoleAssignment {
    user_id: string;
    actor_id: string;
}

// Agreement interface
export interface Agreement {
    agreement_id: string;
    game_id: string;
    title: string;
    summary: string;
    type: 'symmetric' | 'asymmetric';
    parties: string[]; // actor_ids
    obligations: Record<string, string>; // actor_id to obligation text
    benefits: Record<string, string>; // actor_id to benefit text
    status?: 'proposed' | 'accepted' | 'rejected' | 'completed';
    created_at: number;
    updated_at?: number;
}

// Node Position interface for graph layout
export interface NodePosition {
    node_id: string; // actor_id or agreement_id
    game_id: string;
    x: number;
    y: number;
}
