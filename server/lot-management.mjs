import {z} from 'zod';
import {must,audit,transaction,uid,now} from './db.mjs';
import {hash,verifyPassword,throttle} from './auth.mjs';
import {business} from './service.mjs';
import {catalogMatch} from './catalog-search.mjs';
import {SAMPLE_DATASET} from './demo-samples.mjs';
const selection=z.object({scope:z.enum(['selected','mine','samples','upload']),ids:z.array(z.string().uuid()).max(3000).default([]),batchId:z.string().uuid().optional()}).strict();
const PHRASES={selected:'선택 물품 삭제',mine:'내 물품 초기화',samples:'샘플 초기화',upload:'업로드 물품 삭제'};
function ownCredential(db,user,password){const r=db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);must(r&&verifyPassword(String(password||''),r.password_hash),'현재 비밀번호를 확인하세요.',403);}
function targets(db,user,input,demo){
 business(user);const d=selection.parse(input);let rows=[];
 if(d.scope==='samples'){
  must(demo,'합성 샘플 초기화는 테스트 모드에서만 허용됩니다.',403);
  rows=db.prepare('SELECT l.* FROM lots l JOIN demo_sample_lots s ON s.lot_id=l.id WHERE s.dataset_id=?').all(SAMPLE_DATASET);
 }else if(d.scope==='mine')rows=db.prepare('SELECT * FROM lots WHERE org_id=?').all(user.org_id);
 else if(d.scope==='upload'){
  must(d.batchId,'업로드 원본을 선택하세요.');const b=db.prepare('SELECT file_hash FROM import_batches WHERE id=? AND org_id=?').get(d.batchId,user.org_id);must(b,'본 기관의 원본이 아닙니다.',404);
  rows=db.prepare('SELECT DISTINCT l.* FROM lots l JOIN imported_rows r ON r.lot_id=l.id WHERE r.org_id=? AND r.file_hash=? AND l.org_id=?').all(user.org_id,b.file_hash,user.org_id);
 }else{
  must(d.ids.length>0,'삭제할 물품을 선택하세요.');const q=db.prepare('SELECT * FROM lots WHERE id=? AND org_id=?');rows=[...new Set(d.ids)].map(id=>{const r=q.get(id,user.org_id);must(r,'선택한 물품에 접근할 수 없습니다.',404);return r;});
 }
 must(rows.length<=3000,'한 번에 3,000건까지 처리합니다. 선택 범위를 나눠 주세요.');
 const activeArchive=db.prepare('SELECT 1 FROM lot_archives WHERE lot_id=? AND restored_at IS NULL');
 const history=db.prepare('SELECT 1 FROM requests r JOIN groups g ON g.id=r.group_id WHERE g.lot_id=? LIMIT 1');
 const eligible=[],blocked=[];
 for(const r of rows){if(activeArchive.get(r.id))continue;const why=history.get(r.id)?'신청·인계 이력 보존':r.state==='REVIEW'?'게시 검토 중':'';if(why)blocked.push({id:r.id,title:JSON.parse(r.data).title,reason:why});else eligible.push(r);}
 const snapshot=hash(JSON.stringify([d.scope,[...eligible,...rows.filter(r=>blocked.some(b=>b.id===r.id))].map(r=>[r.id,r.version,r.state]).sort((a,b)=>a[0].localeCompare(b[0]))]));
 return {d,eligible,blocked,snapshot,phrase:PHRASES[d.scope]};
}
export function archivePreview(db,user,input,{demo=false}={}){const t=targets(db,user,input,demo);return {count:t.eligible.length,blockedCount:t.blocked.length,blocked:t.blocked.slice(0,100),snapshot:t.snapshot,phrase:t.phrase,examples:t.eligible.slice(0,8).map(r=>({id:r.id,title:JSON.parse(r.data).title})),recoverable:true};}
export function archiveLots(db,user,input,{demo=false}={}){
 const d=z.object({selection, snapshot:z.string().length(64),phrase:z.string().max(50),password:z.string().min(1).max(200)}).strict().parse(input);ownCredential(db,user,d.password);
 return transaction(db,()=>{
  const t=targets(db,user,d.selection,demo);must(t.snapshot===d.snapshot,'삭제 대상이 변경되었습니다. 미리보기를 다시 확인하세요.',409);must(d.phrase===t.phrase,'확인 문구를 정확히 입력하세요.');
  const op=uid(),date=now();for(const r of t.eligible){
   db.prepare('INSERT INTO lot_archives VALUES(?,?,?,?,?,?,NULL,?) ON CONFLICT(lot_id) DO UPDATE SET actor_id=excluded.actor_id,previous_state=excluded.previous_state,reason=excluded.reason,created_at=excluded.created_at,restored_at=NULL,operation_id=excluded.operation_id').run(r.id,r.org_id,user.id,r.state,t.d.scope,date,op);
   db.prepare('UPDATE lots SET version=version+1,updated_at=? WHERE id=?').run(date,r.id);
  }
  audit(db,user,'LOTS_ARCHIVED',op,{count:t.eligible.length,blocked:t.blocked.length,scope:t.d.scope});return {archived:t.eligible.length,blocked:t.blocked.length,operationId:op,recoverable:true};
 });
}
export function restoreLots(db,user,input,{demo=false}={}){
 const d=z.object({ids:z.array(z.string().uuid()).min(1).max(3000),password:z.string().min(1).max(200)}).strict().parse(input);business(user);ownCredential(db,user,d.password);
 return transaction(db,()=>{let restored=0;for(const id of new Set(d.ids)){
  const r=db.prepare('SELECT l.*,a.previous_state,a.restored_at,s.dataset_id FROM lots l JOIN lot_archives a ON a.lot_id=l.id LEFT JOIN demo_sample_lots s ON s.lot_id=l.id WHERE l.id=?').get(id);
  must(r&&(r.org_id===user.org_id||demo&&r.dataset_id===SAMPLE_DATASET),'복원할 수 없는 물품입니다.',404);if(r.restored_at)continue;
  if(demo&&r.dataset_id===SAMPLE_DATASET)db.prepare('UPDATE lots SET version=version+1,updated_at=? WHERE id=?').run(now(),id);
  else db.prepare("UPDATE lots SET state='DRAFT',decision_status='UNVERIFIED',reviewer_id=NULL,review_note='',reviewed_at=NULL,version=version+1,updated_at=? WHERE id=?").run(now(),id);
  db.prepare('UPDATE lot_archives SET restored_at=? WHERE lot_id=?').run(now(),id);restored++;
 }
 audit(db,user,'LOTS_RESTORED',user.id,{count:restored});return {restored};});
}
export function listManaged(db,user,{trash=false,q='',offset=0,demo=false}={}){
 business(user);const rows=trash?db.prepare('SELECT l.*,a.created_at AS archived_at,s.dataset_id FROM lots l JOIN lot_archives a ON a.lot_id=l.id LEFT JOIN demo_sample_lots s ON s.lot_id=l.id WHERE a.restored_at IS NULL AND (l.org_id=? OR (?=1 AND s.dataset_id=?)) ORDER BY a.created_at DESC').all(user.org_id,demo?1:0,SAMPLE_DATASET):db.prepare('SELECT l.* FROM lots l WHERE org_id=? AND NOT EXISTS(SELECT 1 FROM lot_archives a WHERE a.lot_id=l.id AND a.restored_at IS NULL) ORDER BY updated_at DESC').all(user.org_id);
 const list=rows.map(r=>({...JSON.parse(r.data),id:r.id,state:r.state,version:r.version,archivedAt:r.archived_at,sample:!!r.dataset_id})).filter(r=>catalogMatch(r,q).matched);
 const start=Math.max(0,Math.floor(Number(offset)||0));return {total:list.length,offset:start,items:list.slice(start,start+40).map(r=>({id:r.id,title:r.title,model:r.model,listingNo:r.listingNo,quantity:r.actualCount,state:r.state,version:r.version,archivedAt:r.archivedAt,sample:r.sample})),nextOffset:start+40<list.length?start+40:null};
}
export function mountLotManagement(app,db,{demo=false}={}){
 app.get('/api/lot-management',(req,res)=>res.json(listManaged(db,req.user,{trash:req.query.trash==='true',q:String(req.query.q||'').slice(0,200),offset:Number(req.query.offset)||0,demo})));
 app.post('/api/lot-management/preview',(req,res)=>res.json(archivePreview(db,req.user,req.body,{demo})));
 app.post('/api/lot-management/archive',throttle(),(req,res)=>res.json(archiveLots(db,req.user,req.body,{demo})));
 app.post('/api/lot-management/restore',throttle(),(req,res)=>res.json(restoreLots(db,req.user,req.body,{demo})));
}
