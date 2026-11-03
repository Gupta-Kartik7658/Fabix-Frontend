import type { ReactNode } from 'react';

export function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1.5 text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
        {label}
        {optional && <span className="text-[11.5px] font-normal text-[var(--neutral-soft-400)]">Optional</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-[var(--neutral-soft-400)]">{hint}</span>}
    </label>
  );
}
