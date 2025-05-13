import * as d3 from 'd3';
import type { CardWithPosition, AgreementWithPosition, D3Node, D3Link } from '$lib/types';
import { AgreementStatus } from '$lib/types';

// ─── Globals to hold the live simulation & data ────────────────────────────
let simulationGlobal: d3.Simulation<D3Node, undefined>;
let nodesGlobal: D3Node[] = [];
let linksGlobal: D3Link[] = [];
let nodeGroupGlobal: d3.Selection<SVGGElement, unknown, null, undefined>;
let linkGroupGlobal: d3.Selection<SVGGElement, unknown, null, undefined>;

/**
 * Creates D3 nodes from cards and agreements
 */
export function createNodes(
  cards: CardWithPosition[],
  agreements: AgreementWithPosition[],
  width: number,
  height: number
): D3Node[] {
  const cardNodes: D3Node[] = cards.map((card) => ({
    id: card.card_id,
    name: card.role_title || 'Unknown Card',
    type: 'actor',
    data: card,
    x: card.position?.x ?? Math.random() * width,
    y: card.position?.y ?? Math.random() * height
  }));
  const agreementNodes: D3Node[] = agreements.map((agreement) => ({
    id: agreement.agreement_id,
    name: agreement.title || 'Unknown Agreement',
    type: 'agreement',
    data: agreement,
    x: agreement.position?.x ?? Math.random() * width,
    y: agreement.position?.y ?? Math.random() * height
  }));
  return [...cardNodes, ...agreementNodes];
}

/**
 * Creates D3 links between nodes based on agreement relationships
 */
export function createLinks(
  nodes: D3Node[],
  agreements: AgreementWithPosition[],
  actorCardMap: Map<string, string>
): D3Link[] {
  const links: D3Link[] = [];
  agreements.forEach((agreement) => {
    const items = agreement.partyItems ?? [];
    if (items.length < 2) return;
    const agreementId = agreement.agreement_id;
    const cardIds = items
      .map((pi) => actorCardMap.get(pi.actorId))
      .filter((id): id is string => !!id);
    if (cardIds.length < 2) return;
    links.push({
      source: cardIds[0],
      target: agreementId,
      type: 'benefit',
      id: `${cardIds[0]}_to_${agreementId}_benefit`,
      angle: 0
    });
    const others = cardIds.slice(1);
    const step = others.length > 1 ? (2 * Math.PI) / others.length : Math.PI;
    others.forEach((cid, i) => {
      links.push({
        source: agreementId,
        target: cid,
        type: 'obligation',
        id: `${agreementId}_to_${cid}_obligation`,
        angle: others.length > 1 ? step * i : Math.PI
      });
    });
  });
  return links;
}

/**
 * Sets up zoom & drag interactions
 */
export function setupInteractions(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  nodeGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  linkGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  simulation: d3.Simulation<D3Node, undefined>,
  width: number,
  height: number,
  handleNodeClick: (node: D3Node) => void
): void {
  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on('zoom', (event) => {
      nodeGroup.attr('transform', event.transform.toString());
      linkGroup.attr('transform', event.transform.toString());
    });
  svg.call(zoomBehavior);

  const nodeG = nodeGroup.selectAll<SVGGElement, D3Node>('.node')
    .on('mousedown.zoom', null);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const dragBehavior = d3.drag<SVGGElement, D3Node>()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d3.select(event.sourceEvent.target.parentElement).classed('fixed', true);
    })
    .on('drag', (event, d) => {
      d.fx = clamp(event.x, 0, width);
      d.fy = clamp(event.y, 0, height);
      simulation.alpha(1).restart();
    })
    .on('end', () => {
      simulation.alphaTarget(0);
    });
  nodeG.call(dragBehavior);

  nodeG.selectAll<SVGCircleElement, D3Node>('circle.main-circle')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation(); event.preventDefault();
      delete d.fx; delete d.fy;
      simulation.alpha(1).restart();
      handleNodeClick(d);
    });

  nodeG.filter((d) => d.type === 'agreement')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation(); event.preventDefault();
      handleNodeClick(d);
    });
}

/**
 * Defines the angle force for simulation
 */
function angleForce(links: D3Link[], nodes: D3Node[]) {
  return () => {
    links.forEach((link) => {
      const source = typeof link.source === 'string'
        ? nodes.find(n => n.id === link.source)
        : link.source;
      const target = typeof link.target === 'string'
        ? nodes.find(n => n.id === link.target)
        : link.target;
      if (!source || !target || link.angle === undefined) return;

      if (link.type === 'subnode') {
        const parentNode = source.type === 'subnode' ? target : source;
        const subNode = source.type === 'subnode' ? source : target;
        const desiredDistance = 150;
        const dx = Math.cos(link.angle) * desiredDistance;
        const dy = Math.sin(link.angle) * desiredDistance;
        subNode.vx = (subNode.vx || 0) + (parentNode.x! + dx - subNode.x!) * 0.3;
        subNode.vy = (subNode.vy || 0) + (parentNode.y! + dy - subNode.y!) * 0.3;
      } else if (link.type === 'obligation' || link.type === 'benefit') {
        const agreementNode = source.type === 'agreement' ? source : target;
        const cardNode = source.type === 'agreement' ? target : source;
        if (!agreementNode || !cardNode) return;
        const desiredDistance = 100;
        const dx = Math.cos(link.angle) * desiredDistance;
        const dy = Math.sin(link.angle) * desiredDistance;
        cardNode.vx = (cardNode.vx || 0) + (agreementNode.x! + dx - cardNode.x!) * 0.05;
        cardNode.vy = (cardNode.vy || 0) + (agreementNode.y! + dy - cardNode.y!) * 0.05;
      }
    });
  };
}

/**
 * Updates forces in the simulation based on current data
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
    .force('link', d3.forceLink<D3Node, D3Link>(links)
      .id((d) => d.id)
      .distance(100)
      .strength(1))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width/2, height/2))
    .force('collide', d3.forceCollide<D3Node>()
      .radius(d => d.type === 'actor' ? 50 : d.type === 'subnode' ? 20 : 20).strength(1))
    .force('angle', angleForce(links, nodes))
    .force('x', d3.forceX(width/2).strength(0.05))
    .force('y', d3.forceY(height/2).strength(0.05))
    .alpha(1)
    .restart();
}

/**
 * Spawn a new “subnode” into the existing simulation,
 * plus links from parent→subnode and subnode→other matching cards.
 */
export function spawnCategorySubnode(
  parentId: string,
  itemName: string,
  angle: number,
  color: string // Explicitly typed
) {
  console.group(`spawnCategorySubnode(${parentId}, ${itemName})`);
  console.log('→ args:', { parentId, itemName, angle, color });

  // 1) Unique new ID
  const subId = `sub_${parentId}_${itemName}`;
  console.log('computed subId:', subId);

  // 2) Avoid duplicates: if already exists, remove and restart
  if (nodesGlobal.find(n => n.id === subId)) {
    console.log('subnode already exists – removing it');
    nodesGlobal = nodesGlobal.filter(n => n.id !== subId);
    linksGlobal = linksGlobal.filter(l => l.source !== subId && l.target !== subId);
    console.log(' → new nodes count:', nodesGlobal.length);
    console.log(' → new links count:', linksGlobal.length);
    simulationGlobal.nodes(nodesGlobal);
    (simulationGlobal.force('link') as d3.ForceLink<D3Node, D3Link>).links(linksGlobal);
    simulationGlobal.alpha(1).restart();
    console.log('simulation restarted');

    // Update SVG elements after removal
    const linkSel = linkGroupGlobal
      .selectAll<SVGGElement, D3Link>('g.link-group')
      .data(linksGlobal, d => d.id!);
    linkSel.exit().remove();
    const linkEnter = linkSel.enter().append('g')
    .attr('class', 'link-group')
    .attr('id', d => `link-group-${d.id}`);
  linkEnter.append('line')
    .attr('class', d => `link link-${d.type}`)
    .attr('stroke', d => d.type === 'subnode' ? color : d.type === 'benefit' ? 'var(--color-emerald-500-400)' : 'var(--color-indigo-600-400)')
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.7)
    .attr('stroke-dasharray', d => d.type === 'benefit' ? '4,2' : 'none')
    .attr('id', d => `subline-${d.id}`)
    .attr('x1', d => {
      const sourceNode = typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source;
      if (d.type === 'subnode' && sourceNode.type === 'actor') {
        const offset = 40 * 1.1;
        const x1 = sourceNode.x! + Math.cos(d.angle!) * offset;
        console.log(`Link ${d.id} x1:`, { sourceX: sourceNode.x, angle: d.angle, offset, x1 });
        return x1;
      }
      return sourceNode.x!;
    })
      .attr('y1', d => {
        const sourceNode = typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source;
        if (d.type === 'subnode' && sourceNode.type === 'actor') {
          const offset = 40 * 1.1;
          const y1 = sourceNode.y! + Math.sin(d.angle!) * offset;
          console.log(`Link ${d.id} y1:`, { sourceY: sourceNode.y, angle: d.angle, offset, y1 });
          return y1;
        }
        return sourceNode.y!;
      })
      .attr('x2', d => {
        const targetNode = typeof d.target === 'string' ? nodesGlobal.find(n => n.id === d.target)! : d.target;
        if (d.type === 'subnode' && targetNode.type === 'subnode') {
          const dx = targetNode.x! - (typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source).x!;
          const dy = targetNode.y! - (typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source).y!;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const offset = 40 * 1.1;
          const x2 = targetNode.x! - (dx / dist) * offset;
          console.log(`Link ${d.id} x2:`, { targetX: targetNode.x, dx, dist, offset, x2 });
          return x2;
        }
        return targetNode.x!;
      })
      .attr('y2', d => {
        const targetNode = typeof d.target === 'string' ? nodesGlobal.find(n => n.id === d.target)! : d.target;
        if (d.type === 'subnode' && targetNode.type === 'subnode') {
          const dx = targetNode.x! - (typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source).x!;
          const dy = targetNode.y! - (typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source).y!;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const offset = 40 * 1.1;
          const y2 = targetNode.y! - (dy / dist) * offset;
          console.log(`Link ${d.id} y2:`, { targetY: targetNode.y, dy, dist, offset, y2 });
          return y2;
        }
        return targetNode.y!;
      });

    const nodeSel = nodeGroupGlobal
      .selectAll<SVGGElement, D3Node>('.node')
      .data(nodesGlobal, d => d.id);
    nodeSel.exit().remove();
    const nodeEnter = nodeSel.enter().append('g')
      .attr('class', d => `node node-${d.type}`)
      .attr('id', d => `node-${d.id}`)
      .style('pointer-events', 'all')
      .attr('transform', d => `translate(${d.x},${d.y})`);
    nodeEnter.filter(d => d.type === 'subnode')
      .append('circle')
      .attr('r', 8)
      .attr('fill', color)
      .attr('stroke', '#333')
      .append('title')
      .text(itemName);
    console.groupEnd();
    return;
  }

  // 3) Find parent’s current position
  const parent = nodesGlobal.find(n => n.id === parentId);
  if (!parent) {
    console.warn('❌ Parent node not found:', parentId);
    console.groupEnd();
    return;
  }
  if (parent.x === undefined || parent.y === undefined) {
    console.warn('❌ Parent has no coordinates yet:', parent);
    console.groupEnd();
    return;
  }
  console.log('parent position:', { x: parent.x, y: parent.y });

  // 4) Create new subnode farther out to accommodate label
  const labelDist = 40 * 1.2;
  const adjAngle = angle - Math.PI / 2;
  const deg = ((adjAngle * 180) / Math.PI + 360) % 360;
  const left = deg > 90 && deg < 270;
  const rotLab = left ? deg + 180 : deg;
  const innerR = 150;
  const lx = parent.x! + Math.cos(adjAngle) * innerR;
  const ly = parent.y! + Math.sin(adjAngle) * innerR;
  console.log('subnode position adjusted:', { lx, ly, adjAngle, deg, rotLab });

  const newNode: D3Node = {
    id: subId,
    name: itemName,
    type: 'subnode',
    data: null,
    x: lx,
    y: ly
  };
  nodesGlobal.push(newNode);
  console.log('pushed new node, total nodes:', nodesGlobal.length);

  // 5) Link parent → subnode
  linksGlobal.push({
    source: parentId,
    target: subId,
    type: 'subnode',
    id: `${parentId}_to_${subId}`,
    angle
  });

  // 6) Link subnode → every other actor sharing itemName
  const matchingActors: string[] = [];
  nodesGlobal
    .filter(n => n.type === 'actor' && n.id !== parentId)
    .forEach(actorNode => {
      const arr = (actorNode.data as CardWithPosition)._valueNames 
               || (actorNode.data as CardWithPosition)._capabilityNames 
               || [];
      if (arr.includes(itemName)) {
        matchingActors.push(actorNode.id);
      }
    });

  matchingActors.forEach((actorId, index) => {
    linksGlobal.push({
      source: subId,
      target: actorId,
      type: 'subnode',
      id: `${subId}_to_${actorId}_${index}`,
      angle
    });
  });
  console.log('pushed links for matching actors, total links:', linksGlobal.length);

  // 7) Define the marker for this subnode's color
  const svg = d3.select('svg.d3-graph');
  const markerId = `arrow-subnode-${color.replace('#', '')}`;
  if (!svg.select(`#${markerId}`).node()) {
    svg.select('defs')
      .append('marker')
      .attr('id', markerId)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', color);
  }

  // 8) Update SVG elements for new subnode and links
  const linkSel = linkGroupGlobal
    .selectAll<SVGGElement, D3Link>('g.link-group')
    .data(linksGlobal, d => d.id!);
  linkSel.exit().remove();
  const linkEnter = linkSel.enter().append('g')
  .attr('class', 'link-group')
  .attr('id', d => `link-group-${d.id}`);
const linkLine = linkEnter.append('line')
  .attr('class', d => `link link-${d.type}`)
  .attr('stroke', d => d.type === 'subnode' ? color : d.type === 'benefit' ? 'var(--color-emerald-500-400)' : 'var(--color-indigo-600-400)')
  .attr('stroke-width', 1.5)
  .attr('stroke-opacity', 0.7)
  .attr('stroke-dasharray', d => d.type === 'benefit' ? '4,2' : 'none')
    .attr('id', d => `subline-${d.id}`)
    .attr('x1', d => {
      const sourceNode = typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source;
      if (d.type === 'subnode' && sourceNode.type === 'actor') {
        const offset = 40 * 1.1;
        const x1 = sourceNode.x! + Math.cos(d.angle!) * offset;
        console.log(`Link ${d.id} x1:`, { sourceX: sourceNode.x, angle: d.angle, offset, x1 });
        return x1;
      }
      return sourceNode.x!;
    })
    .attr('y1', d => {
      const sourceNode = typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source;
      if (d.type === 'subnode' && sourceNode.type === 'actor') {
        const offset = 40 * 1.1;
        const y1 = sourceNode.y! + Math.sin(d.angle!) * offset;
        console.log(`Link ${d.id} y1:`, { sourceY: sourceNode.y, angle: d.angle, offset, y1 });
        return y1;
      }
      return sourceNode.y!;
    })
    .attr('x2', d => {
      const targetNode = typeof d.target === 'string' ? nodesGlobal.find(n => n.id === d.target)! : d.target;
      if (d.type === 'subnode' && targetNode.type === 'subnode') {
        const dx = targetNode.x! - (typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source).x!;
        const dy = targetNode.y! - (typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source).y!;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = 40 * 1.1;
        const x2 = targetNode.x! - (dx / dist) * offset;
        console.log(`Link ${d.id} x2:`, { targetX: targetNode.x, dx, dist, offset, x2 });
        return x2;
      }
      return targetNode.x!;
    })
    .attr('y2', d => {
      const targetNode = typeof d.target === 'string' ? nodesGlobal.find(n => n.id === d.target)! : d.target;
      if (d.type === 'subnode' && targetNode.type === 'subnode') {
        const dx = targetNode.x! - (typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source).x!;
        const dy = targetNode.y! - (typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source).y!;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = 40 * 1.1;
        const y2 = targetNode.y! - (dy / dist) * offset;
        console.log(`Link ${d.id} y2:`, { targetY: targetNode.y, dy, dist, offset, y2 });
        return y2;
      }
      return targetNode.y!;
    });

  // Add text along the parent-to-subnode link with rotation
  linkEnter.filter(d => d.id === `${parentId}_to_${subId}`)
    .append('text')
    .attr('dy', -5)
    .attr('transform', d => {
      const sourceNode = typeof d.source === 'string' ? nodesGlobal.find(n => n.id === d.source)! : d.source;
      const targetNode = typeof d.target === 'string' ? nodesGlobal.find(n => n.id === d.target)! : d.target;
      const midX = (sourceNode.x! + targetNode.x!) / 2;
      const midY = (sourceNode.y! + targetNode.y!) / 2;
      console.log(`Link text rotation for ${d.id}:`, { midX, midY, rotLab });
      return `rotate(${rotLab}, ${midX}, ${midY})`;
    })
    .append('textPath')
    .attr('xlink:href', d => `#${d.id}`)
    .attr('startOffset', '50%')
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .attr('fill', color)
    .text(itemName);

  const nodeSel = nodeGroupGlobal
    .selectAll<SVGGElement, D3Node>('.node')
    .data(nodesGlobal, d => d.id);
  nodeSel.exit().remove();
  const nodeEnter = nodeSel.enter().append('g')
    .attr('class', d => `node node-${d.type}`)
    .attr('id', d => `node-${d.id}`)
    .style('pointer-events', 'all')
    .attr('transform', d => `translate(${d.x},${d.y})`);
  nodeEnter.filter(d => d.type === 'subnode')
    .append('circle')
    .attr('r', 8)
    .attr('fill', color)
    .attr('stroke', '#333')
    .append('title')
    .text(itemName);

  // 9) Re-bind simulation & restart
  simulationGlobal.nodes(nodesGlobal);
  (simulationGlobal.force('link') as d3.ForceLink<D3Node, D3Link>).links(linksGlobal);
  simulationGlobal.alpha(1).restart();
  console.log('simulation restarted');
  console.groupEnd();
}

/**
 * Initializes the D3 graph with a sticky-force layout
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
  try {
    const svg = d3.select(svgElement);
    svg.selectAll('*').remove();

    const actorCardMap = externalActorCardMap && externalActorCardMap.size > 0
      ? new Map(externalActorCardMap)
      : new Map(cards.map(c => [c.actor_id!, c.card_id] as [string, string]));

    const nodes = createNodes(cards, agreements, width, height);
    const links = createLinks(nodes, agreements, actorCardMap);

    nodesGlobal = nodes;
    linksGlobal = links;

    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow-benefit')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--color-emerald-500-400)');
    defs.append('marker')
      .attr('id', 'arrow-obligation')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--color-indigo-600-400)');

    const linkGroup = svg.append('g').attr('class', 'links');
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    linkGroupGlobal = linkGroup;
    nodeGroupGlobal = nodeGroup;

    const linkElements = linkGroup.selectAll('g.link-group')
    .data(links)
    .enter()
    .append('g')
    .attr('class', 'link-group')
    .attr('id', d => `link-group-${d.id}`);
  linkElements.append('line')
    .attr('class', d => `link link-${d.type}`)
    .attr('stroke', d => d.type === 'benefit' ? 'var(--color-emerald-500-400)' : 'var(--color-indigo-600-400)')
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.7)
    .attr('stroke-dasharray', d => d.type === 'benefit' ? '4,2' : 'none')
    .attr('id', d => `link-line-${d.id}`);

    const nodeElements = nodeGroup.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', d => `node node-${d.type} ${d.id === activeCardId ? 'active' : ''}`)
      .attr('id', d => `node-${d.id}`)
      .style('pointer-events', 'all')
      .on('mousedown.zoom', null);

    const actorNodes = nodeElements.filter((d) => d.type === 'actor');
    actorNodes.append('circle')
      .attr('r', (d) => d.id === activeCardId ? 45 : 30)
      .attr('fill', '#fff')
      .attr('stroke', (d) => d.id === activeCardId ? 'var(--color-blue-600-400)' : '#e5e5e5')
      .attr('stroke-width', (d) => d.id === activeCardId ? 2 : 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        event.preventDefault();
        delete d.fx;
        delete d.fy;
        simulation.alpha(1).restart();
        handleNodeClick(d);
      });

    const agreementNodes = nodeElements.filter((d) => d.type === 'agreement');
    agreementNodes.append('circle')
      .attr('r', 12)
      .attr('fill', 'var(--color-surface-800-200)')
      .attr('stroke', 'var(--color-surface-900-100)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        event.preventDefault();
        delete d.fx;
        delete d.fy;
        simulation.alpha(1).restart();
        handleNodeClick(d);
      });

    agreementNodes.append('circle')
      .attr('r', 14)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        const agreement = d.data as AgreementWithPosition;
        switch (agreement.status) {
          case AgreementStatus.PROPOSED: return 'var(--color-warning-500)';
          case AgreementStatus.ACCEPTED: return 'var(--color-success-500)';
          case AgreementStatus.COMPLETED: return 'var(--color-primary-500)';
          case AgreementStatus.REJECTED: return 'var(--color-error-500)';
          default: return 'var(--color-surface-500)';
        }
      })
      .attr('stroke-width', 2)
      .style('pointer-events', 'none');

    const nodeLabels = nodeElements.append('g').attr('class', 'node-label');
    const baseR = 30, aggR = 12, outMult = 1.5, labelMult = 1.1;
    nodeLabels.each(function (d) {
      const g = d3.select(this), txt = d.name;
      if (d.type === 'actor') {
        const outer = baseR * outMult, dist = outer * labelMult;
        const fsBase = baseR * 0.3, len = Math.max(txt.length, 1);
        let sf = 1;
        if (len > 15) sf = 0.7 + (0.15 * (25 - Math.min(len, 25)) / 10);
        else if (len > 6) sf = 0.85 + (0.15 * (15 - len) / 9);
        const fs = Math.max(baseR * 0.2, fsBase * sf);
        const lh = baseR * 0.4, y = dist;
        const t = g.append('text').attr('font-size', fs).text(txt).style('visibility', 'hidden');
        const w = (t.node() as SVGTextElement).getComputedTextLength() || (len * fs * 0.6); t.remove();
        const cr = lh * 0.2, pad = lh * 0.25;
        g.append('rect').attr('x', -w / 2 - pad).attr('y', y)
          .attr('width', w + pad * 2).attr('height', lh)
          .attr('rx', cr).attr('ry', cr)
          .attr('fill', 'rgba(255,255,255,0.8)').attr('stroke', '#e9e9e9').attr('stroke-width', 1);
        g.append('text').attr('text-anchor', 'middle')
          .attr('y', y + lh * 0.65).attr('font-size', fs)
          .attr('font-weight', 500).attr('fill', '#333').text(txt);
      } else {
        let lab = d.id;
        if (d.id.startsWith('agreement_')) lab = `AG${d.id.split('_')[1]}`;
        g.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('y', 1).attr('font-size', aggR * 0.8)
          .attr('font-weight', 'bold').attr('fill', '#fff').text(lab);
      }
    });

    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links)
        .id(d => d.id).distance(100).strength(1))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width/2, height/2))
      .force('collide', d3.forceCollide<D3Node>()
        .radius(d => d.type === 'actor' ? 50 : d.type === 'subnode' ? 20 : 20).strength(1))
      .force('angle', angleForce(links, nodes))
      .force('x', d3.forceX<D3Node>(d => d.x!).strength(0))
      .force('y', d3.forceY<D3Node>(d => d.y!).strength(0))
      .alpha(1)
      .on('tick', () => {
        linkElements.select('line')
          .attr('x1', d => {
            const sourceNode = d.source as D3Node;
            if (d.type === 'subnode' && sourceNode.type === 'actor') {
              const offset = 40 * 1.1;
              const x1 = sourceNode.x! + Math.cos(d.angle!) * offset;
              console.log(`Tick Link ${d.id} x1:`, { sourceX: sourceNode.x, angle: d.angle, offset, x1 });
              return x1;
            }
            return sourceNode.x!;
          })
          .attr('y1', d => {
            const sourceNode = d.source as D3Node;
            if (d.type === 'subnode' && sourceNode.type === 'actor') {
              const offset = 40 * 1.1;
              const y1 = sourceNode.y! + Math.sin(d.angle!) * offset;
              console.log(`Tick Link ${d.id} y1:`, { sourceY: sourceNode.y, angle: d.angle, offset, y1 });
              return y1;
            }
            return sourceNode.y!;
          })
          .attr('x2', d => {
            const targetNode = d.target as D3Node;
            if (d.type === 'subnode' && targetNode.type === 'subnode') {
              const dx = targetNode.x! - (d.source as D3Node).x!;
              const dy = targetNode.y! - (d.source as D3Node).y!;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const offset = 40 * 1.1;
              const x2 = targetNode.x! - (dx / dist) * offset;
              console.log(`Tick Link ${d.id} x2:`, { targetX: targetNode.x, dx, dist, offset, x2 });
              return x2;
            }
            return targetNode.x!;
          })
          .attr('y2', d => {
            const targetNode = d.target as D3Node;
            if (d.type === 'subnode' && targetNode.type === 'subnode') {
              const dx = targetNode.x! - (d.source as D3Node).x!;
              const dy = targetNode.y! - (d.source as D3Node).y!;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const offset = 40 * 1.1;
              const y2 = targetNode.y! - (dy / dist) * offset;
              console.log(`Tick Link ${d.id} y2:`, { targetY: targetNode.y, dy, dist, offset, y2 });
              return y2;
            }
            return targetNode.y!;
          });
        nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    simulationGlobal = simulation;

    setupInteractions(svg, nodeGroup, linkGroup, simulation, width, height, handleNodeClick);

    d3.timer((elapsed) => {
      const k = Math.min(0.1, elapsed / 2000);
      simulation.force<d3.ForceX<D3Node>>('x')!.strength(k);
      simulation.force<d3.ForceY<D3Node>>('y')!.strength(k);
      simulation.alpha(1).restart();
      return k < 0.1;
    });

    updateForces(simulation, nodes, links, width, height);
    return { simulation, nodeElements, linkElements };
  } catch (err) {
    console.error('Error initializing D3 graph:', err);
    throw err;
  }
}