# Gun.js Database Schema

## Overview
This schema defines the data structure for a Gun.js-based Polycentricity governance game. It uses lightweight, top-level nodes with clear edges, reverse indexes for efficient querying, denormalized entries for single-pass reads, and optimizations for pagination, sharding, and debounced updates. SEA-ready fields are reserved for future authentication and encryption. The model is simple and relational, ensuring a clear User-Actor-Game-Card structure.

**Key Features:**
- **Reverse Indexes**: Explicit child maps (e.g., `games/<game_id>/agreements_ref`) enable efficient querying with `map().once()`.
- **Denormalized Party Entries**: **Agreements** embed each party’s `card_ref`, `obligation`, and `benefit` in `parties` for single-pass UI rendering.
- **SEA Preparation**: Reserves `users/<user_id>/pub` for SEA public keys; `creator_ref` fields anchor future ACLs.
- **Pagination/Sharding**: Splits large boolean maps (e.g., `cards_ref`, `messages_ref`) into time- or page-based buckets.
- **Debounced Updates**: Batches or debounces high-frequency writes (e.g., `node_positions`).
- **Consistent ID Prefixes**: Uses uniform prefixes (`u_`, `g_`, `actor_`, `card_`, `ag_`, `chat_`, `msg_`, `value_`, `cap_`) for pattern-based code helpers.
- **Type Safety**: Aligns with TypeScript interfaces, using enums for status fields.

## Nodes and Edges

### 1. Users
- **Path**: `users/<user_id>`
- **Description**: Represents a user in the system (e.g., Bjorn).
- **Fields**:
  ```typescript
  {
    user_id: string; // e.g., 'u_838'
    name: string; // e.g., 'Bjorn'
    email: string; // e.g., 'bjorn@endogon.com'
    pub?: string; // SEA public key (reserved)
    role: 'Guest' | 'Member' | 'Admin';
    magic_key?: string; // Optional authentication key
    created_at: number;
    last_login?: number;
  }
  ```
- **Edges**:
  - **Users → Actors**: `users/<user_id>/actors_ref/<actor_id>: true`
    - Example: `users/u_838/actors_ref/actor_1: true`
  - **Users → Games**: `users/<user_id>/games_ref/<game_id>: true`
    - Example: `users/u_838/games_ref/g_456: true`
- **Implementation**:
  ```typescript
  await gun.get('users').get(userId).put({
    user_id: userId,
    name,
    email,
    pub,
    role,
    magic_key,
    created_at: Date.now(),
    last_login
  });
  await gun.get('users').get(userId).get('actors_ref').get(actorId).put(true);
  await gun.get('users').get(userId).get('games_ref').get(gameId).put(true);
  ```

### 2. Actors
- **Path**: `actors/<actor_id>`
- **Description**: Represents a user’s role in a game, linked to a Card.
- **Fields**:
  ```typescript
  {
    actor_id: string; // e.g., 'actor_1'
    user_ref: string | null; // e.g., 'u_838' or null if unassigned
    game_ref: string; // e.g., 'g_456'
    card_ref: string; // e.g., 'card_1'
    actor_type: 'National Identity' | 'Sovereign Identity' | 'Farmer' | 'Funder' | 'Builder' | 'Organizer' | 'Technologist';
    custom_name?: string; // e.g., 'Jobu'
    status: 'active' | 'inactive';
    agreements_ref: Record<string, boolean>; // e.g., { ag_1: true }
    created_at: number;
  }
  ```
- **Edges**:
  - **Actors → User**: `actors/<actor_id>/user_ref: <user_id>`
    - Example: `actors/actor_1/user_ref: u_838`
  - **Actors → Game**: `actors/<actor_id>/game_ref: <game_id>`
    - Example: `actors/actor_1/game_ref: g_456`
  - **Actors → Card**: `actors/<actor_id>/card_ref: <card_id>`
    - Example: `actors/actor_1/card_ref: card_1`
  - **Actors → Agreements**: `actors/<actor_id>/agreements_ref/<agreement_id>: true`
    - Example: `actors/actor_1/agreements_ref/ag_1: true`
  - **Games → Actors**: `games/<game_id>/actors_ref/<actor_id>: true`
    - Example: `games/g_456/actors_ref/actor_1: true`
- **Implementation**:
  ```typescript
  await gun.get('actors').get(actorId).put({
    actor_id: actorId,
    user_ref: userId || null,
    game_ref: gameId,
    card_ref: cardId,
    actor_type,
    custom_name,
    status: 'active',
    agreements_ref: {},
    created_at: Date.now()
  });
  await gun.get('games').get(gameId).get('actors_ref').get(actorId).put(true);
  await gun.get('actors').get(actorId).get('agreements_ref').get(agreementId).put(true);
  ```

### 3. Games
- **Path**: `games/<game_id>`
- **Description**: Represents a game instance (e.g., eco-village simulation).
- **Fields**:
  ```typescript
  {
    game_id: string; // e.g., 'g_456'
    name: string; // e.g., 'TestGame'
    description?: string;
    creator_ref: string; // e.g., 'u_838'
    deck_ref: string; // e.g., 'd1'
    deck_type: string; // e.g., 'eco-village'
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
    role_assignment_type?: 'player-choice' | 'random';
  }
  ```
- **Edges**:
  - **Games → Creator**: `games/<game_id>/creator_ref: <user_id>`
    - Example: `games/g_456/creator_ref: u_838`
  - **Games → Deck**: `games/<game_id>/deck_ref: <deck_id>`
    - Example: `games/g_456/deck_ref: d1`
  - **Games → Players**: `games/<game_id>/players/<user_id>: true`
    - Example: `games/g_456/players/u_838: true`
  - **Games → User-Actor Mapping**: `games/<game_id>/player_actor_map/<user_id>: <actor_id>`
    - Example: `games/g_456/player_actor_map/u_838: actor_1`
  - **Games → Actors**: `games/<game_id>/actors_ref/<actor_id>: true`
    - Example: `games/g_456/actors_ref/actor_1: true`
  - **Games → Agreements**: `games/<game_id>/agreements_ref/<agreement_id>: true`
    - Example: `games/g_456/agreements_ref/ag_1: true`
  - **Games → ChatRooms**: `games/<game_id>/chat_rooms_ref/<chat_id>: true`
    - Example: `games/g_456/chat_rooms_ref/chat_g_456: true`
- **Implementation**:
  ```typescript
  await gun.get('games').get(gameId).put({
    game_id: gameId,
    name,
    description,
    creator_ref: creatorId,
    deck_ref: deckId,
    deck_type: 'eco-village',
    status: 'active',
    created_at: Date.now(),
    players: { [creatorId]: true },
    player_actor_map: { [creatorId]: null },
    actors_ref: {},
    agreements_ref: {},
    chat_rooms_ref: {}
  });
  await gun.get('users').get(creatorId).get('games_ref').get(gameId).put(true);
  await gun.get('games').get(gameId).get('actors_ref').get(actorId).put(true);
  await gun.get('games').get(gameId).get('agreements_ref').get(agreementId).put(true);
  await gun.get('games').get(gameId).get('chat_rooms_ref').get(chatRoomId).put(true);
  ```

### 4. Decks
- **Path**: `decks/<deck_id>`
- **Description**: Represents a collection of Cards used in a game.
- **Fields**:
  ```typescript
  {
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
  ```
- **Edges**:
  - **Decks → Creator**: `decks/<deck_id>/creator_ref: <user_id>`
    - Example: `decks/d1/creator_ref: u_838`
  - **Decks → Cards**: `decks/<deck_id>/cards_ref/<card_id>: true`
    - Example: `decks/d1/cards_ref/card_1: true`
- **Pagination Tip**: For large decks, shard `cards_ref` into sub-maps (e.g., `cards_ref/page1`, `cards_ref/page2`).
- **Implementation**:
  ```typescript
  await gun.get('decks').get(deckId).put({
    deck_id: deckId,
    name,
    description,
    creator_ref: creatorId,
    is_public: true,
    image_url,
    cards_ref: {},
    created_at: Date.now(),
    updated_at: Date.now()
  });
  await gun.get('decks').get(deckId).get('cards_ref').get(cardId).put(true);
  ```

### 5. Cards
- **Path**: `cards/<card_id>`
- **Description**: Represents a role or entity in a game, with Values and Capabilities.
- **Fields**:
  ```typescript
  {
    card_id: string; // e.g., 'card_1'
    card_category: 'Funders' | 'Providers' | 'Supporters';
    card_number: number; // e.g., 1
    role_title: string; // e.g., 'Luminos Funder'
    type: 'DAO' | 'Practice' | 'Individual' | string;
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
  }
  ```
- **Edges**:
  - **Cards → Creator**: `cards/<card_id>/creator_ref: <user_id>`
    - Example: `cards/card_1/creator_ref: u_838`
  - **Cards → Values**: `cards/<card_id>/values_ref/<value_id>: true`
    - Example: `cards/card_1/values_ref/value_1: true`
  - **Cards → Capabilities**: `cards/<card_id>/capabilities_ref/<capability_id>: true`
    - Example: `cards/card_1/capabilities_ref/cap_1: true`
  - **Cards → Agreements**: `cards/<card_id>/agreements_ref/<agreement_id>: true`
    - Example: `cards/card_1/agreements_ref/ag_1: true`
  - **Cards → Decks**: `cards/<card_id>/decks_ref/<deck_id>: true`
    - Example: `cards/card_1/decks_ref/d1: true`
- **Implementation**:
  ```typescript
  await gun.get('cards').get(cardId).put({
    card_id: cardId,
    card_category: 'Funders',
    card_number: 1,
    role_title: 'Luminos Funder',
    type: 'Individual',
    backstory: 'A wealthy idealist...',
    goals: 'Fund projects...',
    icon: 'sun',
    intellectual_property: 'Database of sustainable tech solutions...',
    obligations: 'Must report impact...',
    resources: '$50K in discretionary funds...',
    creator_ref: creatorId,
    values_ref: {},
    capabilities_ref: {},
    agreements_ref: {},
    decks_ref: { [deckId]: true },
    created_at: Date.now()
  });
  await gun.get('values').get(valueId).get('cards_ref').get(cardId).put(true);
  await gun.get('capabilities').get(capabilityId).get('cards_ref').get(cardId).put(true);
  await gun.get('agreements').get(agreementId).get('cards_ref').get(cardId).put(true);
  await gun.get('decks').get(deckId).get('cards_ref').get(cardId).put(true);
  ```

### 6. Values
- **Path**: `values/<value_id>`
- **Description**: Represents a value associated with a Card (e.g., Sustainability).
- **Fields**:
  ```typescript
  {
    value_id: string; // e.g., 'value_1'
    name: string; // e.g., 'Sustainability'
    description?: string; // e.g., 'Promoting long-term environmental balance'
    creator_ref: string; // e.g., 'u_838'
    cards_ref: Record<string, boolean>; // e.g., { card_1: true }
    created_at: number;
  }
  ```
- **Edges**:
  - **Values → Creator**: `values/<value_id>/creator_ref: <user_id>`
    - Example: `values/value_1/creator_ref: u_838`
  - **Values → Cards**: `values/<value_id>/cards_ref/<card_id>: true`
    - Example: `values/value_1/cards_ref/card_1: true`
  - **Cards → Values**: `cards/<card_id>/values_ref/<value_id>: true`
    - Defined in Cards.
- **Implementation**:
  ```typescript
  await gun.get('values').get(valueId).put({
    value_id: valueId,
    name,
    description,
    creator_ref: creatorId,
    cards_ref: {},
    created_at: Date.now()
  });
  await gun.get('values').get(valueId).get('cards_ref').get(cardId).put(true);
  ```

### 7. Capabilities
- **Path**: `capabilities/<capability_id>`
- **Description**: Represents a capability associated with a Card (e.g., Grant-writing expertise).
- **Fields**:
  ```typescript
  {
    capability_id: string; // e.g., 'cap_1'
    name: string; // e.g., 'Grant-writing expertise'
    description?: string; // e.g., 'Ability to secure funding through grants'
    creator_ref: string; // e.g., 'u_838'
    cards_ref: Record<string, boolean>; // e.g., { card_1: true }
    created_at: number;
  }
  ```
- **Edges**:
  - **Capabilities → Creator**: `capabilities/<capability_id>/creator_ref: <user_id>`
    - Example: `capabilities/cap_1/creator_ref: u_838`
  - **Capabilities → Cards**: `capabilities/<capability_id>/cards_ref/<card_id>: true`
    - Example: `capabilities/cap_1/cards_ref/card_1: true`
  - **Cards → Capabilities**: `cards/<card_id>/capabilities_ref/<capability_id>: true`
    - Defined in Cards.
- **Implementation**:
  ```typescript
  await gun.get('capabilities').get(capabilityId).put({
    capability_id: capabilityId,
    name,
    description,
    creator_ref: creatorId,
    cards_ref: {},
    created_at: Date.now()
  });
  await gun.get('capabilities').get(capabilityId).get('cards_ref').get(cardId).put(true);
  ```

### 8. Agreements
- **Path**: `agreements/<agreement_id>`
- **Description**: Represents an agreement between Actors in a game.
- **Fields**:
  ```typescript
  {
    agreement_id: string; // e.g., 'ag_1'
    game_ref: string; // e.g., 'g_456'
    creator_ref: string; // e.g., 'u_838'
    title: string; // e.g., 'Funding for Garden Initiative'
    summary?: string; // e.g., 'Luminos Funder provides capital...'
    type: 'symmetric' | 'asymmetric';
    status: AgreementStatus; // e.g., 'proposed'
    parties: Record<string, { card_ref: string; obligation: string; benefit: string }>; // e.g., { actor_1: { card_ref: 'card_1', obligation: 'Create garden...', benefit: 'Receives funding...' } }
    cards_ref: Record<string, boolean>; // e.g., { card_1: true }
    created_at: number;
    updated_at?: number;
    votes?: Record<string, 'accept' | 'reject' | 'pending'>; // e.g., { actor_1: 'accept' }
  }
  ```
- **Edges**:
  - **Agreements → Game**: `agreements/<agreement_id>/game_ref: <game_id>`
    - Example: `agreements/ag_1/game_ref: g_456`
  - **Agreements → Creator**: `agreements/<agreement_id>/creator_ref: <user_id>`
    - Example: `agreements/ag_1/creator_ref: u_838`
  - **Agreements → Parties**: `agreements/<agreement_id>/parties/<actor_id>: { card_ref: <card_id>, obligation: string, benefit: string }`
    - Example: `agreements/ag_1/parties/actor_1: { card_ref: card_1, obligation: 'Create garden...', benefit: 'Receives funding...' }`
  - **Agreements → Cards**: `agreements/<agreement_id>/cards_ref/<card_id>: true`
    - Example: `agreements/ag_1/cards_ref/card_1: true`
  - **Games → Agreements**: `games/<game_id>/agreements_ref/<agreement_id>: true`
    - Example: `games/g_456/agreements_ref/ag_1: true`
  - **Cards → Agreements**: `cards/<card_id>/agreements_ref/<agreement_id>: true`
    - Defined in Cards.
- **Implementation**:
  ```typescript
  await gun.get('agreements').get(agreementId).put({
    agreement_id: agreementId,
    game_ref: gameId,
    creator_ref: creatorId,
    title,
    summary,
    type: 'asymmetric',
    status: 'proposed',
    parties: { [actorId]: { card_ref: cardId, obligation, benefit } },
    cards_ref: { [cardId]: true },
    created_at: Date.now(),
    votes: {}
  });
  await gun.get('games').get(gameId).get('agreements_ref').get(agreementId).put(true);
  await gun.get('agreements').get(agreementId).get('cards_ref').get(cardId).put(true);
  ```

### 9. ChatRooms
- **Path**: `chat_rooms/<chat_id>`
- **Description**: Represents a chat room for group or private communication.
- **Fields**:
  ```typescript
  {
    chat_id: string; // e.g., 'chat_g_456' or 'chat_private_u_838_u_123'
    game_ref?: string; // e.g., 'g_456' (required for group chats)
    type: 'group' | 'private';
    participants_ref: Record<string, boolean>; // e.g., { u_838: true } (user_ids for private, actor_ids for group)
    messages_ref: Record<string, boolean>; // e.g., { day_20250421: true }
    created_at: number;
    last_message_at?: number;
  }
  ```
- **Edges**:
  - **ChatRooms → Game**: `chat_rooms/<chat_id>/game_ref: <game_id>`
    - Example: `chat_rooms/chat_g_456/game_ref: g_456`
  - **ChatRooms → Participants**: `chat_rooms/<chat_id>/participants_ref/<user_id or actor_id>: true`
    - Example: `chat_rooms/chat_g_456/participants_ref/actor_1: true` (group) or `chat_rooms/chat_private_u_838_u_123/participants_ref/u_838: true` (private)
  - **ChatRooms → Messages**: `chat_rooms/<chat_id>/messages_ref/<bucket_id>: true`
    - Example: `chat_rooms/chat_g_456/messages_ref/day_20250421: true`
  - **Games → ChatRooms**: `games/<game_id>/chat_rooms_ref/<chat_id>: true`
    - Example: `games/g_456/chat_rooms_ref/chat_g_456: true`
- **Pagination Tip**: Shard `messages_ref` by date (e.g., `messages_ref/day_20250421`) to limit query size.
- **Implementation**:
  ```typescript
  await gun.get('chat_rooms').get(chatId).put({
    chat_id: chatId,
    game_ref: gameId,
    type: type, // 'group' or 'private'
    participants_ref: { [participantId]: true }, // user_id or actor_id
    messages_ref: {},
    created_at: Date.now()
  });
  await gun.get('games').get(gameId).get('chat_rooms_ref').get(chatId).put(true);
  await gun.get('chat_rooms').get(chatId).get('participants_ref').get(participantId).put(true);
  await gun.get('chat_rooms').get(chatId).get('messages_ref').get(`day_${new Date().toISOString().slice(0,10).replace(/-/g, '')}`).put(true);
  ```

### 10. Chat Messages
- **Path**: `chat_messages/<game_id>/<message_id>`
- **Description**: Represents a chat message in a game or private conversation.
- **Fields**:
  ```typescript
  {
    message_id: string; // e.g., 'msg_1'
    chat_ref: string; // e.g., 'chat_g_456'
    game_ref: string; // e.g., 'g_456'
    sender_ref: string; // e.g., 'u_838'
    sender_name: string; // e.g., 'Bjorn'
    content: string; // e.g., 'Let’s discuss the garden agreement'
    type: 'group' | 'private';
    recipient_ref?: string; // e.g., 'u_123'
    read_by_ref: Record<string, boolean>; // e.g., { u_838: true }
    created_at: number;
  }
  ```
- **Edges**:
  - **Chat Messages → ChatRoom**: `chat_messages/<game_id>/<message_id>/chat_ref: <chat_id>`
    - Example: `chat_messages/g_456/msg_1/chat_ref: chat_g_456`
  - **Chat Messages → Game**: `chat_messages/<game_id>/<message_id>/game_ref: <game_id>`
    - Example: `chat_messages/g_456/msg_1/game_ref: g_456`
  - **Chat Messages → Sender**: `chat_messages/<game_id>/<message_id>/sender_ref: <user_id>`
    - Example: `chat_messages/g_456/msg_1/sender_ref: u_838`
  - **Chat Messages → Recipient**: `chat_messages/<game_id>/<message_id>/recipient_ref: <user_id>`
    - Example: `chat_messages/g_456/msg_1/recipient_ref: u_123`
  - **Chat Messages → Read By**: `chat_messages/<game_id>/<message_id>/read_by_ref/<user_id>: true`
    - Example: `chat_messages/g_456/msg_1/read_by_ref/u_838: true`
  - **ChatRooms → Messages**: `chat_rooms/<chat_id>/messages_ref/<bucket_id>: true`
    - Defined in ChatRooms.
- **Pagination Tip**: Store messages in date-based buckets (e.g., `chat_messages/g_456/day_20250421/<message_id>`), referenced by `chat_rooms/<chat_id>/messages_ref/day_20250421`.
- **Implementation**:
  ```typescript
  const bucketId = `day_${new Date().toISOString().slice(0,10).replace(/-/g, '')}`;
  await gun.get('chat_messages').get(gameId).get(messageId).put({
    message_id: messageId,
    chat_ref: chatId,
    game_ref: gameId,
    sender_ref: userId,
    sender_name: name,
    content,
    type: 'group',
    recipient_ref: recipientId || null,
    read_by_ref: {},
    created_at: Date.now()
  });
  await gun.get('chat_rooms').get(chatId).get('messages_ref').get(bucketId).put(true);
  await gun.get('chat_messages').get(gameId).get(messageId).get('read_by_ref').get(userId).put(true);
  ```

### 11. node_positions
- **Path**: `node_positions/<game_id>/<node_id>`
- **Description**: Stores D3 visualization coordinates for Cards, Agreements, and Actors.
- **Fields**:
  ```typescript
  {
    node_id: string; // e.g., 'card_1', 'ag_1', or 'actor_1'
    game_ref: string; // e.g., 'g_456'
    type: 'card' | 'agreement' | 'actor';
    x: number; // e.g., 100
    y: number; // e.g., 200
    updated_at: number;
  }
  ```
- **Edges**:
  - **node_positions → Game**: `node_positions/<game_id>/<node_id>/game_ref: <game_id>`
    - Example: `node_positions/g_456/card_1/game_ref: g_456`
- **Debounce Tip**: Batch or debounce drag-drop writes to minimize write load (e.g., use a 100ms debounce for `put` operations).
- **Implementation**:
  ```typescript
  await gun.get('node_positions').get(gameId).get(nodeId).put({
    node_id: nodeId,
    game_ref: gameId,
    type: nodeType, // 'card', 'agreement', or 'actor'
    x,
    y,
    updated_at: Date.now()
  });
  ```

## D3 Visualization Types
For `D3CardBoard.svelte`:
- **CardWithPosition**:
  ```typescript
  interface CardWithPosition extends Card {
    position: { x: number; y: number };
    _valueNames?: string[];
    _capabilityNames?: string[];
  }
  ```
- **AgreementWithPosition**:
  ```typescript
  interface AgreementWithPosition extends Agreement {
    position: { x: number; y: number };
  }
  ```
- **D3Node**:
  ```typescript
  interface D3Node {
    id: string; // card_id, agreement_id, or actor_id
    name: string;
    type: 'card' | 'agreement' | 'actor';
    data: Card | Agreement | Actor;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
    active?: boolean;
    _valueNames?: string[];
    _capabilityNames?: string[];
  }
  ```
- **D3Link**:
  ```typescript
  interface D3Link {
    source: D3Node | string;
    target: D3Node | string;
    type?: 'obligation' | 'benefit';
    id?: string;
  }
  ```

## Enums
- **GameStatus**:
  ```typescript
  enum GameStatus {
    CREATED = 'created',
    SETUP = 'setup',
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed'
  }
  ```
- **AgreementStatus**:
  ```typescript
  enum AgreementStatus {
    PROPOSED = 'proposed',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
    COMPLETED = 'completed'
  }
  ```

## Implementation Notes
- **Top-Level Nodes**: Store at `users/<user_id>`, `games/<game_id>`, etc., avoiding nested structures.
- **Simple IDs**: Use prefixes (`u_`, `g_`, `actor_`, `card_`, `ag_`, `chat_`, `msg_`, `value_`, `cap_`) with formats like `<prefix><increment>` or `<prefix><name>_<timestamp>`.
- **Edges**: Use `_ref` fields for relationships (e.g., `creator_ref: u_838`) and `put` operations for child maps (e.g., `users/u_838/actors_ref/actor_1: true`).
- **No Circular References**: Store IDs, not objects, in `_ref` fields to prevent `[Circular]` loops.
- **SEA Integration**: Reserve `users/<user_id>/pub` for SEA public keys. Use `gun.user().create()/auth()` for authentication and sign writes with SEA. Optionally encrypt private chats with SEA.
- **Pagination/Sharding**: For collections exceeding ~500 entries (e.g., `cards_ref`, `messages_ref`), split into sub-maps (e.g., `cards_ref/page1`, `messages_ref/day_20250421`).
- **Debounced Updates**: Wrap high-frequency writes (e.g., `node_positions` during drag-drop) in a debounce (e.g., 100ms) to reduce write load.
- **Reactive Reads**: Use `gun.get(path).map().once(callback)` for streaming child maps and `gun.get(path).once(callback)` for single nodes.
- **Gun.js**: Follow best practices (https://gun.eco/docs/) with `put` for writes, `get`/`once` for reads, and `once` for write verification.
- **TypeScript**: Align with `/types/index.ts` for type safety, using `_ref` for relationships and enums for status fields.