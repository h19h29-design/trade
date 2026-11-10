import {z} from 'zod';
import {DEFAULT_RATE_CARD,rateCardSchema} from './shipping.mjs';

const size=z.number().finite().min(1).max(2000);
export const packingItemSchema=z.object({id:z.string().min(1).max(80),name:z.string().trim().min(1).max(100),
 lengthCm:size,widthCm:size,heightCm:size,unitWeightKg:z.number().finite().min(.1).max(10000),
 quantity:z.number().int().min(1).max(2000),rotate:z.boolean().default(true),stackCount:z.number().int().min(1).max(30).default(1),
 stackIncrementCm:z.number().finite().min(0).max(2000).default(0),stackingConfirmed:z.boolean().default(false)
}).strict().superRefine((v,c)=>{if(v.stackCount>1&&(!v.stackingConfirmed||v.stackIncrementCm<=0||v.stackIncrementCm>v.heightCm))c.addIssue({code:'custom',message:'쌓을 수 있는 개수와 추가 높이를 확인하세요.'});});
export const packingInputSchema=z.object({items:z.array(packingItemSchema).min(1).max(12),distanceKm:z.number().finite().positive().max(2000),
 clearanceCm:z.number().finite().min(0).max(20).default(2),handling:z.boolean().default(false),helperHours:z.number().finite().min(0).max(48).default(0),
 stairsFloors:z.number().int().min(0).max(50).default(0),includeVat:z.boolean().default(true)
}).strict().superRefine((v,c)=>{if(v.items.reduce((n,i)=>n+i.quantity,0)>2000)c.addIssue({code:'custom',message:'한 번에 합계 2,000개까지 계산합니다.'});if(new Set(v.items.map(i=>i.id)).size!==v.items.length)c.addIssue({code:'custom',message:'물품 식별자가 중복되었습니다.'});});
const ceil=x=>Math.ceil(x*10-1e-8); // 0.1cm grid, round cargo up, vehicle down
const kg=x=>Math.ceil(x*1000-1e-8);
const clamp=n=>Math.round(n*100)/100;
function splitFree(f,w,h){
 // Guillotine partitions are disjoint. No overlapping free rectangles or floating cargo.
 const a=f.w-w,b=f.h-h;
 return (a>b?[{x:f.x+w,y:f.y,w:a,h:f.h},{x:f.x,y:f.y+h,w,h:b}]:[{x:f.x+w,y:f.y,w:a,h},{x:f.x,y:f.y+h,w:f.w,h:b}]).filter(r=>r.w>0&&r.h>0);
}
function packWithOrder(stacks,vehicle,clearance,sort){
 const L=Math.floor(vehicle.lengthCm*10+1e-8),W=Math.floor(vehicle.widthCm*10+1e-8),weightLimit=Math.floor(vehicle.payloadKg*1000),gap=ceil(clearance);
 const loads=[];let operations=0;
 for(const box of [...stacks].sort(sort)){
  let best=null;
  for(let li=0;li<loads.length;li++){
   const load=loads[li];if(load.weight+box.weight>weightLimit)continue;
   for(let fi=0;fi<load.free.length;fi++)for(const rotated of box.rotate&&box.l!==box.w?[false,true]:[false]){
    if(++operations>2000000)throw Error('PACKING_COMPLEXITY_LIMIT');
    const l=rotated?box.w:box.l,w=rotated?box.l:box.w,rect=load.free[fi];
    if(l+gap>rect.w||w+gap>rect.h)continue;
    const score=Math.min(rect.w-l-gap,rect.h-w-gap);
    if(!best||li<best.li||li===best.li&&score<best.score)best={li,fi,rotated,l,w,score};
   }
   if(best)break;
  }
  if(!best){
   const rotated=!(box.l<=L&&box.w<=W);
   if(rotated&&(!box.rotate||box.w>L||box.l>W))return null;
   const li=loads.length;loads.push({free:[{x:0,y:0,w:L+gap,h:W+gap}],placements:[],weight:0,count:0});
   best={li,fi:0,rotated,l:rotated?box.w:box.l,w:rotated?box.l:box.w,score:0};
  }
  const load=loads[best.li],rect=load.free.splice(best.fi,1)[0];
  load.free.push(...splitFree(rect,best.l+gap,best.w+gap));
  load.placements.push({itemId:box.id,name:box.name,x:rect.x/10,y:rect.y/10,z:0,lengthCm:best.l/10,widthCm:best.w/10,heightCm:box.h/10,quantity:box.count,weightKg:box.weight/1000,rotated:best.rotated});
  load.weight+=box.weight;load.count+=box.count;
 }
 return loads.map((l,i)=>({trip:i+1,count:l.count,weightKg:l.weight/1000,floorUsePct:clamp(100*l.placements.reduce((a,p)=>a+p.lengthCm*p.widthCm,0)/(vehicle.lengthCm*vehicle.widthCm)),placements:l.placements}));
}
/** Upright rectangular packages. Only identical, explicitly confirmed stacks; no arbitrary stacking/tilting.
 * Three constructive heuristics; feasible placement, NOT a proven global minimum or load-safety certification.
 */
export function packVehicle(items,vehicle,{clearanceCm=2}={}){
 const stacks=[],unfit=[];
 for(const item of items){
  const L=ceil(item.lengthCm),W=ceil(item.widthCm),H=ceil(item.heightCm),vh=Math.floor(vehicle.heightCm*10+1e-8);
  const fits=(L<=Math.floor(vehicle.lengthCm*10)&&W<=Math.floor(vehicle.widthCm*10))||(item.rotate&&W<=Math.floor(vehicle.lengthCm*10)&&L<=Math.floor(vehicle.widthCm*10));
  if(!fits||H>vh||kg(item.unitWeightKg)>Math.floor(vehicle.payloadKg*1000)){unfit.push({id:item.id,name:item.name,reason:'가로·세로·높이 또는 개당 무게가 차량 한도를 초과합니다.'});continue;}
  const inc=ceil(item.stackIncrementCm||item.heightCm);
  const maxHeight=item.stackCount>1?1+Math.floor((vh-H)/inc):1;
  const stack=Math.max(1,Math.min(item.stackingConfirmed?item.stackCount:1,maxHeight,Math.floor(Math.floor(vehicle.payloadKg*1000)/kg(item.unitWeightKg))));
  for(let remain=item.quantity;remain>0;){const count=Math.min(stack,remain);remain-=count;stacks.push({id:item.id,name:item.name,l:L,w:W,h:H+(count-1)*inc,weight:kg(item.unitWeightKg)*count,count,rotate:item.rotate});}
 }
 if(unfit.length)return {feasible:false,unfit,loads:[]};
 const ties=(a,b)=>a.id.localeCompare(b.id)||b.count-a.count;
 const orders=[(a,b)=>b.l*b.w-a.l*a.w||ties(a,b),(a,b)=>Math.max(b.l,b.w)-Math.max(a.l,a.w)||ties(a,b),(a,b)=>b.weight-a.weight||b.l*b.w-a.l*a.w||ties(a,b)];
 let best=null;
 for(const sort of orders){const packed=packWithOrder(stacks,vehicle,clearanceCm,sort);if(packed&&(!best||packed.length<best.length))best=packed;}
 return {feasible:!!best,unfit:[],loads:best||[],method:'UPRIGHT_GUILLOTINE_CONFIRMED_STACKS_V1'};
}
export function estimatePacking(input,rateCard=DEFAULT_RATE_CARD){
 const d=packingInputSchema.parse(input),rate=rateCardSchema.parse(rateCard),round=n=>Math.ceil(n/1000)*1000;
 const options=[],rejected=[];
 for(const vehicle of rate.vehicles){
  let packed;try{packed=packVehicle(d.items,vehicle,d);}catch(e){if(e.message!=='PACKING_COMPLEXITY_LIMIT')throw e;rejected.push({vehicleId:vehicle.id,vehicle:vehicle.name,reasons:['복잡도 한도: 더 작은 묶음으로 나눠 계산하세요.']});continue;}
  if(!packed.feasible){rejected.push({vehicleId:vehicle.id,vehicle:vehicle.name,reasons:packed.unfit.map(i=>i.name+': '+i.reason)});continue;}
  const trips=packed.loads.length,qty=d.items.reduce((n,i)=>n+i.quantity,0);
  const transport=trips*(vehicle.base+Math.max(0,d.distanceKm-rate.includedKm)*vehicle.perKm),handling=d.handling?qty*rate.handlingPerItem:0,helpers=d.helperHours*rate.helperHour,stairs=d.stairsFloors*qty*rate.stairsPerFloorItem;
  const subtotal=transport+handling+helpers+stairs,vat=d.includeVat?subtotal*rate.vatRate:0,estimated=round(subtotal+vat);
  const preview=packed.loads.slice(0,8).map(l=>({...l,placements:l.placements.slice(0,200),positionsTruncated:l.placements.length>200}));
  options.push({vehicleId:vehicle.id,vehicle:vehicle.name,vehicleSize:vehicle,trips,estimated,low:round(estimated*.8),high:round(estimated*1.3),
   breakdown:{transport,handling,helpers,stairs,vat},totalQuantity:qty,totalWeightKg:clamp(d.items.reduce((s,i)=>s+i.unitWeightKg*i.quantity,0)),loads:preview,previewTruncated:trips>8,method:packed.method});
 }
 options.sort((a,b)=>a.estimated-b.estimated||a.trips-b.trips||a.vehicleId.localeCompare(b.vehicleId));
 return {status:options.length?'ESTIMATED':'MANUAL_QUOTE_REQUIRED',sample:rate.sample,binding:false,rateVersion:rate.version,rateLabel:rate.label,distanceKm:d.distanceKm,options,recommended:options[0]||null,rejected,
  assumptions:['입력한 포장 외곽 치수·수량·무게를 사용합니다. 숨은 공간이나 기울여 싣기는 계산하지 않습니다.','쌓기는 확인한 동일 물품에만 적용합니다. 고정·무게중심·축하중·문폭·상하차 안전은 운송업체 확인이 필요합니다.','예시 운임의 편도 운송횟수 기준이며 확정 견적·실제 배차·최적 배치 보장이 아닙니다.'],checkedAt:new Date().toISOString()};
}
