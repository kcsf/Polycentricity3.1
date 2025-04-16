<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import { PlusCircle, ZoomIn, ZoomOut, Maximize, Search } from 'lucide-svelte';
  // import { gameStore } from '@/store/gameStore';
  // import type { Actor, Agreement } from '@/store/gameStore';

  // Local variables
  let svgRef: SVGSVGElement;
  let searchTerm = '';
  let width = 800;
  let height = 600;
  let hoveredNode: string | null = null;
  let hoveredCategory: string | null = null;
  let subItems: any[] = [];
  let categoryCount = 0;

  // Subscribe to stores
  let actors: Actor[] = [];
  let agreements: Agreement[] = [];
  let activeActorId: string | null = null;

  const actorsUnsubscribe = gameStore.actors.subscribe(value => {
    actors = value;
  });

  const agreementsUnsubscribe = gameStore.agreements.subscribe(value => {
    agreements = value;
  });

  const activeActorUnsubscribe = gameStore.activeActorId.subscribe(value => {
    activeActorId = value;
  });

  interface D3Node {
    id: string;
    name: string;
    type: "actor" | "agreement";
    data: Actor | Agreement;
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
        id: actor.id,
        name: actor.name,
        type: "actor" as const,
        data: actor,
        x: actor.position?.x || Math.random() * width,
        y: actor.position?.y || Math.random() * height,
        fx: actor.position?.x || null,
        fy: actor.position?.y || null,
        active: actor.id === activeActorId,
      })),
      ...agreements.map((agreement) => ({
        id: agreement.id,
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
          target: agreement.id,
          type: "obligation",
          id: obligation.id,
        });
      });

      agreement.benefits.forEach((benefit) => {
        links.push({
          source: agreement.id,
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
          const agreement = node.data as Agreement;
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
            gameStore.updateNodePosition(d.id, d.x, d.y);
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

        // Call the store select function
        // This will also set activeActorId if it's an actor node
        const nodeType = d.type;
        gameStore.selectNode(d.id, nodeType);
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

    // Now add text group AFTER the circle to make it appear on top
    const centralTextGroup = nodeElements
      .append("g")
      .attr("class", "central-text-group")
      .attr("pointer-events", "none"); // Make text group non-interactive

    // Improve central text for better visibility
    centralTextGroup
      .append("text")
      .attr("class", "count-text")
      .attr("text-anchor", "middle")
      .attr("dy", "0em") // Position in the center of the node
      .attr("font-size", "22px") // Larger size for emphasis
      .attr("font-weight", "bold")
      .attr("fill", "#4B5563") // Dark gray
      .text("");

    centralTextGroup
      .append("text")
      .attr("class", "options-text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.5em") // Positioned directly below the count
      .attr("font-size", "11px") // Slightly larger for better readability
      .attr("fill", "#6B7280") // Medium gray
      .attr("fill-opacity", 0.9)
      .text("");

    // We'll now create a separate name label group for actor nodes
    // that will appear below the node instead of in the center
    
    // First, add centrally aligned text for hover state indicators only
    centralTextGroup
      .append("text")
      .attr("class", "count-text-placeholder")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .attr("font-size", "10px")
      .attr("fill", "transparent") // Make invisible - just a placeholder
      .text("");
    
    // Create actor name labels outside/below the node
    const actorNameGroups = actorNodes
      .append("g")
      .attr("class", "actor-name-container")
      .attr("pointer-events", "none"); // Make label non-interactive
      
    // Add empty name text elements first so we can configure each one individually
    actorNameGroups
      .append("text")
      .attr("class", "name-text")
      .attr("text-anchor", "middle")
      .attr("font-size", "12px") // Initial font size - we'll adjust if needed
      .attr("font-weight", "500") // Medium weight
      .attr("fill", "#444444") // Dark gray
      .text((d) => d.name);

    // For each actor, dynamically position and resize the name
    actorNameGroups.each(function(d) {
      // Get the text element we created
      const textElement = d3.select(this).select(".name-text");
      const textNode = textElement.node() as SVGTextElement;
      
      // Check if this is the active actor and should be scaled
      const isActive = d.id === activeActorId;
      const scaleFactor = isActive ? 1.5 : 1;
      
      // Scale the radius and donut size accordingly
      const actorRadius = baseActorRadius * scaleFactor;
      const donutSize = baseDonutSize * scaleFactor;
      const totalRadius = actorRadius + donutSize;
      
      // Position at 120% of total radius (scaled appropriately)
      const nameYOffset = totalRadius * 1.2;
      
      // Set the Y position for the text based on the dynamic calculation
      textElement.attr("y", nameYOffset);
      
      // Get the text width to size the background
      const textWidth = textNode.getComputedTextLength();
      const padding = 10; // Padding on each side of the text
      
      // Create a rounded rectangle background that's sized to the text
      d3.select(this)
        .insert("rect", "text") // Insert before the text so it appears behind
        .attr("class", "name-bg")
        .attr("x", -textWidth/2 - padding/2)
        .attr("y", nameYOffset - 12) // Position slightly above the text
        .attr("width", textWidth + padding)
        .attr("height", 20) // Fixed height for the background
        .attr("rx", 4) // Rounded corners
        .attr("ry", 4);
    });

    // Add agreement nodes (small circles with ID numbers)
    const agreementNodes = nodeElements.filter((d) => d.type === "agreement");
    
    agreementNodes.each(function(d) {
      // Add a small dark circle for the agreement node
      d3.select(this)
        .append("circle")
        .attr("r", agreementNodeRadius)
        .attr("fill", "#444444") // Dark gray
        .attr("stroke", "#E0E0E0") // Light gray border
        .attr("stroke-width", 1)
        .attr("class", "agreement-circle");
        
      // Add a small ID number in the center
      d3.select(this)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em") // Center vertically
        .attr("font-size", "10px") // Small font
        .attr("fill", "#FFFFFF") // White text
        .attr("pointer-events", "none") // Make text non-interactive
        .text((d) => (d.data as Agreement).parties.length); // Show party count or ID
    });
    
    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        nodeGroup.attr("transform", event.transform);
        linkGroup.attr("transform", event.transform);
      });
    
    // Apply zoom to the SVG
    svg.call(zoom);
    
    // Initially center and zoom the view
    const centerX = width / 2;
    const centerY = height / 2;
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(centerX, centerY).scale(0.8),
    );
  };

  // Handle the creation of new agreement
  function handleNewAgreement() {
    gameStore.toggleAgreementModal();
  }

  // Handle zoom controls
  function handleZoomIn() {
    const zoom = d3.zoom().scaleExtent([0.1, 4]);
    const svg = d3.select(svgRef);
    const currentTransform = d3.zoomTransform(svgRef);
    svg.transition().duration(300).call(
      zoom.transform,
      currentTransform.scale(currentTransform.k * 1.5)
    );
  }

  function handleZoomOut() {
    const zoom = d3.zoom().scaleExtent([0.1, 4]);
    const svg = d3.select(svgRef);
    const currentTransform = d3.zoomTransform(svgRef);
    svg.transition().duration(300).call(
      zoom.transform,
      currentTransform.scale(currentTransform.k / 1.5)
    );
  }

  function handleFitView() {
    const zoom = d3.zoom().scaleExtent([0.1, 4]);
    const svg = d3.select(svgRef);
    const centerX = width / 2;
    const centerY = height / 2;
    svg.transition().duration(500).call(
      zoom.transform,
      d3.zoomIdentity.translate(centerX, centerY).scale(0.8)
    );
  }

  onMount(() => {
    // Initialize the graph after the component is mounted
    initializeGraph();
    
    // Handle window resize
    const handleResize = () => {
      if (svgRef) {
        const boundingRect = svgRef.parentElement?.getBoundingClientRect();
        if (boundingRect) {
          width = boundingRect.width;
          height = boundingRect.height;
          initializeGraph();
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up the event listener when the component is destroyed
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  // Re-render the graph when actors, agreements, or active actor changes
  $: if (actors && agreements && activeActorId !== undefined) {
    if (svgRef) {
      initializeGraph();
    }
  }

  onDestroy(() => {
    // Clean up subscriptions when the component is destroyed
    actorsUnsubscribe();
    agreementsUnsubscribe();
    activeActorUnsubscribe();
  });
</script>

<div class="relative w-full h-full overflow-hidden">
  <svg bind:this={svgRef} class="w-full h-full" />
  
  <!-- Controls overlay -->
  <div class="absolute top-4 left-4 flex flex-col space-y-2">
    <button 
      on:click={handleNewAgreement}
      class="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-gray-100"
      title="New Agreement"
    >
      <PlusCircle class="w-5 h-5 text-gray-700" />
    </button>
  </div>
  
  <div class="absolute bottom-4 right-4 flex flex-col space-y-2">
    <button 
      on:click={handleZoomIn}
      class="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-gray-100"
      title="Zoom In"
    >
      <ZoomIn class="w-4 h-4 text-gray-700" />
    </button>
    <button 
      on:click={handleZoomOut}
      class="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-gray-100"
      title="Zoom Out"
    >
      <ZoomOut class="w-4 h-4 text-gray-700" />
    </button>
    <button 
      on:click={handleFitView}
      class="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-gray-100"
      title="Fit View"
    >
      <Maximize class="w-4 h-4 text-gray-700" />
    </button>
  </div>
  
  <div class="absolute top-4 right-4 max-w-sm">
    <div class="relative">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input 
        type="text" 
        bind:value={searchTerm}
        placeholder="Search agreements and actors..." 
        class="w-full py-2 pl-10 pr-4 border rounded-full shadow-sm focus:ring-primary focus:border-primary text-sm"
      />
    </div>
  </div>
</div>