import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as XLSX from 'xlsx';
import {fixture,published,draft,request as transferRequest} from './helpers.mjs';
import * as svc from '../server/service.mjs';
import {createApp} from '../server/app.mjs';
import {makeOzd} from './fixtures/native-ozd.mjs';
import {inferCriteria,retrieve,rankCandidate,WEIGHTS} from '../server/ai-core/ranking.mjs';
import {deliveryFor} from '../server/ai-core/delivery.mjs';
import {coreConfig,coreReady,extractMetadata,modelClient} from '../server/ai-core/model.mjs';
const key='SYNTHETIC_NOT_A_REAL_KEY';
const enabled={RAG_AI_ENABLED:'true',RAG_EXTERNAL_APPROVED:'true',DEEPSEEK_API_KEY:key,AI_CORE_DATA_APPROVED:'true'};
const apiJson=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const modelJson=value=>apiJson({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],usage:{}});
const procurement={PROCUREMENT_ENABLED:'true',DATA_GO_KR_SERVICE_KEY:key};
const catalogJson=(id='00001234')=>apiJson({response:{header:{resultCode:'00'},body:{items:[{prdctIdntNo:id,krnPrdctNm:'회의 의자 · 데모제조사 C100',mnfctCorpNm:'데모제조사',prdctClsfcNoNm:'의자',useYn:'Y'}]}}});
const workbook=()=>{const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['G2B목록번호','G2B목록명','등록수량','취득단가','물품상태'],['56101504-00001234','회의 의자',6,12000,'폐품']]),'소요조회');return XLSX.write(w,{type:'buffer',bookType:'xlsx'});};
async function http(t,{env={},fetcher=async()=>{throw new Error('NETWORK_DISABLED');}}={}){
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'trade-ai-core-')),origin='http://localhost:4310';
 const app=createApp(f.db,{dataDir:dir,origin,enhancements:{env,fetcher},rag:{env:{},fetcher:async()=>{throw Error('RAG disabled');}}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));app.locals.closeRag?.();f.db.close();rmSync(dir,{recursive:true,force:true});});
 const login=async(name='buyer')=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:name+'@test.local',password:'TestingPassword!26'})});assert.equal(r.status,200);return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:(await r.json()).csrf};};
 const auth=await login();
 const call=(path,{method='POST',data={},session=auth,csrf=true,form}={})=>fetch(base+'/api'+path,{method,headers:{Origin:origin,...(session?{Cookie:session.cookie,...(csrf?{'X-CSRF-Token':session.csrf}:{})}:{}),...(form||method==='GET'?{}:{'Content-Type':'application/json'})},...(method==='GET'?{}:{body:form||JSON.stringify(data)})});
 const upload=async(bytes,name='소요조회.xlsx',session=auth)=>{const form=new FormData();form.set('file',new Blob([bytes]),name);return call('/imports/documents',{form,session});};
 return {...f,call,login,upload,base,app};
}
test('AI 핵심 설정은 기존 DeepSeek 키/모델 재사용, 물품자료 외부승인 분리',()=>{
 assert.equal(coreReady(coreConfig({...enabled,AI_CORE_DATA_APPROVED:'false'})),false);
 assert.equal(coreReady(coreConfig(enabled)),true);assert.equal(coreConfig({...enabled,RAG_MODEL:'existing-model'}).model,'existing-model');
 assert.equal(coreReady(coreConfig({...enabled,AI_CORE_ENABLED:'false'})),false);
});
test('추천지수는 고정100점·수량/지역/동의어 기반이고 품질 확률이 아님',()=>{
 assert.equal(Object.values(WEIGHTS).reduce((a,b)=>a+b,0),100);
 const c=inferCriteria('강서구 회의용 의자 20개');assert.equal(c.quantity,20);assert.equal(c.district,'강서구');
 const f=fixture();try{const {id}=published(f);const lots=svc.listLots(f.db,f.buyer,{min:1});const r=retrieve(lots,c);assert.equal(r[0].lot.id,id);const rank=rankCandidate(r[0],c);assert.ok(rank.score>=0&&rank.score<=100);assert.equal(rank.sufficient,false);assert.ok(rank.cons.some(e=>e.text.includes('2개 부족')));assert.equal(rank.delivery.status,'NEEDS_INFO');assert.deepEqual(retrieve(lots,inferCriteria('업무용 모니터')),[]);}
 finally{f.db.close();}
});
test('배송 정보 누락은 무료로 표시하지 않고, 좌표·규격이 있으면 수량별 추정',async()=>{
 const l={orgName:'합성기관',available:30};const missing=await deliveryFor(l,{quantity:20});assert.equal(missing.status,'NEEDS_INFO');assert.equal(missing.low,undefined);
 const full={...l,pickupLocation:{label:'합성출발지',lat:37.55,lng:126.85,confirmed:true},dimensions:{lengthCm:50,widthCm:50,heightCm:80,unitWeightKg:8},dimensionsConfirmed:true};
 const quote=await deliveryFor(full,{quantity:20},{destination:{label:'합성도착지',lat:37.6,lng:127.1}});assert.equal(quote.status,'ESTIMATED');assert.equal(quote.sample,true);assert.equal(quote.binding,false);assert.ok(quote.high>=quote.low&&quote.low>0);assert.equal(quote.source,'COORDINATE_ASSUMPTION');
});
test('검색 API는 비공개·자기기관·비활성 기관·예약으로 소진된 물품 제외',async t=>{
 const h=await http(t);const pub=published(h);const priv=svc.saveLot(h.db,h.editor,{...draft(),title:'비공개 의자'});
 let r=await h.call('/ai-core/search',{data:{query:'의자',useAi:false}});assert.equal(r.status,200);let j=await r.json();assert.deepEqual(j.results.map(r=>r.lot.id),[pub.id]);assert.ok(!JSON.stringify(j).includes(priv));assert.equal(j.mode,'LOCAL_RANKING');
 const editor=await h.login('editor');r=await h.call('/ai-core/search',{data:{query:'의자'},session:editor});assert.equal((await r.json()).results.length,0);
 h.db.prepare('UPDATE organizations SET active=0 WHERE id=?').run(h.editor.org_id);r=await h.call('/ai-core/search',{data:{query:'의자'}});assert.equal((await r.json()).results.length,0);
});
test('검색 인증·업무역할·CSRF와 입력범위 검증',async t=>{
 const h=await http(t);published(h);
 for(const opts of [{session:null},{csrf:false},{session:await h.login('admin')}]){const r=await h.call('/ai-core/search',{data:{query:'의자'},...opts});assert.ok([401,403].includes(r.status));}
 for(const data of [{query:'의자',quantity:0},{query:'의자',quantity:100001},{query:'의자',unrecognized:123}])assert.equal((await h.call('/ai-core/search',{data})).status,400);
 const status=await (await h.call('/ai-core/status',{method:'GET'})).json();assert.ok(!JSON.stringify(status).includes(key));
});
test('AI 미동의면 키가 있어도 외부 요청0, 부족 수량 제외 선택 유지',async t=>{
 let calls=0;const h=await http(t,{env:enabled,fetcher:async()=>{calls++;throw Error('not allowed');}});published(h);
 const r=await h.call('/ai-core/search',{data:{query:'의자 20개',consent:false,allowPartial:false}});const j=await r.json();assert.equal(j.results.length,0);assert.equal(calls,0);
});
test('AI 검색은 공개 근거만 전달하고 응답의 물품ID·근거ID를 검증',async t=>{
 let calls=0,secretId='';const h=await http(t,{env:enabled,fetcher:async(url,options)=>{calls++;assert.equal(String(url),'https://api.deepseek.com/chat/completions');assert.ok(!options.body.includes('비공개_극비'));assert.ok(!secretId||!options.body.includes(secretId));const p=JSON.parse(JSON.parse(options.body).messages[1].content);if(p.sources)return modelJson({items:p.sources.map(s=>({id:s.id,text:'등록된 수량과 상태를 확인하고 받기 신청하세요.',sourceIds:[s.evidence[0].id]}))});return modelJson({terms:['의자','체어']});}});
 published(h);secretId=svc.saveLot(h.db,h.editor,{...draft(),title:'비공개_극비 의자'});
 const r=await h.call('/ai-core/search',{data:{query:'의자',consent:true}});assert.equal(r.status,200);const j=await r.json();assert.equal(j.mode,'AI_ASSISTED_RAG');assert.ok(j.results[0].aiExplanation);assert.equal(calls,2);
});
test('AI 설명에 근거없는 숫자나 식별자가 있으면 구조화 장단점으로 대체',async t=>{
 const h=await http(t,{env:enabled,fetcher:async(url,options)=>{const p=JSON.parse(JSON.parse(options.body).messages[1].content);return p.sources?modelJson({items:[{id:p.sources[0].id,text:'배송비 999999999원',sourceIds:[p.sources[0].evidence[0].id]}]}):modelJson({terms:['의자']});}});published(h);
 const j=await (await h.call('/ai-core/search',{data:{query:'의자',consent:true}})).json();assert.equal(j.results[0].aiExplanation,null);assert.ok(j.notes.some(n=>n.includes('검증 실패')));assert.ok(j.results[0].pros.length);
});
test('AI 응답 대기 중 게시 중단된 물품은 결과에서 다시 제외',async t=>{
 let h,lot;
 h=await http(t,{env:enabled,fetcher:async(url,options)=>{const p=JSON.parse(JSON.parse(options.body).messages[1].content);if(p.sources){h.db.prepare("UPDATE lots SET state='PAUSED' WHERE id=?").run(lot.id);return modelJson({items:[]});}return modelJson({terms:['의자']});}});lot=published(h);
 const j=await (await h.call('/ai-core/search',{data:{query:'의자',consent:true}})).json();assert.equal(j.results.length,0);assert.ok(j.notes.some(n=>n.includes('검색 중 변경')));
});
test('OZD 자동등록은 외부 변환0·비공개 초안·원본 보존 및 반복 요청 멱등',async t=>{
 const h=await http(t);const upload=await h.upload(makeOzd(),'소요조회.ozd');assert.equal(upload.status,200);const batch=await upload.json();
 const r=await h.call('/ai-core/register/'+batch.id+'/start');assert.equal(r.status,200);const receipt=await r.json();assert.ok(receipt.lotCount>0);
 for(const id of receipt.lotIds){const row=h.db.prepare('SELECT state,source_snapshot FROM lots WHERE id=?').get(id);assert.equal(row.state,'DRAFT');assert.ok(JSON.parse(row.source_snapshot).originalRows.length);}
 const again=await (await h.call('/ai-core/register/'+batch.id+'/start')).json();assert.equal(again.reused,true);assert.deepEqual(again.lotIds,receipt.lotIds);
 const b=await (await h.call('/ai-core/register/'+batch.id+'/enrich',{data:{useAi:false}})).json();assert.equal(b.nextCursor,1);assert.equal(b.items[0].privateDraft,true);
});
test('엑셀 자동등록·조달 보완은 실제 번호 일치 빈칸만, 폐품과 단가·수량 불변',async t=>{
 const h=await http(t,{env:procurement,fetcher:async()=>catalogJson()});const u=await(await h.upload(workbook())).json();const receipt=await(await h.call('/ai-core/register/'+u.id+'/start')).json();const id=receipt.lotIds[0];const before=h.db.prepare('SELECT source_snapshot FROM lots WHERE id=?').get(id).source_snapshot;
 const r=await h.call('/ai-core/register/'+u.id+'/enrich',{data:{useAi:false}});assert.equal(r.status,200);const j=await r.json();assert.equal(j.items[0].state,'CATALOG_MATCHED');
 const row=h.db.prepare('SELECT * FROM lots WHERE id=?').get(id),d=JSON.parse(row.data);assert.equal(d.manufacturer,'데모제조사');assert.equal(d.actualCount,6);assert.equal(row.state,'DRAFT');assert.equal(row.source_snapshot,before);assert.equal(d.groups[0].condition,'UNKNOWN');assert.equal(JSON.parse(before).originalRows[0].condition,'폐품');
 const r2=await (await h.call('/ai-core/register/'+u.id+'/enrich',{data:{useAi:false}})).json();assert.equal(r2.items[0].reused,true);
});
test('조달 품명후보만 맞으면 제품번호와 제조사를 자동 확정하지 않음',async t=>{
 const h=await http(t,{env:procurement,fetcher:async()=>catalogJson('99999999')});const u=await(await h.upload(workbook())).json();const receipt=await(await h.call('/ai-core/register/'+u.id+'/start')).json();await h.call('/ai-core/register/'+u.id+'/enrich',{data:{useAi:false}});
 const d=JSON.parse(h.db.prepare('SELECT data FROM lots WHERE id=?').get(receipt.lotIds[0]).data);assert.equal(d.actualIdentificationCode,'');assert.equal(d.identificationCode,'00001234');assert.equal(d.manufacturer,'');
});
test('자료의 기관별 격리 및 잘못된 자동 매핑 시 0건 생성',async t=>{
 const h=await http(t);const u=await(await h.upload(workbook())).json();const other=await h.login('third');assert.equal((await h.call('/ai-core/register/'+u.id+'/start',{session:other})).status,404);
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['엉뚱한열','미지값'],['의자',4]]),'표');const bad=await(await h.upload(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}))).json();const n=h.db.prepare('SELECT COUNT(*) n FROM lots').get().n;
 assert.equal((await h.call('/ai-core/register/'+bad.id+'/start')).status,422);assert.equal(h.db.prepare('SELECT COUNT(*) n FROM lots').get().n,n);
});
test('AI 제품정보는 원본에 없는 제조사·모델을 차단',async()=>{
 const f=fixture();try{const client=modelClient(f.db,f.editor,{env:enabled,consent:true,fetcher:async()=>modelJson({manufacturer:'없는브랜드',model:'X-999',descriptionParts:['없는내용']})});await assert.rejects(()=>extractMetadata(client,'삼성 모니터 S24'),/원문에 없는/);}finally{f.db.close();}
});
test('AI 제품정보는 원문 발췌만 허용하고 기존 RAG 사용량/키는 반환하지 않음',async()=>{
 const f=fixture();try{const client=modelClient(f.db,f.editor,{env:enabled,consent:true,fetcher:async()=>modelJson({manufacturer:'삼성',model:'S24',descriptionParts:['모니터 S24']})});const p=await extractMetadata(client,'삼성 모니터 S24');assert.deepEqual(p,{manufacturer:'삼성',model:'S24',description:'모니터 S24'});const events=f.db.prepare("SELECT detail FROM audit_events WHERE action='AI_CORE_MODEL_CALL'").all();assert.equal(events.length,1);assert.ok(!events[0].detail.includes(key));}finally{f.db.close();}
});

test('예약으로 공유 가능한 상태 수량이 전부 소진되면 추천하지 않음',async t=>{
 const h=await http(t);const lot=published(h);const first=transferRequest(h,lot,10);svc.reserve(h.db,h.editor,first);
 const used=h.db.prepare("SELECT id FROM groups WHERE lot_id=? AND condition='USED'").get(lot.id).id;
 const second=svc.apply(h.db,h.buyer,{groupId:used,quantity:8,purpose:'합성 추가 신청',pickupDate:'2026-12-01'},'test-used-reservation');svc.reserve(h.db,h.editor,second);
 const j=await (await h.call('/ai-core/search',{data:{query:'의자'}})).json();assert.equal(j.results.length,0);
});
test('조회 실패한 자동 보완은 초안을 유지하고 같은 키로 재시도 가능',async t=>{
 let calls=0;const h=await http(t,{env:procurement,fetcher:async()=>{calls++;if(calls===1)throw Error('TEMPORARY_PROVIDER_ERROR');return catalogJson();}});
 const u=await(await h.upload(workbook())).json();const r=await(await h.call('/ai-core/register/'+u.id+'/start')).json();const before=h.db.prepare('SELECT source_snapshot FROM lots WHERE id=?').get(r.lotIds[0]).source_snapshot;
 const a=await(await h.call('/ai-core/register/'+u.id+'/enrich',{data:{useAi:false}})).json();assert.equal(a.items[0].state,'SOURCE_ONLY');
 const b=await(await h.call('/ai-core/register/'+u.id+'/enrich',{data:{useAi:false}})).json();assert.equal(b.items[0].state,'CATALOG_MATCHED');assert.equal(calls,2);assert.equal(h.db.prepare('SELECT source_snapshot FROM lots WHERE id=?').get(r.lotIds[0]).source_snapshot,before);
});
test('직접 수정된 초안을 공급자 응답으로 덮어쓰지 않음',async t=>{
 let h,id;h=await http(t,{env:procurement,fetcher:async()=>{const row=svc.ownLot(h.db,h.buyer,id);svc.saveLot(h.db,h.buyer,{...JSON.parse(row.data),model:'수동 확인 모델',version:row.version},id);return catalogJson();}});
 const u=await(await h.upload(workbook())).json();const r=await(await h.call('/ai-core/register/'+u.id+'/start')).json();id=r.lotIds[0];
 const a=await(await h.call('/ai-core/register/'+u.id+'/enrich',{data:{useAi:false}})).json();assert.equal(a.items[0].state,'RETRY');assert.equal(JSON.parse(svc.ownLot(h.db,h.buyer,id).data).model,'수동 확인 모델');
});
test('등록 후 미리보기 만료와 관계없이 보완 상태를 안전하게 재개',async t=>{
 const h=await http(t);const u=await(await h.upload(workbook())).json();await h.call('/ai-core/register/'+u.id+'/start');h.db.prepare('UPDATE import_batches SET created_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z',u.id);
 const status=await h.call('/ai-core/register/'+u.id+'/status',{method:'GET'});assert.equal(status.status,200);assert.equal((await status.json()).registeredCount,1);assert.equal((await h.call('/ai-core/register/'+u.id+'/enrich',{data:{useAi:false}})).status,200);
});
test('검색의 제외 표현은 금지한 물품을 추천하지 않음',()=>{
 const f=fixture();try{published(f);const lots=svc.listLots(f.db,f.buyer,{min:1});assert.equal(retrieve(lots,inferCriteria('의자 말고 책상')).length,0);}finally{f.db.close();}
});

test('담당자가 공개를 확인하지 않은 출발 좌표는 타 기관 API에서 숨김',()=>{
 const f=fixture();try{const data={...draft(),pickupLocation:{label:'확인 전 기관 위치',lat:37.5,lng:127,confirmed:false}};const lot=published(f,data);assert.equal(svc.getLot(f.db,f.buyer,lot.id).pickupLocation,undefined);assert.equal(svc.getLot(f.db,f.editor,lot.id).pickupLocation.label,'확인 전 기관 위치');}finally{f.db.close();}
});
