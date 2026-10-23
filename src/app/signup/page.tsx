import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/ui/AuthForm';
import { SiteBar } from '@/ui/SiteBar';
import styles from '@/ui/site.module.css';

export const metadata: Metadata = { title: 'Create an account · GraphSpace' };

export default function SignupPage() {
  return (
    <div className={styles.page}>
      <SiteBar user={null} />
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
