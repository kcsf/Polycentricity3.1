// Patched click handlers for the D3CardBoard.svelte file

// First click handler (around line 1373-1375)
// Replace these lines:
//   popoverNode = node.data;
//   popoverNodeType = node.type;
// With:
   popoverNode = getOptimizedCardData(node);
   popoverNodeType = node.type;

// Second click handler (around line 1615-1617)
// Replace these lines:
//   popoverNode = node.data;
//   popoverNodeType = node.type;
// With:
   popoverNode = getOptimizedCardData(node);
   popoverNodeType = node.type;