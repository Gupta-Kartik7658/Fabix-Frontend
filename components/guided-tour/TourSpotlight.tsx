'use client';

import { motion } from 'motion/react';
import type { Rect } from '@/lib/guided-tour/placement';

const PAD = 8;
const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export function TourSpotlight({
  hole,
  ring,
  reduced,
}: {
  hole: Rect | null;
  ring: Rect | null;
  reduced: boolean;
}) {
  const move = reduced ? { duration: 0 } : { duration: 0.46, ease: EASE };
  const box = hole
    ? { top: hole.top - PAD, left: hole.left - PAD, width: hole.width + PAD * 2, height: hole.height + PAD * 2 }
    : null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <motion.div
        className="absolute inset-0 bg-[rgba(8,11,9,0.72)]"
        initial={false}
        animate={{ opacity: box ? 0 : 1 }}
        transition={{ duration: reduced ? 0 : 0.3 }}
      />
      {box && (
        <>
          <motion.div
            className="absolute rounded-[14px]"
            style={{ boxShadow: '0 0 0 1.5px #16C784, 0 0 0 9999px rgba(8, 11, 9, 0.68)' }}
            initial={reduced ? box : { ...box, opacity: 0 }}
            animate={{ ...box, opacity: 1 }}
            transition={move}
          />
          {!reduced && (
            <motion.div
              className="absolute rounded-[14px] border border-[#16C784]"
              initial={false}
              animate={{
                ...box,
                opacity: [0.5, 0],
                scale: [1, 1.035],
              }}
              transition={{
                top: move,
                left: move,
                width: move,
                height: move,
                opacity: { duration: 1.8, repeat: Infinity, ease: 'easeOut' },
                scale: { duration: 1.8, repeat: Infinity, ease: 'easeOut' },
              }}
            />
          )}
        </>
      )}
      {ring && (
        <motion.div
          className="absolute rounded-[12px] border-[1.5px] border-[#16C784] bg-[rgba(22,199,132,0.06)]"
          initial={false}
          animate={{ top: ring.top - 4, left: ring.left - 4, width: ring.width + 8, height: ring.height + 8 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
        />
      )}
    </div>
  );
}
