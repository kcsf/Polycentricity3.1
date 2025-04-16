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
      
      // Get card IDs from actor IDs
      const recipientCardId = actorCardMap.get(toActorId);
      
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
  const icon = iconName || 'default';
  
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