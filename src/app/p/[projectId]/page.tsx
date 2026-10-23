import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/server/db';
import { HttpError } from '@/server/http';
import { getProject, getWorking } from '@/server/repo/projects';
import { getProgress } from '@/server/repo/lessons';
import { currentUser } from '@/server/session';
import { ProjectEditor } from '@/ui/ProjectEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'GraphSpace' };

function load(userId: string, projectId: string, branch: string | undefined) {
  const db = getDb();
  try {
    const project = getProject(db, userId, projectId);
    const branchId = project.branches.some((b) => b.id === branch) ? branch! : project.defaultBranchId;
    return { project, branchId, working: getWorking(db, userId, projectId, branchId) };
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ branch?: string }>;
}) {
  const { projectId } = await params;
  const { branch } = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/p/${projectId}`)}`);
  const { project, branchId, working } = load(user.id, projectId, branch);
  const progress = project.lessonId ? getProgress(getDb(), user.id, project.lessonId) : undefined;
  return (
    <ProjectEditor
      user={{ email: user.email, displayName: user.displayName }}
      project={{ id: project.id, title: project.title, lessonId: project.lessonId }}
      lessonProgress={progress && progress.projectId === project.id ? { step: progress.step, completed: progress.completed } : undefined}
      key={branchId}
      branchId={branchId}
      initialDoc={working.doc}
      initialVersion={working.version}
    />
  );
}
