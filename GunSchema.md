# Gun.js Database Schema

## Overview
This schema defines the data structure for a Gun.js-based Polycentricity governance game. It uses lightweight, top-level nodes with boolean maps for relationships, denormalized entries for single-pass reads, and optimizations for pagination, sharding, and debounced updates. SEA-ready fields are reserved for future authentication and encryption. The model is simple and relational, ensuring a clear User-Actor-Game-Card structure.  *Please Note the comments on "set_ref" for future consideration.

**Key Features:**
- **Boolean Maps Instead of Edges**: Uses `*_ref` fields as boolean maps (e.g., `{ card_1: true }`) rather than Gun.js pointer edges for simplified querying.
- **Denormalized Party Entries**: **Agreements** embed each party's `card_ref`, `obligation`, and `benefit` in `parties` for single-pass UI rendering.
- **SEA Integration**: Uses SEA pubkeys as user_ids; reserves `pub` field for authentication.
- **Pagination/Sharding**: Splits large boolean maps (e.g., `cards_ref`, `messages_ref`) into time- or page-based buckets.
- **Debounced Updates**: Batches or debounces high-frequency writes (e.g., `node_positions`).
- **Consistent ID Prefixes**: Uses uniform prefixes (`u_`, `g_`, `actor_`, `card_`, `ag_`, `chat_`, `msg_`, `value_`, `cap_`) for pattern-based code helpers.
- **Type Safety**: Aligns with TypeScript interfaces in `/types/index.ts`, using enums for status fields.
- **Future Edge Support**: Reserved `ref_set` field on each node for future Gun.js edge relationships.

**Implementation Note**: Originally `*_ref` fields were designed for Gun.js edges, but current implementation uses boolean maps for reduced complexity. Future consideration: rename to `*_map` and use `ref_set` for actual edges.

## Enums

### GameStatus
```typescript
enum GameStatus {
  CREATED = "created",
  SETUP = "setup", 
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed"
}
```

### AgreementStatus
```typescript
enum AgreementStatus {
  PROPOSED = "proposed",
  ACCEPTED = "accepted", 
  REJECTED = "rejected",
  COMPLETED = "completed"
}
```

## Nodes and Data Structures

### 1. Users
- **Path**: `users/<user_id>`
- **Description**: Represents a user in the system. User ID is now the SEA public key.
- **Fields**:
  ```typescript
  {
    user_id: string; // SEA pubkey, e.g., 'FDSF8XMx_Wjn7msT9JaRCeHTiw7PHA3pLco05Mc1OM0.xIyk5asm8NMqWA-9F368wNdkL1myrrfpcNlLoejlrP8'
    name: string; // e.g., 'Bjorn'
    email: string; // e.g., 'bjorn@endogon.com'
    pub?: string; // SEA public key (same as user_id, reserved for explicit reference)
    role: "Guest" | "Member" | "Admin";
    magic_key?: string; // Optional authentication key for verification emails
    expires_at?: number; // Magic key expiration timestamp
    created_at: number;
    last_login?: number;
    lastActiveAt?: number;
    games_ref?: Record<string, boolean>; // Boolean map of games user has joined
  }
  ```
- **Relationships**: Boolean maps, not Gun.js edges
  - **Users → Games**: `games_ref: { g_456: true, g_789: true }`
- **Implementation**:
  ```typescript
  await gun.get('users').get(userId).put({
    user_id: userId,
    name,
    email,
    pub: userId, // SEA pubkey
    role,
    magic_key,
    expires_at,
    created_at: Date.now(),
    games_ref: { [gameId]: true }
  });
  ```

### 2. Values
- **Path**: `values/<value_id>`
- **Description**: Represents a core value that cards can embody.
- **Fields**:
  ```typescript
  {
    value_id: string; // e.g., 'value_sustainability'
    name: string; // e.g., 'Sustainability'
    description?: string; // e.g., 'Promoting long-term environmental balance'
    creator_ref: string; // User ID who created this value
    cards_ref: Record<string, boolean>; // Boolean map of cards that have this value
    created_at: number;
  }
  ```
- **Relationships**: Boolean maps
  - **Values → Cards**: `cards_ref: { card_1: true, card_3: true }`

### 3. Capabilities
- **Path**: `capabilities/<capability_id>`
- **Description**: Represents a capability that cards can possess.
- **Fields**:
  ```typescript
  {
    capability_id: string; // e.g., 'cap_grant_writing'
    name: string; // e.g., 'Grant-writing expertise'
    description?: string; // e.g., 'Ability to secure funding through grants'
    creator_ref: string; // User ID who created this capability
    cards_ref: Record<string, boolean>; // Boolean map of cards that have this capability
    created_at: number;
  }
  ```
- **Relationships**: Boolean maps
  - **Capabilities → Cards**: `cards_ref: { card_1: true, card_4: true }`

### 4. Cards
- **Path**: `cards/<card_id>`
- **Description**: Represents a role card that actors can be assigned in games.
- **Fields**:
  ```typescript
  {
    card_id: string; // e.g., 'card_1'
    card_category: "Funders" | "Providers" | "Supporters" | string;
    card_number: number; // e.g., 1
    role_title: string; // e.g., 'Luminos Funder'
    type: "DAO" | "Practice" | "Individual" | "PMA" | "Collective" | string;
    backstory: string; // e.g., 'A wealthy idealist...'
    goals?: string; // e.g., 'Fund projects...'
    icon?: string; // e.g., 'sun'
    intellectual_property?: string; // e.g., 'Database of sustainable tech solutions...'
    obligations?: string; // e.g., 'Must report impact...'
    resources?: string; // e.g., '$50K in discretionary funds...'
    creator_ref: string; // User ID who created this card
    values_ref: Record<string, boolean>; // Boolean map of values, e.g., { value_sustainability: true }
    capabilities_ref: Record<string, boolean>; // Boolean map of capabilities, e.g., { cap_grant_writing: true }
    agreements_ref: Record<string, boolean>; // Boolean map of agreements involving this card
    decks_ref: Record<string, boolean>; // Boolean map of decks containing this card
    created_at: number;
    updated_at?: number;
  }
  ```
- **Relationships**: Boolean maps
  - **Cards → Values**: `values_ref: { value_sustainability: true, value_transparency: true }`
  - **Cards → Capabilities**: `capabilities_ref: { cap_grant_writing: true, cap_tech_scouting: true }`
  - **Cards → Agreements**: `agreements_ref: { ag_1: true, ag_3: true }`
  - **Cards → Decks**: `decks_ref: { d_1: true }`

### 5. Decks
- **Path**: `decks/<deck_id>`
- **Description**: Represents a collection of cards for specific game types.
- **Fields**:
  ```typescript
  {
    deck_id: string; // e.g., 'd_1'
    name: string; // e.g., 'Eco-Village Standard Deck'
    description?: string; // e.g., 'A standard deck for eco-village simulation games'
    creator_ref: string; // User ID who created this deck
    is_public: boolean; // e.g., true
    image_url?: string;
    cards_ref: Record<string, boolean>; // Boolean map of cards in this deck
    created_at: number;
    updated_at?: number;
  }
  ```
- **Relationships**: Boolean maps
  - **Decks → Cards**: `cards_ref: { card_1: true, card_2: true, card_3: true }`

### 6. Games
- **Path**: `games/<game_id>`
- **Description**: Represents a game instance where users play with assigned actor cards.
- **Fields**:
  ```typescript
  {
    game_id: string; // e.g., 'g_456'
    name: string; // e.g., 'Eco-Village Simulation'
    description?: string;
    creator_ref: string; // User ID who created the game
    deck_ref: string; // Deck ID used for this game
    deck_type: string; // e.g., 'eco-village'
    role_assignment_type?: "player-choice" | "random";
    status: GameStatus; // e.g., GameStatus.ACTIVE
    created_at: number;
    updated_at?: number;
    max_players?: number;
    password?: string;
    players: Record<string, boolean>; // Boolean map of users in game, e.g., { u_838: true }
    player_actor_map: Record<string, string | null>; // Maps user_id to actor_id, e.g., { u_838: 'actor_1' }
    actors_ref: Record<string, boolean>; // Boolean map of actors in game, e.g., { actor_1: true }
    agreements_ref: Record<string, boolean>; // Boolean map of agreements in game, e.g., { ag_1: true }
    chat_rooms_ref: Record<string, boolean>; // Boolean map of chat rooms, e.g., { chat_g_456: true }
    _isUserCreated?: boolean; // Tracking field for user-created games
    _isPlaceholder?: boolean; // Tracking field for placeholder games
    ref_set?: Record<string, string>; // Reserved for future Gun.js edge relationships
  }
  ```
- **Relationships**: Boolean maps and direct mapping
  - **Games → Players**: `players: { u_838: true, u_123: true }`
  - **Games → Actor Assignment**: `player_actor_map: { u_838: 'actor_1', u_123: 'actor_2' }`
  - **Games → Actors**: `actors_ref: { actor_1: true, actor_2: true }`
  - **Games → Agreements**: `agreements_ref: { ag_1: true, ag_2: true }`
  - **Games → Chat Rooms**: `chat_rooms_ref: { chat_g_456: true }`

### 7. Actors
- **Path**: `actors/<actor_id>`
- **Description**: An individual Identity that a user owns and can bring into one or more Games. Each Actor may join multiple Games and, within each Game, is associated with a specific Card.
- **Fields**:
  ```typescript
  {
    actor_id: string; // e.g., 'actor_1'
    user_ref: string | null; // Owning User ID (SEA pubkey) or null if unassigned
    games_ref: Record<string, boolean>; // Boolean map of games this Actor has joined
    cards_by_game: Record<string, string | null>; // Card assignment per Game, e.g., { g_456: 'card_1', g_789: null }
    actor_type: "National Identity" | "Sovereign Identity";
    custom_name?: string; // Optional display name, e.g., 'Alice's Luminos Funder'
    status: "active" | "inactive";
    agreements_ref: Record<string, boolean>; // Boolean map of agreements this Actor is part of
    created_at: number;
    updated_at?: number;
  }
  ```
- **Relationships**: Boolean maps and direct mapping
  - **Actors → User**: `user_ref: 'u_838'` (direct reference, not boolean map)
  - **Actors → Games**: `games_ref: { g_456: true, g_789: true }`
  - **Actors → Cards by Game**: `cards_by_game: { g_456: 'card_1', g_789: 'card_4' }`
  - **Actors → Agreements**: `agreements_ref: { ag_1: true, ag_3: true }`

### 8. Agreements
- **Path**: `agreements/<agreement_id>`
- **Description**: Represents a negotiated agreement between actors in a game.
- **Fields**:
  ```typescript
  {
    agreement_id: string; // e.g., 'ag_1'
    game_ref: string; // Game ID this agreement belongs to
    creator_ref: string; // User ID who created this agreement
    title: string; // e.g., 'Funding for Garden Initiative'
    summary?: string; // e.g., 'Luminos Funder provides capital...'
    type: "symmetric" | "asymmetric";
    status: AgreementStatus; // e.g., AgreementStatus.PROPOSED
    parties: Record<string, { 
      card_ref: string; 
      obligation: string; 
      benefit: string 
    }>; // Complex nested structure, e.g., { actor_1: { card_ref: 'card_1', obligation: 'Provide funding', benefit: 'Receive reports' } }
    cards_ref: Record<string, boolean>; // Boolean map of cards involved
    created_at: number;
    updated_at?: number;
    votes?: Record<string, "accept" | "reject" | "pending">; // Voting records by actor
  }
  ```
- **Relationships**: Boolean maps and nested structures
  - **Agreements → Game**: `game_ref: 'g_456'` (direct reference)
  - **Agreements → Creator**: `creator_ref: 'u_838'` (direct reference)
  - **Agreements → Parties**: Complex nested structure in `parties` field
  - **Agreements → Cards**: `cards_ref: { card_1: true, card_2: true }`

### 9. Chat Rooms
- **Path**: `chat_rooms/<chat_id>`
- **Description**: Represents a chat room for game or private conversations.
- **Fields**:
  ```typescript
  {
    chat_id: string; // e.g., 'chat_g_456' or 'chat_private_u_838_u_123'
    game_ref?: string; // Game ID for group chats
    type: "group" | "private";
    participants_ref: Record<string, boolean>; // Boolean map of participants (user_ids for private, actor_ids for group)
    messages_ref: Record<string, boolean>; // Boolean map of message buckets, e.g., { day_20250421: true }
    created_at: number;
    last_message_at?: number;
  }
  ```
- **Derived Types**:
  - **GameChatRoom**: For group chats, requires `game_ref` and uses `actor_ids` in `participants_ref`.
  - **PrivateChatRoom**: For private chats, uses `user_ids` in `participants_ref`.

### 10. Chat Messages
- **Path**: `chat_messages/<game_id>/<message_id>`
- **Description**: Represents a chat message in a game or private conversation.
- **Fields**:
  ```typescript
  {
    message_id: string; // e.g., 'msg_1'
    chat_ref: string; // Chat room ID
    game_ref: string; // Game ID
    sender_ref: string; // User ID of sender
    sender_name: string; // Display name of sender
    content: string; // Message content
    type: "group" | "private";
    recipient_ref?: string; // User ID for private messages
    read_by_ref: Record<string, boolean>; // Boolean map of users who have read the message
    created_at: number;
  }
  ```

### 11. Node Positions
- **Path**: `node_positions/<game_id>/<node_id>`
- **Description**: Stores D3 visualization coordinates for Cards, Agreements, and Actors.
- **Fields**:
  ```typescript
  {
    node_id: string; // e.g., 'card_1', 'ag_1', or 'actor_1'
    game_ref: string; // Game ID this position belongs to
    type: "card" | "agreement" | "actor";
    x: number; // X coordinate
    y: number; // Y coordinate
    updated_at: number;
  }
  ```

## Extended Interfaces for UI

### ActorWithCard
Enhanced Actor with populated card data for game context:
```typescript
interface ActorWithCard extends Actor {
  card?: CardWithPosition; // Card assigned in current game
  position?: { x: number; y: number }; // Optional stored layout position
}
```

### CardWithPosition
Card with D3 visualization positioning:
```typescript
interface CardWithPosition extends Card {
  position: { x: number; y: number }; // D3 force layout position
  _valueNames?: string[]; // Cached value names for performance
  _capabilityNames?: string[]; // Cached capability names for performance
}
```

### AgreementWithPosition
Agreement with D3 positioning and processed party data:
```typescript
interface AgreementWithPosition extends Agreement {
  position: { x: number; y: number }; // D3 force layout position
  partyItems?: PartyItem[]; // Processed party data for UI rendering
  obligations?: ObligationItem[]; // Processed obligations for D3
  benefits?: BenefitItem[]; // Processed benefits for D3
}
```

### GameContext
Complete game state for efficient single-pass loading:
```typescript
interface GameContext {
  game: Game; // Game instance with populated player data
  actors: ActorWithCard[]; // All actors with their assigned cards
  totalCards: number; // Total cards in deck
  usedCards: number; // Cards currently assigned to actors
  availableCards: CardWithPosition[]; // Unassigned cards with positions
  availableCardsCount: number; // Count of available cards
  agreements: AgreementWithPosition[]; // All agreements with positions and party data
  deckName: string; // Name of the deck being used
}
```

## Implementation Patterns

### Boolean Maps vs Gun.js Edges
Current implementation uses boolean maps for relationships:
```typescript
// Instead of Gun.js edges:
// gun.get('users').get(userId).get('games_ref').set(gun.get('games').get(gameId))

// We use boolean maps:
const currentGames = await getField(userPath, 'games_ref') || {};
currentGames[gameId] = true;
await write(userPath, 'games_ref', currentGames);
```

### Data Loading Strategy
The `getGameContext` function efficiently loads all game data in a single pass:
```typescript
// Load complete game state with all relationships resolved
const gameContext = await getGameContext(gameId);
// Returns: game, actors with cards, agreements with parties, available cards, etc.
```

### ref_set: Test Implementation for Edges with Metadata

The `ref_set` field implements a test pattern for Gun.js edges that can carry metadata, providing a pathway for future migration from boolean maps to true Gun.js relationships.

#### Current Implementation Pattern
```typescript
// In createGame function - creating edges with metadata
await createRelationship(
  `${nodes.games}/${gameId}`,
  "ref_set",
  `${nodes.users}/${user.user_id}`,
  { role: "creator" }
);
await createRelationship(
  `${nodes.games}/${gameId}`,
  "ref_set", 
  `${nodes.decks}/${deckRef}`,
  { role: "deck" }
);
```

#### createRelationship Function
The `createRelationship` function in gunService.ts handles edge creation with optional metadata:
```typescript
export async function createRelationship(
  fromSoul: string,        // Source node path: 'games/g_456'
  field: string,           // Edge field: 'ref_set'
  toSoul: string,          // Target node path: 'users/u_838'
  meta?: Record<string, any> // Optional metadata: { role: "creator" }
): Promise<GunAck>
```

#### Edge Structure with Metadata
When metadata is provided, the edge stores both the reference and additional data:
```typescript
// Without metadata (simple Gun.js reference):
gun.get(fromSoul).get(field).set(gun.get(toSoul))

// With metadata (enriched reference):
gun.get(fromSoul).get(field).set({ 
  "#": toSoul,           // Gun.js reference pointer
  role: "creator",       // Custom metadata
  // ... any other metadata fields
})
```

#### Data Structure Example
A game's `ref_set` field contains structured edges:
```json
{
  "games": {
    "g_456": {
      "game_id": "g_456",
      "name": "Eco-Village Simulation",
      // ... other game fields
      "ref_set": {
        "edge_1": {
          "#": "users/FDSF8XMx_Wjn7msT9JaRCeHTiw7PHA3pLco05Mc1OM0.xIyk5asm8NMqWA-9F368wNdkL1myrrfpcNlLoejlrP8",
          "role": "creator"
        },
        "edge_2": {
          "#": "decks/d_1", 
          "role": "deck"
        }
      }
    }
  }
}
```

#### Benefits of ref_set Pattern
1. **Metadata Support**: Unlike boolean maps, edges can carry semantic information
2. **Relationship Types**: The `role` field clarifies the nature of relationships
3. **Future Migration**: Provides a path to Gun.js edges while maintaining current functionality
4. **Backwards Compatibility**: Coexists with existing boolean map patterns

#### Migration Strategy
The current implementation maintains both patterns:
- **String References**: `creator_ref: "u_838"` for simple lookups
- **Boolean Maps**: `players: { u_838: true }` for collections
- **ref_set Edges**: `ref_set: [{ "#": "users/u_838", role: "creator" }]` for rich relationships

#### Future Considerations
- **Rename to ref_map**: Consider renaming `*_ref` boolean maps to `*_map` for clarity
- **Expand metadata**: Add timestamps, permissions, or other relationship metadata
- **Performance**: Test Gun.js edge performance vs boolean map performance at scale
- **Consistency**: Gradually migrate all relationships to use `ref_set` pattern

This test implementation demonstrates how Gun.js edges with metadata could replace the current boolean map system while providing richer relationship semantics.