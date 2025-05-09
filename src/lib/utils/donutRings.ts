import * as d3 from 'd3';
import type { D3Node, Card, CardWithPosition, ObligationItem } from '$lib/types';

/**
 * Add donut ring segments to card nodes based on their values, capabilities, etc.
 * 
 * @param nodeElements - D3 Selection of node elements
 * @param activeCardId - ID of the active card (if any) for highlighting
 */
export function addDonutRings(
  nodeElements: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown>,
  activeCardId?: string | null
): void {
  const cardNodes = nodeElements.filter((d) => d.type === "actor");

  cardNodes.each(function(nodeData) {
    const node = d3.select(this);
    const isActive = nodeData.id === activeCardId;

    const BASE_SIZE = isActive ? 40 : 35;

    const DIMENSIONS = {
      centerRadius: BASE_SIZE * 0.9,
      donutRadius: BASE_SIZE * 1.15,
      subWedgeRadius: BASE_SIZE * 1.4, // Increased extension, matching Perplexity
      labelRadius: BASE_SIZE * 1.8,
      textSize: BASE_SIZE * 0.3,
      centerTextSize: BASE_SIZE * 0.35,
      countTextSize: BASE_SIZE * 0.3
    };

    const centerIcon = node.select(".center-group");
    const foreignObjects = centerIcon.selectAll("foreignObject");
    const cardData = nodeData.data as CardWithPosition;
    const valueNames = cardData._valueNames || [];
    const capabilityNames = cardData._capabilityNames || [];

    if (valueNames.length === 0 && capabilityNames.length === 0) {
      return;
    }

    node.append("circle")
      .attr("r", DIMENSIONS.donutRadius)
      .attr("class", `donut-ring ${isActive ? "active" : ""}`)
      .attr("fill", "transparent")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1);

    const categories = [
      { name: "values", color: "#A7C731", items: valueNames.filter(v => v !== '#') },
      { name: "goals", color: "#9BC23D", items: (nodeData.type === 'actor' && cardData.goals) ? (cardData.goals as string).split(/[;,.]+/).map((s: string) => s.trim()).filter(Boolean) : [] },
      { name: "capabilities", color: "#8FBC49", items: capabilityNames.filter(c => c !== '#') },
      { name: "intellectualProperty", color: "#83B655", items: (nodeData.type === 'actor' && (nodeData.data as Card).intellectual_property) ? ((nodeData.data as Card).intellectual_property as string).split(/[;,.]+/).map((s: string) => s.trim()).filter(Boolean) : [] },
      { name: "resources", color: "#77B061", items: (nodeData.type === 'actor' && (nodeData.data as Card).resources) ? ((nodeData.data as Card).resources as string).split(/[;,.]+/).map((s: string) => s.trim()).filter(Boolean) : [] },
      { name: "obligations", color: "#6BA96D", items: (nodeData.type === 'agreement' && Array.isArray(nodeData.data.obligations)) ? nodeData.data.obligations.map((obligation: ObligationItem) => obligation.text || '').filter(Boolean) : [] }
    ];

    const totalItems = categories.reduce(
      (sum, category) => sum + (category.items?.length ?? 0),
      0
    );

    interface CategoryAngle {
      start: number;
      end: number;
      size: number;
    }

    const categoryAngles: CategoryAngle[] = [];
    let runningAngle = -Math.PI/2;

    categories.forEach(category => {
      const proportion = totalItems > 0 ? category.items.length / totalItems : 0.25;
      const angleSize = proportion * (2 * Math.PI);
      categoryAngles.push({ start: runningAngle, end: runningAngle + angleSize, size: angleSize });
      runningAngle += angleSize;
    });

    categories.forEach((category, categoryIndex) => {
      const startAngle = categoryAngles[categoryIndex].start;
      const endAngle = categoryAngles[categoryIndex].end;

      const categoryGroup = node.append("g")
        .attr("class", "category-group")
        .attr("data-category", category.name);

      const arc = d3.arc<any>()
        .innerRadius(DIMENSIONS.centerRadius)
        .outerRadius(DIMENSIONS.donutRadius)
        .startAngle(startAngle)
        .endAngle(endAngle);

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

      const categoryLabelGroup = categoryGroup.append("g")
        .attr("class", "category-label")
        .attr("opacity", 0)
        .attr("pointer-events", "none")
        .style("visibility", "hidden");

      const displayCategoryName = category.name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();

      categoryLabelGroup.append("text")
        .attr("class", "count-text")
        .attr("x", 0)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", DIMENSIONS.centerTextSize * 2)
        .attr("font-weight", "bold")
        .attr("fill", category.color)
        .text(`${category.items.length}`);

      categoryLabelGroup.append("text")
        .attr("class", "options-text")
        .attr("x", 0)
        .attr("y", DIMENSIONS.centerTextSize * 1.5)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", DIMENSIONS.centerTextSize * 0.8)
        .attr("fill", category.color)
        .text(displayCategoryName);

      const labelContainer = categoryGroup.append("g")
        .attr("class", "label-container")
        .attr("opacity", 0)
        .attr("pointer-events", "none")
        .style("visibility", "hidden");

      const subWedgesContainer = categoryGroup.append("g")
        .attr("class", "sub-wedges")
        .attr("opacity", 0)
        .attr("pointer-events", "none")
        .style("visibility", "hidden");

      if ((category.items?.length ?? 0) > 0) {
        const itemCount = category.items!.length;
        const anglePerItem = (endAngle - startAngle) / itemCount;

        category.items!.forEach((item: any, itemIndex: number) => {
          const itemStartAngle = startAngle + (itemIndex * anglePerItem);
          const itemEndAngle = itemStartAngle + anglePerItem;
          const itemMidAngle = itemStartAngle + (anglePerItem / 2);

          const adjustedAngle = itemMidAngle - Math.PI / 2;
          const gapPercentage = 0.6;
          const labelDistance = DIMENSIONS.subWedgeRadius * (1 + gapPercentage);
          const labelX = Math.cos(adjustedAngle) * labelDistance;
          const labelY = Math.sin(adjustedAngle) * labelDistance;

          const labelGroup = labelContainer.append("g")
            .attr("class", "label-group");

          const angleDeg = ((adjustedAngle * 180) / Math.PI) % 360;
          const isLeftSide = angleDeg > 90 && angleDeg < 270;
          const rotationDeg = isLeftSide ? angleDeg + 180 : angleDeg;
          const textAnchor = isLeftSide ? "end" : "start";

          let displayName = item;
          if (typeof item === 'string') {
            if (item.startsWith('value_')) {
              displayName = item.substring(6);
            } else if (item.startsWith('capability_')) {
              displayName = item.substring(11);
            }
            displayName = displayName.replace(/-/g, ' ')
              .split(' ')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }

          labelGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("font-size", "10px")
            .attr("fill", category.color)
            .attr("font-weight", "500")
            .attr("transform", `rotate(${rotationDeg},${labelX},${labelY})`)
            .text(displayName);

          const subArc = d3.arc<any>()
            .innerRadius(DIMENSIONS.centerRadius) // Start at parent wedge's inner radius
            .outerRadius(DIMENSIONS.subWedgeRadius) // Extend further outward
            .startAngle(itemStartAngle)
            .endAngle(itemEndAngle);

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

      wedge.on("mouseenter", function(event) {
        event.stopPropagation();
        categoryGroup.raise();

        // Hide parent wedge during hover
        wedge.style("visibility", "hidden");

        // Show sub-wedges
        subWedgesContainer
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("opacity", 1);

        // Fade center elements
        node.select(".center-group").transition().duration(150).attr("opacity", 0);
        node.selectAll("foreignObject").transition().duration(150).attr("opacity", 0);

        // Show labels
        labelContainer
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("opacity", 1);

        categoryLabelGroup
          .style("visibility", "visible")
          .transition()
          .duration(150)
          .attr("opacity", 1);
      })
      .on("mouseleave", function(event) {
        event.stopPropagation();

        // Restore parent wedge visibility
        wedge.style("visibility", "visible");

        // Hide sub-wedges & labels
        subWedgesContainer.transition()
          .duration(100)
          .attr("opacity", 0)
          .on("end", () => subWedgesContainer.style("visibility", "hidden"));

        labelContainer.transition()
          .duration(100)
          .attr("opacity", 0)
          .on("end", () => labelContainer.style("visibility", "hidden"));

        categoryLabelGroup.transition()
          .duration(100)
          .attr("opacity", 0)
          .on("end", () => categoryLabelGroup.style("visibility", "hidden"));

        // Restore center elements
        node.select(".center-group").transition().duration(200).attr("opacity", 1);
        node.selectAll("foreignObject").transition().duration(200).attr("opacity", 1);
      });
    });
  });
}