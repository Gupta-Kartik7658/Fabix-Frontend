'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import type { PageIntroduction as PageIntroductionContent } from '@/lib/guided-tour';
import { cn } from '@/lib/utils';
import { FabixRobot } from './FabixRobot';

const SPEAKER = {
  guide: '#16C784',
  companion: '#F2A4C7',
} as const;

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

/**
 * Small, non-modal greeting for a page. It never traps focus or dims the
 * page, so the room stays usable while it is on screen.
 */
export function PageIntroduction({
  intro,
  reduced,
  className,
  onStart,
  onDismiss,
}: {
  intro: PageIntroductionContent;
  reduced: boolean;
  className?: string;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const [talker, setTalker] = useState<string | null>(null);

  useEffect(() => {
    if (reduced) return;
    const [first, second] = intro.lines;
    const timers = [
      window.setTimeout(() => setTalker(first?.speaker ?? null), 500),
      window.setTimeout(() => setTalker(second?.speaker ?? null), 1100),
      window.setTimeout(() => setTalker(null), 1900),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [intro, reduced]);

  return (
    <motion.section
      role="region"
      aria-label={`${intro.title} introduction`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
      className={cn('fixed z-[60] flex w-[min(360px,calc(100vw-24px))] flex-col', className)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
      transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 28 }}
    >
      <div className="relative z-10 -mb-[8px] flex items-end gap-1 px-4">
        <FabixRobot
          variant="white"
          pose="idle"
          talking={talker === 'guide'}
          reduced={reduced}
          enterDelay={0.1}
          className="h-[60px] w-[48px] sm:h-[72px] sm:w-[58px]"
        />
        <FabixRobot
          variant="pink"
          pose="idle"
          talking={talker === 'companion'}
          reduced={reduced}
          enterDelay={0.3}
          className="h-[54px] w-[43px] sm:h-[64px] sm:w-[51px]"
        />
      </div>
      <div className="relative rounded-[16px] border border-[#26332B] bg-[rgba(21,29,24,0.96)] px-4 pb-4 pt-4 text-[#F5F7F5] shadow-[0_16px_40px_rgba(0,0,0,0.32)] backdrop-blur-md">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close introduction"
          className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-[8px] text-[#91A49A] transition-colors hover:bg-[#101713] hover:text-[#F5F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16C784]"
        >
          <X size={14} />
        </button>
        <h2 className="pr-8 text-[15.5px] font-semibold tracking-[-0.015em]">{intro.title}</h2>
        <div className="mt-2 space-y-1.5">
          {intro.lines.map((line, index) => (
            <motion.p
              key={`${intro.id}-${index}`}
              className="flex gap-2 text-[13.5px] leading-[1.5] text-[#D9E2DC]"
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.3, ease: EASE, delay: 0.35 + index * 0.5 }}
            >
              <span
                aria-hidden
                className="mt-[7px] size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: SPEAKER[line.speaker] }}
              />
              <span>
                <span className="sr-only">{line.speaker === 'guide' ? 'Guide: ' : 'Companion: '}</span>
                {line.text}
              </span>
            </motion.p>
          ))}
        </div>
        <div className="mt-3.5 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onDismiss}
            className="h-9 rounded-[10px] px-2.5 text-[13px] font-medium text-[#91A49A] transition-colors hover:text-[#F5F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16C784]"
          >
            {intro.dismissLabel}
          </button>
          <motion.button
            type="button"
            onClick={onStart}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[#16C784] px-3.5 text-[13px] font-semibold text-[#04130C] transition-colors hover:bg-[#69E6B0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16C784] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151D18]"
            {...(reduced ? {} : { whileHover: { scale: 1.03 }, whileTap: { scale: 0.96 } })}
          >
            {intro.startLabel}
            <ArrowRight size={14} />
          </motion.button>
        </div>
      </div>
    </motion.section>
  );
}
