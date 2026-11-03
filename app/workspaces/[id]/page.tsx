import Layout from '@/components/layout/Layout';
import { WorkspaceDemoGate } from '@/components/workspaces/WorkspaceDemoGate';
import { WorkspaceRoom } from '@/components/workspaces/WorkspaceRoom';

/**
 * Workspace room inside the standard app shell, so the global sidebar
 * stays the one place for app-level navigation.
 *
 * Next 16 removed synchronous access to `params`, so this stays a server
 * component that awaits them and hands the id to the client room.
 */
export default async function WorkspaceRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <WorkspaceDemoGate>
      <Layout>
        <WorkspaceRoom workspaceId={id} />
      </Layout>
    </WorkspaceDemoGate>
  );
}
