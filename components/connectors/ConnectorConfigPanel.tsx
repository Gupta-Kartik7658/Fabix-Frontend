'use client';

/**
 * Connector configuration — shared by the Integrations drawer and the
 * `/dashboard/connectors/[id]` page.
 *
 * Fields come from the catalog private_config_schema. Saved secrets are
 * never returned by the API, so saved fields render as masked
 * placeholders and only new values are sent. Test runs against the
 * already-saved credentials (POST /setup/{key}/test).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, EyeOff, Lock, RotateCw, X } from 'lucide-react';
import { CatalogIcon } from '@/components/connectors/CatalogIcon';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { parsePrivateCredentialFields, type CredentialFieldDef } from '@/lib/connectorCredentials';
import type { ConnectorCatalogItem, PrivateConnectorCredentialStatus } from '@/lib/types';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  CONNECTOR_THEME,
  catalogDescription,
  connectorCategory,
  connectorName,
  connectorState,
  credentialSummary,
  describeConnectorIssue,
  formatTestedClock,
} from './connector-model';
import { Btn, IssueNotice, StatusBadge } from './ConnectorParts';

type PanelProps = {
  connectorKey: string;
  catalogItem: ConnectorCatalogItem | null;
  status: PrivateConnectorCredentialStatus | null;
  onStatusChange: (status: PrivateConnectorCredentialStatus) => void;
};

function useConnectorConfig({ connectorKey, catalogItem, status, onStatusChange }: PanelProps) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setValues({});
    setShowSecret({});
    setFormError(null);
  }, [connectorKey]);

  const name = connectorName(connectorKey, catalogItem);
  const fields = useMemo(
    () => parsePrivateCredentialFields(connectorKey, catalogItem),
    [connectorKey, catalogItem],
  );
  const configured = !!status?.configured;
  const state = connectorState(status);
  const issue = describeConnectorIssue(connectorKey, status);
  const requiredKeys = fields.filter((f) => f.required).map((f) => f.key);
  const filledRequired = requiredKeys.every((k) => (values[k] ?? '').trim().length > 0);
  const dirty = fields.some((f) => (values[f.key] ?? '').trim().length > 0);
  const canSave = fields.length > 0 && (configured ? dirty : filledRequired);
  const canTest = configured && !status?.revoked_at;

  const reportTest = (tested: PrivateConnectorCredentialStatus, savedFirst: boolean) => {
    const testIssue = describeConnectorIssue(connectorKey, tested);
    if (tested.last_error) {
      toast.error(savedFirst ? 'Saved, but the connection test failed' : 'Connection test failed', {
        description: testIssue?.summary,
      });
    } else {
      toast.success(savedFirst ? `${name} saved and connected` : `${name} is connected`);
    }
  };

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setFormError(null);
    const payload: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.key] ?? '').trim();
      if (v) payload[f.key] = v;
    }
    try {
      const saved = await api.savePrivateConnectorCredentials(connectorKey, payload);
      onStatusChange(saved);
      setValues({});
      setShowSecret({});
      try {
        const tested = await api.testPrivateConnectorCredentials(connectorKey);
        onStatusChange(tested);
        reportTest(tested, true);
      } catch (err) {
        toast.error('Saved, but the test could not run', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save credentials.';
      setFormError(msg);
      toast.error('Save failed', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!canTest || testing) return;
    setTesting(true);
    setFormError(null);
    try {
      const tested = await api.testPrivateConnectorCredentials(connectorKey);
      onStatusChange(tested);
      reportTest(tested, false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not test the connection.';
      setFormError(msg);
      toast.error('Connection test failed', { description: msg });
    } finally {
      setTesting(false);
    }
  };

  const toggle = async (next: boolean) => {
    setToggling(true);
    try {
      onStatusChange(await api.setConnectorEnabled(connectorKey, next));
      toast.success(next ? `${name} enabled` : `${name} disabled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the integration.');
    } finally {
      setToggling(false);
    }
  };

  return {
    name,
    fields,
    configured,
    state,
    issue,
    values,
    setValues,
    showSecret,
    setShowSecret,
    saving,
    testing,
    toggling,
    formError,
    dirty,
    canSave,
    canTest,
    save,
    test,
    toggle,
    reset: () => {
      setValues({});
      setShowSecret({});
      setFormError(null);
    },
  };
}

type Config = ReturnType<typeof useConnectorConfig>;

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cx-text-3)]">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ConnectionSection({ config, status }: { config: Config; status: PrivateConnectorCredentialStatus | null }) {
  const { state, issue, configured, canTest, testing, toggling, name } = config;
  const enabled = state === 'connected';
  const testedAt = status?.last_tested_at;

  return (
    <Section title="Connection">
      <div className="rounded-[10px] border border-[var(--cx-border)] bg-[var(--cx-surface)]">
        <dl className="divide-y divide-[var(--cx-border)] text-[13px]">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-[var(--cx-text-2)]">Status</dt>
            <dd>
              <StatusBadge state={state} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-[var(--cx-text-2)]">Last tested</dt>
            <dd className="text-right text-[var(--cx-text)]">
              {testedAt ? (
                <>
                  {formatRelativeTime(testedAt)}
                  <span className="ml-1.5 text-[var(--cx-text-3)]">· {formatTestedClock(testedAt)}</span>
                </>
              ) : (
                <span className="text-[var(--cx-text-3)]">{configured ? 'Not tested yet' : '—'}</span>
              )}
            </dd>
          </div>
          {configured && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt>
                <span className="block text-[var(--cx-text-2)]">Available to agents</span>
                <span className="mt-0.5 block text-[12px] text-[var(--cx-text-3)]">
                  {state === 'attention'
                    ? 'Fix the connection to enable it again.'
                    : enabled
                      ? 'Agents can use these credentials.'
                      : 'Credentials are kept, but agents cannot use them.'}
                </span>
              </dt>
              <dd>
                <Switch
                  checked={enabled}
                  disabled={toggling || state === 'attention'}
                  onChange={(next) => void config.toggle(next)}
                  ariaLabel={`${enabled ? 'Disable' : 'Enable'} ${name}`}
                />
              </dd>
            </div>
          )}
        </dl>
        {(issue || canTest) && (
          <div className="space-y-3 border-t border-[var(--cx-border)] px-4 py-3">
            {issue && (
              <IssueNotice issue={issue} name={name} onTest={canTest ? () => void config.test() : undefined} testing={testing} />
            )}
            {canTest && (
              <Btn
                tone="secondary"
                onClick={() => void config.test()}
                busy={testing}
                icon={<RotateCw className="size-3.5" strokeWidth={2} />}
              >
                {testing ? 'Testing connection…' : 'Test connection'}
              </Btn>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function CredentialField({
  field,
  saved,
  value,
  show,
  onChange,
  onToggleShow,
}: {
  field: CredentialFieldDef;
  saved: boolean;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggleShow: () => void;
}) {
  const id = `cred-${field.key}`;
  const masked = field.secret || field.inputType === 'password';
  const type = masked ? (show ? 'text' : 'password') : field.inputType === 'url' ? 'url' : 'text';
  const placeholder = saved
    ? masked
      ? '•••••••••••• saved — enter a new value to replace'
      : 'Saved — enter a new value to replace'
    : field.placeholder;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <label htmlFor={id} className="text-[12.5px] font-medium text-[var(--cx-text)]">
          {field.label}
        </label>
        {saved ? (
          <span className="rounded-full border border-[var(--cx-border)] px-1.5 text-[10.5px] font-medium leading-[16px] text-[var(--cx-text-2)]">
            Saved
          </span>
        ) : field.required ? (
          <span className="text-[11px] text-[var(--cx-text-3)]">Required</span>
        ) : (
          <span className="text-[11px] text-[var(--cx-text-3)]">Optional</span>
        )}
      </div>
      <div
        data-input-shell
        className="flex h-9 items-center rounded-[8px] border border-[var(--cx-border)] bg-[var(--cx-bg)] transition-colors focus-within:border-[#2F7A57] hover:border-[var(--cx-border-strong)]"
      >
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={masked ? 'new-password' : 'off'}
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-[12.5px] outline-none placeholder:font-sans placeholder:text-[var(--cx-text-3)]"
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            color: '#F0F3F1',
            WebkitTextFillColor: '#F0F3F1',
          }}
        />
        {masked && (
          <button
            type="button"
            onClick={onToggleShow}
            aria-label={show ? `Hide ${field.label}` : `Show ${field.label}`}
            className="mr-1 flex size-7 items-center justify-center rounded-[6px] text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text)]"
          >
            {show ? <EyeOff className="size-3.5" strokeWidth={2} /> : <Eye className="size-3.5" strokeWidth={2} />}
          </button>
        )}
      </div>
      {field.description && (
        <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--cx-text-3)]">{field.description}</p>
      )}
    </div>
  );
}

function CredentialsSection({ config, status }: { config: Config; status: PrivateConnectorCredentialStatus | null }) {
  const { fields, values, showSecret, formError } = config;
  const configuredKeys = status?.configured_keys ?? [];

  return (
    <Section
      title="Credentials"
      aside={
        status?.updated_at && config.configured ? (
          <span className="text-[11.5px] text-[var(--cx-text-3)]">
            Updated {formatRelativeTime(status.updated_at)}
          </span>
        ) : null
      }
    >
      <div className="rounded-[10px] border border-[var(--cx-border)] bg-[var(--cx-surface)] p-4">
        {formError && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-[8px] border border-[var(--cx-border)] bg-[var(--cx-surface-2)] px-3 py-2 text-[12.5px] text-[var(--cx-text)]">
            <span aria-hidden className="mt-[6px] size-1.5 shrink-0 rounded-full bg-[var(--cx-error)]" />
            {formError}
          </p>
        )}
        {fields.length === 0 ? (
          <p className="text-[13px] text-[var(--cx-text-2)]">
            This integration does not publish a credential schema yet.
          </p>
        ) : (
          <div className="space-y-4">
            {fields.map((field) => (
              <CredentialField
                key={field.key}
                field={field}
                saved={configuredKeys.includes(field.key)}
                value={values[field.key] ?? ''}
                show={!!showSecret[field.key]}
                onChange={(v) => config.setValues((prev) => ({ ...prev, [field.key]: v }))}
                onToggleShow={() =>
                  config.setShowSecret((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                }
              />
            ))}
          </div>
        )}
        <p className="mt-4 flex items-start gap-1.5 border-t border-[var(--cx-border)] pt-3 text-[12px] leading-[1.5] text-[var(--cx-text-3)]">
          <Lock className="mt-[3px] size-3 shrink-0" strokeWidth={2} />
          Credentials are stored for you only and are never shown again after saving.
        </p>
      </div>
    </Section>
  );
}

function PanelHeader({
  config,
  connectorKey,
  catalogItem,
  status,
  onClose,
}: {
  config: Config;
  connectorKey: string;
  catalogItem: ConnectorCatalogItem | null;
  status: PrivateConnectorCredentialStatus | null;
  onClose?: () => void;
}) {
  const category = connectorCategory(connectorKey);
  return (
    <div className="flex items-start gap-3">
      <CatalogIcon connectorKey={connectorKey} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-[var(--cx-text)]">
            {config.name}
          </h2>
          <StatusBadge state={config.state} />
        </div>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.5] text-[var(--cx-text-2)]">
          {category ? <span className="text-[var(--cx-text-3)]">{category} · </span> : null}
          {config.configured
            ? credentialSummary(connectorKey, catalogItem, status?.configured_keys ?? [])
            : catalogItem
              ? catalogDescription(catalogItem)
              : 'Add credentials to connect.'}
        </p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--cx-text-3)] outline-none hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text)] focus-visible:ring-1 focus-visible:ring-[var(--cx-accent)]"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function PanelFooter({
  config,
  confirmDiscard,
  onKeepEditing,
  onDiscard,
  onCancel,
}: {
  config: Config;
  confirmDiscard: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onCancel?: () => void;
}) {
  if (confirmDiscard) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-[var(--cx-text)]">Discard the values you entered?</p>
        <div className="flex gap-2">
          <Btn tone="ghost" onClick={onKeepEditing}>
            Keep editing
          </Btn>
          <Btn tone="secondary" onClick={onDiscard}>
            Discard
          </Btn>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="hidden text-[12px] text-[var(--cx-text-3)] sm:block">
        {config.configured ? 'Only fields you fill in are replaced.' : 'Credentials are tested after saving.'}
      </p>
      <div className="ml-auto flex gap-2">
        {onCancel && (
          <Btn tone="ghost" onClick={onCancel}>
            Cancel
          </Btn>
        )}
        <Btn
          tone="primary"
          onClick={() => void config.save()}
          busy={config.saving}
          disabled={!config.canSave}
        >
          {config.saving ? 'Saving…' : config.configured ? 'Save and test' : 'Connect'}
        </Btn>
      </div>
    </div>
  );
}

/** Full-page variant used by `/dashboard/connectors/[id]`. */
export function ConnectorConfigPage(props: PanelProps) {
  const config = useConnectorConfig(props);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  return (
    <div className="space-y-6">
      <PanelHeader
        config={config}
        connectorKey={props.connectorKey}
        catalogItem={props.catalogItem}
        status={props.status}
      />
      <ConnectionSection config={config} status={props.status} />
      <CredentialsSection config={config} status={props.status} />
      <div className="rounded-[10px] border border-[var(--cx-border)] bg-[var(--cx-surface)] px-4 py-3">
        <PanelFooter
          config={config}
          confirmDiscard={confirmDiscard}
          onKeepEditing={() => setConfirmDiscard(false)}
          onDiscard={() => {
            config.reset();
            setConfirmDiscard(false);
          }}
          onCancel={config.dirty ? () => setConfirmDiscard(true) : undefined}
        />
      </div>
    </div>
  );
}

const subscribeNothing = () => () => {};

/** Right-hand drawer (full screen below `sm`). */
export function ConnectorConfigDrawer({
  open,
  onClose,
  ...props
}: PanelProps & { open: boolean; onClose: () => void }) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && <DrawerBody key={props.connectorKey} onClose={onClose} {...props} />}
    </AnimatePresence>,
    document.body,
  );
}

function DrawerBody({ onClose, ...props }: PanelProps & { onClose: () => void }) {
  const config = useConnectorConfig(props);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { dirty, save } = config;

  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose, save]);

  return (
    <div className="fixed inset-0 z-[70]" style={CONNECTOR_THEME}>
      <motion.div
        className="absolute inset-0 bg-black/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={requestClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Configure ${config.name}`}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-[var(--cx-border)] bg-[var(--cx-bg)] outline-none sm:w-[520px]"
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 32, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="shrink-0 border-b border-[var(--cx-border)] px-5 py-4">
          <PanelHeader
            config={config}
            connectorKey={props.connectorKey}
            catalogItem={props.catalogItem}
            status={props.status}
            onClose={requestClose}
          />
        </div>
        <div className={cn('min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5')}>
          <ConnectionSection config={config} status={props.status} />
          <CredentialsSection config={config} status={props.status} />
        </div>
        <div className="shrink-0 border-t border-[var(--cx-border)] px-5 py-3">
          <PanelFooter
            config={config}
            confirmDiscard={confirmDiscard}
            onKeepEditing={() => setConfirmDiscard(false)}
            onDiscard={onClose}
            onCancel={requestClose}
          />
        </div>
      </motion.div>
    </div>
  );
}
