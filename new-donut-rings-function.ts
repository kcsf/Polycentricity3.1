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
    
    // Exact sizes from reference HTML
    const centerRadius = isActive ? 52.5 : 35; // 52.5px for active nodes (reference)
    const donutRadius = 75; // 75px from reference
    
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
    
    // 1. Create a surrounding donut ring exactly matching reference
    node.append("circle")
      .attr("r", donutRadius)
      .attr("class", `donut-ring ${isActive ? "active" : ""}`)
      .attr("fill", "transparent")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1);
      
    // 2. CATEGORIES SETUP - EXACTLY matching reference
    const categories = [
      { 
        name: "values", 
        color: "#A7C731",
        items: nodeData._valueNames || []
      },
      { 
        name: "goals", 
        color: "#9BC23D", 
        items: ["Maintain peace", "Protect sites"]
      },
      { 
        name: "capabilities", 
        color: "#8FBC49", 
        items: nodeData._capabilityNames || []
      },
      { 
        name: "intellectualProperty", 
        color: "#83B655", 
        items: ["Historical records", "Diplomatic protocols"]
      }
    ];
    
    // Calculate angles for 4 equal segments (exactly like reference)
    const totalCategories = 4; // Always 4 sections
    const anglePerCategory = (2 * Math.PI) / totalCategories;
    
    // 3. RENDER EACH CATEGORY (Processing all 4 categories)
    categories.forEach((category, categoryIndex) => {
      // Calculate angles for this category
      const startAngle = -Math.PI/2 + (categoryIndex * anglePerCategory);
      const endAngle = startAngle + anglePerCategory;
      
      // Create category group - exact class from reference
      const categoryGroup = node.append("g")
        .attr("class", "category-group")
        .attr("data-category", category.name);
      
      // Create the wedge exactly like reference
      const arc = d3.arc<any>()
        .innerRadius(centerRadius)
        .outerRadius(donutRadius)
        .startAngle(startAngle)
        .endAngle(endAngle);
        
      // Add the wedge - match reference classes and attributes
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
      
      // Create label container - hidden by default (exact match to reference)
      const labelContainer = categoryGroup.append("g")
        .attr("class", "label-container")
        .attr("opacity", 0)
        .attr("pointer-events", "none")
        .style("visibility", "hidden");
      
      // Create sub-wedges container - hidden by default (exact match to reference)
      const subWedgesContainer = categoryGroup.append("g")
        .attr("class", "sub-wedges")
        .attr("opacity", 0)
        .attr("pointer-events", "none")
        .style("visibility", "hidden");
      
      // Add items with their labels and sub-wedges
      if (category.items && category.items.length > 0) {
        const itemCount = category.items.length;
        const anglePerItem = anglePerCategory / itemCount;
        
        // Process each item in this category
        category.items.forEach((item, itemIndex) => {
          const itemStartAngle = startAngle + (itemIndex * anglePerItem);
          const itemEndAngle = itemStartAngle + anglePerItem;
          const itemMidAngle = itemStartAngle + (anglePerItem / 2);
          
          // Calculate label position - exact radiating pattern
          const labelRadius = donutRadius * 1.5; // Labels outside the wheel
          const labelX = Math.cos(itemMidAngle) * labelRadius;
          const labelY = Math.sin(itemMidAngle) * labelRadius;
          
          // Create label group for this item
          const labelGroup = labelContainer.append("g")
            .attr("class", "label-group");
          
          // Add text with correct positioning and angle
          // Text anchor based on position - match reference behavior
          const textAnchor = (itemMidAngle > Math.PI/2 && itemMidAngle < Math.PI*1.5) 
            ? "end" : "start";
            
          labelGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("font-size", "11px")
            .attr("fill", category.color)
            .attr("font-weight", "500")
            .attr("transform", `rotate(${(itemMidAngle * 180/Math.PI)},${labelX},${labelY})`)
            .text(item);
          
          // Create sub-wedge for this item
          const subArc = d3.arc<any>()
            .innerRadius(donutRadius)
            .outerRadius(donutRadius * 1.3)
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
      
      // Add hover interactions exactly like reference
      wedge.on("mouseenter", function() {
        // Show labels and sub-wedges on hover
        labelContainer
          .style("visibility", "visible")
          .transition().duration(200)
          .attr("opacity", 1);
        
        subWedgesContainer
          .style("visibility", "visible")
          .transition().duration(200)
          .attr("opacity", 1);
      })
      .on("mouseleave", function() {
        // Hide on mouse leave
        labelContainer
          .transition().duration(200)
          .attr("opacity", 0)
          .on("end", function() {
            d3.select(this).style("visibility", "hidden");
          });
        
        subWedgesContainer
          .transition().duration(200)
          .attr("opacity", 0)
          .on("end", function() {
            d3.select(this).style("visibility", "hidden");
          });
      });
    });
  });
}