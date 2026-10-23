import Image from 'next/image';
import Link from 'next/link';
import { makeThumb } from '@/doc/thumb';
import { examples } from '@/gallery/examples';
import { getDb } from '@/server/db';
import { listProjects } from '@/server/repo/projects';
import { currentUser } from '@/server/session';
import { DocThumbnail } from '@/ui/DocThumbnail';
import { NewProjectButton } from '@/ui/ProjectActions';
import { SiteBar } from '@/ui/SiteBar';
import styles from '@/ui/site.module.css';

export const dynamic = 'force-dynamic';

function Examples({ signedIn }: { signedIn: boolean }) {
  return (
    <div className={styles.grid}>
      {examples.map((ex) => {
        const art = (
          <>
            <span className={styles.tileArt}>
              <DocThumbnail thumb={makeThumb(ex.build())} />
            </span>
            <span className={styles.tileTitle}>{ex.title}</span>
            <span className={styles.muted}>{ex.summary}</span>
          </>
        );
        return signedIn ? (
          <NewProjectButton key={ex.slug} className={styles.tile} from={{ kind: 'example', slug: ex.slug }} label={art} />
        ) : (
          <Link key={ex.slug} className={styles.tile} href={`/gallery/${ex.slug}`}>
            {art}
          </Link>
        );
      })}
    </div>
  );
}

export default async function Home() {
  const user = await currentUser();
  if (!user) {
    return (
      <div className={styles.page}>
        <SiteBar user={null} />
        <main className={styles.main}>
          <section className={styles.hero}>
            <Image src="/LogoAndName.png" alt="GraphSpace" width={399} height={152} priority style={{ height: 'auto', maxWidth: '100%' }} />
            <p>Build machine-learning models by connecting nodes, then train them and watch every number change.</p>
            <div className={styles.row}>
              <Link className={styles.primary} href="/learn">
                Start learning
              </Link>
              <Link className={styles.secondary} href="/sandbox">
                Try the sandbox
              </Link>
              <Link className={styles.secondary} href="/login">
                Sign in
              </Link>
            </div>
          </section>
          <h2 className={styles.sectionTitle}>Examples</h2>
          <Examples signedIn={false} />
        </main>
      </div>
    );
  }

  const projects = listProjects(getDb(), user.id);
  return (
    <div className={styles.page}>
      <SiteBar user={user} />
      <main className={styles.main}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontWeight: 400, margin: 0 }}>My GraphSpace</h1>
          <NewProjectButton from={{ kind: 'blank' }} label="+ New project" />
        </div>
        <h2 className={styles.sectionTitle}>Projects</h2>
        {projects.length === 0 ? (
          <p className={styles.muted}>No projects yet. Start a blank one or begin from an example below.</p>
        ) : (
          <div className={styles.grid}>
            {projects.map((p) => (
              <Link key={p.id} className={styles.tile} href={`/p/${p.id}`} data-testid="project-tile">
                <span className={styles.tileArt}>
                  <DocThumbnail thumb={p.thumb} />
                </span>
                <span className={styles.tileTitle}>{p.title}</span>
                <span className={styles.muted}>Edited {new Date(p.updatedAt).toLocaleString()}</span>
              </Link>
            ))}
          </div>
        )}
        <h2 className={styles.sectionTitle}>Start from an example</h2>
        <Examples signedIn />
      </main>
    </div>
  );
}
