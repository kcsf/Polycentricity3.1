import { getGun, nodes, generateId } from './gunService';

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
    const cards = [
      {
        card_id: 'c1',
        role_title: 'Verdant Weaver',
        backstory: 'A skilled cultivator who weaves plant life into sustainable systems.',
        values: ['Sustainability', 'Ecology', 'Community'],
        goals: ['Create a self-sustaining garden', 'Train others in permaculture'],
        obligations: 'Must share knowledge with the community',
        capabilities: 'Can grow plants in any environment',
        intellectual_property: 'Seed storage techniques',
        rivalrous_resources: 'Limited water supply',
        card_category: 'Providers',
        type: 'Practice'
      },
      {
        card_id: 'c2',
        role_title: 'Luminos Funder',
        backstory: 'A visionary investor who funds innovative ecological projects.',
        values: ['Innovation', 'Sustainability', 'Growth'],
        goals: ['Fund 5 eco-projects', 'Create a funding network'],
        obligations: 'Must transparently report all funding allocations',
        capabilities: 'Access to capital and investment networks',
        intellectual_property: 'Investment strategy methodologies',
        rivalrous_resources: 'Limited investment capital',
        card_category: 'Funders',
        type: 'DAO'
      }
    ];

    // Create sample deck
    const deck = {
      deck_id: 'd1',
      name: 'Eco-Village Standard Deck',
      cards: { c1: true, c2: true },
      creator: 'u125' // Created by Admin user
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

    // Save all sample data to Gun.js
    console.log('Saving users...');
    for (const user of users) {
      await new Promise<void>((resolve) => {
        gun.get(nodes.users).get(user.user_id).put(user, () => {
          console.log(`Saved user: ${user.name}`);
          resolve();
        });
      });
    }
    
    console.log('Saving cards...');
    for (const card of cards) {
      await new Promise<void>((resolve) => {
        gun.get(nodes.cards).get(card.card_id).put(card, () => {
          console.log(`Saved card: ${card.role_title}`);
          resolve();
        });
      });
    }

    console.log('Saving deck...');
    await new Promise<void>((resolve) => {
      gun.get(nodes.decks).get(deck.deck_id).put(deck, () => {
        console.log(`Saved deck: ${deck.name}`);
        resolve();
      });
    });

    console.log('Saving game...');
    await new Promise<void>((resolve) => {
      gun.get(nodes.games).get(game.game_id).put(game, () => {
        console.log(`Saved game: ${game.name}`);
        resolve();
      });
    });

    console.log('Saving actors...');
    for (const actor of actors) {
      await new Promise<void>((resolve) => {
        gun.get(nodes.actors).get(actor.actor_id).put(actor, () => {
          console.log(`Saved actor: ${actor.actor_id}`);
          resolve();
        });
      });
    }

    console.log('Saving agreement...');
    await new Promise<void>((resolve) => {
      gun.get(nodes.agreements).get(agreement.agreement_id).put(agreement, () => {
        console.log(`Saved agreement: ${agreement.title}`);
        resolve();
      });
    });

    console.log('Saving chat...');
    await new Promise<void>((resolve) => {
      gun.get(nodes.chat).get(chat.chat_id).put(chat, () => {
        console.log(`Saved chat: ${chat.chat_id}`);
        resolve();
      });
    });

    console.log('Saving node positions...');
    for (const position of nodePositions) {
      await new Promise<void>((resolve) => {
        gun.get(nodes.positions).get(position.node_id).put(position, () => {
          console.log(`Saved position for: ${position.node_id}`);
          resolve();
        });
      });
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