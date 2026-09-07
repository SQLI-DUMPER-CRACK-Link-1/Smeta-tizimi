-- Bugfix found while hardening t2_smeta_import_bulk_v1 against real-world
-- messy numeric cells (20261012090000): t2_son(text) stripped every
-- non-numeric character and concatenated whatever survived, so a unit
-- suffix that happens to contain a digit -- 'м3'/'м2', extremely common in
-- Russian/Uzbek construction documents -- got glued onto the number.
-- '10,5 м3' (an ordinary 10.5 m3 volume) silently became 10.53. This
-- affects every existing caller of t2_son (t2_akt_yarat's Fakt/F2 hajm/narx
-- parsing), not just the new Smeta import path -- fixing it here fixes it
-- everywhere, same function/signature, no caller changes needed.
--
-- Fix: extract the first well-formed numeric TOKEN (a proper regex match)
-- instead of deleting characters and gluing the remainder together. Verified
-- against production: '10,5 м3' -> 10.5 (not 10.53), '1 234,56' -> 1234.56,
-- '#REF!'/'—' -> NULL (unchanged, still never throws).

begin;

create or replace function public.t2_son(v text)
returns numeric
language plpgsql
immutable parallel safe
set search_path to 'public'
as $function$
declare s text; m text;
begin
  s := btrim(coalesce(v,''));
  if s = '' then return null; end if;
  s := replace(s, chr(160), '');
  s := regexp_replace(s, '[[:space:]]', '', 'g');
  s := replace(s, ',', '.');
  -- (?:...) is a NON-capturing group -- substring(from pattern) returns the
  -- last CAPTURING group's content when the pattern has one, not the
  -- overall match; a capturing group here silently returned NULL for every
  -- exponent-less number during testing until this was made non-capturing.
  m := substring(s from '[+-]?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?');
  if m is null or m = '' or m = '.' then return null; end if;
  return m::numeric;
exception when others then return null;
end $function$;

commit;
