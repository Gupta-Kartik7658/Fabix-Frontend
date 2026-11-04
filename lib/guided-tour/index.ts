export { activityCenterTour } from './activity-center';
export { memoryTour } from './memory';
export { promptStudioTour } from './prompts';
export { GUIDED_TOUR_PENDING_KEY, GUIDED_TOUR_START_EVENT, requestGuidedTour } from './events';
export { chooseSpotlight, placeTooltip, toRect, tourProgress } from './placement';
export { readTourStatus, tourIdentity, writeTourStatus } from './storage';
export {
  MAX_PAGE_TOUR_STEPS,
  WORKSPACE_TOUR_REGISTRY,
  WORKSPACE_TOURS,
  resolveTourSteps,
  workspaceEntryForTour,
  workspaceTourKey,
} from './workspace';
export type {
  PageIntroduction,
  WorkspacePageId,
  WorkspacePageOnboarding,
  WorkspaceSectionId,
} from './workspace';
export type {
  GuidedTourDefinition,
  TourBeat,
  TourDetail,
  TourLine,
  TourProgress,
  TourSpeaker,
  TourStatus,
  TourStep,
} from './types';

import { activityCenterTour } from './activity-center';
import { memoryTour } from './memory';
import { promptStudioTour } from './prompts';
import type { GuidedTourDefinition } from './types';

/** Page tours registered with the engine. Add a definition here to cover another route. */
export const GUIDED_TOURS: GuidedTourDefinition[] = [activityCenterTour, memoryTour, promptStudioTour];
