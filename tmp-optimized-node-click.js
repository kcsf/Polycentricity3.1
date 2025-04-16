// Helper function to get the optimized card data for popover display
function getOptimizedCardData(node, cardsWithPosition) {
  // Make sure we're using our cached data with values and capabilities loaded
  if (node.type === 'actor') {
    // Find the card in our cardsWithPosition array that has values and capabilities loaded
    const cardWithDetails = cardsWithPosition.find(c => c.card_id === node.id);
    if (cardWithDetails) {
      // Use the card with preloaded details from our batch loading
      console.log("Using preloaded card data for popover with values and capabilities");
      return cardWithDetails;
    } else {
      // Fallback to the node data if not found in our cache
      console.log("Using node data for popover (not found in cache)");
      return node.data;
    }
  } else {
    // For agreements, just use the node data
    return node.data;
  }
}