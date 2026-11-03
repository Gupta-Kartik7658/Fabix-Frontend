'use client';

import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectorIssue, ConnectorState } from './connector-model';

const STATE_META: Record<ConnectorState, { label: string; dot: string; text: string }> = {
  connected: { label: 'Connected', dot: 'bg-[var(--cx-success)]', text: 'text-[var(--cx-text)]' },
  attention: { label: 'Attention', dot: 'bg-[var(--cx-warning)]', text: 'text-[var(--cx-warning)]' },
  disabled: { label: 'Disabled', dot: 'bg-[var(--cx-text-3)]', text: 'text-[var(--cx-text-2)]' },
  not_configured: {
    label: 'Not configured',
    dot: 'border border-[var(--cx-text-3)] bg-transparent',
    text: 'text-[var(--cx-text-2)]',
  },
};

export function StatusBadge({ state, className }: { state: ConnectorState; className?: string }) {
  const meta = STATE_META[state];
  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--cx-border)] bg-[var(--cx-surface-2)] px-2 text-[11.5px] font-medium',
        meta.text,
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

type BtnTone = 'primary' | 'secondary' | 'ghost';

export function Btn({
  tone = 'secondary',
  busy,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: BtnTone;
  busy?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 text-[12.5px] font-medium outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-[rgba(57,185,130,0.45)] disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'primary' &&
          'bg-[#168653] text-white hover:bg-[#1A9660] active:bg-[#12744A]',
        tone === 'secondary' &&
          'border border-[var(--cx-border)] bg-[var(--cx-surface)] text-[var(--cx-text)] hover:border-[var(--cx-border-strong)] hover:bg-[var(--cx-surface-2)]',
        tone === 'ghost' &&
          'text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text)]',
        className,
      )}
      {...rest}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> : icon}
      {children}
    </button>
  );
}

/** Human summary first; the redacted provider error sits behind a toggle. */
export function IssueNotice({
  issue,
  name,
  onTest,
  testing,
  compact = false,
}: {
  issue: ConnectorIssue;
  name: string;
  onTest?: () => void;
  testing?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!issue.detail) return;
    try {
      await navigator.clipboard.writeText(issue.detail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be unavailable in insecure contexts.
    }
  };

  return (
    <div className={cn(compact ? 'mt-1.5' : 'rounded-[10px] border border-[var(--cx-border)] bg-[var(--cx-surface-2)] p-3')}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="flex min-w-0 items-start gap-1.5 text-[12.5px] leading-[1.45] text-[var(--cx-text)]">
          <AlertCircle className="mt-[2px] size-3.5 shrink-0 text-[var(--cx-error)]" strokeWidth={2} />
          <span className="min-w-0">
            {compact ? null : <span className="font-medium">{name} — </span>}
            {issue.summary}
          </span>
        </p>
        {issue.detail && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-0.5 rounded-[5px] text-[12px] font-medium text-[var(--cx-text-3)] outline-none hover:text-[var(--cx-text)] focus-visible:ring-1 focus-visible:ring-[var(--cx-accent)]"
          >
            {open ? 'Hide details' : 'Details'}
            <ChevronDown
              className={cn('size-3.5 transition-transform', open && 'rotate-180')}
              strokeWidth={2}
            />
          </button>
        )}
      </div>
      {open && issue.detail && (
        <div className="mt-2 overflow-hidden rounded-[8px] border border-[var(--cx-border)] bg-[var(--cx-bg)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--cx-border)] px-3 py-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--cx-text-3)]">
              Diagnostic · secrets redacted
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-[11.5px] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text)]"
              >
                {copied ? <Check className="size-3" strokeWidth={2.2} /> : <Copy className="size-3" strokeWidth={2} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              {onTest && (
                <button
                  type="button"
                  onClick={onTest}
                  disabled={testing}
                  className="inline-flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-[11.5px] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text)] disabled:opacity-50"
                >
                  <RotateCw className={cn('size-3', testing && 'animate-spin')} strokeWidth={2} />
                  {testing ? 'Testing…' : 'Test again'}
                </button>
              )}
            </div>
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[var(--cx-text-2)]">
            {issue.detail}
          </pre>
        </div>
      )}
    </div>
  );
}
