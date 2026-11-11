import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';
import {uid,now,must,transaction,audit} from './db.mjs';
import {addUser,hash,verifyPassword,throttle} from './auth.mjs';
import {saveLot} from './service.mjs';
export const SAMPLE_DATASET='synthetic-300-v1';
const SPEC=[
 ['회의용 의자','FURNITURE','회의실 좌석',60,60,90,8],['사무용 의자','FURNITURE','행정실 회전의자',65,65,110,12],
 ['학생용 책상','FURNITURE','교실 책상',70,50,75,15],['교무실 책상','FURNITURE','120cm 사무용',120,70,75,32],
 ['회의 테이블','FURNITURE','6인 회의실 탁자',180,90,75,45],['도서관 책장','FURNITURE','책꽂이 서가',100,40,180,38],
 ['철제 캐비닛','OFFICE','캐비넷 서류 수납장',90,45,180,40],['이동서랍','OFFICE','3단 서류함',45,50,60,16],
 ['24인치 모니터','ELECTRONICS','HDMI 화면 디스플레이',60,20,45,6],['27인치 모니터','ELECTRONICS','업무용 디스플레이',70,25,55,8],
 ['데스크톱 컴퓨터','ELECTRONICS','PC 본체 교육용',25,45,50,12],['노트북','ELECTRONICS','이동 수업 랩탑',40,30,15,3],
 ['레이저 프린터','ELECTRONICS','프린트기 A4 흑백 인쇄',45,45,40,18],['컬러 복합기','ELECTRONICS','인쇄 복사 스캔',70,70,115,65],
 ['빔프로젝터','EDUCATION','강의실 영사기',40,35,20,5],['이동식 화이트보드','EDUCATION','수업 칠판',150,60,180,20],
 ['전자피아노','EDUCATION','음악 수업 건반',140,50,85,35],['실물화상기','EDUCATION','문서 수업 카메라',45,35,55,5],
 ['접이식 의자','FURNITURE','폴딩 체어 행사',50,15,90,5],['교육용 보관함','EDUCATION','교구 사물함 수납',100,45,120,28]
];
const districts=['강서구','양천구','마포구','강남구','성동구','송파구'];
function actors(db,index){
 const code='SAMPLE300-'+index;
 let org=db.prepare('SELECT * FROM organizations WHERE code=?').get(code);
 if(org)must(org.verified_note==='합성 시연기관 (sample300)','샘플 기관 코드가 실제 자료와 충돌합니다.',409);
 else{const id=uid();db.prepare('INSERT INTO organizations VALUES(?,?,?,?,?,1,?,?)').run(id,'가상 '+districts[index]+' 나눔기관',code,'PUBLIC_SCHOOL',districts[index],'합성 시연기관 (sample300)',now());org={id};}
 const users=[];
 for(const role of ['EDITOR','REVIEWER']){
  const email='sample300-'+index+'-'+role.toLowerCase()+'@synthetic.invalid';
  let u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(!u){const id=addUser(db,{orgId:org.id,name:'합성 생성자 (로그인 불가)',email,password:randomBytes(32).toString('hex'),role});db.prepare('UPDATE users SET active=0 WHERE id=?').run(id);u={id,org_id:org.id,role};}
  must(u.org_id===org.id&&!u.active,'샘플 전용 비로그인 계정 충돌입니다.',409);users.push(u);
 }
 return users;
}
/** Idempotent synthetic-only add-on. Existing lots, accounts and source documents are never reset. */
export async function seedAdditionalSamples(db,dataDir,{demo=false,count=300}={}){
 must(demo,'합성 시연 모드에서만 샘플을 추가할 수 있습니다.',403);
 must(Number.isInteger(count)&&count>=1&&count<=300,'1~300건을 선택하세요.');
 const existing=new Set(db.prepare('SELECT sample_key FROM demo_sample_lots WHERE dataset_id=?').all(SAMPLE_DATASET).map(x=>x.sample_key));
 const missing=Array.from({length:count},(_,i)=>i).filter(i=>!existing.has(SAMPLE_DATASET+':'+i));
 if(!missing.length)return {added:0,total:existing.size,archived:Number(db.prepare('SELECT COUNT(*) n FROM demo_sample_lots s JOIN lot_archives a ON a.lot_id=s.lot_id WHERE s.dataset_id=? AND a.restored_at IS NULL').get(SAMPLE_DATASET).n)};
 const upload=join(dataDir,'uploads');mkdirSync(upload,{recursive:true});const pictures=new Map();
 for(const i of [...new Set(missing.map(i=>i%SPEC.length))]){
  const [name,category]=SPEC[i];const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" rx="24" fill="#edf5f1"/><rect x="130" y="55" width="220" height="145" rx="16" fill="#a4cabb"/><path d="M155 205v32m170-32v32" stroke="#2b6250" stroke-width="14"/><text x="240" y="263" text-anchor="middle" font-family="sans-serif" font-size="23" fill="#153c30">${name}</text><text x="240" y="296" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#526d63">SYNTHETIC DEMO · ${category}</text></svg>`;
  const bytes=await sharp(Buffer.from(svg)).webp().toBuffer(),disk='sample300-'+i+'.webp';
  if(!existsSync(join(upload,disk)))writeFileSync(join(upload,disk),bytes,{mode:0o600});pictures.set(i,{bytes,disk});
 }
 return transaction(db,()=>{
  const byOrg=districts.map((_,i)=>actors(db,i));let added=0;
  for(const i of missing){
   const key=SAMPLE_DATASET+':'+i;if(db.prepare('SELECT 1 FROM demo_sample_lots WHERE sample_key=?').get(key))continue;
   const [base,category,usage,L,W,H,weight]=SPEC[i%SPEC.length],variant=Math.floor(i/SPEC.length)+1,[creator,reviewer]=byOrg[i%districts.length];
   const quantity=2+(i*7)%59,condition=i%3?'GOOD':'USED',model='SIM-'+String(i%SPEC.length+1).padStart(2,'0')+'-'+String(variant).padStart(2,'0');
   const dimensions={lengthCm:L,widthCm:W,heightCm:H,unitWeightKg:weight};
   const d={title:base+' · '+variant+'형',category,manufacturer:'합성 제조사',model,description:`시연용 합성자료. ${usage}. 실제 판매·전환 물품이 아닙니다. 크기 ${L}×${W}×${H}cm.`,specification:`${L}×${W}×${H}cm`,dimensions,dimensionsConfirmed:false,
    department:['행정실','교무실','도서실','과학실'][i%4],actualCount:quantity,ledgerCount:quantity,decisionQty:quantity,decisionRef:'SYNTHETIC-'+i,decisionDate:'2026-11-01',sourceTargetReference:'합성 시연 목록',
    originalName:base,classificationCode:'',identificationCode:'',mismatchNote:'',pickup:'합성 운반조건: 평일 기관 인수 · 상하차 별도 확인',needsWipe:category==='ELECTRONICS',specialReview:false,privacyChecked:true,
    groups:[{condition,quantity,inspection:'SAMPLE',note:'시연값 · 실제 현물 미확인'}]};
   const id=saveLot(db,creator,d),p=pictures.get(i%SPEC.length),photoId=uid();
   db.prepare('INSERT INTO files VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(photoId,creator.org_id,id,null,'PHOTO','시연용 합성 일러스트.webp','image/webp',p.disk,hash(p.bytes),p.bytes.length,creator.id,now());
   const source=JSON.parse(db.prepare('SELECT source_snapshot FROM lots WHERE id=?').get(id).source_snapshot);
   db.prepare('UPDATE lots SET source_snapshot=? WHERE id=?').run(JSON.stringify({...source,source:'SYNTHETIC_SAMPLE',dataset:SAMPLE_DATASET}),id);
   db.prepare("UPDATE lots SET state='PUBLISHED',decision_status='VERIFIED',reviewer_id=?,reviewed_at=?,review_note='합성 시연용 · 실제 승인 아님' WHERE id=?").run(reviewer.id,now(),id);
   db.prepare('INSERT INTO demo_sample_lots VALUES(?,?,?,?)').run(id,SAMPLE_DATASET,key,now());added++;
  }
  return {added,total:db.prepare('SELECT COUNT(*) n FROM demo_sample_lots WHERE dataset_id=?').get(SAMPLE_DATASET).n};
 });
}
export function mountDemoSamples(app,db,{demo=false,dataDir}={}){
 app.post('/api/demo/samples',throttle(),async(req,res)=>{
  must(demo,'샘플 생성은 시연 모드에서만 허용합니다.',403);must(['EDITOR','REVIEWER'].includes(req.user.role),'물품 담당자 권한이 필요합니다.',403);
  const user=db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);must(verifyPassword(String(req.body.password||''),user.password_hash),'현재 비밀번호를 확인하세요.',403);
  const result=await seedAdditionalSamples(db,dataDir,{demo,count:300});audit(db,req.user,'DEMO_SAMPLES_ADDED',SAMPLE_DATASET,result);res.json(result);
 });
}
