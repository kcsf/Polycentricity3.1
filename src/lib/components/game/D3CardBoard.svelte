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
  let subItems: SubItem[] = [];
  let categoryCount = 0;
  
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
        cards.forEach(card => {
          const cardWithPosition: CardWithPosition = {
            ...card,
            position: {
              x: Math.random() * width,
              y: Math.random() * height
            }
          };
          cardsWithPosition = [...cardsWithPosition, cardWithPosition];
          
          // Load card details (values and capabilities)
          loadCardDetails(card);
        });
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
    const gun = getGun();
    if (!gun || !card.card_id) {
      console.error("D3CardBoard: Gun not initialized or card has no ID");
      return;
    }
    
    console.log(`D3CardBoard: Loading details for card ${card.card_id} (${card.role_title})`);
    
    // Load Values
    if (card.values) {
      const valueIds = Object.keys(card.values);
      console.log(`D3CardBoard: Card has ${valueIds.length} values to load`);
      
      for (const valueId of valueIds) {
        if (!valueCache.has(valueId)) {
          console.log(`D3CardBoard: Loading value ${valueId}`);
          await new Promise<void>(resolve => {
            gun.get(nodes.values).get(valueId).once((valueData: Value) => {
              if (valueData && valueData.value_id) {
                console.log(`D3CardBoard: Loaded value ${valueId}: ${valueData.name}`);
                valueCache.set(valueId, valueData);
              } else {
                console.warn(`D3CardBoard: Value ${valueId} data not found or incomplete`);
              }
              resolve();
            });
          });
        } else {
          console.log(`D3CardBoard: Value ${valueId} already in cache: ${valueCache.get(valueId)?.name}`);
        }
      }
    } else {
      console.log(`D3CardBoard: Card ${card.card_id} has no values property`);
    }
    
    // Load Capabilities
    if (card.capabilities) {
      const capIds = Object.keys(card.capabilities);
      console.log(`D3CardBoard: Card has ${capIds.length} capabilities to load`);
      
      for (const capId of capIds) {
        if (!capabilityCache.has(capId)) {
          console.log(`D3CardBoard: Loading capability ${capId}`);
          await new Promise<void>(resolve => {
            gun.get(nodes.capabilities).get(capId).once((capData: Capability) => {
              if (capData && capData.capability_id) {
                console.log(`D3CardBoard: Loaded capability ${capId}: ${capData.name}`);
                capabilityCache.set(capId, capData);
              } else {
                console.warn(`D3CardBoard: Capability ${capId} data not found or incomplete`);
              }
              resolve();
            });
          });
        } else {
          console.log(`D3CardBoard: Capability ${capId} already in cache: ${capabilityCache.get(capId)?.name}`);
        }
      }
    } else {
      console.log(`D3CardBoard: Card ${card.card_id} has no capabilities property`);
    }
    
    console.log(`D3CardBoard: Finished loading details for card ${card.card_id}`);
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

  // Function to initialize D3 visualization
  function initializeGraph() {
    if (!svgRef) return;
    
    // Set up dimensions based on container size
    const boundingRect = svgRef.parentElement?.getBoundingClientRect();
    if (boundingRect) {
      width = boundingRect.width;
      height = boundingRect.height;
    }
    
    // Prepare nodes and links data
    let nodes: D3Node[] = [
      ...cardsWithPosition.map((card) => ({
        id: card.card_id,
        name: card.role_title,
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
        name: agreement.title,
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

    // Create a unified arrow marker for the links
    defs
      .append("marker")
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
      .attr("stroke", "#E5E5E5")    // Light gray
      .attr("stroke-width", 1)      // Thinner lines for clean design
      .attr("marker-end", "url(#arrow-marker)"); // Apply the arrow marker

    // Function to update link positions and agreement node positions
    function updateLinks() {
      // First, position bilateral agreement nodes at the midpoint between their cards
      nodes.forEach(node => {
        if (node.type === 'agreement') {
          const agreement = node.data as AgreementWithPosition;
          // For bilateral agreements, position at midpoint
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
        
        // Get node radii
        const cardNodeRadius = 35; // Standard size for card nodes
        const agreementNodeRadius = 17; // Smaller size for agreement nodes
        const donutThickness = 15; // Extra space for radial menus
        
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
    const nodeElements = nodeGroup
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
        // On hover, show the radial menu for cards
        if (d.type === 'card') {
          hoveredNode = d.id;
          updateRadialMenu(d);
        }
      })
      .on("mouseout", (event, d) => {
        // Hide radial menu on mouseout after a slight delay
        hoveredNode = null;
        setTimeout(() => {
          if (!hoveredNode) {
            subItems = [];
          }
        }, 200);
      });

    // Initialize link positions
    updateLinks();

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

    // Now add text group AFTER the circle to make it appear on top
    const centralTextGroup = nodeElements
      .append("g")
      .attr("class", "central-text-group")
      .attr("pointer-events", "none"); // Make text group non-interactive

    // Central text for card information
    centralTextGroup
      .append("text")
      .attr("class", "card-title")
      .attr("text-anchor", "middle")
      .attr("dy", "0em") // Position in the center of the node
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("fill", "#4B5563") // Dark gray
      .text((d) => d.type === "card" ? (d.data as Card).role_title.slice(0, 20) : "");

    centralTextGroup
      .append("text")
      .attr("class", "card-type")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em") // Positioned below the title
      .attr("font-size", "10px")
      .attr("fill", "#6B7280") // Medium gray
      .text((d) => d.type === "card" ? (d.data as Card).type : "");

    // Create name labels outside/below the node for better readability
    const cardNameGroups = cardNodes
      .append("g")
      .attr("class", "card-name-container")
      .attr("pointer-events", "none"); // Make label non-interactive
      
    // Add name text elements that appear below the node
    cardNameGroups
      .append("text")
      .attr("class", "name-text")
      .attr("text-anchor", "middle")
      .attr("dy", "3.5em") // Position below the node
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .attr("fill", "#444444") // Dark gray
      .text((d) => {
        const card = d.data as Card;
        return card.role_title.length > 20 
          ? card.role_title.slice(0, 17) + "..." 
          : card.role_title;
      });

    // Create agreement nodes with smaller circles
    const agreementNodes = nodeElements.filter((d) => d.type === "agreement");
    
    agreementNodes.each(function(d) {
      // Add a small circle for agreement nodes
      d3.select(this)
        .append("circle")
        .attr("r", 17) // Smaller radius for agreement nodes
        .attr("fill", "#FFFFFF") // White fill
        .attr("stroke", "#E5E5E5") // Light gray stroke
        .attr("stroke-width", 1)
        .attr("class", "agreement-circle");
        
      // Add a title text label
      d3.select(this)
        .append("text")
        .attr("class", "agreement-title")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em") // Center vertically
        .attr("font-size", "9px")
        .attr("fill", "#333333") // Dark gray
        .text((d) => {
          const agreement = d.data as Agreement;
          return agreement.title.length > 12 
            ? agreement.title.slice(0, 10) + "..." 
            : agreement.title;
        });
    });

    // Handle zoom functionality
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on("zoom", (event) => {
        nodeGroup.attr("transform", event.transform);
        linkGroup.attr("transform", event.transform);
      });
    
    svg.call(zoomBehavior);
  }

  function updateRadialMenu(node: D3Node) {
    if (node.type !== 'card') return;
    
    const card = node.data as Card;
    console.log(`D3CardBoard: Updating radial menu for card ${card.card_id}`);
    
    subItems = [];
    
    // Create Value items for the radial menu
    if (card.values) {
      const valueIds = Object.keys(card.values);
      console.log(`D3CardBoard: Card has ${valueIds.length} values`);
      
      if (valueIds.length > 0) {
        for (const valueId of valueIds) {
          if (valueCache.has(valueId)) {
            console.log(`D3CardBoard: Found value ${valueId} in cache: ${valueCache.get(valueId)?.name}`);
          } else {
            console.log(`D3CardBoard: Value ${valueId} not in cache`);
          }
        }
      }
      
      const valueItems: SubItem[] = valueIds.map((valueId, index) => {
        const value = valueCache.get(valueId);
        return {
          id: valueId,
          label: value?.name || 'Loading...',
          angle: (index * (360 / valueIds.length) + 270) % 360, // Start from top
          radius: 60, // Distance from center
          nodeX: node.x,
          nodeY: node.y,
          category: 'Values',
          categoryColor: '#3B82F6', // Blue for values
          index,
          totalItems: valueIds.length
        };
      });
      
      subItems = [...subItems, ...valueItems];
    } else {
      console.log(`D3CardBoard: Card has no values property`);
    }
    
    // Create Capability items for the radial menu
    if (card.capabilities) {
      const capabilityIds = Object.keys(card.capabilities);
      console.log(`D3CardBoard: Card has ${capabilityIds.length} capabilities`);
      
      if (capabilityIds.length > 0) {
        for (const capId of capabilityIds) {
          if (capabilityCache.has(capId)) {
            console.log(`D3CardBoard: Found capability ${capId} in cache: ${capabilityCache.get(capId)?.name}`);
          } else {
            console.log(`D3CardBoard: Capability ${capId} not in cache`);
          }
        }
      }
      
      const capabilityItems: SubItem[] = capabilityIds.map((capabilityId, index) => {
        const capability = capabilityCache.get(capabilityId);
        return {
          id: capabilityId,
          label: capability?.name || 'Loading...',
          angle: (index * (360 / capabilityIds.length) + 90) % 360, // Start from bottom
          radius: 60, // Distance from center
          nodeX: node.x,
          nodeY: node.y,
          category: 'Capabilities',
          categoryColor: '#10B981', // Green for capabilities
          index,
          totalItems: capabilityIds.length
        };
      });
      
      subItems = [...subItems, ...capabilityItems];
    }
  }

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
  .game-board-container {
    height: 100%;
    position: relative;
    overflow: hidden;
  }
  
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
  
  /* Radial menu styling */
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
  
  /* Node styling is applied directly via D3 attributes */
</style>

<div class="game-board-container">
  <!-- D3 SVG container -->
  <svg bind:this={svgRef} width="100%" height="100%">
    <!-- D3 visualization will be rendered here -->
    
    <!-- Radial menu items -->
    {#each subItems as item (item.id)}
      <g class="radial-item" transform={`translate(${item.nodeX}, ${item.nodeY})`}>
        <!-- Calculate position using angle and radius -->
        <circle 
          class="radial-item-bg"
          cx={item.radius * Math.cos(item.angle * Math.PI / 180)} 
          cy={item.radius * Math.sin(item.angle * Math.PI / 180)}
          r="20" 
          stroke={item.categoryColor}
        />
        <text 
          class="radial-item-text"
          x={item.radius * Math.cos(item.angle * Math.PI / 180)} 
          y={item.radius * Math.sin(item.angle * Math.PI / 180)}
          fill="#333333"
        >
          {item.label}
        </text>
      </g>
    {/each}
  </svg>
  
  <!-- Controls -->
  <div class="search-container">
    <input 
      type="text" 
      bind:value={searchTerm} 
      placeholder="Search cards..." 
      class="search-input"
    />
    <button class="search-button" on:click={handleSearch}>
      <Search size={18} />
    </button>
  </div>
  
  <div class="controls">
    <button class="control-button" on:click={handleZoomIn}>
      <ZoomIn size={18} />
    </button>
    <button class="control-button" on:click={handleZoomOut}>
      <ZoomOut size={18} />
    </button>
    <button class="control-button" on:click={handleReset}>
      <Maximize size={18} />
    </button>
  </div>
</div>