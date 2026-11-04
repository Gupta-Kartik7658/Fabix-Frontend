export const GUIDED_TOUR_START_EVENT = 'fabix:guided-tour-start';
export const GUIDED_TOUR_PENDING_KEY = 'fabix_guided_tour_pending';

export type GuidedTourStartDetail = {
  tourId: string | null;
};

/** Ask the provider to start a tour. Omit `tourId` to use the tour for the current page. */
export function requestGuidedTour(tourId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<GuidedTourStartDetail>(GUIDED_TOUR_START_EVENT, {
      detail: { tourId: tourId ?? null },
    }),
  );
}
