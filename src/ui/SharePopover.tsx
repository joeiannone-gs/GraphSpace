'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import styles from './editor.module.css';

interface Share {
  token: string;
  createdAt: number;
}

/** Create, copy and revoke read-only links to snapshots of this project. */
export function SharePopover({ projectId, branchId, flush }: { projectId: string; branchId: string; flush(): Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<Share[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void api<{ shares: Share[] }>(`/api/projects/${projectId}/shares`).then((r) => live && setShares(r.shares), () => undefined);
    return () => {
      live = false;
    };
  }, [open, projectId]);

  const url = (token: string) => `${window.location.origin}/s/${token}`;

  return (
    <span style={{ position: 'relative' }}>
      <button className={styles.button} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Share
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label="Share">
          <p style={{ margin: '0 0 8px' }}>Anyone with a link can open a copy of this project as it is now, run it, and fork it. Later changes don’t show up in old links.</p>
          <button
            className={styles.primary}
            onClick={async () => {
              await flush();
              const { share } = await api<{ share: Share }>(`/api/projects/${projectId}/shares`, { body: { branchId } });
              setShares((s) => [share, ...s]);
              await navigator.clipboard?.writeText(url(share.token)).catch(() => undefined);
              setCopied(share.token);
            }}
          >
            Create link
          </button>
          <ul className={styles.shareList}>
            {shares.map((s) => (
              <li key={s.token}>
                <input readOnly value={url(s.token)} onFocus={(e) => e.target.select()} aria-label="Share link" />
                <button
                  className={styles.linkButton}
                  onClick={async () => {
                    await navigator.clipboard?.writeText(url(s.token)).catch(() => undefined);
                    setCopied(s.token);
                  }}
                >
                  {copied === s.token ? 'Copied' : 'Copy'}
                </button>
                <button
                  className={styles.linkButton}
                  onClick={async () => {
                    await api(`/api/shares/${s.token}`, { method: 'DELETE' });
                    setShares((list) => list.filter((x) => x.token !== s.token));
                  }}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
