'use client';
import { useState } from 'react';
import type { ProjectDoc } from '@/doc/types';
import { api } from '@/lib/api';
import { CommitHistory } from './CommitHistory';
import { EditorProvider } from './EditorContext';
import { EditorShell } from './EditorShell';
import { LibraryProvider } from './LibraryContext';
import { MyGraphSpace } from './MyGraphSpace';
import { Tabs } from './Tabs';
import { UserMenu } from './UserMenu';
import { useServerPersistence, type SaveStatus } from './useServerPersistence';
import styles from './editor.module.css';

export interface ProjectEditorProps {
  user: { email: string; displayName: string };
  project: { id: string; title: string };
  branchId: string;
  initialDoc: ProjectDoc;
  initialVersion: number;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'All changes saved',
  saving: 'Saving…',
  unsaved: 'Unsaved changes',
  conflict: 'Not saved',
  offline: 'Offline — retrying',
};

function ProjectTitle({ id, title, onRenamed }: { id: string; title: string; onRenamed(t: string): void }) {
  return (
    <input
      className={styles.projectTitle}
      defaultValue={title}
      aria-label="Project title"
      maxLength={120}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onBlur={async (e) => {
        const next = e.target.value.trim();
        if (!next || next === title) return;
        await api(`/api/projects/${id}`, { method: 'PATCH', body: { title: next } });
        onRenamed(next);
      }}
    />
  );
}

function Editor({ user, project, branchId, initialDoc, initialVersion }: ProjectEditorProps) {
  const { status, conflict, actions } = useServerPersistence({ projectId: project.id, branchId, initialDoc, initialVersion });
  const [title, setTitle] = useState(project.title);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <EditorShell
      headerCenter={
        <ProjectTitle
          id={project.id}
          title={title}
          onRenamed={(t) => {
            setTitle(t);
            setRefreshKey((k) => k + 1);
          }}
        />
      }
      headerRight={
        <>
          <span className={styles.saveStatus} data-testid="save-status">
            {STATUS_TEXT[status]}
          </span>
          <UserMenu user={user} />
        </>
      }
      left={<MyGraphSpace currentProjectId={project.id} refreshKey={refreshKey} />}
      right={
        <CommitHistory
          projectId={project.id}
          branchId={branchId}
          flush={async () => {
            await actions.current.flush();
            return actions.current.version();
          }}
        />
      }
      overlay={
        <>
          <Tabs current={{ id: project.id, title }} />
          {conflict && (
            <div className={styles.banner} role="alert">
              This project was changed somewhere else (another tab?).
              <button className={styles.button} onClick={() => actions.current.loadTheirs()}>
                Load that version
              </button>
              <button className={styles.linkButton} onClick={() => actions.current.keepMine()}>
                Keep mine
              </button>
            </div>
          )}
        </>
      }
    />
  );
}

export function ProjectEditor(props: ProjectEditorProps) {
  return (
    <EditorProvider>
      <LibraryProvider>
        <Editor {...props} />
      </LibraryProvider>
    </EditorProvider>
  );
}
