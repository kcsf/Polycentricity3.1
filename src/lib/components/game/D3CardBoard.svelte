<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import * as icons from 'svelte-lucide';
  import { debounce } from 'lodash-es';
  import gameStore from '$lib/stores/enhancedGameStore';
  import { getGun, nodes } from '$lib/services/gunService';
  import type { Card, Value, Capability, Actor, Agreement } from '$lib/types';
  import { getGame } from '$lib/services/gameService';
  import { userStore } from '$lib/stores/userStore';
  import { getCardValueNames, getCardCapabilityNames } from '$lib/services/deckService';
  import RoleCard from '$lib/components/RoleCard.svelte';

  // Props
  export let gameId: string;
  export let activeActorId: string | undefined = undefined;
  export let cards: Card[] = [];

  // Reactive state with runes
  let svgRef = $state<SVGSVGElement>();
  let searchTerm = $state('');
  let width = $state(800);
  let height = $state(600);
  let hoveredNode = $state<string | null>(null);
  let hoveredCategory = $state<string | null>(null);
  let nodeElements = $state<d3.Selection<any, D3Node, any, any>>();
  let cardsWithPosition = $state<CardWithPosition[]>([]);
  let agreements = $state<AgreementWithPosition[]>([]);
  let actors = $state<Actor[]>([]);
  let valueCache = $state<Map<string, Value>>(new Map());
  let capabilityCache = $state<Map<string, Capability>>(new Map());
  let actorCardMap = $state<Map<string, string>>(new Map());
  let activeCardId = $state<string | null>(null);
  let popoverOpen = $state(false);
  let popoverNode = $state<any>(null);
  let popoverNodeType = $state<'actor' | 'agreement'>('actor');
  let popoverPosition = $state({ x: 0, y: 0 });

  // Derived values
  let hasData = $derived(cardsWithPosition.length > 0);

  // Utility functions
  function handlePopoverClose() {
    popoverOpen = false;
    popoverNode = null;
  }

  function toPascalCase(str: string): string {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  function getCardIcon(iconName: string | undefined): any {
    if (!iconName) return icons.User;
    const pascalIconName = toPascalCase(iconName);
    // Dynamic lookup in svelte-lucide, with fallbacks
    return icons[pascalIconName as keyof typeof icons] || icons[iconName as keyof typeof icons] || icons.User;
  }

  // Interfaces
  interface D3Node {
    id: string;
    name: string;
    type: 'actor' | 'agreement';
    data: CardWithPosition | AgreementWithPosition;
    x: number;
    y: number;
    fx?: number | null;
    fy?: number | null;
    active?: boolean;
    _valueNames?: string[];
    _capabilityNames?: string[];
  }

  interface D3Link {
    source: string | D3Node;
    target: string | D3Node;
    type: 'obligation' | 'benefit';
    id: string;
  }

  interface CardWithPosition extends Card {
    position?: { x: number; y: number };
  }

  interface AgreementWithPosition {
    agreement_id: string;
    title: string;
    description?: string;
    status: string;
    created_at: number;
    parties?: Record<string, boolean>;
    terms?: string;
    position?: { x: number; y: number };
    obligations: { id: string; fromActorId: string; toActorId: string; description: string }[];
    benefits: { id: string; fromActorId: string; toActorId: string; description: string }[];
  }

  // Data loading
  async function loadGameData() {
    try {
      const gun = getGun();
      if (!gun) throw new Error('Gun not initialized');

      const game = await getGame(gameId);
      if (!game) throw new Error(`Game not found: ${gameId}`);

      let deckId = game.deck_id || (game.deck_type === 'eco-village' ? 'd1' : game.deck_type === 'community-garden' ? 'd2' : null);
      if (!deckId) throw new Error(`No deck found for game ${gameId}`);

      const cardPromises = new Promise<CardWithPosition[]>((resolve) => {
        const cards: CardWithPosition[] = [];
        gun.get(nodes.decks).get(deckId).get('cards').map().once((cardValue: any, cardKey: string) => {
          if (cardValue === true) {
            gun.get(nodes.cards).get(cardKey).once((cardData: Card) => {
              if (cardData?.card_id) {
                cards.push({
                  ...cardData,
                  position: { x: Math.random() * width, y: Math.random() * height }
                });
              }
            });
          }
        }).on(() => resolve(cards));
      });

      const actorPromises = new Promise<Actor[]>((resolve) => {
        const actors: Actor[] = [];
        gun.get(nodes.games).get(gameId).get('players').map().once((actorId: string, userId: string) => {
          gun.get(nodes.actors).get(actorId).once((actorData: Actor) => {
            if (actorData?.actor_id && actorData.card_id) {
              actors.push(actorData);
              actorCardMap = new Map(actorCardMap).set(actorData.actor_id, actorData.card_id);
            }
          });
        }).on(() => resolve(actors));
      });

      const agreementPromises = new Promise<AgreementWithPosition[]>((resolve) => {
        const agreements: AgreementWithPosition[] = [];
        gun.get(nodes.games).get(gameId).get('players').map().once((actorId: string) => {
          gun.get(nodes.actors).get(actorId).get('agreements').map().once((agreementId: string) => {
            gun.get(nodes.agreements).get(agreementId).once((agreementData: Agreement) => {
              if (agreementData?.agreement_id) {
                const agreement: AgreementWithPosition = {
                  ...agreementData,
                  position: { x: Math.random() * width, y: Math.random() * height },
                  obligations: Object.entries(agreementData.obligations || {}).map(([actorId, description]) => ({
                    id: `obligation_${agreementData.agreement_id}_${actorId}`,
                    fromActorId: actorId,
                    toActorId: Object.keys(agreementData.parties || {}).find(id => id !== actorId) || actorId,
                    description
                  })),
                  benefits: Object.entries(agreementData.benefits || {}).map(([actorId, description]) => ({
                    id: `benefit_${agreementData.agreement_id}_${actorId}`,
                    fromActorId: Object.keys(agreementData.parties || {}).find(id => id !== actorId) || actorId,
                    toActorId: actorId,
                    description
                  }))
                };
                agreements.push(agreement);
              }
            });
          });
        }).on(() => resolve(agreements));
      });

      const [loadedCards, loadedActors, loadedAgreements] = await Promise.all([cardPromises, actorPromises, agreementPromises]);
      if (loadedCards.length === 0) {
        console.warn('No cards loaded for game:', gameId);
        return;
      }
      cardsWithPosition = loadedCards;
      actors = loadedActors;
      agreements = loadedAgreements;
      await Promise.all(cardsWithPosition.map(loadCardDetails));
    } catch (error) {
      console.error('Error loading game data:', error);
    }
  }

  async function loadCardDetails(card: Card) {
    try {
      if (!card?.card_id) return;

      const [valueNames, capabilityNames] = await Promise.all([
        getCardValueNames(card),
        getCardCapabilityNames(card)
      ]);

      card.values = valueNames.reduce((acc, name) => {
        const key = `value_${name.toLowerCase().replace(/\s+/g, '-')}`;
        acc[key] = true;
        valueCache = new Map(valueCache).set(key, { value_id: key, name, description: `${name} for ${card.role_title}`, created_at: Date.now() });
        return acc;
      }, {} as Record<string, boolean>);

      card.capabilities = capabilityNames.reduce((acc, name) => {
        const key = `capability_${name.toLowerCase().replace(/\s+/g, '-')}`;
        acc[key] = true;
        capabilityCache = new Map(capabilityCache).set(key, { capability_id: key, name, description: `${name} for ${card.role_title}`, created_at: Date.now() });
        return acc;
      }, {} as Record<string, boolean>);

      if (nodeElements) {
        nodeElements.each(function (d: D3Node) {
          if (d.id === card.card_id) {
            d._valueNames = valueNames;
            d._capabilityNames = capabilityNames;
          }
        });
      }
    } catch (error) {
      console.error(`Error loading details for card ${card.card_id}:`, error);
    }
  }

  function setupRealTimeListeners() {
    const gun = getGun();
    if (!gun) return;
    // Placeholder for real-time updates
  }

  // D3 Visualization
  const categoryColors = d3.scaleOrdinal([
    '#A7C731', '#9BC23D', '#8FBC49', '#83B655', '#77B061',
    '#6BA96D', '#5FA279', '#539B85', '#479491', '#3B8D9D',
    '#2F86A9', '#237FB5'
  ]);

  function initializeGraph() {
    if (!svgRef) return;

    const boundingRect = svgRef.parentElement?.getBoundingClientRect();
    if (boundingRect) {
      width = boundingRect.width;
      height = boundingRect.height;
    }

    const svg = d3.select(svgRef);
    const root = document.documentElement;
    const cardNodeRadius = 35;
    const agreementNodeRadius = 17;
    const donutThickness = 15;

    root.style.setProperty('--actor-node-radius', `${cardNodeRadius}px`);
    root.style.setProperty('--agreement-node-radius', `${agreementNodeRadius}px`);
    root.style.setProperty('--donut-thickness', `${donutThickness}px`);

    const nodes: D3Node[] = [
      ...cardsWithPosition.map(card => ({
        id: card.card_id,
        name: card.role_title || 'Unnamed Card',
        type: 'actor' as const,
        data: card,
        x: card.position?.x || Math.random() * width,
        y: card.position?.y || Math.random() * height,
        fx: card.position?.x || null,
        fy: card.position?.y || null,
        active: card.card_id === activeCardId,
        _valueNames: card.values ? Object.keys(card.values).filter(k => k !== '_' && k !== '#') : [],
        _capabilityNames: card.capabilities ? Object.keys(card.capabilities).filter(k => k !== '_' && k !== '#') : []
      })),
      ...agreements.map(agreement => ({
        id: agreement.agreement_id,
        name: agreement.title || 'Unnamed Agreement',
        type: 'agreement' as const,
        data: agreement,
        x: agreement.position?.x || Math.random() * width,
        y: agreement.position?.y || Math.random() * height,
        fx: agreement.position?.x || null,
        fy: agreement.position?.y || null
      }))
    ];

    const links: D3Link[] = agreements.flatMap(agreement => {
      const partyActorIds = agreement.parties ? Object.keys(agreement.parties) : [];
      const participatingCardIds = partyActorIds
        .map(actorId => actorCardMap.get(actorId))
        .filter(Boolean) as string[];

      if (participatingCardIds.length < 2) return [];

      const result: D3Link[] = [];
      agreement.obligations.forEach(obligation => {
        const fromCardId = actorCardMap.get(obligation.fromActorId);
        const toCardId = actorCardMap.get(obligation.toActorId);
        if (fromCardId && toCardId) {
          result.push(
            { source: fromCardId, target: agreement.agreement_id, type: 'obligation', id: `from_${obligation.id}` },
            { source: agreement.agreement_id, target: toCardId, type: 'benefit', id: `to_${obligation.id}` }
          );
        }
      });
      agreement.benefits.forEach(benefit => {
        const fromCardId = actorCardMap.get(benefit.fromActorId);
        const toCardId = actorCardMap.get(benefit.toActorId);
        if (fromCardId && toCardId && !result.some(l => l.source === fromCardId && l.target === agreement.agreement_id)) {
          result.push(
            { source: fromCardId, target: agreement.agreement_id, type: 'obligation', id: `from_${benefit.id}` },
            { source: agreement.agreement_id, target: toCardId, type: 'benefit', id: `to_${benefit.id}` }
          );
        }
      });
      return result;
    });

    let linkGroup = svg.select('.links');
    if (linkGroup.empty()) linkGroup = svg.append('g').attr('class', 'links');

    let nodeGroup = svg.select('.nodes');
    if (nodeGroup.empty()) nodeGroup = svg.append('g').attr('class', 'nodes');

    if (svg.select('defs').empty()) {
      svg.append('defs')
        .append('marker')
        .attr('id', 'arrow-marker')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 4)
        .attr('markerHeight', 4)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', '#BBBBBB')
        .attr('d', 'M0,-5L10,0L0,5');
    }

    const linkElements = linkGroup
      .selectAll('line')
      .data(links, d => d.id)
      .join(
        enter => enter.append('line')
          .attr('class', 'link-line')
          .attr('stroke', '#e5e5e5')
          .attr('stroke-width', 1)
          .attr('stroke-opacity', 0.8)
          .attr('marker-end', 'url(#arrow-marker)')
          .style('cursor', 'pointer')
          .append('title')
          .text(d => {
            const sourceType = typeof d.source === 'string' ? nodes.find(n => n.id === d.source)?.type : d.source.type;
            const targetType = typeof d.target === 'string' ? nodes.find(n => n.id === d.target)?.type : d.target.type;
            return `${d.type} link: ${sourceType} → ${targetType}`;
          }).parent(),
        update => update,
        exit => exit.remove()
      );

    nodeElements = nodeGroup
      .selectAll('g')
      .data(nodes, d => d.id)
      .join(
        enter => enter.append('g')
          .attr('id', d => `node-${d.id}`)
          .attr('class', d => `node node-${d.type}${d.active ? ' active' : ''}`)
          .attr('transform', d => `translate(${d.x},${d.y})`)
          .call(d3.drag()
            .on('start', (event, d) => { d.fx = null; d.fy = null; })
            .on('drag', debounce((event, d) => {
              d.x = event.x;
              d.y = event.y;
              d3.select(event.sourceEvent.target.parentNode).attr('transform', `translate(${d.x},${d.y})`);
              updateLinks();
            }, 50))
            .on('end', (event, d) => {
              d3.select(`#node-${d.id}`).attr('transform', `translate(${d.x},${d.y})`);
              if (d.type === 'actor') (d.data as CardWithPosition).position = { x: d.x, y: d.y };
              else (d.data as AgreementWithPosition).position = { x: d.x, y: d.y };
            })
          )
          .on('mouseenter', (event, d) => { if (d.type === 'actor') activeCardId = d.id; })
          .on('mouseover', (event, d) => { if (d.type === 'actor') hoveredNode = d.id; })
          .on('mouseout', () => { hoveredNode = null; }),
        update => update
          .attr('class', d => `node node-${d.type}${d.active ? ' active' : ''}`)
          .attr('transform', d => `translate(${d.x},${d.y})`),
        exit => exit.remove()
      );

    const updateLinks = debounce(() => {
      nodes.forEach(node => {
        if (node.type === 'agreement' && (node.data as AgreementWithPosition).parties && Object.keys((node.data as AgreementWithPosition).parties).length === 2) {
          const partyCardIds = Object.keys((node.data as AgreementWithPosition).parties)
            .map(actorId => actorCardMap.get(actorId))
            .filter(Boolean) as string[];
          if (partyCardIds.length === 2) {
            const [card1, card2] = partyCardIds.map(id => nodes.find(n => n.id === id));
            if (card1 && card2) {
              node.x = (card1.x + card2.x) / 2;
              node.y = (card1.y + card2.y) / 2;
              d3.select(`#node-${node.id}`).attr('transform', `translate(${node.x},${node.y})`);
            }
          }
        }
      });

      linkElements.each(function (d) {
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));
        if (!sourceNode || !targetNode) return;

        const sourceRadius = sourceNode.type === 'actor' ? cardNodeRadius + donutThickness : agreementNodeRadius;
        const targetRadius = targetNode.type === 'actor' ? cardNodeRadius + donutThickness : agreementNodeRadius;
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const angle = Math.atan2(dy, dx);

        const sourceX = sourceNode.x + Math.cos(angle) * sourceRadius;
        const sourceY = sourceNode.y + Math.sin(angle) * sourceRadius;
        const targetX = targetNode.x - Math.cos(angle) * (targetRadius + 5);
        const targetY = targetNode.y - Math.sin(angle) * (targetRadius + 5);

        d3.select(this)
          .attr('x1', sourceX)
          .attr('y1', sourceY)
          .attr('x2', targetX)
          .attr('y2', targetY)
          .attr('stroke', d.type === 'benefit' ? '#4C9AFF' : '#FF5630')
          .attr('stroke-width', 1.5);
      });
    }, 50);

    function wrapText(text: d3.Selection<any, any, any, any>, width: number): void {
      text.each(function () {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        const lineHeight = 1.1;
        const y = text.attr('y');
        const dy = parseFloat(text.attr('dy') || '0');
        let line: string[] = [];
        let lineNumber = 0;
        let tspan = text
          .text(null)
          .append('tspan')
          .attr('x', 0)
          .attr('y', y)
          .attr('dy', dy + 'em');

        while (words.length) {
          const word = words.pop();
          if (!word) continue;
          line.push(word);
          tspan.text(line.join(' '));
          const tspanNode = tspan.node();
          if (tspanNode && tspanNode.getComputedTextLength() > width) {
            line.pop();
            tspan.text(line.join(' '));
            line = [word];
            tspan = text
              .append('tspan')
              .attr('x', 0)
              .attr('y', y)
              .attr('dy', ++lineNumber * lineHeight + dy + 'em')
              .text(word);
          }
        }
      });
    }

    function addDonutRings() {
      const cardNodes = nodeElements.filter(d => d.type === 'actor');
      const baseActorRadius = 35;
      const baseDonutThickness = 15;
      const categories = ['values', 'capabilities', 'intellectualProperty', 'resources', 'goals'];

      const formatCategoryName = (cat: string) => cat
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();

      cardNodes.each(function (nodeData) {
        const node = d3.select(this);
        const card = nodeData.data as Card;
        const nodeId = nodeData.id;
        const isActive = nodeId === activeCardId;
        const scaleFactor = isActive ? 1.5 : 1;
        const actorNodeRadius = baseActorRadius * scaleFactor;
        const donutThickness = baseDonutThickness * scaleFactor;
        const donorRadius = actorNodeRadius + donutThickness;
        const expandedRadius = donorRadius + 15 * scaleFactor;

        let donutRing = node.select('.donut-ring');
        if (donutRing.empty()) {
          donutRing = node.append('circle')
            .attr('class', `donut-ring${isActive ? ' active' : ''}`)
            .attr('r', donorRadius)
            .attr('fill', 'transparent')
            .attr('stroke', 'var(--border)')
            .attr('stroke-width', 1);
        } else {
          donutRing
            .attr('class', `donut-ring${isActive ? ' active' : ''}`)
            .attr('r', donorRadius);
        }

        const cardCategories = categories.filter(cat => Object.keys(card[cat] || {}).length > 0);
        if (!cardCategories.length) return;

        const categoryPie = d3.pie<string>().value(() => 1).sort(null);
        const categoryArc = d3.arc().innerRadius(actorNodeRadius).outerRadius(actorNodeRadius + donutThickness).cornerRadius(1).padAngle(0.02);
        const expandedArc = d3.arc().innerRadius(actorNodeRadius).outerRadius(expandedRadius).cornerRadius(3).padAngle(0.04);

        const categoryGroups = node
          .selectAll('.category-group')
          .data(categoryPie(cardCategories), d => d.data)
          .join(
            enter => enter.append('g').attr('class', 'category-group').attr('data-category', d => d.data),
            update => update,
            exit => exit.remove()
          );

        categoryGroups.each(function (d) {
          const group = d3.select(this);
          const category = d.data;
          const content = Object.keys(card[category] || {}).filter(k => k !== '_' && k !== '#');

          let wedge = group.select('.category-wedge');
          if (wedge.empty()) {
            wedge = group.append('path')
              .attr('class', 'category-wedge')
              .attr('fill', categoryColors(category))
              .attr('stroke', 'white')
              .attr('stroke-width', 1)
              .attr('filter', 'drop-shadow(0px 0px 1px rgba(0,0,0,0.2))')
              .style('cursor', 'pointer');
          }
          wedge.attr('d', categoryArc);

          if (!content.length) return;

          let subWedgesGroup = group.select('.sub-wedges');
          if (subWedgesGroup.empty()) {
            subWedgesGroup = group.append('g')
              .attr('class', 'sub-wedges')
              .style('visibility', 'hidden')
              .attr('opacity', 0);
          }

          let labelsContainer = group.select('.label-container');
          if (labelsContainer.empty()) {
            labelsContainer = group.append('g')
              .attr('class', 'label-container')
              .style('visibility', 'hidden')
              .attr('opacity', 0);
          }

          const subItemPie = d3.pie<string>().startAngle(d.startAngle).endAngle(d.endAngle).value(() => 1).sort(null);
          const subArc = d3.arc().innerRadius(actorNodeRadius).outerRadius(expandedRadius).cornerRadius(1).padAngle(0.01);

          subWedgesGroup
            .selectAll('.sub-wedge')
            .data(subItemPie(content), d => d.data)
            .join(
              enter => enter.append('path')
                .attr('class', 'sub-wedge')
                .attr('fill', categoryColors(category))
                .attr('stroke', 'white')
                .attr('stroke-width', 0.5)
                .attr('filter', 'drop-shadow(0px 0px 1px rgba(0,0,0,0.2))'),
              update => update,
              exit => exit.remove()
            )
            .attr('d', subArc);

          labelsContainer
            .selectAll('.item-label')
            .data(subItemPie(content), d => d.data)
            .join(
              enter => enter.append('text')
                .attr('class', 'item-label')
                .attr('font-size', '11px')
                .attr('fill', categoryColors(category))
                .attr('font-weight', '500'),
              update => update,
              exit => exit.remove()
            )
            .each(function (itemWedge) {
              const angle = (itemWedge.startAngle + itemWedge.endAngle) / 2 - Math.PI / 2;
              const labelDistance = expandedRadius * 1.15;
              const x = Math.cos(angle) * labelDistance;
              const y = Math.sin(angle) * labelDistance;
              const angleDeg = (angle * 180 / Math.PI) % 360;
              const textAnchor = angleDeg > 90 && angleDeg < 270 ? 'end' : 'start';
              const rotationDeg = angleDeg > 90 && angleDeg < 270 ? angleDeg + 180 : angleDeg;

              let itemName = itemWedge.data;
              if (category === 'values' && valueCache.has(itemName)) itemName = valueCache.get(itemName)!.name || itemName;
              else if (category === 'capabilities' && capabilityCache.has(itemName)) itemName = capabilityCache.get(itemName)!.name || itemName;
              else itemName = itemName.replace(/^value_|^capability_/, '').replace(/-/g, ' ');

              d3.select(this)
                .attr('x', x)
                .attr('y', y)
                .attr('text-anchor', textAnchor)
                .attr('transform', `rotate(${rotationDeg},${x},${y})`)
                .text(itemName);
            });

          const t = d3.transition().duration(150);
          wedge
            .on('mouseenter', function (event) {
              event.stopPropagation();
              d3.select(this).transition(t)
                .attr('d', expandedArc)
                .attr('filter', 'drop-shadow(0px 0px 3px rgba(0,0,0,0.3))');
              subWedgesGroup.transition(t)
                .style('visibility', 'visible')
                .attr('opacity', 1);
              labelsContainer.transition(t)
                .style('visibility', 'visible')
                .attr('opacity', 1);
              node.select('.center-icon').transition(t)
                .attr('opacity', 0);
              node.select('.count-text').transition(t)
                .text(content.length);
              node.select('.options-text').transition(t)
                .text(formatCategoryName(category));
            })
            .on('mouseleave', function (event) {
              event.stopPropagation();
              const t2 = d3.transition().duration(200);
              d3.select(this).transition(t2)
                .attr('d', categoryArc)
                .attr('filter', 'drop-shadow(0px 0px 1px rgba(0,0,0,0.2))');
              subWedgesGroup.transition(t2)
                .attr('opacity', 0)
                .on('end', () => subWedgesGroup.style('visibility', 'hidden'));
              labelsContainer.transition(t2)
                .attr('opacity', 0)
                .on('end', () => labelsContainer.style('visibility', 'hidden'));
              node.select('.center-icon').transition(t2)
                .attr('opacity', 0.7);
              node.select('.count-text').transition(t2)
                .text('');
              node.select('.options-text').transition(t2)
                .text('');
            });
        });
      });
    }

    const cardNodes = nodeElements.filter(d => d.type === 'actor');
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');

    cardNodes.each(function (d) {
      const nodeId = d.id;
      const gradientId = `center-gradient-${nodeId}`;
      let gradient = defs.select(`#${gradientId}`);
      if (gradient.empty()) {
        gradient = defs.append('radialGradient')
          .attr('id', gradientId)
          .attr('cx', '50%')
          .attr('cy', '50%')
          .attr('r', '50%')
          .attr('fx', '50%')
          .attr('fy', '50%');
        gradient.append('stop').attr('offset', '0%').attr('stop-color', '#FFFFFF').attr('stop-opacity', 0.9);
        gradient.append('stop').attr('offset', '85%').attr('stop-color', '#F5F5F5').attr('stop-opacity', 0.9);
        gradient.append('stop').attr('offset', '100%').attr('stop-color', '#E0E0E0').attr('stop-opacity', 0.9);
      }

      const node = d3.select(this);
      let centerCircle = node.select('.center-circle');
      if (centerCircle.empty()) {
        centerCircle = node.append('circle')
          .attr('class', `center-circle${d.active ? ' active' : ''}`)
          .attr('r', cardNodeRadius)
          .attr('fill', `url(#${gradientId})`)
          .attr('stroke', '#e5e5e5')
          .attr('stroke-width', 1)
          .attr('filter', 'drop-shadow(0px 1px 2px rgba(0,0,0,0.08))')
          .style('cursor', 'pointer')
          .attr('pointer-events', 'all')
          .on('click', function (event) {
            event.stopPropagation();
            const node = d3.select(this.parentNode).datum() as D3Node;
            const isSameNode = popoverOpen && popoverNode &&
              ((popoverNodeType === 'actor' && node.type === 'actor' && (popoverNode as Card).card_id === node.id) ||
               (popoverNodeType === 'agreement' && node.type === 'agreement' && (popoverNode as Agreement).agreement_id === node.id));
            if (isSameNode) {
              popoverOpen = false;
            } else {
              popoverNode = node.data;
              popoverNodeType = node.type;
              const transform = d3.zoomTransform(svgRef);
              popoverPosition = {
                x: transform.applyX(node.x),
                y: transform.applyY(node.y)
              };
              popoverOpen = true;
            }
          });
      } else {
        centerCircle
          .attr('class', `center-circle${d.active ? ' active' : ''}`)
          .attr('fill', `url(#${gradientId})`);
      }

      const card = d.data as Card;
      let iconGroup = node.select('.central-icon-group');
      if (iconGroup.empty()) {
        iconGroup = node.append('g')
          .attr('class', 'central-icon-group')
          .attr('pointer-events', 'none');
      }

      // Use dynamic svelte-lucide icon
      const IconComponent = getCardIcon(card.icon);
      const iconSize = 24;
      iconGroup.html(`
        <foreignObject x="-${iconSize / 2}" y="-${iconSize / 2}" width="${iconSize}" height="${iconSize}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width: ${iconSize}px; height: ${iconSize}px;">
            <svelte:component this="${IconComponent}" class="w-full h-full" />
          </div>
        </foreignObject>
      `);
    });

    const cardNameGroups = cardNodes
      .selectAll('.card-name-container')
      .data([null])
      .join('g')
      .attr('class', 'card-name-container')
      .attr('pointer-events', 'none');

    cardNameGroups.each(function (d, i, nodes) {
      const group = d3.select(this);
      const card = (nodes[i].__data__ as D3Node).data as Card;
      const labelText = card.role_title.length > 20 ? card.role_title.slice(0, 17) + '...' : card.role_title;

      const tempText = group.append('text')
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .text(labelText)
        .style('visibility', 'hidden');

      const textWidth = tempText.node()?.getBBox().width || 0;
      tempText.remove();

      const padding = 5;
      const rectWidth = textWidth + padding * 2;
      const rectHeight = 18;
      const outerRingRadius = cardNodeRadius + donutThickness;
      const labelYPosition = outerRingRadius + (outerRingRadius * 0.1);

      let rect = group.select('rect');
      if (rect.empty()) {
        rect = group.append('rect')
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('width', rectWidth)
          .attr('height', rectHeight)
          .attr('x', -rectWidth / 2)
          .attr('y', labelYPosition)
          .attr('fill', 'var(--color-tertiary-50, white)')
          .attr('fill-opacity', 0.85)
          .attr('stroke', 'var(--color-tertiary-300, #e5e5e5)')
          .attr('stroke-width', 0.5);
      } else {
        rect
          .attr('width', rectWidth)
          .attr('x', -rectWidth / 2)
          .attr('y', labelYPosition);
      }

      let text = group.select('.name-text');
      if (text.empty()) {
        text = group.append('text')
          .attr('class', 'name-text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('y', labelYPosition + (rectHeight / 2))
          .attr('font-size', '11px')
          .attr('font-weight', '500')
          .attr('fill', 'var(--node-text-light, var(--color-tertiary-900))')
          .text(labelText);
      } else {
        text
          .attr('y', labelYPosition + (rectHeight / 2))
          .text(labelText);
      }
    });

    const agreementNodes = nodeElements.filter(d => d.type === 'agreement');
    let agreementCounter = 1;

    agreementNodes.each(function (d) {
      const node = d3.select(this);
      let circle = node.select('.agreement-circle');
      if (circle.empty()) {
        circle = node.append('circle')
          .attr('class', 'agreement-circle')
          .attr('r', agreementNodeRadius)
          .attr('fill', '#444444')
          .attr('stroke', '#333333')
          .attr('stroke-width', 0.75)
          .style('cursor', 'pointer')
          .attr('pointer-events', 'all')
          .style('filter', 'drop-shadow(0px 1px 2px rgba(0,0,0,0.2))')
          .on('click', function (event) {
            event.stopPropagation();
            const node = d3.select(this.parentNode).datum() as D3Node;
            const isSameNode = popoverOpen && popoverNode &&
              ((popoverNodeType === 'actor' && node.type === 'actor' && (popoverNode as Card).card_id === node.id) ||
               (popoverNodeType === 'agreement' && node.type === 'agreement' && (popoverNode as Agreement).agreement_id === node.id));
            if (isSameNode) {
              popoverOpen = false;
            } else {
              popoverNode = node.data;
              popoverNodeType = node.type;
              const transform = d3.zoomTransform(svgRef);
              popoverPosition = {
                x: transform.applyX(node.x),
                y: transform.applyY(node.y)
              };
              popoverOpen = true;
            }
          });
      }

      const agreementId = `AG${agreementCounter++}`;
      let titleText = node.select('.agreement-title');
      if (titleText.empty()) {
        titleText = node.append('text')
          .attr('class', 'agreement-title')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .attr('fill', '#FFFFFF')
          .text(agreementId);
      } else {
        titleText.text(agreementId);
      }

      let title = node.select('title');
      if (title.empty()) {
        title = node.append('title')
          .text((d: D3Node) => (d.data as Agreement).title || 'Untitled Agreement');
      } else {
        title.text((d: D3Node) => (d.data as Agreement).title || 'Untitled Agreement');
      }
    });

    cardNodes.each(function (nodeData) {
      const node = d3.select(this);
      let centerTextGroup = node.select('.center-text-group');
      if (centerTextGroup.empty()) {
        centerTextGroup = node.append('g')
          .attr('class', 'center-text-group')
          .attr('pointer-events', 'none');
        centerTextGroup.append('text')
          .attr('class', 'count-text')
          .attr('text-anchor', 'middle')
          .attr('dy', '-0.2em')
          .attr('font-size', '18px')
          .attr('font-weight', 'bold')
          .attr('fill', '#555555')
          .text('');
        centerTextGroup.append('text')
          .attr('class', 'options-text')
          .attr('text-anchor', 'middle')
          .attr('dy', '1em')
          .attr('font-size', '12px')
          .attr('fill', '#777777')
          .text('');
      }
    });

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on('zoom', debounce((event) => {
        nodeGroup.attr('transform', event.transform);
        linkGroup.attr('transform', event.transform);
        if (hoveredCategory) {
          hoveredCategory = null;
          d3.selectAll('.sub-wedges')
            .style('opacity', 0)
            .style('visibility', 'hidden');
          d3.selectAll('.label-container')
            .style('opacity', 0)
            .style('visibility', 'hidden');
          d3.selectAll('.category-wedge')
            .attr('filter', 'drop-shadow(0px 0px 1px rgba(0,0,0,0.2))');
          d3.selectAll('.count-text, .options-text').text('');
        }
      }, 50));

    svg.call(zoomBehavior)
      .on('wheel', (event) => {
        if (event.ctrlKey || event.metaKey) return;
        event.preventDefault();
      });

    updateLinks();
    addDonutRings();
  }

  function createDemoAgreements() {
    if (cardsWithPosition.length < 3) return;

    const card1 = cardsWithPosition[0];
    const card2 = cardsWithPosition[1];
    const card3 = cardsWithPosition[2];

    const actor1Id = `actor_${card1.card_id}`;
    const actor2Id = `actor_${card2.card_id}`;
    const actor3Id = `actor_${card3.card_id}`;

    actorCardMap = new Map(actorCardMap)
      .set(actor1Id, card1.card_id)
      .set(actor2Id, card2.card_id)
      .set(actor3Id, card3.card_id);

    const agreement1: AgreementWithPosition = {
      agreement_id: 'agreement_1',
      title: 'Resource Sharing',
      description: 'Agreement to share resources between parties',
      created_at: Date.now(),
      status: 'active',
      parties: { [actor1Id]: true, [actor2Id]: true },
      obligations: [{ id: 'ob1', fromActorId: actor1Id, toActorId: actor2Id, description: 'Provide funding' }],
      benefits: [{ id: 'be1', fromActorId: actor2Id, toActorId: actor1Id, description: 'Deliver results' }],
      position: {
        x: ((card1.position?.x || 0) + (card2.position?.x || 0)) / 2,
        y: ((card1.position?.y || 0) + (card2.position?.y || 0)) / 2
      }
    };

    const agreement2: AgreementWithPosition = {
      agreement_id: 'agreement_2',
      title: 'Knowledge Sharing',
      description: 'Agreement to share knowledge and expertise',
      created_at: Date.now(),
      status: 'active',
      parties: { [actor2Id]: true, [actor3Id]: true },
      obligations: [{ id: 'ob2', fromActorId: actor2Id, toActorId: actor3Id, description: 'Share methodology' }],
      benefits: [{ id: 'be2', fromActorId: actor3Id, toActorId: actor2Id, description: 'Provide data' }],
      position: {
        x: ((card2.position?.x || 0) + (card3.position?.x || 0)) / 2,
        y: ((card2.position?.y || 0) + (card3.position?.y || 0)) / 2
      }
    };

    const agreement3: AgreementWithPosition = {
      agreement_id: 'agreement_3',
      title: 'Community Support',
      description: 'Agreement to support community initiatives',
      created_at: Date.now(),
      status: 'active',
      parties: { [actor3Id]: true, [actor1Id]: true },
      obligations: [{ id: 'ob3', fromActorId: actor3Id, toActorId: actor1Id, description: 'Provide community support' }],
      benefits: [{ id: 'be3', fromActorId: actor1Id, toActorId: actor3Id, description: 'Provide mentorship' }],
      position: {
        x: ((card3.position?.x || 0) + (card1.position?.x || 0)) / 2,
        y: ((card3.position?.y || 0) + (card1.position?.y || 0)) / 2
      }
    };

    agreements = [agreement1, agreement2, agreement3];
  }

  function handleSearch() {
    // Implement search logic if needed
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

  // Effect for initialization
  $effect(() => {
    onMount(async () => {
      try {
        if (cards.length > 0) {
          cardsWithPosition = cards.map(card => ({
            ...card,
            position: { x: Math.random() * width, y: Math.random() * height }
          }));
          await Promise.all(cardsWithPosition.map(loadCardDetails));
        } else {
          await loadGameData();
        }

        if (activeActorId) {
          const actor = actors.find(a => a.actor_id === activeActorId);
          if (actor?.card_id) activeCardId = actor.card_id;
        }
      } catch (error) {
        console.error('D3CardBoard: Error initializing', error);
      }
    });

    return onDestroy(() => {
      valueCache = new Map();
      capabilityCache = new Map();
      actorCardMap = new Map();
    });
  });

  // Effect for graph rendering
  $effect(() => {
    if (hasData && svgRef) {
      if (agreements.length === 0 && cardsWithPosition.length >= 3) {
        createDemoAgreements();
      }
      initializeGraph();
      setupRealTimeListeners();
    }
  });
</script>

<div class="game-board-container">
  <svg
    bind:this={svgRef}
    width="100%"
    height="100%"
    onclick={(event) => {
      if (event.target === svgRef) {
        popoverOpen = false;
      }
    }}
  >
  </svg>

  {#if popoverOpen && popoverNode}
    {@const cardCategory = popoverNode.card_category || 'Supporters'}
    {@const categoryColor = 
      cardCategory === 'Funders' ? 'primary' : 
      cardCategory === 'Providers' ? 'success' : 
      cardCategory === 'Supporters' ? 'secondary' : 'tertiary'
    }
    <div
      class="absolute max-w-md max-h-[80vh] overflow-y-auto"
      style="z-index: 1000; left: {popoverPosition.x + 30}px; top: {popoverPosition.y}px; transform: translateY(-50%);"
    >
      <div class="absolute top-2 right-2 z-10">
        <button
          class="btn btn-sm variant-ghost-surface"
          on:click={handlePopoverClose}
          aria-label="Close popover"
        >
          ×
        </button>
      </div>

      {#if popoverNodeType === 'actor' && popoverNode}
        <div class="card bg-surface-50-900 rounded-lg shadow-lg border border-surface-300-600 w-80">
          <header class="p-3 text-white bg-{categoryColor}-500 rounded-t-lg">
            <div class="flex items-center gap-2">
              <div class="bg-surface-900-50/30 rounded-full p-1.5 flex items-center justify-center">
                <svelte:component this={getCardIcon(popoverNode.icon)} class="w-5 h-5" />
              </div>
              <div class="flex-1">
                <div class="flex justify-between items-center">
                  <h3 class="font-bold text-lg">{popoverNode.role_title}</h3>
                  <span class="text-white text-sm">{popoverNode.card_number}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                  <span>{popoverNode.type || 'Individual'}</span>
                  <span class="bg-white/20 rounded-full px-2 py-0.5 text-xs">{cardCategory}</span>
                </div>
              </div>
            </div>
          </header>
          <div class="p-4 space-y-3">
            {#if popoverNode.backstory}
              <div>
                <h4 class="font-medium text-surface-700-300">Backstory</h4>
                <p class="text-surface-900-50">{popoverNode.backstory}</p>
              </div>
            {/if}
            {#if popoverNode.values && Object.keys(popoverNode.values).length > 0}
              <div>
                <h4 class="font-medium text-surface-700-300">Values</h4>
                <ul class="list-disc list-inside">
                  {#each Object.keys(popoverNode.values).filter(k => k !== '_' && k !== '#') as valueId}
                    <li>{valueCache.get(valueId)?.name || valueId.replace('value_', '').replaceAll('-', ' ')}</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if popoverNode.capabilities && Object.keys(popoverNode.capabilities).length > 0}
              <div>
                <h4 class="font-medium text-surface-700-300">Capabilities</h4>
                <ul class="list-disc list-inside">
                  {#each Object.keys(popoverNode.capabilities).filter(k => k !== '_' && k !== '#') as capabilityId}
                    <li>{capabilityCache.get(capabilityId)?.name || capabilityId.replace('capability_', '').replaceAll('-', ' ')}</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if popoverNode.goals}
              <div>
                <h4 class="font-medium text-surface-700-300">Goals</h4>
                <p class="text-surface-900-50">{popoverNode.goals}</p>
              </div>
            {/if}
            {#if popoverNode.obligations}
              <div>
                <h4 class="font-medium text-surface-700-300">Obligations</h4>
                <p class="text-surface-900-50">{popoverNode.obligations}</p>
              </div>
            {/if}
            {#if popoverNode.intellectual_property}
              <div>
                <h4 class="font-medium text-surface-700-300">IP</h4>
                <p class="text-surface-900-50">{popoverNode.intellectual_property}</p>
              </div>
            {/if}
            {#if popoverNode.rivalrous_resources}
              <div>
                <h4 class="font-medium text-surface-700-300">Resources</h4>
                <p class="text-surface-900-50">{popoverNode.rivalrous_resources}</p>
              </div>
            {/if}
          </div>
        </div>
      {:else if popoverNodeType === 'agreement'}
        <div class="card p-4 shadow-lg h-full flex flex-col bg-surface-100-900/80 rounded-lg border border-surface-200 dark:border-surface-700">
          <header class="card-header flex justify-between items-center">
            <h3 class="h3 text-tertiary-500 dark:text-tertiary-400">{popoverNode.title || 'Agreement'}</h3>
            {#if popoverNode.status}
              <span class="badge variant-filled-primary text-sm p-1 px-2 rounded-full">{popoverNode.status}</span>
            {/if}
          </header>
          <section class="p-4 flex-grow space-y-3">
            {#if popoverNode.description}
              <div>
                <h4 class="font-semibold mb-1">Description</h4>
                <p class="text-sm">{popoverNode.description}</p>
              </div>
            {/if}
            {#if popoverNode.obligations && Array.isArray(popoverNode.obligations) && popoverNode.obligations.length > 0}
              <div>
                <h4 class="font-semibold mb-1">Obligations</h4>
                <ul class="list-disc list-inside">
                  {#each popoverNode.obligations as obligation}
                    <li class="text-sm">
                      <span class="font-medium">{obligation.fromActorId}:</span> 
                      {obligation.description || (obligation as any).text || ''}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if popoverNode.benefits && Array.isArray(popoverNode.benefits) && popoverNode.benefits.length > 0}
              <div>
                <h4 class="font-semibold mb-1">Benefits</h4>
                <ul class="list-disc list-inside">
                  {#each popoverNode.benefits as benefit}
                    <li class="text-sm">
                      <span class="font-medium">To {benefit.toActorId}:</span> 
                      {benefit.description || (benefit as any).text || ''}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
            <div class="mt-4 pt-2 border-t border-surface-200 dark:border-surface-700">
              {#if popoverNode.created_at}
                <span class="text-xs text-surface-500 dark:text-surface-400">Created: {new Date(popoverNode.created_at).toLocaleDateString()}</span>
              {/if}
            </div>
          </section>
        </div>
      {/if}
    </div>
  {/if}
</div>