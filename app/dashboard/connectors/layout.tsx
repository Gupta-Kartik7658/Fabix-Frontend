import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect the tools your agents work with.",
};

export default function ConnectorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
