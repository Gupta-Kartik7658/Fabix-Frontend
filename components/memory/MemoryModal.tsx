'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';

/** Modal with a pinned header and footer; only the body scrolls. */
export function MemoryModal({
  open,
  onRequestClose,
  title,
  description,
  width,
  children,
  footer,
  initialFocusRef,
}: {
  open: boolean;
  /** Called for Escape, backdrop click and the close button. */
  onRequestClose: () => void;
  title: string;
  description?: ReactNode;
  width: number;
  children: ReactNode;
  footer: ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onRequestClose);

  useEffect(() => {
    closeRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => {
      const target =
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>('input, textarea, button');
      target?.focus();
    }, 60);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(id);
    };
  }, [open, initialFocusRef]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-[rgba(2,4,3,0.66)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast, ease: EASE.emph }}
            onClick={() => closeRef.current()}
          />
          <div className="pointer-events-none fixed inset-0 z-[71] flex items-center justify-center p-4">
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              style={{ maxWidth: width }}
              className="pointer-events-auto flex max-h-[calc(100dvh-32px)] w-full flex-col overflow-hidden rounded-[12px] border border-[var(--mm-border-strong)] bg-[var(--mm-panel)] shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6, transition: { duration: DUR.fast } }}
              transition={{ duration: DUR.default, ease: EASE.emph }}
            >
              <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-5">
                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-[var(--mm-text)]">
                    {title}
                  </h2>
                  {description && (
                    <div className="mt-1 text-[13px] leading-[1.55] text-[var(--mm-text-2)]">
                      {description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => closeRef.current()}
                  aria-label="Close dialog"
                  className="-mr-1.5 -mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[7px] text-[var(--mm-muted)] transition-colors duration-150 hover:bg-[var(--mm-elevated)] hover:text-[var(--mm-text)]"
                >
                  <X size={15} />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--mm-border)] bg-[var(--mm-panel)] px-6 py-3.5">
                {footer}
              </footer>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function ModalButton({
  variant = 'secondary',
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      type="button"
      {...props}
      className={[
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-medium transition-colors duration-150 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-[var(--mm-green)] font-semibold text-[#04130c] hover:bg-[var(--mm-mint)] disabled:bg-[var(--mm-elevated)] disabled:text-[var(--mm-muted)]'
          : 'bg-[var(--mm-elevated)] text-[var(--mm-text-2)] ring-1 ring-inset ring-[var(--mm-border)] hover:text-[var(--mm-text)] disabled:opacity-50',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
