import { getAssets } from '@/app/nodes/assets';
import { useEffect, useState } from 'react';


export let assets: any;

export function usePixiAssets() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        assets = await getAssets();
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load assets'));
        setIsLoading(false);
      }
    };

    loadAssets();
  }, []);

  return { isLoading, error }
}