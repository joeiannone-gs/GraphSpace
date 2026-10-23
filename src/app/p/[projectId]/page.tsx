import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/server/db';
import { HttpError } from '@/server/http';
import { getProject, getWorking } from '@/server/repo/projects';
import { currentUser } from '@/server/session';
import { ProjectEditor } from '@/ui/ProjectEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'GraphSpace' };

function load(userId: string, projectId: string) {
  const db = getDb();
  try {
    const project = getProject(db, userId, projectId);
    return { project, working: getWorking(db, userId, projectId, project.defaultBranchId) };
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/p/${projectId}`)}`);
  const { project, working } = load(user.id, projectId);
  return (
    <ProjectEditor
      user={{ email: user.email, displayName: user.displayName }}
      project={{ id: project.id, title: project.title }}
      branchId={project.defaultBranchId}
      initialDoc={working.doc}
      initialVersion={working.version}
    />
  );
}
