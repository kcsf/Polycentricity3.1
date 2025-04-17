/**
 * Fixes text labels on donut rings to position them with 10% gap from the outer edge
 * and enforces exactly 8px font size.
 */
import * as d3 from 'd3';

/**
 * Apply the label fixes to the existing SVG elements
 * This function directly modifies the existing DOM elements without replacing them
 */
export function fixDonutRingLabels() {
  // Wait a brief moment for the SVG to be rendered
  setTimeout(() => {
    try {
      // Find all text elements within label groups
      const textLabels = d3.selectAll('g.label-group text');
      
      // For each text label, adjust position and size
      textLabels.each(function(this: Element) {
        const textNode = d3.select(this);
        
        // Force the font size to exactly 8px using both SVG attributes and inline style
        textNode.attr('font-size', '8px');
        textNode.style('font-size', '8px');
        textNode.style('font-family', 'sans-serif');
        
        // Get the parent node's group (to access the transforms)
        // Safely check for parentNode
        if (this && this.parentNode) {
          // Get parent node and check for higher levels
          const parentNode = this.parentNode;
          
          if (parentNode.parentNode && parentNode.parentNode.parentNode) {
            // Get the parent wedge to determine the outer ring radius
            // Traversing up two levels to get to the category-group from the label-group
            const categoryGroup = d3.select(parentNode.parentNode.parentNode);
            const donutRing = categoryGroup.select('circle.donut-ring');
            
            // Get the donut ring radius (if available)
            const radius = donutRing.attr('r');
            if (radius) {
              const outerRadius = parseFloat(radius);
              
              // Calculate 10% gap from the outer ring
              const gapDistance = outerRadius * 0.1;
              
              // Get current position from the text element
              const x = parseFloat(textNode.attr('x') || '0');
              const y = parseFloat(textNode.attr('y') || '0');
              
              // Calculate the angle from center to the current point
              const angle = Math.atan2(y, x);
              
              // Calculate the current distance from center
              const currentDistance = Math.sqrt(x*x + y*y);
              
              // If the text is currently at the donut ring, adjust it outward
              if (Math.abs(currentDistance - outerRadius) < 5) {
                // Calculate new position with 10% gap
                const newDist = outerRadius + gapDistance;
                const newX = Math.cos(angle) * newDist;
                const newY = Math.sin(angle) * newDist;
                
                // Update the text element's position
                textNode.attr('x', newX);
                textNode.attr('y', newY);
                
                // Update transform attribute for rotation (keep the rotation value but use new x,y)
                const currentTransform = textNode.attr('transform') || '';
                // Extract rotation angle from transform string
                const rotateMatch = currentTransform.match(/rotate\(([^,]+),/);
                if (rotateMatch && rotateMatch[1]) {
                  const rotation = parseFloat(rotateMatch[1]);
                  textNode.attr('transform', `rotate(${rotation},${newX},${newY})`);
                }
              }
            }
          }
        }
      });
      
      console.log('Donut ring label fixes applied successfully');
    } catch (error) {
      console.error('Error applying donut ring label fixes:', error);
    }
  }, 500); // Brief delay to ensure the DOM is ready
}