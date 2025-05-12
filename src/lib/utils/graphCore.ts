import * as d3 from 'd3';
import type { CardWithPosition, AgreementWithPosition, D3Node, D3Link } from '$lib/types';
import { AgreementStatus } from '$lib/types';

// ─── Globals to hold the live simulation & data ────────────────────────────
let simulationGlobal: d3.Simulation<D3Node, undefined>;
let nodesGlobal: D3Node[] = [];
let linksGlobal: D3Link[] = [];

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
    // benefit link
    links.push({
      source: cardIds[0],
      target: agreementId,
      type: 'benefit',
      id: `${cardIds[0]}_to_${agreementId}_benefit`,
      angle: 0
    });
    // obligation links
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
  // Zoom
  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on('zoom', (event) => {
      nodeGroup.attr('transform', event.transform.toString());
      linkGroup.attr('transform', event.transform.toString());
    });
  svg.call(zoomBehavior);

  // Drag
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

  // Click on main circle
  nodeG.selectAll<SVGCircleElement, D3Node>('circle.main-circle')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation(); event.preventDefault();
      delete d.fx; delete d.fy;
      simulation.alpha(1).restart();
      handleNodeClick(d);
    });

  // Click on agreement groups
  nodeG.filter((d) => d.type === 'agreement')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation(); event.preventDefault();
      handleNodeClick(d);
    });
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
  const angleForce = () => {
    links.forEach((link) => {
      const source = typeof link.source === 'string'
        ? nodes.find(n => n.id === link.source)
        : link.source;
      const target = typeof link.target === 'string'
        ? nodes.find(n => n.id === link.target)
        : link.target;
      if (!source || !target || link.angle === undefined) return;

      const agreementNode = source.type === 'agreement' ? source : target;
      const cardNode      = source.type === 'agreement' ? target : source;
      if (!agreementNode || !cardNode) return;

      const desiredDistance = 100;
      const dx = Math.cos(link.angle) * desiredDistance;
      const dy = Math.sin(link.angle) * desiredDistance;
      cardNode.vx = (cardNode.vx || 0) + (agreementNode.x! + dx - cardNode.x!) * 0.05;
      cardNode.vy = (cardNode.vy || 0) + (agreementNode.y! + dy - cardNode.y!) * 0.05;
    });
  };

  simulation
    .nodes(nodes)
    .force('link', d3.forceLink<D3Node, D3Link>(links)
      .id((d) => d.id)
      .distance(100)
      .strength(1))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width/2, height/2))
    .force('collide', d3.forceCollide<D3Node>()
      .radius(d => d.type==='actor' ? 50 : 20).strength(1))
    .force('angle', angleForce)
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
  color: string
) {
  // 1) Unique new ID
  const subId = `sub_${parentId}_${itemName}`;

  // 2) Avoid duplicates: if already exists, remove and restart
  if (nodesGlobal.find(n => n.id === subId)) {
    // remove from arrays
    nodesGlobal = nodesGlobal.filter(n => n.id !== subId);
    linksGlobal = linksGlobal.filter(l => l.source !== subId && l.target !== subId);
    // rebind & restart
    simulationGlobal.nodes(nodesGlobal);
    (simulationGlobal.force('link') as d3.ForceLink<D3Node, D3Link>).links(linksGlobal);
    simulationGlobal.alpha(1).restart();
    return;
  }

  // 3) Find parent’s current position
  const parent = nodesGlobal.find(n => n.id === parentId);
  if (!parent || parent.x === undefined || parent.y === undefined) return;

  // 4) Create new subnode out on the same radius
  const innerR = 50; // or match your DIMENSIONS.subWedgeRadius * 1.1
  const x0 = parent.x + Math.cos(angle) * innerR;
  const y0 = parent.y + Math.sin(angle) * innerR;

  const newNode: D3Node = {
    id:   subId,
    name: itemName,
    type: 'subnode',
    data: null,
    x:    x0,
    y:    y0
  };
  nodesGlobal.push(newNode);

  // 5) Link parent → subnode
  linksGlobal.push({
    source: parentId,
    target: subId,
    type:   'subnode',
    id:     `${parentId}_to_${subId}`,
    angle
  });

  // 6) Link subnode → every other actor sharing itemName
  nodesGlobal
    .filter(n => n.type==='actor')
    .forEach(n => {
      const arr = (n.data as CardWithPosition)[
        /* adapt per category: values vs capabilities */
        '_valueNames' // or '_capabilityNames'
      ] as string[]|undefined;
      if (arr?.includes(itemName)) {
        linksGlobal.push({
          source: subId,
          target: n.id,
          type: 'subnode',
          id:   `${subId}_to_${n.id}`,
          angle: 0
        });
      }
    });

  // 7) Re-bind simulation & restart
  simulationGlobal.nodes(nodesGlobal);
  (simulationGlobal.force('link') as d3.ForceLink<D3Node, D3Link>).links(linksGlobal);
  simulationGlobal.alpha(1).restart();
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
      : new Map(cards.map(c => [c.actor_id!, c.card_id] as [string,string]));

    const nodes = createNodes(cards, agreements, width, height);
    const links = createLinks(nodes, agreements, actorCardMap);

    // Save into globals for later spawn calls
    nodesGlobal = nodes;
    linksGlobal = links;

    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id','arrow-benefit').attr('viewBox','0 -5 10 10')
      .attr('refX',15).attr('refY',0).attr('orient','auto')
      .attr('markerWidth',6).attr('markerHeight',6)
      .append('path').attr('d','M0,-5L10,0L0,5')
      .attr('fill','var(--color-emerald-500-400)');
    defs.append('marker')
      .attr('id','arrow-obligation').attr('viewBox','0 -5 10 10')
      .attr('refX',15).attr('refY',0).attr('orient','auto')
      .attr('markerWidth',6).attr('markerHeight',6)
      .append('path').attr('d','M0,-5L10,0L0,5')
      .attr('fill','var(--color-indigo-600-400)');

    const linkGroup = svg.append('g').attr('class','links');
    const nodeGroup = svg.append('g').attr('class','nodes');

    const linkElements = linkGroup.selectAll('line')
      .data(links).enter().append('line')
      .attr('class', d => `link link-${d.type}`)
      .attr('stroke', d => d.type==='benefit'
        ? 'var(--color-emerald-500-400)' : 'var(--color-indigo-600-400)')
      .attr('stroke-width',1.5)
      .attr('stroke-opacity',0.7)
      .attr('stroke-dasharray', d => d.type==='benefit' ? '4,2' : 'none')
      .attr('marker-end', d => `url(#arrow-${d.type})`);

    const nodeElements = nodeGroup.selectAll('.node')
      .data(nodes).enter().append('g')
      .attr('class', d => `node node-${d.type} ${d.id===activeCardId?'active':''}`)
      .attr('id',   d => `node-${d.id}`)
      .style('pointer-events','all')
      .on('mousedown.zoom', null);

    // Create actor nodes with inner circle and click handler
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

    // Create agreement nodes with inner circle and click handler
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

    // Add status ring for agreement nodes (non-interactive)
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
// Build the simulation
const fx = d3.forceX<D3Node>(d => d.x!).strength(0);
const fy = d3.forceY<D3Node>(d => d.y!).strength(0);

const simulation = d3.forceSimulation<D3Node>(nodes)
  .force('link', d3.forceLink<D3Node,D3Link>(links)
    .id(d => d.id).distance(100).strength(1))
  .force('charge', d3.forceManyBody().strength(-200))
  .force('center', d3.forceCenter(width/2, height/2))
  .force('collide', d3.forceCollide<D3Node>()
    .radius(d => d.type==='actor'?50:20).strength(1))
  .force('angle', () => { /* your angleForce… */ })
  .force('x', fx)
  .force('y', fy)
  .alpha(1)
  .on('tick', () => {
    linkElements
      .attr('x1', d => (d.source as D3Node).x!)
      .attr('y1', d => (d.source as D3Node).y!)
      .attr('x2', d => (d.target as D3Node).x!)
      .attr('y2', d => (d.target as D3Node).y!);
    nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
  });

// save simulation into global
simulationGlobal = simulation;

setupInteractions(svg, nodeGroup, linkGroup, simulation, width, height, handleNodeClick);

// gently warm up
d3.timer((elapsed) => {
  const k = Math.min(0.1, elapsed/2000);
  fx.strength(k);
  fy.strength(k);
  simulation.alpha(1).restart();
  return k<0.1;
});

updateForces(simulation, nodes, links, width, height);
return { simulation, nodeElements, linkElements };
} catch (err) {
console.error('Error initializing D3 graph:', err);
throw err;
}
}