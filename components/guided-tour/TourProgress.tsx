'use client';

import { motion } from 'motion/react';
import type { TourProgress as TourProgressValue } from '@/lib/guided-tour';

export function TourProgress({
  progress,
  reduced,
}: {
  progress: TourProgressValue | null;
  reduced: boolean;
}) {
  if (!progress) return null;
  const label = `Step ${progress.current} of ${progress.total}`;

  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.current} aria-label={label}>
      <div className="flex items-center gap-1">
        {Array.from({ length: progress.total }).map((_, index) => {
          const done = index < progress.current;
          const current = index === progress.current - 1;
          return (
            <motion.span
              key={index}
              className="h-1.5 rounded-full"
              initial={false}
              animate={{
                width: current ? 16 : 6,
                backgroundColor: done ? '#16C784' : '#26332B',
              }}
              transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }}
            />
          );
        })}
      </div>
      <span className="text-[11px] font-medium tabular-nums text-[#91A49A]">
        {progress.current}/{progress.total}
      </span>
    </div>
  );
}
