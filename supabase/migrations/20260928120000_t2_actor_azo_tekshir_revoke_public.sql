-- T2 Daily Cutover: Finish security gate
-- Revoke execution of service-only RPC from public, anon, and authenticated
REVOKE EXECUTE ON FUNCTION public.t2_actor_kompaniya_azo_tekshir(bigint, bigint) FROM public;
REVOKE EXECUTE ON FUNCTION public.t2_actor_kompaniya_azo_tekshir(bigint, bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.t2_actor_kompaniya_azo_tekshir(bigint, bigint) FROM authenticated;
