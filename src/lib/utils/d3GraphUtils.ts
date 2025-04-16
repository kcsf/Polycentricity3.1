/**
 * D3 Graph Utilities for Card Visualization
 * 
 * This module contains utility functions for creating and managing D3.js graph visualizations
 * of cards, actors, and agreements in the Polycentricity application.
 */
import * as d3 from 'd3';
import { Card, Actor, Agreement } from '$lib/types';
import type { SvelteComponent } from 'svelte';

/**
 * Interface for nodes in the D3 force simulation
 */
export interface D3Node {
  id: string;
  name: string;
  type: "actor" | "agreement";
  data: CardWithPosition | AgreementWithPosition;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
  active?: boolean;
  _valueNames?: string[];  // Store value names for card nodes
  _capabilityNames?: string[];  // Store capability names for card nodes
  // Allow any additional category data
  values?: any;
  capabilities?: any;
  intellectualProperty?: any;
  resources?: any;
  goals?: any;
}

/**
 * Interface for links between nodes in the D3 force simulation
 */
export interface D3Link {
  source: string | D3Node;
  target: string | D3Node;
  type: "obligation" | "benefit";
  id: string;
}

/**
 * Interface for subdivisions of donut chart segments
 */
export interface SubItem {
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
 * Card with position information for visualization
 */
export interface CardWithPosition extends Card {
  position?: {
    x: number;
    y: number;
  };
  actor_id?: string; // Add actor_id field which is needed for card-actor mapping
}

/**
 * Obligation items extracted from agreements
 */
export interface ObligationItem {
  id: string;
  fromActorId: string;
  toActorId?: string;
  text: string;  // Changed from description to match actual property name
}

/**
 * Benefit items extracted from agreements
 */
export interface BenefitItem {
  id: string;
  fromActorId: string;
  toActorId?: string;
  text: string;  // Changed from description to match actual property name
}

/**
 * Agreement with position information for visualization
 */
export interface AgreementWithPosition {
  agreement_id: string;
  game_id?: string;
  title: string;
  description?: string;
  summary?: string;
  type?: 'symmetric' | 'asymmetric';
  status: string;
  created_at: number;
  updated_at?: number;
  created_by?: string;
  parties: Record<string, boolean>;
  obligations: ObligationItem[];
  benefits: BenefitItem[];
  position?: {
    x: number;
    y: number;
  };
}

/**
 * Extended D3Node with relationship information
 */
export interface D3NodeWithRelationships extends D3Node {
  sourceCard?: D3Node;
  targetCard?: D3Node;
}

/**
 * Creates D3 nodes from cards and agreements
 * 
 * @param cards - Array of cards with position information
 * @param agreements - Array of agreements with position information
 * @param width - Width of the container
 * @param height - Height of the container
 * @returns Array of D3Node objects
 */
export function createNodes(
  cards: CardWithPosition[],
  agreements: AgreementWithPosition[],
  width: number,
  height: number
): D3Node[] {
  const nodes: D3Node[] = [];
  
  // Add card nodes
  cards.forEach(card => {
    // Determine initial position
    let x = card.position?.x ?? Math.random() * width;
    let y = card.position?.y ?? Math.random() * height;
    
    // Ensure position is within bounds
    x = Math.max(50, Math.min(width - 50, x));
    y = Math.max(50, Math.min(height - 50, y));
    
    // Create node
    nodes.push({
      id: card.card_id,
      name: card.role_title,
      type: "actor",
      data: card,
      x,
      y
    });
  });
  
  // Add agreement nodes
  agreements.forEach(agreement => {
    // Determine initial position
    let x = agreement.position?.x ?? Math.random() * width;
    let y = agreement.position?.y ?? Math.random() * height;
    
    // Ensure position is within bounds
    x = Math.max(50, Math.min(width - 50, x));
    y = Math.max(50, Math.min(height - 50, y));
    
    // Create node
    nodes.push({
      id: agreement.agreement_id,
      name: agreement.title,
      type: "agreement",
      data: agreement,
      x,
      y
    });
  });
  
  return nodes;
}

/**
 * Creates D3 links between nodes based on agreement relationships
 * 
 * @param nodes - Array of D3Node objects
 * @param agreements - Array of agreements with position information
 * @param actorCardMap - Map of actor IDs to card IDs
 * @returns Array of D3Link objects
 */
export function createLinks(
  nodes: D3Node[],
  agreements: AgreementWithPosition[],
  actorCardMap: Map<string, string>
): D3Link[] {
  const links: D3Link[] = [];
  
  // Process each agreement
  agreements.forEach(agreement => {
    // Process obligations (fromActor -> agreement)
    agreement.obligations.forEach(obligation => {
      const fromActorId = obligation.fromActorId;
      const toActorId = obligation.toActorId;
      
      // Get card IDs from actor IDs
      const creatorCardId = actorCardMap.get(fromActorId);
      
      if (creatorCardId) {
        // Create link from creator card to agreement
        links.push({
          source: creatorCardId,
          target: agreement.agreement_id,
          type: "obligation",
          id: `ob_${obligation.id}`,
        });
      }
    });
    
    // Process benefits (agreement -> toActor)
    agreement.benefits.forEach(benefit => {
      const fromActorId = benefit.fromActorId;
      const toActorId = benefit.toActorId;
      
      // Get card IDs from actor IDs - ensure we handle undefined
      const recipientCardId = toActorId ? actorCardMap.get(toActorId) : undefined;
      
      if (recipientCardId) {
        // Create link from agreement to recipient card
        links.push({
          source: agreement.agreement_id,
          target: recipientCardId,
          type: "benefit",
          id: `be_${benefit.id}`,
        });
      }
    });
  });
  
  return links;
}

/**
 * Sets up interactions for nodes and links
 * 
 * @param svg - D3 selection of the SVG element
 * @param nodeGroup - D3 selection of the node group
 * @param linkGroup - D3 selection of the link group
 * @param simulation - D3 force simulation
 * @param width - Width of the container
 * @param height - Height of the container
 */
export function setupInteractions(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  nodeGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  linkGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  simulation: d3.Simulation<D3Node, D3Link>,
  width: number,
  height: number
): d3.DragBehavior<SVGGElement, D3Node, D3Node | d3.SubjectPosition> {
  // Set up zoom behavior
  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.25, 3])
    .on("zoom", (event) => {
      // Update transform for all groups
      nodeGroup.attr("transform", event.transform);
      linkGroup.attr("transform", event.transform);
    });
  
  // Apply zoom behavior
  svg.call(zoomBehavior)
    // Prevent standard mousewheel behavior
    .on("wheel", (event) => {
      if (event.ctrlKey || event.metaKey) return; // Allow browser zoom with Ctrl/Cmd key
      event.preventDefault();
    });
  
  // Set up drag behavior for nodes
  const dragBehavior = d3.drag<SVGGElement, D3Node>()
    .on("start", (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = Math.max(50, Math.min(width - 50, event.x));
      d.fy = Math.max(50, Math.min(height - 50, event.y));
    })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      
      // Save the position
      if (d.type === "actor") {
        const card = d.data as CardWithPosition;
        if (card.position) {
          card.position.x = d.x;
          card.position.y = d.y;
        } else {
          card.position = { x: d.x, y: d.y };
        }
      } else if (d.type === "agreement") {
        const agreement = d.data as AgreementWithPosition;
        if (agreement.position) {
          agreement.position.x = d.x;
          agreement.position.y = d.y;
        } else {
          agreement.position = { x: d.x, y: d.y };
        }
      }
      
      // Release the fixed position if not dragging
      d.fx = null;
      d.fy = null;
    });
  
  return dragBehavior;
}

/**
 * Creates SVG icon for card based on icon name
 * 
 * @param iconName - Name of the icon to create
 * @param iconSize - Size of the icon
 * @param container - Container element to append the icon to
 * @param cardTitle - Title of the card for logging
 */
export function createCardIcon(
  iconName: string | undefined,
  iconSize: number,
  container: HTMLElement,
  cardTitle: string
): void {
  // If iconName is undefined, use 'default' as fallback
  const icon = iconName ?? 'default';
  
  try {
    // Clear the container first
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Create SVG element with proper attributes
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", iconSize.toString());
    svg.setAttribute("height", iconSize.toString());
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("stroke", "#555555");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("fill", "none");
    svg.setAttribute("class", "lucide-icon");
    
    // Set icon path data based on icon variable instead of iconName
    if (icon === 'sun') {
      // Sun icon path data
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "4");
      svg.appendChild(circle);
      
      // Sun rays
      for (let i = 0; i < 8; i++) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const angle = (i * Math.PI) / 4;
        const innerRadius = 4; // Radius of the central circle
        const outerRadius = 8; // Length of rays
        
        const x1 = 12 + innerRadius * Math.cos(angle);
        const y1 = 12 + innerRadius * Math.sin(angle);
        const x2 = 12 + outerRadius * Math.cos(angle);
        const y2 = 12 + outerRadius * Math.sin(angle);
        
        line.setAttribute("x1", x1.toString());
        line.setAttribute("y1", y1.toString());
        line.setAttribute("x2", x2.toString());
        line.setAttribute("y2", y2.toString());
        
        svg.appendChild(line);
      }
    } else if (icon === 'link') {
      // Link icon
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71");
      svg.appendChild(path);
      
      const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path2.setAttribute("d", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71");
      svg.appendChild(path2);
    } else if (icon === 'lock') {
      // Lock icon
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("width", "16");
      rect.setAttribute("height", "10");
      rect.setAttribute("x", "4");
      rect.setAttribute("y", "9");
      rect.setAttribute("rx", "2");
      rect.setAttribute("ry", "2");
      svg.appendChild(rect);
      
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M8 9V7a4 4 0 0 1 8 0v2");
      svg.appendChild(path);
    } else if (icon === 'users') {
      // Users icon
      const circle1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle1.setAttribute("cx", "16");
      circle1.setAttribute("cy", "7");
      circle1.setAttribute("r", "3");
      svg.appendChild(circle1);
      
      const circle2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle2.setAttribute("cx", "8");
      circle2.setAttribute("cy", "7");
      circle2.setAttribute("r", "3");
      svg.appendChild(circle2);
      
      const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path1.setAttribute("d", "M3 21v-2a4 4 0 0 1 4-4h2");
      svg.appendChild(path1);
      
      const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path2.setAttribute("d", "M15 13h2a4 4 0 0 1 4 4v2");
      svg.appendChild(path2);
      
      const path3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path3.setAttribute("d", "M16 21h-8a4 4 0 0 1-4-4v-2");
      svg.appendChild(path3);
    } else {
      // Default user icon as fallback
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "8");
      circle.setAttribute("r", "4");
      svg.appendChild(circle);
      
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M20 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2");
      svg.appendChild(path);
    }
    
    // Add the SVG to the container
    container.appendChild(svg);
    
    console.log(`Successfully created icon component for ${cardTitle}`);
  } catch (err) {
    console.error(`Error creating icon component: ${err}`);
  }
}

/**
 * Updates forces in the simulation based on current data
 * 
 * @param simulation - D3 force simulation
 * @param nodes - Array of D3Node objects
 * @param links - Array of D3Link objects
 * @param width - Width of the container
 * @param height - Height of the container
 */
export function updateForces(
  simulation: d3.Simulation<D3Node, D3Link>,
  nodes: D3Node[],
  links: D3Link[],
  width: number,
  height: number
): void {
  // Update nodes in simulation
  simulation.nodes(nodes);
  
  // Update link force with new links
  simulation.force("link", d3.forceLink<D3Node, D3Link>(links)
    .id(d => d.id)
    .distance(100)
    .strength(0.7)
  );
  
  // Update center force
  simulation.force("center", d3.forceCenter(width / 2, height / 2));
  
  // Update collision force
  simulation.force("collide", d3.forceCollide<D3Node>().radius(50));
  
  // Update charge force
  simulation.force("charge", d3.forceManyBody().strength(-300));
  
  // Restart simulation
  simulation.alpha(0.3).restart();
}

/**
 * Utility function to help debug and fix node selectors
 * between React and Svelte implementations
 */
export function fixNodeSelectors() {
  // Check if we need to modify the node class
  const allNodes = document.querySelectorAll('.node-card');
  const allActorNodes = document.querySelectorAll('.node-actor');
  
  console.log('Node selector debug:', {
    nodeCardCount: allNodes.length,
    nodeActorCount: allActorNodes.length
  });
  
  // If we have node-card elements but no node-actor elements,
  // we need to add the node-actor class to them
  if (allNodes.length > 0 && allActorNodes.length === 0) {
    console.log('Fixing node selectors: Adding node-actor class to node-card elements');
    allNodes.forEach(node => {
      node.classList.add('node-actor');
    });
  }
  
  // Also check the reverse
  if (allActorNodes.length > 0 && allNodes.length === 0) {
    console.log('Fixing node selectors: Adding node-card class to node-actor elements');
    allActorNodes.forEach(node => {
      node.classList.add('node-card');
    });
  }
}

/**
 * Add donut ring segments to card nodes based on their values, capabilities, etc.
 * 
 * @param nodeElements - D3 Selection of node elements
 * @param activeCardId - ID of the active card (if any) for highlighting
 * @param valueCache - Map of value IDs to Value objects
 * @param capabilityCache - Map of capability IDs to Capability objects
 */
export function addDonutRings(
  nodeElements: d3.Selection<SVGGElement, D3Node, null, undefined>,
  activeCardId?: string | null,
  valueCache?: Map<string, any>,
  capabilityCache?: Map<string, any>
): void {
  // Run the node selector fixer first to ensure we have the right selectors
  fixNodeSelectors();
  
  // Guard against undefined nodeElements
  if (!nodeElements) {
    console.error("Cannot add donut rings: nodeElements is undefined");
    return;
  }
  
  // Also check if the selection is empty
  try {
    if (nodeElements.empty()) {
      console.warn("Cannot add donut rings: nodeElements selection is empty");
      return;
    }
    
    // Debug the node elements data
    console.log("D3 nodeElements debug:", {
      size: nodeElements.size(),
      data: nodeElements.data(),
      types: nodeElements.data().map(d => d.type)
    });
  } catch (err) {
    console.error("Error checking nodeElements:", err);
    return;
  }
  
  // Get all card nodes
  const cardNodes = nodeElements.filter((d) => d.type === "actor");
  
  // Debug the filtered card nodes
  console.log("Filtered card nodes debug:", {
    count: cardNodes.size(),
    data: cardNodes.data()
  });
  
  // Process each card node to check data
  cardNodes.each(function(d) {
    console.log("Preparing to add real donut segments to node:", d.id);
    
    // Extract values and capabilities from node data
    const cardNode = d as D3Node;
    
    // If _valueNames and _capabilityNames aren't set, try to extract from cached values
    if (!cardNode._valueNames || cardNode._valueNames.length === 0) {
      console.log(`Node ${d.id} has no _valueNames property, attempting to find from card data`);
      
      // Extract from card data if available
      const card = cardNode.data as Card;
      if (card && card.values) {
        try {
          // Try to extract values from card data
          if (typeof card.values === 'object' && !Array.isArray(card.values)) {
            const valueIds = Object.keys(card.values)
              .filter(key => key !== '_' && key !== '#' && (card.values as Record<string, any>)[key] === true);
            
            if (valueIds.length > 0) {
              cardNode._valueNames = valueIds;
              console.log(`Found ${valueIds.length} value names from card data:`, valueIds);
            }
          }
        } catch (err) {
          console.error("Error extracting values from card data:", err);
        }
      }
    }
    
    // Same for capabilities
    if (!cardNode._capabilityNames || cardNode._capabilityNames.length === 0) {
      console.log(`Node ${d.id} has no _capabilityNames property, attempting to find from card data`);
      
      // Extract from card data if available
      const card = cardNode.data as Card;
      if (card && card.capabilities) {
        try {
          // Try to extract capabilities from card data
          if (typeof card.capabilities === 'object' && !Array.isArray(card.capabilities)) {
            const capabilityIds = Object.keys(card.capabilities)
              .filter(key => key !== '_' && key !== '#' && (card.capabilities as Record<string, any>)[key] === true);
            
            if (capabilityIds.length > 0) {
              cardNode._capabilityNames = capabilityIds;
              console.log(`Found ${capabilityIds.length} capability names from card data:`, capabilityIds);
            }
          }
        } catch (err) {
          console.error("Error extracting capabilities from card data:", err);
        }
      }
    }
    
    // Log data for debugging
    console.log(`Node ${d.id} ready for donut rings with:`, {
      hasValueNames: !!cardNode._valueNames,
      hasCapabilityNames: !!cardNode._capabilityNames,
      valueNames: cardNode._valueNames || [],
      capabilityNames: cardNode._capabilityNames || []
    });
  });
  
  // Fixed values for radii
  const baseActorRadius = 35; 
  const baseDonutThickness = 15;

  // Helper function to ensure array format for properties
  const ensureArray = (field: any): string[] => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'object') {
      // Handle Gun.js objects and references
      try {
        return Object.keys(field).filter(id => id !== '_' && id !== '#');
      } catch (err) {
        console.error('Error processing object keys:', err);
        return [];
      }
    }
    if (typeof field === 'string') {
      return field.split(',').map(item => item.trim());
    }
    if (typeof field === 'number') {
      return [field.toString()];
    }
    console.warn('Unexpected field type:', typeof field, field);
    return [];
  };
  
  // Step 1: Add outer donut rings to all card nodes first
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
  
  // Color scale for categories - using same colors as original React implementation
  const colorScale = d3.scaleOrdinal<string>()
    .domain(categories)
    .range([
      "#3B82F6", // blue for values
      "#10B981", // green for capabilities
      "#F59E0B", // amber for intellectual property
      "#6366F1", // indigo for resources
      "#EC4899"  // pink for goals
    ]);
  
  // Process each card node to add wedges
  cardNodes.each(function(nodeData) {
    // Basic setup for this node
    const node = d3.select(this);
    const card = nodeData.data as Card;
    
    // Create wedges for each category that has data
    let totalOffset = 0;
    let categoryIndex = 0;
    
    // Process each category
    categories.forEach(category => {
      // Handle special cases for values and capabilities, using the _valueNames and _capabilityNames
      // properties that were set earlier
      let categoryItems: string[] = [];
      
      if (category === 'values' && nodeData._valueNames && nodeData._valueNames.length > 0) {
        // Use cached value names that were already processed
        categoryItems = nodeData._valueNames;
        console.log(`Using _valueNames for node ${nodeData.id}:`, categoryItems);
      } else if (category === 'capabilities' && nodeData._capabilityNames && nodeData._capabilityNames.length > 0) {
        // Use cached capability names that were already processed
        categoryItems = nodeData._capabilityNames;
        console.log(`Using _capabilityNames for node ${nodeData.id}:`, categoryItems);
      } else {
        // For other categories, use standard approach
        let categoryData: any = nodeData[category as keyof D3Node] || card[category as keyof Card];
        // Safely convert numerical values if they exist
        if (typeof categoryData === 'number') {
          categoryData = categoryData.toString();
        }
        categoryItems = ensureArray(categoryData);
      }
      
      // Log all categories for this node with detailed information
      console.log(`Category ${category} for node ${nodeData.id}:`, {
        count: categoryItems.length,
        items: categoryItems,
        hasData: categoryItems.length > 0
      });
        
      // Skip rendering if the category has no items
      if (categoryItems.length === 0) {
        console.log(`Skipping rendering for empty category ${category} in node ${nodeData.id}`);
        return; // Skip to next category
      }
      
      // Now proceed with creating wedges
        // Calculate angles for wedges based on number of items
        const isActive = nodeData.id === activeCardId;
        const scaleFactor = isActive ? 1.5 : 1;
        const scaledNodeRadius = baseActorRadius * scaleFactor;
        const donutRadius = scaledNodeRadius + baseDonutThickness * scaleFactor;
        
        // Calculate angles and create wedge paths
        const itemCount = categoryItems.length;
        const categoryColor = colorScale(category);
        const totalAngle = Math.min(300, 360 / categories.length); // Max 300 degrees per category
        const startAngle = totalOffset;
        const anglePerItem = totalAngle / itemCount;
        
        // Create a group for this category
        const categoryGroup = node.append("g")
          .attr("class", `category-group ${category}`);
        
        // Add each wedge for this category
        categoryItems.forEach((itemId, i) => {
          const itemAngle = startAngle + (i * anglePerItem);
          const wedgeStartAngle = (itemAngle * Math.PI) / 180;
          const wedgeEndAngle = ((itemAngle + anglePerItem) * Math.PI) / 180;
          
          // Create SVG arc path
          const arc = d3.arc<any>()
            .innerRadius(scaledNodeRadius)
            .outerRadius(donutRadius)
            .startAngle(wedgeStartAngle)
            .endAngle(wedgeEndAngle)
            .padAngle(0.01);
          
          // Add wedge path
          categoryGroup.append("path")
            .attr("d", arc({} as any))
            .attr("fill", categoryColor)
            .attr("opacity", 0.8)
            .attr("stroke", "white")
            .attr("stroke-width", 0.5)
            .attr("class", `wedge ${category}`)
            .on("mouseover", function() {
              // Highlight this wedge
              d3.select(this)
                .attr("opacity", 1)
                .attr("stroke-width", 1);
            })
            .on("mouseout", function() {
              // Reset appearance
              d3.select(this)
                .attr("opacity", 0.8)
                .attr("stroke-width", 0.5);
            });
            
          // Add tooltip or label if needed
          let itemName = itemId;
          
          // Try to get a friendly name from cache
          if (category === "values" && valueCache && valueCache.has(itemId)) {
            itemName = valueCache.get(itemId).name;
          } else if (category === "capabilities" && capabilityCache && capabilityCache.has(itemId)) {
            itemName = capabilityCache.get(itemId).name;
          } else {
            // Extract name from the ID if no cache is available
            itemName = itemId.replace(/^(value_|capability_|resource_|goal_)/, '')
              .split(/[-_]/)
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");
          }
          
          // Add title for tooltip
          categoryGroup.append("title")
            .text(`${formatCategoryName(category)}: ${itemName}`);
        });
        
        // Update offset for next category
        totalOffset += totalAngle;
        categoryIndex++;
      }
    });
  });
}

/**
 * Initializes the D3 graph with nodes and links
 * 
 * @param svgElement - SVG element to draw the graph in
 * @param cards - Array of cards with position information
 * @param agreements - Array of agreements with position information
 * @param width - Width of the container
 * @param height - Height of the container
 * @param activeCardId - ID of the currently active card (if any)
 * @param handleNodeClick - Callback for node click events
 * @returns Object with simulation, node and link selections
 */
export function initializeD3Graph(
  svgElement: SVGSVGElement,
  cards: CardWithPosition[],
  agreements: AgreementWithPosition[],
  width: number,
  height: number,
  activeCardId: string | null,
  handleNodeClick: (node: D3Node) => void
): {
  simulation: d3.Simulation<D3Node, D3Link>,
  nodeElements: d3.Selection<any, any, any, any>,
  linkElements: d3.Selection<any, any, any, any>,
  nodes: D3Node[],
  links: D3Link[]
} {
  // Create actorCardMap
  const actorCardMap = new Map<string, string>();
  
  // Map actor_id to card_id for lookup during link creation
  cards.forEach(card => {
    if (card.actor_id) {
      actorCardMap.set(card.actor_id, card.card_id);
    }
  });
  
  // Create D3 nodes and links with defensive coding
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    console.warn('No valid cards data provided for D3 graph initialization');
    
    // Create empty SVG structure
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();
    
    const nodeGroup = svg.append("g").attr("class", "nodes");
    const linkGroup = svg.append("g").attr("class", "links");
    
    // Return an empty graph structure when no data exists
    return {
      simulation: d3.forceSimulation<D3Node>([]),
      nodeElements: nodeGroup.selectAll("g") as any, // Empty selection
      linkElements: linkGroup.selectAll("g") as any, // Empty selection
      nodes: [],
      links: []
    };
  }
  
  // Create nodes with safer approach
  let nodes: D3Node[] = [];
  try {
    nodes = createNodes(cards, agreements || [], width, height);
  } catch (err) {
    console.error('Error creating nodes:', err);
    
    // Create empty SVG structure on error
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();
    
    const nodeGroup = svg.append("g").attr("class", "nodes");
    const linkGroup = svg.append("g").attr("class", "links");
    
    // Return an empty graph structure
    return {
      simulation: d3.forceSimulation<D3Node>([]),
      nodeElements: nodeGroup.selectAll("g") as any,
      linkElements: linkGroup.selectAll("g") as any,
      nodes: [],
      links: []
    };
  }
  
  if (!nodes || nodes.length === 0) {
    console.warn('No nodes created in D3 graph initialization');
    
    // Create empty SVG structure
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();
    
    const nodeGroup = svg.append("g").attr("class", "nodes");
    const linkGroup = svg.append("g").attr("class", "links");
    
    // Return an empty graph structure when no nodes exist
    return {
      simulation: d3.forceSimulation<D3Node>([]),
      nodeElements: nodeGroup.selectAll("g") as any,
      linkElements: linkGroup.selectAll("g") as any,
      nodes: [],
      links: []
    };
  }
  
  const links = nodes && agreements ? createLinks(nodes, agreements, actorCardMap) : [];
  if (!links || links.length === 0) {
    console.warn('No links created in D3 graph initialization');
  }
  
  // Clear existing SVG content
  const svg = d3.select(svgElement);
  svg.selectAll("*").remove();
  
  // Create groups for links and nodes (links should be created first so they're behind nodes)
  const linkGroup = svg.append("g").attr("class", "links");
  const nodeGroup = svg.append("g").attr("class", "nodes");
  
  // Create the force simulation
  const simulation = d3.forceSimulation<D3Node>(nodes)
    .force("link", d3.forceLink<D3Node, D3Link>(links).id(d => d.id).distance(100).strength(0.7))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide<D3Node>().radius(50));
  
  // Set up interactions (zoom, drag)
  const dragBehavior = setupInteractions(svg, nodeGroup, linkGroup, simulation, width, height);
  
  // Create link elements
  const linkElements = linkGroup
    .selectAll("g")
    .data(links)
    .enter()
    .append("g")
    .attr("class", d => `link ${d.type}`);
  
  // Add path for each link
  linkElements.append("path")
    .attr("class", d => `link-path ${d.type}`)
    .attr("marker-end", d => `url(#arrow-${d.type})`);
  
  // Create node elements with defensive coding
  // Use a more flexible type to avoid TypeScript errors with D3's selections
  let nodeElements: d3.Selection<any, any, any, any>;
  try {
    nodeElements = nodeGroup
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", (d: D3Node) => {
        // IMPORTANT: We need to use BOTH node-card AND node-actor classes
        // This ensures compatibility with both React and Svelte implementations
        if (d.type === 'actor') {
          return `node node-card node-actor ${d.id === activeCardId ? 'active' : ''}`;
        } else {
          return `node node-agreement ${d.id === activeCardId ? 'active' : ''}`;
        }
      })
      .on("click", (_: any, d: D3Node) => handleNodeClick(d))
      .call(dragBehavior as any);
    
    // Call fixNodeSelectors to ensure classes are set correctly
    fixNodeSelectors();
    
    // Verify that nodeElements is created correctly
    if (!nodeElements || nodeElements.empty()) {
      console.warn("Node elements selection is empty after creation");
      
      // Create an empty selection that can be safely returned
      nodeElements = nodeGroup.selectAll("g");
    }
  } catch (err) {
    console.error("Error creating node elements:", err);
    
    // Create an empty selection that can be safely returned
    nodeElements = nodeGroup.selectAll("g");
  }
  
  // Add background circles for nodes - with proper type annotations
  try {
    nodeElements.append("circle")
      .attr("class", (d: D3Node) => `node-background ${d.type === 'actor' ? 'actor-background' : 'agreement-background'}`)
      .attr("r", (d: D3Node) => d.type === 'actor' ? 35 : 17);
  } catch (err) {
    console.error("Error adding background circles to nodes:", err);
  }
  
  // Setup visualization update on tick
  simulation.on("tick", () => {
    // Update link positions with type assertions to handle D3 typing issues
    linkElements.selectAll(".link-path")
      .attr("d", (d: any) => {
        // Handle string sources that haven't been replaced with objects yet
        const source = typeof d.source === 'string' 
          ? nodes.find(n => n.id === d.source) 
          : d.source;
        
        const target = typeof d.target === 'string'
          ? nodes.find(n => n.id === d.target)
          : d.target;
        
        if (!source || !target) return '';
        
        return `M${source.x},${source.y} L${target.x},${target.y}`;
      });
    
    // Update node positions
    nodeElements.attr("transform", (d: any) => {
      return `translate(${d.x}, ${d.y})`;
    });
  });
  
  return {
    simulation,
    nodeElements,
    linkElements,
    nodes,
    links
  };
}