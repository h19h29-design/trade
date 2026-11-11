import {MAX_IMPORT_ROWS} from '../../shared/import-limits.mjs';
import {z} from 'zod';
import {audit,must} from '../db.mjs';
import * as svc from '../service.mjs';
import {coreConfig,coreReady,modelClient,expandIntent,explain,hash} from './model.mjs';
import {inferCriteria,retrieve,rankCandidate,WEIGHTS,SCORING_VERSION,DISTRICTS} from './ranking.mjs';
import {deliveryFor} from './delivery.mjs';
import {startRegistration,registrationLots,enrichRegisteredLot} from './registration.mjs';
import {providerStatus} from '../providers.mjs';
import {coordinateSchema} from '../shipping.mjs';
export const searchSchema=z.object({query:z.string().trim().min(2).max(800),quantity:z.number().int().min(1).max(100000).optional(),district:z.string().max(20).refine(s=>!s||DISTRICTS.includes(s)).optional(),allowPartial:z.boolean().default(true),budget:z.number().finite().positive().max(10000000).optional(),destination:coordinateSchema.extend({label:z.string().trim().min(2).max(200)}).optional(),routeConsent:z.boolean().default(false),useAi:z.boolean().default(true),consent:z.boolean().default(false),handling:z.boolean().default(false),helperHours:z.number().finite().min(0).max(48).default(0),stairsFloors:z.number().int().min(0).max(50).default(0)}).strict();
const visible=db=>user=>svc.listLots(db,user,{min:1}).filter(l=>!l.own&&l.state==='PUBLISHED'&&l.decisionStatus==='VERIFIED').slice(0,5000);
export function mountAiCore(app,db,options={}){
 const {env=process.env,fetcher=fetch}=options,active=new Set();
 const guard=(user,action,limit=30)=>{svc.business(user);const n=db.prepare('SELECT COUNT(*) n FROM audit_events WHERE actor_id=? AND action=? AND created_at>?').get(user.id,action,new Date(Date.now()-3600000).toISOString()).n;must(n<limit,'시간당 처리 한도를 넘었습니다. 잠시 후 다시 시도하세요.',429);audit(db,user,action,user.id);};
 app.get('/api/ai-core/status',(req,res)=>{svc.business(req.user);const c=coreConfig(env);res.json({aiConfigured:coreReady(c),provider:c.provider,model:c.model,providers:providerStatus(env),scoreVersion:SCORING_VERSION,weights:WEIGHTS,corpus:'LIVE_PUBLISHED_LOTS',registration:'PRIVATE_DRAFT_ONLY',dailyLimit:c.dailyLimit});});
 app.post('/api/ai-core/search',async(req,res)=>{
  guard(req.user,'AI_CORE_SEARCH',60);const d=searchSchema.parse(req.body),key='search:'+req.user.id;must(!active.has(key),'이전 물품검색이 진행 중입니다.',429);active.add(key);
  try{
   const criteria=inferCriteria(d.query,d);must(criteria.quantity>=1&&criteria.quantity<=100000,'요청 수량을 확인하세요.');
   const notes=['추천은 명시한 수량·지역과 등록정보 기준입니다. 세부 규격·호환성·설치 가능 여부는 현물과 대조하세요.'],client=modelClient(db,req.user,{env,fetcher,consent:d.consent});let expanded=[],usedAi=false;
   if(d.useAi&&d.consent&&coreReady(client.config)){try{expanded=(await expandIntent(client,d.query)).terms;usedAi=true;}catch{notes.push('AI 의도 분석 실패: 원문 검색어와 내부 동의어로 찾았습니다.');}}
   else notes.push('AI 외부 전송을 실행하지 않고 등록정보 기반 검색·점수 계산을 했습니다.');
   const before=visible(db)(req.user);let hits=retrieve(before,criteria,expanded).filter(h=>criteria.allowPartial||h.lot.available>=criteria.quantity);
   // First-stage retrieval is local. Shipment API traffic is capped at five candidates per request.
   hits=hits.map(h=>({hit:h,rank:rankCandidate(h,criteria)})).sort((a,b)=>b.rank.score-a.rank.score||a.hit.lot.id.localeCompare(b.hit.lot.id)).slice(0,5);
   let results=[];
   for(const h of hits){let delivery;try{delivery=await deliveryFor(h.hit.lot,criteria,{env,fetcher,...d});}catch{delivery={status:'NEEDS_INFO',missing:['배송 입력치·단가 확인'],binding:false};}results.push(rankCandidate(h.hit,criteria,delivery));}
   results.sort((a,b)=>b.score-a.score||a.lot.id.localeCompare(b.lot.id));
   if(results.length&&d.useAi&&d.consent&&coreReady(client.config)){
    try{const explanations=await explain(client,d.query,results);usedAi=true;for(const e of explanations){const r=results.find(r=>r.lot.id===e.id);if(r)r.aiExplanation=e;}}catch{notes.push('AI 비교 설명 검증 실패: 등록정보에서 계산한 장단점은 유지합니다.');}
   }
   const beforeWeak=results.length;
   results=results.filter(r=>!r.expandedOnly||r.score>=50);
   if(results.length!==beforeWeak)notes.push('AI 동의어만 약하게 일치한 낮은 관련 후보는 제외했습니다.');
   // No private/deactivated/reserved stock may escape an async generation window.
   const fresh=new Map(visible(db)(req.user).map(l=>[l.id,l]));const count=results.length;
   results=results.filter(r=>{const latest=fresh.get(r.lot.id);return latest&&latest.version===r.lot.version&&latest.available===r.lot.available;});
   if(count!==results.length)notes.push('검색 중 변경되거나 예약된 물품은 제외했습니다. 다시 검색하면 최신 순위를 볼 수 있습니다.');
   res.json({mode:usedAi?'AI_ASSISTED_RAG':'LOCAL_RANKING',criteria,results,notes,checkedAt:new Date().toISOString(),retrieval:{scope:'게시 승인된 타 기관 물품',strategy:'한글 단어·동의어·부분일치 검색 + 구조화 점수',documents:before.length,limit:5000,source:'LIVE_DATABASE'},scoreVersion:SCORING_VERSION,disclaimer:'추천 점수는 현재 조건과 입력정보에 따른 참고지수입니다. 확률·품질보증·공식 등급이 아니며 인수 전 재확인이 필요합니다.'});
  }finally{active.delete(key);}
 });
 app.get('/api/ai-core/register/:id/status',(req,res)=>{
  svc.business(req.user);const batch=db.prepare('SELECT id,name,workbook FROM import_batches WHERE id=? AND org_id=?').get(req.params.id,req.user.org_id);must(batch,'본 기관의 원본을 찾을 수 없습니다.',404);
  const w=JSON.parse(batch.workbook),ids=registrationLots(db,req.user,batch.id);
  res.json({id:batch.id,name:batch.name,inputFormat:w.inputFormat,conversion:w.conversion,registeredCount:ids.length});
 });
 app.post('/api/ai-core/register/:id/start',(req,res)=>{guard(req.user,'AI_CORE_REGISTER',30);res.json(startRegistration(db,req.user,req.params.id,req.body));});
 app.post('/api/ai-core/register/:id/enrich',async(req,res)=>{
  guard(req.user,'AI_CORE_ENRICH_BATCH',4000);const d=z.object({cursor:z.number().int().min(0).max(MAX_IMPORT_ROWS).default(0),consent:z.boolean().default(false),useAi:z.boolean().default(true)}).strict().parse(req.body);
  const ids=registrationLots(db,req.user,req.params.id);must(ids.length,'등록된 초안이 없습니다. 먼저 파일 검증·등록을 완료하세요.',409);
  const key='register:'+req.user.org_id+':'+req.params.id;must(!active.has(key),'이 파일은 보완 중입니다. 완료 후 다시 시도하세요.',429);active.add(key);
  try{
   const items=[];for(const id of ids.slice(d.cursor,d.cursor+1)){try{items.push(await enrichRegisteredLot(db,req.user,id,{...options,...d}));}catch{items.push({id,state:'RETRY',notes:['현재 초안을 보존했습니다. 변경사항 또는 연결 상태를 확인한 후 재시도하세요.'],appliedFields:[]});}}
   res.json({items,cursor:d.cursor,nextCursor:Math.min(ids.length,d.cursor+1),total:ids.length,done:d.cursor+1>=ids.length});
  }finally{active.delete(key);}
 });
}
