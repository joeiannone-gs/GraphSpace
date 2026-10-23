'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './editor.module.css';

const KEY = 'graphspace:tabs';

interface Tab {
  id: string;
  title: string;
}

function read(): Tab[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tab[]) : [];
  } catch {
    return [];
  }
}

function write(tabs: Tab[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tabs.slice(-8)));
  } catch {
    // Storage blocked: tabs just won't persist.
  }
}

/** Recently opened projects along the bottom of the canvas. */
export function Tabs({ current }: { current: Tab }) {
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([]);
  useEffect(() => {
    const list = read().filter((t) => t.id !== current.id);
    const next = [...list, current];
    write(next);
    // Reading localStorage can only happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTabs(next);
  }, [current]);

  if (tabs.length <= 1) return null;
  return (
    <nav className={styles.tabs} aria-label="Open projects">
      {tabs.map((t) => (
        <span key={t.id} className={styles.tab} data-active={t.id === current.id}>
          <Link href={`/p/${t.id}`}>{t.title}</Link>
          <button
            className={styles.tabClose}
            aria-label={`Close ${t.title}`}
            onClick={() => {
              const rest = tabs.filter((x) => x.id !== t.id);
              write(rest);
              setTabs(rest);
              if (t.id === current.id) router.push(rest.length ? `/p/${rest[rest.length - 1].id}` : '/');
            }}
          >
            ×
          </button>
        </span>
      ))}
    </nav>
  );
}
