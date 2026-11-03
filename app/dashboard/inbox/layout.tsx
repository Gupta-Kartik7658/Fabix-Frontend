import type { Metadata } from "next";

const DESCRIPTION =
  "Stay updated on conversations, assigned tasks and everything happening across your workspaces.";

export const metadata: Metadata = {
  title: "Activity Center",
  description: DESCRIPTION,
  openGraph: { title: "Activity Center | Fabix", description: DESCRIPTION },
  twitter: { title: "Activity Center | Fabix", description: DESCRIPTION },
};

export default function ActivityCenterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
