import { useQuery } from '@tanstack/react-query';
import { gas } from './client';
import type { BossData, TreeNode, ObyektInfo } from './types';

export function useObyektlar() {
  return useQuery({
    queryKey: ['obyektlar'],
    queryFn: () => gas<ObyektInfo[]>('apiPapkaSkan'),
    staleTime: 10 * 60 * 1000, // 10 minutes cache as requested
  });
}

export function useBossData() {
  return useQuery({
    queryKey: ['bossData'],
    queryFn: () => gas<BossData>('apiBossData'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useHolat(obyekt: string, forceRefresh: boolean = false) {
  return useQuery({
    queryKey: ['holat', obyekt, forceRefresh],
    queryFn: () => gas<{ tree: TreeNode[], lokalkalar: string[] }>('apiHolatOl', obyekt, forceRefresh),
    staleTime: Infinity, // Extremely heavy, don't refetch unless forced
    enabled: !!obyekt,
  });
}
