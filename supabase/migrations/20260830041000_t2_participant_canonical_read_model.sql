-- Canonical participant read model (additive).
-- Both project tabs and graph adapters can consume this relation instead of
-- reconstructing party identity from overloaded kompaniya_id fields.
create or replace view public.t2_loyiha_qatnashchi_canonical as
select
  q.id,
  q.loyiha_id,
  l.kompaniya_id as tenant_id,
  q.kompaniya_id as taraf_kompaniya_id,
  q.kontragent_id,
  case when q.kontragent_id is not null
       then 'kontragent:' || q.kontragent_id::text
       else 'kompaniya:' || q.kompaniya_id::text
  end as taraf_node_id,
  q.rol,
  q.holat,
  q.versiya,
  q.izoh
from public.t2_loyiha_qatnashchi q
join public.t2_loyiha l on l.id = q.loyiha_id
where q.holat = 'faol' and l.holat <> 'bekor';

comment on view public.t2_loyiha_qatnashchi_canonical is
  'Canonical tenant-scoped participant read model; exactly one party id is populated and rol is preserved.';

revoke all on public.t2_loyiha_qatnashchi_canonical from public, anon, authenticated;
grant select on public.t2_loyiha_qatnashchi_canonical to service_role;
