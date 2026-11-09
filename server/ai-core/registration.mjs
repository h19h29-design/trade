import {z} from 'zod';
import {loadImport,previewImport,confirmImport} from '../excel-import.mjs';
import * as svc from '../service.mjs';
import {uid,now,must,audit,transaction} from '../db.mjs';
import {providerStatus} from '../providers.mjs';
import {coreReady,modelClient,extractMetadata} from './model.mjs';
import {categoryFor} from './ranking.mjs';

export function startRegistration(db,user,batchId,input={}){
 svc.business(user);
 const batch=loadImport(db,user,batchId);
 must(batch.workbook.conversion?.state!=='WAITING','원본을 읽지 못해 물품을 등록하지 않았습니다. 형식·비밀번호를 확인하세요.',409,'IMPORT_WAITING');
 const d=z.object({department:z.string().trim().max(100).default(''),groupIdentical:z.boolean().default(true),config:z.object({sheet:z.string(),headerRow:z.number().int().min(1).max(30),mapping:z.record(z.string(),z.number().int().min(0).max(63))}).optional()}).strict().parse(input);
 const candidates=batch.workbook.sheets.filter(s=>s.mapping?.originalName!==undefined&&s.mapping?.quantity!==undefined);
 must(d.config||candidates.length===1,'품명·수량 열을 확정할 수 없거나 여러 표가 있습니다. 원본 확인 화면에서 시트·열을 선택하세요.',422,'IMPORT_NEEDS_MAPPING');
 const sheet=candidates[0];const config={...(d.config||{sheet:sheet.name,headerRow:sheet.suggestedHeader,mapping:sheet.mapping}),department:d.department,groupIdentical:d.groupIdentical};
 const plan=previewImport(batch,config);
 if(plan.errors.length){const e=Object.assign(new Error('원본 자료에 오류가 있어 물품을 만들지 않았습니다. '+plan.errors.slice(0,3).map(e=>e.row+'행: '+e.messages.join(' ')).join(' / ')),{status:422,code:'IMPORT_VALIDATION'});throw e;}
 const receipt=confirmImport(db,user,batchId,config);
 audit(db,user,'AI_REGISTRATION_CREATED',batchId,{lotCount:receipt.lotCount,reused:receipt.reused,privateDraft:true});
 return {...receipt,batchId,warnings:plan.warnings,config,automatic:true,state:'DRAFTS_CREATED'};
}
export function registrationLots(db,user,batchId){
 svc.business(user);
 const batch=db.prepare('SELECT * FROM import_batches WHERE id=? AND org_id=?').get(batchId,user.org_id);must(batch,'본 기관의 등록 원본을 찾을 수 없습니다.',404);
 return db.prepare('SELECT DISTINCT r.lot_id FROM imported_rows r JOIN lots l ON l.id=r.lot_id WHERE r.org_id=? AND r.file_hash=? AND l.org_id=? ORDER BY r.row_number').all(user.org_id,batch.file_hash,user.org_id).map(r=>r.lot_id);
}
export async function enrichRegisteredLot(db,user,id,options){
 const {env=process.env,fetcher=fetch,catalog,applySuggestion,productFingerprint,consent=false,useAi=true}=options;
 let row=svc.ownLot(db,user,id);if(row.state!=='DRAFT')return {id,state:'SKIPPED',notes:['수정·검토가 시작된 물품은 자동 변경하지 않았습니다.']};
 const prior=db.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='AI_REGISTRATION_DONE' AND entity_id=? ORDER BY created_at DESC LIMIT 1").get(user.org_id,id);
 if(prior){const p=JSON.parse(prior.detail);if(p.version===row.version&&p.aiRequested===Boolean(consent&&useAi)&&p.catalogConfigured===providerStatus(env).procurement.configured&&!p.transientFailure)return {...p.result,reused:true};}
 let draft=JSON.parse(row.data),fingerprint=productFingerprint(db,id),transientFailure=false,concurrentChange=false;const notes=[],appliedFields=[];let candidates=[],exact=false,aiExtracted=false;
 const saveProposal=(proposal,source,model='')=>{
  const current=svc.ownLot(db,user,id);must(current.state==='DRAFT'&&productFingerprint(db,id)===fingerprint,'등록 중 물품이 바뀌었습니다. 자동 보완을 중단했습니다.',409,'STALE_SUGGESTION');
  const sid=uid();db.prepare('INSERT INTO product_suggestions VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)').run(sid,user.org_id,id,user.id,source,model,current.version,fingerprint,JSON.stringify(proposal),'PROPOSED',now());return {id:sid,version:current.version};
 };
 if(providerStatus(env).procurement.configured){
  try{
   const code=draft.identificationCode||draft.actualIdentificationCode||'';
   candidates=(await catalog.search(user,{...(code?{identificationCode:code}:{name:draft.title.slice(0,100)})})).candidates;
   if(!candidates.length&&code)candidates=(await catalog.search(user,{name:draft.title.slice(0,100)})).candidates;
   const matches=candidates.filter(c=>c.matchType==='EXACT_IDENTIFIER'&&c.actualIdentificationCode===code);
   if(matches.length===1){
    exact=true;const p=matches[0];const saved=saveProposal(p,'PROCUREMENT');const fields=['manufacturer','model','description','actualIdentificationCode','classificationName'].filter(k=>!draft[k]&&typeof p[k]==='string'&&p[k]);
    if(fields.length){applySuggestion(db,user,saved.id,{fields,version:saved.version,emptyOnly:true});appliedFields.push(...fields);}
    notes.push('번호 일치 조달정보로 빈 항목만 보완했습니다. 실제 명판 대조는 필요합니다.');
   }else{
    for(const p of candidates.slice(0,3))saveProposal(p,'PROCUREMENT');
    notes.push(candidates.length?'품명 후보를 저장했습니다. 담당자가 실제 제품과 비교해 선택하세요.':'조달청 일치 물품이 없어 원본 정보로 등록했습니다.');
   }
  }catch(e){transientFailure=true;concurrentChange=e.status===409;notes.push(e.status===409?'물품이 변경되어 조달정보를 자동 적용하지 않았습니다.':'조달청 조회 미완료: 초안은 보존했습니다. 키·이용승인·사용량을 확인하세요.');}
 }else notes.push('조달청 미연결: 파일의 원본 정보만 저장했습니다.');
 row=svc.ownLot(db,user,id);
 if(concurrentChange||row.state!=='DRAFT')return {id,state:'RETRY',notes:['분석 중 내용이 변경되어 추가 자동 보완을 중단했습니다.'],appliedFields};
 draft=JSON.parse(row.data);fingerprint=productFingerprint(db,id);
 const client=modelClient(db,user,{env,fetcher,consent});
 if(useAi&&consent&&coreReady(client.config)&&(!draft.manufacturer||!draft.model||!draft.description)){
  try{
   const source=[draft.originalName,draft.title,draft.specification,draft.manufacturer,draft.model,...candidates.filter(c=>c.matchType==='EXACT_IDENTIFIER').map(c=>c.description)].filter(Boolean).join('\n').slice(0,5000);
   const meta=await extractMetadata(client,source);const proposal={...meta,title:draft.title,category:draft.category,observedText:source.slice(0,2000),warning:'원문 발췌 기반 AI 보완입니다. 게시 전 실제 제품과 비교하세요.'};
   const s=saveProposal(proposal,'AI',client.config.model);const fields=['manufacturer','model','description'].filter(k=>!draft[k]&&meta[k]);
   if(fields.length){applySuggestion(db,user,s.id,{fields,version:s.version,emptyOnly:false});appliedFields.push(...fields);aiExtracted=true;}
   notes.push('AI가 원문에 존재하는 문자열만 추출했습니다. 원본 수량·코드·상태는 보존했습니다.');
  }catch{transientFailure=true;notes.push('AI 분석을 완료하지 못했거나 근거가 부족합니다. 원본 초안을 유지했습니다.');}
 }else if(useAi)notes.push('AI 연결·전송 동의가 없거나 보완할 빈 항목이 없어 추가 AI 호출을 하지 않았습니다.');
 // Basic category labels do not alter official classification codes.
 row=svc.ownLot(db,user,id);draft=JSON.parse(row.data);
 if(row.state==='DRAFT'&&draft.category==='OTHER'&&!transientFailure){
  const category=categoryFor(draft.title+' '+draft.classificationName);
  if(category!=='OTHER'){svc.saveLot(db,user,{...draft,category,version:row.version},id);appliedFields.push('category');}
 }
 const final=svc.ownLot(db,user,id);
 const result={id,title:JSON.parse(final.data).title,state:exact?'CATALOG_MATCHED':aiExtracted?'AI_EXTRACTED':candidates.length?'REVIEW_CANDIDATES':'SOURCE_ONLY',appliedFields:[...new Set(appliedFields)],notes,referenceCandidateCount:candidates.length,privateDraft:true};
 audit(db,user,'AI_REGISTRATION_DONE',id,{version:final.version,aiRequested:Boolean(consent&&useAi),catalogConfigured:providerStatus(env).procurement.configured,transientFailure,result});
 return result;
}
