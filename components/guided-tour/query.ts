/** First rendered element for a `data-tour` id; hidden panels still in the DOM are ignored. */
export function queryTour(id: string | undefined): HTMLElement | null {
  if (!id || typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll(`[data-tour="${CSS.escape(id)}"]`);
  for (const node of nodes) {
    if (node instanceof HTMLElement && node.getClientRects().length > 0) return node;
  }
  return null;
}
