'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Tone } from './activity-model';

/** Fabix Activity Center tokens, applied inline on the page root. */
export const ACTIVITY_THEME = {
  '--ac-bg': '#080B09',
  '--ac-sidebar': '#0B0F0D',
  '--ac-card': '#101713',
  '--ac-elevated': '#141C17',
  '--ac-border': '#202B25',
  '--ac-green': '#00B879',
  '--ac-mint': '#69E6B0',
  '--ac-text': '#F2F7F3',
  '--ac-text-2': '#A2B3A9',
  '--ac-muted': '#718078',
  '--ac-blue': '#55BCE5',
  '--ac-amber': '#E9B65C',
  '--ac-red': '#F07878',
  backgroundColor: '#080B09',
  color: '#F2F7F3',
  colorScheme: 'dark',
} as CSSProperties;

const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-[rgba(0,184,121,0.12)] text-[var(--ac-mint)]',
  info: 'bg-[rgba(85,188,229,0.12)] text-[var(--ac-blue)]',
  warning: 'bg-[rgba(233,182,92,0.12)] text-[var(--ac-amber)]',
  error: 'bg-[rgba(240,120,120,0.12)] text-[var(--ac-red)]',
  muted: 'bg-[rgba(162,179,169,0.10)] text-[var(--ac-text-2)]',
};

const DOT_CLASSES: Record<Tone, string> = {
  green: 'bg-[var(--ac-green)]',
  info: 'bg-[var(--ac-blue)]',
  warning: 'bg-[var(--ac-amber)]',
  error: 'bg-[var(--ac-red)]',
  muted: 'bg-[var(--ac-muted)]',
};

export function ToneBadge({
  tone,
  children,
  dot = false,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-[5px] px-1.5 text-[11px] font-medium leading-none',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOT_CLASSES[tone])} />}
      {children}
    </span>
  );
}

export function ACSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-[5px] bg-[var(--ac-elevated)] motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export function MetricCard({
  label,
  value,
  description,
  href,
  loading,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  href: string;
  loading: boolean;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex h-[112px] flex-col justify-between rounded-[12px] border border-[var(--ac-border)] bg-[var(--ac-card)] p-5 transition-colors duration-200 hover:bg-[var(--ac-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,184,121,0.45)]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ac-muted)]">
          {label}
        </p>
        <span className="text-[var(--ac-muted)] transition-colors duration-200 group-hover:text-[var(--ac-mint)]">
          {icon}
        </span>
      </div>
      {loading ? (
        <div>
          <ACSkeleton className="h-7 w-16" />
          <ACSkeleton className="mt-2 h-3 w-28" />
        </div>
      ) : (
        <div className="min-w-0">
          <p className="text-[26px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--ac-text)]">
            {value}
          </p>
          <p className="mt-2 truncate text-[12px] leading-none text-[var(--ac-text-2)]">{description}</p>
        </div>
      )}
    </Link>
  );
}

export function Panel({
  title,
  href,
  linkLabel,
  error,
  onRetry,
  loading,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  error: string | null;
  onRetry: () => void;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[12px] border border-[var(--ac-border)] bg-[var(--ac-card)]">
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ac-text)]">{title}</h2>
        <Link
          href={href}
          className="text-[12px] font-medium text-[var(--ac-muted)] transition-colors duration-150 hover:text-[var(--ac-mint)]"
        >
          {linkLabel} →
        </Link>
      </header>
      <div className="flex-1 px-5 pb-5">
        {loading && (
          <div className="flex flex-col gap-4 pt-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <ACSkeleton className="h-3.5 w-2/3" />
                <ACSkeleton className="mt-2 h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-start gap-2 py-4">
            <p className="text-[13px] leading-[1.5] text-[var(--ac-red)]">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="text-[12px] font-medium text-[var(--ac-text-2)] underline-offset-2 transition-colors duration-150 hover:text-[var(--ac-text)] hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && children}
      </div>
    </section>
  );
}

export function PanelEmpty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="py-4">
      <p className="text-[13px] font-medium text-[var(--ac-text)]">{title}</p>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ac-muted)]">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-3 inline-flex text-[12.5px] font-medium text-[var(--ac-mint)] hover:text-[var(--ac-text)]"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
