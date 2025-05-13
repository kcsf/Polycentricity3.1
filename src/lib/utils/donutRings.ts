import * as d3 from 'd3';
import type { D3Node, CardWithPosition, ObligationItem } from '$lib/types';
import { spawnCategorySubnode } from '$lib/utils/graphCore';

export function addDonutRings(
  nodeElements: d3.Selection<SVGElement, D3Node, SVGSVGElement, unknown>,
  activeCardId?: string | null
): void {
  const cardNodes = nodeElements.filter(d => d.type === 'actor');

  cardNodes.each(function(nodeData) {
    const node = d3.select(this);
    const isActive = nodeData.id === activeCardId;
    const BASE_SIZE = isActive ? 40 : 35;
    const DIMENSIONS = {
      centerRadius:     BASE_SIZE * 0.9,
      donutRadius:      BASE_SIZE * 1.15,
      subWedgeRadius:   BASE_SIZE * 1.4,
      labelRadius:      BASE_SIZE * 1.8,
      textSize:         BASE_SIZE * 0.3,
      centerTextSize:   BASE_SIZE * 0.35,
      countTextSize:    BASE_SIZE * 0.3
    };

    const cardData = nodeData.data as CardWithPosition;
    const valueNames = cardData._valueNames || [];
    const capabilityNames = cardData._capabilityNames || [];
    if (!valueNames.length && !capabilityNames.length) return;

    node.append('circle')
      .attr('r', DIMENSIONS.donutRadius)
      .attr('class', `donut-ring ${isActive ? 'active' : ''}`)
      .attr('fill', 'transparent')
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 1)
      .style('pointer-events','none');

    const categories = [
      { name: 'values', color: '#A7C731', items: valueNames.filter(v => v !== '#') },
      { name: 'goals',  color: '#9BC23D', items: (cardData.goals||'').split(/[;,.]+/).map(s=>s.trim()).filter(Boolean) },
      { name: 'capabilities', color: '#8FBC49', items: capabilityNames.filter(c=>c!=='#') },
      { name: 'intellectualProperty', color: '#83B655', items: (cardData.intellectual_property||'').split(/[;,.]+/).map(s=>s.trim()).filter(Boolean) },
      { name: 'resources', color: '#77B061', items: (cardData.resources||'').split(/[;,.]+/).map(s=>s.trim()).filter(Boolean) },
      { name: 'obligations', color: '#6BA96D', items: Array.isArray(cardData.obligations) ? (cardData.obligations as ObligationItem[]).map(o=>o.text||'').filter(Boolean) : [] }
    ];

    const totalItems = categories.reduce((sum,c) => sum + c.items.length, 0);
    const angles: { start:number; end:number }[] = [];
    let running = -Math.PI/2;
    categories.forEach(cat => {
      const span = totalItems > 0 ? (cat.items.length/totalItems)*(2*Math.PI) : (Math.PI/2);
      angles.push({ start: running, end: running + span });
      running += span;
    });

    categories.forEach((category, ci) => {
      const isInteractive = category.name === 'values' || category.name === 'capabilities';
      const { start, end } = angles[ci];

      const categoryGroup = node.append('g')
        .attr('class','category-group')
        .attr('data-category', category.name)
        .style('pointer-events','all')
        .on('mouseenter', () => {
          wedge.style('visibility','hidden');
          subWedgesContainer
            .style('visibility','visible')
            .style('pointer-events','all')
            .transition().duration(150).attr('opacity',1);
          labelContainer
            .style('visibility','visible')
            .transition().duration(150).attr('opacity',1);
          categoryLabelGroup
            .style('visibility','visible')
            .transition().duration(150).attr('opacity',1);
          node.select('.center-group').transition().duration(150).attr('opacity',0);
          node.selectAll('foreignObject').transition().duration(150).attr('opacity',0);
        })
        .on('mouseleave', (event:any) => {
          const to = event.relatedTarget as Element|null;
          if (to && subWedgesContainer.node()!.contains(to)) return;
          wedge.style('visibility','visible');
          subWedgesContainer.transition().duration(150).attr('opacity',0)
            .on('end', () => subWedgesContainer.style('visibility','hidden'));
          labelContainer.transition().duration(150).attr('opacity',0)
            .on('end', () => labelContainer.style('visibility','hidden'));
          categoryLabelGroup.transition().duration(150).attr('opacity',0)
            .on('end', () => categoryLabelGroup.style('visibility','hidden'));
          node.select('.center-group').transition().duration(200).attr('opacity',1);
          node.selectAll('foreignObject').transition().duration(200).attr('opacity',1);
        });

      const arcGen = d3.arc<any>()
        .innerRadius(DIMENSIONS.centerRadius)
        .outerRadius(DIMENSIONS.donutRadius)
        .startAngle(start).endAngle(end);
      const wedge = categoryGroup.append('path')
        .attr('class','category-wedge')
        .attr('d', arcGen({} as any)!)
        .attr('fill',category.color)
        .attr('stroke','white').attr('stroke-width',1)
        .attr('filter','drop-shadow(0px 0px 1px rgba(0,0,0,0.2))')
        .style('cursor','pointer')
        .on('click', function(event){
          event.stopPropagation();
          categoryGroup.dispatch('mouseenter');
        });

      const categoryLabelGroup = categoryGroup.append('g')
        .attr('class','category-label')
        .attr('opacity',0)
        .attr('pointer-events','none')
        .style('visibility','hidden');
      categoryLabelGroup.append('text')
        .attr('class','count-text')
        .attr('x',0).attr('y',-5)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-size',`${DIMENSIONS.centerTextSize*2}px`)
        .attr('font-weight','bold')
        .attr('fill',category.color)
        .text(`${category.items.length}`);
      categoryLabelGroup.append('text')
        .attr('class','options-text')
        .attr('x',0).attr('y',DIMENSIONS.centerTextSize*1.5)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('font-size',`${DIMENSIONS.centerTextSize*0.8}px`)
        .attr('fill',category.color)
        .text(
          category.name.replace(/([A-Z])/g,' $1')
            .replace(/^./,s=>s.toUpperCase())
            .trim()
        );

      const labelContainer = categoryGroup.append('g')
        .attr('class','label-container')
        .attr('opacity',0)
        .style('visibility','hidden');
      const subWedgesContainer = categoryGroup.append('g')
        .attr('class','sub-wedges')
        .attr('opacity',0)
        .style('visibility','hidden');

      if(category.items.length>0){
        const anglePer = (end-start)/category.items.length;
        category.items.forEach((item:string,i:number)=>{
          const a0 = start + i*anglePer;
          const a1 = a0 + anglePer;
          const arcSub = d3.arc<any>()
            .innerRadius(DIMENSIONS.centerRadius)
            .outerRadius(DIMENSIONS.subWedgeRadius)
            .startAngle(a0).endAngle(a1);
          const [dx,dy] = arcSub.centroid({} as any) as [number,number];
          const dist = Math.hypot(dx,dy);
          const ux = dx/dist, uy = dy/dist;

          subWedgesContainer.append('path')
            .attr('class','sub-wedge')
            .attr('d', arcSub({} as any)!)
            .attr('fill',category.color)
            .attr('stroke','white').attr('stroke-width',0.5)
            .attr('filter','drop-shadow(0px 0px 1px rgba(0,0,0,0.2))')
            .style('pointer-events','all')
            .style('cursor','pointer')
            .on('mouseenter',function(){
              if (!isInteractive) return;
              d3.select(this).transition().duration(100)
                .attr('fill',d3.color(category.color)!.darker(0.7).toString());
            })
            .on('mouseleave',function(){
              if (!isInteractive) return;
              d3.select(this).transition().duration(100)
                .attr('fill',category.color);
            })
            .on('click', function(event){
              if (!isInteractive) return;
              event.stopPropagation();
              event.preventDefault();
              const midAngle = (a0 + a1)/2;
              const adjAngle = midAngle - Math.PI/2;

              //–– compute the *local* centroid on this node’s donut
              const localX = Math.cos(adjAngle) * DIMENSIONS.subWedgeRadius;
              const localY = Math.sin(adjAngle) * DIMENSIONS.subWedgeRadius;
            
              //–– now translate into *world* coordinates:
              //    nodeData.x/y are the center of the actor‐node.  So:
              const originX = nodeData.x! + localX;
              const originY = nodeData.y! + localY;
                        
              // 0) restore all labels first (so any previously hidden label comes back)
              labelContainer
                .selectAll('text')
                .style('visibility', 'visible');
            
              // 1) spawn/toggle
              const isNowActive = spawnCategorySubnode(
                nodeData.id,
                item,
                midAngle,
                category.color,
                DIMENSIONS.subWedgeRadius * 5
              );
            
              // 2) if we just *created* the subnode, hide *only* its label
              if (isNowActive) {
                labelContainer
                  .select(`text[data-item="${item}"]`)
                  .style('visibility', 'hidden');
              }
            });    
            

          const mid = (a0+a1)/2;
          const adj = mid - Math.PI/2;
          const labelDist = DIMENSIONS.subWedgeRadius * 1.2;
          const lx = Math.cos(adj)*labelDist;
          const ly = Math.sin(adj)*labelDist;
          const deg = ((adj*180)/Math.PI + 360)%360;
          const left = deg>90 && deg<270;
          const rotLab = left?deg+180:deg;
          const anchor = left?'end':'start';
          let txt = item.replace(/^value_/, '').replace(/^capability_/, '');
          txt = txt.replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase());

          labelContainer.append('text')
            .attr('x',lx).attr('y',ly)
            .attr('text-anchor',anchor)
            .attr('dominant-baseline','middle')
            .attr('font-size','10px')
            .attr('font-weight','500')
            .attr('fill',category.color)
            .attr('transform',`rotate(${rotLab},${lx},${ly})`)
            .attr('data-item', item) // Add identifier to target the label
            .text(txt);
        });
      }
    });
  });
}