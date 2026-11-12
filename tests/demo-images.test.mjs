import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,uid,now} from '../server/db.mjs';
import {hash} from '../server/auth.mjs';
import {ensureSingleDemo} from '../server/demo-single.mjs';
import {seedAdditionalSamples,SAMPLE_IMAGE_ASSETS} from '../server/demo-samples.mjs';
import {refreshShowcaseImages,SHOWCASE_MAP,showcaseAssetBytes,showcaseDiskName,SHOWCASE_DISPLAY_NAME} from '../server/showcase-images.mjs';

function tempData(t){
 const dir=mkdtempSync(join(tmpdir(),'trade-demo-images-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const db=openDatabase(join(dir,'trade.sqlite'));
 t.after(()=>{try{db.close();}catch{}});
 return {dir,db};
}

function isWebp(bytes){
 return bytes.subarray(0,4).toString('latin1')==='RIFF'&&bytes.subarray(8,12).toString('latin1')==='WEBP';
}

test('시연용 생성 이미지 20종은 실제 WebP 파일이며 서로 다른 자산이다',()=>{
 assert.equal(SAMPLE_IMAGE_ASSETS.length,20);
 assert.equal(new Set(SAMPLE_IMAGE_ASSETS).size,20);
 for(const asset of SAMPLE_IMAGE_ASSETS){
  const bytes=showcaseAssetBytes(asset);
  assert.ok(isWebp(bytes),asset+' is webp');
  assert.ok(bytes.length>4000,asset+' has content');
  assert.ok(bytes.length<400*1024,asset+' is small enough for upload');
 }
});

test('샘플 물품은 생성 이미지를 실제 첨부로 참조한다',async t=>{
 const {dir,db}=tempData(t);
 ensureSingleDemo(db,{adminId:'admin',adminPassword:'1234'});
 await seedAdditionalSamples(db,dir,{demo:true,count:300});
 const photos=db.prepare('SELECT * FROM files WHERE kind=?').all('PHOTO');
 assert.ok(photos.length>0);
 for(const photo of photos){
  assert.equal(photo.mime,'image/webp');
  assert.equal(photo.name,SHOWCASE_DISPLAY_NAME);
  assert.ok(photo.disk_name.startsWith('demo-'));
  const path=join(dir,'uploads',photo.disk_name);
  assert.ok(existsSync(path),'upload exists: '+photo.disk_name);
  assert.ok(isWebp(readFileSync(path)),'upload is webp: '+photo.disk_name);
  assert.equal(hash(readFileSync(path)),photo.sha256);
 }
 const first=photos.find(p=>p.disk_name==='demo-meeting-chair.webp');
 assert.ok(first,'meeting-chair asset is used');
});

function addShowcaseLot(db,dir,{title,asset,disk='legacy-board.webp'}){
 const org=db.prepare('SELECT id FROM organizations LIMIT 1').get().id;
 const user=db.prepare('SELECT id FROM users LIMIT 1').get().id;
 mkdirSync(join(dir,'uploads'),{recursive:true});
 const legacy=Buffer.from('LEGACY-PLACEHOLDER-BYTES');
 writeFileSync(join(dir,'uploads',disk),legacy);
 const lotId=uid(),fileId=uid();
 db.prepare('INSERT INTO lots(id,org_id,creator_id,data,source_snapshot,state,decision_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
  .run(lotId,org,user,JSON.stringify({title,category:'OFFICE',groups:[{condition:'GOOD',quantity:1}]}),JSON.stringify({}),'PUBLISHED','VERIFIED',now(),now());
 db.prepare('INSERT INTO files VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
  .run(fileId,org,lotId,null,'PHOTO','예시 일러스트.webp','image/webp',disk,hash(legacy),legacy.length,user,now());
 return {lotId,fileId,asset,legacy};
}

test('공개 물품 이미지 교체는 미리보기에서 아무것도 바꾸지 않는다',async t=>{
 const {dir,db}=tempData(t);
 ensureSingleDemo(db,{adminId:'admin',adminPassword:'1234'});
 const seeded=addShowcaseLot(db,dir,{title:'수업용 이동식 화이트보드 세트',asset:'whiteboard'});
 const before=db.prepare('SELECT * FROM files WHERE id=?').get(seeded.fileId);
 const preview=refreshShowcaseImages(db,dir,{apply:false});
 assert.equal(preview.mode,'DRY_RUN');
 assert.equal(preview.changed,1);
 assert.deepEqual(db.prepare('SELECT * FROM files WHERE id=?').get(seeded.fileId),before);
 assert.deepEqual(readFileSync(join(dir,'uploads','legacy-board.webp')),seeded.legacy);
 assert.equal(existsSync(join(dir,'uploads',showcaseDiskName('whiteboard',seeded.fileId))),false);
});

test('이미지 교체는 기존 첨부를 남기고 새 파일 참조로 갱신하며 재실행에 안전하다',async t=>{
 const {dir,db}=tempData(t);
 ensureSingleDemo(db,{adminId:'admin',adminPassword:'1234'});
 const seeded=addShowcaseLot(db,dir,{title:'수업용 이동식 화이트보드 세트',asset:'whiteboard'});
 const applied=refreshShowcaseImages(db,dir,{apply:true});
 assert.equal(applied.mode,'APPLIED');
 assert.equal(applied.changed,1);
 assert.deepEqual(applied.keptPreviousFiles,['legacy-board.webp']);
 const row=db.prepare('SELECT * FROM files WHERE id=?').get(seeded.fileId);
 assert.equal(row.disk_name,showcaseDiskName('whiteboard',seeded.fileId));
 assert.equal(row.name,SHOWCASE_DISPLAY_NAME);
 assert.equal(row.mime,'image/webp');
 assert.deepEqual(readFileSync(join(dir,'uploads',row.disk_name)),showcaseAssetBytes('whiteboard'));
 assert.equal(row.sha256,hash(showcaseAssetBytes('whiteboard')));
 assert.equal(row.size,statSync(join(dir,'uploads',row.disk_name)).size);
 // 기존 파일은 삭제·덮어쓰기 하지 않는다.
 assert.deepEqual(readFileSync(join(dir,'uploads','legacy-board.webp')),seeded.legacy);
 const again=refreshShowcaseImages(db,dir,{apply:true});
 assert.equal(again.changed,0);
 assert.equal(again.unchanged,1);
 const auditRow=db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='DEMO_SHOWCASE_IMAGE_REFRESH'").get();
 assert.equal(auditRow.n,1);
});

test('교체 대상 공개 물품이 없으면 건너뛰고 오류를 내지 않는다',async t=>{
 const {dir,db}=tempData(t);
 ensureSingleDemo(db,{adminId:'admin',adminPassword:'1234'});
 const result=refreshShowcaseImages(db,dir,{apply:true});
 assert.equal(result.changed,0);
 assert.equal(result.skipped.length,SHOWCASE_MAP.length);
});
