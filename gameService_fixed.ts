/**
 * This function subscribes to game wedges (agreements with positions)
 * @param gameId - Game ID
 * @param callback - Callback for agreement updates
 * @returns Unsubscribe function
 */
export function subscribeToGameWedges(gameId: string, callback: (agreements: AgreementWithPosition[]) => void): () => void {
  log(`Subscribing to agreements for game: ${gameId}`);
  const gun = getGun();
  if (!gun) {
    logError('Gun not initialized');
    callback([]);
    return () => {};
  }