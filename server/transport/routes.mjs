import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {must,audit} from '../db.mjs';
import * as svc from '../service.mjs';
import {providerStatus,geocodeAddress,drivingRoute} from '../providers.mjs';
import {modelClient,coreConfig,coreReady} from '../ai-core/model.mjs';
import {DEFAULT_RATE_CARD,rateCardSchema,distanceBetween,coordinateSchema} from '../shipping.mjs';
import {estimatePacking} from '../truck-packing.mjs';
import {approximateRegion} from './regions.mjs';
import {dimensionsSchema,knownCargo,finishCargo,inferCargo} from './cargo.mjs';

export const transportPlanSchema=z.object({
 selections:z.array(z.object({lotId:z.string().uuid(),quantity:z.number().int().min(1).max(2000),version:z.number().int().positive().optional(),dimensions:dimensionsSchema.optional(),originToken:z.string().uuid().optional()}).strict()).min(1).max(12),
 destinationToken:z.string().uuid(),aiConsent:z.boolean().default(false),routeConsent:z.boolean().default(false),
 handling:z.boolean().default(false),helperHours:z.number().finite().min(0).max(48).default(0),stairsFloors:z.number().int().min(0).max(50).default(0)
}).strict().superRefine((d,c)=>{if(new Set(d.selections.map(x=>x.lotId)).size!==d.selections.length)c.addIssue({code:'custom',message:'같은 물품은 수량을 합쳐 선택하세요.'});if(d.selections.reduce((n,x)=>n+x.quantity,0)>2000)c.addIssue({code:'custom',message:'운송 계산은 합계 2,000개까지 가능합니다.'});});
export function readTransportLot(db,user,selection){
 svc.business(user);const lot=svc.getLot(db,user,selection.lotId);
 const org=db.prepare('SELECT active FROM organizations WHERE id=?').get(lot.orgId);
 must(!lot.own&&lot.state==='PUBLISHED'&&lot.decisionStatus==='VERIFIED'&&org?.active,'현재 받을 수 있는 타 기관의 공개 물품을 선택하세요.',409,'LOT_UNAVAILABLE');
 must(selection.version===undefined||selection.version===lot.version,'물품 정보가 변경됐습니다. 목록을 새로고침하세요.',409,'STALE_LOT');
 must(selection.quantity<=lot.available,'신청 가능 수량이 변경됐거나 부족합니다. 수량을 다시 선택하세요.',409,'INSUFFICIENT_QUANTITY');
 return lot;
}
const exact=p=>p&&['KAKAO_ADDRESS','REGISTERED_CONFIRMED'].includes(p.precision);
export function mountTransport(app,db,{env=process.env,fetcher=fetch}={}){
 const locations=new Map(),active=new Set(),addressActive=new Set();
 const rate=env.SHIPPING_RATE_CARD_JSON?rateCardSchema.parse(JSON.parse(env.SHIPPING_RATE_CARD_JSON)):DEFAULT_RATE_CARD;
 const safeFetch=(url,opts)=>fetcher(url,{...opts,signal:AbortSignal.any([opts.signal,AbortSignal.timeout(8000)].filter(Boolean))});
 function guard(user,action,limit){svc.business(user);const since=new Date(Date.now()-3600000).toISOString();const n=db.prepare('SELECT COUNT(*) n FROM audit_events WHERE actor_id=? AND action=? AND created_at>?').get(user.id,action,since).n;must(n<limit,'잠시 후 다시 계산하세요. 시간당 요청 한도입니다.',429);audit(db,user,action,user.id);}
 function issue(user,p){const token=randomUUID(),expiresAt=Date.now()+30*60000;locations.set(token,{...p,userId:user.id,orgId:user.org_id,expiresAt});for(const [k,v]of locations)if(v.expiresAt<Date.now())locations.delete(k);while(locations.size>1000)locations.delete(locations.keys().next().value);return {token,label:p.label,precision:p.precision,reference:p.reference,expiresAt};}
 function readLocation(user,token){const p=locations.get(token);must(p&&p.userId===user.id&&p.orgId===user.org_id&&p.expiresAt>Date.now(),'주소 선택이 만료됐습니다. 다시 확인하세요.',409,'ADDRESS_EXPIRED');return p;}
 app.get('/api/transport/status',(req,res)=>{svc.business(req.user);res.json({postcode:true,location:providerStatus(env).location.configured,route:providerStatus(env).route.configured,ai:coreReady(coreConfig(env)),model:coreConfig(env).model,sample:rate.sample,rateLabel:rate.label,rateVersion:rate.version,maxItems:12,maxQuantity:2000});});
 app.post('/api/transport/address',async(req,res)=>{
  guard(req.user,'TRANSPORT_ADDRESS',90);
  const d=z.object({query:z.string().trim().min(3).max(200),consent:z.boolean().default(false)}).strict().parse(req.body);
  must(!addressActive.has(req.user.id)&&addressActive.size<3,'주소 확인 중입니다. 잠시 후 다시 선택하세요.',429);
  addressActive.add(req.user.id);
  try{
   const notes=[];let candidates=[];
   if(d.consent&&providerStatus(env).location.configured){
    try{const found=await geocodeAddress(d.query,{env,fetcher:safeFetch});candidates=found.filter(p=>coordinateSchema.safeParse(p).success).slice(0,5).map(p=>issue(req.user,{...p,precision:'KAKAO_ADDRESS',reference:'카카오 주소 좌표'}));if(!candidates.length)notes.push('카카오 주소 조회 결과가 없어 지역 대표점으로 확인합니다.');}
    catch{notes.push('주소 좌표 API를 확인하지 못해 지역 대표점을 사용합니다.');}
   }
   if(!candidates.length){const approx=approximateRegion(d.query);if(approx)candidates=[issue(req.user,approx)];}
   res.json({candidates,notes:candidates.length?notes:[...notes,'지원 지역 대표점을 찾지 못했습니다. 정확한 도로명주소와 카카오 좌표 연결을 확인하세요.'],exact:candidates.some(c=>c.precision==='KAKAO_ADDRESS')});
  }finally{addressActive.delete(req.user.id);}
 });
 app.post('/api/transport/plan',async(req,res)=>{
  const d=transportPlanSchema.parse(req.body);guard(req.user,'TRANSPORT_PLAN',60);
  must(!active.has(req.user.id)&&active.size<2,'다른 운송 계산이 진행 중입니다. 잠시 후 다시 시도하세요.',429);
  // Resolve all authorization and address scope before any outbound operation.
  const destination=readLocation(req.user,d.destinationToken);
  const entries=d.selections.map(s=>{const lot=readTransportLot(db,req.user,s);let origin=null;
   if(s.originToken)origin=readLocation(req.user,s.originToken);
   else if(lot.pickupLocation?.confirmed&&coordinateSchema.safeParse(lot.pickupLocation).success)origin={...lot.pickupLocation,precision:'REGISTERED_CONFIRMED',reference:'게시기관이 확인한 상차 위치'};
   else origin=approximateRegion(lot.district,{seoulDistrict:true});
   return {lot,selection:s,origin,known:knownCargo(lot,s.dimensions)};
  });
  active.add(req.user.id);
  try{
   const notes=[];let ai=new Map(),aiMode='NOT_USED';
   if(d.aiConsent&&coreReady(coreConfig(env))){try{ai=await inferCargo(modelClient(db,req.user,{env,fetcher,consent:true}),entries);aiMode=[...ai.values()].some(Boolean)?'AI_ESTIMATE':'NOT_NEEDED';}catch{aiMode='FALLBACK';notes.push('AI 크기 추정이 실패해 등록 규격·유형별 가정만 사용했습니다.');}}
   const groups=new Map();
   for(const e of entries){e.cargo=finishCargo(e.lot,e.known,ai.get(e.lot.id));const p=e.origin;
    // Different institutions / pickup addresses are separate trips. Never imply shared multi-stop savings.
    const key=[e.lot.orgId,p?.precision,p?.lat,p?.lng,p?.label].join('|');
    if(!groups.has(key))groups.set(key,{key:randomUUID(),orgName:e.lot.orgName,origin:p,entries:[]});groups.get(key).entries.push(e);
   }
   const results=[];
   for(const g of groups.values()){
    const items=g.entries.map(e=>({id:e.lot.id,title:e.lot.title,orgName:e.lot.orgName,version:e.lot.version,quantity:e.selection.quantity,available:e.lot.available,...e.cargo}));
    const missing=[...(!g.origin?['출발기관 주소']:[]),...items.filter(i=>!i.dimensions).map(i=>i.title+' 크기·무게')];
    const base={key:g.key,orgName:g.orgName,origin:g.origin?{label:g.origin.label,precision:g.origin.precision,reference:g.origin.reference}:null,items};
    if(missing.length){results.push({...base,status:'NEEDS_INFO',missing,packing:null});continue;}
    let route=null,routeNote='';
    if(d.routeConsent&&exact(g.origin)&&exact(destination)&&providerStatus(env).route.configured){try{route=await drivingRoute(g.origin,destination,{env,fetcher:safeFetch});}catch{routeNote='도로 API 응답 실패 · 직선거리 보정 가정';}}
    const approx=!exact(g.origin)||!exact(destination);
    const straight=distanceBetween(g.origin,destination),km=route?.km??Math.max(8,Math.round(straight*1.3*10)/10);
    const distanceSource=route?'KAKAO_ROAD':approx?'REGION_APPROX':'COORDINATE_APPROX';
    const label=route?'카카오 도로거리 · 승용차 경로':approx?'지역 대표점 간 거리 ×1.3 (최소 8km 가정)':'등록 좌표 간 직선거리 ×1.3 (최소 8km 가정)';
    const packed=estimatePacking({items:items.map(i=>({id:i.id,name:i.title,...i.dimensions,quantity:i.quantity,rotate:true,stackCount:1,stackIncrementCm:0,stackingConfirmed:false})),distanceKm:km,clearanceCm:2,handling:d.handling,helperHours:d.helperHours,stairsFloors:d.stairsFloors,includeVat:true},rate);
    results.push({...base,status:packed.status,missing:[],distance:{km,source:distanceSource,label,seconds:route?.seconds||null},notes:[routeNote,route?.warning,approx?'대표점은 실제 도착주소 좌표가 아닙니다.':'',...items.flatMap(i=>i.notes)].filter(Boolean),packing:packed});
   }
   // Check again after asynchronous model and route calls; never quote obsolete stock/publication.
   for(const e of entries)readTransportLot(db,req.user,{...e.selection,version:e.lot.version});
   const completed=results.every(g=>g.packing?.recommended),totals=completed?results.reduce((t,g)=>{for(const k of ['estimated','low','high','trips'])t[k]+=g.packing.recommended[k];return t;},{estimated:0,low:0,high:0,trips:0}):null;
   res.json({status:completed?'ESTIMATED':'NEEDS_INFO',binding:false,sample:rate.sample,rateVersion:rate.version,rateLabel:rate.label,destination:{label:destination.label,precision:destination.precision,reference:destination.reference},groups:results,totals,aiMode,notes:[...notes,'출발지별 별도 운송을 합산합니다. 합배송·다중경유 최적화가 아닙니다.','상하차·인력·계단 선택값은 각 출발지마다 적용됩니다.','선택은 예약이 아닙니다. 실제 배차·확정 견적·안전 적재는 운송업체와 확인하세요.'],checkedAt:new Date().toISOString()});
  }finally{active.delete(req.user.id);}
 });
}
