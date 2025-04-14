<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import { CirclePlus, ZoomIn, ZoomOut, Maximize, Search } from 'svelte-lucide';
  import gameStore from '$lib/stores/enhancedGameStore';
  import { getGun, nodes } from '$lib/services/gunService';
  import type { Card, Value, Capability, Actor, Agreement } from '$lib/types';
  import { getGame } from '$lib/services/gameService';
  import { userStore } from '$lib/stores/userStore';
  
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
  
  // Interfaces for D3 visualization
  interface D3Node {
    id: string;
    name: string;
    type: "card" | "agreement";
    data: CardWithPosition | AgreementWithPosition;
    x: number;
    y: number;
    fx?: number | null;
    fy?: number | null;
    active?: boolean;
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
    console.log(`D3CardBoard: Initializing for game ${gameId}`);
    
    try {
      // First, use any cards passed directly from the parent component
      if (cards && cards.length > 0) {
        console.log(`D3CardBoard: Using ${cards.length} cards passed from parent component`);
        
        // Create a new array instead of modifying the original cards array
        const newCardsWithPosition: CardWithPosition[] = [];
        
        // Process each card to add position data
        for (const card of cards) {
          if (!card || !card.card_id) {
            console.warn(`D3CardBoard: Invalid card data found, skipping`, card);
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
        console.log(`D3CardBoard: Processed ${cardsWithPosition.length} cards with positions`);
      } else {
        // If no cards were passed directly, fetch from database
        console.log(`D3CardBoard: No cards passed from parent, loading from database`);
        await loadGameData();
      }
      
      // If activeActorId is provided, find its card
      if (activeActorId) {
        console.log(`D3CardBoard: Finding card for actor ${activeActorId}`);
        const actor = actors.find(a => a.actor_id === activeActorId);
        if (actor && actor.card_id) {
          activeCardId = actor.card_id;
          console.log(`D3CardBoard: Set active card to ${activeCardId}`);
        } else {
          console.log(`D3CardBoard: Could not find card for actor ${activeActorId}`);
        }
      }
      
      // Initialize the graph visualization
      console.log(`D3CardBoard: Loaded ${cardsWithPosition.length} cards, ${agreements.length} agreements, ${actors.length} actors`);
      if (cardsWithPosition.length > 0) {
        console.log("D3CardBoard: Initializing graph visualization");
        initializeGraph();
      } else {
        console.warn("D3CardBoard: No cards to display");
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
      
      console.log(`D3CardBoard: Loading game data for ${gameId}`);
      
      // Load the game to get deck_id
      const game = await getGame(gameId);
      if (!game) {
        console.error(`D3CardBoard: Game not found: ${gameId}`);
        return;
      }
      
      console.log(`D3CardBoard: Game loaded:`, game);
      
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
      
      console.log(`D3CardBoard: Loading details for card ${card.card_id} (${card.role_title || 'Untitled Role'})`);
      
      // Load Values with improved Gun.js reference handling
      if (card.values && typeof card.values === 'object') {
        // Filter out metadata key and handle the special Gun.js reference key properly
        const valueIds = Object.keys(card.values)
          .filter(id => id !== '_')
          .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
          
        console.log(`D3CardBoard: Card has ${valueIds.length} values to load`);
        
        // Handle Gun.js references properly
        if (valueIds.length === 1 && valueIds[0] === '#') {
          // Handle reference case
          const reference = card.values['#'];
          if (typeof reference === 'string' && reference.includes('/values/')) {
            console.log(`D3CardBoard: Processing values reference: ${reference}`);
            
            await new Promise<void>((resolve) => {
              try {
                // Use a Set to track processed keys and avoid duplicates
                const processedKeys = new Set<string>();
                
                // Direct query to the values soul reference
                gun.get(reference).map().once((val, key) => {
                  if (key === '_' || processedKeys.has(key)) return; // Skip metadata and duplicates
                  
                  processedKeys.add(key);
                  
                  gun.get(nodes.values).get(key).once((valueData: Value) => {
                    if (valueData && valueData.value_id) {
                      console.log(`D3CardBoard: Loaded value ${key}: ${valueData.name}`);
                      valueCache.set(key, valueData);
                    } else {
                      console.warn(`D3CardBoard: Value ${key} data not found`, valueData);
                    }
                  });
                });
                
                setTimeout(resolve, 500);
              } catch (error) {
                console.error(`D3CardBoard: Error processing values reference:`, error);
                resolve();
              }
            });
          }
        } else {
          // Regular values case (direct ids)
          for (const valueId of valueIds) {
            if (!valueId || valueId === '_' || valueId === '#') continue; // Skip metadata and reference keys
            
            if (!valueCache.has(valueId)) {
              console.log(`D3CardBoard: Loading value ${valueId}`);
              await new Promise<void>((resolve) => {
                try {
                  gun.get(nodes.values).get(valueId).once((valueData: Value) => {
                    if (valueData && valueData.value_id) {
                      console.log(`D3CardBoard: Loaded value ${valueId}: ${valueData.name}`);
                      valueCache.set(valueId, valueData);
                    } else {
                      console.warn(`D3CardBoard: Value ${valueId} data not found or incomplete`);
                    }
                    resolve();
                  });
                  
                  // Add a timeout to ensure we don't get stuck if Gun.js doesn't respond
                  setTimeout(resolve, 500);
                } catch (error) {
                  console.error(`D3CardBoard: Error loading value ${valueId}:`, error);
                  resolve();
                }
              });
            } else {
              console.log(`D3CardBoard: Value ${valueId} already in cache: ${valueCache.get(valueId)?.name}`);
            }
          }
        }
      } else {
        console.log(`D3CardBoard: Card ${card.card_id} has no valid values property:`, card.values);
      }
      
      // Load Capabilities with improved Gun.js reference handling
      if (card.capabilities && typeof card.capabilities === 'object') {
        // Filter out metadata key and handle the special Gun.js reference key properly
        const capIds = Object.keys(card.capabilities)
          .filter(id => id !== '_')
          .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
        
        console.log(`D3CardBoard: Card has ${capIds.length} capabilities to load`);
        
        // Handle Gun.js references properly
        if (capIds.length === 1 && capIds[0] === '#') {
          // Handle reference case
          const reference = card.capabilities['#'];
          if (typeof reference === 'string' && reference.includes('/capabilities/')) {
            console.log(`D3CardBoard: Processing capabilities reference: ${reference}`);
            
            await new Promise<void>((resolve) => {
              try {
                // Use a Set to track processed keys and avoid duplicates
                const processedKeys = new Set<string>();
                
                // Direct query to the capabilities soul reference
                gun.get(reference).map().once((val, key) => {
                  if (key === '_' || processedKeys.has(key)) return; // Skip metadata and duplicates
                  
                  processedKeys.add(key);
                  
                  gun.get(nodes.capabilities).get(key).once((capData: Capability) => {
                    if (capData && capData.capability_id) {
                      console.log(`D3CardBoard: Loaded capability ${key}: ${capData.name}`);
                      capabilityCache.set(key, capData);
                    } else {
                      console.warn(`D3CardBoard: Capability ${key} data not found`, capData);
                    }
                  });
                });
                
                setTimeout(resolve, 500);
              } catch (error) {
                console.error(`D3CardBoard: Error processing capabilities reference:`, error);
                resolve();
              }
            });
          }
        } else {
          // Regular capabilities case (direct ids)
          for (const capId of capIds) {
            if (!capId || capId === '_' || capId === '#') continue; // Skip metadata and reference keys
            
            if (!capabilityCache.has(capId)) {
              console.log(`D3CardBoard: Loading capability ${capId}`);
              await new Promise<void>((resolve) => {
                try {
                  gun.get(nodes.capabilities).get(capId).once((capData: Capability) => {
                    if (capData && capData.capability_id) {
                      console.log(`D3CardBoard: Loaded capability ${capId}: ${capData.name}`);
                      capabilityCache.set(capId, capData);
                    } else {
                      console.warn(`D3CardBoard: Capability ${capId} data not found or incomplete`);
                    }
                    resolve();
                  });
                  
                  // Add a timeout to ensure we don't get stuck if Gun.js doesn't respond
                  setTimeout(resolve, 500);
                } catch (error) {
                  console.error(`D3CardBoard: Error loading capability ${capId}:`, error);
                  resolve();
                }
              });
            } else {
              console.log(`D3CardBoard: Capability ${capId} already in cache: ${capabilityCache.get(capId)?.name}`);
            }
          }
        }
      } else {
        console.log(`D3CardBoard: Card ${card.card_id} has no valid capabilities property:`, card.capabilities);
      }
      
      console.log(`D3CardBoard: Finished loading details for card ${card.card_id}`);
    } catch (error) {
      console.error("D3CardBoard: Unexpected error in loadCardDetails:", error);
    }
  }

  function setupRealTimeListeners() {
    const gun = getGun();
    if (!gun) return;
    
    // Listen for changes to cards
    cardUnsubscribe = () => {
      console.log("D3CardBoard: Set up card listener cleanup");
    };
    
    // Listen for changes to agreements
    agreementUnsubscribe = () => {
      console.log("D3CardBoard: Set up agreement listener cleanup");
    };
    
    // Listen for changes to actors
    actorUnsubscribe = () => {
      console.log("D3CardBoard: Set up actor listener cleanup");
    };
    
    console.log("D3CardBoard: Real-time listeners initialized");
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

  // Function to initialize D3 visualization
  function initializeGraph() {
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
    
    // Prepare nodes and links data
    let nodes: D3Node[] = [
      ...cardsWithPosition.map((card) => ({
        id: card.card_id,
        name: card.role_title || "Unnamed Card",
        type: "card" as const,
        data: card,
        x: card.position?.x || Math.random() * width,
        y: card.position?.y || Math.random() * height,
        fx: card.position?.x || null,
        fy: card.position?.y || null,
        active: card.card_id === activeCardId,
      })),
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
      agreement.obligations.forEach((obligation) => {
        const actorId = obligation.fromActorId;
        const cardId = actorCardMap.get(actorId);
        
        if (cardId) {
          links.push({
            source: cardId,
            target: agreement.agreement_id,
            type: "obligation",
            id: obligation.id,
          });
        }
      });

      agreement.benefits.forEach((benefit) => {
        const actorId = benefit.toActorId;
        const cardId = actorCardMap.get(actorId);
        
        if (cardId) {
          links.push({
            source: agreement.agreement_id,
            target: cardId,
            type: "benefit",
            id: benefit.id,
          });
        }
      });
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
    
    // Create an arrow marker definition for the links
    defs.append("marker")
      .attr("id", "arrow-marker")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#E5E5E5") // Light gray for all arrows
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
      .attr("class", "link-line")  // Use CSS class for consistent styling
      .attr("stroke", "#e5e5e5")   // Light gray
      .attr("stroke-width", 1)     // Thinner lines per design reference
      .attr("marker-end", "url(#arrow-marker)"); // Apply the arrow marker

    // Function to update link positions and agreement node positions
    function updateLinks() {
      // First, position bilateral agreement nodes at the midpoint between their cards
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
                // Calculate midpoint
                const midX = (card1.x + card2.x) / 2;
                const midY = (card1.y + card2.y) / 2;
                
                // Update agreement node position
                node.x = midX;
                node.y = midY;
                
                // Update visual position
                d3.select(`#node-${node.id}`)
                  .attr("transform", `translate(${midX},${midY})`);
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
        
        // Calculate radii with 110% factor for padding
        const sourceRadius = sourceType === "card" 
          ? (cardNodeRadius + donutThickness) * 1.1 
          : agreementNodeRadius * 1.1;
        const targetRadius = targetType === "card" 
          ? (cardNodeRadius + donutThickness) * 1.1 
          : agreementNodeRadius * 1.1;
        
        // Calculate the angle between source and target
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const angle = Math.atan2(dy, dx);
        
        // Calculate the start and end points offset by radius * 1.1
        const sourceX = sourceNode.x + Math.cos(angle) * sourceRadius;
        const sourceY = sourceNode.y + Math.sin(angle) * sourceRadius;
        const targetX = targetNode.x - Math.cos(angle) * targetRadius;
        const targetY = targetNode.y - Math.sin(angle) * targetRadius;
        
        // Set the line coordinates
        d3.select(this)
          .attr("x1", sourceX)
          .attr("y1", sourceY)
          .attr("x2", targetX)
          .attr("y2", targetY);
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
            console.log(`Saving node position: ${d.id} at x:${d.x} y:${d.y}`);
            d3.select(`#node-${d.id}`).attr(
              "transform",
              `translate(${d.x},${d.y})`,
            );
            
            // Save position data
            if (d.type === 'card') {
              const card = d.data as CardWithPosition;
              card.position = { x: d.x, y: d.y };
            } else if (d.type === 'agreement') {
              const agreement = d.data as AgreementWithPosition;
              agreement.position = { x: d.x, y: d.y };
            }
          }),
      )
      .on("click", (event, d) => {
        // Update active state in the UI
        nodes.forEach((node) => (node.active = false)); // Reset all
        d.active = true; // Set current as active

        // Update node classes to show active state
        nodeElements.attr(
          "class",
          (node) => `node node-${node.type}${node.active ? " active" : ""}`,
        );

        // Set active card
        if (d.type === 'card') {
          activeCardId = d.id;
          
          // Find the actor with this card
          const actor = actors.find(a => a.card_id === d.id);
          if (actor) {
            gameStore.setActiveActorId(actor.actor_id);
          }
        }
      })
      .on("mouseover", (event, d) => {
        // On hover, set the hovered node but don't use the separate radial menu
        // The donut rings handle everything with their own mouse events
        if (d.type === 'card') {
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
    const cardNodes = nodeElements.filter((d) => d.type === "card");

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
        .attr("class", `center-circle card-center-circle${d.active ? " active" : ""}`);
    });

    // Now add center icon group based on card.icon
    const centralIconGroup = nodeElements
      .append("g")
      .attr("class", "central-icon-group")
      .attr("pointer-events", "none"); // Make icon group non-interactive

    // Add icon based on card.icon (if available)
    cardNodes.each(function(d) {
      const card = d.data as Card;
      const nodeGroup = d3.select(this);
      const iconSize = 24; // Size of the icon
      
      // Debug log for icon values
      console.log(`Card icon debug - title: ${card.role_title}, icon value: ${card.icon}`);
      
      // Get icon SVG path based on card.icon (prioritize) or card.type
      let iconPath = "";
      
      // Comprehensive mapping of icon names to SVG paths
      const iconPaths = {
        // Default/type-based icons
        "investor": "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09v.58c0 .73-.6 1.33-1.33 1.33h-.01c-.73 0-1.33-.6-1.33-1.33v-.6c-1.33-.28-2.51-1.01-3.01-2.24-.23-.55.2-1.16.8-1.16h.24c.37 0 .67.25.81.6.29.75 1.05 1.27 2.51 1.27 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21v-.6c0-.73.6-1.33 1.33-1.33h.01c.73 0 1.33.6 1.33 1.33v.62c1.38.34 2.25 1.2 2.63 2.26.2.55-.22 1.13-.81 1.13h-.26c-.37 0-.67-.26-.77-.62-.23-.76-.86-1.25-2.12-1.25-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.02 1.83-1.39 2.83-3.13 3.16z",
        "funder": "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
        "steward": "M8.65 3.35 5.86 6.14c-.32.31-.1.85.35.85H8V13c0 1.1.9 2 2 2h2c.55 0 1-.45 1-1s-.45-1-1-1h-2V7h1.79c.45 0 .67-.54.35-.85L9.35 3.35c-.19-.19-.51-.19-.7 0zM16 7h-1.79c-.45 0-.67.54-.35.85l2.79 2.79c.2.2.51.2.71 0l2.79-2.79c.32-.31.09-.85-.35-.85H18v-4h-2c-.55 0-1 .45-1 1s.45 1 1 1h1v4zm-4 12c-.55 0-1 .45-1 1s.45 1 1 1h4c1.1 0 2-.9 2-2v-7h-1.79c-.45 0-.67-.54-.35-.85l2.79-2.79c.2-.2.51-.2.71 0l2.79 2.79c.32.31.1.85-.35.85H20v7c0 2.21-1.79 4-4 4h-4c-1.1 0-2-.9-2-2s.9-2 2-2h4c.55 0 1 .45 1 1s-.45 1-1 1h-4z",
        "default": "M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5zM22 7h-2v1.5h2v-1.5zm0 3h-2v1.5h2v-1.5zm-3-3h-1.5V7H18V5h-1.5v3H18v1.5h1.5V7zm0 3h-1.5v1.5H18V13h1.5v-1.5h-1.5V10zm-18 1.5v2h10v-2H1z",
        
        // Named icons for cards
        "coins": "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09v.58c0 .73-.6 1.33-1.33 1.33h-.01c-.73 0-1.33-.6-1.33-1.33v-.6c-1.33-.28-2.51-1.01-3.01-2.24-.23-.55.2-1.16.8-1.16h.24c.37 0 .67.25.81.6.29.75 1.05 1.27 2.51 1.27 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21v-.6c0-.73.6-1.33 1.33-1.33h.01c.73 0 1.33.6 1.33 1.33v.62c1.38.34 2.25 1.2 2.63 2.26.2.55-.22 1.13-.81 1.13h-.26c-.37 0-.67-.26-.77-.62-.23-.76-.86-1.25-2.12-1.25-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.02 1.83-1.39 2.83-3.13 3.16z",
        "money": "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09v.58c0 .73-.6 1.33-1.33 1.33h-.01c-.73 0-1.33-.6-1.33-1.33v-.6c-1.33-.28-2.51-1.01-3.01-2.24-.23-.55.2-1.16.8-1.16h.24c.37 0 .67.25.81.6.29.75 1.05 1.27 2.51 1.27 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21v-.6c0-.73.6-1.33 1.33-1.33h.01c.73 0 1.33.6 1.33 1.33v.62c1.38.34 2.25 1.2 2.63 2.26.2.55-.22 1.13-.81 1.13h-.26c-.37 0-.67-.26-.77-.62-.23-.76-.86-1.25-2.12-1.25-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.02 1.83-1.39 2.83-3.13 3.16z",
        "leaf": "M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32C8.32 19.97 9.15 20 10 20c3.93 0 7.5-1.6 10.11-4.17.37-.32.74-.65 1.09-.99C18.67 12.3 15.6 10 12 10c-1.36 0-2.64.28-3.81.76.19.41.3.83.43 1.24 1.03-.3 2.2-.54 3.38-.54 2.97 0 5.61 1.5 7.22 3.78-1.52 1.2-3.32 2.13-5.28 2.67 1.56-.67 2.92-1.69 4.07-2.96C15.91 13.73 14 13 12 13c-1.2 0-2.33.22-3.39.59.67.74 1.24 1.56 1.65 2.41.53-.27 1.11-.45 1.74-.45 1.84 0 3.36 1.35 3.67 3.12.11-.35.2-.71.29-1.07-1.17.05-2.38.89-2.62 2.1-.24-.71-.38-1.45-.44-2.19-.98-.93-1.62-2.07-1.89-3.37-.63.7-1.11 1.5-1.5 2.34.09 1.6.42 3.12.95 4.53-1.41-.97-2.4-2.43-2.79-4.09T6 14.12c1.04-1.83 2.74-3.21 4.8-3.84-1.64.51-3.13 1.38-4.36 2.55 1.38-3.8 4.89-6.55 9.1-6.81C13.95 3.4 11.03 1.77 8 1.77c-1.41 0-2.73.37-3.87 1.01l.92.92L3.71 5.03 2.29 3.62 3 2.91C4.53 1.7 6.47 1 8.5 1c4.35 0 8.06 2.63 9.68 6.4.5.12.97.26 1.43.42.72.25 1.41.54 2.06.88C19.83 5.27 16.63 2.9 12.82 2.18 16.33 3.1 19.14 5.67 20 8.99c.75.48 1.42 1.04 2 1.68V4c-3.33 0-6.55 1.09-9.19 3.05C10.77 5.63 8.07 5.07 5.36 6L5 6.1v.9c0 .38.04.75.11 1.12l.93-.07z",
        "seedling": "M22 3.51V2L4 3.99V12H2c0 3.69 2.47 6.86 6 8.25V22h8v-1.75c3.53-1.39 6-4.56 6-8.25H10.5V8.5h11.5V3.5L22 3.51zM8 19.5C5.24 19.5 3 17.26 3 14.5h5v5zm8 0h-5v-5h5v5zm-6.5-11v-1l10.5-.85V7.5H9.5z",
        "users": "M12 12.75c1.63 0 3.07.39 4.24.9.1.04.21.03.31-.02.4-.2.72-.59.72-1.06 0-.47-.32-.87-.72-1.06-.1-.05-.21-.06-.31-.02-1.17.51-2.61.9-4.24.9-1.63 0-3.07-.39-4.24-.9-.1-.04-.21-.03-.31.02-.4.2-.72.59-.72 1.06 0 .47.32.87.72 1.06.1.05.21.06.31.02 1.17-.51 2.61-.9 4.24-.9zm0 1.5c-1.5 0-3.29.4-5 1.5v-10c1.71 1.1 3.5 1.5 5 1.5s3.29-.4 5-1.5v10c-1.71-1.1-3.5-1.5-5-1.5zm0-12c-2.19 0-4 1.79-4 4s1.81 4 4 4 4-1.79 4-4-1.81-4-4-4zM9 7c.83 0 1.5-.67 1.5-1.5S9.83 4 9 4s-1.5.67-1.5 1.5S8.17 7 9 7zm6 0c.83 0 1.5-.67 1.5-1.5S15.83 4 15 4s-1.5.67-1.5 1.5S14.17 7 15 7z",
        "sun": "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
        // Lock icon
        "lock": "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z",
        // Link icon
        "link": "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
      };
      
      // First check if we have a direct icon match in our mapping
      if (card.icon && iconPaths[card.icon.toLowerCase()]) {
        iconPath = iconPaths[card.icon.toLowerCase()];
        console.log(`Using icon path for "${card.icon}"`);
      } 
      // If not found, fallback to type-based icon
      else if (card.type && iconPaths[card.type.toLowerCase()]) {
        iconPath = iconPaths[card.type.toLowerCase()];
        console.log(`Falling back to type icon for "${card.type}"`);
      }
      // If neither is found, use default
      else {
        iconPath = iconPaths["default"];
        console.log(`Using default icon for ${card.role_title}`);
      }
      
      // Add the icon using SVG path
      nodeGroup.append("path")
        .attr("class", "center-icon")
        .attr("d", iconPath)
        .attr("transform", `translate(-${iconSize/2}, -${iconSize/2}) scale(${iconSize/24})`) // Center and scale
        .attr("fill", "#555555")
        .attr("opacity", 0.7);
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
        .attr("fill", "#333333")
        .attr("fill-opacity", 0.7) // Semi-transparent dark background
        .attr("stroke", "none"); // No stroke for cleaner look
      
      // Add the text on top of the background
      group.append("text")
        .attr("class", "name-text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle") // Better centering
        .attr("y", labelYPosition + (rectHeight / 2)) // Center text vertically in background
        .attr("font-size", "11px") 
        .attr("font-weight", "500")
        .attr("fill", "white") // White text on dark background for better contrast
        .text(labelText);
    });

    // Create agreement nodes with smaller circles
    const agreementNodes = nodeElements.filter((d) => d.type === "agreement");
    
    // Generate random IDs for our agreements (e.g., AG1, AG2)
    let agreementCounter = 1;
    
    agreementNodes.each(function(d) {
      // Add a small circle for agreement nodes
      d3.select(this)
        .append("circle")
        .attr("r", 17) // Smaller radius for agreement nodes
        .attr("fill", "#FFFFFF") // White fill
        .attr("stroke", "#E5E5E5") // Light gray stroke
        .attr("stroke-width", 1)
        .attr("class", "agreement-circle");
        
      // Create an agreement ID (AG1, AG2, etc.)
      const agreementId = `AG${agreementCounter++}`;
        
      // Add a title text label
      d3.select(this)
        .append("text")
        .attr("class", "agreement-title")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em") // Center vertically
        .attr("font-size", "12px") // Slightly larger
        .attr("font-weight", "bold") // Make bold for better visibility
        .attr("fill", "#555555") // Darker for contrast
        .text(agreementId);
        
      // Add agreement title below on hover (handled by CSS)
      d3.select(this)
        .append("title")
        .text((d) => {
          const agreement = d.data as Agreement;
          return agreement.title || "Untitled Agreement";
        });
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

  // Complete remake of donut rings to EXACTLY match React implementation
  function addDonutRings() {
    // ----- EXACTLY MATCH REACT APPROACH -----
    
    // Get all card nodes
    const cardNodes = nodeElements.filter((d) => d.type === "card");
    
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
      
      // Create central text elements
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
      
      // Process card data for visualization
      const cardDataForViz = { ...(card as any) };
      
      // Console logs for debug
      console.log(`Card ${card.card_id} raw data:`, JSON.stringify(cardDataForViz).substring(0, 200) + "...");
      
      // Add test data if needed
      if (!cardDataForViz.values || Object.keys(cardDataForViz.values).filter(k => k !== '_' && k !== '#').length === 0) {
        console.log(`Creating dummy values for card ${card.card_id}`);
        cardDataForViz.values = { value1: true, value2: true, value3: true };
      }
      
      if (!cardDataForViz.capabilities || Object.keys(cardDataForViz.capabilities).filter(k => k !== '_' && k !== '#').length === 0) {
        console.log(`Creating dummy capabilities for card ${card.card_id}`);
        cardDataForViz.capabilities = { capability1: true, capability2: true };
      }
      
      // Map legacy field names 
      if (!cardDataForViz.resources && card.rivalrous_resources) {
        console.log(`Moving rivalrous_resources to resources for card ${card.card_id}`);
        cardDataForViz.resources = card.rivalrous_resources;
      }
      
      if (!cardDataForViz.intellectualProperty && card.intellectual_property) {
        console.log(`Moving intellectual_property to intellectualProperty for card ${card.card_id}`);
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
    console.log(`Searching for: ${searchTerm}`);
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
  /* Main container */
  .game-board-container {
    height: 100%;
    position: relative;
    overflow: hidden;
  }
  
  /* Control panel styling */
  .controls {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    gap: 0.5rem;
    background-color: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(4px);
    border-radius: 0.5rem;
    padding: 0.5rem;
    z-index: 10;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  }
  
  .control-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.25rem;
    background-color: rgba(255, 255, 255, 0.9);
    border: 1px solid #e5e5e5;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .control-button:hover {
    background-color: #f3f4f6;
  }
  
  /* Search container styling */
  .search-container {
    position: absolute;
    top: 1rem;
    left: 1rem;
    display: flex;
    background-color: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(4px);
    border-radius: 0.5rem;
    padding: 0.5rem;
    z-index: 10;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  }
  
  .search-input {
    border: 1px solid #e5e5e5;
    border-radius: 0.25rem;
    padding: 0.5rem;
    width: 12rem;
    font-size: 0.875rem;
  }
  
  .search-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.25rem;
    background-color: rgba(255, 255, 255, 0.9);
    border: 1px solid #e5e5e5;
    cursor: pointer;
    margin-left: 0.5rem;
  }
  
  /* D3 Node Styling */
  .node {
    cursor: pointer;
  }
  
  /* Card nodes */
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
  
  .node-card .card-name-container {
    pointer-events: none;
  }
  
  /* Agreement nodes */
  .node-agreement .agreement-circle {
    fill: white;
    stroke: #e5e5e5;
    stroke-width: 1;
    filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.08));
  }
  
  .node-agreement.active .agreement-circle {
    stroke: #4299e1;
    stroke-width: 2;
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
  
  /* Connection links */
  .link-line {
    stroke: #e5e5e5;
    stroke-width: 1.5;
    opacity: 0.8;
  }
  
  /* Text styling */
  .count-text, .options-text {
    pointer-events: none;
    user-select: none;
  }
  
  .card-title, .card-type, .name-text {
    pointer-events: none;
    user-select: none;
  }
  
  /* Legacy radial menu styling */
  .radial-item {
    pointer-events: none;
    transition: opacity 0.3s;
  }
  
  .radial-item-text {
    font-size: 10px;
    font-weight: 500;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  
  .radial-item-bg {
    fill: #ffffff;
    stroke-width: 1;
    filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.1));
  }
  
  /* Label styling for the sub-wedge items */
  .category-labels text {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 11px;
    pointer-events: none;
    user-select: none;
  }
</style>

<div class="game-board-container">
  <!-- D3 SVG container -->
  <svg bind:this={svgRef} width="100%" height="100%">
    <!-- D3 visualization will be rendered here -->
    
    <!-- All visualization elements are now created directly with D3 -->
  </svg>
  
  <!-- Controls will be connected to page header -->
  <!-- Removed redundant search and zoom controls that will be handled by GamePageLayout header -->
</div>