<script lang="ts">
  import * as d3 from 'd3';
  import * as icons from '@lucide/svelte';
  import { currentGameStore } from '$lib/stores/gameStore';
  import { 
    getGameActors, 
    getAvailableAgreementsForGame
  } from '$lib/services/gameService';
  import { buildShardedPath, nodes, putSigned } from '$lib/services/gunService';
  import type { Game, Actor, Agreement } from '$lib/types';
  import AgreementModalIntegrated from './AgreementModalIntegrated.svelte';
  import NodeDetailsPanelIntegrated from './NodeDetailsPanelIntegrated.svelte';
  
  // Define ActorWithPosition and AgreementWithPosition types locally
  interface Position {
    x: number;
    y: number;
  }

  interface ActorWithPosition extends Actor {
    position?: Position;
  }

  interface AgreementWithPosition extends Agreement {
    position?: Position;
  }

  // Use Svelte 5 Runes for props
  const { gameId, activeActorId = undefined } = $props<{ 
    gameId: string;
    activeActorId?: string | null;
  }>();
  
  // Local variables with Svelte 5 Runes
  let svgRef = $state<SVGSVGElement | null>(null); 
  let searchTerm = $state('');
  let width = $state(800);
  let height = $state(600);
  let hoveredNode = $state<string | null>(null);
  let hoveredCategory = $state<string | null>(null);
  let subItems = $state<any[]>([]);
  let categoryCount = $state(0);
  let isDetailsOpen = $state(false);
  let showAgreementModal = $state(false);

  // Local state for actors and agreements
  let actors = $state<ActorWithPosition[]>([]);
  let agreements = $state<AgreementWithPosition[]>([]);
  let selectedNodeId = $state<string | null>(null);
  let selectedNodeType = $state<'actor' | 'agreement' | null>(null);
  
  // Local state for tracking if data is loaded
  let isLoading = $state(true);
  let loadError = $state('');

  // Effect to load data when the component mounts or gameId changes
  $effect(async () => {
    if (!gameId) return;
    
    isLoading = true;
    loadError = '';
    
    try {
      // Get actors and agreements from gameService
      const gameActors = await getGameActors(gameId);
      const gameAgreements = await getAvailableAgreementsForGame(gameId);
      
      // Update local state
      actors = gameActors.map(actor => ({
        ...actor,
        position: actor.position || undefined
      }));
      
      agreements = gameAgreements.map(agreement => ({
        ...agreement,
        position: agreement.position || undefined
      }));
      
      if (actors.length === 0 && agreements.length === 0) {
        console.log('No actors or agreements found for game:', gameId);
      } else {
        console.log(`Loaded ${actors.length} actors and ${agreements.length} agreements`);
      }
      
      // If we have the SVG element, initialize the graph
      if (svgRef) {
        initializeGraph();
      }
    } catch (err) {
      console.error('Error loading game graph:', err);
      loadError = 'Failed to load game data';
    } finally {
      isLoading = false;
    }
  });

  interface D3Node {
    id: string;
    name: string;
    type: "actor" | "agreement";
    data: ActorWithPosition | AgreementWithPosition;
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

  /**
   * Custom implementation of updateNodePosition to save node positions to Gun.js
   * This replaces the missing function from gameService.ts
   * 
   * @param gameId - Game ID
   * @param nodeId - Node ID (actor_id or agreement_id)
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  async function updateNodePosition(gameId: string, nodeId: string, x: number, y: number): Promise<void> {
    try {
      // Create the node position data
      const nodePosition = {
        node_id: nodeId,
        game_ref: gameId,
        type: nodeId.startsWith('a_') ? 'actor' : 'agreement',
        x: x,
        y: y,
        updated_at: Date.now()
      };
      
      // Build the sharded path for this node position
      const path = buildShardedPath(nodes.node_positions, gameId, nodeId);
      
      // Write the position data using putSigned from gunService
      await putSigned(path, nodePosition);
      
      console.log(`Node position updated: ${nodeId} at (${x}, ${y}) in game ${gameId}`);
    } catch (err) {
      console.error('Error updating node position:', err);
    }
  }
  
  // Function to initialize D3 visualization
  const initializeGraph = () => {
    if (!svgRef) return;
    
    // Set up dimensions based on container size
    const boundingRect = svgRef.parentElement?.getBoundingClientRect();
    if (boundingRect) {
      width = boundingRect.width;
      height = boundingRect.height;
    }
    
    // Prepare nodes and links data
    let nodes: D3Node[] = [
      ...actors.map((actor) => ({
        id: actor.actor_id,
        name: actor.role_title,
        type: "actor" as const,
        data: actor,
        x: actor.position?.x || Math.random() * width,
        y: actor.position?.y || Math.random() * height,
        fx: actor.position?.x || null,
        fy: actor.position?.y || null,
        active: actor.actor_id === activeActorId,
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
        links.push({
          source: obligation.fromActorId,
          target: agreement.agreement_id,
          type: "obligation",
          id: obligation.id,
        });
      });

      agreement.benefits.forEach((benefit) => {
        links.push({
          source: agreement.agreement_id,
          target: benefit.toActorId,
          type: "benefit",
          id: benefit.id,
        });
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
      .attr("stroke-width", 1);    // Thinner lines per design reference

    // Function to update link positions and agreement node positions
    function updateLinks() {
      // First, position bilateral agreement nodes at the midpoint between their actors
      nodes.forEach(node => {
        if (node.type === 'agreement') {
          const agreement = node.data as AgreementWithPosition;
          // Only for bilateral agreements
          if (agreement.parties.length === 2) {
            const [party1Id, party2Id] = agreement.parties;
            const party1 = nodes.find(n => n.id === party1Id);
            const party2 = nodes.find(n => n.id === party2Id);
            
            if (party1 && party2) {
              // Calculate midpoint
              const midX = (party1.x + party2.x) / 2;
              const midY = (party1.y + party2.y) / 2;
              
              // Update agreement node position
              node.x = midX;
              node.y = midY;
              
              // Update visual position
              d3.select(`#node-${node.id}`)
                .attr("transform", `translate(${midX},${midY})`);
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
        
        // Get node radii from CSS vars (this is safe to do here as they're already loaded)
        const root = document.documentElement;
        const actorNodeRadius = parseInt(
          getComputedStyle(root).getPropertyValue("--actor-node-radius").trim() || "35"
        );
        const agreementNodeRadius = parseInt(
          getComputedStyle(root).getPropertyValue("--agreement-node-radius").trim() || "17"
        );
        const donutThickness = parseInt(
          getComputedStyle(root).getPropertyValue("--donut-thickness").trim() || "15"
        );
        
        // Calculate radii with 110% factor for padding
        const sourceRadius = sourceType === "actor" 
          ? (actorNodeRadius + donutThickness) * 1.1 
          : agreementNodeRadius * 1.1;
        const targetRadius = targetType === "actor" 
          ? (actorNodeRadius + donutThickness) * 1.1 
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
            // When drag ends, save the final position to Gun DB and update the position in our data
            console.log(`Saving node position: ${d.id} at x:${d.x} y:${d.y}`);
            d3.select(`#node-${d.id}`).attr(
              "transform",
              `translate(${d.x},${d.y})`,
            );
            // Use gameService to update the node position
            updateNodePosition(gameId, d.id, d.x, d.y);
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

        // Handle node selection internally rather than using gameStore
        const nodeType = d.type;
        selectedNodeId = d.id;
        selectedNodeType = nodeType;
        
        // If it's an actor, we could notify parent through an event or custom store
        if (nodeType === 'actor' && d.id !== activeActorId) {
          console.log(`Selected actor: ${d.id}`);
          // Here we would normally dispatch an event up to the parent
        }
        
        // Show details panel
        isDetailsOpen = true;
      });

    // Initialize link positions
    updateLinks();

    // Add center circles with gradients and add text on top
    const actorNodes = nodeElements.filter((d) => d.type === "actor");

    // Define gradient for center button
    actorNodes.each(function (d) {
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

      // Add the center circle with styling from CSS variables
      const rootElement = document.documentElement;
      const baseNodeRadius = parseInt(
        getComputedStyle(rootElement)
          .getPropertyValue("--actor-node-radius")
          .trim() || "35",
      );
      
      // If this is the active actor, scale the node radius by 1.5x
      const isActive = d.id === activeActorId;
      const nodeRadius = isActive ? baseNodeRadius * 1.5 : baseNodeRadius;

      d3.select(this)
        .append("circle")
        .attr("r", nodeRadius)
        .attr("fill", `url(#${gradientId})`)
        .attr("stroke", "#e5e5e5") // Light gray stroke
        .attr("stroke-width", 1)
        .attr("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.08))") // Subtle shadow
        .attr("class", `center-circle actor-center-circle${isActive ? " active" : ""}`);
    });

    // Add name text on top of nodes
    actorNodes.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .attr("font-size", "12px")
      .attr("fill", "#444444")
      .text(d => {
        const actor = d.data as ActorWithPosition;
        return actor.role_title;
      });

    // Add agreement nodes visualization
    const agreementNodes = nodeElements.filter((d) => d.type === "agreement");
    
    agreementNodes.each(function(d) {
      const agreement = d.data as AgreementWithPosition;
      
      // Add a smaller circle for agreement nodes
      d3.select(this)
        .append("circle")
        .attr("r", 17) // Smaller radius for agreement nodes
        .attr("fill", "#F0F9FF") // Light blue background
        .attr("stroke", "#93C5FD") // Blue border
        .attr("stroke-width", 2)
        .attr("class", "agreement-circle");
        
      // Add a text label within the agreement node
      d3.select(this)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .attr("font-size", "9px")
        .attr("fill", "#3B82F6") // Blue text
        .text("Agreement");
        
      // Add title text below the agreement node
      d3.select(this)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "30px") // Position below the node
        .attr("font-size", "10px")
        .attr("fill", "#1F2937") // Dark text
        .text(agreement.title);
    });
  };

  // Use $effect to run setup code once component is mounted (replaces onMount)
  $effect(() => {
    // Add CSS variables for node sizing to root
    document.documentElement.style.setProperty('--actor-node-radius', '35px');
    document.documentElement.style.setProperty('--agreement-node-radius', '17px');
    document.documentElement.style.setProperty('--donut-thickness', '15px');
    
    // Initialize the game board is handled in the $effect at the top
    
    // Log the active actor ID if provided for debugging
    if (activeActorId) {
      console.log(`Active actor in D3GameBoard: ${activeActorId}`);
    }
  });

  // Handle adding a new agreement
  function handleAddAgreement() {
    // Simply show the agreement modal
    showAgreementModal = true;
  }

  // Filter nodes based on search term using $derived
  const filteredActors = $derived(
    searchTerm 
      ? actors.filter(actor => 
          actor.role_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          actor.values.some(v => v.toLowerCase().includes(searchTerm.toLowerCase())) ||
          actor.goals.some(g => g.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : actors
  );

  const filteredAgreements = $derived(
    searchTerm
      ? agreements.filter(agreement =>
          agreement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          agreement.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          agreement.terms.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : agreements
  );
</script>

<div class="game-visualization w-full h-full overflow-hidden bg-surface-50 dark:bg-surface-900 relative rounded-lg flex flex-col">
  <!-- Search and controls toolbar -->
  <div class="flex items-center justify-between p-2 border-b border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
    <div class="relative flex-grow max-w-md">
      <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        {#if icons.Search}
          <icons.Search class="w-4 h-4 text-surface-400" />
        {/if}
      </div>
      <input
        type="text"
        bind:value={searchTerm}
        class="input pl-10 w-full h-9 rounded-lg text-sm"
        placeholder="Search nodes..."
      />
    </div>
    
    <div class="flex space-x-2">
      <button class="btn btn-sm variant-ghost-surface" title="Zoom In">
        {#if icons.ZoomIn}
          <icons.ZoomIn class="w-4 h-4" />
        {/if}
      </button>
      <button class="btn btn-sm variant-ghost-surface" title="Zoom Out">
        {#if icons.ZoomOut}
          <icons.ZoomOut class="w-4 h-4" />
        {/if}
      </button>
      <button class="btn btn-sm variant-ghost-surface" title="Reset Zoom">
        {#if icons.Maximize}
          <icons.Maximize class="w-4 h-4" />
        {/if}
      </button>
      <button 
        class="btn btn-sm variant-filled-primary" 
        title="Add Agreement"
        onclick={handleAddAgreement}
      >
        {#if icons.PlusCircle}
          <icons.PlusCircle class="w-4 h-4 mr-1" />
        {/if}
        <span>Agreement</span>
      </button>
    </div>
  </div>
  
  <!-- Main visualization area with D3 SVG -->
  <div class="visualization-container flex-grow w-full relative">
    <svg 
      bind:this={svgRef} 
      class="w-full h-full"
      style="min-height: 400px"
    >
      <!-- D3 will render here -->
    </svg>
  </div>
  
  <!-- Node details panel (slides in from side when a node is selected) -->
  <NodeDetailsPanelIntegrated bind:isOpen={isDetailsOpen} />
  
  <!-- Agreement modal (comes up when creating/editing an agreement) -->
  {#if showAgreementModal}
    <AgreementModalIntegrated onclose={() => showAgreementModal = false} />
  {/if}
</div>

<style>
  /* D3 Visualization Styles */
  :global(:root) {
    --actor-node-radius: 35px;
    --agreement-node-radius: 17px;
    --donut-thickness: 15px;
  }
  
  :global(.link-line) {
    stroke: #e5e5e5;
    marker-end: url(#arrow-marker);
  }
  
  :global(.node) {
    cursor: pointer;
  }
  
  :global(.node-actor.active .center-circle) {
    filter: drop-shadow(0px 2px 4px rgba(49, 120, 198, 0.25));
    stroke: #3B82F6;
    stroke-width: 2px;
  }
  
  :global(.node-agreement:hover .agreement-circle) {
    stroke: #2563EB;
    filter: drop-shadow(0px 2px 4px rgba(37, 99, 235, 0.2));
  }
</style>