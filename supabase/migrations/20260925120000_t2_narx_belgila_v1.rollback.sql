-- Pre-use/source rollback only.  It removes the two additive command RPCs;
-- no business row is deleted by this script.
begin;
drop function if exists public.t2_narx_sana_qosh(date, jsonb, text, text);
drop function if exists public.t2_narx_belgila(text, text, numeric, text, text, integer, text, text);
commit;
