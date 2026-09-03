-- T2-LRV-PRICE-CONTROL-CORE-004. SOURCE ONLY; no parallel LRV truth.
begin;
create table if not exists public.t2_price_basis (
 id bigint generated always as identity primary key, kompaniya_id bigint not null references public.t2_kompaniya(id), document_id bigint, holat text not null default 'qoralama' check(holat in('qoralama','tasdiqlangan','bekor')), versiya integer not null default 1, operation_id uuid unique, actor_id bigint, yaratildi timestamptz not null default now());
create table if not exists public.t2_price_basis_line (
 id bigint generated always as identity primary key, basis_id bigint not null references public.t2_price_basis(id), qator_id bigint not null references public.t2_qator(id), approved_price numeric not null, valid_from date, valid_to date, unique(basis_id,qator_id));
alter table public.t2_akt_qator add column if not exists reference_price_snapshot numeric, add column if not exists reference_basis_line_id bigint references public.t2_price_basis_line(id);
alter table public.t2_price_basis enable row level security; alter table public.t2_price_basis_line enable row level security;
revoke all on public.t2_price_basis,public.t2_price_basis_line from public,anon,authenticated;
commit;
