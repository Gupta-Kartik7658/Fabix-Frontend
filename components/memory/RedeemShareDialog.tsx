'use client';

import { useRef, useState } from 'react';
import { AlertCircle, ClipboardPaste, Loader2 } from 'lucide-react';
import { api, AuthError, getApiErrorCode, getApiErrorMessage } from '@/lib/api';
import type { Memory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MemoryModal, ModalButton } from './MemoryModal';
import { extractShareCode } from './memory-model';

type Phase = 'idle' | 'checking' | 'importing';

const CODE_MESSAGES: Record<string, string> = {
  MEMORY_SHARE_NOT_FOUND: 'No shared memory matches this code. Check it and try again.',
  MEMORY_SHARE_REVOKED: 'The owner revoked this share link.',
  MEMORY_SHARE_EXPIRED: 'This share link has expired. Ask the owner for a new one.',
  MEMORY_SHARE_EXHAUSTED: 'This share link has reached its use limit.',
  MEMORY_SHARE_OWN: 'This is your own memory, so there is nothing to import.',
};

const STATUS_MESSAGES: Record<string, string> = {
  revoked: CODE_MESSAGES.MEMORY_SHARE_REVOKED,
  expired: CODE_MESSAGES.MEMORY_SHARE_EXPIRED,
  exhausted: CODE_MESSAGES.MEMORY_SHARE_EXHAUSTED,
};

export function RedeemShareDialog({
  open,
  onClose,
  onImported,
  onAlreadyImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (memory: Memory | null) => void;
  onAlreadyImported: (memoryId: string | null) => void;
}) {
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [canPaste] = useState(
    () => typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function',
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const code = extractShareCode(value);
  const busy = phase !== 'idle';

  const close = () => {
    if (busy) return;
    setValue('');
    setError(null);
    onClose();
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setValue(text.trim());
        setError(null);
      }
    } catch {
      setError('Clipboard access was blocked. Paste the code with Ctrl+V instead.');
    }
    inputRef.current?.focus();
  };

  const submit = async () => {
    if (!code || busy) return;
    setError(null);
    setPhase('checking');
    try {
      const preview = await api.getMemorySharePreview(code);
      if (preview.already_owned) {
        setError(CODE_MESSAGES.MEMORY_SHARE_OWN);
        return;
      }
      if (preview.status !== 'pending') {
        setError(STATUS_MESSAGES[preview.status] ?? 'This share link is no longer active.');
        return;
      }
      if (preview.already_redeemed) {
        setValue('');
        onAlreadyImported(preview.redeemed_memory_id ?? null);
        return;
      }

      setPhase('importing');
      let result;
      try {
        result = await api.redeemMemoryShare(code);
      } catch (err) {
        if (getApiErrorCode(err) !== 'MEMORY_SHARE_REDEEM_CONFLICT') throw err;
        result = await api.redeemMemoryShare(code);
      }
      setValue('');
      if (result.already_redeemed) onAlreadyImported(result.memory?.id ?? null);
      else onImported(result.memory ?? null);
    } catch (err) {
      if (err instanceof AuthError) return;
      const errorCode = getApiErrorCode(err);
      setError(
        (errorCode && CODE_MESSAGES[errorCode]) ||
          getApiErrorMessage(err, 'Could not import this memory. Try again.'),
      );
    } finally {
      setPhase('idle');
    }
  };

  return (
    <MemoryModal
      open={open}
      onRequestClose={close}
      title="Import shared memory"
      description="Paste a share code or link. Importing adds your own independent copy — later changes by the owner will not affect it."
      width={480}
      initialFocusRef={inputRef}
      footer={
        <>
          <ModalButton onClick={close} disabled={busy}>
            Cancel
          </ModalButton>
          <ModalButton variant="primary" onClick={() => void submit()} disabled={!code || busy}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {phase === 'checking' ? 'Checking code…' : phase === 'importing' ? 'Importing…' : 'Import memory'}
          </ModalButton>
        </>
      }
    >
      <label htmlFor="memory-share-code" className="mb-1.5 block text-[12.5px] font-medium text-[var(--mm-text-2)]">
        Share code
      </label>
      <div
        data-input-shell
        className={cn(
          'flex h-10 items-center rounded-[9px] border transition-colors duration-150',
          error ? 'border-[rgba(240,120,120,0.55)]' : 'border-[var(--mm-border)] focus-within:border-[rgba(0,184,121,0.6)]',
        )}
        style={{ background: 'var(--mm-bg)' }}
      >
        <input
          id="memory-share-code"
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submit();
            }
          }}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          placeholder="Code or https://…/memory/share/…"
          aria-invalid={Boolean(error)}
          aria-describedby="memory-share-code-hint"
          style={{ background: 'transparent', border: 0 }}
          className="h-full min-w-0 flex-1 px-3 font-mono text-[13px] text-[var(--mm-text)] outline-none placeholder:font-sans placeholder:text-[var(--mm-muted)] disabled:opacity-60"
        />
        {canPaste && (
          <button
            type="button"
            onClick={() => void paste()}
            disabled={busy}
            className="mr-1.5 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium text-[var(--mm-text-2)] transition-colors duration-150 hover:bg-[var(--mm-elevated)] hover:text-[var(--mm-text)] disabled:opacity-50"
          >
            <ClipboardPaste size={13} />
            Paste
          </button>
        )}
      </div>
      <div id="memory-share-code-hint" aria-live="polite" className="mt-2 min-h-[18px]">
        {error ? (
          <p className="flex items-start gap-1.5 text-[12px] leading-[1.5] text-[var(--mm-red)]">
            <AlertCircle size={13} className="mt-[2px] shrink-0" />
            {error}
          </p>
        ) : (
          <p className="text-[12px] text-[var(--mm-muted)]">
            {value && code !== value.trim() ? (
              <>
                Using code <span className="font-mono text-[var(--mm-text-2)]">{code}</span>
              </>
            ) : (
              'Share links look like …/memory/share/abc123. The code is the last part.'
            )}
          </p>
        )}
      </div>
    </MemoryModal>
  );
}
