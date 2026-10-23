import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getExample } from '@/gallery/examples';
import { exampleDoc } from '@/server/examples';
import { currentUser } from '@/server/session';
import { ForkButton } from '@/ui/ForkButton';
import { ScratchEditor } from '@/ui/ScratchEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Example · GraphSpace' };

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const example = getExample(slug);
  if (!example) notFound();
  const user = await currentUser();
  return (
    <ScratchEditor
      doc={exampleDoc(slug)!}
      title={example.title}
      headerRight={user ? <Link href="/">My GraphSpace</Link> : <Link href={`/login?next=/gallery/${slug}`}>Sign in</Link>}
      banner={
        <>
          <span>{example.summary} Changes here aren’t saved.</span>
          <ForkButton signedIn={Boolean(user)} from={{ example: slug }} returnTo={`/gallery/${slug}`} />
        </>
      }
    />
  );
}
