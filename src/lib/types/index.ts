// User interface
export interface User {
    user_id: string;
    name: string;
    email: string;
    magic_key?: string;
    devices?: string; // Changed from string[] to string to avoid Gun.js storage issues
    created_at: number;
}

// Game interface
export interface Game {
    game_id: string;
    name: string;
    creator: string; // user_id of creator
    deck_type: string;
    deck?: any[]; // Deck of cards or game elements
    role_assignment?: Record<string, string>; // Mapping of user_id to role_id
    role_assignment_type?: string; // 'random' or 'player-choice'
    players: string[]; // Array of user_ids
    created_at: number;
    status: GameStatus;
}

// Actor/Role interface
export interface Actor {
    actor_id: string;
    role_title: string;
    backstory: string;
    values: string[];
    goals: string[];
    skills?: string[];
    resources?: string[];
    constraints?: string[];
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
    id: string;
    game_id: string;
    title: string;
    description: string;
    parties: string[]; // user_ids
    terms: string[];
    status: 'proposed' | 'accepted' | 'rejected' | 'completed';
    created_at: number;
    updated_at: number;
}
