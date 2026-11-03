'use client';

/**
 * Integration setup — `/dashboard/connectors/[id]`.
 *
 * Deep-linkable full-page version of the configuration drawer. Same
 * fields, masking, save-and-test, test and enable actions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { ConnectorConfigPage } from '@/components/connectors/ConnectorConfigPanel';
import {
  CONNECTOR_THEME,
  connectorName,
  isDemoMode,
  stubCatalogItem,
} from '@/components/connectors/connector-model';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { ConnectorCatalogItem, PrivateConnectorCredentialStatus } from '@/lib/types';

export default function ConnectorSetupPage() {
  const params = useParams<{ id: string }>();
  const connectorKey = (Array.isArray(params.id) ? params.id[0] : params.id) ?? '';
  const { user, isLoading: userLoading } = useUser();
  const demo = useMemo(() => isDemoMode(), []);

  const [catalogItem, setCatalogItem] = useState<ConnectorCatalogItem | null | undefined>(undefined);
  const [status, setStatus] = useState<PrivateConnectorCredentialStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connectorKey) return;
    if (!demo && !user?.id) return;
    setLoadError(null);
    try {
      const [catalog, statuses] = await Promise.all([
        api.getConnectorCatalog(false),
        api.getPrivateConnectorCredentials(),
      ]);
      setCatalogItem(
        catalog.find((c) => c.connector_key === connectorKey) ?? stubCatalogItem(connectorKey),
      );
      setStatus(statuses.find((s) => s.connector_key === connectorKey) ?? null);
    } catch (err) {
      setCatalogItem(null);
      setLoadError(err instanceof Error ? err.message : 'Could not load this integration.');
    }
  }, [connectorKey, demo, user?.id]);

  useEffect(() => {
    if (demo || user?.id) {
      void load();
      return;
    }
    if (!userLoading) setCatalogItem(null);
  }, [demo, user?.id, userLoading, load]);

  const name = connectorName(connectorKey, catalogItem);
  const missing = catalogItem === null && !loadError;

  return (
    <div style={CONNECTOR_THEME} className="min-h-dvh bg-[var(--cx-bg)] text-[var(--cx-text)]">
      <Topbar title={name || 'Integration'} crumb="Integrations" />

      <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/dashboard/connectors"
          className="mb-6 inline-flex items-center gap-1.5 rounded-[6px] text-[12.5px] font-medium text-[var(--cx-text-2)] outline-none hover:text-[var(--cx-text)] focus-visible:ring-1 focus-visible:ring-[var(--cx-accent)]"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          All integrations
        </Link>

        {catalogItem === undefined && !loadError && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-40 w-full rounded-[10px]" />
            <Skeleton className="h-64 w-full rounded-[10px]" />
          </div>
        )}

        {loadError && (
          <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} onRetry={load} />
        )}

        {missing && (
          <div className="rounded-[12px] border border-[var(--cx-border)] bg-[var(--cx-surface)] px-5 py-6">
            <h1 className="text-[16px] font-semibold text-[var(--cx-text)]">Integration not found</h1>
            <p className="mt-1 text-[13px] text-[var(--cx-text-2)]">
              There is no integration with key <span className="font-mono">{connectorKey}</span> in the catalog.
            </p>
          </div>
        )}

        {catalogItem && (
          <ConnectorConfigPage
            connectorKey={connectorKey}
            catalogItem={catalogItem}
            status={status}
            onStatusChange={setStatus}
          />
        )}
      </div>
    </div>
  );
}
