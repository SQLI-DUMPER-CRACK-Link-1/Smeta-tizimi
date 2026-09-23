/**
 * Katta smeta unumdorligi o'lchovi (egasi 2026-09-23: "27000 qatorli smetada
 * sahifada qotishlar — production uchun xavfli").
 *
 *   KORPUS_FAYL="C:/.../2438_STR_ALL_SM__....xls" npx vitest run src/lib/smeta-anatomiya/korpus/unumdorlik
 *
 * Real fayl anatomiya orqali `t2_qator` shakliga keltiriladi va LRV/Fakt
 * sahifalari bajaradigan qadamlar alohida o'lchanadi. Fayl yo'q bo'lsa — skip.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { kitobAnatomiyasi } from '../index';
import { faylniOqi } from './oqish';
import { sbT2TreeQur, type T2Qator, type T2QatorHolat } from '../../../api/supabase';
import { flattenTree, getAllKeys } from '../../../umumiy/daraxt/utils';
import type { TreeNode } from '../../../api/types';

const FAYL = process.env.KORPUS_FAYL;

function qator(id: number, ota: number | null, daraja: number, tur: string, nom: string, hajm: number | null): T2Qator {
  return {
    id, obyekt_id: 1, obyekt: null, kompaniya_id: 1, ota_id: ota, daraja, tartib: id, tur, kod: null, nom,
    birlik: null, hajm, narx: null, summa: null, kat: tur === 'rs' ? 'МАТ' : null, narx_usul: null,
    qoshimcha: null, zamena: null, d1: null, d2: null, d3: null, xom_qator: id, yangilandi: null,
    manba_id: null, versiya: 1, raqam: null, norma: null,
  };
}

function olchov<T>(nom: string, natija: Record<string, number>, f: () => T): T {
  const t0 = performance.now();
  const r = f();
  natija[nom] = Math.round((performance.now() - t0) * 10) / 10;
  return r;
}

describe.skipIf(!FAYL)('katta smeta unumdorligi', () => {
  it('LRV/Fakt sahifasi qadamlari (ms)', () => {
    const ms: Record<string, number> = {};
    const kitob = olchov('1_fayl_oqish', ms, () => faylniOqi(FAYL!, 'C:/'));
    const a = olchov('2_anatomiya', ms, () => kitobAnatomiyasi(kitob));
    const v = a.varaqlar.find((x) => x.varaq === a.asosiyLrv)!;

    // Anatomiya → t2_qator (sarlavhalar rz, ishlar bl, resurslar rs)
    const rows: T2Qator[] = [];
    const idMap = new Map<number, number>();
    let id = 1;
    const chuqurlik = new Map<number, number>();
    for (const s of [...v.titul, ...v.sarlavhalar]) {
      const ota = s.ota == null ? null : idMap.get(s.ota) ?? null;
      const d = ota == null ? 0 : (chuqurlik.get(ota) ?? 0) + 1;
      idMap.set(s.id, id); chuqurlik.set(id, d);
      rows.push(qator(id++, ota, d, 'rz', s.xom, null));
    }
    for (const ish of v.ishlar) {
      const ota = ish.sarlavha == null ? null : idMap.get(ish.sarlavha) ?? null;
      const d = ota == null ? 0 : (chuqurlik.get(ota) ?? 0) + 1;
      const blId = id++;
      rows.push(qator(blId, ota, d, 'bl', ish.xom, ish.hajm));
      for (const r of ish.resurslar) rows.push(qator(id++, blId, d + 1, 'rs', r.xom, r.hajm));
    }
    const states: T2QatorHolat[] = rows.map((r) => ({
      id: r.id, qator_id: r.id, obyekt_id: 1, tur: r.tur, kod: null, nom: r.nom, birlik: null, kat: r.kat,
      smeta_hajm: r.hajm, smeta_summa: null, fakt_hajm: 0, fakt_summa: 0, f2_hajm: 0, f2_summa: 0,
      qoldiq_hajm: r.hajm, qoldiq_summa: null,
    }));

    // Har fakt saqlanganda sahifa shularni qayta bajaradi:
    const jsonRows = JSON.stringify(rows), jsonStates = JSON.stringify(states);
    const kb = Math.round((jsonRows.length + jsonStates.length) / 1024);
    olchov('3_json_parse(qatorlar+holat)', ms, () => { JSON.parse(jsonRows); JSON.parse(jsonStates); });
    const tree: TreeNode[] = olchov('4_sbT2TreeQur', ms, () => sbT2TreeQur(rows, states));
    olchov('5_flatten_yopiq', ms, () => flattenTree(tree, {}));
    const hammasi = olchov('6_getAllKeys', ms, () => Object.fromEntries(getAllKeys(tree).map((k) => [k, true])));
    const flat = olchov('7_flatten_hammasi_ochiq', ms, () => flattenTree(tree, hammasi));

    // Qidiruv: SmetaTree.filtrlangan bilan bir xil ish, debounce'siz har harfda.
    const suz = (nodes: TreeNode[], s: string): TreeNode[] => {
      const chiq: TreeNode[] = [];
      for (const n of nodes) {
        const bolalar = n.children ? suz(n.children, s) : [];
        if (String(n.nom || '').toLowerCase().includes(s)) chiq.push(n);
        else if (bolalar.length) chiq.push({ ...n, children: bolalar });
      }
      return chiq;
    };
    olchov('8_qidiruv_bir_harf', ms, () => suz(tree, 'бетон'));

    const hisobot = JSON.stringify({ qatorlar: rows.length, json_kb: kb, flat_ochiq: flat.length, ms }, null, 1);
    if (process.env.KORPUS_OUT) fs.writeFileSync(process.env.KORPUS_OUT, hisobot);
    expect(rows.length).toBeGreaterThan(1000);
  }, 600_000);
});
