import { describe, expect, it } from 'vitest';
import { applyChange, approveF2, autoLink, controlTotals, materializeRecipe, receiveSync, type CanonicalLine, type SourceLine } from './lrv-canonical-core';
const base: CanonicalLine = { id:'bl-1',parentId:null,kind:'base',orderingKey:'0001',version:1,code:'E1',name:'Beton',unit:'m3',baselineQuantity:10,status:'active' };
const src: SourceLine = { id:'f2src',documentRevisionId:'rev1',externalRowKey:'stable-row',kind:'f2',code:'E1',name:'Beton',unit:'m3',quantity:2,unitPrice:100,amount:333,raw:{} };
describe('LRV canonical core', () => {
 it('faqat deterministic exact identity auto-link qiladi',()=>expect(autoLink(src,[base])).toBe('bl-1'));
 it('bir xil nom/birlikdagi ikki kandidat ambiguous va auto-link emas',()=>expect(autoLink(src,[base,{...base,id:'x'}])).toBeNull());
 it('approved F2 source amountni formula o‘rniga freeze qiladi',()=>expect(approveF2({id:'a',sourceF2LineId:'f2src',targetLrvEntityId:'bl-1',certifiedQuantity:2,certifiedUnitPrice:100,certifiedAmount:333,approvedAt:'2026',approvedRevision:1}).certifiedAmount).toBe(333));
 it('historical F2 catalog pricega qaramaydi',()=>expect(controlTotals({baselineQty:10,faktQuantities:[5],approved:[approveF2({id:'a',sourceF2LineId:'s',targetLrvEntityId:'bl-1',certifiedQuantity:2,certifiedUnitPrice:100,certifiedAmount:333,approvedAt:'x',approvedRevision:1})]}).approvedF2Amount).toBe(333));
 it('replacement old linega tegmaydi, relation explicit',()=>{const r=applyChange([base],{operationId:'rep',expectedVersion:1,entityId:'bl-1',orderingKey:'0002',kind:'replacement',name:'Yangi',unit:'m3',code:'E2'});expect(r.lines.find(x=>x.id==='bl-1')?.status).toBe('replaced');expect(r.lines.find(x=>x.id==='rep')?.parentId).toBeNull();});
 it('recipe preflight yarim tree qoldirmaydi',()=>expect(()=>materializeRecipe(base,[{resourceType:'material',code:null,name:'',unit:'kg',norm:1}],'op')).toThrow('RECIPE_PREFLIGHT_FAILED'));
 it('sync duplicate, stale va frozen F2ni rad etadi',()=>{const rec={entityId:'bl-1',entityVersion:2,projectionHash:'a',hiddenMetadata:{}};expect(receiveSync({eventId:'e',operationId:'o',origin:'sheets',entityId:'bl-1',entityVersion:3,baseVersion:1,projectionHash:'b',occurredAt:'x'},rec,new Set(),new Set()).conflict?.reason).toBe('STALE_VERSION');expect(receiveSync({eventId:'e2',operationId:'o',origin:'sheets',entityId:'bl-1',entityVersion:3,baseVersion:2,projectionHash:'b',occurredAt:'x'},rec,new Set(['bl-1']),new Set()).conflict?.reason).toBe('FROZEN_F2');});
});
