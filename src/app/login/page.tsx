import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/ui/AuthForm';
import { SiteBar } from '@/ui/SiteBar';
import styles from '@/ui/site.module.css';

export const metadata: Metadata = { title: 'Sign in · GraphSpace' };

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <SiteBar user={null} />
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
