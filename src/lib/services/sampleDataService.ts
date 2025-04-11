import { getGun, nodes, generateId, put, createRelationship } from './gunService';

// Sample data for initializing the database with the new schema
export async function initializeSampleData() {
  console.log('Initializing sample data for the new database schema...');
  const gun = getGun();
  if (!gun) {
    console.error('Failed to get Gun instance');
    return;
  }

  try {
    // Create sample users
    const users = [
      {
        user_id: 'u123',
        name: 'Member User',
        email: 'member@example.com',
        created_at: Date.now(),
        role: 'Member'
      },
      {
        user_id: 'u124',
        name: 'Guest User',
        email: 'guest@example.com',
        created_at: Date.now(),
        role: 'Guest'
      },
      {
        user_id: 'u125',
        name: 'Admin User',
        email: 'admin@example.com',
        created_at: Date.now(),
        role: 'Admin'
      }
    ];

    // Create sample cards 
    // Note: Storing goals as a string now instead of arrays
    const cards = [
      {
        card_id: 'c1',
        card_number: 1,
        role_title: 'Verdant Weaver',
        backstory: 'A skilled cultivator who weaves plant life into sustainable systems.',
        values: {}, // Will be filled with relationship edges
        goals: 'Create a self-sustaining garden, Train others in permaculture', // Stored as a string
        obligations: 'Must share knowledge with the community',
        capabilities: {}, // Will be filled with relationship edges
        intellectual_property: 'Seed storage techniques',
        rivalrous_resources: 'Limited water supply',
        card_category: 'Providers',
        type: 'Practice',
        icon: 'Hammer',
        decks: {} // Will be filled with relationship edges
      },
      {
        card_id: 'c2',
        card_number: 2,
        role_title: 'Luminos Funder',
        backstory: 'A visionary investor who funds innovative ecological projects.',
        values: {}, // Will be filled with relationship edges
        goals: 'Fund 5 eco-projects, Create a funding network', // Stored as a string
        obligations: 'Must transparently report all funding allocations',
        capabilities: {}, // Will be filled with relationship edges
        intellectual_property: 'Investment strategy methodologies',
        rivalrous_resources: 'Limited investment capital',
        card_category: 'Funders',
        type: 'DAO',
        icon: 'CircleDollarSign',
        decks: {} // Will be filled with relationship edges
      }
    ];

    // Create sample deck (base data first)
    const deck = {
      deck_id: 'd1',
      name: 'Eco-Village Standard Deck',
      description: 'A standard deck for eco-village simulation games',
      creator: 'u125', // Created by Admin user
      created_at: Date.now(),
      updated_at: Date.now(),
      cards: {} // Will be filled with relationship edges
    };

    // Create sample game
    const game = {
      game_id: 'g456',
      name: 'Test Eco-Village',
      creator: 'u125', // Created by Admin user
      deck_id: 'd1',
      role_assignment: 'choice',
      players: { u123: true, u124: true },
      created_at: Date.now(),
      status: 'active'
    };

    // Create sample actors
    const actors = [
      {
        actor_id: 'a1',
        game_id: 'g456',
        user_id: 'u123',
        card_id: 'c1'
      },
      {
        actor_id: 'a2',
        game_id: 'g456',
        user_id: 'u124',
        card_id: 'c2'
      }
    ];

    // Create sample agreement
    const agreement = {
      agreement_id: 'ag1',
      game_id: 'g456',
      title: 'Funding for Garden Initiative',
      summary: 'Luminos Funder provides capital to Verdant Weaver for a community garden',
      type: 'asymmetric',
      parties: ['a1', 'a2'],
      obligations: {
        a1: 'Create and maintain community garden for one year',
        a2: 'Provide 5000 credits of funding and quarterly reviews'
      },
      benefits: {
        a1: 'Receives funding and resources for the garden',
        a2: 'Receives 10% of produce and community recognition'
      },
      status: 'accepted',
      created_at: Date.now()
    };

    // Create sample chat
    const chat = {
      chat_id: 'g456_group',
      game_id: 'g456',
      type: 'group',
      participants: ['u123', 'u124'],
      messages: [
        {
          id: generateId(),
          user_id: 'u123',
          user_name: 'Member User',
          content: 'Hello! Let\'s start planning our eco-village!',
          timestamp: Date.now(),
          type: 'group'
        }
      ]
    };

    // Create sample node positions
    const nodePositions = [
      {
        node_id: 'a1',
        game_id: 'g456',
        x: 100,
        y: 100
      },
      {
        node_id: 'ag1',
        game_id: 'g456',
        x: 300,
        y: 200
      }
    ];

    // Use our improved put function to save data with proper timeouts
    console.log('Saving users...');
    for (const user of users) {
      console.log(`Saving user: ${user.name}...`);
      const result = await put(`${nodes.users}/${user.user_id}`, user);
      if (result.err) {
        console.error(`Error saving user ${user.name}:`, result.err);
      } else {
        console.log(`Successfully saved user: ${user.name}`);
      }
      // Add delay between operations
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('Saving cards...');
    for (const card of cards) {
      console.log(`Saving card: ${card.role_title}...`);
      const result = await put(`${nodes.cards}/${card.card_id}`, card);
      if (result.err) {
        console.error(`Error saving card ${card.role_title}:`, result.err);
      } else {
        console.log(`Successfully saved card: ${card.role_title}`);
      }
      // Add delay between operations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Saving deck...');
    const deckResult = await put(`${nodes.decks}/${deck.deck_id}`, deck);
    if (deckResult.err) {
      console.error(`Error saving deck ${deck.name}:`, deckResult.err);
    } else {
      console.log(`Successfully saved deck: ${deck.name}`);
    }
    
    // Wait before creating relationships
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create card-to-deck relationships using the proper method
    console.log('Setting up card-deck relationships...');
    for (const card of cards) {
      console.log(`Setting up relationship between deck ${deck.deck_id} and card ${card.card_id}...`);
      
      // Create bidirectional relationships using our createRelationship function
      try {
        // 1. Deck to Card relationship
        const rel1 = await createRelationship(
          `${nodes.decks}/${deck.deck_id}`,
          'cards',
          `${nodes.cards}/${card.card_id}`
        );
        
        if (rel1.err) {
          console.error(`Error creating deck->card relationship:`, rel1.err);
        } else {
          console.log(`Successfully created deck->card relationship`);
        }
        
        // Wait before creating reverse relationship
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 2. Card to Deck relationship
        const rel2 = await createRelationship(
          `${nodes.cards}/${card.card_id}`,
          'decks',
          `${nodes.decks}/${deck.deck_id}`
        );
        
        if (rel2.err) {
          console.error(`Error creating card->deck relationship:`, rel2.err);
        } else {
          console.log(`Successfully created card->deck relationship`);
        }
      } catch (error) {
        console.error(`Error creating card-deck relationships:`, error);
      }
      
      // Add delay between cards
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Saving game...');
    const gameResult = await put(`${nodes.games}/${game.game_id}`, game);
    if (gameResult.err) {
      console.error(`Error saving game ${game.name}:`, gameResult.err);
    } else {
      console.log(`Successfully saved game: ${game.name}`);
    }
    
    // Wait before continuing
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Saving actors...');
    for (const actor of actors) {
      console.log(`Saving actor: ${actor.actor_id}...`);
      const result = await put(`${nodes.actors}/${actor.actor_id}`, actor);
      if (result.err) {
        console.error(`Error saving actor ${actor.actor_id}:`, result.err);
      } else {
        console.log(`Successfully saved actor: ${actor.actor_id}`);
      }
      // Add delay between operations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Saving agreement...');
    const agreementResult = await put(`${nodes.agreements}/${agreement.agreement_id}`, agreement);
    if (agreementResult.err) {
      console.error(`Error saving agreement ${agreement.title}:`, agreementResult.err);
    } else {
      console.log(`Successfully saved agreement: ${agreement.title}`);
    }
    
    // Wait before continuing
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Saving chat...');
    const chatResult = await put(`${nodes.chat}/${chat.chat_id}`, chat);
    if (chatResult.err) {
      console.error(`Error saving chat ${chat.chat_id}:`, chatResult.err);
    } else {
      console.log(`Successfully saved chat: ${chat.chat_id}`);
    }
    
    // Wait before continuing
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Saving node positions...');
    for (const position of nodePositions) {
      console.log(`Saving position for: ${position.node_id}...`);
      const result = await put(`${nodes.positions}/${position.node_id}`, position);
      if (result.err) {
        console.error(`Error saving position for ${position.node_id}:`, result.err);
      } else {
        console.log(`Successfully saved position for: ${position.node_id}`);
      }
      // Add delay between operations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Sample data initialization complete!');
    return { 
      success: true, 
      message: 'Sample data initialized successfully' 
    };
  } catch (error) {
    console.error('Error initializing sample data:', error);
    return { 
      success: false, 
      message: `Error initializing sample data: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

// Verify the sample data by logging each node type
export async function verifySampleData() {
  console.log('Verifying sample data...');
  const gun = getGun();
  if (!gun) {
    console.error('Failed to get Gun instance');
    return;
  }

  try {
    console.log('Verifying users...');
    gun.get(nodes.users).map().once(console.log);
    
    console.log('Verifying cards...');
    gun.get(nodes.cards).map().once(console.log);
    
    console.log('Verifying decks...');
    gun.get(nodes.decks).map().once(console.log);
    
    console.log('Verifying games...');
    gun.get(nodes.games).map().once(console.log);
    
    console.log('Verifying actors...');
    gun.get(nodes.actors).map().once(console.log);
    
    console.log('Verifying agreements...');
    gun.get(nodes.agreements).map().once(console.log);
    
    console.log('Verifying chat...');
    gun.get(nodes.chat).map().once(console.log);
    
    console.log('Verifying node positions...');
    gun.get(nodes.positions).map().once(console.log);

    console.log('Verification complete!');
    return { 
      success: true, 
      message: 'Sample data verification completed' 
    };
  } catch (error) {
    console.error('Error verifying sample data:', error);
    return { 
      success: false, 
      message: `Error verifying sample data: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}