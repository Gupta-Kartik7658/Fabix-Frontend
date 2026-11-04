'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import type { TourBeat, TourDetail, TourProgress as TourProgressValue, TourStep } from '@/lib/guided-tour';
import { TourProgress } from './TourProgress';

const SPEAKER = {
  guide: '#16C784',
  companion: '#F2A4C7',
} as const;

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

const PRIMARY =
  'inline-flex h-10 items-center gap-1.5 rounded-[11px] bg-[#16C784] px-4 text-[14px] font-semibold text-[#04130C] transition-colors hover:bg-[#69E6B0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16C784] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151D18]';
const QUIET =
  'h-10 rounded-[11px] px-2 text-[14px] font-medium text-[#91A49A] transition-colors hover:text-[#F5F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16C784]';

export function TourTooltip({
  step,
  progress,
  linesVisible,
  beat,
  details,
  note,
  reduced,
  isFirst,
  onPrimary,
  onSecondary,
  onBack,
  onSkip,
}: {
  step: TourStep;
  progress: TourProgressValue | null;
  linesVisible: boolean;
  beat: TourBeat | null;
  details: TourDetail[];
  note: string | null;
  reduced: boolean;
  isFirst: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const isStep = step.variant === 'step';
  const fade = reduced ? { duration: 0 } : { duration: 0.28, ease: EASE };
  const chip = beat
    ? { key: beat.target, label: beat.label, detail: beat.detail }
    : details[0]
      ? { key: details[0].label, label: details[0].label, detail: details[0].detail }
      : null;
  const press = reduced ? {} : { whileHover: { scale: 1.03 }, whileTap: { scale: 0.96 } };

  return (
    <div className="relative w-[min(400px,calc(100vw-24px))] rounded-[18px] border border-[#26332B] bg-[rgba(21,29,24,0.94)] px-5 pb-5 pt-5 text-[#F5F7F5] shadow-[0_16px_40px_rgba(0,0,0,0.32)] backdrop-blur-md sm:px-6">
      <div className="flex min-h-[22px] items-center justify-between gap-3">
        <TourProgress progress={progress} reduced={reduced} />
        {isStep && !isFirst && (
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip tour"
            className="-mr-2 flex size-8 items-center justify-center rounded-[9px] text-[#91A49A] transition-colors hover:bg-[#101713] hover:text-[#F5F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16C784]"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: linesVisible ? 1 : 0, y: linesVisible ? 0 : 4 }}
        transition={fade}
      >
        <h2 id="fabix-guided-tour-title" className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">
          {step.title}
        </h2>
        <div id="fabix-guided-tour-body" className="mt-3 space-y-2">
          {step.lines.map((line, index) => (
            <motion.p
              key={`${step.id}-${index}`}
              className="flex gap-2.5 text-[15px] leading-[1.5] text-[#D9E2DC]"
              initial={{ opacity: 0, x: -6 }}
              animate={linesVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
              transition={
                reduced || !linesVisible
                  ? { duration: reduced ? 0 : 0.15 }
                  : { duration: 0.3, ease: EASE, delay: 0.1 + index * 0.45 }
              }
            >
              <span
                aria-hidden
                className="mt-[8px] size-2 shrink-0 rounded-full"
                style={{ backgroundColor: SPEAKER[line.speaker] }}
              />
              <span>
                <span className="sr-only">{line.speaker === 'guide' ? 'Guide: ' : 'Companion: '}</span>
                {line.text}
              </span>
            </motion.p>
          ))}
        </div>

        {(chip || note) && (
          <div className="mt-4 min-h-[32px]">
            <AnimatePresence mode="wait" initial={false}>
              {chip ? (
                <motion.p
                  key={chip.key}
                  className="inline-flex max-w-full items-center gap-2 rounded-full bg-[rgba(22,199,132,0.10)] px-3 py-1.5 text-[13px]"
                  initial={{ opacity: 0, scale: 0.92, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -3 }}
                  transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 32 }}
                >
                  <span className="font-semibold text-[#16C784]">{chip.label}</span>
                  <span className="truncate text-[#91A49A]">{chip.detail}</span>
                </motion.p>
              ) : (
                <p className="text-[13px] text-[#91A49A]">{note}</p>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      <div className="mt-5 flex items-center justify-between gap-2">
        {isStep && isFirst && step.secondary ? (
          <button type="button" onClick={onSecondary} className={QUIET}>
            {step.secondary.label}
          </button>
        ) : isStep ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex size-10 items-center justify-center rounded-[11px] text-[#F5F7F5] ring-1 ring-inset ring-[#26332B] transition-colors hover:bg-[#101713] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16C784]"
          >
            <ArrowLeft size={16} />
          </button>
        ) : step.secondary ? (
          <button type="button" onClick={onSecondary} className={QUIET}>
            {step.secondary.label}
          </button>
        ) : (
          <span />
        )}
        <motion.button type="button" data-tour-primary onClick={onPrimary} className={PRIMARY} {...press}>
          {step.primary.label}
          {step.primary.action === 'next' && <ArrowRight size={16} />}
        </motion.button>
      </div>
    </div>
  );
}
