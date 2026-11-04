'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { tourProgress, type GuidedTourDefinition, type TourBeat } from '@/lib/guided-tour';
import {
  chooseSpotlight,
  placeTooltip,
  toRect,
  type Placement,
  type Rect,
} from '@/lib/guided-tour/placement';
import { cn } from '@/lib/utils';
import { FabixRobot, type RobotPose } from './FabixRobot';
import { TourSpotlight } from './TourSpotlight';
import { TourTooltip } from './TourTooltip';
import { queryTour } from './query';

type Frame = {
  hole: Rect | null;
  ring: Rect | null;
  top: number;
  left: number;
  placement: Placement;
  compact: boolean;
  targetMissing: boolean;
};

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

function pointFor(placement: Placement): RobotPose {
  if (placement === 'left') return 'point-right';
  if (placement === 'right') return 'point-left';
  if (placement === 'bottom') return 'point-up';
  if (placement === 'top') return 'point-down';
  return 'idle';
}

const NO_BEATS: TourBeat[] = [];

function groupRect(primary: HTMLElement, extra: string[] | undefined): Rect {
  let box = primary.getBoundingClientRect();
  let { top, left, right, bottom } = box;
  for (const id of extra ?? []) {
    const node = queryTour(id);
    if (!node) continue;
    box = node.getBoundingClientRect();
    top = Math.min(top, box.top);
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
    bottom = Math.max(bottom, box.bottom);
  }
  return toRect({ top, left, right, bottom, width: right - left, height: bottom - top });
}

function offscreen(rect: DOMRect): boolean {
  return (
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.bottom < 72 ||
    rect.top > window.innerHeight - 72 ||
    rect.right < 8 ||
    rect.left > window.innerWidth - 8
  );
}

export function GuidedTour({
  tour,
  stepIndex,
  onNext,
  onBack,
  onSkip,
  onComplete,
  onReplay,
}: {
  tour: GuidedTourDefinition;
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
  onReplay: () => void;
}) {
  const reduced = !!useReducedMotion();
  const [visual, setVisual] = useState(stepIndex);
  const [linesOn, setLinesOn] = useState(true);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [beatIndex, setBeatIndex] = useState(0);
  const [beatStepId, setBeatStepId] = useState(tour.steps[stepIndex]?.id ?? '');
  const clusterRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef(stepIndex);
  const measureRef = useRef(() => {});
  const lockRef = useRef(false);
  const restoreRef = useRef<HTMLElement | null>(null);

  const baseStep = tour.steps[visual] ?? tour.steps[0];
  const swapLines = Boolean(baseStep.linesWithout && !queryTour(baseStep.linesWithout.target));
  const visualStep = useMemo(
    () => (swapLines && baseStep.linesWithout ? { ...baseStep, lines: baseStep.linesWithout.lines } : baseStep),
    [baseStep, swapLines],
  );

  if (beatStepId !== visualStep.id) {
    setBeatStepId(visualStep.id);
    setBeatIndex(0);
  }

  if (stepIndex !== visual && linesOn) {
    setLinesOn(false);
  }

  const allBeats = visualStep.beats ?? NO_BEATS;
  const presentKey = allBeats
    .filter((item) => queryTour(item.target))
    .map((item) => item.target)
    .join('|');
  const beats = useMemo(
    () => allBeats.filter((item) => presentKey.split('|').includes(item.target)),
    [allBeats, presentKey],
  );
  const activeBeat = beats.length ? beatIndex % beats.length : 0;
  const beatTarget = beats[activeBeat]?.target;

  useEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      restoreRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (stepIndex === visualRef.current) return;
    let cancelled = false;
    const fade = reduced ? 0 : 180;
    const move = reduced ? 0 : 460;
    let showTimer = 0;
    const moveTimer = window.setTimeout(() => {
      if (cancelled) return;
      visualRef.current = stepIndex;
      setVisual(stepIndex);
      showTimer = window.setTimeout(() => {
        if (!cancelled) setLinesOn(true);
      }, move);
    }, fade);
    return () => {
      cancelled = true;
      window.clearTimeout(moveTimer);
      window.clearTimeout(showTimer);
    };
  }, [stepIndex, reduced]);

  useEffect(() => {
    const count = beats.length;
    if (!linesOn || count < 2) return;
    const id = window.setInterval(() => {
      setBeatIndex((index) => (index + 1) % count);
    }, reduced ? 3200 : 1900);
    return () => window.clearInterval(id);
  }, [beats, linesOn, reduced]);

  const [placed, setPlaced] = useState(false);
  const hasFrame = frame !== null;
  useEffect(() => {
    if (!hasFrame) return;
    const id = window.requestAnimationFrame(() => setPlaced(true));
    return () => window.cancelAnimationFrame(id);
  }, [hasFrame]);

  const [talker, setTalker] = useState<string | null>(null);
  useEffect(() => {
    if (!linesOn || reduced) return;
    const [first, second] = visualStep.lines;
    const timers = [
      window.setTimeout(() => setTalker(first?.speaker ?? null), 100),
      window.setTimeout(() => setTalker(second?.speaker ?? null), 650),
      window.setTimeout(() => setTalker(null), 1500),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [visualStep, linesOn, reduced]);

  useEffect(() => {
    const step = tour.steps[visual];
    const target = queryTour(step?.target);
    if (!target) return;
    if (!offscreen(target.getBoundingClientRect())) return;
    target.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [visual, tour, reduced]);

  useEffect(() => {
    const beat = queryTour(beatTarget);
    if (!beat) return;
    if (!offscreen(beat.getBoundingClientRect())) return;
    beat.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [beatTarget, reduced]);

  useEffect(() => {
    const step = tour.steps[visual];
    if (!step?.target) return;
    if (queryTour(step.target)) {
      measureRef.current();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!queryTour(step.target)) return;
      measureRef.current();
      observer.disconnect();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tour'],
    });
    return () => observer.disconnect();
  }, [visual, tour]);

  useLayoutEffect(() => {
    const measure = () => {
      const cluster = clusterRef.current;
      if (!cluster) return;
      const step = tour.steps[visual] ?? tour.steps[0];
      const groupEl = queryTour(step.target);
      const beatEl = queryTour(beatTarget);
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const chosen = chooseSpotlight(
        groupEl ? groupRect(groupEl, step.alsoTargets) : null,
        beatEl ? toRect(beatEl.getBoundingClientRect()) : null,
        viewport.height,
      );
      const compact = viewport.width < 720;
      const pos = placeTooltip(
        chosen.hole,
        { width: cluster.offsetWidth, height: cluster.offsetHeight },
        viewport,
      );
      const next: Frame = {
        hole: chosen.hole,
        ring: reduced ? null : chosen.ring,
        top: pos.top,
        left: pos.left,
        placement: pos.placement,
        compact,
        targetMissing: Boolean(step.target) && !groupEl,
      };
      setFrame((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.placement === next.placement &&
          prev.compact === next.compact &&
          prev.targetMissing === next.targetMissing &&
          sameRect(prev.hole, next.hole) &&
          sameRect(prev.ring, next.ring)
        ) {
          return prev;
        }
        return next;
      });
    };

    measureRef.current = measure;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const cluster = clusterRef.current;
    const observer = new ResizeObserver(measure);
    if (cluster) observer.observe(cluster);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      observer.disconnect();
    };
  }, [visual, beatTarget, reduced, tour]);

  useEffect(() => {
    const stop = (event: Event) => {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && dialog.contains(event.target)) return;
      event.preventDefault();
    };
    window.addEventListener('wheel', stop, { passive: false, capture: true });
    window.addEventListener('touchmove', stop, { passive: false, capture: true });
    return () => {
      window.removeEventListener('wheel', stop, { capture: true });
      window.removeEventListener('touchmove', stop, { capture: true });
    };
  }, []);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.contains(active) && active !== root) return;
    root.querySelector<HTMLElement>('[data-tour-primary]')?.focus();
  }, [visual]);

  const guarded = (fn: () => void) => {
    if (lockRef.current) return;
    lockRef.current = true;
    fn();
    window.setTimeout(() => {
      lockRef.current = false;
    }, reduced ? 0 : 680);
  };

  const actionsRef = useRef({ onBack, onComplete, onNext, onSkip, variant: visualStep.variant, reduced });
  useEffect(() => {
    actionsRef.current = { onBack, onComplete, onNext, onSkip, variant: visualStep.variant, reduced };
  }, [onBack, onComplete, onNext, onSkip, reduced, visualStep.variant]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const actions = actionsRef.current;
      const go = (fn: () => void) => {
        if (lockRef.current) return;
        lockRef.current = true;
        fn();
        window.setTimeout(() => {
          lockRef.current = false;
        }, actions.reduced ? 0 : 680);
      };
      if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (actions.variant === 'finale') actions.onComplete();
        else actions.onSkip();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        if (actions.variant === 'finale') actions.onComplete();
        else go(actions.onNext);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        event.stopPropagation();
        go(actions.onBack);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')].filter(
      (node) => !node.hasAttribute('disabled'),
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!visualStep) return null;

  const progress = tourProgress(tour.steps, visual);
  const targetEl = queryTour(visualStep.target);
  const details = visualStep.describeTarget ? visualStep.describeTarget(targetEl) : [];
  const note = frame?.targetMissing ? (visualStep.missingTargetNote ?? null) : null;
  const placement = frame?.placement ?? 'center';
  const pose: RobotPose =
    visualStep.variant === 'finale' ? 'cheer' : visualStep.variant === 'intro' ? 'idle' : pointFor(placement);
  const robotsRight = placement === 'left';
  const beat = beats[activeBeat] ?? null;

  const runPrimary = () => {
    if (visualStep.primary.action === 'complete') onComplete();
    else guarded(onNext);
  };
  const runSecondary = () => {
    const action = visualStep.secondary?.action;
    if (action === 'skip') onSkip();
    else if (action === 'replay') onReplay();
  };

  const announcement = linesOn
    ? `${progress ? `Step ${progress.current} of ${progress.total}. ` : ''}${visualStep.title}. ${visualStep.lines
        .map((line) => `${line.speaker === 'guide' ? 'Guide' : 'Companion'}: ${line.text}`)
        .join(' ')}`
    : '';

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0" />
      <TourSpotlight hole={frame?.hole ?? null} ring={frame?.ring ?? null} reduced={reduced} />
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fabix-guided-tour-title"
        aria-describedby="fabix-guided-tour-body"
        onKeyDown={onDialogKeyDown}
        className="absolute left-0 top-0"
        initial={false}
        animate={{
          x: frame?.left ?? 12,
          y: frame?.top ?? 12,
          opacity: frame ? 1 : 0,
          scale: frame ? 1 : 0.94,
        }}
        transition={
          reduced
            ? { duration: 0 }
            : placed
              ? { type: 'spring', stiffness: 260, damping: 30, mass: 0.9, opacity: { duration: 0.2 } }
              : {
                  x: { duration: 0 },
                  y: { duration: 0 },
                  opacity: { duration: 0.25 },
                  scale: { type: 'spring', stiffness: 380, damping: 22 },
                }
        }
      >
        <div ref={clusterRef} className="flex w-max max-w-[calc(100vw-24px)] flex-col">
          <div
            className={cn(
              'relative z-10 -mb-[9px] flex items-end gap-1 px-4',
              robotsRight ? 'justify-end' : 'justify-start',
            )}
          >
            <FabixRobot
              variant="white"
              pose={pose}
              talking={talker === 'guide'}
              cue={visual}
              reduced={reduced}
              className="h-[72px] w-[58px] sm:h-[92px] sm:w-[74px]"
            />
            <FabixRobot
              variant="pink"
              pose={pose}
              talking={talker === 'companion'}
              cue={visual}
              enterDelay={0.25}
              reduced={reduced}
              className="h-[64px] w-[51px] sm:h-[82px] sm:w-[66px]"
            />
          </div>
          <TourTooltip
            step={visualStep}
            progress={progress}
            linesVisible={linesOn}
            beat={beat}
            details={details}
            note={note}
            reduced={reduced}
            isFirst={visual === 0}
            onPrimary={runPrimary}
            onSecondary={runSecondary}
            onBack={() => guarded(onBack)}
            onSkip={onSkip}
          />
        </div>
      </motion.div>
    </div>
  );
}
