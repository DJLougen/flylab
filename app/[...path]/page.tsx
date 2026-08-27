import { notFound, redirect } from 'next/navigation';

export default async function FlyLabFallbackRoute({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;

  if (path.length === 1 && path[0]?.toLowerCase() === 'use') {
    redirect('/');
  }

  notFound();
}
