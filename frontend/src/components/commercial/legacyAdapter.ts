import type { CommercialContract } from './types';
/** Adapter boundary only: maps existing canonical t2_shartnoma reads, never writes. */
export interface LegacyContractRow { id:number; kompaniya_id:number; raqam:string; nom:string|null; summa_bez_nds:number|null; jami_nds_bilan:number|null; holat:string; versiya:number; }
export function commercialFromLegacy(row:LegacyContractRow):CommercialContract { return { contractId:String(row.id), companyId:String(row.kompaniya_id), number:row.raqam, scope:row.nom??'', currency:'UNSPECIFIED', contractValue:row.jami_nds_bilan??row.summa_bez_nds??0, parties:[], changeOrders:[], payments:[] }; }
