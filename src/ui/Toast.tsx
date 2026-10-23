'use client';
import { useEffect } from 'react';
import { docActions } from '@/store/docSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import styles from './editor.module.css';

export function Toast() {
  const toast = useAppSelector((s) => s.ui.toast);
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      dispatch(uiActions.showToast(null));
      dispatch(docActions.clearRejected());
    }, 3500);
    return () => clearTimeout(t);
  }, [toast, dispatch]);
  return toast ? (
    <div className={styles.toast} role="status">
      {toast}
    </div>
  ) : null;
}
