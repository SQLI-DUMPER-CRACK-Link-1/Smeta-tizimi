import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gas } from './client';
import type { BossData, TreeNode, PapkaObyekt, Edit, BlQosh, RsQosh } from './types';

export function useObyektlar() {
  return useQuery({
    queryKey: ['obyektlar'],
    queryFn: () => gas<PapkaObyekt[]>('apiPapkaSkan'),
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

// Phase 2: Locking hooks
export function useLockStatus(obyekt: string) {
  return useQuery({
    queryKey: ['lock', obyekt],
    queryFn: () => gas<{ status: string, user?: string }>('apiLockOl', obyekt),
    enabled: !!obyekt,
  });
}

export function useLockAcquire() {
  return useMutation({
    mutationFn: ({ obyekt, reason }: { obyekt: string, reason: string }) => gas('apiLockBos', obyekt, reason),
  });
}

export function useLockRelease() {
  return useMutation({
    mutationFn: ({ obyekt, reason }: { obyekt: string, reason: string }) => gas('apiLockOch', obyekt, reason),
  });
}

// Phase 2: Edit mutations
export function useHolatSaqla(obyekt: string) {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: (edits: Edit[]) => gas<{jami:number, qatorlar:number}>('apiHolatSaqla', obyekt, edits),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['holat', obyekt] });
      const oldingi = qc.getQueryData(['holat', obyekt, false]);
      
      // We don't do full optimistic update here for now because tree manipulation is complex 
      // and we want exact truth from the server, but we will rely on onSettled to refresh.
      
      return { oldingi };
    },
    onError: (_xato, _v, ctx) => {
      qc.setQueryData(['holat', obyekt, false], ctx?.oldingi);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['holat', obyekt] });
    },
  });
}

export function useBlQosh() {
  return useMutation({
    mutationFn: (params: BlQosh) => gas<number>('apiBlQosh', params)
  });
}

export function useRsQosh() {
  return useMutation({
    mutationFn: (params: RsQosh) => gas<number>('apiRsQosh', params)
  });
}

export function useOyQosh() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom }: { obyekt: string, oyNom: string }) => gas<string>('apiOyQosh', obyekt, oyNom)
  });
}
