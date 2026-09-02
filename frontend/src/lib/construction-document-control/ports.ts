import type { ApprovedChange, ConstructionDocumentControlReadModel, Id, ProgressValuationPage } from './types';
export interface ConstructionDocumentControlPort { read(input:{companyId:Id;projectId:Id;objectId:Id;periodId?:Id}):Promise<ConstructionDocumentControlReadModel>; }
export interface ProgressValuationReadPort { page(input:{projectId:Id;objectId:Id;periodId:Id;offset:number;limit:number;search?:string;sectionId?:Id}):Promise<ProgressValuationPage>; }
/** Command names and payloads only. Claude binds these to canonical commands; no invented endpoint is supplied. */
export interface ChangeControlCommandPort { create(input:{projectId:Id;objectId:Id;operationId:Id;expectedVersion:number;change:Omit<ApprovedChange,'changeId'|'status'>}):Promise<{changeId:Id;version:number}>; decide(input:{changeId:Id;operationId:Id;expectedVersion:number;decision:'approved'|'rejected';reason:string}):Promise<{version:number}>; }
export interface ProjectCloseoutPort { read(input:{projectId:Id;objectId:Id}):Promise<Pick<ConstructionDocumentControlReadModel,'requirements'|'documents'>>; }
