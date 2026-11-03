'use client';

import { Braces } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VariableDetail, VariableOccurrence } from './prompt-model';

export function VariableInspector({
  variables,
  activeVariable,
  onSelect,
  onReveal,
  className,
}: {
  variables: VariableDetail[];
  activeVariable: string | null;
  onSelect: (name: string | null) => void;
  onReveal: (occurrence: VariableOccurrence) => void;
  className?: string;
}) {
  return (
    <aside
      aria-label="Variable inspector"
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-[var(--ps-border)] bg-[var(--ps-sidebar)]',
        className,
      )}
    >
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--ps-border)] px-3.5">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--ps-text-2)]">Variables</h3>
        <span className="font-mono text-[11px] tabular-nums text-[var(--ps-muted)]">{variables.length}</span>
      </header>

      {variables.length === 0 ? (
        <div className="px-3.5 py-4">
          <p className="text-[12.5px] font-medium text-[var(--ps-text-2)]">No variables yet</p>
          <p className="mt-1 text-[12px] leading-[1.55] text-[var(--ps-muted)]">
            Wrap a name in curly braces, like{' '}
            <code className="rounded-[3px] bg-[rgba(121,184,245,0.10)] font-mono text-[var(--ps-blue)]">{'{repo}'}</code>
            , and it is detected here.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {variables.map((variable) => {
            const active = variable.name === activeVariable;
            const count = variable.occurrences.length;
            const lines = [...new Set(variable.occurrences.map((o) => o.line))];
            return (
              <li key={variable.name}>
                <div
                  className={cn(
                    'mx-1 rounded-[7px] px-2.5 py-2 transition-colors duration-150',
                    active ? 'bg-[rgba(121,184,245,0.08)]' : 'hover:bg-[var(--ps-raised)]',
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onSelect(active ? null : variable.name);
                      if (!active && variable.occurrences[0]) onReveal(variable.occurrences[0]);
                    }}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <code
                      className={cn(
                        'min-w-0 truncate rounded-[3px] px-1 font-mono text-[12.5px] text-[var(--ps-blue)]',
                        active ? 'bg-[rgba(121,184,245,0.22)]' : 'bg-[rgba(121,184,245,0.10)]',
                      )}
                    >
                      {`{${variable.name}}`}
                    </code>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--ps-muted)]">
                      {count}×
                    </span>
                  </button>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="mr-0.5 text-[11px] text-[var(--ps-muted)]">{lines.length === 1 ? 'Line' : 'Lines'}</span>
                    {lines.map((line) => {
                      const occurrence = variable.occurrences.find((o) => o.line === line)!;
                      return (
                        <button
                          key={line}
                          type="button"
                          onClick={() => {
                            onSelect(variable.name);
                            onReveal(occurrence);
                          }}
                          className="rounded-[4px] bg-[var(--ps-raised)] px-1.5 font-mono text-[10.5px] leading-[18px] tabular-nums text-[var(--ps-text-2)] transition-colors duration-150 hover:bg-[var(--ps-border)] hover:text-[var(--ps-text)]"
                        >
                          {line}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="hidden shrink-0 items-start gap-2 border-t border-[var(--ps-border)] px-3.5 py-2.5 xl:flex">
        <Braces size={12} className="mt-[3px] shrink-0 text-[var(--ps-muted)]" />
        <p className="text-[11px] leading-[1.5] text-[var(--ps-muted)]">
          Detected from <span className="font-mono">{'{braces}'}</span> in the body. Click one to highlight it.
        </p>
      </footer>
    </aside>
  );
}
