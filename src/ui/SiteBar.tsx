import Image from 'next/image';
import Link from 'next/link';
import type { User } from '@/server/auth';
import { UserMenu } from './UserMenu';
import styles from './site.module.css';

export function SiteBar({ user }: { user: User | null }) {
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.brand}>
        <Image src="/logo.png" alt="" width={30} height={30} />
        <span>GraphSpace</span>
      </Link>
      <div className={styles.barRight}>
        {user ? (
          <UserMenu user={user} />
        ) : (
          <>
            <Link href="/sandbox">Sandbox</Link>
            <Link href="/login">Sign in</Link>
          </>
        )}
      </div>
    </header>
  );
}
