/**
 * Optimized TypeScript types for Polycentricity Gun.js schema
 *
 * Key features:
 * - Aligns with Gun.js schema using `_ref` fields for relationships
 * - Uses Record<string, boolean> for collection references (reverse indexes)
 * - Includes enums for GameStatus and AgreementStatus
 * - Supports D3 visualization types for D3CardBoard.svelte
 * - Prepares for SEA integration with reserved fields
 * - Optimizes for pagination/sharding with Pager interface
 * - Supports specialized GameChatRoom and PrivateChatRoom interfaces
 * - Uses consistent ID prefixes (u_, g_, actor_, card_, ag_, chat_, msg_, value_, cap_)
 */

import * as d3 from "d3";
import type { SimulationNodeDatum } from "d3";

// Core Schema Types
// -----------------------------------------------

export interface User {
    user_id: string; // now the SEA pubkey
    name: string; // e.g., 'Bjorn'
    email: string; // e.g., 'bjorn@endogon.com'
    pub?: string; // SEA public key (reserved)
    role: "Guest" | "Member" | "Admin";
    magic_key?: string; // Optional authentication key
    expires_at?: number;
    created_at: number;
    last_login?: number;
    games_ref?: Record<string, boolean>;
    lastActiveAt?: number;
}

export interface Value {
    value_id: string; // e.g., 'value_1'
    name: string; // e.g., 'Sustainability'
    description?: string; // e.g., 'Promoting long-term environmental balance'
    creator_ref: string; // e.g., 'u_838'
    cards_ref: Record<string, boolean>; // e.g., { card_1: true }
    created_at: number;
}

export interface Capability {
    capability_id: string; // e.g., 'cap_1'
    name: string; // e.g., 'Grant-writing expertise'
    description?: string; // e.g., 'Ability to secure funding through grants'
    creator_ref: string; // e.g., 'u_838'
    cards_ref: Record<string, boolean>; // e.g., { card_1: true }
    created_at: number;
}

export interface Card {
    card_id: string; // e.g., 'card_1'
    card_category: "Funders" | "Providers" | "Supporters" | string;
    card_number: number; // e.g., 1
    role_title: string; // e.g., 'Luminos Funder'
    type: "DAO" | "Practice" | "Individual" | string;
    backstory: string; // e.g., 'A wealthy idealist...'
    goals?: string; // e.g., 'Fund projects...'
    icon?: string; // e.g., 'sun'
    intellectual_property?: string; // e.g., 'Database of sustainable tech solutions...'
    obligations?: string; // e.g., 'Must report impact...'
    resources?: string; // e.g., '$50K in discretionary funds...'
    creator_ref: string; // e.g., 'u_838'
    values_ref: Record<string, boolean>; // e.g., { value_1: true }
    capabilities_ref: Record<string, boolean>; // e.g., { cap_1: true }
    agreements_ref: Record<string, boolean>; // e.g., { ag_1: true }
    decks_ref: Record<string, boolean>; // e.g., { d1: true }
    created_at: number;
    updated_at?: number;
}

export interface Deck {
    deck_id: string; // e.g., 'd1'
    name: string; // e.g., 'Eco-Village Standard Deck'
    description?: string; // e.g., 'A standard deck for eco-village simulation games'
    creator_ref: string; // e.g., 'u_838'
    is_public: boolean; // e.g., true
    image_url?: string;
    cards_ref: Record<string, boolean>; // e.g., { card_1: true }
    created_at: number;
    updated_at?: number;
}

export interface Game {
    game_id: string; // e.g., 'g_456'
    name: string; // e.g., 'TestGame'
    description?: string;
    creator_ref: string; // e.g., 'u_838'
    deck_ref: string; // e.g., 'd1'
    deck_type: string; // e.g., 'eco-village'
    role_assignment_type?: "player-choice" | "random";
    status: GameStatus; // e.g., 'active'
    created_at: number;
    updated_at?: number;
    end_date?: number;
    max_players?: number;
    password?: string;
    players: Record<string, boolean>; // e.g., { u_838: true }
    player_actor_map: Record<string, string | null>; // e.g., { u_838: 'actor_1' }
    actors_ref: Record<string, boolean>; // e.g., { actor_1: true }
    agreements_ref: Record<string, boolean>; // e.g., { ag_1: true }
    chat_rooms_ref: Record<string, boolean>; // e.g., { chat_g_456: true }
    _isUserCreated?: boolean; // Add for tracking if user is the creator
    _isPlaceholder?: boolean; // Add for tracking placeholder games
}

export interface Actor {
    actor_id: string; // e.g., 'actor_1'
    user_ref: string | null; // e.g., 'u_838' or null if unassigned
    games_ref: Record<string, boolean>; // Games this Actor has joined, e.g., { g_456: true, g_789: true }
    cards_by_game: Record<string, string | null>; // Card assignment per Game, e.g., { g_456: 'card_1', g_789: 'card_4' }
    actor_type: "National Identity" | "Sovereign Identity";
    custom_name?: string; // e.g., 'Jobu'
    status: "active" | "inactive";
    agreements_ref: Record<string, boolean>; // e.g., { ag_1: true }
    created_at: number;
    updated_at?: number;
}

export interface ActorWithCard extends Actor {
    cards_by_game: Record<string, string | null>;
    /** Card assigned in this game */
    card?: CardWithPosition;
    /** Optional stored layout */
    position?: { x: number; y: number };
}

export interface ChatRoom {
    chat_id: string; // e.g., 'chat_g_456' or 'chat_private_u_838_u_123'
    game_ref?: string; // e.g., 'g_456' (required for group chats)
    type: "group" | "private";
    participants_ref: Record<string, boolean>; // e.g., { u_838: true } (user_ids for private chats, actor_ids for group chats linked via actors/<actor_id>/games_ref)
    messages_ref: Record<string, boolean>; // e.g., { day_20250421: true }
    created_at: number;
    last_message_at?: number;
}

export interface GameChatRoom extends ChatRoom {
    type: "group";
    game_ref: string; // Required
    participants_ref: Record<string, boolean>; // actor_ids, e.g., { actor_1: true } (linked via actors/<actor_id>/games_ref)
}

export interface PrivateChatRoom extends ChatRoom {
    type: "private";
    participants_ref: Record<string, boolean>; // user_ids, e.g., { u_838: true }
}

export interface ChatMessage {
    message_id: string; // e.g., 'msg_1'
    chat_ref: string; // e.g., 'chat_g_456'
    game_ref: string; // e.g., 'g_456'
    sender_ref: string; // e.g., 'u_838'
    sender_name: string; // e.g., 'Bjorn'
    content: string; // e.g., 'Let’s discuss the garden agreement'
    type: "group" | "private";
    recipient_ref?: string; // e.g., 'u_123'
    read_by_ref: Record<string, boolean>; // e.g., { u_838: true }
    created_at: number;
}

export interface Agreement {
    agreement_id: string; // e.g., 'ag_1'
    game_ref: string; // e.g., 'g_456'
    creator_ref: string; // e.g., 'u_838'
    title: string; // e.g., 'Funding for Garden Initiative'
    summary?: string; // e.g., 'Luminos Funder provides capital...'
    type: "symmetric" | "asymmetric";
    status: AgreementStatus; // e.g., 'proposed'
    parties: Record<
        string,
        { card_ref: string; obligation: string; benefit: string }
    >; // e.g., { actor_1: { card_ref: 'card_1', obligation: 'Create garden...', benefit: 'Receives funding...' } }
    cards_ref: Record<string, boolean>; // e.g., { card_1: true }
    created_at: number;
    updated_at?: number;
    votes?: Record<string, "accept" | "reject" | "pending">; // e.g., { actor_1: 'accept' }
}

export interface AgreementWithPosition extends Agreement {
    /** for layout */
    position: { x: number; y: number };

    /** for your D3 code */
    partyItems?: PartyItem[];
    obligations?: ObligationItem[];
    benefits?: BenefitItem[];
}

export interface NodePosition {
    node_id: string; // e.g., 'card_1', 'ag_1', or 'actor_1'
    game_ref: string; // e.g., 'g_456'
    type: "card" | "agreement" | "actor";
    x: number; // e.g., 100
    y: number; // e.g., 200
    updated_at: number;
}

export interface Pager<T> {
    items: Record<string, T>;
    nextCursor?: string;
}

export enum GameStatus {
    CREATED = "created",
    SETUP = "setup",
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
}

export enum AgreementStatus {
    PROPOSED = "proposed",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    COMPLETED = "completed",
}

export interface UserSession {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    lastError?: string | null;
}

export interface GameContext {
    game: Game;
    totalCards: number;
    usedCards: number;
    availableCards: CardWithPosition[];
    actors: ActorWithCard[];
    agreements: AgreementWithPosition[];
}

// -------------------------------------------------------------------
// — D3 visualization helpers
// -------------------------------------------------------------------

export interface CardWithPosition extends Card {
    /** your existing fields… */
    position?: { x: number; y: number };
    actor_id?: string;
    _valueNames?: string[];
    _capabilityNames?: string[];
}

export interface ObligationItem {
    id: string;
    fromActorId: string;
    toActorId?: string;
    text: string;
}

export interface BenefitItem {
    id: string;
    fromActorId: string;
    toActorId?: string;
    text: string;
}

export interface PartyItem {
    actorId: string;
    card: CardWithPosition;
    obligation: string;
    benefit: string;
}

export interface SubItem {
    id: string;
    label: string;
    angle: number;
    radius: number;
    nodeX: number;
    nodeY: number;
    category: string;
    categoryColor: string;
    index: number;
    totalItems: number;
}

export interface D3Node extends SimulationNodeDatum {
    id: string;
    name: string;
    type: "actor" | "agreement" | "subnode";
    data: CardWithPosition | AgreementWithPosition | null;
    x: number;
    y: number;
    fx?: number | null;
    fy?: number | null;
    x0?: number;
    y0?: number;
    active?: boolean;
    _valueNames?: string[];
    _capabilityNames?: string[];
}

export interface D3Link {
    source: D3Node | string;
    target: D3Node | string;
    type?: "obligation" | "benefit" | "subnode";
    id?: string;
    angle?: number; // Angle for multi-party agreement links
}
export interface D3NodeWithRelationships extends D3Node {
    sourceCard?: D3Node;
    targetCard?: D3Node;
}

/**
 * GunAck interface for Gun.js acknowledgment messages
 */
export interface GunAck {
    err?: string;
    ok: boolean;
    raw?: any; // Original ack for debugging
}
