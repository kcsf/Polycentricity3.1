import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { PlusCircle, Search, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useGameStore from "@/store/gameStore";
import { Actor, Agreement } from "@/store/gameStore";

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

export default function D3GameBoard() {
  const {
    actors,
    agreements,
    selectNode,
    toggleAgreementModal,
    updateNodePosition,
    activeActorId,
  } = useGameStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [nodes, setNodes] = useState<D3Node[]>([]);
  const [links, setLinks] = useState<D3Link[]>([]);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [categoryCount, setCategoryCount] = useState<number>(0);

  useEffect(() => {
    if (svgRef.current) {
      const boundingRect =
        svgRef.current.parentElement?.getBoundingClientRect();
      if (boundingRect) {
        setWidth(boundingRect.width);
        setHeight(boundingRect.height);
      }
    }
  }, []);

  useEffect(() => {
    const centralNodeId = actors[0]?.id;
    const newNodes: D3Node[] = [
      ...actors.map((actor) => ({
        id: actor.id,
        name: actor.name,
        type: "actor" as const,
        data: actor,
        x: actor.position?.x || Math.random() * width,
        y: actor.position?.y || Math.random() * height,
        fx: actor.position?.x || null,
        fy: actor.position?.y || null,
        active: actor.id === activeActorId, // Mark nodes as active based on the activeActorId
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

    setNodes(newNodes);

    const newLinks: D3Link[] = [];
    agreements.forEach((agreement) => {
      agreement.obligations.forEach((obligation) => {
        newLinks.push({
          source: obligation.fromActorId,
          target: agreement.id,
          type: "obligation",
          id: obligation.id,
        });
      });

      agreement.benefits.forEach((benefit) => {
        newLinks.push({
          source: agreement.id,
          target: benefit.toActorId,
          type: "benefit",
          id: benefit.id,
        });
      });
    });

    setLinks(newLinks);
  }, [actors, agreements, width, height, activeActorId]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
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
            updateNodePosition(d.id, d.x, d.y);
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
        selectNode(d.id, nodeType);
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
      
    // Calculate position below the node
    const root = document.documentElement;
    const baseActorRadius = parseInt(
      getComputedStyle(root).getPropertyValue("--actor-node-radius").trim() || "35"
    );
    const baseDonutSize = parseInt(
      getComputedStyle(root).getPropertyValue("--donut-thickness").trim() || "15"
    );
    
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
      
      if (textNode) {
        const name = d.name;
        const maxWidth = 118; // Max width minus 1px padding on each side
        let fontSize = 12; // Start with this size
        const minFontSize = 8; // Don't go smaller than this
        
        // Create a temporary text element to measure the text width
        textElement.attr("font-size", `${fontSize}px`);
        let textWidth = textNode.getComputedTextLength();
        
        // If text is too wide, reduce the font size until it fits
        while (textWidth > maxWidth && fontSize > minFontSize) {
          fontSize--;
          textElement.attr("font-size", `${fontSize}px`);
          textWidth = textNode.getComputedTextLength();
        }
        
        // Calculate height based on font size with a small margin
        const textHeight = fontSize + 6; // Add some padding 
        
        // Create background based on actual text dimensions
        const bgWidth = Math.min(textWidth + 10, maxWidth); // Provide at least 5px padding on each side
        const bgHeight = textHeight;
        
        // Add background rectangle with rounded corners
        d3.select(this)
          .insert("rect", "text") // Insert before text (behind it)
          .attr("class", "name-background")
          .attr("x", -bgWidth/2) // Center horizontally
          .attr("y", nameYOffset - (bgHeight/2)) // Center vertically around the text
          .attr("width", bgWidth)
          .attr("height", bgHeight)
          .attr("rx", bgHeight/2) // Rounded corners (half the height for pill shape)
          .attr("ry", bgHeight/2)
          .attr("fill", "white")
          .attr("fill-opacity", 0.9) // 90% transparent
          .attr("stroke", "#E5E5E5") // Very light gray border
          .attr("stroke-width", 1);
          
        // Adjust text position to be centered in the background
        textElement.attr("dy", "0.35em"); // Vertical alignment within line
      }
    });

    // Add outer donut ring using CSS variables
    const documentRoot = document.documentElement;
    const baseActorNodeRadius = parseInt(
      getComputedStyle(documentRoot)
        .getPropertyValue("--actor-node-radius")
        .trim() || "35",
    );
    const baseDonutThickness = parseInt(
      getComputedStyle(documentRoot)
        .getPropertyValue("--donut-thickness")
        .trim() || "15",
    );
    
    // Add donut rings with proper scaling for active nodes
    actorNodes.each(function(d) {
      // If this is the active actor, scale the node radius by 1.5x
      const isActive = d.id === activeActorId;
      const scaleFactor = isActive ? 1.5 : 1;
      const scaledNodeRadius = baseActorNodeRadius * scaleFactor;
      const donutRadius = scaledNodeRadius + baseDonutThickness * scaleFactor;
      
      d3.select(this)
        .append("circle")
        .attr("r", donutRadius)
        .attr("class", `donut-ring${isActive ? " active" : ""}`)
        .attr("fill", "transparent")
        .attr("stroke", "var(--border)")
        .attr("stroke-width", 1);
    });

    const actorData = actorNodes.data() as D3Node[];
    actorData.forEach((actor) => {
      const categories = [
        "values",
        "goals",
        "capabilities",
        "intellectualProperty",
        "resources",
      ];
      const ensureArray = (field: any): string[] =>
        Array.isArray(field)
          ? field
          : typeof field === "string"
            ? field.split(",").map((item) => item.trim())
            : [];
      const actorDataForViz = { ...(actor.data as Actor) };
      for (const cat of categories) {
        const key = cat as keyof Actor;
        if (typeof actorDataForViz[key] === "string")
          actorDataForViz[key] = ensureArray(actorDataForViz[key]) as any;
      }
      const actorCategories = categories.filter(
        (cat) => ensureArray((actorDataForViz as any)[cat]).length > 0,
      );

      // Create the category-level pie chart
      const categoryPie = d3
        .pie<string>()
        .value(() => 1)
        .sort(null);
      const categoryPieData = categoryPie(actorCategories);

      // Get CSS variables for consistent sizing
      const root = document.documentElement;
      const baseActorRadius = parseInt(
        getComputedStyle(root).getPropertyValue("--actor-node-radius").trim() ||
          "35",
      );
      const baseDonutThickness = parseInt(
        getComputedStyle(root).getPropertyValue("--donut-thickness").trim() ||
          "15",
      );
      
      // Check if this is the active actor and apply scaling
      const isActive = actor.id === activeActorId;
      const scaleFactor = isActive ? 1.5 : 1;
      const actorNodeRadius = baseActorRadius * scaleFactor;
      const donutThickness = baseDonutThickness * scaleFactor;
      
      const donutRadius = actorNodeRadius + donutThickness;
      const expandedRadius = donutRadius + 15 * scaleFactor; // Scale the expansion amount too

      // Define the category-level arcs using CSS variables
      const categoryArc = d3
        .arc<d3.PieArcDatum<string>>()
        .innerRadius(actorNodeRadius)
        .outerRadius(actorNodeRadius + donutThickness)
        .cornerRadius(1)
        .padAngle(0.02);

      // Define expanded arc for hover effect using CSS variables
      const expandedArc = d3
        .arc<d3.PieArcDatum<string>>()
        .innerRadius(actorNodeRadius)
        .outerRadius(expandedRadius)
        .cornerRadius(3)
        .padAngle(0.04);

      // Create a parent group for each wedge and its labels
      const categoryGroup = d3
        .select(`#node-${actor.id}`)
        .selectAll(".category-group")
        .data(categoryPieData)
        .enter()
        .append("g")
        .attr("class", "category-group")
        .attr("data-category", (d) => d.data);

      // Add the wedge path to each group with direct event handlers
      // This avoids any event bubbling issues that may cause flickering
      categoryGroup
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

      // Handle interactions completely independently (no event delegation)
      categoryGroup.each(function (d) {
        const group = d3.select(this);
        const wedge = group.select(".category-wedge");
        const category = d.data;

        // Pre-create the text labels container - but make it non-interactive
        const labelsContainer = group
          .append("g")
          .attr("class", "label-container")
          .style("visibility", "hidden")
          .attr("opacity", 0)
          .attr("pointer-events", "none"); // Disable pointer events on labels

        // Pre-calculate the content and arc data
        const actorNode = nodes.find((node) => node.id === actor.id);
        if (!actorNode || actorNode.type !== "actor") return;

        const content = ensureArray((actorNode.data as any)[category]);

        // Create sub-wedges within the category wedge
        const subItemPie = d3
          .pie<string>()
          .startAngle(d.startAngle)
          .endAngle(d.endAngle)
          .value(() => 1)
          .sort(null);

        const dummySubItemData = content.map((_, i) => `item-${i}`);
        const subItemPieData = subItemPie(dummySubItemData);

        // Pre-create sub-wedges but hide them and make them non-interactive
        const subWedgesGroup = group
          .append("g")
          .attr("class", "sub-wedges")
          .style("visibility", "hidden")
          .attr("opacity", 0)
          .attr("pointer-events", "none"); // Completely disable interactions with this group

        // Define the arc for sub-wedges using CSS variables
        const subArc = d3
          .arc<d3.PieArcDatum<string>>()
          .innerRadius(actorNodeRadius)
          .outerRadius(expandedRadius)
          .cornerRadius(1)
          .padAngle(0.01);

        // Add sub-wedges to the group - but disable their pointer events to prevent interference
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
          .attr("pointer-events", "none"); // Completely disable interaction with sub-wedges

        // Pre-create the text labels for each item using subItemPieData angles
        content.forEach((item, index) => {
          // Get the exact subwedge from subItemPieData
          const subWedge = subItemPieData[index];

          // Calculate the midpoint angle of this subwedge in the D3.js coordinate system
          // where 0 is at 12 o'clock and angles increase clockwise
          const itemAngle = (subWedge.startAngle + subWedge.endAngle) / 2;

          // In D3's system, 0 is at 12 o'clock (top) and angles proceed clockwise
          // We need to adjust to standard Cartesian where 0 is at 3 o'clock (right) and angles proceed counterclockwise
          // Subtract PI/2 (90 degrees) to shift origin from top to right
          const adjustedAngle = itemAngle - Math.PI / 2;

          // Calculate position based on CSS variables
          // Position labels outside the expanded wedge (which is expandedRadius)
          // We need a comfortable gap between the expanded wedge and the labels
          const gapPercentage = 0.15; // 15% gap to account for wedge expansion
          const baseDistance = expandedRadius * (1 + gapPercentage);
          
          // Only add spacing between items if they're in the same segment
          const itemSpacing = 0; // No additional spacing - each item gets its own space
          const distance = baseDistance + index * itemSpacing;

          const labelPositionX = Math.cos(adjustedAngle) * distance;
          const labelPositionY = Math.sin(adjustedAngle) * distance;

          // Create a group for each label
          const labelGroup = labelsContainer
            .append("g")
            .attr("class", "label-group");

          // Calculate text positioning using our adjusted angle
          const adjustedAngleDeg = ((adjustedAngle * 180) / Math.PI) % 360;
          
          // For left side, the angle is between 90 and 270 degrees
          const isLeftSide = adjustedAngleDeg > 90 && adjustedAngleDeg < 270;
          
          // Set text-anchor based on which side of the circle the text is on
          const textAnchor = isLeftSide ? "end" : "start";
          
          // Calculate angle for text rotation
          // Text should follow the radial angle for readability
          const textRotationDegrees = adjustedAngleDeg;
          // Rotate text 180 degrees on the left side so it's not upside down
          const finalRotationDegrees = isLeftSide 
            ? textRotationDegrees + 180 
            : textRotationDegrees;

          // Add text that follows the radial path
          const text = labelGroup
            .append("text")
            .attr("x", labelPositionX)
            .attr("y", labelPositionY)
            .attr("text-anchor", textAnchor) // Start or end based on side
            .attr("dominant-baseline", "middle")
            .attr("font-size", "11px") // Slightly larger for better readability
            .attr("fill", categoryColors(category))
            .attr("font-weight", "500") // Medium weight for better visibility
            .attr(
              "transform",
              `rotate(${finalRotationDegrees},${labelPositionX},${labelPositionY})`,
            )
            .text(item);
            
          // No background - text is visible directly on the canvas
        });

        // Format category display name to be more readable
        const formatCategoryName = (cat: string) => {
          // Convert camelCase to Title Case with spaces
          const formatted = cat
            .replace(/([A-Z])/g, " $1") // Insert a space before all uppercase letters
            .replace(/^./, (str) => str.toUpperCase()); // Capitalize the first letter
          return formatted.trim();
        };

        // Move mouse handlers directly to the wedge to avoid event bubbling issues
        wedge
          .on("mouseenter", (event) => {
            // Prevent bubbling of events to avoid flickering
            event.stopPropagation();

            // Expand the wedge
            wedge
              .transition()
              .duration(150)
              .attr("d", (datum: any) => expandedArc(datum))
              .attr("filter", "drop-shadow(0px 0px 3px rgba(0,0,0,0.3))");

            // Show the sub-wedges
            subWedgesGroup
              .style("visibility", "visible")
              .transition()
              .duration(150)
              .attr("opacity", 1);

            // Show the labels
            labelsContainer
              .style("visibility", "visible")
              .transition()
              .duration(150)
              .attr("opacity", 1);

            // Update central text indicators only
            d3.select(`#node-${actor.id} .count-text`)
              .transition()
              .duration(150)
              .text(content.length);

            // Format category name nicely (values -> Values, intellectualProperty -> Intellectual Property)
            const formattedCategory = formatCategoryName(category);
            d3.select(`#node-${actor.id} .options-text`)
              .transition()
              .duration(150)
              .text(formattedCategory);
          })
          .on("mouseleave", (event) => {
            // Prevent bubbling of events to avoid flickering
            event.stopPropagation();

            // Shrink wedge back to original size
            wedge
              .transition()
              .duration(200)
              .attr("d", (datum: any) => categoryArc(datum))
              .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))");

            // Hide the sub-wedges
            subWedgesGroup
              .transition()
              .duration(100)
              .attr("opacity", 0)
              .on("end", function () {
                d3.select(this).style("visibility", "hidden");
              });

            // Hide the labels
            labelsContainer
              .transition()
              .duration(100)
              .attr("opacity", 0)
              .on("end", function () {
                d3.select(this).style("visibility", "hidden");
              });

            // Restore central text - just clear the indicator text
            d3.select(`#node-${actor.id} .count-text`)
              .transition()
              .duration(200)
              .text("");
            d3.select(`#node-${actor.id} .options-text`)
              .transition()
              .duration(200)
              .text("");
          });
      });
    });

    const agreementNodes = nodeElements.filter((d) => d.type === "agreement");

    // Get agreement node radius from CSS variables
    const agreementCssRoot = document.documentElement;
    const agreementNodeRadius = parseInt(
      getComputedStyle(agreementCssRoot)
        .getPropertyValue("--agreement-node-radius")
        .trim() || "25",
    );
    const agreementDonutRadius = agreementNodeRadius + baseDonutThickness;

    // Add core agreement node circle
    agreementNodes
      .append("circle")
      .attr("r", agreementNodeRadius)
      .attr("class", "center-circle agreement-center-circle");

    // Get information about agreements for labeling
    const agreementData = agreementNodes.data() as D3Node[];
    let agreementCounter = 1; // Counter for agreement IDs (AG1, AG2, etc.)
    
    agreementData.forEach((agreement) => {
      const agrData = agreement.data as Agreement;
      
      // Generate an agreement ID (AG1, AG2, etc.)
      const agreementId = `AG${agreementCounter++}`;
      
      // Add the ID text to the agreement node
      d3.select(`#node-${agreement.id}`)
        .append("text")
        .attr("class", "agreement-id-text")
        .attr("font-size", `${agreementNodeRadius * 0.7}px`) // Scale text to node size
        .text(agreementId);

      // Store party information for later link positioning
      // We'll use this when rendering links but not actually modify the data structure
      const parties = agrData.parties;
    });

    // Add zoom capabilities
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        nodeGroup.attr("transform", event.transform);
        linkGroup.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Center the view on the graph
    const centerX = width / 2;
    const centerY = height / 2;
    svg.call(
      // @ts-ignore - D3 types don't correctly handle this overload
      zoom.transform,
      d3.zoomIdentity.translate(centerX, centerY).scale(0.8),
    );
  }, [
    nodes,
    links,
    selectNode,
    updateNodePosition,
    width,
    height,
    hoveredNode,
    hoveredCategory,
    activeActorId, // Add activeActorId as a dependency to redraw when it changes
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-2">
        <div className="flex items-center space-x-2">
          <Input
            className="w-[300px]"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            className="ml-4"
            onClick={() => toggleAgreementModal()}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New Agreement
          </Button>
        </div>
      </div>
      <div className="relative flex-1">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="absolute left-0 top-0 h-full w-full"
          style={{ backgroundColor: '#F5F5E8' }} 
        ></svg>
      </div>
    </div>
  );
}
