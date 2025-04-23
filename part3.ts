  }

  const agreementSubscriptions: any[] = [];
  let initialLoad = true;

  const gameSubscription = gun.get(nodes.games).get(gameId).get('agreements_ref').on((data: any) => {
    if (data && data['#']) {
      const agreementId = data['#'].split('/').pop();
      if (agreementId && agreementId !== '_') {
        const subscription = gun.get(nodes.agreements).get(agreementId).on((agreement: Agreement) => {
          if (agreement && agreement.game_ref === gameId) {
            const agreementWithPos: AgreementWithPosition = {
              ...agreement,
              position: agreementCache.has(agreementId) ? agreementCache.get(agreementId)!.position : { x: Math.random() * 800, y: Math.random() * 600 }
            };
            cacheAgreement(agreementId, agreementWithPos);
            const agreements = Array.from(agreementCache.values()).filter(a => a.game_ref === gameId);
            callback(agreements);
          }
        });
        agreementSubscriptions.push(subscription);
      }
    }
  });

  if (initialLoad) {
    initialLoad = false;
    getAvailableAgreementsForGame(gameId).then(agreements => {
      if (agreements.length > 0) callback(agreements);
    });
  }

  return () => {
    log(`Unsubscribing from agreements for game: ${gameId}`);
    gameSubscription.off();
    agreementSubscriptions.forEach(sub => sub.off());
  };
}

/**
 * Get available cards for a game
 * @param gameId - Game ID
 * @param includeNames - Whether to include value and capability names
 * @returns Array of Cards
 */
export async function getAvailableCardsForGame(gameId: string, includeNames: boolean = false): Promise<CardWithPosition[]> {
  log(`Getting available cards for game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return [];
  }

  const game = await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return [];
  }

  const deckId = game.deck_ref;
  if (!deckId) {
    logError(`No deck found for game ${gameId}`);
    return [];
  }

  const cards = await getCollection<Card>(nodes.cards);
  const usedCardIds = new Set<string>();
  const actors = await getCollection<Actor>(nodes.actors);
  actors.filter(actor => actor.game_ref === gameId && actor.card_ref).forEach(actor => usedCardIds.add(actor.card_ref));

  const availableCards = cards
    .filter(card => !usedCardIds.has(card.card_id) && card.decks_ref[deckId])
    .map(card => ({
      ...card,
      position: { x: Math.random() * 800, y: Math.random() * 600 },
      _valueNames: includeNames ? getCardNames(card.values_ref, 'value_') : undefined,
      _capabilityNames: includeNames ? getCardNames(card.capabilities_ref, 'cap_') : undefined
    }));

  availableCards.forEach(card => cacheCard(card.card_id, card));
  log(`Found ${availableCards.length} available cards for game ${gameId}`);
  return availableCards;
}

/**
 * Get a card by ID
 * @param cardId - Card ID
 * @param includeNames - Whether to include value and capability names
 * @returns Card or null
 */
export async function getCard(cardId: string, includeNames: boolean = false): Promise<CardWithPosition | null> {
  log(`Fetching card: ${cardId}`);
  if (cardCache.has(cardId)) {
    log(`Cache hit: ${cardId}`);
    const card = cardCache.get(cardId)!;
    if (includeNames && (!card._valueNames || !card._capabilityNames)) {
      card._valueNames = getCardNames(card.values_ref, 'value_');
      card._capabilityNames = getCardNames(card.capabilities_ref, 'cap_');
      cacheCard(cardId, card);
    }
    return card;
  }

  const card = await get<Card>(`${nodes.cards}/${cardId}`);
  if (!card) {
    log(`Card not found: ${cardId}`);
    return null;
  }

  const cardWithPosition: CardWithPosition = {
    ...card,
    position: { x: Math.random() * 800, y: Math.random() * 600 },
    _valueNames: includeNames ? getCardNames(card.values_ref, 'value_') : undefined,
    _capabilityNames: includeNames ? getCardNames(card.capabilities_ref, 'cap_') : undefined
  };

  cacheCard(cardId, cardWithPosition);
  log(`Successfully retrieved card: ${cardId}`);
  return cardWithPosition;
}

/**
 * Get a user's card in a game
 * @param gameId - Game ID
 * @param userId - User ID
 * @param includeNames - Whether to include value and capability names
 * @returns Card or null
 */
export async function getUserCard(gameId: string, userId: string, includeNames: boolean = false): Promise<CardWithPosition | null> {
  log(`Fetching card for user ${userId} in game ${gameId}`);
  const cacheKey = `${gameId}:${userId}`;
  if (cardCache.has(cacheKey)) {
    log(`Cache hit: ${cacheKey}`);
    const card = cardCache.get(cacheKey)!;
    if (includeNames && (!card._valueNames || !card._capabilityNames)) {
      card._valueNames = getCardNames(card.values_ref, 'value_');
      card._capabilityNames = getCardNames(card.capabilities_ref, 'cap_');
      cardCache.set(cacheKey, card);
    }
    return card;
  }

  const actor = await getPlayerRole(gameId, userId);
  if (!actor || !actor.card_ref) {
    log(`No card found for user ${userId} in game ${gameId}`);
    return null;
  }

  const card = await getCard(actor.card_ref, includeNames);
  if (card) {
    cardCache.set(cacheKey, card);
    log(`Found card ${card.card_id} for user ${userId}`);
  }
  return card;
}

/**
 * Subscribe to a user’s card
 * @param gameId - Game ID
 * @param userId - User ID
 * @param callback - Callback for card updates
 * @returns Unsubscribe function
 */
export function subscribeToUserCard(gameId: string, userId: string, callback: (card: CardWithPosition | null) => void): () => void {
  log(`Subscribing to card for user ${userId} in game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    callback(null);
    return () => {};
  }

  const cacheKey = `${gameId}:${userId}`;
  let cardSubscription: any;
  let actorSubscription: any;

  const playerSubscription = gun.get(nodes.games).get(gameId).get('player_actor_map').on((data: any) => {
    const actorId = data?.[userId];
    if (!actorId) {
      log(`No role assigned to user ${userId} in game ${gameId}`);
      cardCache.delete(cacheKey);
      callback(null);
      return;
    }

    if (actorSubscription) actorSubscription.off();
    actorSubscription = gun.get(nodes.actors).get(actorId).on((actorData: Actor) => {
      if (!actorData || !actorData.card_ref) {
        log(`No card_ref for actor ${actorId}`);
        cardCache.delete(cacheKey);
        callback(null);
        return;
      }

      if (cardSubscription) cardSubscription.off();
      cardSubscription = gun.get(nodes.cards).get(actorData.card_ref).on((cardData: Card) => {
        if (!cardData) {
          log(`Card ${actorData.card_ref} not found`);
          cardCache.delete(cacheKey);
          callback(null);
          return;
        }

        const cardWithPosition: CardWithPosition = {
          ...cardData,
          position: { x: Math.random() * 800, y: Math.random() * 600 },
          _valueNames: getCardNames(cardData.values_ref, 'value_'),
          _capabilityNames: getCardNames(cardData.capabilities_ref, 'cap_')
        };

        cardCache.set(cacheKey, cardWithPosition);
        callback(cardWithPosition);
      });
    });
  });

  return () => {
    if (playerSubscription) playerSubscription.off();
    if (actorSubscription) actorSubscription.off();
    if (cardSubscription) cardSubscription.off();
    log(`Unsubscribed from card for user ${userId} in game ${gameId}`);
  };
}

/**
 * Create a new actor
 * @param gameId - Game ID
 * @param cardId - Card ID
 * @param actorType - Actor type
 * @param customName - Optional custom name
 * @returns Created Actor or null
 */
export async function createActor(gameId: string, cardId: string, actorType: Actor['actor_type'], customName?: string): Promise<Actor | null> {
  log(`Creating actor in game ${gameId} with card ${cardId}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun || !currentUser) {
    logError('Gun or user not initialized');
    return null;
  }

  const game = await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return null;
  }

  const actorId = generateId();
  const actor: Actor = {
    actor_id: actorId,
    user_ref: currentUser.user_id,
    game_ref: gameId,
    card_ref: cardId,
    actor_type: actorType,
    custom_name: customName,
    status: 'active',
    agreements_ref: {},
    created_at: Date.now()
  };

  cacheActor(actorId, actor);
  cacheRole(gameId, currentUser.user_id, actorId);

  await putSigned(`${nodes.actors}/${actorId}`, actor);
  await createRelationship(`${nodes.users}/${currentUser.user_id}`, 'actors', `${nodes.actors}/${actorId}`);
  await createRelationship(`${nodes.actors}/${actorId}`, 'card', `${nodes.cards}/${cardId}`);
  await createRelationship(`${nodes.actors}/${actorId}`, 'game', `${nodes.games}/${gameId}`);
  await updatePlayerActorMap(gameId, currentUser.user_id, actorId);

  setTimeout(async () => {
    const savedActor = await get<Actor>(`${nodes.actors}/${actorId}`);
    if (!savedActor) {
      log(`Actor ${actorId} not saved, retrying`);
      await putSigned(`${nodes.actors}/${actorId}`, actor);
    }
  }, 500);

  return actor;
}

/**
 * Get user’s actors across all games
 * @param userId - Optional user ID (defaults to current user)
 * @returns Array of Actors
 */
export async function getUserActors(userId?: string): Promise<Actor[]> {
  log(`Getting actors for user: ${userId || 'current'}`);
  const gun = getGun();
  const currentUser = getCurrentUser();

  if (!gun) {
    logError('Gun not initialized');
    return [];
  }

  const userToCheck = userId || currentUser?.user_id;
  if (!userToCheck) {
    logWarn('No user ID available');
    return [];
  }

  const actors = await getCollection<Actor>(nodes.actors);
  const userActors = actors.filter(actor => actor.user_ref === userToCheck);
  userActors.forEach(actor => cacheActor(actor.actor_id, actor));
  log(`Found ${userActors.length} actors for user ${userToCheck}`);
  return userActors;
}

/**
 * Get all actors for a game
 * @param gameId - Game ID
 * @returns Array of Actors
 */
export async function getGameActors(gameId: string): Promise<Actor[]> {
  log(`Getting actors for game: ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return [];
  }

  const actors = await getCollection<Actor>(nodes.actors);
  const gameActors = actors.filter(actor => actor.game_ref === gameId);
  gameActors.forEach(actor => cacheActor(actor.actor_id, actor));
  log(`Found ${gameActors.length} actors for game ${gameId}`);
  return gameActors;
}

/**
 * Subscribe to game actors
 * @param gameId - Game ID
 * @param callback - Callback for actor updates
 * @returns Unsubscribe function
 */
export function subscribeToGameActors(gameId: string, callback: (actors: Actor[]) => void): () => void {
  log(`Subscribing to actors for game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    callback([]);
    return () => {};
  }

  const actorSubscriptions: any[] = [];
  const actors: Actor[] = [];
  const uniqueIds = new Set<string>();

  const subscription = gun.get(nodes.games).get(gameId).get('actors_ref').on((data: any) => {
    if (data && data['#']) {
      const actorId = data['#'].split('/').pop();
      if (actorId && actorId !== '_') {
        const actorSubscription = gun.get(nodes.actors).get(actorId).on((actorData: Actor) => {
          if (actorData && actorData.game_ref === gameId) {
            const actorIndex = actors.findIndex(a => a.actor_id === actorId);
            const actor = { ...actorData, actor_id: actorId };
            if (actorIndex >= 0) {
              actors[actorIndex] = actor;
            } else {
              actors.push(actor);
              uniqueIds.add(actorId);
            }
            cacheActor(actorId, actor);
            callback([...actors]);
          }
        });
        actorSubscriptions.push(actorSubscription);
      }
    }
  });

  return () => {
    subscription.off();
    actorSubscriptions.forEach(sub => sub.off());
    log(`Unsubscribed from actors for game ${gameId}`);
  };
}

/**
 * Assign a card to an actor
 * @param actorId - Actor ID
 * @param cardId - Card ID
 * @returns Success status
 */
export async function assignCardToActor(actorId: string, cardId: string): Promise<boolean> {
  log(`Assigning card ${cardId} to actor ${actorId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  const actor = await get<Actor>(`${nodes.actors}/${actorId}`);
  if (!actor) {
    logError(`Actor not found: ${actorId}`);
    return false;
  }

  cacheActor(actorId, { ...actor, card_ref: cardId });
  await putSigned(`${nodes.actors}/${actorId}`, { ...actor, card_ref: cardId });
  await createRelationship(`${nodes.actors}/${actorId}`, 'card', `${nodes.cards}/${cardId}`);

  setTimeout(async () => {
    const savedActor = await get<Actor>(`${nodes.actors}/${actorId}`);
    if (!savedActor || savedActor.card_ref !== cardId) {
      log(`Card assignment verification failed, retrying`);
      await putSigned(`${nodes.actors}/${actorId}`, { ...actor, card_ref: cardId });
    }
  }, 500);

  return true;
}

/**
 * Update game status
 * @param gameId - Game ID
 * @param status - New status
 * @returns Success status
 */
export async function updateGameStatus(gameId: string, status: GameStatus): Promise<boolean> {
  log(`Updating game ${gameId} status to ${status}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  let game = gameCache.has(gameId) ? gameCache.get(gameId) : await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return false;
  }

  cacheGame(gameId, { ...game, status });
  const currentGame = getStore(currentGameStore);
  if (currentGame && currentGame.game_id === gameId) {
    currentGameStore.set({ ...currentGame, status });
  }

  await putSigned(`${nodes.games}/${gameId}`, { ...game, status });

  setTimeout(async () => {
    const savedGame = await get<Game>(`${nodes.games}/${gameId}`);
    if (!savedGame || savedGame.status !== status) {
      log(`Status verification failed, retrying`);
      await putSigned(`${nodes.games}/${gameId}`, { ...game, status });
    }
  }, 500);

  return true;
}

/**
 * Subscribe to a game
 * @param gameId - Game ID
 * @param callback - Callback for game updates
 * @returns Unsubscribe function
 */
export function subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
  log(`Subscribing to game: ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    callback(null as any);
    return () => {};
  }

  const subscription = gun.get(nodes.games).get(gameId).on((gameData: Game) => {
    if (!gameData) {
      log(`Game subscription: ${gameId} - no data`);
      return;
    }

    cacheGame(gameId, gameData);
    log(`Game subscription update: ${gameId}`);
    callback(gameData);
  });

  return () => {
    subscription.off();
    log(`Unsubscribed from game: ${gameId}`);
  };
}

/**
 * Set actors for a game
 * @param gameId - Game ID
 * @param actors - Array of Actors
 * @returns Success status
 */
export async function setGameActors(gameId: string, actors: Actor[]): Promise<boolean> {
  log(`Setting ${actors.length} actors for game ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return false;
  }

  const batchSize = 4;
  const startTime = performance.now();

  for (let i = 0; i < Math.min(batchSize, actors.length); i++) {
    const actor = actors[i];
    const actorId = actor.actor_id || generateId();
    const actorData: Actor = { ...actor, actor_id: actorId, game_ref: gameId, created_at: Date.now(), status: 'active' };
    cacheActor(actorId, actorData);
    await putSigned(`${nodes.actors}/${actorId}`, actorData);
  }

  setTimeout(async () => {
    const remainingActors = actors.slice(batchSize);
    for (const actor of remainingActors) {
      const actorId = actor.actor_id || generateId();
      const actorData: Actor = { ...actor, actor_id: actorId, game_ref: gameId, created_at: Date.now(), status: 'active' };
      cacheActor(actorId, actorData);
      await putSigned(`${nodes.actors}/${actorId}`, actorData);
    }

    setTimeout(async () => {
      const samplesToVerify = Math.min(3, actors.length);
      for (let i = 0; i < samplesToVerify; i++) {
        const index = Math.floor(Math.random() * actors.length);
        const actorId = actors[index].actor_id || '';
        if (actorId) {
          const savedActor = await get<Actor>(`${nodes.actors}/${actorId}`);
          if (!savedActor) {
            log(`Verification failed for actor ${actorId}, retrying`);
            const actorData: Actor = { ...actors[index], actor_id: actorId, game_ref: gameId, created_at: Date.now(), status: 'active' };
            await putSigned(`${nodes.actors}/${actorId}`, actorData);
          }
        }
      }
    }, 1000);
  }, 50);

  log(`Initiated actor setup for ${actors.length} actors in ${performance.now() - startTime}ms`);
  return true;
}

/**
 * Check if a game is full
 * @param gameId - Game ID
 * @returns Whether the game is full
 */
export async function isGameFull(gameId: string): Promise<boolean> {
  log(`Checking if game ${gameId} is full`);
  const game = await getGame(gameId);
  if (!game) {
    logError(`Game not found: ${gameId}`);
    return false;
  }

  if (!game.max_players) return false;
  const playerCount = Object.keys(game.players).length;
  const isFull = playerCount >= game.max_players;
  log(`Game ${gameId} has ${playerCount}/${game.max_players} players. Full: ${isFull}`);
  return isFull;
}

/**
 * Fix game relationships for visualization
 * @returns Success status and number of games fixed
 */
export async function fixGameRelationships(): Promise<{ success: boolean; gamesFixed: number }> {
  log('Fixing game relationships for visualization');
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    return { success: false, gamesFixed: 0 };
  }

  const allGames = await getAllGames();
  let gamesFixed = 0;

  for (const game of allGames) {
    const promises: Promise<any>[] = [];
    if (game.creator_ref) {
      promises.push(createRelationship(`${nodes.users}/${game.creator_ref}`, 'games', `${nodes.games}/${game.game_id}`));
    }

    if (game.deck_ref) {
      promises.push(createRelationship(`${nodes.games}/${game.game_id}`, 'deck_ref', `${nodes.decks}/${game.deck_ref}`));
    }

    for (const playerId of Object.keys(game.players)) {
      if (playerId !== '_') {
        promises.push(createRelationship(`${nodes.users}/${playerId}`, 'games', `${nodes.games}/${game.game_id}`));
        promises.push(createRelationship(`${nodes.games}/${game.game_id}`, 'players', `${nodes.users}/${playerId}`));
      }
    }

    for (const actorId of Object.keys(game.actors_ref)) {
      promises.push(createRelationship(`${nodes.games}/${game.game_id}`, 'actors_ref', `${nodes.actors}/${actorId}`));
      promises.push(createRelationship(`${nodes.actors}/${actorId}`, 'game', `${nodes.games}/${game.game_id}`));
    }

    await Promise.all(promises);
    gamesFixed++;
  }

  log(`Fixed relationships for ${gamesFixed} games`);
  return { success: true, gamesFixed };
}
