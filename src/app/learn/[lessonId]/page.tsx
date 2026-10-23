import { notFound } from 'next/navigation';
import { getLesson } from '@/lessons';
import { LessonSandbox } from './LessonSandbox';

export default async function LessonTryPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (!getLesson(lessonId)) notFound();
  return <LessonSandbox lessonId={lessonId} />;
}
