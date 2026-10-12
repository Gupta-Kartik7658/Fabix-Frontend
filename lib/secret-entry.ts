import { ApiError, apiFetch, readApiError } from "@/lib/api";

/**
 * GitHub Actions secret link-out.
 *
 * The agent never receives the secret value. This page is the only place
 * a human types it. Preview and submit use the published FastAPI routes.
 * Demo tokens stay local. This module never calls port 8082 or the
 * retired approval routes.
 */
const SECRET_ENTRY_PREVIEW_PATH = "/api/secrets/entry/{token}";
const SECRET_ENTRY_SUBMIT_PATH = "/api/secrets/entry/{token}";

const BLOCKED_ROUTE_FRAGMENTS = [
  "/mcp_approvals",
  "/get_mcp_approvals",
  "/execute_tool_call",
];

export type SecretEntryOperation = "create" | "update" | "delete";
export type SecretEntryScope = "repo" | "environment" | "organization";
export type SecretEntryLinkStatus =
  | "pending"
  | "saved"
  | "failed"
  | "expired"
  | "used";

export type SecretEntryPreview = {
  operation: SecretEntryOperation;
  owner: string;
  repo: string | null;
  scope: SecretEntryScope;
  environment: string | null;
  secret_name: string;
  status: SecretEntryLinkStatus;
};

export type SecretEntrySubmitResult = {
  status: "saved" | "failed";
  secret_name: string;
  detail: string | null;
};

const DEMO_PREVIEWS: Record<string, SecretEntryPreview> = {
  "demo-create": {
    operation: "create",
    owner: "aegis-labs",
    repo: "aegis-labs/api",
    scope: "repo",
    environment: null,
    secret_name: "OPENAI_API_KEY",
    status: "pending",
  },
  "demo-update": {
    operation: "update",
    owner: "aegis-labs",
    repo: "aegis-labs/api",
    scope: "environment",
    environment: "production",
    secret_name: "DATABASE_URL",
    status: "pending",
  },
  "demo-delete": {
    operation: "delete",
    owner: "aegis-labs",
    repo: null,
    scope: "organization",
    environment: null,
    secret_name: "STALE_TOKEN",
    status: "pending",
  },
  "demo-expired": {
    operation: "create",
    owner: "aegis-labs",
    repo: "aegis-labs/api",
    scope: "repo",
    environment: null,
    secret_name: "OPENAI_API_KEY",
    status: "expired",
  },
  "demo-used": {
    operation: "update",
    owner: "aegis-labs",
    repo: "aegis-labs/api",
    scope: "repo",
    environment: null,
    secret_name: "DATABASE_URL",
    status: "used",
  },
  "demo-saved": {
    operation: "create",
    owner: "aegis-labs",
    repo: "aegis-labs/api",
    scope: "repo",
    environment: null,
    secret_name: "OPENAI_API_KEY",
    status: "saved",
  },
  "demo-failed": {
    operation: "create",
    owner: "aegis-labs",
    repo: "aegis-labs/api",
    scope: "repo",
    environment: null,
    secret_name: "OPENAI_API_KEY",
    status: "failed",
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function apiBase(): string {
  let url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

function assertLiveRoute(path: string): void {
  const lowered = path.toLowerCase();
  if (BLOCKED_ROUTE_FRAGMENTS.some((fragment) => lowered.includes(fragment))) {
    throw new ApiError({
      code: "SECRET_ENTRY_BLOCKED_ROUTE",
      message: "This page cannot use the retired approval routes.",
    });
  }
}

function routeFor(template: string, token: string): string {
  assertLiveRoute(template);
  return `${apiBase()}${template.replaceAll("{token}", encodeURIComponent(token))}`;
}

function pickOperation(value: unknown): SecretEntryOperation | null {
  if (value === "create" || value === "update" || value === "delete") return value;
  return null;
}

function pickScope(value: unknown): SecretEntryScope | null {
  if (value === "repo" || value === "environment" || value === "organization") return value;
  return null;
}

function pickStatus(value: unknown): SecretEntryLinkStatus | null {
  if (
    value === "pending" ||
    value === "saved" ||
    value === "failed" ||
    value === "expired" ||
    value === "used"
  ) {
    return value;
  }
  return null;
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Drop every field except the metadata this page is allowed to show. */
export function normalizeSecretEntryPreview(raw: unknown): SecretEntryPreview {
  const row = asRecord(raw);
  const operation = pickOperation(row.operation);
  const scope = pickScope(row.scope);
  const status = pickStatus(row.status);
  const secretName = optionalText(row.secret_name);
  const owner = optionalText(row.owner);
  if (!operation || !scope || !status || !secretName || !owner) {
    throw new ApiError({
      code: "SECRET_ENTRY_INVALID",
      message: "This link did not include the secret metadata.",
    });
  }
  return {
    operation,
    owner,
    repo: optionalText(row.repo),
    scope,
    environment: optionalText(row.environment),
    secret_name: secretName,
    status,
  };
}

export function normalizeSecretEntrySubmit(
  raw: unknown,
  fallbackName: string,
): SecretEntrySubmitResult {
  const row = asRecord(raw);
  const status = row.status === "failed" || row.ok === false ? "failed" : "saved";
  const detail = optionalText(row.detail) ?? optionalText(row.last_error) ?? optionalText(row.message);
  return {
    status,
    secret_name: optionalText(row.secret_name) ?? fallbackName,
    detail: status === "failed" ? detail : null,
  };
}

export function redactSecret(message: string, secretValue: string): string {
  if (secretValue.length < 4 || !message.includes(secretValue)) return message;
  return message.split(secretValue).join("a secret value");
}

/** Browser fetch failed before any HTTP status. This is not a bad token. */
export function isApiUnreachable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const message =
    "message" in error && typeof error.message === "string" ? error.message : "";
  return (
    name === "NetworkError" ||
    /failed to fetch|networkerror when attempting to fetch|network error|load failed|err_connection_refused/i.test(
      message,
    )
  );
}

export function isDevelopmentDemoToken(token: string): boolean {
  return process.env.NODE_ENV === "development" && token in DEMO_PREVIEWS;
}

/** Local-only fixtures. Production tokens always go through the session check. */
export function isLocalSecretEntryPreview(token: string): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    (token in DEMO_PREVIEWS || token === "demo-wrong-user")
  );
}

export async function loadSecretEntry(token: string): Promise<SecretEntryPreview> {
  if (token === "demo-wrong-user" && process.env.NODE_ENV === "development") {
    throw new ApiError({
      code: "SECRET_ENTRY_WRONG_USER",
      message: "This link was sent to a different account.",
    });
  }

  if (isDevelopmentDemoToken(token)) {
    return DEMO_PREVIEWS[token];
  }

  const res = await apiFetch(routeFor(SECRET_ENTRY_PREVIEW_PATH, token), {
    cache: "no-store",
  });
  if (!res.ok) {
    throw await readApiError(res);
  }
  return normalizeSecretEntryPreview(await res.json());
}

export async function submitSecretEntry(
  token: string,
  preview: SecretEntryPreview,
  secretValue: string,
): Promise<SecretEntrySubmitResult> {
  if (preview.operation !== "delete" && secretValue.length === 0) {
    throw new ApiError({
      code: "SECRET_ENTRY_VALUE_REQUIRED",
      message: "Enter the secret value.",
    });
  }

  if (isDevelopmentDemoToken(token)) {
    if (preview.status !== "pending") {
      throw new ApiError({
        code: "SECRET_ENTRY_USED",
        message: "This link has already been used.",
      });
    }
    return {
      status: "saved",
      secret_name: preview.secret_name,
      detail: null,
    };
  }

  const body =
    preview.operation === "delete" ? {} : { secret_value: secretValue };

  const res = await apiFetch(routeFor(SECRET_ENTRY_SUBMIT_PATH, token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw await readApiError(res);
  }
  return normalizeSecretEntrySubmit(await res.json(), preview.secret_name);
}
