import type { Metadata } from 'next';
import { SecretEntryClient } from './SecretEntryClient';

export const metadata: Metadata = {
  title: 'GitHub secret',
  description: 'Enter a GitHub Actions secret from a one-time Aegis link.',
};

export default async function SecretEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SecretEntryClient token={token} />;
}
