-- Rollback for 20260919120000_t2_construction_catalog_observation_v1.
-- Pure additive table drops -- t2_ish_turi/t2_narx/t2_qator/t2_akt_qator/
-- t2_material_alias_royxat were never touched by the forward migration.
drop table if exists public.t2_catalog_match_candidate;
drop table if exists public.t2_work_resource_observation;
drop table if exists public.t2_resource_observation;
drop table if exists public.t2_work_type_observation;
