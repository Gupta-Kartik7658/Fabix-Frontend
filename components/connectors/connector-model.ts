import type { CSSProperties } from 'react';
import { CONNECTORS } from '@/components/ui/ConnectorMark';
import {
  isKnownConnectorId,
  parsePrivateCredentialFields,
} from '@/lib/connectorCredentials';
import type { ConnectorCatalogItem, PrivateConnectorCredentialStatus } from '@/lib/types';
import { formatRelativeTime, parseApiUtcTimestamp } from '@/lib/utils';

export const INTERNAL_CONNECTOR_KEYS = new Set(['memory', 'workspace']);

export const CONNECTOR_THEME = {
  '--cx-bg': '#090B0A',
  '--cx-surface': '#111513',
  '--cx-surface-2': '#171C19',
  '--cx-hover': '#141916',
  '--cx-border': '#252B27',
  '--cx-border-strong': '#303833',
  '--cx-text': '#F0F3F1',
  '--cx-text-2': '#A1AAA4',
  '--cx-text-3': '#737D76',
  '--cx-accent': '#39B982',
  '--cx-success': '#42B883',
  '--cx-warning': '#E5AD59',
  '--cx-error': '#E47777',
  '--white-0': '#111513',
  '--bg-surface': '#111513',
  '--bg-app': '#090B0A',
  '--neutral-weak-50': '#171C19',
  '--neutral-soft-200': '#252B27',
  '--neutral-soft-400': '#737D76',
  '--neutral-sub-600': '#A1AAA4',
  '--neutral-strong-950': '#F0F3F1',
  '--stroke-soft-200': '#252B27',
  '--stroke-sub-300': '#303833',
  '--primary-base': '#39B982',
  '--primary-dark': '#56C58D',
  '--primary-alpha-10': 'rgba(57, 185, 130, 0.10)',
  '--primary-alpha-16': 'rgba(57, 185, 130, 0.16)',
  '--primary-alpha-24': 'rgba(57, 185, 130, 0.26)',
  '--error': '#E47777',
  '--error-dark': '#E47777',
  '--error-lighter': 'rgba(228, 119, 119, 0.12)',
  '--btn-primary-bg': '#168653',
  '--btn-primary-bg-hover': '#1A9660',
  '--btn-primary-bg-active': '#12744A',
  '--btn-primary-border': '#12744A',
  '--btn-primary-shadow': 'none',
} as CSSProperties;

export type ConnectorState = 'connected' | 'attention' | 'disabled' | 'not_configured';

export function connectorState(
  status: PrivateConnectorCredentialStatus | null | undefined,
): ConnectorState {
  if (!status?.configured) return 'not_configured';
  if (status.revoked_at || status.last_error?.trim()) return 'attention';
  if (status.is_enabled === false) return 'disabled';
  return 'connected';
}

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      document.documentElement.dataset.demo === 'true' ||
      localStorage.getItem('aegis_demo') === 'true'
    );
  } catch {
    return false;
  }
}

export function connectorName(key: string, item?: ConnectorCatalogItem | null): string {
  if (item?.display_name) return item.display_name;
  if (isKnownConnectorId(key)) return CONNECTORS[key].name;
  return key;
}

export function connectorCategory(key: string): string | null {
  return isKnownConnectorId(key) ? CONNECTORS[key].category : null;
}

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  github: 'Repositories, pull requests, issues and code search.',
  slack: 'Read channels and post messages from agent runs.',
  linear: 'Read and update issues, projects and teams.',
  jira: 'Read and update Jira issues and projects.',
  'github-actions': 'Inspect workflow runs and dispatch workflows.',
  terraform: 'Read workspaces, plans and run state.',
  postgres: 'Query PostgreSQL databases with your own credentials.',
  mongodb: 'Query and aggregate MongoDB collections.',
};

export function catalogDescription(item: ConnectorCatalogItem): string {
  return (
    item.description?.trim() ||
    FALLBACK_DESCRIPTIONS[item.connector_key] ||
    'Add credentials so your agents can use this tool.'
  );
}

export function stubCatalogItem(connectorKey: string): ConnectorCatalogItem | null {
  if (!isKnownConnectorId(connectorKey)) return null;
  return {
    connector_key: connectorKey,
    display_name: CONNECTORS[connectorKey].name,
    description: FALLBACK_DESCRIPTIONS[connectorKey],
    is_active: true,
  };
}

/** "Personal access token saved" — labels come from the credential schema
 *  so the summary names what the user actually entered. Never values. */
export function credentialSummary(
  key: string,
  item: ConnectorCatalogItem | null | undefined,
  configuredKeys: string[],
): string {
  if (configuredKeys.length === 0) return 'Credentials saved';
  const fields = parsePrivateCredentialFields(key, item ?? null);
  const name = connectorName(key, item);
  const labels = configuredKeys.map((k) => {
    const field = fields.find((f) => f.key === k);
    const label = field?.label ?? k.replace(/_/g, ' ');
    return label.toLowerCase().startsWith(`${name.toLowerCase()} `)
      ? label.slice(name.length + 1)
      : label;
  });
  const joined =
    labels.length <= 2
      ? labels.join(' and ')
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} saved`;
}

export function formatTestedClock(timestamp: string): string {
  const parsed = parseApiUtcTimestamp(timestamp);
  if (Number.isNaN(parsed.getTime())) return formatRelativeTime(timestamp);
  const date = parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const clock = parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${clock}`;
}

const MASK = '••••••';

/** Strip anything that could be a credential out of a provider error
 *  before it is rendered. Hostnames and error codes are kept — they are
 *  what makes the diagnostic useful. */
export function redactSecrets(input: string): string {
  return (
    input
      // scheme://user:password@host
      .replace(/([a-z][a-z0-9+.-]*:\/\/)([^\s:/@]+):([^\s@/]+)@/gi, `$1$2:${MASK}@`)
      .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, `$1 ${MASK}`)
      .replace(/\b(token)\s+(?=[A-Za-z._~+/=-]*\d)[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${MASK}`)
      // password=…, sslpassword=…, api_key: "…", Authorization: … (query strings, DSNs, JSON-ish)
      .replace(
        /\b([\w-]*?(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|private[_-]?key|authorization|credentials?|connection[_-]?string|dsn|_pat)|pat|auth)(["']?\s*[=:]\s*)((?:Bearer|Basic)\s+)?("[^"]*"|'[^']*'|[^\s&;,)}\]]+)/gi,
        (_m, name: string, sep: string, scheme: string | undefined) =>
          `${name}${sep}${scheme ?? ''}${MASK}`,
      )
      .replace(/\b(gh[pousr])_[A-Za-z0-9]{8,}/g, `$1_${MASK}`)
      .replace(/\bgithub_pat_[A-Za-z0-9_]{8,}/g, `github_pat_${MASK}`)
      .replace(/\blin_(api|oauth)_[A-Za-z0-9]{8,}/g, `lin_$1_${MASK}`)
      .replace(/\bxox[abposr]-[A-Za-z0-9-]{8,}/g, `xox-${MASK}`)
      .replace(/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/g, `$1_$2_${MASK}`)
      .replace(/\bAKIA[0-9A-Z]{16}\b/g, `AKIA${MASK}`)
      .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, MASK)
      // Any remaining long opaque blob (hex / base64 keys).
      .replace(/(?<![\w.-])[A-Za-z0-9+/_-]{32,}={0,2}(?![\w.-])/g, MASK)
  );
}

const DATABASE_KEYS = new Set(['postgres', 'mongodb']);

type ErrorRule = { test: RegExp; message: (db: boolean) => string };

const ERROR_RULES: ErrorRule[] = [
  {
    test: /ENOTFOUND|EAI_AGAIN|getaddrinfo|could not resolve|name or service not known|nodename nor servname|no such host|querySrv/i,
    message: (db) => (db ? 'Unable to resolve database host.' : 'Unable to resolve the server host.'),
  },
  {
    test: /password authentication failed|bad auth|authentication failed|SCRAM|auth(entication)? error/i,
    message: (db) =>
      db ? 'The database rejected the username or password.' : 'Authentication failed with the saved credentials.',
  },
  {
    test: /bad credentials|invalid[_ ](api[_ ])?(key|token)|unauthori[sz]ed|\b401\b|invalid_auth|not_authed|token (is )?(expired|invalid|revoked)|requires authentication/i,
    message: () => 'The saved credentials were rejected.',
  },
  {
    test: /\b403\b|forbidden|insufficient|permission denied|missing scope|not authorized to/i,
    message: () => 'The credentials do not have the required permissions.',
  },
  {
    test: /ECONNREFUSED|connection refused/i,
    message: (db) => (db ? 'The database refused the connection.' : 'The server refused the connection.'),
  },
  {
    test: /ECONNRESET|socket hang up|connection reset|closed the connection/i,
    message: () => 'The connection was closed unexpectedly.',
  },
  {
    test: /ETIMEDOUT|timed out|timeout|server selection/i,
    message: (db) => (db ? 'The database connection timed out.' : 'The connection timed out.'),
  },
  {
    test: /certificate|\bssl\b|\btls\b|self[- ]signed/i,
    message: () => 'A secure (TLS) connection could not be established.',
  },
  {
    test: /\b429\b|rate[- ]?limit|too many requests/i,
    message: () => 'The provider is rate limiting requests.',
  },
  {
    test: /database .* does not exist|unknown database|\b404\b|not found/i,
    message: (db) => (db ? 'The database or resource was not found.' : 'The requested resource was not found.'),
  },
  {
    test: /invalid (uri|url|connection string|scheme)|malformed|failed to parse|invalid dsn/i,
    message: () => 'The connection string is not valid.',
  },
  {
    test: /\b50[0-4]\b|internal server error|service unavailable|bad gateway/i,
    message: () => 'The provider returned a server error.',
  },
];

export type ConnectorIssue = {
  /** Short, human sentence — safe to show inline. */
  summary: string;
  /** Redacted technical detail, or null when there is nothing more to show. */
  detail: string | null;
};

export function describeConnectorIssue(
  key: string,
  status: PrivateConnectorCredentialStatus | null | undefined,
): ConnectorIssue | null {
  if (!status?.configured) return null;
  const raw = status.last_error?.trim() ?? '';
  if (status.revoked_at && !raw) {
    return { summary: 'The saved credentials were revoked.', detail: null };
  }
  if (!raw) return null;
  const db = DATABASE_KEYS.has(key);
  const rule = ERROR_RULES.find((r) => r.test.test(raw));
  const summary = rule ? rule.message(db) : 'The last connection test failed.';
  const detail = redactSecrets(raw);
  return { summary, detail: detail === summary ? null : detail };
}
