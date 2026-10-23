'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import styles from './editor.module.css';

export function Header({ right }: { right?: React.ReactNode }) {
  const theme = useAppSelector((s) => s.ui.theme);
  const dispatch = useAppDispatch();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <Image src="/logo.png" alt="" width={30} height={30} />
        <span>GraphSpace</span>
      </Link>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={theme === 'dark'}
          onChange={(e) => dispatch(uiActions.setTheme(e.target.checked ? 'dark' : 'light'))}
        />
        <span>Dark mode</span>
      </label>
      <div className={styles.headerRight}>{right}</div>
    </header>
  );
}
