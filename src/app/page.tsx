import Image from 'next/image';

export default function Home() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <Image src="/LogoAndName.png" alt="GraphSpace" width={399} height={152} style={{ height: 'auto' }} priority />
        <p style={{ color: 'var(--gs-muted)' }}>Visual machine learning for learners. The editor is being rebuilt.</p>
      </div>
    </main>
  );
}
