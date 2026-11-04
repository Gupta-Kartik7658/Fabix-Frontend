'use client';

import Link from 'next/link';
import { RelativeTime } from '@/components/ui/RelativeTime';
import type { RunRecord } from '@/lib/api';
import type { TokenAnalyticsResponse } from '@/lib/types';
import {
  connectorStatus,
  finiteNumber,
  runStatusLabel,
  runStatusTone,
  usageRangeLabel,
  type ConnectorRow,
} from './activity-model';
import { Panel, PanelEmpty, ToneBadge } from './activity-ui';

function formatDuration(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 1000) return `${Math.round(ms).toLocaleString()} ms`;
  return `${(ms / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} s`;
}

export function ExecutionsPanel({
  runs,
  total,
  error,
  onRetry,
}: {
  runs: RunRecord[] | null;
  total: number | null;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Panel
      title="Recent executions"
      href="/dashboard/runs"
      linkLabel="View all"
      error={error}
      onRetry={onRetry}
      loading={runs === null && !error}
      tourId="activity-panel-runs"
    >
      {runs && runs.length === 0 && (
        <PanelEmpty
          title="No executions yet"
          body="Tool calls your agents make through Fabix will appear here."
          action={{ label: 'Connect a connector', href: '/dashboard/connectors' }}
        />
      )}
      {runs && runs.length > 0 && (
        <>
          <ul className="divide-y divide-[var(--ac-border)]">
            {runs.map((run) => {
              const duration = formatDuration(run.execution_time_ms);
              return (
                <li key={run.id}>
                  <Link href="/dashboard/runs" className="group block py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[12.5px] text-[var(--ac-text)] transition-colors duration-150 group-hover:text-[var(--ac-mint)]">
                        {run.agent_handle ? `@${run.agent_handle}` : run.agent_name}
                      </span>
                      <ToneBadge tone={runStatusTone(run.status)} dot>
                        {runStatusLabel(run.status)}
                      </ToneBadge>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-[12px]">
                      <span className="min-w-0 truncate text-[var(--ac-text-2)]">
                        {run.tool_name}
                        {run.connector_key && (
                          <span className="text-[var(--ac-muted)]"> · {run.connector_key}</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[var(--ac-muted)]">
                        <RelativeTime timestamp={run.started_at || run.created_at} />
                        {duration && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">{duration}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {total !== null && total > runs.length && (
            <p className="border-t border-[var(--ac-border)] pt-3 text-[12px] tabular-nums text-[var(--ac-muted)]">
              Showing {runs.length.toLocaleString()} of {total.toLocaleString()} executions
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

export function ConnectorHealthPanel({
  connectors,
  error,
  onRetry,
}: {
  connectors: ConnectorRow[] | null;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Panel
      title="Connector health"
      href="/dashboard/connectors"
      linkLabel="Manage"
      error={error}
      onRetry={onRetry}
      loading={connectors === null && !error}
      tourId="activity-panel-connectors"
    >
      {connectors && connectors.length === 0 && (
        <PanelEmpty
          title="No connectors set up"
          body="Add credentials for a connector so your agents can call its tools."
          action={{ label: 'Browse connectors', href: '/dashboard/connectors' }}
        />
      )}
      {connectors && connectors.length > 0 && (
        <ul className="divide-y divide-[var(--ac-border)]">
          {connectors.map((row) => {
            const status = connectorStatus(row.status);
            const detail = row.status.last_error?.trim();
            return (
              <li key={row.key}>
                <Link
                  href={`/dashboard/connectors/${encodeURIComponent(row.key)}`}
                  className="group block py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-[var(--ac-text)] transition-colors duration-150 group-hover:text-[var(--ac-mint)]">
                      {row.name}
                    </span>
                    <ToneBadge tone={status.tone} dot>
                      {status.label}
                    </ToneBadge>
                  </div>
                  {detail && (
                    <p className="mt-1 line-clamp-1 text-[12px] text-[var(--ac-red)]">{detail}</p>
                  )}
                  <p className="mt-1 text-[12px] text-[var(--ac-muted)]">
                    {row.status.last_tested_at ? (
                      <>
                        Last tested <RelativeTime timestamp={row.status.last_tested_at} />
                      </>
                    ) : (
                      'Not tested yet'
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function UsagePanel({
  usage,
  error,
  onRetry,
}: {
  usage: TokenAnalyticsResponse | null;
  error: string | null;
  onRetry: () => void;
}) {
  const topTools = usage
    ? [...usage.tool_chart]
        .filter((tool) => tool.name && finiteNumber(tool.total_tokens) > 0)
        .sort((a, b) => finiteNumber(b.total_tokens) - finiteNumber(a.total_tokens))
        .slice(0, 4)
    : [];
  const topMax = topTools.length > 0 ? finiteNumber(topTools[0].total_tokens) : 0;

  return (
    <Panel
      title="Usage overview"
      href="/dashboard/token-spenditure"
      linkLabel="Details"
      error={error}
      onRetry={onRetry}
      loading={usage === null && !error}
      tourId="activity-panel-usage"
    >
      {usage && (
        <div>
          <p className="text-[12px] text-[var(--ac-muted)]">{usageRangeLabel(usage.date_range)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-[var(--ac-border)] pb-4">
            <UsageFigure label="Input tokens" value={finiteNumber(usage.summary.input_tokens)} />
            <UsageFigure label="Output tokens" value={finiteNumber(usage.summary.output_tokens)} />
            <UsageFigure label="Total tokens" value={finiteNumber(usage.summary.total_tokens)} />
            <UsageFigure label="Tool calls" value={finiteNumber(usage.summary.tool_call_count)} />
          </dl>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ac-muted)]">
            Top tools
          </p>
          {topTools.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-[var(--ac-muted)]">No tool usage in this range.</p>
          ) : (
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {topTools.map((tool) => {
                const value = finiteNumber(tool.total_tokens);
                return (
                  <li key={tool.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-mono text-[12px] text-[var(--ac-text-2)]">
                        {tool.name}
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums text-[var(--ac-muted)]">
                        {value.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[var(--ac-elevated)]">
                      <div
                        className="h-full rounded-full bg-[var(--ac-green)]"
                        style={{ width: `${topMax > 0 ? Math.max(4, (value / topMax) * 100) : 0}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function UsageFigure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--ac-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[17px] font-semibold tabular-nums tracking-[-0.01em] text-[var(--ac-text)]">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
