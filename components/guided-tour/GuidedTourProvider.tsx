'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import { useUser } from '@/lib/hooks';
import {
  GUIDED_TOURS,
  GUIDED_TOUR_PENDING_KEY,
  GUIDED_TOUR_START_EVENT,
  readTourStatus,
  resolveTourSteps,
  tourIdentity,
  writeTourStatus,
  type TourStep,
} from '@/lib/guided-tour';
import type { GuidedTourStartDetail } from '@/lib/guided-tour/events';
import {
  PRODUCT_TOUR_STATUS_EVENT,
  getProductTourStatus,
  hasChosenWorkspaceMode,
} from '@/lib/productTour';
import { GuidedTour } from './GuidedTour';
import { PageIntroduction } from './PageIntroduction';
import { queryTour } from './query';

/**
 * Page-agnostic tour host. Register another page by adding a definition to
 * `GUIDED_TOURS`; this provider starts, persists, and renders it.
 */
export function GuidedTourProvider({
  children,
  suspended = false,
}: {
  children: ReactNode;
  suspended?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useUser();
  const identity = tourIdentity(user);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [gate, setGate] = useState(0);
  const [intro, setIntro] = useState<{ tourId: string; route: string } | null>(null);
  const reduced = !!useReducedMotion();

  const [resolved, setResolved] = useState<TourStep[] | null>(null);
  const base = GUIDED_TOURS.find((item) => item.id === activeId) ?? null;
  const tour = useMemo(() => (base && resolved ? { ...base, steps: resolved } : null), [base, resolved]);
  const introTour =
    intro && intro.route === pathname && !activeId
      ? (GUIDED_TOURS.find((item) => item.id === intro.tourId) ?? null)
      : null;

  const skip = useCallback(() => {
    if (activeId && readTourStatus(identity, activeId) === 'unseen') {
      writeTourStatus(identity, activeId, 'skipped');
    }
    setActiveId(null);
  }, [activeId, identity]);

  const complete = useCallback(() => {
    if (activeId) writeTourStatus(identity, activeId, 'completed');
    setActiveId(null);
  }, [activeId, identity]);

  const next = useCallback(() => {
    if (!tour) return;
    const step = tour.steps[stepIndex];
    if (!step || step.variant === 'finale' || stepIndex >= tour.steps.length - 1) {
      complete();
      return;
    }
    setStepIndex(stepIndex + 1);
  }, [tour, stepIndex, complete]);

  const back = useCallback(() => {
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  const replay = useCallback(() => {
    setStepIndex(0);
  }, []);

  const begin = useCallback((tourId: string) => {
    const match = GUIDED_TOURS.find((item) => item.id === tourId);
    if (!match) return;
    setIntro(null);
    setResolved(resolveTourSteps(match.steps, (target) => queryTour(target) !== null));
    setActiveId(match.id);
    setStepIndex(0);
  }, []);

  const openTour = useCallback(
    (tourId: string) => {
      const match = GUIDED_TOURS.find((item) => item.id === tourId);
      if (!match) return;
      if (match.route && match.route !== pathname) {
        try {
          sessionStorage.setItem(GUIDED_TOUR_PENDING_KEY, match.id);
        } catch {
          /* sessionStorage can be blocked */
        }
        router.push(match.route);
        return;
      }
      begin(match.id);
    },
    [begin, pathname, router],
  );

  useEffect(() => {
    const bump = () => setGate((value) => value + 1);
    window.addEventListener(PRODUCT_TOUR_STATUS_EVENT, bump);
    return () => window.removeEventListener(PRODUCT_TOUR_STATUS_EVENT, bump);
  }, []);

  useEffect(() => {
    const onStart = (event: Event) => {
      const requested = (event as CustomEvent<GuidedTourStartDetail>).detail?.tourId;
      const match = requested
        ? GUIDED_TOURS.find((item) => item.id === requested)
        : (GUIDED_TOURS.find((item) => item.route === pathname) ??
          GUIDED_TOURS.find((item) => item.id === 'activity-center'));
      if (match) openTour(match.id);
    };
    window.addEventListener(GUIDED_TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(GUIDED_TOUR_START_EVENT, onStart);
  }, [openTour, pathname]);

  useEffect(() => {
    if (isLoading || suspended || activeId) return;

    const params = new URLSearchParams(window.location.search);
    const requested = params.get('guidedTour');
    if (requested) {
      params.delete('guidedTour');
      const query = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
      );
      const timer = window.setTimeout(() => openTour(requested), 0);
      return () => window.clearTimeout(timer);
    }

    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(GUIDED_TOUR_PENDING_KEY);
    } catch {
      pending = null;
    }
    if (pending) {
      const pendingTour = GUIDED_TOURS.find((item) => item.id === pending);
      if (!pendingTour || (pendingTour.route && pendingTour.route !== pathname)) return;
      const timer = window.setTimeout(() => {
        try {
          sessionStorage.removeItem(GUIDED_TOUR_PENDING_KEY);
        } catch {
          /* ignore */
        }
        begin(pendingTour.id);
      }, 600);
      return () => window.clearTimeout(timer);
    }

    if (!hasChosenWorkspaceMode()) return;
    if (getProductTourStatus() === 'pending') return;
    if (params.get('tour') === '1') return;

    const auto = GUIDED_TOURS.find((item) => item.autoStart && item.route === pathname);
    if (!auto || readTourStatus(identity, auto.id) !== 'unseen') return;
    if (auto.introduction && intro?.tourId === auto.id && intro.route === pathname) return;

    const timer = window.setTimeout(() => {
      if (auto.introduction) {
        setIntro({ tourId: auto.id, route: pathname });
        return;
      }
      begin(auto.id);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeId, begin, gate, identity, intro, isLoading, openTour, pathname, suspended]);

  const startIntro = () => {
    if (introTour) begin(introTour.id);
  };

  const dismissIntro = () => {
    if (!introTour) return;
    if (readTourStatus(identity, introTour.id) === 'unseen') writeTourStatus(identity, introTour.id, 'skipped');
    setIntro(null);
  };

  return (
    <>
      {children}
      <AnimatePresence>
        {introTour?.introduction && !suspended ? (
          <PageIntroduction
            key={introTour.introduction.id}
            intro={introTour.introduction}
            reduced={reduced}
            className="bottom-4 right-3 sm:bottom-6 sm:right-6"
            onStart={startIntro}
            onDismiss={dismissIntro}
          />
        ) : null}
      </AnimatePresence>
      {tour ? (
        <GuidedTour
          tour={tour}
          stepIndex={stepIndex}
          onNext={next}
          onBack={back}
          onSkip={skip}
          onComplete={complete}
          onReplay={replay}
        />
      ) : null}
    </>
  );
}
