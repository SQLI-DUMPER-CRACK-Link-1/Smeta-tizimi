export type DomainResult={ok:boolean;code?:string;[key:string]:unknown};
export type CommercialDto={contract_id:number;kompaniya_id:number;loyiha_id?:number|null;raqam:string;nom?:string|null;holat:string;valuta:string;contract_value:number|null;advance_amount?:number|null;retention_percent?:number|null;payment_days?:number|null;warranty_days?:number|null;version:number;approved_change_total:number;change_orders:Array<{id:number;raqam:string;summa:number;holat:string;versiya:number}>};
export type ProcurementDto={request_id:number;object_id:number;material_id:number|null;quantity:number;delivered_qty:number;remaining_qty:number;stage:string;rfq_id?:number;award_id?:number};
export type ScheduleDto={activity_id:number;object_id:number;wbs_qator_id?:number|null;nom:string;progress:number;holat:string;baseline_start?:string|null;baseline_finish?:string|null;forecast_finish?:string|null;variance_days?:number|null;late:boolean;dependencies:number[];procurement_risk:boolean};
export const operationId=():string=>crypto.randomUUID();
async function read<T>(action:string,kompaniyaId:number,extra:Record<string,string|number|undefined>={}){const q=new URLSearchParams({action,kompaniyaId:String(kompaniyaId)});for(const[k,v]of Object.entries(extra))if(v!=null)q.set(k,String(v));const r=await fetch('/api/domain-v3?'+q);const j=await r.json();if(!r.ok)throw Object.assign(new Error(j.code||'DOMAIN_READ_FAILED'),j);return j as T;}
async function write(action:string,kompaniyaId:number,args:Record<string,unknown>,id=operationId()){const r=await fetch('/api/domain-v3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,kompaniyaId,operationId:id,args})});const j=await r.json() as DomainResult;if(!r.ok)throw Object.assign(new Error(j.code||'DOMAIN_COMMAND_FAILED'),j);return j;}
export const commercialOl=(kompaniyaId:number,contractId?:number)=>read<{contracts:CommercialDto[]}>('commercial_get',kompaniyaId,{contractId});
export const procurementOl=(kompaniyaId:number,projectId?:number)=>read<{requests:ProcurementDto[]}>('procurement_overview',kompaniyaId,{projectId});
export const scheduleOl=(kompaniyaId:number,projectId:number)=>read<{activities:ScheduleDto[]}>('schedule_overview',kompaniyaId,{projectId});
export const commercialYangila=(k:number,args:Record<string,unknown>,id?:string)=>write('commercial_update',k,args,id);
export const changeOrderYarat=(k:number,args:Record<string,unknown>,id?:string)=>write('change_order_create',k,args,id);
export const changeOrderQaror=(k:number,args:Record<string,unknown>,id?:string)=>write('change_order_decide',k,args,id);
export const materialNeedYarat=(k:number,args:Record<string,unknown>,id?:string)=>write('material_need_create',k,args,id);
export const procurementPrYarat=(k:number,args:Record<string,unknown>,id?:string)=>write('procurement_pr_create',k,args,id);
export const rfqYarat=(k:number,args:Record<string,unknown>,id?:string)=>write('procurement_rfq_create',k,args,id);
export const bidYubor=(k:number,args:Record<string,unknown>,id?:string)=>write('procurement_bid_submit',k,args,id);
export const awardBer=(k:number,args:Record<string,unknown>,id?:string)=>write('procurement_award',k,args,id);
export const receiptYoz=(k:number,args:Record<string,unknown>,id?:string)=>write('procurement_receipt',k,args,id);
export const scheduleBogla=(k:number,args:Record<string,unknown>,id?:string)=>write('schedule_dependency_create',k,args,id);
export const scheduleProgress=(k:number,args:Record<string,unknown>,id?:string)=>write('schedule_progress',k,args,id);
export const scheduleBaselineQotir=(k:number,args:Record<string,unknown>,id?:string)=>write('schedule_baseline_lock',k,args,id);
