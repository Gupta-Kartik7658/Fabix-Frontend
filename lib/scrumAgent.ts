import { api, type WorkspaceAgent } from "@/lib/api";

export const SCRUM_AGENT_HANDLE = "scrum";
const LEGACY_KEY_PREFIX = "fabix:scrum-agent-key:";

export function findScrumAgent(agents: WorkspaceAgent[]): WorkspaceAgent | undefined {
  return agents.find(
    (a) => a.status !== "removed" && a.handle.toLowerCase() === SCRUM_AGENT_HANDLE,
  );
}

/** Sends `prompt` to the workspace's Scrum Agent; an empty prompt runs it autonomously. */
export async function runScrumAgent(workspaceId: string, prompt: string) {
  const res = await api.queueScrumTask({ workspace_id: workspaceId, prompt });
  // Agent keys used to be kept in the browser; they are no longer needed.
  try {
    window.localStorage.removeItem(LEGACY_KEY_PREFIX + workspaceId);
  } catch {
    // Storage can be unavailable (private mode).
  }
  return res;
}
