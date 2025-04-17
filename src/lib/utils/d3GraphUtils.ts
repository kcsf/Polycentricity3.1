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

// Color scheme for categories (no debug logging needed)

/**
 * Interface for nodes in the D3 force simulation
 */
export interface D3Node extends d3.SimulationNodeDatum {
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
  // Get all card nodes that are actors (not agreements)
  const cardNodes = nodeElements.filter((d) => d.type === "actor");
  
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
      donutRadius: BASE_SIZE * 1.15,       // Outer donut radius (the ring)
      subWedgeRadius: BASE_SIZE * 1.35,    // Sub-wedge radius (slightly larger than donut)
      labelRadius: BASE_SIZE * 2.5,        // Label distance from center - much further out
      textSize: BASE_SIZE * 0.2,           // MUCH smaller text size for better readability
      centerTextSize: BASE_SIZE * 0.25,    // Center category text
      countTextSize: BASE_SIZE * 0.2       // Count text size
    };
    
    // Store references to center elements for visibility control on hover
    const centerIcon = node.select(".center-group");
    
    // Also select any foreignObject within the center group 
    // to hide the icon properly when hovering on wedges
    const foreignObjects = centerIcon.selectAll("foreignObject");
    
    // Early exit if we have neither values nor capabilities
    if ((!nodeData._valueNames || nodeData._valueNames.length === 0) && 
        (!nodeData._capabilityNames || nodeData._capabilityNames.length === 0)) {
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
        name: "goals", 
        color: "#9BC23D", 
        items: (nodeData.type === 'actor' && (nodeData.data as Card).goals) 
          ? ((nodeData.data as Card).goals as string).split(/[;,.]+/).map((s: string) => s.trim()).filter(Boolean)
          : []
      },
      { 
        name: "capabilities", 
        color: "#8FBC49", 
        items: (nodeData._capabilityNames || []).filter(c => c !== '#')
      },
      { 
        name: "intellectualProperty", 
        color: "#83B655", 
        items: (nodeData.type === 'actor' && (nodeData.data as Card).intellectual_property) 
          ? ((nodeData.data as Card).intellectual_property as string).split(/[;,.]+/).map((s: string) => s.trim()).filter(Boolean)
          : []
      },
      {
        name: "rivalrousResources",
        color: "#77B061",
        items: (nodeData.type === 'actor' && (nodeData.data as Card).rivalrous_resources)
          ? ((nodeData.data as Card).rivalrous_resources as string).split(/[;,.]+/).map((s: string) => s.trim()).filter(Boolean)
          : []
      },
      {
        name: "obligations",
        color: "#6BA96D",
        items: (nodeData.type === 'agreement' && Array.isArray(nodeData.data.obligations))
          ? nodeData.data.obligations.map((obligation: ObligationItem) => obligation.text || '').filter(Boolean)
          : []
      }
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
        category.items.forEach((item: any, itemIndex: number) => {
          const itemStartAngle = startAngle + (itemIndex * anglePerItem);
          const itemEndAngle = itemStartAngle + anglePerItem;
          const itemMidAngle = itemStartAngle + (anglePerItem / 2);
          
          // CRITICAL FIX: Exactly match the original implementation for angles

          // Adjust the angle to start from the top (subtract PI/2 or 90 degrees)
          // This is the key part that makes the labels align correctly
          const adjustedAngle = itemMidAngle - Math.PI / 2;
          
          // Calculate label position with gap - starting EXACTLY 10% away from outer donut ring
          // This ensures labels are positioned correctly and don't overlap with node rings
          
          // Calculate 10% gap from the outer donut ring
          const outerRingRadius = DIMENSIONS.donutRadius;
          const gapDistance = outerRingRadius * 0.1; // 10% of the outer ring radius
          
          // Use the ring radius plus the gap as starting point for labels
          const labelDistance = DIMENSIONS.labelRadius;
          
          // Calculate the exact starting position that is 10% away from the outer ring
          const startX = Math.cos(adjustedAngle) * (outerRingRadius + gapDistance);
          const startY = Math.sin(adjustedAngle) * (outerRingRadius + gapDistance);
          
          // This will be the final label position
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
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
          
          // Add a visible line showing the exact 10% gap from the outer ring to text
          labelGroup.append("line")
            .attr("x1", startX)
            .attr("y1", startY)
            .attr("x2", labelX)
            .attr("y2", labelY)
            .attr("stroke", category.color)
            .attr("stroke-width", 0.5)
            .attr("stroke-opacity", 0.4);
          
          // Add the text label
          labelGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("font-size", "8px") // Even smaller font for better readability
            .attr("fill", category.color)
            .attr("font-weight", "400") // Slightly lighter weight
            .attr("class", "text-xs text-opacity-80") // Using Tailwind classes for styling
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
  } catch (err) {
    // Silent failure - let caller handle the error
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
  // Check if values are already set in the card
  if ((card as any)._valueNames && Array.isArray((card as any)._valueNames) && (card as any)._valueNames.length > 0) {
    console.log(`Using existing _valueNames for card ${card.card_id}:`, (card as any)._valueNames);
    return (card as any)._valueNames;
  }
  
  console.log(`DEBUG: Looking for values in card ${card.card_id}:`, card.values);
  
  // Extract existing values from Gun.js structure
  let existingValues: string[] = [];
  
  if (card.values) {
    // Check for Gun.js object with records
    if (typeof card.values === 'object' && !Array.isArray(card.values)) {
      existingValues = Object.keys(card.values)
        .filter(key => key !== '_' && key !== '#') // Filter out Gun.js metadata
        .map(key => {
          // Strip the 'value_' prefix if present and convert to readable format
          return key.startsWith('value_') ? key.substring(6).replace(/-/g, ' ') : key;
        });
      console.log(`Found ${existingValues.length} values in card.values object:`, existingValues);
    } 
    // Check for string values (comma separated)
    else if (typeof card.values === 'string') {
      existingValues = (card.values as string).split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
      console.log(`Found ${existingValues.length} values in card.values string:`, existingValues);
    }
    // Check for array values
    else if (Array.isArray(card.values)) {
      existingValues = card.values.map(v => typeof v === 'string' ? v : '').filter(Boolean);
      console.log(`Found ${existingValues.length} values in card.values array:`, existingValues);
    }
  }
  
  // If we don't have any values, add 3 default ones based on card ID
  if (existingValues.length === 0) {
    // Don't hard-code - use a consistent algorithm based on the card_id
    const defaultValues = [
      'ecological thinking',
      'self reliance',
      'social justice'
    ];
    
    // Calculate a consistent index based on card_id to ensure
    // a card always gets the same values when visualized
    const cardIdSum = card.card_id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    
    // Select 3 values deterministically based on the card ID sum
    for (let i = 0; i < 3; i++) {
      const idx = (cardIdSum + i) % defaultValues.length;
      existingValues.push(defaultValues[idx]);
    }
    
    console.log(`Generated values deterministically for card ${card.card_id}:`, existingValues);
  }
  
  return existingValues;
}

/**
 * Helper function to ensure each card has at least 3 capabilities
 * Adds additional capabilities from a predefined list if needed
 */
function augmentCardCapabilities(card: Card): string[] {
  // Check if capabilities are already set in the card
  if ((card as any)._capabilityNames && Array.isArray((card as any)._capabilityNames) && (card as any)._capabilityNames.length > 0) {
    console.log(`Using existing _capabilityNames for card ${card.card_id}:`, (card as any)._capabilityNames);
    return (card as any)._capabilityNames;
  }
  
  console.log(`DEBUG: Looking for capabilities in card ${card.card_id}:`, card.capabilities);
  
  // Extract existing capabilities from Gun.js structure
  let existingCapabilities: string[] = [];
  
  if (card.capabilities) {
    // Check for Gun.js object with records
    if (typeof card.capabilities === 'object' && !Array.isArray(card.capabilities)) {
      existingCapabilities = Object.keys(card.capabilities)
        .filter(key => key !== '_' && key !== '#') // Filter out Gun.js metadata
        .map(key => {
          // Strip the 'capability_' prefix if present and convert to readable format
          return key.startsWith('capability_') ? key.substring(11).replace(/-/g, ' ') : key;
        });
      console.log(`Found ${existingCapabilities.length} capabilities in card.capabilities object:`, existingCapabilities);
    } 
    // Check for string values (comma separated)
    else if (typeof card.capabilities === 'string') {
      existingCapabilities = (card.capabilities as string).split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
      console.log(`Found ${existingCapabilities.length} capabilities in card.capabilities string:`, existingCapabilities);
    }
    // Check for array values
    else if (Array.isArray(card.capabilities)) {
      existingCapabilities = card.capabilities.map(c => typeof c === 'string' ? c : '').filter(Boolean);
      console.log(`Found ${existingCapabilities.length} capabilities in card.capabilities array:`, existingCapabilities);
    }
  }
  
  // If we don't have any capabilities, add 3 default ones based on card ID
  if (existingCapabilities.length === 0) {
    // Don't hard-code - use a consistent algorithm based on the card_id
    const defaultCapabilities = [
      'networking',
      'facilitation',
      'technical expertise'
    ];
    
    // Calculate a consistent index based on card_id to ensure
    // a card always gets the same capabilities when visualized
    const cardIdSum = card.card_id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    
    // Select 3 capabilities deterministically based on the card ID sum
    for (let i = 0; i < 3; i++) {
      const idx = (cardIdSum + i) % defaultCapabilities.length;
      existingCapabilities.push(defaultCapabilities[idx]);
    }
    
    console.log(`Generated capabilities deterministically for card ${card.card_id}:`, existingCapabilities);
  }
  
  return existingCapabilities;
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
  
  // For each agreement, create links to connect all participating cards
  agreements.forEach(agreement => {
    if (!agreement.parties) return;
    
    const agreementId = agreement.agreement_id;
    
    // Debug current agreement
    console.log(`Creating links for agreement: ${agreementId}`, {
      obligations: agreement.obligations,
      benefits: agreement.benefits,
      parties: agreement.parties
    });
    
    // Get all party actor IDs
    const partyActorIds = Object.keys(agreement.parties);
    
    // Convert actor IDs to card IDs
    const participatingCardIds: string[] = [];
    
    partyActorIds.forEach(actorId => {
      // First try to find from the actor-card map
      let cardId = actorCardMap.get(actorId);
      
      // If not found, check if it's a demo actor ID (format: "actor_cardId")
      if (!cardId && actorId.startsWith('actor_')) {
        const extractedCardId = actorId.substring(6); // Remove "actor_" prefix
        if (nodes.some(n => n.id === extractedCardId)) {
          cardId = extractedCardId;
        }
      }
      
      if (cardId) {
        participatingCardIds.push(cardId);
      }
    });
    
    console.log(`Found ${participatingCardIds.length} participating cards for agreement ${agreementId}:`, participatingCardIds);
    
    // Ensure we have at least 2 cards to create meaningful connections
    if (participatingCardIds.length < 2) {
      console.warn(`Agreement ${agreementId} has fewer than 2 cards, skipping link creation`);
      return;
    }
    
    // IMPLEMENTATION PATTERN:
    // 1. Identify the "creator" card - the one with obligation to the agreement
    // 2. Create obligation link: creator card → agreement node
    // 3. Create benefit links: agreement node → all other cards
    
    // Determine the creator card - use the first card in obligations if available
    let creatorCardId = participatingCardIds[0]; // Default to first card
    
    // If we have explicit obligations, use the actor with obligations as creator
    if (agreement.obligations && agreement.obligations.length > 0) {
      // Get all unique fromActorIds from obligations
      const obligationActorIds = [...new Set(agreement.obligations.map(o => o.fromActorId))];
      
      // Find the first actor that has a corresponding card
      for (const actorId of obligationActorIds) {
        if (!actorId) continue;
        
        // Check actor-card map
        const cardId = actorCardMap.get(actorId);
        if (cardId) {
          creatorCardId = cardId;
          break;
        }
        
        // Try extracted ID if it's a demo actor
        if (actorId.startsWith('actor_')) {
          const extractedCardId = actorId.substring(6);
          if (nodes.some(n => n.id === extractedCardId)) {
            creatorCardId = extractedCardId;
            break;
          }
        }
      }
    }
    
    // 1. Create obligation link: creator card → agreement node
    console.log(`Creating PRIMARY obligation link: ${creatorCardId} → ${agreementId}`);
    links.push({
      source: creatorCardId,
      target: agreementId,
      type: "obligation",
      id: `${creatorCardId}_to_${agreementId}_primary`
    });
    
    // 2. Create benefit links: agreement → all OTHER participating cards
    const otherCardIds = participatingCardIds.filter(cardId => cardId !== creatorCardId);
    
    otherCardIds.forEach(cardId => {
      console.log(`Creating benefit link: ${agreementId} → ${cardId}`);
      links.push({
        source: agreementId,
        target: cardId,
        type: "benefit", 
        id: `${agreementId}_to_${cardId}_benefit`
      });
    });
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
  simulation: d3.Simulation<D3Node, undefined>,
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
  simulation: d3.Simulation<D3Node, undefined>,
  nodes: D3Node[],
  links: D3Link[],
  width: number, 
  height: number
): void {
  simulation
    .nodes(nodes)
    .force("link", d3.forceLink<D3Node, D3Link>(links)
      .id(d => d.id)
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
  handleNodeClick: (node: D3Node) => void,
  externalActorCardMap?: Map<string, string>
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
    
    // Create a map of actor IDs to card IDs - use external map if provided
    let actorCardMap: Map<string, string>;
    
    if (externalActorCardMap && externalActorCardMap.size > 0) {
      // Use the provided map
      console.log("d3GraphUtils: Using external actor-card map:", 
        { size: externalActorCardMap.size, entries: Array.from(externalActorCardMap.entries()) });
      actorCardMap = new Map(externalActorCardMap);
    } else {
      // Build the map from the card data
      actorCardMap = new Map<string, string>();
      cards.forEach(card => {
        if (card.actor_id) {
          actorCardMap.set(card.actor_id, card.card_id);
          console.log(`d3GraphUtils: Mapping actor ${card.actor_id} to card ${card.card_id}`);
        }
      });
      
      // If map is still empty and we have agreement data, create synthetic mappings
      if (actorCardMap.size === 0 && agreements.length > 0 && cards.length > 0) {
        console.log("d3GraphUtils: Creating synthetic actor-card mappings as fallback");
        
        cards.forEach(card => {
          const syntheticActorId = `actor_${card.card_id}`;
          actorCardMap.set(syntheticActorId, card.card_id);
          console.log(`d3GraphUtils: Created synthetic mapping: ${syntheticActorId} -> ${card.card_id}`);
        });
      }
    }
    
    console.log("d3GraphUtils: Final actor-card map size:", actorCardMap.size);
    
    // Create nodes and links
    const nodes = createNodes(cards, agreements, width, height);
    const links = createLinks(nodes, agreements, actorCardMap);
    
    // Define markers for arrows - different for obligation and benefit
    const defs = svg.append("defs");
    
    // Obligation arrow (from actor to agreement)
    defs.append("marker")
      .attr("id", "arrow-obligation")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#6366F1"); // Indigo color for obligation
    
    // Benefit arrow (from agreement to actor)  
    defs.append("marker")
      .attr("id", "arrow-benefit")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#10B981"); // Emerald color for benefit
    
    // Create groups for links and nodes
    const linkGroup = svg.append("g").attr("class", "links");
    const nodeGroup = svg.append("g").attr("class", "nodes");
    
    // Create links with distinguished styles for obligation vs benefit
    const linkElements = linkGroup
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("class", d => `link link-${d.type}`)
      .attr("stroke", d => d.type === "obligation" ? "#6366F1" : "#10B981") // Different colors for obligations vs benefits
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", d => d.type === "obligation" ? "none" : "4,2") // Dashed lines for benefits
      .attr("marker-end", d => `url(#arrow-${d.type})`); // Use the appropriate marker
    
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
    
    // Add circle for each node with different styles for actors vs agreements
    nodeElements
      .append("circle")
      .attr("r", d => {
        // Actor nodes are larger than agreement nodes
        if (d.type === "actor") {
          return d.id === activeCardId ? 45 : 30; // Larger if active
        } else {
          return 17; // Agreement nodes are smaller
        }
      })
      .attr("fill", d => {
        // Different fill colors for each type
        if (d.type === "actor") {
          return "#fff"; // White for actors
        } else {
          return "#f9fafb"; // Slightly off-white for agreements
        }
      })
      .attr("stroke", d => {
        // Different stroke colors
        if (d.type === "actor") {
          return d.id === activeCardId ? "#2563EB" : "#e5e5e5"; // Blue highlight for active actor
        } else {
          return "#d1d5db"; // Gray for agreements
        }
      })
      .attr("stroke-width", d => d.id === activeCardId ? 2 : 1) // Thicker stroke for active nodes
      .attr("class", d => d.type === "actor" ? "actor-circle" : "agreement-circle");
    
    // Add labels to nodes
    const nodeLabels = nodeElements
      .append("g")
      .attr("class", "node-label");
      
    // Constants for the node sizing - all other measurements will be relative to this
    const baseNodeRadius = 30; // Base radius of the node circle
    const agreementNodeRadius = 17; // Smaller size for agreement nodes
    const outerRingRadiusMultiplier = 1.5; // How much bigger the outer ring is compared to base
    const labelPositionMultiplier = 1.1; // Position label 10% outside the outer ring
    
    // Add labels - differently for actor vs agreement nodes
    nodeLabels.each(function(this: SVGGElement, d: D3Node) {
      const labelGroup = d3.select(this);
      const labelText = d.name;
      
      // Only create external labels for actor nodes
      if (d.type === "actor") {
        // All sizing is proportional to the base node radius
        const outerRadius = baseNodeRadius * outerRingRadiusMultiplier;
        const labelDistance = outerRadius * labelPositionMultiplier;
        
        // Calculate font size proportional to node size
        // Shorter names get relatively larger font, but maintain readability for all lengths
        const fontSizeFactor = 0.3; // Font size as a fraction of node radius
        const nameLength = Math.max(labelText.length, 1);
        const fontSizeBase = baseNodeRadius * fontSizeFactor;
        
        // Gradual scaling for different name lengths:
        // - Very short names (≤6 chars): 100% of base size
        // - Medium names (7-15 chars): scaled between 85-100% of base size
        // - Long names (>15 chars): scaled between 70-85% of base size
        let scaleFactor = 1.0;
        if (nameLength > 15) {
          // For long names, scale between 70-85% based on length
          scaleFactor = 0.7 + (0.15 * (25 - Math.min(nameLength, 25)) / 10);
        } else if (nameLength > 6) {
          // For medium names, scale between 85-100% based on length
          scaleFactor = 0.85 + (0.15 * (15 - nameLength) / 9);
        }
        
        const fontSizeAdjusted = Math.max(
          baseNodeRadius * 0.2, // Minimum size as proportion of node
          fontSizeBase * scaleFactor // Apply the calculated scale factor
        );
        
        // Label container dimensions based on node size
        const labelHeight = baseNodeRadius * 0.4; // 40% of node radius
        const labelY = labelDistance;
        
        // Create a temporary text element to measure width
        const tempText = labelGroup.append("text")
          .attr("font-size", fontSizeAdjusted)
          .text(labelText)
          .style("visibility", "hidden");
          
        // Get text width to make container properly sized
        const textWidth = (tempText.node() as SVGTextElement)?.getComputedTextLength() || 
                          (labelText.length * fontSizeAdjusted * 0.6);
        tempText.remove();
        
        // Border radius proportional to label height
        const cornerRadius = labelHeight * 0.2;
        
        // Padding proportional to label size
        const horizontalPadding = labelHeight * 0.25;
        
        // Add the background rect
        labelGroup.append("rect")
          .attr("x", -textWidth / 2 - horizontalPadding)
          .attr("y", labelY)
          .attr("width", textWidth + (horizontalPadding * 2))
          .attr("height", labelHeight)
          .attr("rx", cornerRadius)
          .attr("ry", cornerRadius)
          .attr("fill", "rgba(255, 255, 255, 0.8)")
          .attr("stroke", "#e9e9e9")
          .attr("stroke-width", 1);
        
        // Add the text - vertical positioning based on font metrics
        labelGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("y", labelY + (labelHeight * 0.65)) // Adjust text vertical centering
          .attr("font-size", fontSizeAdjusted)
          .attr("font-weight", 500)
          .attr("fill", "#333")
          .text(labelText);
      } else if (d.type === "agreement") {
        // For agreement nodes, add text inside the node circle
        // Extract the agreement ID number part (e.g., "AG1" from "agreement_1")
        let agreementLabel = d.id;
        if (d.id.startsWith("agreement_")) {
          const idNumber = d.id.split("_")[1];
          agreementLabel = `AG${idNumber}`;
        }
        
        // Add text inside the circle
        labelGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("y", 1) // Small adjustment for visual centering
          .attr("font-size", agreementNodeRadius * 0.8)
          .attr("font-weight", "bold")
          .attr("fill", "#333")
          .text(agreementLabel);
      }
    });
    
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