'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { KeyRound, Loader2 } from 'lucide-react';
import { api, AuthError, getApiErrorCode, getApiErrorMessage } from '@/lib/api';
import { buildSecretEntryPath, storePostAuthRedirect } from '@/lib/authRedirect';
import {
  isApiUnreachable,
  isLocalSecretEntryPreview,
  loadSecretEntry,
  redactSecret,
  submitSecretEntry,
  type SecretEntryOperation,
  type SecretEntryPreview,
  type SecretEntryScope,
  type SecretEntrySubmitResult,
} from '@/lib/secret-entry';
import { FabixLogo } from '@/components/ui/FabixLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeUp, staggerContainer } from '@/lib/motion';

function operationLabel(operation: SecretEntryOperation): string {
  switch (operation) {
    case 'create':
      return 'Create';
    case 'update':
      return 'Update';
    case 'delete':
      return 'Delete';
  }
}

function scopeLabel(scope: SecretEntryScope): string {
  switch (scope) {
    case 'repo':
      return 'Repository';
    case 'environment':
      return 'Environment';
    case 'organization':
      return 'Organization';
  }
}

function introCopy(preview: SecretEntryPreview): string {
  if (preview.status === 'expired') return 'This link has expired.';
  if (preview.status === 'used') return 'This link has already been used.';
  if (preview.status === 'saved') return successCopy(preview.operation);
  if (preview.status === 'failed') {
    return preview.operation === 'delete'
      ? 'This secret was not deleted from GitHub.'
      : 'This secret was not saved to GitHub.';
  }
  if (preview.operation === 'delete') {
    return 'This removes the secret from GitHub. There is no value to enter.';
  }
  if (preview.operation === 'update') {
    return 'Replace the value for this secret. It is sent once and is not shown again.';
  }
  return 'Enter the value for this secret. It is sent once to GitHub and is not shown again.';
}

function successCopy(operation: SecretEntryOperation): string {
  return operation === 'delete' ? 'Deleted from GitHub.' : 'Saved to GitHub.';
}

export function SecretEntryClient({ token }: { token: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const entryPath = useMemo(() => buildSecretEntryPath(token), [token]);
  const [preview, setPreview] = useState<SecretEntryPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [apiDown, setApiDown] = useState(false);
  const [contractPending, setContractPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretValue, setSecretValue] = useState('');
  const [secretVisible, setSecretVisible] = useState(false);
  const [result, setResult] = useState<SecretEntrySubmitResult | null>(null);

  const goToAuth = useCallback(() => {
    storePostAuthRedirect(entryPath);
    router.replace(`/auth?next=${encodeURIComponent(entryPath)}`);
  }, [entryPath, router]);

  const load = useCallback(async () => {
    storePostAuthRedirect(entryPath);
    setLoading(true);
    setError(null);
    setApiDown(false);
    setContractPending(false);
    try {
      // Demo fixtures never touch the API. A real token checks the session first.
      if (!isLocalSecretEntryPreview(token)) {
        await api.getUserDetails();
      }
      setNeedsAuth(false);
      const next = await loadSecretEntry(token);
      setPreview(next);
    } catch (err) {
      if (isApiUnreachable(err)) {
        setApiDown(true);
        setPreview(null);
        return;
      }
      if (err instanceof AuthError) {
        setNeedsAuth(true);
        setPreview(null);
        return;
      }
      const code = getApiErrorCode(err);
      if (code === 'SECRET_ENTRY_CONTRACT_PENDING') {
        setContractPending(true);
        setPreview(null);
        return;
      }
      if (code === 'SECRET_ENTRY_WRONG_USER') {
        setError('This link was sent to a different account.');
        setPreview(null);
        return;
      }
      if (code === 'SECRET_ENTRY_EXPIRED') {
        setError('This link has expired.');
        setPreview(null);
        return;
      }
      if (code === 'SECRET_ENTRY_USED') {
        setError('This link has already been used.');
        setPreview(null);
        return;
      }
      setError(
        getApiErrorMessage(
          err,
          code === 'SECRET_ENTRY_NOT_FOUND'
            ? 'This link was not found.'
            : 'Could not load this link.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [entryPath, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const terminal =
    preview != null && preview.status !== 'pending';
  const canSubmit =
    !!preview &&
    preview.status === 'pending' &&
    !needsAuth &&
    !contractPending &&
    !result &&
    !terminal;

  const handleSubmit = async () => {
    if (!preview || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const value = secretValue;
    try {
      const next = await submitSecretEntry(token, preview, value);
      setSecretValue('');
      setSecretVisible(false);
      setResult(next);
      setPreview((current) =>
        current
          ? { ...current, status: next.status === 'saved' ? 'saved' : 'failed' }
          : current,
      );
      if (next.status === 'failed' && next.detail) {
        setError(redactSecret(next.detail, value));
      }
    } catch (err) {
      if (err instanceof AuthError) {
        goToAuth();
        return;
      }
      const code = getApiErrorCode(err);
      if (code === 'SECRET_ENTRY_EXPIRED') {
        setPreview((prev) => (prev ? { ...prev, status: 'expired' } : prev));
        setSecretValue('');
        setSecretVisible(false);
      } else if (code === 'SECRET_ENTRY_USED') {
        setPreview((prev) => (prev ? { ...prev, status: 'used' } : prev));
        setSecretValue('');
        setSecretVisible(false);
      } else if (code === 'SECRET_ENTRY_WRONG_USER') {
        setPreview(null);
        setSecretValue('');
        setSecretVisible(false);
        setError('This link was sent to a different account.');
      } else if (code === 'SECRET_ENTRY_GITHUB_FAILED' || code === 'SECRET_ENTRY_GITHUB_MISSING') {
        setError(redactSecret(getApiErrorMessage(err, 'GitHub did not save this secret.'), value));
      } else {
        setError(redactSecret(getApiErrorMessage(err, 'Could not save this secret.'), value));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showValueField = canSubmit && preview?.operation !== 'delete';
  const title = preview?.secret_name ?? 'GitHub secret';

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)]">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="Fabix home">
          <FabixLogo className="h-7 text-[var(--neutral-strong-950)]" />
        </Link>
        <Link
          href="/dashboard"
          className="text-[12.5px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
        >
          Open dashboard
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <motion.section
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="w-full max-w-[480px] rounded-[14px] border border-[var(--stroke-soft-200)] bg-white p-6 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--primary-base)]"
          >
            GitHub Actions
          </motion.p>
          <motion.div variants={fadeUp} className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--primary-alpha-10)]">
              <KeyRound className="h-4 w-4 text-[var(--primary-base)]" strokeWidth={2} />
            </div>
            <h1 className="min-w-0 break-all font-mono text-[18px] font-semibold leading-[1.3] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
              {loading ? 'Checking this link…' : title}
            </h1>
          </motion.div>

          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-[var(--neutral-sub-600)]">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Checking this link…
            </div>
          ) : (
            <>
              <motion.p
                variants={fadeUp}
                className="text-[14px] leading-[1.6] text-[var(--neutral-sub-600)]"
              >
                {needsAuth
                  ? 'Sign in to open this one-time link. You will come back to this same page.'
                  : apiDown
                    ? 'The Aegis API is down, so this link was not checked. This is not a bad token.'
                    : contractPending
                      ? 'This link cannot collect a secret yet. The save route is not published, so nothing on this page is sent to GitHub.'
                      : preview
                        ? introCopy(preview)
                        : 'This link could not be loaded.'}
              </motion.p>

              {preview && !needsAuth && (
                <dl className="mt-4 grid grid-cols-[108px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                  <dt className="text-[var(--neutral-sub-600)]">Operation</dt>
                  <dd className="text-[var(--neutral-strong-950)]">
                    {operationLabel(preview.operation)}
                  </dd>
                  <dt className="text-[var(--neutral-sub-600)]">Owner</dt>
                  <dd className="break-all text-[var(--neutral-strong-950)]">{preview.owner}</dd>
                  {preview.repo && (
                    <>
                      <dt className="text-[var(--neutral-sub-600)]">Repository</dt>
                      <dd className="break-all font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                        {preview.repo}
                      </dd>
                    </>
                  )}
                  <dt className="text-[var(--neutral-sub-600)]">Scope</dt>
                  <dd className="text-[var(--neutral-strong-950)]">{scopeLabel(preview.scope)}</dd>
                  {preview.environment && (
                    <>
                      <dt className="text-[var(--neutral-sub-600)]">Environment</dt>
                      <dd className="break-all text-[var(--neutral-strong-950)]">
                        {preview.environment}
                      </dd>
                    </>
                  )}
                </dl>
              )}

              {showValueField && (
                <form
                  className="mt-4"
                  method="post"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                  }}
                >
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]" htmlFor="secret-value">
                    Secret value
                  </label>
                  <Input
                    id="secret-value"
                    type={secretVisible ? 'text' : 'password'}
                    value={secretValue}
                    onChange={(event) => setSecretValue(event.target.value)}
                    placeholder="Paste the value"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={submitting}
                    trailingIcon={
                      <button
                        type="button"
                        className="text-[12px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
                        onClick={() => setSecretVisible((visible) => !visible)}
                        aria-pressed={secretVisible}
                      >
                        {secretVisible ? 'Hide' : 'Show'}
                      </button>
                    }
                  />
                </form>
              )}

              {error && (
                <p className="mt-3 text-[13px] text-[var(--error-dark)]">{error}</p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {needsAuth && (
                  <Button variant="primary" size="md" onClick={goToAuth}>
                    Sign in to continue
                  </Button>
                )}
                {canSubmit && (
                  <Button
                    variant={preview?.operation === 'delete' ? 'danger' : 'primary'}
                    size="md"
                    onClick={() => void handleSubmit()}
                    disabled={submitting || (showValueField && secretValue.length === 0)}
                  >
                    {submitting
                      ? preview?.operation === 'delete'
                        ? 'Deleting…'
                        : 'Saving…'
                      : preview?.operation === 'delete'
                        ? 'Delete from GitHub'
                        : 'Save to GitHub'}
                  </Button>
                )}
              </div>
            </>
          )}
        </motion.section>
      </main>
    </div>
  );
}
