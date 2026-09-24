import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Tezlik nazorati kontrakti (egasi 2026-09-25: "tizim shu yechimga moslashishi
 * kerak"). Ikki qatlam birga yashaydi va biri jimgina olib tashlanmasin:
 *  - baza: supabase/tests/t2_obyekt_read_model_tezlik_contract.sql
 *    (obyekt read-model lar butun t2_qator ni aylanmaydi — avtomatik topiladi);
 *  - gateway: /api/sb byudjetdan oshgan o'qishni logga yozadi va `sekin: true`.
 */
const root = resolve(__dirname, '../../..');

describe('tezlik nazorati kontrakti', () => {
  it('gateway vaqt byudjeti va sekin bayrog\'i mavjud', () => {
    const sb = readFileSync(resolve(root, 'frontend/functions/api/sb.ts'), 'utf8');
    expect(sb).toMatch(/const TEZLIK_BYUDJETI_MS = \d+;/);
    expect(sb).toContain("hodisa: 'sb_sekin_oqish'");
    expect(sb).toContain('sekin: true');
  });

  it('baza kontrakti read-model larni avtomatik topadi va Seq Scan ni taqiqlaydi', () => {
    const sql = readFileSync(resolve(root, 'supabase/tests/t2_obyekt_read_model_tezlik_contract.sql'), 'utf8');
    expect(sql).toContain("a.attname = 'obyekt_id'");
    expect(sql).toContain("'public.t2_qator'::regclass");
    expect(sql).toContain('TEZLIK_KONTRAKTI_FAIL');
  });

  it('tuzatilgan view migratsiyalari filtrni ichkariga o\'tkazadi', () => {
    const v1 = readFileSync(resolve(root, 'supabase/migrations/20261028090000_t2_qator_holat_obyekt_filtr_v1.sql'), 'utf8');
    expect(v1).toMatch(/with direct as not materialized/i);
    expect(v1).toContain('parent.obyekt_id = d.obyekt_id');
    const v2 = readFileSync(resolve(root, 'supabase/migrations/20261028091000_t2_obyekt_read_model_filtr_v2.sql'), 'utf8');
    expect(v2).toContain('rz.obyekt_id = q.obyekt_id');
    expect(v2).toContain('kat AS NOT MATERIALIZED');
  });
});
