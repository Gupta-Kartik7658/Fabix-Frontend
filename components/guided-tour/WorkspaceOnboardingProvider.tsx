'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import { useUser } from '@/lib/hooks';
import {
  GUIDED_TOUR_START_EVENT,
  WORKSPACE_TOUR_REGISTRY,
  readTourStatus,
  resolveTourSteps,
  tourIdentity,
  workspaceEntryForTour,
  workspaceTourKey,
  writeTourStatus,
  type GuidedTourDefinition,
  type WorkspacePageId,
  type WorkspacePageOnboarding,
  type WorkspaceSectionId,
} from '@/lib/guided-tour';
import type { GuidedTourStartDetail } from '@/lib/guided-tour/events';
import { GuidedTour } from './GuidedTour';
import { PageIntroduction } from './PageIntroduction';
import { queryTour } from './query';

type Running = {
  entry: WorkspacePageOnboarding;
  tour: GuidedTourDefinition;
  at: string;
};

const INTRO_DELAY_MS = 700;

/**
 * Progressive onboarding for one workspace room. The room greets you once
 * per workspace; each section greets you once, the first time you open it.
 * Every page keeps its own status, so skipping one never touches another.
 */
export function WorkspaceOnboardingProvider({
  workspaceId,
  section,
  ready,
}: {
  workspaceId: string;
  section: WorkspaceSectionId;
  ready: boolean;
}) {
  const { user, isLoading } = useUser();
  const identity = tourIdentity(user);
  const reduced = !!useReducedMotion();
  const here = `${workspaceId}:${section}`;

  const [intro, setIntro] = useState<{ page: WorkspacePageId; at: string } | null>(null);
  const [running, setRunning] = useState<Running | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [quiet, setQuiet] = useState<string | null>(null);

  if (running && running.at !== here) {
    setRunning(null);
  }

  const statusOf = useCallback(
    (page: WorkspacePageId) => readTourStatus(identity, workspaceTourKey(WORKSPACE_TOUR_REGISTRY[page], workspaceId)),
    [identity, workspaceId],
  );

  const mark = useCallback(
    (entry: WorkspacePageOnboarding, status: 'completed' | 'skipped') => {
      const key = workspaceTourKey(entry, workspaceId);
      if (status === 'skipped' && readTourStatus(identity, key) !== 'unseen') return;
      writeTourStatus(identity, key, status);
    },
    [identity, workspaceId],
  );

  const start = useCallback(
    (entry: WorkspacePageOnboarding) => {
      const steps = resolveTourSteps(entry.tour.steps, (target) => queryTour(target) !== null);
      setIntro(null);
      setStepIndex(0);
      setRunning({ entry, tour: { ...entry.tour, steps }, at: here });
    },
    [here],
  );

  useEffect(() => {
    if (!ready || isLoading || running) return;
    let next: WorkspacePageId | null = null;
    if (statusOf('workspace') === 'unseen') next = 'workspace';
    else if (quiet !== here && statusOf(section) === 'unseen') next = section;
    const shown = intro && intro.at === here ? intro.page : null;
    if (shown === next) return;
    const timer = window.setTimeout(
      () => setIntro(next ? { page: next, at: here } : null),
      next ? INTRO_DELAY_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [here, intro, isLoading, quiet, ready, running, section, statusOf]);

  useEffect(() => {
    const onStart = (event: Event) => {
      const requested = (event as CustomEvent<GuidedTourStartDetail>).detail?.tourId;
      const entry = requested ? workspaceEntryForTour(requested) : WORKSPACE_TOUR_REGISTRY[section];
      if (entry) start(entry);
    };
    window.addEventListener(GUIDED_TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(GUIDED_TOUR_START_EVENT, onStart);
  }, [section, start]);

  const visibleIntro = intro && intro.at === here ? WORKSPACE_TOUR_REGISTRY[intro.page] : null;

  const dismissIntro = () => {
    if (!visibleIntro) return;
    mark(visibleIntro, 'skipped');
    if (visibleIntro.page === 'workspace') setQuiet(here);
    setIntro(null);
  };

  const startIntro = () => {
    if (!visibleIntro) return;
    if (visibleIntro.page === 'workspace') setQuiet(here);
    start(visibleIntro);
  };

  const finish = useCallback(() => {
    if (running) mark(running.entry, 'completed');
    setRunning(null);
  }, [mark, running]);

  const skip = useCallback(() => {
    if (running) mark(running.entry, 'skipped');
    setRunning(null);
  }, [mark, running]);

  const next = useCallback(() => {
    if (!running) return;
    if (stepIndex >= running.tour.steps.length - 1) finish();
    else setStepIndex(stepIndex + 1);
  }, [finish, running, stepIndex]);

  const back = useCallback(() => setStepIndex((index) => Math.max(0, index - 1)), []);
  const replay = useCallback(() => setStepIndex(0), []);

  return (
    <>
      <AnimatePresence>
        {visibleIntro && !running ? (
          <PageIntroduction
            key={`${visibleIntro.introduction.id}-${here}`}
            intro={visibleIntro.introduction}
            reduced={reduced}
            className={
              section === 'conversation'
                ? 'bottom-[112px] right-3 sm:right-6'
                : 'bottom-4 right-3 sm:bottom-6 sm:right-6'
            }
            onStart={startIntro}
            onDismiss={dismissIntro}
          />
        ) : null}
      </AnimatePresence>
      {running ? (
        <GuidedTour
          key={`${running.tour.id}-${running.at}`}
          tour={running.tour}
          stepIndex={stepIndex}
          onNext={next}
          onBack={back}
          onSkip={skip}
          onComplete={finish}
          onReplay={replay}
        />
      ) : null}
    </>
  );
}
