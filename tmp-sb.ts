import { tekshir } from '../_shared/auth';

const RUXSAT_JADVALLAR = new Set([
  'obyektlar', 'holat', 'oylik_f2', 'narxlar', 'material_kerak',
  'shartnoma', 'v_sklad_nomlar', 'tolovlar', 'prixod', 'rashod', 'topilmaganlar',
  'akt', 'akt_ish', 'tarix', 'anomaliya',
  't2_kompaniya', 't2_obyekt', 't2_obyekt_jami', 't2_daraxt', 't2_qator',
  't2_narx', 't2_manba', 't2_xom', 't2_lrv',
  't2_kozgu', 't2_ozgarish', 't2_kopruk_navbat', 't2_sozlama',
  't2_akt', 't2_akt_qator', 't2_akt_reestr', 't2_qator_holat', 't2_faktura', 't2_ish_turi', 't2_shaxsiy_smeta',
  'v_erp_kadrlar_dashboard', 'v_erp_texnika_dashboard', 'v_erp_taminot_dashboard', 'v_erp_sifat_dashboard', 't2_grafik_holat', 'v_boss_init', 'v_boss_data',
  't2_narx_markaz', 't2_topilmaganlar', 't2_narx_sana', 't2_narx_qol_xavf',
  't2_f2_kat_oy', 't2_f2_tafsilot',
  't2_birja_rfq', 't2_sklad_qoldiq'
]);

/** PostgREST filtri xavfsizmi */
