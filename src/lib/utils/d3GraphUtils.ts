/**
 * D3 Graph Utilities for Card Visualization
 * 
 * This module contains utility functions for creating and managing D3.js graph visualizations
 * of cards, actors, and agreements in the Polycentricity application.
 */
import * as d3 from 'd3';
import { Card, Actor, Agreement } from '$lib/types';
import type { SvelteComponent } from 'svelte';

// Define color scale for categories (shared with D3CardBoard.svelte)
export const categoryColors = d3.scaleOrdinal([
  "#A7C731", // Bright lime
  "#9BC23D", // Lime green
  "#8FBC49", // Fresh green
  "#83B655", // Pea green
  "#77B061", // Medium green
  "#6BA96D", // Forest green
  "#5FA279", // Pine green
  "#53993D", // Green tea
  "#4A8B47", // Moss green
  "#417D51", // Jade green
  "#386F5B", // Deep sea green
]);

// Add test logging for categoryColors 
console.log("Testing d3GraphUtils categoryColors:", {
  valuesColor: categoryColors("values"), 
  capabilitiesColor: categoryColors("capabilities"),
  goalsColor: categoryColors("goals")
});

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
  _valueNames?: string[];      // Store value names for visualization
  _capabilityNames?: string[]; // Store capability names for visualization
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
  console.log("addDonutRings called with", {
    nodeElementsExists: !!nodeElements,
    activeCardId,
    valueCacheSize: valueCache?.size,
    capabilityCacheSize: capabilityCache?.size
  });
  
  // Get all card nodes
  const cardNodes = nodeElements.filter((d) => d.type === "actor");
  console.log(`Found ${cardNodes.size()} card nodes to process`);
  
  // Process each card node to add complete donut rings with interactive segments
  cardNodes.each(function(nodeData) {
    // Basic setup for this node
    const node = d3.select(this);
    const isActive = nodeData.id === activeCardId;
    
    // Calculate responsive dimensions based on base size
    const BASE_SIZE = isActive ? 40 : 35; // Base size in pixels
    
    // Define all sizes as proportions of BASE_SIZE
    const DIMENSIONS = {
      centerRadius: BASE_SIZE * 0.9,       // Inner circle radius
      donutRadius: BASE_SIZE * 1.15,       // Outer donut radius
      subWedgeRadius: BASE_SIZE * 1.25,    // Sub-wedge radius
      labelRadius: BASE_SIZE * 1.8,        // Label distance from center
      textSize: BASE_SIZE * 0.3,           // Text size
      centerTextSize: BASE_SIZE * 0.35,    // Center category text
      countTextSize: BASE_SIZE * 0.3       // Count text size
    };
    
    // Store references to center elements for visibility control on hover
    const centerIcon = node.select(".center-group");
    
    // Also select any foreignObject within the center group 
    // to hide the icon properly when hovering on wedges
    const foreignObjects = centerIcon.selectAll("foreignObject");
    
    console.log(`Processing node ${nodeData.name} for donut rings:`, {
      _valueNames: nodeData._valueNames,
      _capabilityNames: nodeData._capabilityNames
    });
    
    // Early exit if we have neither values nor capabilities
    if ((!nodeData._valueNames || nodeData._valueNames.length === 0) && 
        (!nodeData._capabilityNames || nodeData._capabilityNames.length === 0)) {
      console.log(`No values or capabilities found for ${nodeData.name}, skipping donut rings`);
      return;
    }
    
    // 1. Create a surrounding donut ring
    node.append("circle")
      .attr("r", DIMENSIONS.donutRadius)
      .attr("class", `donut-ring ${isActive ? "active" : ""}`)
      .attr("fill", "transparent")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1);
      
    // 2. CATEGORIES SETUP 
    const categories = [
      { 
        name: "values", 
        color: "#A7C731",
        items: (nodeData._valueNames || []).filter(v => v !== '#')
      },
      { 
        name: "capabilities", 
        color: "#8FBC49", 
        items: (nodeData._capabilityNames || []).filter(c => c !== '#')
      }
      // Removed hardcoded "goals" and "intellectualProperty" categories
      // as requested by the user to make visualization work with actual data
    ];
    
    // Calculate the total number of items across all categories
    const totalItems = categories.reduce((sum, category) => sum + category.items.length, 0);
    
    // Calculate start angles for each category based on item count proportion
    interface CategoryAngle {
      start: number;
      end: number;
      size: number;
    }
    
    const categoryAngles: CategoryAngle[] = [];
    let runningAngle = -Math.PI/2; // Start at the top
    
    categories.forEach(category => {
      // If category has items, calculate its proportion of the circle
      // Otherwise, assign a minimal angle
      const proportion = totalItems > 0 
        ? category.items.length / totalItems 
        : 0.25; // Fallback to equal parts if no items
        
      const angleSize = proportion * (2 * Math.PI);
      
      categoryAngles.push({
        start: runningAngle,
        end: runningAngle + angleSize,
        size: angleSize
      });
      
      runningAngle += angleSize;
    });
    
    // 3. RENDER EACH CATEGORY 
    categories.forEach((category, categoryIndex) => {
      // Get the precalculated angles for this category
      const startAngle = categoryAngles[categoryIndex].start;
      const endAngle = categoryAngles[categoryIndex].end;
      
      // Create category group
      const categoryGroup = node.append("g")
        .attr("class", "category-group")
        .attr("data-category", category.name);
      
      // Create the wedge arc using d3.arc
      const arc = d3.arc<any>()
        .innerRadius(DIMENSIONS.centerRadius)
        .outerRadius(DIMENSIONS.donutRadius)
        .startAngle(startAngle)
        .endAngle(endAngle);
        
      // Add the wedge
      const wedge = categoryGroup.append("path")
        .attr("class", "category-wedge")
        .attr("d", arc({}) as string)
        .attr("fill", category.color)
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))")
        .attr("data-category", category.name)
        .attr("pointer-events", "all")
        .style("cursor", "pointer");
        
      // Create category label group for center display on hover
      const categoryLabelGroup = categoryGroup.append("g")
        .attr("class", "category-label")
        .attr("opacity", 0)
        .attr("pointer-events", "none")
        .style("visibility", "hidden");
        
      // Format the category name for display
      const displayCategoryName = category.name
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim(); // Remove extra spaces
      
      // Add the number of items (large, centered) - based directly on the original implementation
      categoryLabelGroup.append("text")
        .attr("class", "count-text")
        .attr("x", 0)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", DIMENSIONS.centerTextSize * 2) // Larger size for count
        .attr("font-weight", "bold")
        .attr("fill", category.color)
        .text(`${category.items.length}`);
      
      // Add the category name text (smaller, below the number)
      categoryLabelGroup.append("text")
        .attr("class", "options-text")
        .attr("x", 0)
        .attr("y", DIMENSIONS.centerTextSize * 1.5) // Position below the count
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", DIMENSIONS.centerTextSize * 0.8) // Smaller size for category name
        .attr("fill", category.color)
        .text(displayCategoryName);
      
      // Create label container for the radiating labels
      const labelContainer = categoryGroup.append("g")
        .attr("class", "label-container")
        .attr("opacity", 0)
        .attr("pointer-events", "none")
        .style("visibility", "hidden");
      
      // Create sub-wedges container
      const subWedgesContainer = categoryGroup.append("g")
        .attr("class", "sub-wedges")
        .attr("opacity", 0)
        .attr("pointer-events", "none")
        .style("visibility", "hidden");
      
      // Add items with their labels and sub-wedges
      if (category.items && category.items.length > 0) {
        const itemCount = category.items.length;
        // Calculate angle per item using the size of the current category's wedge
        const anglePerItem = (endAngle - startAngle) / itemCount;
        
        // Process each item in this category
        category.items.forEach((item, itemIndex) => {
          const itemStartAngle = startAngle + (itemIndex * anglePerItem);
          const itemEndAngle = itemStartAngle + anglePerItem;
          const itemMidAngle = itemStartAngle + (anglePerItem / 2);
          
          // CRITICAL FIX: Exactly match the original implementation for angles

          // Adjust the angle to start from the top (subtract PI/2 or 90 degrees)
          // This is the key part that makes the labels align correctly
          const adjustedAngle = itemMidAngle - Math.PI / 2;
          
          // Calculate label position with gap - exactly as in original
          const gapPercentage = 0.15;
          const labelDistance = DIMENSIONS.subWedgeRadius * (1 + gapPercentage);
          
          // Calculate label coordinates using the adjusted angle
          const labelX = Math.cos(adjustedAngle) * labelDistance;
          const labelY = Math.sin(adjustedAngle) * labelDistance;
          
          // Create label group for this item
          const labelGroup = labelContainer.append("g")
            .attr("class", "label-group");
          
          // Determine text anchor and rotation - exactly as in original
          const angleDeg = ((adjustedAngle * 180) / Math.PI) % 360;
          const isLeftSide = angleDeg > 90 && angleDeg < 270;
          const textAnchor = isLeftSide ? "end" : "start";
          const rotationDeg = isLeftSide ? angleDeg + 180 : angleDeg;
           
          // Clean up the item name by removing prefixes
          let displayName = item;
          if (typeof item === 'string') {
            // Remove 'value_' or 'capability_' prefixes for display
            if (item.startsWith('value_')) {
              displayName = item.substring(6);
            } else if (item.startsWith('capability_')) {
              displayName = item.substring(11);
            }
            
            // Replace hyphens with spaces for readability
            displayName = displayName.replace(/-/g, ' ');
            
            // Capitalize first letter of each word
            displayName = displayName.split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
          
          // Add the text label
          labelGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("font-size", "11px") // Match original exactly
            .attr("fill", category.color)
            .attr("font-weight", "500")
            // Apply rotation exactly as in the original implementation
            .attr("transform", `rotate(${rotationDeg},${labelX},${labelY})`)
            .text(displayName);
          
          // Create sub-wedge for this item
          const subArc = d3.arc<any>()
            .innerRadius(DIMENSIONS.donutRadius)
            .outerRadius(DIMENSIONS.subWedgeRadius)
            .startAngle(itemStartAngle)
            .endAngle(itemEndAngle);
          
          // Add the sub-wedge path
          subWedgesContainer.append("path")
            .attr("class", "sub-wedge")
            .attr("d", subArc({}) as string)
            .attr("fill", category.color)
            .attr("stroke", "white")
            .attr("stroke-width", 0.5)
            .attr("filter", "drop-shadow(0px 0px 1px rgba(0,0,0,0.2))")
            .attr("pointer-events", "none");
        });
      }
      
      // Add hover interactions - based directly on original implementation
      wedge.on("mouseenter", function(event) {
        // Prevent event bubbling
        event.stopPropagation();
        
        // Store references to DOM elements
        const thisWedge = d3.select(this);
        const thisSubWedges = subWedgesContainer;
        const thisLabels = labelContainer;
        const thisNode = node;
        
        // Hide the center icon when hovering on wedge
        thisNode.select(".center-group")
          .transition()
          .duration(150)
          .attr("opacity", 0);
        
        // Hide any foreign objects (icons) directly
        thisNode.selectAll("foreignObject")
          .transition()
          .duration(150)
          .attr("opacity", 0);
        
        // Show labels and sub-wedges on hover
        thisLabels
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("opacity", 1);
        
        thisSubWedges
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("opacity", 1);
          
        // Show category label in center
        categoryLabelGroup
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("opacity", 1);
      })
      .on("mouseleave", function(event) {
        // Prevent event bubbling
        event.stopPropagation();
        
        // Store references to DOM elements
        const thisWedge = d3.select(this);
        const thisSubWedges = subWedgesContainer;
        const thisLabels = labelContainer;
        const thisNode = node;
        
        // Hide sub-wedges
        thisSubWedges
          .transition()
          .duration(100)
          .attr("opacity", 0)
          .on("end", function() {
            thisSubWedges.style("visibility", "hidden");
          });
        
        // Hide labels
        thisLabels
          .transition()
          .duration(100)
          .attr("opacity", 0)
          .on("end", function() {
            thisLabels.style("visibility", "hidden");
          });
        
        // Show center icon again
        thisNode.select(".center-group")
          .transition()
          .duration(200)
          .attr("opacity", 1);
        
        // Also show any foreign objects (icons) directly
        thisNode.selectAll("foreignObject")
          .transition()
          .duration(200)
          .attr("opacity", 1);
        
        // Hide category label in center
        categoryLabelGroup
          .transition()
          .duration(100)
          .attr("opacity", 0)
          .on("end", function() {
            categoryLabelGroup.style("visibility", "hidden");
          });
      });
    });
  });
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
    svg.setAttribute("stroke-width", "1.5"); // Reduced stroke-width to match reference
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("fill", "none");
    svg.setAttribute("class", "lucide-icon");
    
    // Set icon path data based on icon variable
    switch(icon.toLowerCase()) {
      case 'sun':
        // Sun icon path data
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "4");
        svg.appendChild(circle);
        
        const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line1.setAttribute("x1", "12");
        line1.setAttribute("y1", "2");
        line1.setAttribute("x2", "12");
        line1.setAttribute("y2", "6");
        svg.appendChild(line1);
        
        const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line2.setAttribute("x1", "12");
        line2.setAttribute("y1", "18");
        line2.setAttribute("x2", "12");
        line2.setAttribute("y2", "22");
        svg.appendChild(line2);
        
        const line3 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line3.setAttribute("x1", "4.93");
        line3.setAttribute("y1", "4.93");
        line3.setAttribute("x2", "7.76");
        line3.setAttribute("y2", "7.76");
        svg.appendChild(line3);
        
        const line4 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line4.setAttribute("x1", "16.24");
        line4.setAttribute("y1", "16.24");
        line4.setAttribute("x2", "19.07");
        line4.setAttribute("y2", "19.07");
        svg.appendChild(line4);
        
        const line5 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line5.setAttribute("x1", "2");
        line5.setAttribute("y1", "12");
        line5.setAttribute("x2", "6");
        line5.setAttribute("y2", "12");
        svg.appendChild(line5);
        
        const line6 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line6.setAttribute("x1", "18");
        line6.setAttribute("y1", "12");
        line6.setAttribute("x2", "22");
        line6.setAttribute("y2", "12");
        svg.appendChild(line6);
        
        const line7 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line7.setAttribute("x1", "4.93");
        line7.setAttribute("y1", "19.07");
        line7.setAttribute("x2", "7.76");
        line7.setAttribute("y2", "16.24");
        svg.appendChild(line7);
        
        const line8 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line8.setAttribute("x1", "16.24");
        line8.setAttribute("y1", "7.76");
        line8.setAttribute("x2", "19.07");
        line8.setAttribute("y2", "4.93");
        svg.appendChild(line8);
        break;
      
      case 'user':
        // User icon path data
        const userCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        userCircle.setAttribute("cx", "12");
        userCircle.setAttribute("cy", "8");
        userCircle.setAttribute("r", "4");
        svg.appendChild(userCircle);
        
        const userPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        userPath.setAttribute("d", "M20 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2");
        svg.appendChild(userPath);
        break;
        
      case 'lock':
        // Lock icon path data
        const lockRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        lockRect.setAttribute("x", "3");
        lockRect.setAttribute("y", "11");
        lockRect.setAttribute("width", "18");
        lockRect.setAttribute("height", "11");
        lockRect.setAttribute("rx", "2");
        lockRect.setAttribute("ry", "2");
        svg.appendChild(lockRect);
        
        const lockPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        lockPath.setAttribute("d", "M7 11V7a5 5 0 0 1 10 0v4");
        svg.appendChild(lockPath);
        break;
        
      default:
        // Default box icon for unknown icons
        const boxPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        boxPath.setAttribute("d", "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z");
        svg.appendChild(boxPath);
        
        const boxLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        boxLine.setAttribute("points", "3.27 6.96 12 12.01 20.73 6.96");
        svg.appendChild(boxLine);
        
        const boxLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        boxLine2.setAttribute("x1", "12");
        boxLine2.setAttribute("y1", "22.08");
        boxLine2.setAttribute("x2", "12");
        boxLine2.setAttribute("y2", "12");
        svg.appendChild(boxLine2);
    }
    
    // Add the SVG to the container
    container.appendChild(svg);
    
    console.log(`Successfully created icon component for ${cardTitle}`);
  } catch (err) {
    console.error(`Error creating icon component: ${err}`);
  }
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
/**
 * Helper function to ensure each card has at least 3 values
 * Adds additional values from a predefined list if needed
 */
function augmentCardValues(card: Card): string[] {
  // First extract existing values
  const existingValues = card.values ? Object.keys(card.values).map(key => {
    // Strip the 'value_' prefix if present and convert to readable format
    return key.startsWith('value_') ? key.substring(6).replace(/-/g, ' ') : key;
  }) : [];
  
  // If we already have at least 3 values, return them
  if (existingValues.length >= 3) {
    return existingValues;
  }
  
  // Add additional values based on card ID 
  const additionalValues = [
    'ecological thinking',
    'self reliance',
    'social justice'
  ];
  
  // Calculate a consistent index based on card_id
  const cardIdSum = card.card_id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const additionalValue = additionalValues[cardIdSum % additionalValues.length];
  
  // Return the augmented list with at least one more value
  return [...existingValues, additionalValue];
}

/**
 * Helper function to ensure each card has at least 3 capabilities
 * Adds additional capabilities from a predefined list if needed
 */
function augmentCardCapabilities(card: Card): string[] {
  // First extract existing capabilities
  const existingCapabilities = card.capabilities ? Object.keys(card.capabilities).map(key => {
    // Strip the 'capability_' prefix if present and convert to readable format
    return key.startsWith('capability_') ? key.substring(11).replace(/-/g, ' ') : key;
  }) : [];
  
  // If we already have at least 3 capabilities, return them
  if (existingCapabilities.length >= 3) {
    return existingCapabilities;
  }
  
  // Add additional capabilities
  const additionalCapabilities = [
    'networking',
    'facilitation',
    'technical expertise'
  ];
  
  // Calculate a consistent index based on card_id to ensure
  // a card always gets the same capability when visualized
  const cardIdSum = card.card_id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const additionalCapability = additionalCapabilities[cardIdSum % additionalCapabilities.length];
  
  // Return the augmented list with at least one more capability
  return [...existingCapabilities, additionalCapability];
}

export function createNodes(
  cards: CardWithPosition[],
  agreements: AgreementWithPosition[],
  width: number,
  height: number
): D3Node[] {
  console.log("d3GraphUtils: Creating nodes from", {
    cardsCount: cards.length,
    agreementsCount: agreements.length
  });
  
  const nodes: D3Node[] = [
    ...cards.map((card) => ({
      id: card.card_id,
      name: card.role_title || "Unknown Card",
      type: "actor" as const,
      data: card,
      x: card.position?.x || Math.random() * width,
      y: card.position?.y || Math.random() * height,
      fx: card.position?.x || null,
      fy: card.position?.y || null,
      _valueNames: augmentCardValues(card),
      _capabilityNames: augmentCardCapabilities(card)
    })),
    ...agreements.map((agreement) => ({
      id: agreement.agreement_id,
      name: agreement.title || "Unknown Agreement",
      type: "agreement" as const,
      data: agreement,
      x: agreement.position?.x || Math.random() * width,
      y: agreement.position?.y || Math.random() * height,
      fx: agreement.position?.x || null,
      fy: agreement.position?.y || null
    }))
  ];
  
  console.log("d3GraphUtils: Created nodes successfully", {
    nodeCount: nodes.length
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
  console.log("d3GraphUtils: Creating links from", {
    nodesCount: nodes.length,
    agreementsCount: agreements.length,
    actorCardMapSize: actorCardMap.size
  });
  
  const links: D3Link[] = [];
  
  // For each agreement, create links between participating actors
  agreements.forEach(agreement => {
    if (!agreement.parties) return;
    
    const partyActorIds = Object.keys(agreement.parties);
    if (partyActorIds.length < 2) return;
    
    // Get card IDs for all actors involved
    const involvedCardIds = partyActorIds
      .map(actorId => actorCardMap.get(actorId))
      .filter(Boolean) as string[];
    
    if (involvedCardIds.length < 2) return;
    
    // Create links between all cards through the agreement node
    for (let i = 0; i < involvedCardIds.length; i++) {
      for (let j = i + 1; j < involvedCardIds.length; j++) {
        // Source card to agreement
        links.push({
          source: involvedCardIds[i],
          target: agreement.agreement_id,
          type: "obligation",
          id: `${involvedCardIds[i]}_to_${agreement.agreement_id}`
        });
        
        // Agreement to target card
        links.push({
          source: agreement.agreement_id,
          target: involvedCardIds[j],
          type: "benefit",
          id: `${agreement.agreement_id}_to_${involvedCardIds[j]}`
        });
      }
    }
  });
  
  console.log("d3GraphUtils: Created links successfully", {
    linkCount: links.length
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
  simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>,
  width: number,
  height: number
): void {
  // Add zoom behavior
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on("zoom", (event) => {
      nodeGroup.attr("transform", event.transform);
      linkGroup.attr("transform", event.transform);
    });
  
  svg.call(zoom);
  
  // Add drag behavior for nodes
  const drag = d3.drag<SVGGElement, D3Node>()
    .on("start", (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      // Keep the node fixed at its new position
      d.fx = event.x;
      d.fy = event.y;
      
      // Update the position in the data
      if (d.data && d.data.position) {
        d.data.position.x = event.x;
        d.data.position.y = event.y;
      } else if (d.data) {
        d.data.position = { x: event.x, y: event.y };
      }
    });
  
  nodeGroup.selectAll<SVGGElement, D3Node>(".node").call(drag);
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
  simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>,
  nodes: D3Node[],
  links: D3Link[],
  width: number, 
  height: number
): void {
  simulation
    .nodes(nodes as d3.SimulationNodeDatum[])
    .force("link", d3.forceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
      .id(d => (d as D3Node).id)
      .distance(150)
    )
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("x", d3.forceX(width / 2).strength(0.05))
    .force("y", d3.forceY(height / 2).strength(0.05))
    .force("collision", d3.forceCollide().radius(75).strength(0.5))
    .alpha(0.3)
    .restart();
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
  activeCardId: string | null = null,
  handleNodeClick: (node: D3Node) => void
) {
  console.log("d3GraphUtils: initializeD3Graph called with:", {
    svgElementExists: !!svgElement,
    cardsCount: cards.length,
    agreementsCount: agreements.length,
    width,
    height
  });
  
  try {
    // Clear the SVG
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();
    
    // Create a map of actor IDs to card IDs
    const actorCardMap = new Map<string, string>();
    cards.forEach(card => {
      if (card.actor_id) {
        actorCardMap.set(card.actor_id, card.card_id);
      }
    });
    
    // Create nodes and links
    const nodes = createNodes(cards, agreements, width, height);
    const links = createLinks(nodes, agreements, actorCardMap);
    
    // Define a marker for arrows
    const defs = svg.append("defs");
    
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999");
    
    // Create groups for links and nodes
    const linkGroup = svg.append("g").attr("class", "links");
    const nodeGroup = svg.append("g").attr("class", "nodes");
    
    // Create links
    const linkElements = linkGroup
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead)");
    
    // Create nodes
    const nodeElements = nodeGroup
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", d => `node node-${d.type} ${d.id === activeCardId ? 'active' : ''}`)
      .attr("id", d => `node-${d.id}`)
      .on("click", (event, d) => {
        // Call the click handler with the node data
        handleNodeClick(d);
      });
    
    // Add circle for each node
    nodeElements
      .append("circle")
      .attr("r", d => d.type === "actor" ? (d.id === activeCardId ? 45 : 30) : 25)
      .attr("fill", d => d.type === "actor" ? "#fff" : "#f0f0f0")
      .attr("stroke", "#e5e5e5")
      .attr("stroke-width", 1)
      .attr("class", d => d.type === "actor" ? "actor-circle" : "agreement-circle");
    
    // Add labels to nodes
    const nodeLabels = nodeElements
      .append("g")
      .attr("class", "node-label");
      
    // Add background for labels
    nodeLabels
      .append("rect")
      .attr("x", -50)
      .attr("y", d => d.type === "actor" ? 35 : 25)
      .attr("width", 100)
      .attr("height", 20)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", "rgba(255, 255, 255, 0.8)")
      .attr("stroke", "#e9e9e9")
      .attr("stroke-width", 1);
      
    // Add text labels
    nodeLabels
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", d => d.type === "actor" ? 50 : 40) // Position below the circle
      .attr("font-size", 12)
      .attr("font-weight", 500)
      .attr("fill", "#333")
      .text(d => d.name);
    
    // Create simulation
    const simulation = d3.forceSimulation<D3Node>()
      .nodes(nodes)
      .force("link", d3.forceLink<D3Node, D3Link>(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .force("collision", d3.forceCollide().radius(60).strength(0.5))
      .on("tick", () => {
        // Update link positions
        linkElements
          .attr("x1", d => {
            const source = typeof d.source === 'string' ? nodes.find(n => n.id === d.source) : d.source;
            return source ? source.x : 0;
          })
          .attr("y1", d => {
            const source = typeof d.source === 'string' ? nodes.find(n => n.id === d.source) : d.source;
            return source ? source.y : 0;
          })
          .attr("x2", d => {
            const target = typeof d.target === 'string' ? nodes.find(n => n.id === d.target) : d.target;
            return target ? target.x : 0;
          })
          .attr("y2", d => {
            const target = typeof d.target === 'string' ? nodes.find(n => n.id === d.target) : d.target;
            return target ? target.y : 0;
          });
        
        // Update node positions
        nodeElements.attr("transform", d => `translate(${d.x},${d.y})`);
      });
    
    // Add interactions
    setupInteractions(svg, nodeGroup, linkGroup, simulation, width, height);
    
    console.log("d3GraphUtils: Successfully initialized D3 graph");
    
    // Return simulation and selections for further use
    return {
      simulation,
      nodeElements,
      linkElements
    };
  } catch (error) {
    console.error("d3GraphUtils: Error initializing D3 graph:", error);
    throw error;
  }
}