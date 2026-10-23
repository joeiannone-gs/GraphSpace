import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/server/db';
import { HttpError } from '@/server/http';
import { readShare } from '@/server/repo/shares';
import { currentUser } from '@/server/session';
import { ForkButton } from '@/ui/ForkButton';
import { ScratchEditor } from '@/ui/ScratchEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Shared project · GraphSpace', robots: { index: false } };

function load(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  try {
    return readShare(getDb(), token);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = load(token);
  const user = await currentUser();
  return (
    <ScratchEditor
      doc={share.doc}
      title={share.title}
      headerRight={user ? <Link href="/">My GraphSpace</Link> : <Link href={`/login?next=/s/${token}`}>Sign in</Link>}
      banner={
        <>
          <span>
            Shared by <strong>{share.author}</strong>. You can run and change it here, but changes aren’t saved.
          </span>
          <ForkButton signedIn={Boolean(user)} from={{ share: token }} returnTo={`/s/${token}`} />
        </>
      }
    />
  );
}
