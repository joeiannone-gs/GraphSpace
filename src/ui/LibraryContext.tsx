'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Subtree } from '@/doc/clone';
import { api } from '@/lib/api';

export interface LibraryItem {
  id: string;
  name: string;
  description: string;
  subtree: Subtree;
}

interface LibraryApi {
  nodes: LibraryItem[];
  save(name: string, description: string, subtree: Subtree): Promise<void>;
  remove(id: string): Promise<void>;
}

const LibraryContext = createContext<LibraryApi | null>(null);

/** The signed-in user's saved nodes. Absent in the sandbox (no account). */
export function useLibrary(): LibraryApi | null {
  return useContext(LibraryContext);
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<LibraryItem[]>([]);
  const refresh = useCallback(async () => {
    const res = await api<{ nodes: LibraryItem[] }>('/api/library');
    setNodes(res.nodes);
  }, []);
  useEffect(() => {
    let live = true;
    void api<{ nodes: LibraryItem[] }>('/api/library').then((res) => live && setNodes(res.nodes), () => undefined);
    return () => {
      live = false;
    };
  }, []);
  const value: LibraryApi = {
    nodes,
    save: async (name, description, subtree) => {
      await api('/api/library', { body: { name, description, subtree } });
      await refresh();
    },
    remove: async (id) => {
      await api(`/api/library/${id}`, { method: 'DELETE' });
      await refresh();
    },
  };
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
