/**
 * Custom radial label fix for d3 visualizations
 */
import * as d3 from 'd3';

/**
 * Apply direct CSS styles to fix radial labels
 * This forces the proper positioning and styling of radial labels
 */
export function fixRadialLabels() {
  // Target all text elements in radial labels
  const labelTexts = d3.selectAll('.label-container text');
  console.log(`Fixing ${labelTexts.size()} radial labels`);
  
  // Apply direct CSS styles to force the correct positioning and text size
  labelTexts.each(function() {
    const textElement = d3.select(this);
    
    // Force 8px font size
    textElement.style('font-size', '8px');
    textElement.style('font-family', 'sans-serif');
    textElement.style('font-weight', '400');
    textElement.style('opacity', '0.8');
    
    // Get the parent group's transform to calculate proper positioning
    const parentGroup = d3.select(this.parentNode);
    const line = parentGroup.select('line');
    
    if (!line.empty()) {
      // Get the coordinates from the adjacent line which shows the gap
      const x1 = line.attr('x1');
      const y1 = line.attr('y1');
      const x2 = line.attr('x2');
      const y2 = line.attr('y2');
      
      // Use the starting point (x1,y1) which is 10% away from outer ring
      // This ensures the text is positioned exactly 10% away from the donut ring
      textElement.attr('x', x1);
      textElement.attr('y', y1);
      
      // Extract current rotation if any
      const currentTransform = textElement.attr('transform');
      if (currentTransform && currentTransform.includes('rotate')) {
        const rotationMatch = currentTransform.match(/rotate\(([^,]+),([^,]+),([^)]+)\)/);
        if (rotationMatch && rotationMatch.length >= 4) {
          const angle = rotationMatch[1];
          // Apply rotation around the new position
          textElement.attr('transform', `rotate(${angle},${x1},${y1})`);
        }
      }
    }
  });
  
  console.log('Radial label fix applied successfully');
}