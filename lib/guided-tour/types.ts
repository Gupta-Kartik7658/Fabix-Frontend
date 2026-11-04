export type TourSpeaker = 'guide' | 'companion';

export type TourLine = {
  speaker: TourSpeaker;
  text: string;
};

export type TourBeat = {
  /** `data-tour` value of the element to emphasize inside this step. */
  target: string;
  label: string;
  detail: string;
};

export type TourDetail = {
  label: string;
  detail: string;
};

export type TourStepVariant = 'intro' | 'step' | 'finale';

export type TourStep = {
  id: string;
  title: string;
  variant: TourStepVariant;
  lines: TourLine[];
  /** `data-tour` value of the element to spotlight. Omitted for centered steps. */
  target?: string;
  /** Sibling elements folded into the spotlight with `target`, so no wrapper is needed. */
  alsoTargets?: string[];
  /** Sequential emphasis inside the spotlight. Does not change application state. */
  beats?: TourBeat[];
  /** Extra rows derived from the live target, so the copy can follow real UI. */
  describeTarget?: (element: HTMLElement | null) => TourDetail[];
  footnote?: string;
  /** Shown instead of a spotlight when the target is not in the page. */
  missingTargetNote?: string;
  /** Drop the step entirely when its target is not rendered at start time. */
  optional?: boolean;
  /** Dialogue used instead of `lines` while `target` is not rendered. */
  linesWithout?: { target: string; lines: TourLine[] };
  primary: { label: string; action: 'next' | 'complete' };
  secondary?: { label: string; action: 'skip' | 'replay' };
};

export type PageIntroduction = {
  id: string;
  title: string;
  lines: TourLine[];
  startLabel: string;
  dismissLabel: string;
};

export type GuidedTourDefinition = {
  id: string;
  /** Pathname that owns this tour. Used for auto-start and replay navigation. */
  route?: string;
  autoStart?: boolean;
  /** When set, a first visit offers this card instead of starting the tour. */
  introduction?: PageIntroduction;
  steps: TourStep[];
};

export type TourStatus = 'completed' | 'skipped' | 'unseen';

export type TourProgress = {
  current: number;
  total: number;
};
