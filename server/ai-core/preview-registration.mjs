import {z} from 'zod';
import {createHash} from 'node:crypto';
import {must,audit,now,transaction} from '../db.mjs';
import {loadImport,previewImport,confirmImport} from '../excel-import.mjs';
import * as svc from '../service.mjs';
import {providerStatus} from '../providers.mjs';
import {modelClient,coreReady,extractMetadata} from './model.mjs';
import {categoryFor} from './ranking.mjs';
import {referenceImage} from '../reference-image.mjs';
import {registrationLots} from './registration.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const stringify=x=>JSON.stringify(x);
const normalized=s=>String(s||'').normalize('NFKC').replace(/[^0-9a-z가-힣]/gi,'').toLowerCase();
const genericManufacturer=(value,item,exact)=>[item.fields.title,item.originalRows?.[0]?.name,exact?.classificationName].some(x=>normalized(x)&&normalized(x)===normalized(value));
const prepareSchema=z.object({department:z.string().trim().max(100).default('')}).strict();
const editableSchema=z.object({title:z.string().trim().min(2).max(100).optional(),manufacturer:z.string().trim().max(200).optional(),model:z.string().trim().max(200).optional(),
 specification:z.string().trim().max(500).optional(),description:z.string().trim().max(4000).optional(),department:z.string().trim().max(100).optional(),
 useReferencePhoto:z.boolean().optional()}).strict().refine(x=>Object.keys(x).length>0,'수정할 항목이 없습니다.');
function load(db,user,id){svc.business(user);const p=db.prepare('SELECT * FROM registration_previews WHERE batch_id=? AND org_id=?').get(id,user.org_id);must(p,'본 기관의 분석 결과를 찾을 수 없습니다.',404);return {...p,config:JSON.parse(p.config),items:JSON.parse(p.items),receipt:JSON.parse(p.receipt)};}
function original(db,user,id){const b=loadImport(db,user,id,{allowExpired:true});const source=db.prepare('SELECT bytes,sha256 FROM import_documents WHERE batch_id=?').get(id);if(source)must(hash(Buffer.from(source.bytes))===source.sha256&&source.sha256===b.file_hash,'원본 파일이 변경됐습니다.',409,'SOURCE_INTEGRITY_FAILED');return b;}
function planFingerprint(plan){return hash(stringify(plan.rows));}
export function previewStatus(db,user,id,offset=0){
 const p=load(db,user,id),batch=db.prepare('SELECT name FROM import_batches WHERE id=?').get(id);
 const safe=i=>{const {sourceText,...rest}=i;return rest;};
 return {id,name:batch.name,version:p.version,state:p.state,receipt:p.receipt,total:p.items.length,quantity:p.items.reduce((s,i)=>s+i.quantity,0),
  enriched:p.items.filter(i=>i.enriched).length,items:p.items.slice(offset,offset+40).map(safe),offset,nextOffset:offset+40<p.items.length?offset+40:null};
}
export function preparePreview(db,user,id,input={}){
 svc.business(user);const cfg=prepareSchema.parse(input),batch=original(db,user,id);
 const existing=db.prepare('SELECT batch_id FROM registration_previews WHERE batch_id=? AND org_id=?').get(id,user.org_id);
 if(existing)return previewStatus(db,user,id);
 const registered=registrationLots(db,user,id);
 must(!registered.length,'이미 등록한 원본입니다. 업로드 이력에서 기존 물품을 확인하세요.',409,'ALREADY_REGISTERED');
 must(batch.workbook.conversion?.state!=='WAITING','파일 해석을 먼저 완료하세요.',409);
 const sheets=batch.workbook.sheets.filter(s=>s.mapping?.originalName!==undefined&&s.mapping?.quantity!==undefined);
 must(sheets.length===1,'품명·수량 열이 모호하거나 여러 표가 있습니다. 직접 등록에서 원본 열을 확인하세요.',422,'IMPORT_NEEDS_MAPPING');
 const sheet=sheets[0],config={sheet:sheet.name,headerRow:sheet.suggestedHeader,mapping:sheet.mapping,department:cfg.department,groupIdentical:true};
 const plan=previewImport(batch,config);must(!plan.errors.length,'원본 오류: '+plan.errors.slice(0,3).map(e=>e.row+'행 '+e.messages.join(' ')).join(' / '),422);
 const items=plan.groups.map((group,index)=>{const f=group[0];return {key:String(index),quantity:group.reduce((n,r)=>n+r.quantity,0),listingNo:f.listingNo,identificationCode:f.identificationCode,
  originalRows:group.map(r=>({row:r.rowNumber,name:r.sourceName,quantity:r.quantity,condition:r.condition,acquiredUnitPrice:r.acquiredUnitPrice})),
  sourceText:[f.sourceName,f.specification,f.manufacturer,f.model].filter(Boolean).join('\n').slice(0,5000),
  fields:{title:f.originalName.slice(0,100),manufacturer:f.manufacturer||'',model:f.model||'',specification:f.specification||'',description:f.specification?'엑셀 기재 규격: '+f.specification:'',department:f.department||''},
  provenance:{},enriched:false,edited:[],notes:[],referencePhoto:null,useReferencePhoto:false};});
 transaction(db,()=>{db.prepare('INSERT INTO registration_previews(batch_id,org_id,file_hash,config,plan_hash,items,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
 .run(id,user.org_id,batch.file_hash,stringify(config),planFingerprint(plan),stringify(items),now(),now());audit(db,user,'AI_PREVIEW_PREPARED',id,{count:items.length,registered:false});});
 return previewStatus(db,user,id);
}
export function editPreview(db,user,id,key,input){
 const d=z.object({version:z.number().int().positive(),fields:editableSchema}).strict().parse(input);
 return transaction(db,()=>{const p=load(db,user,id);must(p.state==='PREVIEW','이미 등록 완료한 결과입니다.',409);must(p.version===d.version,'분석 결과가 변경됐습니다. 새로고침하세요.',409,'VERSION_CONFLICT');
  const item=p.items.find(i=>i.key===key);must(item,'물품행을 찾지 못했습니다.',404);
  const {useReferencePhoto,...fields}=d.fields;
  if(useReferencePhoto!==undefined){must(!useReferencePhoto||item.referencePhoto,'선택할 참고사진이 없습니다.');item.useReferencePhoto=useReferencePhoto;item.edited=[...new Set([...item.edited,'useReferencePhoto'])];}
  Object.assign(item.fields,fields);item.edited=[...new Set([...item.edited,...Object.keys(fields)])];for(const name of Object.keys(fields))item.provenance[name]='담당자 수정';
  db.prepare('UPDATE registration_previews SET items=?,version=version+1,updated_at=? WHERE batch_id=?').run(stringify(p.items),now(),id);
  audit(db,user,'AI_PREVIEW_EDIT',id,{key,fields:Object.keys(d.fields)});return previewStatus(db,user,id,Math.floor(Number(key)/40)*40);
 });
}
export async function enrichPreview(db,user,id,{cursor=0,consent=false,useAi=true,force=false,...options}={}){
 const {env=process.env,fetcher=fetch,catalog,imageLoader=referenceImage}=options;
 const p=load(db,user,id);must(p.state==='PREVIEW','등록된 물품은 편집 화면에서 수정하세요.',409);
 const item=p.items[cursor];if(!item)return {...previewStatus(db,user,id),done:true,nextCursor:cursor};
 if(item.enriched&&!force)return {id,version:p.version,done:cursor+1>=p.items.length,nextCursor:cursor+1,total:p.items.length};
 let exact=null,imageBytes=null;item.notes=[];
 if(providerStatus(env).procurement.configured){
  try{const code=item.identificationCode;const results=(await catalog.search(user,code?{identificationCode:code}:{name:item.fields.title})).candidates;
   const matches=results.filter(c=>c.matchType==='EXACT_IDENTIFIER'&&c.actualIdentificationCode===code);
   if(matches.length===1){exact=matches[0];for(const k of ['manufacturer','model','description'])if(!item.fields[k]&&exact[k]&&!item.edited.includes(k)&&!(k==='manufacturer'&&genericManufacturer(exact[k],item,exact))){item.fields[k]=exact[k];item.provenance[k]='조달청 번호 일치';}
    item.notes.push('조달번호 일치 · 현물 명판은 담당자 확인');
    const count=db.prepare('SELECT COUNT(*) n FROM registration_preview_images WHERE batch_id=?').get(id).n;
    if(exact.imageUrl&&env.PROCUREMENT_IMAGE_RIGHTS_CONFIRMED==='true'&&count<10){try{imageBytes=await imageLoader(exact.imageUrl);must(Buffer.isBuffer(imageBytes)&&imageBytes.length<=4*1024*1024,'참고사진 크기 오류');item.referencePhoto={sourceUrl:exact.sourceUrl,label:'조달 참고사진 · 실제 현물 아님'};if(!item.edited.includes('useReferencePhoto'))item.useReferencePhoto=true;}catch{item.notes.push('참고사진 조회 실패 · 현물사진을 첨부하세요.');}}
   }else item.notes.push(results.length?'유사 후보만 존재 · 제품은 자동 확정하지 않음':'조달청 일치 정보 없음');
  }catch{item.notes.push('조달청 조회 실패 · 원본 정보 유지');}
 }else item.notes.push('조달청 미연결 · 원본 정보 유지');
 const client=modelClient(db,user,{env,fetcher,consent});
 if(useAi&&consent&&coreReady(client.config)&&['manufacturer','model','description'].some(k=>!item.fields[k])){
  try{const source=[item.sourceText,exact?.description].filter(Boolean).join('\n');const meta=await extractMetadata(client,source);
   for(const k of ['manufacturer','model','description'])if(!item.fields[k]&&meta[k]&&!item.edited.includes(k)&&!(k==='manufacturer'&&genericManufacturer(meta[k],item,exact))){item.fields[k]=meta[k];item.provenance[k]='AI 원문 발췌';}
  }catch{item.notes.push('AI 보완 미완료 · 원본 정보 유지');}
 }
 item.enriched=true;
 transaction(db,()=>{const fresh=load(db,user,id);must(fresh.state==='PREVIEW'&&fresh.version===p.version,'분석 중 담당자가 수정했습니다. 다시 확인하세요.',409,'VERSION_CONFLICT');
  if(imageBytes){db.prepare('INSERT OR REPLACE INTO registration_preview_images VALUES(?,?,?,?,?,?,?)').run(id,item.key,imageBytes,hash(imageBytes),exact.sourceUrl,exact.imageUrl,exact.actualIdentificationCode);}
  db.prepare('UPDATE registration_previews SET items=?,version=version+1,updated_at=? WHERE batch_id=?').run(stringify(p.items),now(),id);
 });
 return {id,version:p.version+1,total:p.items.length,done:cursor+1>=p.items.length,nextCursor:cursor+1};
}
export function confirmPreview(db,user,id,input){
 const d=z.object({version:z.number().int().positive(),confirmed:z.literal(true)}).strict().parse(input);
 return transaction(db,()=>{const p=load(db,user,id);if(p.state==='COMPLETE')return {state:'COMPLETE',receipt:p.receipt,reused:true};
  must(p.version===d.version,'담당자가 확인한 뒤 내용이 변경됐습니다. 다시 확인하세요.',409,'REVIEW_STALE');
  const batch=original(db,user,id);must(batch.file_hash===p.file_hash,'원본이 변경됐습니다.',409);
  const plan=previewImport(batch,p.config);must(!plan.errors.length&&planFingerprint(plan)===p.plan_hash,'원본 표가 변경됐습니다. 다시 분석하세요.',409);
  const receipt=confirmImport(db,user,id,p.config,{allowExpired:true});
  must(!receipt.reused,'같은 원본이 다른 창에서 등록됐습니다. 기존 물품을 확인하세요.',409,'ALREADY_REGISTERED');
  must(receipt.lotIds.length===p.items.length,'물품행 연결 결과가 다릅니다.',409);
  for(let i=0;i<p.items.length;i++){
   const item=p.items[i],row=svc.ownLot(db,user,receipt.lotIds[i]),old=JSON.parse(row.data);
   svc.saveLot(db,user,{...old,...item.fields,category:categoryFor(item.fields.title),version:row.version},row.id);
   if(item.useReferencePhoto){const image=db.prepare('SELECT * FROM registration_preview_images WHERE batch_id=? AND item_key=?').get(id,item.key);must(image&&hash(Buffer.from(image.bytes))===image.sha256,'참고사진 무결성 확인 실패',409);
    db.prepare('INSERT OR REPLACE INTO catalog_images VALUES(?,?,?,?,?,?,?,?,?)').run(row.id,'PREVIEW:'+id+':'+item.key,image.bytes,image.sha256,image.source_url,image.reference_url,image.identifier,user.id,now());
   }
  }
  const result={...receipt,confirmedAt:now(),scope:'PRIVATE_DRAFT'};
  db.prepare("UPDATE registration_previews SET state='COMPLETE',receipt=?,version=version+1,updated_at=? WHERE batch_id=?").run(stringify(result),now(),id);
  audit(db,user,'AI_PREVIEW_CONFIRMED',id,{count:receipt.lotCount,originalPreserved:true,public:false});return {state:'COMPLETE',receipt:result,reused:false};
 });
}
export function mountPreviewRegistration(app,db,options){
 const active=new Set();
 const guard=u=>{svc.business(u);const since=new Date(Date.now()-3600000).toISOString();must(db.prepare("SELECT COUNT(*) n FROM audit_events WHERE actor_id=? AND action='AI_PREVIEW_REQUEST' AND created_at>?").get(u.id,since).n<2500,'시간당 처리 한도입니다.',429);audit(db,u,'AI_PREVIEW_REQUEST',u.id);};
 app.post('/api/registration-preview/:id/prepare',(req,res)=>{guard(req.user);res.json(preparePreview(db,req.user,req.params.id,req.body));});
 app.get('/api/registration-preview/:id',(req,res)=>{svc.business(req.user);const offset=z.coerce.number().int().min(0).max(2000).parse(req.query.offset||0);res.json(previewStatus(db,req.user,req.params.id,offset));});
 app.patch('/api/registration-preview/:id/items/:key',(req,res)=>{guard(req.user);res.json(editPreview(db,req.user,req.params.id,req.params.key,req.body));});
 app.post('/api/registration-preview/:id/enrich',async(req,res)=>{guard(req.user);const d=z.object({cursor:z.number().int().min(0).max(2000).default(0),consent:z.boolean().default(false),useAi:z.boolean().default(true),force:z.boolean().default(false)}).strict().parse(req.body);
  const key=req.user.org_id+':'+req.params.id;must(!active.has(key),'이 파일을 분석 중입니다.',409);active.add(key);try{res.json(await enrichPreview(db,req.user,req.params.id,{...options,...d}));}finally{active.delete(key);}
 });
 app.post('/api/registration-preview/:id/confirm',(req,res)=>{guard(req.user);must(!active.has(req.user.org_id+':'+req.params.id),'분석 종료 후 확인해 주세요.',409);res.json(confirmPreview(db,req.user,req.params.id,req.body));});
 app.get('/api/registration-preview/:id/items/:key/reference',(req,res)=>{load(db,req.user,req.params.id);const image=db.prepare('SELECT bytes,sha256 FROM registration_preview_images WHERE batch_id=? AND item_key=?').get(req.params.id,req.params.key);must(image,'참고사진이 없습니다.',404);must(hash(Buffer.from(image.bytes))===image.sha256,'참고사진 무결성 오류',409);res.type('image/webp').send(Buffer.from(image.bytes));});
}
