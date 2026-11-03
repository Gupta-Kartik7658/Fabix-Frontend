'use client';

/**
 * Integrations — `/dashboard/connectors`.
 *
 * Configured integrations (status, credential summary, last test, test /
 * manage / enable) sit above a separate catalog of everything not yet set
 * up. Manage and Set up open the configuration drawer; deep links to
 * `/dashboard/connectors/{key}` keep working as a full page.
 *
 * Attention = last_error or revoked_at. Test = POST /setup/{key}/test on
 * saved credentials. Provider errors are summarised and redacted before
 * display (see connector-model).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RotateCw, Search } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { CatalogIcon } from '@/components/connectors/CatalogIcon';
import { ConnectorConfigDrawer } from '@/components/connectors/ConnectorConfigPanel';
import { Btn, IssueNotice, StatusBadge } from '@/components/connectors/ConnectorParts';
import {
  CONNECTOR_THEME,
  INTERNAL_CONNECTOR_KEYS,
  catalogDescription,
  connectorCategory,
  connectorName,
  connectorState,
  credentialSummary,
  describeConnectorIssue,
  formatTestedClock,
  isDemoMode,
  stubCatalogItem,
  type ConnectorState,
} from '@/components/connectors/connector-model';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { ConnectorCatalogItem, PrivateConnectorCredentialStatus } from '@/lib/types';
import { cn, formatRelativeTime } from '@/lib/utils';

type ConfiguredRow = {
  key: string;
  name: string;
  item: ConnectorCatalogItem | null;
  status: PrivateConnectorCredentialStatus;
  state: ConnectorState;
};

// Enabled and disabled share a rank so flipping the switch never moves the row.
const STATE_ORDER: Record<ConnectorState, number> = {
  attention: 0,
  connected: 1,
  disabled: 1,
  not_configured: 2,
};

function readConfigureParam(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('configure');
}

function writeConfigureParam(key: string | null) {
  const url = new URL(window.location.href);
  if (key) url.searchParams.set('configure', key);
  else url.searchParams.delete('configure');
  window.history.replaceState(window.history.state, '', url.toString());
}

export default function IntegrationsPage() {
  const toast = useToast();
  const { user, isLoading: userLoading } = useUser();
  const demo = useMemo(() => isDemoMode(), []);

  const [catalog, setCatalog] = useState<ConnectorCatalogItem[] | null>(null);
  const [statusByKey, setStatusByKey] = useState<Record<string, PrivateConnectorCredentialStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [configureKey, setConfigureKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!demo && !user?.id) return;
    setError(null);
    try {
      const [items, statuses] = await Promise.all([
        api.getConnectorCatalog(false),
        api.getPrivateConnectorCredentials(),
      ]);
      setCatalog(items.filter((item) => !INTERNAL_CONNECTOR_KEYS.has(item.connector_key)));
      setStatusByKey(Object.fromEntries(statuses.map((s) => [s.connector_key, s])));
    } catch (err) {
      setCatalog([]);
      setError(err instanceof Error ? err.message : 'Could not load integrations.');
    }
  }, [demo, user?.id]);

  useEffect(() => {
    if (demo || user?.id) {
      void load();
      return;
    }
    if (!userLoading) setCatalog([]);
  }, [demo, user?.id, userLoading, load]);

  useEffect(() => {
    setConfigureKey(readConfigureParam());
  }, []);

  const catalogByKey = useMemo(
    () => Object.fromEntries((catalog ?? []).map((item) => [item.connector_key, item])),
    [catalog],
  );

  const configured: ConfiguredRow[] = useMemo(() => {
    const rows: ConfiguredRow[] = [];
    for (const status of Object.values(statusByKey)) {
      if (!status.configured || INTERNAL_CONNECTOR_KEYS.has(status.connector_key)) continue;
      const item = catalogByKey[status.connector_key] ?? null;
      rows.push({
        key: status.connector_key,
        name: connectorName(status.connector_key, item),
        item,
        status,
        state: connectorState(status),
      });
    }
    rows.sort(
      (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name),
    );
    return rows;
  }, [statusByKey, catalogByKey]);

  const available = useMemo(() => {
    const setUp = new Set(configured.map((row) => row.key));
    return (catalog ?? [])
      .filter((item) => !setUp.has(item.connector_key))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [catalog, configured]);

  const filteredAvailable = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((item) =>
      [item.display_name, item.connector_key, catalogDescription(item), connectorCategory(item.connector_key) ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [available, query]);

  const attentionCount = configured.filter((row) => row.state === 'attention').length;
  const enabledCount = configured.filter((row) => row.state === 'connected').length;

  const openConfigure = (key: string) => {
    setConfigureKey(key);
    writeConfigureParam(key);
  };
  const closeConfigure = useCallback(() => {
    setConfigureKey(null);
    writeConfigureParam(null);
  }, []);

  const applyStatus = useCallback((status: PrivateConnectorCredentialStatus) => {
    setStatusByKey((prev) => ({ ...prev, [status.connector_key]: status }));
  }, []);

  const handleToggle = async (row: ConfiguredRow, next: boolean) => {
    setTogglingKey(row.key);
    try {
      applyStatus(await api.setConnectorEnabled(row.key, next));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the integration.');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleTest = async (row: ConfiguredRow) => {
    setTestingKey(row.key);
    try {
      const status = await api.testPrivateConnectorCredentials(row.key);
      applyStatus(status);
      const issue = describeConnectorIssue(row.key, status);
      if (status.last_error) {
        toast.error(`${row.name} connection test failed`, { description: issue?.summary });
      } else {
        toast.success(`${row.name} is connected`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not test the connection.');
    } finally {
      setTestingKey(null);
    }
  };

  const browse = () => {
    const target = document.getElementById('catalog');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('catalog-search')?.focus({ preventScroll: true }), 350);
  };

  const loading = catalog === null;
  const drawerItem = configureKey
    ? catalogByKey[configureKey] ?? stubCatalogItem(configureKey)
    : null;

  return (
    <div style={CONNECTOR_THEME} className="min-h-dvh bg-[var(--cx-bg)] text-[var(--cx-text)]">
      <Topbar title="Integrations" />

      <div className="mx-auto w-full max-w-[1240px] space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-[var(--cx-text)]">
              Integrations
            </h1>
            <p className="mt-1 text-[13.5px] text-[var(--cx-text-2)]">
              Connect the tools your agents work with.
            </p>
          </div>
          <Btn tone="primary" onClick={browse} icon={<Plus className="size-3.5" strokeWidth={2.2} />} className="h-9 px-3.5">
            Browse integrations
          </Btn>
        </header>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatCard
            label="Available"
            value={loading ? null : (catalog?.length ?? 0)}
            description="Integrations in the catalog"
          />
          <StatCard
            label="Configured"
            value={loading ? null : configured.length}
            description={
              configured.length === 0
                ? 'Nothing set up yet'
                : `${enabledCount} available to agents`
            }
          />
          <StatCard
            label="Need attention"
            shortLabel="Attention"
            value={loading ? null : attentionCount}
            tone={attentionCount > 0 ? 'warning' : undefined}
            description={attentionCount > 0 ? 'Failing tests or revoked credentials' : 'All connections healthy'}
          />
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />}

        <section aria-labelledby="configured-heading">
          <SectionHeading id="configured-heading" title="Configured" count={loading ? undefined : configured.length} />
          {loading ? (
            <ListSkeleton />
          ) : configured.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-[12px] border border-[var(--cx-border)] bg-[var(--cx-surface)] px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[14px] font-medium text-[var(--cx-text)]">No integrations configured yet</p>
                <p className="mt-1 text-[13px] text-[var(--cx-text-2)]">
                  Add credentials for a tool in the catalog to make it available to your agents.
                </p>
              </div>
              <Btn tone="secondary" onClick={browse}>
                Browse integrations
              </Btn>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-[var(--cx-border)] bg-[var(--cx-surface)]">
              <div
                aria-hidden
                className="hidden grid-cols-[minmax(0,1fr)_128px_148px_252px] items-center gap-4 border-b border-[var(--cx-border)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cx-text-3)] lg:grid"
              >
                <span>Integration</span>
                <span>Status</span>
                <span>Last tested</span>
                <span className="text-right">Actions</span>
              </div>
              <ul className="divide-y divide-[var(--cx-border)]">
                {configured.map((row) => (
                  <ConfiguredItem
                    key={row.key}
                    row={row}
                    testing={testingKey === row.key}
                    toggling={togglingKey === row.key}
                    onTest={() => void handleTest(row)}
                    onToggle={(next) => void handleToggle(row, next)}
                    onManage={() => openConfigure(row.key)}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>

        <section id="catalog" aria-labelledby="catalog-heading" className="scroll-mt-20">
          <SectionHeading
            id="catalog-heading"
            title="Catalog"
            count={loading ? undefined : available.length}
            aside={
              !loading && available.length > 0 ? (
                <div
                  data-input-shell
                  className="flex h-8 w-full items-center gap-2 rounded-[8px] border border-[var(--cx-border)] bg-[var(--cx-surface)] px-2.5 focus-within:border-[#2F7A57] sm:w-[240px]"
                >
                  <Search className="size-3.5 shrink-0 text-[var(--cx-text-3)]" strokeWidth={2} />
                  <input
                    id="catalog-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search integrations"
                    aria-label="Search integrations"
                    className="h-full min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--cx-text-3)]"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                      color: '#F0F3F1',
                      WebkitTextFillColor: '#F0F3F1',
                    }}
                  />
                </div>
              ) : null
            }
          />
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[168px] rounded-[12px]" />
              ))}
            </div>
          ) : available.length === 0 ? (
            <p className="rounded-[12px] border border-[var(--cx-border)] bg-[var(--cx-surface)] px-5 py-6 text-[13px] text-[var(--cx-text-2)]">
              {catalog && catalog.length > 0
                ? 'Every integration in the catalog is configured.'
                : 'The catalog is empty right now.'}
            </p>
          ) : filteredAvailable.length === 0 ? (
            <p className="rounded-[12px] border border-[var(--cx-border)] bg-[var(--cx-surface)] px-5 py-6 text-[13px] text-[var(--cx-text-2)]">
              No integrations match “{query.trim()}”.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAvailable.map((item) => (
                <CatalogCard key={item.connector_key} item={item} onSetUp={() => openConfigure(item.connector_key)} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConnectorConfigDrawer
        open={!!configureKey && !loading}
        onClose={closeConfigure}
        connectorKey={configureKey ?? ''}
        catalogItem={drawerItem}
        status={configureKey ? statusByKey[configureKey] ?? null : null}
        onStatusChange={applyStatus}
      />
    </div>
  );
}

function StatCard({
  label,
  shortLabel,
  value,
  description,
  tone,
}: {
  label: string;
  shortLabel?: string;
  value: number | null;
  description: string;
  tone?: 'warning';
}) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[var(--cx-border)] bg-[var(--cx-surface)] px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="truncate text-[12px] font-medium text-[var(--cx-text-2)]">
        {shortLabel ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </p>
      <p
        className={cn(
          'mt-1.5 text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[24px]',
          tone === 'warning' ? 'text-[var(--cx-warning)]' : 'text-[var(--cx-text)]',
        )}
      >
        {value === null ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-[var(--cx-surface-2)]" /> : value}
      </p>
      <p className="mt-1.5 hidden truncate text-[12px] text-[var(--cx-text-3)] sm:block">{description}</p>
    </div>
  );
}

function SectionHeading({
  id,
  title,
  count,
  aside,
}: {
  id: string;
  title: string;
  count?: number;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-[var(--cx-text)]">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-[var(--cx-surface-2)] px-1.5 text-[11.5px] font-medium leading-[18px] text-[var(--cx-text-2)] tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {aside}
    </div>
  );
}

function ConfiguredItem({
  row,
  testing,
  toggling,
  onTest,
  onToggle,
  onManage,
}: {
  row: ConfiguredRow;
  testing: boolean;
  toggling: boolean;
  onTest: () => void;
  onToggle: (next: boolean) => void;
  onManage: () => void;
}) {
  const { status, state } = row;
  const issue = describeConnectorIssue(row.key, status);
  const canTest = status.configured && !status.revoked_at;
  const enabled = state === 'connected';
  const testedAt = status.last_tested_at;

  return (
    <li className="grid grid-cols-1 gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_128px_148px_252px] lg:items-center lg:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={onManage}
          className="shrink-0 rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-[rgba(57,185,130,0.45)]"
          aria-label={`Manage ${row.name}`}
        >
          <CatalogIcon connectorKey={row.key} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onManage}
              className="truncate text-left text-[14px] font-semibold tracking-[-0.01em] text-[var(--cx-text)] outline-none hover:underline hover:decoration-[var(--cx-border-strong)] hover:underline-offset-4 focus-visible:underline"
            >
              {row.name}
            </button>
            <StatusBadge state={state} className="lg:hidden" />
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--cx-text-2)]">
            {credentialSummary(row.key, row.item, status.configured_keys)}
            <span className="text-[var(--cx-text-3)] lg:hidden">
              {' · '}
              {testedAt ? `Tested ${formatRelativeTime(testedAt)}` : 'Not tested yet'}
            </span>
          </p>
          {issue && <IssueNotice compact issue={issue} name={row.name} onTest={canTest ? onTest : undefined} testing={testing} />}
        </div>
      </div>

      <div className="hidden lg:block">
        <StatusBadge state={state} />
      </div>

      <div className="hidden text-[12.5px] lg:block">
        {testedAt ? (
          <span title={formatTestedClock(testedAt)} className="text-[var(--cx-text)]">
            {formatRelativeTime(testedAt)}
          </span>
        ) : (
          <span className="text-[var(--cx-text-3)]">Not tested yet</span>
        )}
      </div>

      <div className="flex items-center gap-2 pl-10 lg:justify-end lg:pl-0">
        {canTest && (
          <Btn
            tone="ghost"
            onClick={onTest}
            busy={testing}
            icon={<RotateCw className="size-3.5" strokeWidth={2} />}
            aria-label={`Test ${row.name} connection`}
          >
            {testing ? 'Testing…' : 'Test'}
          </Btn>
        )}
        <Btn tone="secondary" onClick={onManage}>
          {state === 'attention' ? 'Fix' : 'Manage'}
        </Btn>
        <span className="ml-1 flex w-9 justify-end">
          {state !== 'attention' && (
            <Switch
              checked={enabled}
              disabled={toggling}
              onChange={onToggle}
              ariaLabel={`${enabled ? 'Disable' : 'Enable'} ${row.name}`}
            />
          )}
        </span>
      </div>
    </li>
  );
}

function CatalogCard({ item, onSetUp }: { item: ConnectorCatalogItem; onSetUp: () => void }) {
  const category = connectorCategory(item.connector_key);
  return (
    <li className="flex flex-col rounded-[12px] border border-[var(--cx-border)] bg-[var(--cx-surface)] p-4 transition-colors hover:border-[var(--cx-border-strong)]">
      <div className="flex items-start gap-3">
        <CatalogIcon connectorKey={item.connector_key} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--cx-text)]">
            {item.display_name}
          </p>
          {category && <p className="mt-0.5 truncate text-[12px] text-[var(--cx-text-3)]">{category}</p>}
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[38px] flex-1 text-[12.5px] leading-[1.5] text-[var(--cx-text-2)]">
        {catalogDescription(item)}
      </p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <StatusBadge state="not_configured" />
        <Btn tone="secondary" onClick={onSetUp} aria-label={`Set up ${item.display_name}`}>
          Set up
        </Btn>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-[var(--cx-border)] overflow-hidden rounded-[12px] border border-[var(--cx-border)] bg-[var(--cx-surface)]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <Skeleton className="size-7 rounded-[8px]" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-24 rounded-[8px]" />
        </div>
      ))}
    </div>
  );
}
