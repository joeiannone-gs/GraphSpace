import type { Metadata } from 'next';
import { SandboxEditor } from './SandboxEditor';

export const metadata: Metadata = { title: 'Sandbox · GraphSpace' };

export default function SandboxPage() {
  return <SandboxEditor />;
}
