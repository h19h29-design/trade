import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as XLSX from 'xlsx';
import sharp from 'sharp';
import {fixture} from './helpers.mjs';
import {parseWorkbook} from '../server/excel-parser.mjs';
import {storeImport} from '../server/excel-import.mjs';
import {preparePreview,previewStatus,editPreview,enrichPreview,confirmPreview} from '../server/ai-core/preview-registration.mjs';
import {createCatalogGateway} from '../server/catalog-gateway.mjs';
import {createApp} from '../server/app.mjs';
import {getLot} from '../server/service.mjs';
function file(f){const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['G2B목록번호','G2B목록명','등록수량','취득단가','물품상태'],['56101703-00001234','회의용 책상',3,120000,'폐품']]),'소요조회');const raw=Buffer.from(XLSX.write(w,{type:'buffer',bookType:'xlsx'}));const wb={...parseWorkbook(raw),inputFormat:'XLSX',conversion:{state:'READY'}};return storeImport(f.db,f.editor,'합성_확인.xlsx',raw,wb);}
const count=f=>f.db.prepare('SELECT COUNT(*) n FROM lots').get().n;
test('원본 업로드·자동분석·수정 후에도 실제 물품 0개, 확인 버튼 때만 생성',()=>{const f=fixture();try{
 const id=file(f),p=preparePreview(f.db,f.editor,id);assert.equal(p.state,'PREVIEW');assert.equal(count(f),0);assert.equal(p.items[0].originalRows[0].condition,'폐품');
 assert.throws(()=>confirmPreview(f.db,f.editor,id,{version:p.version,confirmed:false}));assert.equal(count(f),0);
 const edited=editPreview(f.db,f.editor,id,'0',{version:p.version,fields:{title:'담당자가 확인한 회의용 책상',model:'원문 대조 모델'}});
 assert.equal(count(f),0);assert.throws(()=>confirmPreview(f.db,f.editor,id,{version:p.version,confirmed:true}),/변경/);
 const done=confirmPreview(f.db,f.editor,id,{version:edited.version,confirmed:true});assert.equal(count(f),1);assert.equal(done.state,'COMPLETE');
 const lot=getLot(f.db,f.editor,done.receipt.lotIds[0]);assert.equal(lot.title,'담당자가 확인한 회의용 책상');assert.equal(lot.state,'DRAFT');assert.equal(lot.sourceSummary.rows[0].condition,'폐품');assert.equal(lot.data.ledgerCount,3);assert.equal(lot.source.originalName,'회의용 책상');
 assert.equal(confirmPreview(f.db,f.editor,id,{version:edited.version,confirmed:true}).reused,true);assert.equal(count(f),1);
 assert.throws(()=>editPreview(f.db,f.editor,id,'0',{version:edited.version,fields:{title:'완료 이후 변경'}}));
}finally{f.db.close();}});
test('타기관·원본 수량/상태 변경·낡은 버전 차단 및 미리보기 만료 뒤 확인 재개',()=>{const f=fixture();try{
 const id=file(f),p=preparePreview(f.db,f.editor,id);assert.throws(()=>previewStatus(f.db,f.buyer,id));assert.throws(()=>confirmPreview(f.db,f.buyer,id,{version:p.version,confirmed:true}));
 assert.throws(()=>editPreview(f.db,f.editor,id,'0',{version:p.version,fields:{quantity:200}}));
 f.db.prepare('UPDATE import_batches SET created_at=? WHERE id=?').run('2020-01-01',id);
 assert.equal(previewStatus(f.db,f.editor,id).total,1);const done=confirmPreview(f.db,f.editor,id,{version:p.version,confirmed:true});assert.equal(done.receipt.lotCount,1);
}finally{f.db.close();}});
test('재업로드한 동일원본은 한번만 등록, 이후 확정은 기존물품 덮어쓰기 없이 차단',()=>{const f=fixture();try{
 const a=file(f),b=file(f),pa=preparePreview(f.db,f.editor,a),pb=preparePreview(f.db,f.editor,b);confirmPreview(f.db,f.editor,a,{version:pa.version,confirmed:true});
 assert.throws(()=>confirmPreview(f.db,f.editor,b,{version:pb.version,confirmed:true}));assert.equal(count(f),1);
}finally{f.db.close();}});
test('조달번호 보완·참고사진도 확정 전 실제 물품/현물사진에 생성하지 않음',async()=>{const f=fixture();try{
 const id=file(f);preparePreview(f.db,f.editor,id);const image=await sharp({create:{width:32,height:32,channels:3,background:'#eeeeee'}}).webp().toBuffer();
 const env={PROCUREMENT_ENABLED:'true',DATA_GO_KR_SERVICE_KEY:'FAKE_TEST',PROCUREMENT_IMAGE_RIGHTS_CONFIRMED:'true'};
 const options={env,catalog:{search:async()=>({candidates:[{matchType:'EXACT_IDENTIFIER',actualIdentificationCode:'00001234',manufacturer:'시험제조사',model:'T-100',description:'시험 설명',imageUrl:'https://g2b.go.kr/test.jpg',sourceUrl:'https://g2b.go.kr/'}]})},imageLoader:async()=>image,consent:false};
 await enrichPreview(f.db,f.editor,id,options);assert.equal(count(f),0);let p=previewStatus(f.db,f.editor,id);assert.equal(p.items[0].fields.manufacturer,'시험제조사');assert.ok(p.items[0].referencePhoto);
 const done=confirmPreview(f.db,f.editor,id,{version:p.version,confirmed:true}),lot=getLot(f.db,f.editor,done.receipt.lotIds[0]);assert.equal(lot.hasCatalogImage,true);assert.equal(lot.photos.length,0);assert.equal(lot.state,'DRAFT');
}finally{f.db.close();}});
test('조달 제조사 값이 표시 품명과 같은 일반명이면 preview에서 자동 입력하지 않음',async()=>{const f=fixture();try{
 const id=file(f);preparePreview(f.db,f.editor,id);
 const env={PROCUREMENT_ENABLED:'true',DATA_GO_KR_SERVICE_KEY:'FAKE_TEST'};const catalog={search:async()=>({candidates:[{matchType:'EXACT_IDENTIFIER',actualIdentificationCode:'00001234',manufacturer:'회의용 책상',model:'T-100',description:'시험 설명'}]})};
 await enrichPreview(f.db,f.editor,id,{env,catalog,consent:false});const p=previewStatus(f.db,f.editor,id);assert.equal(p.items[0].fields.manufacturer,'');assert.equal(p.items[0].fields.model,'T-100');assert.equal(count(f),0);
}finally{f.db.close();}});
test('조달 참고사진 이용조건이 확인되지 않으면 preview에 사진을 저장하지 않음',async()=>{const f=fixture();try{
 const id=file(f);preparePreview(f.db,f.editor,id);
 const env={PROCUREMENT_ENABLED:'true',DATA_GO_KR_SERVICE_KEY:'FAKE_TEST',PROCUREMENT_IMAGE_RIGHTS_CONFIRMED:'false'};
 const catalog={search:async()=>({candidates:[{matchType:'EXACT_IDENTIFIER',actualIdentificationCode:'00001234',manufacturer:'시험제조사',model:'T-100',description:'시험 설명',imageUrl:'https://g2b.go.kr/test.jpg',sourceUrl:'https://g2b.go.kr/'}]})};
 await enrichPreview(f.db,f.editor,id,{env,catalog,imageLoader:async()=>Buffer.from('must-not-be-used'),consent:false});
 const p=previewStatus(f.db,f.editor,id);assert.equal(p.items[0].referencePhoto,null);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM registration_preview_images').get().n,0);assert.equal(count(f),0);
}finally{f.db.close();}});
test('API 응답 중 담당자 수정 시 이전 분석을 덮어쓰지 않고 실제 물품 0개',async()=>{const f=fixture();try{
 const id=file(f);const p=preparePreview(f.db,f.editor,id);
 await assert.rejects(()=>enrichPreview(f.db,f.editor,id,{env:{PROCUREMENT_ENABLED:'true',DATA_GO_KR_SERVICE_KEY:'FAKE'},catalog:{search:async()=>{editPreview(f.db,f.editor,id,'0',{version:p.version,fields:{model:'수정 모델'}});return {candidates:[]};}}}),/수정/);
 assert.equal(previewStatus(f.db,f.editor,id).items[0].fields.model,'수정 모델');assert.equal(count(f),0);
}finally{f.db.close();}});
test('등록 HTTP 확인은 인증·CSRF·기관격리, 적재 계산은 입력 검증',async t=>{
 const f=fixture(),id=file(f),dir=mkdtempSync(join(tmpdir(),'trade-preview-')),origin='http://localhost:4310';const app=createApp(f.db,{origin,dataDir:dir,enhancements:{env:{},fetcher:async()=>{throw Error('NO NETWORK');}}});const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));const base='http://127.0.0.1:'+s.address().port;
 t.after(async()=>{await new Promise(r=>s.close(r));app.locals.closeRag?.();f.db.close();rmSync(dir,{recursive:true,force:true});});
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'editor@test.local',password:'TestingPassword!26'})});const j=await login.json();const headers={Origin:origin,'Content-Type':'application/json',Cookie:login.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':j.csrf};
 const a=await fetch(base+'/api/registration-preview/'+id+'/prepare',{method:'POST',headers,body:'{}'});assert.equal(a.status,200);assert.equal(count(f),0);
 const p=await a.json();let r=await fetch(base+'/api/registration-preview/'+id+'/confirm',{method:'POST',headers:{...headers,'X-CSRF-Token':'BAD'},body:JSON.stringify({version:p.version,confirmed:true})});assert.equal(r.status,403);assert.equal(count(f),0);
 r=await fetch(base+'/api/registration-preview/'+id+'/confirm',{method:'POST',headers,body:JSON.stringify({version:p.version,confirmed:true})});assert.equal(r.status,200);assert.equal(count(f),1);
 r=await fetch(base+'/api/shipping/packing',{method:'POST',headers,body:JSON.stringify({items:[],distanceKm:-1})});assert.equal(r.status,400);
});
