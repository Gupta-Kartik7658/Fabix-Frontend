'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SCRUM_AGENT_HANDLE } from '@/lib/scrumAgent';

/** Prompt input for the workspace's Scrum Agent. Nothing is posted to the conversation directly. */
export function ScrumPromptBox({
  onSend,
  disabled,
  focusSignal = 0,
}: {
  onSend: (prompt: string) => Promise<void>;
  disabled?: boolean;
  /** Bumped by the parent to pull focus here, e.g. from the `/` shortcut. */
  focusSignal?: number;
}) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusSignal > 0) textareaRef.current?.focus();
  }, [focusSignal]);

  const submit = async () => {
    const text = value.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    try {
      await onSend(text);
      setValue('');
    } catch {
      // The parent reports the failure; keep the text so it can be resent.
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  return (
    <div className="w-full px-4 pb-3 pt-2 sm:px-6">
      <div
        data-input-shell
        className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] transition-colors focus-within:border-[var(--stroke-sub-300)]"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled || sending}
          placeholder="Tell the Scrum Agent what to do…"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          className="block h-10 w-full resize-none overflow-y-auto !border-0 !bg-transparent px-3.5 pb-1 pt-2.5 text-[13.5px] leading-[1.5] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:outline-none focus:ring-0 focus-visible:shadow-none [appearance:none] [-webkit-appearance:none]"
          style={{ border: 'none', boxShadow: 'none', background: 'transparent', color: 'var(--neutral-strong-950)', WebkitTextFillColor: 'var(--neutral-strong-950)' }}
        />
        <div className="flex items-center gap-1 px-3.5 pb-2 pt-0.5">
          <span className="hidden min-w-0 truncate text-[11.5px] text-[var(--neutral-soft-400)] sm:inline">
            Prompting <span className="font-mono text-[var(--neutral-sub-600)]">@{SCRUM_AGENT_HANDLE}</span>
            <span aria-hidden> · </span>
            Enter to send, Shift+Enter for a new line
          </span>
          <Button
            type="button"
            variant="primary"
            size="sm"
            aria-label={sending ? 'Sending' : 'Send to Scrum Agent'}
            leadingIcon={<ArrowUp size={14} strokeWidth={2.5} />}
            onClick={() => void submit()}
            disabled={!value.trim() || sending || disabled}
            className="ml-auto size-8 !h-8 !w-8 rounded-full !px-0"
          />
        </div>
      </div>
    </div>
  );
}
