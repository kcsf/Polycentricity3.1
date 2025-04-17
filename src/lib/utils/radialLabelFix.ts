/**
 * Fixes text labels on donut rings to position them with 10% gap from the outer edge
 * and enforces exactly 8px font size.
 */
import * as d3 from 'd3';

/**
 * Apply the label fixes to the existing SVG elements
 * This function directly modifies the existing DOM elements without replacing them
 */
export function fixDonutRingLabels(): void {
  // Wait a brief moment for the SVG to be rendered
  setTimeout(() => {
    try {
      // Find all text elements within label groups and set font size
      d3.selectAll('g.label-group text')
        .attr('font-size', '8px')
        .style('font-size', '8px')
        .style('font-family', 'sans-serif');
      
      // Set all text labels to be positioned 10% away from donut rings
      // Find all donut rings first to get their radius
      const donutRings = d3.selectAll('circle.donut-ring');
      if (donutRings.empty()) {
        console.log('No donut rings found, skipping label fix');
        return;
      }
      
      // Get the radius from the first donut ring (they should all be the same)
      const firstRing = donutRings.nodes()[0];
      if (!firstRing) return;
      
      const radius = d3.select(firstRing).attr('r');
      if (!radius) return;
      
      const outerRadius = parseFloat(radius);
      const gapDistance = outerRadius * 0.1; // Exactly 10% gap
      
      console.log(`Fixing text labels with ${gapDistance}px gap (10% of ${outerRadius}px radius)`);
      
      // Process all text elements in label groups
      d3.selectAll('g.label-group text').each(function() {
        const textEl = d3.select(this);
        
        // Get current position
        const x = parseFloat(textEl.attr('x') || '0');
        const y = parseFloat(textEl.attr('y') || '0');
        
        // Calculate angle and current distance
        const angle = Math.atan2(y, x);
        const currentDistance = Math.sqrt(x*x + y*y);
        
        // If we're near the outer radius, adjust position outward
        if (Math.abs(currentDistance - outerRadius) < 10) {
          // Calculate new position with exact 10% gap
          const newDist = outerRadius + gapDistance;
          const newX = Math.cos(angle) * newDist;
          const newY = Math.sin(angle) * newDist;
          
          // Update position
          textEl.attr('x', newX)
               .attr('y', newY);
          
          // Update rotation transform if it exists
          const transform = textEl.attr('transform');
          if (transform && transform.includes('rotate')) {
            const rotateMatch = transform.match(/rotate\(([^,]+),/);
            if (rotateMatch && rotateMatch[1]) {
              const rotation = parseFloat(rotateMatch[1]);
              textEl.attr('transform', `rotate(${rotation},${newX},${newY})`);
            }
          }
        }
      });
      
      console.log('Donut ring label fixes applied successfully');
    } catch (error) {
      console.error('Error applying donut ring label fixes:', error);
    }
  }, 1000); // Longer delay to ensure elements are fully rendered
}