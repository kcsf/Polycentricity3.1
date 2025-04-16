<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import * as d3 from 'd3';
  import { User } from 'svelte-lucide';
  import { iconStore, loadIcons } from '$lib/stores/iconStore';
  import gameStore from '$lib/stores/enhancedGameStore';
  import { getGun, nodes } from '$lib/services/gunService';
  import type { Card, Value, Capability, Actor, Agreement } from '$lib/types';
  import { getGame } from '$lib/services/gameService';
  import { userStore } from '$lib/stores/userStore';
  import { getCardValueNames, getCardCapabilityNames } from '$lib/services/deckService';
  import RoleCard from '$lib/components/RoleCard.svelte';
  
  // Props
  export let gameId: string;
  export let activeActorId: string | undefined = undefined;
  export let cards: Card[] = [];
  
  // Local variables
  let svgRef: SVGSVGElement;
  let searchTerm = '';
  let width = 800;
  let height = 600;
  let hoveredNode: string | null = null;
  let hoveredCategory: string | null = null;
  // All UI elements are now handled directly with D3
  let categoryCount = 0;
  let nodeElements: d3.Selection<any, D3Node, any, any>; // Store node elements for access in multiple functions
  
  // Dataset
  let cardsWithPosition: CardWithPosition[] = [];
  let agreements: AgreementWithPosition[] = [];
  let actors: Actor[] = [];
  let valueCache: Map<string, Value> = new Map();
  let capabilityCache: Map<string, Capability> = new Map();
  let actorCardMap: Map<string, string> = new Map(); // Maps actor_id to card_id
  
  // Active actor/card IDs
  let activeCardId: string | null = null;
  
  // Popover state
  let popoverOpen = false;
  let popoverNode: Card | Agreement | null = null;
  let popoverNodeType: 'actor' | 'agreement' = 'actor';
  let popoverPosition = { x: 0, y: 0 };
  
  // Function to handle popover close
  function handlePopoverClose() {
    popoverOpen = false;
    popoverNode = null;
  }
  
  // Get Lucide icon component using direct import
  async function getLucideIcon(iconName: string | undefined): Promise<any> {
    console.log(`Getting icon for: "${iconName}"`);
    
    if (!iconName) {
      console.log(`No icon name provided, returning User`);
      return User;
    }
    
    // Try to normalize the icon name to match Lucide naming conventions
    let normalizedName = iconName;
    
    // Try to convert kebab-case or snake_case to PascalCase
    if (iconName.includes('-') || iconName.includes('_')) {
      normalizedName = iconName
        .split(/[-_]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('');
    } 
    // If it's already camelCase, convert to PascalCase
    else if (iconName.charAt(0).toLowerCase() === iconName.charAt(0)) {
      normalizedName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
    }
    
    console.log(`Normalized icon name: ${normalizedName}`);
    
    // Handle specific icon mappings
    const iconMappings: Record<string, string> = {
      'CircleDollarSign': 'DollarSign',
      'Circledollarsign': 'DollarSign',
      'Tree': 'PalmTree',
      'Garden': 'Flower2',
      'Plant': 'Sprout',
      'Money': 'Coins',
      'Default': 'Box',
      'Farmer': 'Tractor',
      'Funder': 'PiggyBank',
      'Steward': 'Shield',
      'Investor': 'TrendingUp',
    };
    
    // Check if we have a specific mapping for this icon
    if (iconMappings[normalizedName]) {
      normalizedName = iconMappings[normalizedName];
      console.log(`Mapped to: ${normalizedName}`);
    }
    
    try {
      // First check the iconStore (this is faster if the icon is already loaded)
      const iconMap = get(iconStore);
      const iconData = iconMap.get(iconName) || iconMap.get(normalizedName);
      
      if (iconData) {
        console.log(`Found icon in store: ${iconName}`);
        return iconData.component;
      }
      
      // If not in store, try to import directly
      console.log(`Attempting direct import: ${normalizedName}`);
      const icons = await import('svelte-lucide');
      
      if (icons[normalizedName]) {
        console.log(`Successfully imported ${normalizedName}`);
        // Also add to the iconStore for future use
        const newIcons = new Map(iconMap);
        newIcons.set(iconName, { name: iconName, component: icons[normalizedName] });
        iconStore.set(newIcons);
        return icons[normalizedName];
      }
      
      // Try one more fallback for common icons
      const fallbackName = iconName.charAt(0).toUpperCase() + iconName.slice(1).toLowerCase();
      if (icons[fallbackName]) {
        console.log(`Fallback found: ${fallbackName}`);
        // Also add to the iconStore for future use
        const newIcons = new Map(iconMap);
        newIcons.set(iconName, { name: iconName, component: icons[fallbackName] });
        iconStore.set(newIcons);
        return icons[fallbackName];
      }
      
      console.log(`Icon not found: ${iconName}, using User as fallback`);
    } catch (error) {
      console.error(`Error loading icon: ${error}`);
    }
    
    return User; // Default fallback
  }
  
  // Interfaces for D3 visualization
  interface D3Node {
    id: string;
    name: string;
    type: "actor" | "agreement";  // Match React reference exactly: "actor" not "card"
    data: CardWithPosition | AgreementWithPosition;
    x: number;
    y: number;
    fx?: number | null;
    fy?: number | null;
    active?: boolean;
    _valueNames?: string[];     // Store value names for card nodes
    _capabilityNames?: string[]; // Store capability names for card nodes
  }

  interface D3Link {
    source: string | D3Node;
    target: string | D3Node;
    type: "obligation" | "benefit";
    id: string;
  }

  interface SubItem {
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
  
  interface CardWithPosition extends Card {
    position?: {
      x: number;
      y: number;
    };
  }
  
  // Create a custom type for AgreementWithPosition to avoid type conflicts
  interface AgreementWithPosition {
    agreement_id: string;
    title: string;
    description?: string;
    status: string;
    created_at: number;
    parties?: Record<string, boolean>;
    terms?: string;
    position?: {
      x: number;
      y: number;
    };
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

  // Load data on mount
  onMount(async () => {
    try {
      // First, use any cards passed directly from the parent component
      if (cards && cards.length > 0) {
        // Create a new array instead of modifying the original cards array
        const newCardsWithPosition: CardWithPosition[] = [];
        
        // Process each card to add position data
        for (const card of cards) {
          if (!card || !card.card_id) {
            continue;
          }
          
          const cardWithPosition: CardWithPosition = {
            ...card,
            position: {
              x: Math.random() * width,
              y: Math.random() * height
            }
          };
          
          newCardsWithPosition.push(cardWithPosition);
          
          // Load card details (values and capabilities) 
          await loadCardDetails(card);
        }
        
        // Update the cardsWithPosition array with all processed cards at once
        cardsWithPosition = newCardsWithPosition;
      } else {
        // If no cards were passed directly, fetch from database
        await loadGameData();
      }
      
      // If activeActorId is provided, find its card
      if (activeActorId) {
        const actor = actors.find(a => a.actor_id === activeActorId);
        if (actor && actor.card_id) {
          activeCardId = actor.card_id;
        }
      }
      
      // Initialize the graph visualization
      if (cardsWithPosition.length > 0) {
        // Add demo agreements for testing if no real agreements yet
        if (agreements.length === 0 && cardsWithPosition.length >= 3) {
          createDemoAgreements();
        }
        
        initializeGraph();
      }
      
      // Set up real-time listeners
      setupRealTimeListeners();
      
    } catch (error) {
      console.error("D3CardBoard: Error initializing", error);
    }
  });

  onDestroy(() => {
    // Clean up any subscriptions
    if (cardUnsubscribe) cardUnsubscribe();
    if (agreementUnsubscribe) agreementUnsubscribe();
    if (actorUnsubscribe) actorUnsubscribe();
  });

  let cardUnsubscribe: (() => void) | undefined;
  let agreementUnsubscribe: (() => void) | undefined;
  let actorUnsubscribe: (() => void) | undefined;

  async function loadGameData() {
    try {
      const gun = getGun();
      if (!gun) {
        console.error("D3CardBoard: Gun not initialized");
        return;
      }
      
      // Load the game to get deck_id
      const game = await getGame(gameId);
      if (!game) {
        console.error(`D3CardBoard: Game not found: ${gameId}`);
        return;
      }
      
      let deckId = game.deck_id;
      if (!deckId) {
        console.warn(`D3CardBoard: No deck_id found, checking deck_type`);
        // Try to get deck_id from deck_type
        if (game.deck_type === 'eco-village') {
          deckId = 'd1'; // Default eco-village deck
          console.log(`D3CardBoard: Using default eco-village deck (d1)`);
        } else if (game.deck_type === 'community-garden') {
          deckId = 'd2'; // Default community garden deck
          console.log(`D3CardBoard: Using default community garden deck (d2)`);
        } else {
          console.error(`D3CardBoard: No deck found for game ${gameId}`);
          return;
        }
      }
      
      // 1. Load Cards for this deck
      await new Promise<void>((resolve) => {
        gun.get(nodes.decks).get(deckId).get('cards').map().once((cardValue: any, cardKey: string) => {
          if (cardValue === true) {
            gun.get(nodes.cards).get(cardKey).once((cardData: Card) => {
              if (cardData && cardData.card_id) {
                const cardWithPosition: CardWithPosition = {
                  ...cardData,
                  position: {
                    x: Math.random() * width,
                    y: Math.random() * height
                  }
                };
                cardsWithPosition = [...cardsWithPosition, cardWithPosition];
                
                // Load Values and Capabilities for this card
                loadCardDetails(cardData);
              }
            });
          }
        });
        
        // Continue after a short delay to allow Gun to load the data
        setTimeout(resolve, 1000);
      });
      
      // 2. Load Actors for this game
      await new Promise<void>((resolve) => {
        gun.get(nodes.games).get(gameId).get('players').map().once((actorId: string, userId: string) => {
          gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
            if (actorData && actorData.actor_id && actorData.card_id) {
              actors = [...actors, actorData];
              actorCardMap.set(actorData.actor_id, actorData.card_id);
            }
          });
        });
        
        // Continue after a short delay
        setTimeout(resolve, 1000);
      });
      
      // 3. Load Agreements for actors in this game
      await new Promise<void>((resolve) => {
        actors.forEach(actor => {
          if (actor.agreements) {
            Object.keys(actor.agreements).forEach(agreementId => {
              gun.get(nodes.agreements).get(agreementId).once((agreementData: Agreement) => {
                if (agreementData && agreementData.agreement_id) {
                  // Convert to AgreementWithPosition
                  const agreementWithPosition: AgreementWithPosition = {
                    ...agreementData,
                    position: {
                      x: Math.random() * width,
                      y: Math.random() * height
                    },
                    obligations: [],
                    benefits: []
                  };
                  
                  // Extract obligations and benefits from the agreement
                  if (agreementData.obligations) {
                    Object.entries(agreementData.obligations).forEach(([actorId, description]) => {
                      agreementWithPosition.obligations.push({
                        id: `obligation_${agreementData.agreement_id}_${actorId}`,
                        fromActorId: actorId,
                        description
                      });
                    });
                  }
                  
                  if (agreementData.benefits) {
                    Object.entries(agreementData.benefits).forEach(([actorId, description]) => {
                      agreementWithPosition.benefits.push({
                        id: `benefit_${agreementData.agreement_id}_${actorId}`,
                        toActorId: actorId,
                        description
                      });
                    });
                  }
                  
                  // Add to agreements array if not already there
                  if (!agreements.some(a => a.agreement_id === agreementData.agreement_id)) {
                    agreements = [...agreements, agreementWithPosition];
                  }
                }
              });
            });
          }
        });
        
        // Continue after a short delay
        setTimeout(resolve, 1000);
      });
      
      console.log(`D3CardBoard: Loaded ${cardsWithPosition.length} cards, ${agreements.length} agreements, ${actors.length} actors`);
      
      // Initialize the graph after loading all data
      if (cardsWithPosition.length > 0 || cards.length > 0) {
        // Add demo agreements for testing if no real agreements yet
        if (agreements.length === 0 && cardsWithPosition.length >= 3) {
          console.log("D3CardBoard: Adding demo agreements for visualization");
          createDemoAgreements();
        }
        
        initializeGraph();
      }
    } catch (error) {
      console.error("Error loading game data:", error);
    }
  }
  
  async function loadCardDetails(card: Card) {
    try {
      const gun = getGun();
      if (!gun) {
        console.error("D3CardBoard: Gun not initialized");
        return;
      }
      
      if (!card || !card.card_id) {
        console.error("D3CardBoard: Invalid card object or missing card_id", card);
        return;
      }
      
      console.log(`Loading details for card: ${card.card_id} - ${card.role_title}`);

      // Use our new optimized functions to get values and capabilities
      const valueNames = await getCardValueNames(card);
      console.log(`Values for ${card.role_title}:`, valueNames);
      
      const capabilityNames = await getCardCapabilityNames(card);
      console.log(`Capabilities for ${card.role_title}:`, capabilityNames);
      
      // IMPORTANT: Update the card with the values and capabilities
      if (valueNames && valueNames.length > 0) {
        // Create a new values object based on the names we got
        const valuesObj: Record<string, boolean> = {};
        valueNames.forEach(valueName => {
          const valueId = `value_${valueName.toLowerCase().replace(/\s+/g, '-')}`;
          valuesObj[valueId] = true;
        });
        
        // Replace the card's values with our new object
        card.values = valuesObj;
      }
      
      // Do the same for capabilities
      if (capabilityNames && capabilityNames.length > 0) {
        // Create a new capabilities object based on the names we got
        const capabilitiesObj: Record<string, boolean> = {};
        capabilityNames.forEach(capName => {
          const capabilityId = `capability_${capName.toLowerCase().replace(/\s+/g, '-')}`;
          capabilitiesObj[capabilityId] = true;
        });
        
        // Replace the card's capabilities with our new object
        card.capabilities = capabilitiesObj;
      }
      
      // Update the cardsWithPosition array
      cardsWithPosition = cardsWithPosition.map(c => {
        if (c.card_id === card.card_id) {
          return {
            ...c,
            values: card.values,
            capabilities: card.capabilities
          };
        }
        return c;
      });
      
      // Now reinitialize the graph
      if (svgRef) {
        const svg = d3.select(svgRef);
        svg.selectAll("*").remove();
        initializeGraph();
      }
    } catch (error) {
      console.error("D3CardBoard: Unexpected error in loadCardDetails:", error);
    }
  }

  function setupRealTimeListeners() {
    const gun = getGun();
    if (!gun) return;
    
    // Listen for changes to cards
    cardUnsubscribe = () => {};
    
    // Listen for changes to agreements
    agreementUnsubscribe = () => {};
    
    // Listen for changes to actors
    actorUnsubscribe = () => {};
  }

  // Define color scale for categories
  const categoryColors = d3.scaleOrdinal([
    "#A7C731", // Bright lime
    "#9BC23D", // Lime green
    "#8FBC49", // Fresh green
    "#83B655", // Pea green
    "#77B061", // Medium green
    "#6BA96D", // Forest green
    "#5FA279", // Pine green
    "#539B85", // Deep seafoam
    "#479491", // Teal
    "#3B8D9D", // Blue-teal
    "#2F86A9", // Ocean blue
    "#237FB5", // Deep blue
  ]);

  // Function to update the visualization after data changes
  function updateVisualization() {
    // If the graph is already initialized, we need to redraw it with the latest data
    if (svgRef) {
      // Clear any existing visualization
      const svg = d3.select(svgRef);
      svg.selectAll("*").remove();
      
      // Reinitialize the graph with latest data
      initializeGraph();
      
      // Log that we're updating the visualization
      console.log("Updating D3 visualization with latest value and capability data");
    }
  }
  
  // Function to initialize D3 visualization
  async function initializeGraph() {
    if (!svgRef) return;
    
    // Set up dimensions based on container size
    const boundingRect = svgRef.parentElement?.getBoundingClientRect();
    if (boundingRect) {
      width = boundingRect.width;
      height = boundingRect.height;
    }
    
    // CSS variables for node sizing
    const root = document.documentElement;
    const cardNodeRadius = 35; // Standard size for card nodes
    const agreementNodeRadius = 17; // Smaller size for agreement nodes
    const donutThickness = 15; // Extra space for radial menus

    // Define custom CSS variables to match React implementation
    root.style.setProperty('--actor-node-radius', `${cardNodeRadius}px`);
    root.style.setProperty('--agreement-node-radius', `${agreementNodeRadius}px`);
    root.style.setProperty('--donut-thickness', `${donutThickness}px`);
    
    // Debug the cards before mapping
    console.log("Cards before visualization:", cardsWithPosition);
    cardsWithPosition.forEach(card => {
      // Add debug logs for each card's values
      console.log(`Card ${card.role_title} values:`, 
        (card as any)._valueNames || "none", 
        (card as any)._capabilityNames || "none");
    });
    
    // Prepare nodes and links data
    let nodes: D3Node[] = [
      ...cardsWithPosition.map((card) => {
        // Create normal node data
        return {
          id: card.card_id,
          name: card.role_title || "Unnamed Card",
          type: "actor" as const,  // Using "actor" to match React reference
          data: card,
          x: card.position?.x || Math.random() * width,
          y: card.position?.y || Math.random() * height,
          fx: card.position?.x || null,
          fy: card.position?.y || null,
          active: card.card_id === activeCardId,
          // Explicitly transfer value and capability names to the node
          _valueNames: (card as any)._valueNames,
          _capabilityNames: (card as any)._capabilityNames
        };
      }),
      ...agreements.map((agreement) => ({
        id: agreement.agreement_id,
        name: agreement.title || "Unnamed Agreement",
        type: "agreement" as const,
        data: agreement,
        x: agreement.position?.x || Math.random() * width,
        y: agreement.position?.y || Math.random() * height,
        fx: agreement.position?.x || null,
        fy: agreement.position?.y || null,
      })),
    ];

    let links: D3Link[] = [];
    
    agreements.forEach((agreement) => {
      // Get all party ids for this agreement
      const partyActorIds = agreement.parties ? Object.keys(agreement.parties) : [];
      
      // IMPROVED APPROACH: First ensure we have a complete list of participating card IDs to create proper connections
      const participatingCardIds: string[] = [];
      partyActorIds.forEach(actorId => {
        const cardId = actorCardMap.get(actorId);
        if (cardId) {
          participatingCardIds.push(cardId);
        }
      });

      
      // If we have multiple cards, we need to connect them through the agreement
      if (participatingCardIds.length >= 2) {
        // Using specific obligations/benefits if available
        if (agreement.obligations.length > 0 || agreement.benefits.length > 0) {
          // For each obligation
          agreement.obligations.forEach((obligation) => {
            const fromActorId = obligation.fromActorId;
            const toActorId = obligation.toActorId;
            
            // Get the corresponding card IDs - creator is the one with obligation
            const creatorCardId = actorCardMap.get(fromActorId);
            const recipientCardId = actorCardMap.get(toActorId);
            
            // FOLLOW EXACT INSTRUCTIONS:
            // Card associated with Actor that created agreement → Agreement → Card associated with recipient
            if (creatorCardId && recipientCardId) {
              // Step 1: Connect creator's card to agreement (with arrow at agreement end)
              links.push({
                source: creatorCardId,            // FROM: Creator card 
                target: agreement.agreement_id,   // TO: Agreement
                type: "obligation",               // Type for styling
                id: `from_${obligation.id}`,      // Unique ID
              });
              
              // Step 2: Connect agreement to recipient's card (with arrow at recipient end)  
              links.push({
                source: agreement.agreement_id,   // FROM: Agreement
                target: recipientCardId,          // TO: Recipient card
                type: "benefit",                  // Type for styling
                id: `to_${obligation.id}`,        // Unique ID
              });
              

            }
            // Fallback if we only have one endpoint
            else if (creatorCardId) {
              links.push({
                source: creatorCardId,
                target: agreement.agreement_id,
                type: "obligation",
                id: obligation.id,
              });
            }
          });

          // For each benefit - follow same pattern as obligations
          agreement.benefits.forEach((benefit) => {
            const fromActorId = benefit.fromActorId;
            const toActorId = benefit.toActorId;
            
            // Get the corresponding card IDs
            const creatorCardId = actorCardMap.get(fromActorId);  
            const recipientCardId = actorCardMap.get(toActorId);
            
            // FOLLOW SAME PATTERN: Creator Card → Agreement → Recipient Card
            if (creatorCardId && recipientCardId) {
              // Check if this path already exists from obligation handling
              const pathExists = links.some(link => 
                ((typeof link.source === 'string' ? link.source : link.source.id) === creatorCardId && 
                 (typeof link.target === 'string' ? link.target : link.target.id) === agreement.agreement_id) ||
                ((typeof link.source === 'string' ? link.source : link.source.id) === agreement.agreement_id && 
                 (typeof link.target === 'string' ? link.target : link.target.id) === recipientCardId));
              
              // Only create links if they don't already exist
              if (!pathExists) {
                // Create link from creator's card to agreement
                links.push({
                  source: creatorCardId,
                  target: agreement.agreement_id,
                  type: "obligation",
                  id: `from_${benefit.id}`,
                });
                
                // Create link from agreement to recipient's card
                links.push({
                  source: agreement.agreement_id, 
                  target: recipientCardId,
                  type: "benefit",
                  id: `to_${benefit.id}`,
                });
                

              }
            }
            // If we only have one of the cards, add single link
            else if (creatorCardId) {
              const linkExists = links.some(link => 
                (typeof link.source === 'string' ? link.source : link.source.id) === creatorCardId && 
                (typeof link.target === 'string' ? link.target : link.target.id) === agreement.agreement_id);
                
              if (!linkExists) {
                links.push({
                  source: creatorCardId,
                  target: agreement.agreement_id,
                  type: "obligation",
                  id: `single_from_${benefit.id}`,
                });
              }
            }
            else if (recipientCardId) {
              const linkExists = links.some(link => 
                (typeof link.source === 'string' ? link.source : link.source.id) === agreement.agreement_id && 
                (typeof link.target === 'string' ? link.target : link.target.id) === recipientCardId);
                
              if (!linkExists) {
                links.push({
                  source: agreement.agreement_id,
                  target: recipientCardId,
                  type: "benefit",
                  id: `single_to_${benefit.id}`,
                });
              }
            }
          });
        } 
        // If no specific obligations/benefits, create basic links between all parties
        else if (participatingCardIds.length > 0) {
          // For visualization purposes, implement the Card → Agreement → Card pattern
          if (participatingCardIds.length >= 2) {
            // Get the first card to act as creator (source) and the second as recipient (target)
            const creatorCardId = participatingCardIds[0];
            const recipientCardId = participatingCardIds[1];
            
            // Create link from creator card to agreement
            links.push({
              source: creatorCardId,
              target: agreement.agreement_id,
              type: "obligation", // Represents the obligation flow
              id: `vis_from_${creatorCardId}_to_${agreement.agreement_id}`,
            });
            
            // Create link from agreement to recipient card
            links.push({
              source: agreement.agreement_id,
              target: recipientCardId,
              type: "benefit", // Represents the benefit flow
              id: `vis_from_${agreement.agreement_id}_to_${recipientCardId}`,
            });
            

          } 
          // Fallback if only one card is connected to the agreement
          else if (participatingCardIds.length === 1) {
            const cardId = participatingCardIds[0];
            links.push({
              source: cardId,
              target: agreement.agreement_id,
              type: "obligation",
              id: `single_${cardId}_to_${agreement.agreement_id}`,
            });

          }
        }
      }
    });

    // Clear the SVG
    const svg = d3.select(svgRef);
    svg.selectAll("*").remove();

    if (nodes.length === 0) return;

    // Define a function to wrap text with SVG tspan elements
    function wrapText(
      text: d3.Selection<any, any, any, any>,
      width: number,
    ): void {
      text.each(function (this: any) {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        const lineHeight = 1.1; // ems
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy") || "0");

        let word: string | undefined;
        let line: string[] = [];
        let lineNumber = 0;
        let tspan = text
          .text(null)
          .append("tspan")
          .attr("x", 0)
          .attr("y", y)
          .attr("dy", dy + "em");

        while ((word = words.pop())) {
          line.push(word);
          tspan.text(line.join(" "));
          const tspanNode = tspan.node();
          if (tspanNode && tspanNode.getComputedTextLength() > width) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text
              .append("tspan")
              .attr("x", 0)
              .attr("y", y)
              .attr("dy", ++lineNumber * lineHeight + dy + "em")
              .text(word);
          }
        }
      });
    }

    // First ensure we have a proper defs element for our gradients and markers
    const defs = svg.append("defs");
    
    // Create an arrow marker definition for the links - EXACT SPECIFICATIONS
    defs.append("marker")
      .attr("id", "arrow-marker")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15) // Important: This ensures the line doesn't extend past the arrow
      .attr("refY", 0)
      .attr("markerWidth", 4) // Smaller width for better appearance
      .attr("markerHeight", 4) // Smaller height for better appearance
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#BBBBBB") // Light gray to match image
      .attr("d", "M0,-5L10,0L0,5");

    // Create link group that appears behind nodes
    const linkGroup = svg.append("g").attr("class", "links");
    
    // Create a container for the nodes that appears on top of links
    const nodeGroup = svg.append("g").attr("class", "nodes");

    // Create the link elements with consistent unified styling
    const linkElements = linkGroup
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link-line")     // Use CSS class for consistent styling
      .attr("stroke", "#e5e5e5")      // Light gray matching reference image
      .attr("stroke-width", 1)        // Thin lines per design reference
      .attr("stroke-opacity", 0.8)    // Slightly transparent
      .attr("marker-start", null)     // NO start markers - explicitly remove
      .attr("marker-end", "url(#arrow-marker)")  // Apply arrow ONLY at the target end as instructed
      .style("cursor", "pointer"); // Show pointer cursor on hover
      

    
    // Add title tooltips to links
    linkElements.append("title")
      .text(d => {
        const sourceType = typeof d.source === "string" ? 
          nodes.find(n => n.id === d.source)?.type : 
          d.source.type;
          
        const targetType = typeof d.target === "string" ? 
          nodes.find(n => n.id === d.target)?.type : 
          d.target.type;
          
        return `${d.type} link: ${sourceType} → ${targetType}`; 
      });

    // Function to update link positions and agreement node positions
    function updateLinks() {
      // First, position bilateral agreement nodes at the midpoint between their cards
      // with more sophisticated positioning to avoid overlaps
      nodes.forEach(node => {
        if (node.type === 'agreement') {
          const agreement = node.data as AgreementWithPosition;
          // Only for bilateral agreements
          if (agreement.parties && Object.keys(agreement.parties).length === 2) {
            const partyActorIds = Object.keys(agreement.parties);
            const partyCardIds = partyActorIds
              .map(actorId => actorCardMap.get(actorId))
              .filter(cardId => cardId !== undefined) as string[];
            
            if (partyCardIds.length === 2) {
              const card1 = nodes.find(n => n.id === partyCardIds[0]);
              const card2 = nodes.find(n => n.id === partyCardIds[1]);
              
              if (card1 && card2) {
                // Calculate distance between cards for path drawing
                const dx = card2.x - card1.x;
                const dy = card2.y - card1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Calculate exact midpoint
                const midX = card1.x + (dx * 0.5);
                const midY = card1.y + (dy * 0.5);
                
                // Calculate perpendicular offset vector (for curved paths)
                // This helps prevent agreements from overlapping with direct card-to-card lines
                const offsetDistance = 0; // No curve for now, but could be adjusted
                const perpX = -dy * offsetDistance / distance;
                const perpY = dx * offsetDistance / distance;
                
                // Final position with potential offset
                const finalX = midX + perpX;
                const finalY = midY + perpY;
                
                // Store original cards for this agreement to help with link drawing
                (node as any).sourceCard = card1;
                (node as any).targetCard = card2;
                
                // Update agreement node position
                node.x = finalX;
                node.y = finalY;
                
                // Update visual position with precise coordinates
                d3.select(`#node-${node.id}`)
                  .attr("transform", `translate(${finalX},${finalY})`);
              }
            }
          }
        }
      });

      // Then update all link positions with proper spacing from node edges
      linkElements.each(function(d) {
        // Get source and target nodes
        const sourceId = typeof d.source === "string" ? d.source : d.source.id;
        const targetId = typeof d.target === "string" ? d.target : d.target.id;
        const sourceNode = nodes.find((n) => n.id === sourceId);
        const targetNode = nodes.find((n) => n.id === targetId);
        
        if (!sourceNode || !targetNode) return;
        
        // Get node types to determine radius
        const sourceType = sourceNode.type;
        const targetType = targetNode.type;
        
        // IMPROVED: More precise distance calculations for different node types
        // For Card (Actor) nodes, consider the full donut ring
        // For Agreement nodes, consider just the circle
        let sourceRadius = sourceType === "actor" 
          ? (cardNodeRadius + donutThickness) * 1.05  // Slightly tighter to card edge
          : agreementNodeRadius * 1.05;
          
        let targetRadius = targetType === "actor" 
          ? (cardNodeRadius + donutThickness) * 1.05  // Slightly tighter to card edge
          : agreementNodeRadius * 1.05;
          
        // For agreement nodes, we may want to adjust the radius even more
        // to account for their styling 
        if (sourceType === "agreement") {
          sourceRadius = agreementNodeRadius * 1.2; // Slightly larger to account for styling
        }
        
        if (targetType === "agreement") {
          targetRadius = agreementNodeRadius * 1.2; // Slightly larger to account for styling
        }
        
        // Calculate the angle between source and target
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const angle = Math.atan2(dy, dx);
        
        // Calculate the start and end points with precise offsets
        const sourceX = sourceNode.x + Math.cos(angle) * sourceRadius;
        const sourceY = sourceNode.y + Math.sin(angle) * sourceRadius;
        
        // Different arrow padding depending on target type for cleaner appearance
        // The refX value in the marker definition is important here
        // Ensure the line doesn't extend past the arrowhead
        const arrowPadding = targetType === "agreement" ? 10 : 5;
        const targetX = targetNode.x - Math.cos(angle) * (targetRadius + arrowPadding);
        const targetY = targetNode.y - Math.sin(angle) * (targetRadius + arrowPadding);
        
        // Set the line coordinates with improved positioning
        d3.select(this)
          .attr("x1", sourceX)
          .attr("y1", sourceY)
          .attr("x2", targetX)
          .attr("y2", targetY)
          .attr("stroke", d.type === "benefit" ? "#4C9AFF" : "#FF5630") // Blue for benefits, red for obligations
          .attr("stroke-width", 1.5); // Slightly thicker for visibility
      });
    }

    // Create node selection and elements with CSS classes for styling
    nodeElements = nodeGroup
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("id", (d) => `node-${d.id}`)
      .attr("class", (d) => `node node-${d.type}${d.active ? " active" : ""}`)
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .call(
        d3
          .drag<any, D3Node>()
          .on("start", (event, d) => {
            // Remove any fx/fy values which can cause simulation auto-movement
            d.fx = null;
            d.fy = null;
          })
          .on("drag", (event, d) => {
            // During drag, update node position directly
            d.x = event.x;
            d.y = event.y;
            // Update the visual position of the node
            d3.select(event.sourceEvent.target.parentNode).attr(
              "transform",
              `translate(${d.x},${d.y})`,
            );

            // Also update any connected links in real-time
            updateLinks();
          })
          .on("end", (event, d) => {
            // When drag ends, save the final position
            d3.select(`#node-${d.id}`).attr(
              "transform",
              `translate(${d.x},${d.y})`,
            );
            
            // Save position data
            if (d.type === 'actor') {
              const card = d.data as CardWithPosition;
              card.position = { x: d.x, y: d.y };
            } else if (d.type === 'agreement') {
              const agreement = d.data as AgreementWithPosition;
              agreement.position = { x: d.x, y: d.y };
            }
          }),
      )
      // Node-level click handler removed. 
      // Individual click handlers are now on the center circle and agreement circle elements.
      //
      // This improves the user experience by:
      // 1. Making only the center circle clickable (not the donut ring)
      // 2. Using current node coordinates for accurate popover positioning
      .on("mouseenter", (event, d) => {
        // Keep existing hover behavior
        if (d.type === 'actor') {
          activeCardId = d.id;
        }
      })
      .on("mouseover", (event, d) => {
        // On hover, set the hovered node but don't use the separate radial menu
        // The donut rings handle everything with their own mouse events
        if (d.type === 'actor') {
          hoveredNode = d.id;
          // No need to call updateRadialMenu - all visualization is handled by D3
        }
      })
      .on("mouseout", (event, d) => {
        // Just clear hover state - donut rings handle their own events
        hoveredNode = null;
      });

    // Initialize link positions
    updateLinks();

    // Add donut rings around card nodes
    addDonutRings();
    
    // Add center circles with gradients and add text on top
    const cardNodes = nodeElements.filter((d) => d.type === "actor");

    // Define gradient for center button
    cardNodes.each(function (d) {
      const nodeId = d.id;

      // Create a unique gradient ID for each node
      const gradientId = `center-gradient-${nodeId}`;

      // Add the gradient definition
      const gradient = defs
        .append("radialGradient")
        .attr("id", gradientId)
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%")
        .attr("fx", "50%")
        .attr("fy", "50%");

      // Add the gradient stops - flat button appearance with light gray shadow
      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#FFFFFF") // White center
        .attr("stop-opacity", 0.9);    // Slight transparency
        
      gradient
        .append("stop")
        .attr("offset", "85%")
        .attr("stop-color", "#F5F5F5") // Very light gray
        .attr("stop-opacity", 0.9);
        
      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#E0E0E0") // Light gray edge for subtle shadow
        .attr("stop-opacity", 0.9);

      // Add the center circle 
      const nodeRadius = 35; // Standard card node radius
      
      d3.select(this)
        .append("circle")
        .attr("r", nodeRadius)
        .attr("fill", `url(#${gradientId})`)
        .attr("stroke", "#e5e5e5") // Light gray stroke
        .attr("stroke-width", 1)
        .attr("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.08))") // Subtle shadow
        .attr("class", `center-circle card-center-circle${d.active ? " active" : ""}`)
        .style("cursor", "pointer")
        .attr("pointer-events", "all") // Ensure clickable
        .on("click", function(event) {
          event.stopPropagation(); // Prevent event bubbling
          
          // First, save the current node position to ensure latest coordinates are used
          console.log(`Saving node position: ${d.id} at x:${d.x} y:${d.y}`);
          
          // Get the current node data from the simulation
          const node = d3.select(this.parentNode).datum();
          
          // Toggle popover when clicking the same node
          const isSameNode = popoverOpen && popoverNode && 
            ((popoverNodeType === 'actor' && node.type === 'actor' && (popoverNode as Actor).card_id === node.id) || 
             (popoverNodeType === 'agreement' && node.type === 'agreement' && (popoverNode as Agreement).agreement_id === node.id));
          
          if (isSameNode) {
            // Close popover when clicking the same node
            popoverOpen = false;
            console.log("Closing popover - same node clicked again");
          } else {
            // Open the popover to show node details for a different node
            popoverNode = node.data;
            popoverNodeType = node.type;
            
            // Calculate position for the popover using CURRENT coordinates
            // This ensures popover is positioned relative to the node's CURRENT position
            popoverPosition = { 
              x: node.x, 
              y: node.y 
            };
            popoverOpen = true;
            
            // Debug log
            console.log("Node clicked:", node.type, node.id);
            console.log("Popover position:", popoverPosition);
          }
        });
    });

    // Now add center icon group based on card.icon
    const centralIconGroup = nodeElements
      .append("g")
      .attr("class", "central-icon-group")
      .attr("pointer-events", "none"); // Make icon group non-interactive

    // Preload all icons first before adding them to nodes
    const iconSize = 24; // Size of the icon
    
    // Collect all icon names from cards
    const iconNames = cardNodes.data().map(d => {
      const card = d.data as Card;
      return card.icon || card.type || 'default';
    });
    
    // Filter out duplicates and load icons once for all nodes
    const uniqueIcons = [...new Set(iconNames)];
    if (uniqueIcons.length > 0) {
      console.log("Preloading icons:", uniqueIcons);
      // Load icons and wait for them to finish before continuing
      await loadIcons(uniqueIcons);
      console.log("Icons loaded, continuing with visualization");
    }
    
    // After loading all icons, add them to each node
    cardNodes.each(function(d) {
      const card = d.data as Card;
      const nodeGroup = d3.select(this);
      
      // Remove any existing icons
      nodeGroup.selectAll('.center-icon').remove();
      
      // Create foreignObject to hold the Svelte icon component
      const foreignObject = nodeGroup
        .append('foreignObject')
        .attr('class', 'center-icon')
        .attr('width', iconSize)
        .attr('height', iconSize)
        .attr('x', -iconSize / 2)
        .attr('y', -iconSize / 2)
        .attr('pointer-events', 'none');
      
      // Create a div inside foreignObject to hold the icon
      const div = foreignObject
        .append('xhtml:div')
        .style('width', `${iconSize}px`)
        .style('height', `${iconSize}px`)
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center');
      
      // Get and render the icon component from our helper function
      // Need to use an immediately-invoked async function to handle the async icon loading
      (async () => {
        try {
          const iconName = card.icon || card.type || 'default';
          console.log(`Getting icon for card ${card.card_id} (${card.role_title}): ${iconName}`);
          
          // Get the icon component asynchronously
          const IconComponent = await getLucideIcon(iconName);
          
          // Create the Svelte icon component
          new IconComponent({
            target: div.node(),
            props: {
              size: iconSize,
              color: '#555555',
              strokeWidth: 2,
              class: 'lucide-icon',
            },
          });
          
          console.log(`Successfully rendered icon for ${card.role_title}`);
        } catch (e) {
          console.error(`Error rendering icon for ${card.role_title}:`, e);
          
          // Fallback to User icon if something goes wrong
          new User({
            target: div.node(),
            props: {
              size: iconSize,
              color: '#555555',
              strokeWidth: 2,
              class: 'lucide-icon',
            },
          });
        }
      })();
    });

    // Create name labels outside/below the node for better readability
    const cardNameGroups = cardNodes
      .append("g")
      .attr("class", "card-name-container")
      .attr("pointer-events", "none"); // Make label non-interactive
    
    // Add background rectangle for label with semi-transparent background and rounded corners
    cardNameGroups.each(function(d) {
      const group = d3.select(this);
      const card = d.data as Card;
      const labelText = card.role_title.length > 20 
        ? card.role_title.slice(0, 17) + "..." 
        : card.role_title;
      
      // First create a temporary text element to measure text width
      const tempText = group.append("text")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text(labelText)
        .style("visibility", "hidden");
        
      // Measure the text width (use getBBox method)
      const textWidth = tempText.node().getBBox().width;
      tempText.remove(); // Remove the temporary element
      
      // Create background rectangle with compact padding
      const padding = 5;
      const rectWidth = textWidth + padding * 2;
      const rectHeight = 18;
      
      // Get card color to match label color with card
      const cardData = d.data as CardWithPosition;
      
      // Calculate position below the outer ring (donut)
      // The outer ring radius = nodeRadius + donutThickness (35 + 15 = 50)
      const outerRingRadius = cardNodeRadius + donutThickness;
      const labelYPosition = outerRingRadius + (outerRingRadius * 0.1); // Position 10% below the outer ring
      
      // Add the rounded rectangle background - positioned below the outer ring
      group.append("rect")
        .attr("rx", 4) // Rounded corners
        .attr("ry", 4)
        .attr("width", rectWidth)
        .attr("height", rectHeight)
        .attr("x", -rectWidth / 2) // Center horizontally
        .attr("y", labelYPosition) // Position below the outer ring
        .attr("fill", "var(--color-tertiary-50, white)") // Use theme variable with white fallback
        .attr("fill-opacity", 0.85) // Semi-transparent background
        .attr("stroke", "var(--color-tertiary-300, #e5e5e5)") // Light border from theme
        .attr("stroke-width", 0.5) // Thin border
      
      // Add the text on top of the background
      group.append("text")
        .attr("class", "name-text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle") // Better centering
        .attr("y", labelYPosition + (rectHeight / 2)) // Center text vertically in background
        .attr("font-size", "11px") 
        .attr("font-weight", "500")
        .attr("fill", "var(--node-text-light, var(--color-tertiary-900))") // Use themed variable for proper color in both modes
        .text(labelText);
    });

    // Create agreement nodes with smaller circles
    const agreementNodes = nodeElements.filter((d) => d.type === "agreement");
    
    // Generate sequential IDs for our agreements (e.g., AG1, AG2)
    let agreementCounter = 1;
    

    
    agreementNodes.each(function(d) {
      // Add a small circle for agreement nodes - UPDATED styling to match the reference image exactly
      d3.select(this)
        .append("circle")
        .attr("r", 17) // Smaller radius for agreement nodes
        .attr("fill", "#444444") // Dark gray/black fill to match reference image
        .attr("stroke", "#333333") // Slightly darker stroke for definition
        .attr("stroke-width", 0.75) // Thinner stroke for subtle appearance
        .attr("class", "agreement-circle")
        .style("cursor", "pointer")
        .attr("pointer-events", "all") // Ensure clickable
        .style("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.2))") // Subtle shadow
        .on("click", function(event) {
          event.stopPropagation(); // Prevent event bubbling
          
          // First, save the current node position to ensure latest coordinates are used
          console.log(`Saving node position: ${d.id} at x:${d.x} y:${d.y}`);
          
          // Get the current node data from the simulation
          const node = d3.select(this.parentNode).datum();
          
          // Toggle popover when clicking the same node
          const isSameNode = popoverOpen && popoverNode && 
            ((popoverNodeType === 'actor' && node.type === 'actor' && (popoverNode as Actor).card_id === node.id) || 
             (popoverNodeType === 'agreement' && node.type === 'agreement' && (popoverNode as Agreement).agreement_id === node.id));
          
          if (isSameNode) {
            // Close popover when clicking the same node
            popoverOpen = false;
            console.log("Closing popover - same node clicked again");
          } else {
            // Open the popover to show node details for a different node
            popoverNode = node.data;
            popoverNodeType = node.type;
            
            // Calculate position for the popover using CURRENT coordinates
            // This ensures popover is positioned relative to the node's CURRENT position
            popoverPosition = { 
              x: node.x, 
              y: node.y 
            };
            popoverOpen = true;
            
            // Debug log
            console.log("Node clicked:", node.type, node.id);
            console.log("Popover position:", popoverPosition);
          }
        });
        
      // Create an agreement ID (AG1, AG2, etc.)
      const agreementId = `AG${agreementCounter++}`;
        
      // Add a title text label - UPDATED to match reference exactly
      d3.select(this)
        .append("text")
        .attr("class", "agreement-title")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle") // Better vertical centering
        .attr("font-size", "11px") // Smaller font for subtlety
        .attr("font-weight", "bold") // Bold weight to match reference
        .attr("fill", "#FFFFFF") // White text to match reference image
        .text(agreementId);
        
      // Add agreement title below on hover (handled by CSS)
      d3.select(this)
        .append("title")
        .text((d) => {
          const agreement = d.data as Agreement;
          return agreement.title || "Untitled Agreement";
        });
    });
    
    // Create central text elements LAST to ensure proper layering
    // This ensures text appears above all other elements
    cardNodes.each(function(nodeData) {
      const node = d3.select(this);
      
      // Create central text group as the last child element for proper layering
      const centerTextGroup = node.append("g")
        .attr("class", "center-text-group")
        .attr("pointer-events", "none");
      
      centerTextGroup.append("text")
        .attr("class", "count-text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "#555555")
        .text("");
        
      centerTextGroup.append("text")
        .attr("class", "options-text") 
        .attr("text-anchor", "middle")
        .attr("dy", "1em")
        .attr("font-size", "12px")
        .attr("fill", "#777777")
        .text("");
    });

    // Handle zoom functionality with better event handling
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on("zoom", (event) => {
        // Update transform for all groups to maintain consistent appearance
        nodeGroup.attr("transform", event.transform);
        linkGroup.attr("transform", event.transform);
        
        // Reset any active hover states to prevent visualization issues during zoom
        if (hoveredCategory) {
          hoveredCategory = null;
          
          // Hide all sub-wedges and labels immediately on zoom
          d3.selectAll(".sub-wedges")
            .style("opacity", 0)
            .style("visibility", "hidden");
            
          d3.selectAll(".label-container")
            .style("opacity", 0)
            .style("visibility", "hidden");
            
          // Reset all wedges to normal size
          d3.selectAll(".category-wedge")
            .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))");
            
          // Clear all central text elements
          d3.selectAll(".count-text, .options-text").text("");
        }
      });
    
    // Apply zoom behavior with event filtering
    svg.call(zoomBehavior)
       // Prevent standard mousewheel behavior and avoid event conflicts
       .on("wheel", (event) => {
         if (event.ctrlKey || event.metaKey) return; // Allow browser zoom with Ctrl/Cmd key
         event.preventDefault(); // Prevent default browser scrolling
       });
  }

  // Create demo agreements for testing when no real agreements exist
  function createDemoAgreements() {
    if (cardsWithPosition.length < 3) return;
    
    // Create a circular agreement between 3 cards
    const card1 = cardsWithPosition[0];
    const card2 = cardsWithPosition[1];
    const card3 = cardsWithPosition[2];
    
    // Create mock actor IDs for cards if they don't exist
    const actor1Id = `actor_${card1.card_id}`;
    const actor2Id = `actor_${card2.card_id}`;
    const actor3Id = `actor_${card3.card_id}`;
    
    // Map card IDs to actor IDs
    actorCardMap.set(actor1Id, card1.card_id);
    actorCardMap.set(actor2Id, card2.card_id);
    actorCardMap.set(actor3Id, card3.card_id);
    
    // Create agreement 1: card1 -> card2
    const agreement1: AgreementWithPosition = {
      agreement_id: "agreement_1",
      title: "Resource Sharing",
      description: "Agreement to share resources between parties",
      created_at: Date.now(),
      status: "active",
      parties: {
        [actor1Id]: true,
        [actor2Id]: true
      },
      obligations: [
        {
          id: "ob1",
          fromActorId: actor1Id,
          toActorId: actor2Id,
          text: "Provide funding"
        }
      ],
      benefits: [
        {
          id: "be1", 
          fromActorId: actor2Id,
          toActorId: actor1Id,
          text: "Deliver results"
        }
      ],
      position: {
        x: ((card1.position?.x || 0) + (card2.position?.x || 0)) / 2,
        y: ((card1.position?.y || 0) + (card2.position?.y || 0)) / 2
      }
    };
    
    // Create agreement 2: card2 -> card3
    const agreement2: AgreementWithPosition = {
      agreement_id: "agreement_2",
      title: "Knowledge Sharing",
      description: "Agreement to share knowledge and expertise",
      created_at: Date.now(),
      status: "active",
      parties: {
        [actor2Id]: true,
        [actor3Id]: true
      },
      obligations: [
        {
          id: "ob2",
          fromActorId: actor2Id,
          toActorId: actor3Id,
          text: "Share methodology"
        }
      ],
      benefits: [
        {
          id: "be2",
          fromActorId: actor3Id,
          toActorId: actor2Id,
          text: "Provide data"
        }
      ],
      position: {
        x: ((card2.position?.x || 0) + (card3.position?.x || 0)) / 2,
        y: ((card2.position?.y || 0) + (card3.position?.y || 0)) / 2
      }
    };
    
    // Create agreement 3: card3 -> card1
    const agreement3: AgreementWithPosition = {
      agreement_id: "agreement_3",
      title: "Community Support",
      description: "Agreement to support community initiatives",
      created_at: Date.now(),
      status: "active",
      parties: {
        [actor3Id]: true,
        [actor1Id]: true
      },
      obligations: [
        {
          id: "ob3",
          fromActorId: actor3Id,
          toActorId: actor1Id,
          text: "Provide community support"
        }
      ],
      benefits: [
        {
          id: "be3",
          fromActorId: actor1Id,
          toActorId: actor3Id,
          text: "Provide mentorship"
        }
      ],
      position: {
        x: ((card3.position?.x || 0) + (card1.position?.x || 0)) / 2,
        y: ((card3.position?.y || 0) + (card1.position?.y || 0)) / 2
      }
    };
    
    // Add agreements to the array
    agreements = [agreement1, agreement2, agreement3];
  }
  
  // Complete remake of donut rings to EXACTLY match React implementation
  function addDonutRings() {
    // ----- EXACTLY MATCH REACT APPROACH -----
    
    // Get all card nodes
    const cardNodes = nodeElements.filter((d) => d.type === "actor");
    
    // Fixed values for radii (from CSS variables in React)
    const baseActorRadius = 35; 
    const baseDonutThickness = 15;

    // Helper function to ensure array format for properties
    const ensureArray = (field: any): string[] => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (typeof field === 'object') {
        // Handle Gun.js objects and references
        return Object.keys(field).filter(id => id !== '_' && id !== '#');
      }
      if (typeof field === 'string') {
        return field.split(',').map(item => item.trim());
      }
      return [];
    };
    
    // Step 1 (React): Add outer donut rings to all card nodes first
    cardNodes.each(function(d) {
      const isActive = d.id === activeCardId;
      const scaleFactor = isActive ? 1.5 : 1;
      const scaledNodeRadius = baseActorRadius * scaleFactor;
      const donutRadius = scaledNodeRadius + baseDonutThickness * scaleFactor;
      
      // Add a donut ring
      d3.select(this)
        .append("circle")
        .attr("r", donutRadius)
        .attr("class", `donut-ring${isActive ? " active" : ""}`)
        .attr("fill", "transparent")
        .attr("stroke", "var(--border)")
        .attr("stroke-width", 1);
    });

    // Available categories for visualization
    const categories = ["values", "capabilities", "intellectualProperty", "resources", "goals"];
    
    // Format category name nicely (shared helper function)
    const formatCategoryName = (cat: string) => {
      return cat
        .replace(/([A-Z])/g, " $1") // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
        .trim();
    };

    // Process each card node to add wedges
    cardNodes.each(function(nodeData) {
      // Basic setup for this node
      const node = d3.select(this);
      const card = nodeData.data as Card;
      const nodeId = nodeData.id;
      
      // Process card data for visualization
      const cardDataForViz = { ...(card as any) };
      
      // Debug: Print data from the D3 node
      console.log(`DEBUG: Node data for ${nodeData.name}:`, nodeData);
      console.log(`DEBUG: Card data for ${card.role_title}:`, card);
      console.log(`DEBUG: Looking for _valueNames in nodeData:`, nodeData._valueNames);
      console.log(`DEBUG: Looking for _valueNames in card:`, (card as any)._valueNames);
      
      // IMPORTANT: Get the values directly from the d3 node object, not the card
      // This ensures we use the data that was explicitly passed from the card to the node
      if (nodeData._valueNames && nodeData._valueNames.length > 0) {
        // Update cardDataForViz with values from D3 node
        cardDataForViz._valueNames = nodeData._valueNames;
      }
      
      // Use our real value/capability data that was loaded with loadCardDetails
      if (cardDataForViz._valueNames && cardDataForViz._valueNames.length > 0) {
        console.log(`Using ${cardDataForViz._valueNames.length} real values for card ${card.role_title}:`, cardDataForViz._valueNames);
        
        // Create a values object in the format required for visualization
        const realValuesObj: Record<string, boolean> = {};
        
        // Add each value name as a properly keyed entry
        cardDataForViz._valueNames.forEach((valueName: string) => {
          const key = `value_${valueName.toLowerCase().replace(/\s+/g, '-')}`;
          realValuesObj[key] = true;
          
          // Make sure the value is in our cache for labels
          if (!valueCache.has(key)) {
            valueCache.set(key, {
              value_id: key,
              name: valueName,
              description: `${valueName} for ${card.role_title}`,
              created_at: Date.now()
            });
          }
        });
        
        // Use the real values for visualization
        cardDataForViz.values = realValuesObj;
      }
      // Fallback to standard values if no real values were loaded
      else if (!cardDataForViz.values || Object.keys(cardDataForViz.values).filter(k => k !== '_' && k !== '#').length === 0) {
        console.log(`Using default values for card ${card.role_title}`);
        
        // Use standard values that match our database
        cardDataForViz.values = { 
          'value_sustainability': true, 
          'value_community-resilience': true
        };
          
        // Initialize our cache with these known values
        if (!valueCache.has('value_sustainability')) {
          valueCache.set('value_sustainability', { 
            value_id: 'value_sustainability', 
            name: 'Sustainability',
            description: 'Practices that can be maintained indefinitely',
            created_at: Date.now()
          });
        }
        
        if (!valueCache.has('value_community-resilience')) {
          valueCache.set('value_community-resilience', { 
            value_id: 'value_community-resilience', 
            name: 'Community Resilience',
            description: 'Ability to adapt and recover from adversity',
            created_at: Date.now()
          });
        }
      } else {
        // For existing values, ensure we have them in our cache
        Object.keys(cardDataForViz.values).forEach(key => {
          if (key !== '_' && key !== '#' && !valueCache.has(key)) {
            const valueName = key.replace('value_', '')
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            valueCache.set(key, { 
              value_id: key, 
              name: valueName,
              description: `Value for ${card.role_title}`,
              created_at: Date.now()
            });
          }
        });
      }
      
      // Do the same for capabilities - use loaded capability names if available
      if (cardDataForViz._capabilityNames && cardDataForViz._capabilityNames.length > 0) {
        console.log(`Using ${cardDataForViz._capabilityNames.length} real capabilities for card ${card.role_title}:`, cardDataForViz._capabilityNames);
        
        // Create a capabilities object in the format required for visualization
        const realCapabilitiesObj: Record<string, boolean> = {};
        
        // Add each capability name as a properly keyed entry
        cardDataForViz._capabilityNames.forEach((capName: string) => {
          const key = `capability_${capName.toLowerCase().replace(/\s+/g, '-')}`;
          realCapabilitiesObj[key] = true;
          
          // Make sure the capability is in our cache for labels
          if (!capabilityCache.has(key)) {
            capabilityCache.set(key, {
              capability_id: key,
              name: capName,
              description: `${capName} for ${card.role_title}`,
              created_at: Date.now()
            });
          }
        });
        
        // Use the real capabilities for visualization
        cardDataForViz.capabilities = realCapabilitiesObj;
      }
      // Fallback to standard capabilities if no real capabilities were loaded
      else if (!cardDataForViz.capabilities || Object.keys(cardDataForViz.capabilities).filter(k => k !== '_' && k !== '#').length === 0) {
        console.log(`Using default capabilities for card ${card.role_title}`);
        
        // Default capabilities based on card type
        if (card.card_category === 'Funders') {
          cardDataForViz.capabilities = {
            'capability_grant-writing-expertise': true,
            'capability_impact-assessment': true
          };
          
          if (!capabilityCache.has('capability_grant-writing-expertise')) {
            capabilityCache.set('capability_grant-writing-expertise', {
              capability_id: 'capability_grant-writing-expertise',
              name: 'Grant Writing Expertise',
              description: 'Ability to secure funding through grants',
              created_at: Date.now()
            });
          }
          
          if (!capabilityCache.has('capability_impact-assessment')) {
            capabilityCache.set('capability_impact-assessment', {
              capability_id: 'capability_impact-assessment',
              name: 'Impact Assessment',
              description: 'Measuring project outcomes and effectiveness',
              created_at: Date.now()
            });
          }
        } else if (card.type === 'DAO') {
          cardDataForViz.capabilities = {
            'capability_coordination': true,
            'capability_planning': true
          };
          
          if (!capabilityCache.has('capability_coordination')) {
            capabilityCache.set('capability_coordination', {
              capability_id: 'capability_coordination',
              name: 'Coordination',
              description: 'Managing decentralized activities',
              created_at: Date.now()
            });
          }
          
          if (!capabilityCache.has('capability_planning')) {
            capabilityCache.set('capability_planning', {
              capability_id: 'capability_planning',
              name: 'Planning',
              description: 'Developing and executing strategies',
              created_at: Date.now()
            });
          }
        } else {
          // Generic capabilities
          cardDataForViz.capabilities = {
            'capability_community-outreach': true,
            'capability_planning': true
          };
          
          if (!capabilityCache.has('capability_community-outreach')) {
            capabilityCache.set('capability_community-outreach', {
              capability_id: 'capability_community-outreach',
              name: 'Community Outreach',
              description: 'Engaging with local community members',
              created_at: Date.now()
            });
          }
          
          if (!capabilityCache.has('capability_planning')) {
            capabilityCache.set('capability_planning', {
              capability_id: 'capability_planning',
              name: 'Planning',
              description: 'Developing and executing strategies',
              created_at: Date.now()
            });
          }
        }
      } else {
        // For existing capabilities, ensure we have them in our cache
        Object.keys(cardDataForViz.capabilities).forEach(key => {
          if (key !== '_' && key !== '#' && !capabilityCache.has(key)) {
            const capName = key.replace('capability_', '')
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            capabilityCache.set(key, { 
              capability_id: key, 
              name: capName,
              description: `Capability for ${card.role_title}`,
              created_at: Date.now()
            });
          }
        });
      }
      
      // Map legacy field names 
      if (!cardDataForViz.resources && card.rivalrous_resources) {
        cardDataForViz.resources = card.rivalrous_resources;
      }
      
      if (!cardDataForViz.intellectualProperty && card.intellectual_property) {
        cardDataForViz.intellectualProperty = card.intellectual_property;
      }
      
      // Convert all category fields to arrays for consistent processing
      categories.forEach(cat => {
        if (typeof cardDataForViz[cat] === "string") {
          cardDataForViz[cat] = ensureArray(cardDataForViz[cat]);
        } else if (typeof cardDataForViz[cat] === "object") {
          cardDataForViz[cat] = ensureArray(cardDataForViz[cat]);
        }
      });
      
      // Filter to only categories with content
      const cardCategories = categories.filter(
        (cat) => ensureArray(cardDataForViz[cat]).length > 0
      );
      
      // Skip if no valid categories
      if (cardCategories.length === 0) return;
      
      // Set up scaling based on active status
      const isActive = nodeId === activeCardId;
      const scaleFactor = isActive ? 1.5 : 1;
      const actorNodeRadius = baseActorRadius * scaleFactor;
      const donutThickness = baseDonutThickness * scaleFactor;
      const donutRadius = actorNodeRadius + donutThickness;
      const expandedRadius = donutRadius + 15 * scaleFactor;
      
      // Step 2 (React): Create the category-level pie chart 
      const categoryPie = d3.pie<string>()
        .value(() => 1) 
        .sort(null);    
      
      const categoryPieData = categoryPie(cardCategories);
      
      // Step 3 (React): Define the arcs
      const categoryArc = d3.arc<d3.PieArcDatum<string>>()
        .innerRadius(actorNodeRadius)
        .outerRadius(actorNodeRadius + donutThickness)
        .cornerRadius(1)
        .padAngle(0.02);
      
      const expandedArc = d3.arc<d3.PieArcDatum<string>>()
        .innerRadius(actorNodeRadius)
        .outerRadius(expandedRadius)
        .cornerRadius(3)
        .padAngle(0.04);
      
      // Step 4 (React): Create a parent group for each wedge
      const categoryGroups = node
        .selectAll(".category-group")
        .data(categoryPieData)
        .enter()
        .append("g")
        .attr("class", "category-group")
        .attr("data-category", (d) => d.data);
      
      // Step 5 (React): Add the wedges to each group with direct event handlers
      categoryGroups
        .append("path")
        .attr("class", "category-wedge")
        .attr("d", categoryArc)
        .attr("fill", (d) => categoryColors(d.data))
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))")
        .style("cursor", "pointer")
        .attr("data-category", (d) => d.data)
        .attr("pointer-events", "all");
      
      // Process each category to create its sub-elements
      categoryGroups.each(function(d) {
        const group = d3.select(this);
        const category = d.data;
        const content = ensureArray(cardDataForViz[category]);
        
        if (content.length === 0) return;
        
        // Create container for sub-wedges (hidden initially)
        const subWedgesGroup = group
          .append("g")
          .attr("class", "sub-wedges")
          .style("visibility", "hidden")
          .attr("opacity", 0)
          .attr("pointer-events", "none");
        
        // Create container for labels (hidden initially)
        const labelsContainer = group  
          .append("g")
          .attr("class", "label-container")
          .style("visibility", "hidden")
          .attr("opacity", 0)
          .attr("pointer-events", "none");
        
        // Create sub-wedges within the category wedge
        const subItemPie = d3.pie<string>()
          .startAngle(d.startAngle)
          .endAngle(d.endAngle)
          .value(() => 1)
          .sort(null);
        
        const subItemPieData = subItemPie(content);
        
        // Define arc for sub-wedges
        const subArc = d3.arc<d3.PieArcDatum<string>>()
          .innerRadius(actorNodeRadius)
          .outerRadius(expandedRadius)
          .cornerRadius(1)
          .padAngle(0.01);
        
        // Add sub-wedges - directly match React
        subWedgesGroup
          .selectAll(".sub-wedge")
          .data(subItemPieData)
          .enter()
          .append("path")
          .attr("class", "sub-wedge")
          .attr("d", subArc)
          .attr("fill", categoryColors(category))
          .attr("stroke", "white")
          .attr("stroke-width", 0.5)
          .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))")
          .attr("pointer-events", "none");
        
        // Add text labels for each item - directly match React
        subItemPieData.forEach((itemWedge, index) => {
          const item = itemWedge.data;
          
          // Calculate label angle and position exactly as in React
          const itemAngle = (itemWedge.startAngle + itemWedge.endAngle) / 2;
          const adjustedAngle = itemAngle - Math.PI / 2;
          
          // Calculate label position with gap
          const gapPercentage = 0.15; 
          const labelDistance = expandedRadius * (1 + gapPercentage);
          const labelX = Math.cos(adjustedAngle) * labelDistance;
          const labelY = Math.sin(adjustedAngle) * labelDistance;
          
          // Determine text rotation and anchor
          const angleDeg = ((adjustedAngle * 180) / Math.PI) % 360;
          const isLeftSide = angleDeg > 90 && angleDeg < 270;
          const textAnchor = isLeftSide ? "end" : "start";
          const rotationDeg = isLeftSide ? angleDeg + 180 : angleDeg;
          
          // Get item name
          let itemName = item;
          if (category === "values" && valueCache.has(item)) {
            itemName = valueCache.get(item).name;
          } else if (category === "capabilities" && capabilityCache.has(item)) {
            itemName = capabilityCache.get(item).name;
          }
          
          // Add the label text
          labelsContainer
            .append("text")
            .attr("class", "item-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("font-size", "11px")
            .attr("fill", categoryColors(category))
            .attr("font-weight", "500")
            .attr("transform", `rotate(${rotationDeg},${labelX},${labelY})`)
            .text(itemName);
        });
        
        // Add mouse event handlers exactly like React
        const wedge = group.select(".category-wedge");
        
        // mouseenter event handler - FIXED same as mouseleave
        wedge.on("mouseenter", function(event) {
          // Critical: Prevent event bubbling
          event.stopPropagation();
          
          // Store references to DOM elements to prevent issues with "this" context
          const thisWedge = d3.select(this);
          const thisSubWedges = subWedgesGroup;
          const thisLabels = labelsContainer;
          const thisNode = node;
          
          // Reset all other wedges to default
          thisNode.selectAll(".category-wedge").each(function() {
            const otherWedge = d3.select(this);
            if (otherWedge.node() !== thisWedge.node()) {
              otherWedge
                .transition()
                .duration(150)
                .attr("d", categoryArc)
                .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))");
            }
          });
          
          // Hide all sub-elements before showing the ones for this wedge
          thisNode.selectAll(".sub-wedges, .label-container")
            .style("visibility", "hidden")
            .attr("opacity", 0);
          
          // Expand this wedge
          thisWedge
            .transition()
            .duration(150)
            .attr("d", expandedArc)
            .attr("filter", "drop-shadow(0px 0px 3px rgba(0,0,0,0.3))");
          
          // Show sub-elements for this wedge with explicit references
          thisSubWedges
            .style("visibility", "visible")
            .transition()
            .duration(150)
            .attr("opacity", 1);
          
          thisLabels
            .style("visibility", "visible")
            .transition()
            .duration(150)
            .attr("opacity", 1);
          
          // Hide the center icon when a wedge is hovered
          thisNode.select(".center-icon")
            .transition()
            .duration(150)
            .attr("opacity", 0);
            
          // Update central text with explicit references
          thisNode.select(".count-text")
            .transition()
            .duration(150)
            .text(content.length);
          
          thisNode.select(".options-text")
            .transition()
            .duration(150)
            .text(formatCategoryName(category));
        });
        
        // mouseleave event handler - CRITICAL FIX for disappearing nodes
        wedge.on("mouseleave", function(event) {
          // Critical: Prevent event bubbling
          event.stopPropagation();
          
          // Store references to DOM elements to prevent issues with "this" context
          const thisWedge = d3.select(this);
          const thisSubWedges = subWedgesGroup;
          const thisLabels = labelsContainer;
          const thisNode = node;
          
          // Reset this specific wedge's appearance
          thisWedge
            .transition()
            .duration(200)
            .attr("d", categoryArc)
            .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))");
          
          // Hide sub-elements with explicit element references
          thisSubWedges
            .transition()
            .duration(100)
            .attr("opacity", 0)
            .on("end", function() {
              thisSubWedges.style("visibility", "hidden");
            });
          
          thisLabels
            .transition()
            .duration(100)
            .attr("opacity", 0)
            .on("end", function() {
              thisLabels.style("visibility", "hidden");
            });
          
          // Show center icon again
          thisNode.select(".center-icon")
            .transition()
            .duration(200)
            .attr("opacity", 0.7);
          
          // Clear central text with explicit references
          thisNode.select(".count-text")
            .transition()
            .duration(200)
            .text("");
          
          thisNode.select(".options-text")
            .transition()
            .duration(200)
            .text("");
        });
      });
    });
  }
  
  // All visualization is now handled directly by D3 in the addDonutRings() function

  function handleSearch() {
    // Implement search logic here
  }

  function handleZoomIn() {
    const svg = d3.select(svgRef);
    const currentTransform = d3.zoomTransform(svg.node() as Element);
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity.scale(currentTransform.k * 1.3)
    );
  }

  function handleZoomOut() {
    const svg = d3.select(svgRef);
    const currentTransform = d3.zoomTransform(svg.node() as Element);
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity.scale(currentTransform.k / 1.3)
    );
  }

  function handleReset() {
    const svg = d3.select(svgRef);
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
  }
</script>

<style>
/* 
 * Only keeping D3/SVG-specific styles that can't be done with Tailwind
 * These are things like SVG-specific attributes (fill, stroke)
 */

/* D3 Node Core Styles - Only SVG-specific styles that can't be represented with Tailwind */
.node { cursor: pointer; }

/* Card and Agreement nodes */
.node-card .center-circle {
  fill: white; 
  stroke: #e5e5e5;
  stroke-width: 1;
  filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.08));
}

.node-card.active .center-circle {
  stroke: #4299e1;
  stroke-width: 2;
}

.node-agreement .agreement-circle {
  fill: white;
  stroke: #e5e5e5;
  stroke-width: 1.5;
  filter: drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.15));
}

.node-agreement.active .agreement-circle {
  stroke: #4299e1;
  stroke-width: 2;
}

/* SVG Text elements */
.count-text, .options-text, .card-title, .card-type, .name-text {
  pointer-events: none;
  user-select: none;
  fill: #333333;
}

/* Dark mode text colors */
:global(html.dark) .count-text,
:global(html.dark) .options-text,
:global(html.dark) .card-title,
:global(html.dark) .card-type,
:global(html.dark) .name-text {
  fill: #e5e5e5;
}

/* Link styling */
.link-line {
  stroke: #e5e5e5;
  stroke-width: 1.5;
  opacity: 0.8;
}

/* Category wedges */
.category-wedge {
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-wedge:hover {
  filter: drop-shadow(0px 0px 3px rgba(0, 0, 0, 0.3));
}

/* Sub-wedges */
.sub-wedge {
  opacity: 0.9;
  filter: drop-shadow(0px 0px 1px rgba(0, 0, 0, 0.1));
}
</style>

<div class="h-full relative overflow-hidden">  
  <!-- D3 SVG container -->
  <svg 
    bind:this={svgRef} 
    width="100%" 
    height="100%" 
    onclick={(event) => {
      // Check if click is directly on SVG background (not on a node)
      if (event.target === svgRef) {
        popoverOpen = false;
      }
    }}
  >
    <!-- D3 visualization will be rendered here -->
    
    <!-- All visualization elements are now created directly with D3 -->
  </svg>
  
  <!-- Popover Container -->
  {#if popoverOpen && popoverNode}
    {@const cardCategory = popoverNodeType === 'actor' ? (popoverNode.card_category || 'Supporters') : ''}
    {@const categoryColor = 
      cardCategory === 'Funders' ? 'primary' : 
      cardCategory === 'Providers' ? 'success' : 
      cardCategory === 'Supporters' ? 'secondary' : 'tertiary'
    }
    
    <div 
      class="absolute max-w-md max-h-[80vh] overflow-y-auto z-[1000]"
      style="left: {popoverPosition.x + 30}px; top: {popoverPosition.y}px; transform: translateY(-50%);"
    >
      <!-- Close button in top right -->
      <div class="absolute top-2 right-2 z-10">
        <button 
          class="btn btn-sm variant-ghost-surface" 
          onclick={handlePopoverClose}
          aria-label="Close popover"
        >
          ×
        </button>
      </div>
      
      {#if popoverNodeType === 'actor' && popoverNode}
        <!-- Card styled to match DeckBrowser format exactly -->
        <!-- Using type casting for TypeScript safety -->
        {@const cardNode = popoverNode as Card}
        <!-- Card styled to exactly match the example image -->
        <div class="card bg-surface-50-900 rounded-lg shadow-lg border border-surface-300-600 w-80">
          <!-- Header with gradient -->
          <header class="p-3 text-white bg-{categoryColor}-500 rounded-t-lg">
            <div class="flex items-center gap-2">
              <!-- Icon circle -->
              <div class="bg-surface-900-50/30 rounded-full p-1.5 flex items-center justify-center">
                <svelte:component this={getCardIcon(cardNode.icon)} class="w-5 h-5" />
              </div>
              
              <!-- Title and type -->
              <div class="flex-1">
                <div class="flex justify-between items-center">
                  <h3 class="font-bold text-lg">{cardNode.role_title}</h3>
                  <span class="text-white text-sm">{cardNode.card_number}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                  <span>{cardNode.type || 'Individual'}</span>
                  <span class="bg-white/20 rounded-full px-2 py-0.5 text-xs">{cardCategory}</span>
                </div>
              </div>
            </div>
          </header>
            
            <!-- Card body with sections -->
            <div class="p-4 space-y-3">
              <!-- Backstory -->
              <div>
                <h4 class="font-medium text-surface-700-300">Backstory</h4>
                <p class="text-surface-900-50">{cardNode.backstory}</p>
              </div>
              
              <!-- Values - Get from values object directly -->
              {#if cardNode.values && Object.keys(cardNode.values).length > 0}
                <div>
                  <h4 class="font-medium text-surface-700-300">Values</h4>
                  <ul class="list-disc list-inside">
                    {#each Object.keys(cardNode.values) as valueId}
                      <li>{valueId.replace('value_', '').replaceAll('-', ' ')}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
              
              <!-- Capabilities - Get from capabilities object directly -->
              {#if cardNode.capabilities && Object.keys(cardNode.capabilities).length > 0}
                <div>
                  <h4 class="font-medium text-surface-700-300">Capabilities</h4>
                  <ul class="list-disc list-inside">
                    {#each Object.keys(cardNode.capabilities) as capabilityId}
                      <li>{capabilityId.replace('capability_', '').replaceAll('-', ' ')}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
              
              <!-- Goals -->
              {#if cardNode.goals}
                <div>
                  <h4 class="font-medium text-surface-700-300">Goals</h4>
                  <p class="text-surface-900-50">{cardNode.goals}</p>
                </div>
              {/if}
              
              <!-- Obligations -->
              {#if cardNode.obligations}
                <div>
                  <h4 class="font-medium text-surface-700-300">Obligations</h4>
                  <p class="text-surface-900-50">{cardNode.obligations}</p>
                </div>
              {/if}
              
              <!-- Intellectual Property -->
              {#if cardNode.intellectual_property}
                <div>
                  <h4 class="font-medium text-surface-700-300">IP</h4>
                  <p class="text-surface-900-50">{cardNode.intellectual_property}</p>
                </div>
              {/if}
              
              <!-- Resources -->
              {#if cardNode.rivalrous_resources}
                <div>
                  <h4 class="font-medium text-surface-700-300">Resources</h4>
                  <p class="text-surface-900-50">{cardNode.rivalrous_resources}</p>
                </div>
              {/if}
            </div>
          </div>
      {:else if popoverNodeType === 'agreement' && popoverNode}
        <!-- Using type casting for TypeScript safety -->
        {@const agreementNode = popoverNode as Agreement}
        <!-- Agreement Card -->
        <div class="card p-4 shadow-lg h-full flex flex-col bg-surface-100-900/80 rounded-lg border border-surface-200 dark:border-surface-700">
          <header class="card-header flex justify-between items-center">
            <h3 class="h3 text-tertiary-500 dark:text-tertiary-400">{agreementNode.title || 'Agreement'}</h3>
            
            {#if agreementNode.status}
              <span class="badge variant-filled-primary text-sm p-1 px-2 rounded-full">{agreementNode.status}</span>
            {/if}
          </header>
          
          <section class="p-4 flex-grow space-y-3">
            {#if agreementNode.description}
              <div>
                <h4 class="font-semibold mb-1">Description</h4>
                <p class="text-sm">{agreementNode.description}</p>
              </div>
            {/if}
            
            <!-- Obligations section -->
            {#if agreementNode.obligations && Array.isArray(agreementNode.obligations) && agreementNode.obligations.length > 0}
              <div>
                <h4 class="font-semibold mb-1">Obligations</h4>
                <ul class="list-disc list-inside">
                  {#each agreementNode.obligations as obligation}
                    <li class="text-sm">
                      <span class="font-medium">{obligation.fromActorId}:</span> 
                      {obligation.description || (obligation as any).text || ''}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
            
            <!-- Benefits section -->
            {#if agreementNode.benefits && Array.isArray(agreementNode.benefits) && agreementNode.benefits.length > 0}
              <div>
                <h4 class="font-semibold mb-1">Benefits</h4>
                <ul class="list-disc list-inside">
                  {#each agreementNode.benefits as benefit}
                    <li class="text-sm">
                      <span class="font-medium">To {benefit.toActorId}:</span> 
                      {benefit.description || (benefit as any).text || ''}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
            
            <!-- Metadata footer -->
            <div class="mt-4 pt-2 border-t border-surface-200 dark:border-surface-700">
              {#if agreementNode.created_at}
                <span class="text-xs text-surface-500 dark:text-surface-400">Created: {new Date(agreementNode.created_at).toLocaleDateString()}</span>
              {/if}
            </div>
          </section>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Controls will be connected to page header -->
  <!-- Removed redundant search and zoom controls that will be handled by GamePageLayout header -->
</div>