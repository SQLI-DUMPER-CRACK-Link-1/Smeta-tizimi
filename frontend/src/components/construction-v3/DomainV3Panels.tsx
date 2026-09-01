import React,{useState}from'react';
import {CommercialContractCard}from'../commercial';
import {ProcurementLineageCard}from'../procurement';
import {ScheduleBoard}from'../schedule';
import type {CommercialDto,ProcurementDto,ScheduleDto} from'../../api/t2-domain-v3';

export function CommercialV2Panel({contracts,onChange}:{contracts:CommercialDto[];onChange?:(contractId:number)=>void}){
 return <section aria-label="Commercial V2" className="space-y-3">{contracts.map(c=><CommercialContractCard key={c.contract_id} contract={{contractId:String(c.contract_id),companyId:String(c.kompaniya_id),number:c.raqam,scope:c.nom??'',currency:c.valuta,contractValue:Number(c.contract_value??0),advanceAmount:c.advance_amount??undefined,retentionPercent:c.retention_percent??undefined,parties:[],changeOrders:c.change_orders.map(x=>({changeOrderId:String(x.id),contractId:String(c.contract_id),amount:Number(x.summa),status:x.holat==='approved'?'APPROVED':x.holat==='rejected'?'REJECTED':'DRAFT'})),payments:[]}} onCreateChange={()=>onChange?.(c.contract_id)}/>)}</section>;
}
export function ProcurementV2Panel({requests,onOpen}:{requests:ProcurementDto[];onOpen?:(requestId:number)=>void}){
 return <section aria-label="Procurement Warehouse V2" className="space-y-3">{requests.map(r=><ProcurementLineageCard key={r.request_id} item={{requestId:String(r.request_id),companyId:'',materialId:String(r.material_id??'UNASSIGNED'),stage:(r.stage as any),quantity:Number(r.quantity),unit:'',rfqId:r.rfq_id?String(r.rfq_id):undefined,purchaseOrderId:r.award_id?String(r.award_id):undefined,grnId:r.stage==='GRN'?String(r.request_id):undefined}} onOpen={()=>onOpen?.(r.request_id)}/>)}</section>;
}
export function ScheduleV2Panel({activities,onOpen}:{activities:ScheduleDto[];onOpen?:(activityId:number)=>void}){
 return <ScheduleBoard tasks={activities.map(a=>({taskId:String(a.activity_id),projectId:'',name:a.nom,startDate:a.baseline_start??undefined,finishDate:a.forecast_finish??undefined,progressPercent:Number(a.progress),status:a.holat==='bajarildi'?'DONE':a.holat==='jarayonda'?'IN_PROGRESS':'NOT_STARTED',dependencyTaskIds:a.dependencies.map(String)}))} onOpen={id=>onOpen?.(Number(id))}/>;
}
export function DomainV3CommandError({error}:{error:unknown}){const [open,setOpen]=useState(false); if(!error)return null;const code=error instanceof Error?error.message:'DOMAIN_COMMAND_FAILED';return <div role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100"><b>{code}</b>{code==='STALE_VERSION'&&<span> — ma'lumot yangilandi; qayta o'qing.</span>}<button className="ml-3 underline" onClick={()=>setOpen(!open)}>tafsilot</button>{open&&<pre className="mt-2 overflow-auto text-xs">{String(error)}</pre>}</div>}
