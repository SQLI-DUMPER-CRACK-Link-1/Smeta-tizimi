import { tekshir } from '../_shared/auth';

type Env = { SUPABASE_URL: string; SUPABASE_KEY: string; SESSIYA_KALIT: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READ = new Set(['commercial_get','procurement_overview','schedule_overview']);
const WRITE: Record<string,string> = {
  commercial_update:'t2_commercial_contract_update_v2', change_order_create:'t2_change_order_create_v2',
  change_order_decide:'t2_change_order_decide_v2', material_need_create:'t2_material_need_create_v2', procurement_pr_create:'t2_procurement_pr_create_v2', procurement_rfq_create:'t2_procurement_rfq_create_v2',
  procurement_bid_submit:'t2_procurement_bid_submit_v2', procurement_award:'t2_procurement_award_v2',
  procurement_receipt:'t2_procurement_receipt_record_v2', schedule_dependency_create:'t2_schedule_dependency_create_v2',
  schedule_progress:'t2_schedule_progress_record_v2', schedule_baseline_lock:'t2_schedule_baseline_lock_v2',
};
function rpc(ctx: EventContext<Env, string, unknown>, name: string, payload: Record<string,unknown>) {
  return fetch(ctx.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/' + name, { method:'POST', headers:{apikey:ctx.env.SUPABASE_KEY,Authorization:'Bearer '+ctx.env.SUPABASE_KEY,'Content-Type':'application/json'}, body:JSON.stringify(payload) });
}
function error(message:string,status=400){ return Response.json({ok:false,code:message},{status}); }
export const onRequestPost: PagesFunction<Env> = async ctx => {
  const sess=await tekshir(ctx.request.headers.get('Cookie'),ctx.env.SESSIYA_KALIT);
  if(!sess || !Number.isInteger(sess.foydalanuvchi_id)) return error('AUTH_REQUIRED',401);
  if(!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) return error('CANONICAL_DATABASE_UNAVAILABLE',503);
  const body=await ctx.request.json<Record<string,unknown>>(); const action=String(body.action||'');
  const kompaniyaId=Number(body.kompaniyaId); if(!Number.isInteger(kompaniyaId)||kompaniyaId<=0) return error('COMPANY_ID_REQUIRED');
  if(!WRITE[action]) return error('DOMAIN_ACTION_UNKNOWN',404);
  const operationId=String(body.operationId||''); if(!UUID.test(operationId)) return error('OPERATION_ID_REQUIRED');
  const a=body.args as Record<string,unknown>||{}; const actor=Number(sess.foydalanuvchi_id);
  const payload:Record<string,unknown>={p_kompaniya_id:kompaniyaId,p_actor_id:actor,p_operation_id:operationId};
  if(action==='commercial_update') Object.assign(payload,{p_shartnoma_id:Number(a.contractId),p_expected_version:Number(a.expectedVersion),p_terms:a.terms||{}});
  if(action==='change_order_create') Object.assign(payload,{p_shartnoma_id:Number(a.contractId),p_raqam:String(a.number||''),p_sabab:String(a.reason||''),p_summa:Number(a.amount),p_loyiha_id:a.projectId??null,p_obyekt_id:a.objectId??null});
  if(action==='change_order_decide') Object.assign(payload,{p_change_order_id:Number(a.changeOrderId),p_expected_version:Number(a.expectedVersion),p_decision:String(a.decision||''),p_note:a.note??null});
  if(action==='material_need_create') Object.assign(payload,{p_obyekt_id:Number(a.objectId),p_loyiha_id:a.projectId??null,p_material_id:Number(a.materialId),p_quantity:Number(a.quantity),p_unit:String(a.unit||''),p_needed_by:a.neededBy??null});
  if(action==='procurement_pr_create') Object.assign(payload,{p_material_need_id:Number(a.materialNeedId),p_item_text:String(a.itemText||'')});
  if(action==='procurement_rfq_create') Object.assign(payload,{p_request_id:Number(a.requestId)});
  if(action==='procurement_bid_submit') Object.assign(payload,{p_rfq_id:Number(a.rfqId),p_supplier_company_id:a.supplierCompanyId??null,p_amount:Number(a.amount)});
  if(action==='procurement_award') Object.assign(payload,{p_bid_id:Number(a.bidId),p_purchase_contract_id:a.purchaseContractId??null,p_po_reference:a.poReference??null});
  if(action==='procurement_receipt') Object.assign(payload,{p_request_id:Number(a.requestId),p_award_id:a.awardId??null,p_quantity:Number(a.quantity)});
  if(action==='schedule_dependency_create') Object.assign(payload,{p_predecessor_id:Number(a.predecessorId),p_successor_id:Number(a.successorId),p_tur:String(a.type||'FS'),p_lag_kun:Number(a.lagDays||0)});
  if(action==='schedule_progress') Object.assign(payload,{p_grafik_id:Number(a.activityId),p_expected_version:Number(a.expectedVersion),p_foiz:Number(a.progress),p_holat:String(a.status||''),p_actual_start:a.actualStart??null,p_actual_finish:a.actualFinish??null,p_forecast_finish:a.forecastFinish??null});
  if(action==='schedule_baseline_lock') Object.assign(payload,{p_loyiha_id:Number(a.projectId)});
  const r=await rpc(ctx,WRITE[action],payload); const text=await r.text();
  if(!r.ok){ const stale=/STALE_VERSION/.test(text); return Response.json({ok:false,code:stale?'STALE_VERSION':'DOMAIN_COMMAND_FAILED',detail:text.slice(0,300)},{status:stale?409:r.status===403?403:422}); }
  return new Response(text,{headers:{'Content-Type':'application/json'}});
};
export const onRequestGet: PagesFunction<Env> = async ctx => {
  const sess=await tekshir(ctx.request.headers.get('Cookie'),ctx.env.SESSIYA_KALIT);
  if(!sess || !Number.isInteger(sess.foydalanuvchi_id)) return error('AUTH_REQUIRED',401);
  if(!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) return error('CANONICAL_DATABASE_UNAVAILABLE',503);
  const url=new URL(ctx.request.url), action=String(url.searchParams.get('action')||''); if(!READ.has(action)) return error('DOMAIN_READ_UNKNOWN',404);
  const kompaniyaId=Number(url.searchParams.get('kompaniyaId')); if(!Number.isInteger(kompaniyaId)||kompaniyaId<=0) return error('COMPANY_ID_REQUIRED');
  const actor=Number(sess.foydalanuvchi_id); let name=''; const payload:Record<string,unknown>={p_kompaniya_id:kompaniyaId,p_actor_id:actor};
  if(action==='commercial_get'){name='t2_commercial_contract_get_v2';payload.p_shartnoma_id=url.searchParams.get('contractId')?Number(url.searchParams.get('contractId')):null;}
  if(action==='procurement_overview'){name='t2_procurement_overview_v2';payload.p_loyiha_id=url.searchParams.get('projectId')?Number(url.searchParams.get('projectId')):null;}
  if(action==='schedule_overview'){name='t2_schedule_overview_v2';payload.p_loyiha_id=Number(url.searchParams.get('projectId')); if(!Number.isInteger(payload.p_loyiha_id)) return error('PROJECT_ID_REQUIRED');}
  const r=await rpc(ctx,name,payload); const text=await r.text(); return r.ok?new Response(text,{headers:{'Content-Type':'application/json'}}):Response.json({ok:false,code:r.status===403?'COMPANY_ACCESS_DENIED':'DOMAIN_READ_FAILED',detail:text.slice(0,300)},{status:r.status===403?403:502});
};
