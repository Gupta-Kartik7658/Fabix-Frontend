'use client';

import Topbar from '@/components/layout/Topbar';
import { WorkspaceDemoGate } from '@/components/workspaces/WorkspaceDemoGate';
import { WorkspacesList } from '@/components/workspaces/WorkspacesList';

export default function DashboardWorkspacesPage() {
  return (
    <>
      <Topbar title="Workspaces" />
      <WorkspaceDemoGate>
        <WorkspacesList />
      </WorkspaceDemoGate>
    </>
  );
}
