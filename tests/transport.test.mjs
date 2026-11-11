import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fixture,draft,published,request} from './helpers.mjs';
import {createApp} from '../server/app.mjs';
import * as svc from '../server/service.mjs';
import {approximateRegion} from '../server/transport/regions.mjs';
import {knownCargo,finishCargo,textDimensions,inferCargo} from '../server/transport/cargo.mjs';
import {readTransportLot,transportPlanSchema} from '../server/transport/routes.mjs';
import {providerStatus,drivingRoute} from '../server/providers.mjs';
import {HIVE_MODEL} from '../server/rag/deepseek.mjs';

const exactEnv={LOCATION_ENABLED:'true',KAKAO_REST_API_KEY:'TEST_ONLY_NOT_A_REAL_KEY',ROUTE_ENABLED:'true'};
const aiEnv={RAG_AI_ENABLED:'true',RAG_EXTERNAL_APPROVED:'true',AI_CORE_DATA_APPROVED:'true',RAG_PROVIDER:'hive',HIVE_API_KEY:'TEST_ONLY_NOT_A_REAL_HIVE_KEY',RAG_MODEL:HIVE_MODEL};
const origin='http://localhost:4310';
async function serve(t,{env={},fetcher=async()=>{throw Error('Unexpected outbound request');}}={}){
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'ssulmo-transport-'));
 const app=createApp(f.db,{dataDir:dir,origin,enhancements:{env,fetcher}}),server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));app.locals.closeRag?.();f.db.close();rmSync(dir,{recursive:true,force:true});});
 async function login(email='buyer@test.local'){
  const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password:'TestingPassword!26'})});assert.equal(r.status,200);const json=await r.json();
  const headers={Origin:origin,'Content-Type':'application/json',Cookie:r.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':json.csrf};
  return {post:(path,data)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(data)}),get:path=>fetch(base+path,{headers}),headers};
 }
 return {...f,base,login};
}
async function address(client,query='서울 마포구',consent=false){const r=await client.post('/api/transport/address',{query,consent});assert.equal(r.status,200);const data=await r.json();assert.ok(data.candidates.length);return data.candidates[0];}
function fakeKakao(calls=[]){return async(url,opts)=>{const u=new URL(url);calls.push({url:u,headers:opts.headers});if(u.hostname==='dapi.kakao.com')return Response.json({documents:[{address_name:'서울특별시 마포구 월드컵로 1',x:'126.901',y:'37.566'}]});if(u.hostname==='apis-navi.kakaomobility.com')return Response.json({routes:[{result_code:0,summary:{distance:23400,duration:1800}}]});throw Error('unexpected host');};}

test('규격은 단위가 명시된 원문만 추출, 실측·등록값 우선, AI는 미확인 항목만 추정',()=>{
 assert.deepEqual(textDimensions('책상, HT3020, 1600×600×720mm, 30kg'),{lengthCm:160,widthCm:60,heightCm:72,unitWeightKg:30});
 assert.deepEqual(textDimensions('MODEL 1600x600x720 가격 30000원'),{});
 const lot={title:'회의용 의자',dimensions:{lengthCm:62,widthCm:63,heightCm:91,unitWeightKg:9},dimensionsConfirmed:true};
 const known=knownCargo(lot),result=finishCargo(lot,known,{lengthCm:99,widthCm:99,heightCm:99,unitWeightKg:99});
 assert.deepEqual(result.dimensions,lot.dimensions);assert.equal(result.estimated,false);assert.ok(Object.values(result.sources).every(s=>s==='MEASURED'));
 const guessed=finishCargo({title:'알수없는 특수기계'},knownCargo({title:'알수없는 특수기계'}));assert.equal(guessed.dimensions,null);assert.equal(guessed.missing.length,4);
});
test('지역 대표점은 서울·부산 동일 구명을 혼동하지 않고 실제 좌표로 단정하지 않음',()=>{
 assert.equal(approximateRegion('서울특별시 강서구 공항대로 100').precision,'DISTRICT_APPROX');
 assert.equal(approximateRegion('부산광역시 강서구').precision,'CITY_APPROX');
 assert.notEqual(approximateRegion('서울 강서구').lat,approximateRegion('부산 강서구').lat);
 assert.equal(approximateRegion('강서구'),null);assert.ok(approximateRegion('강서구',{seoulDistrict:true}));assert.equal(approximateRegion('존재하지 않는 지역'),null);
});
test('새 운송 API는 키·외부AI 없이도 유형 가정·대표점·트럭을 계산하며 원본 변경0',async t=>{
 const f=await serve(t),lot=published(f),before=f.db.prepare('SELECT data,source_snapshot,version FROM lots WHERE id=?').get(lot.id),client=await f.login();
 const dest=await address(client),r=await client.post('/api/transport/plan',{selections:[{lotId:lot.id,quantity:3}],destinationToken:dest.token});assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.status,'ESTIMATED');assert.equal(data.sample,true);assert.equal(data.binding,false);assert.equal(data.groups[0].distance.source,'REGION_APPROX');assert.equal(data.groups[0].items[0].sources.unitWeightKg,'CATEGORY_ESTIMATE');assert.ok(data.totals.estimated>0);
 assert.deepEqual(f.db.prepare('SELECT data,source_snapshot,version FROM lots WHERE id=?').get(lot.id),before);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM requests').get().n,0);
});
test('카카오 기존 REST 키로 주소·도로 연결, 서비스 opt-in/동의 및 도로 출처 유지',async t=>{
 const calls=[],f=await serve(t,{env:exactEnv,fetcher:fakeKakao(calls)}),lot=published(f,{...draft(),dimensions:{lengthCm:60,widthCm:60,heightCm:90,unitWeightKg:8},dimensionsConfirmed:true,pickupLocation:{label:'확인된 출발지',lat:37.551,lng:126.85,confirmed:true}}),client=await f.login();
 assert.equal(providerStatus(exactEnv).route.configured,true);assert.equal(providerStatus({...exactEnv,ROUTE_ENABLED:'false'}).route.configured,false);
 const dest=await address(client,'서울 마포구 월드컵로 1',true);assert.equal(dest.precision,'KAKAO_ADDRESS');
 const r=await client.post('/api/transport/plan',{selections:[{lotId:lot.id,quantity:3}],destinationToken:dest.token,routeConsent:true});assert.equal(r.status,200);
 const plan=await r.json();assert.equal(plan.groups[0].distance.source,'KAKAO_ROAD');assert.equal(plan.groups[0].distance.km,23.4);
 assert.equal(calls.length,2);assert.equal(calls[1].headers.Authorization,'KakaoAK '+exactEnv.KAKAO_REST_API_KEY);assert.ok(!JSON.stringify(plan).includes(exactEnv.KAKAO_REST_API_KEY));
});
test('AI는 기존 Hive 모델·승인 재사용, 주소 미전송, 명시 규격은 AI가 덮어쓰지 않음',async t=>{
 let seen=null;
 const fetcher=async(url,opts)=>{assert.equal(new URL(url).hostname,'api-cdn.thehive.ai');const payload=JSON.parse(opts.body);seen=JSON.parse(payload.messages[1].content);return Response.json({model:HIVE_MODEL,choices:[{finish_reason:'stop',message:{content:JSON.stringify({items:seen.items.map(i=>({id:i.id,dimensions:{lengthCm:200,widthCm:100,heightCm:100,unitWeightKg:18}}))})}}]});};
 const f=await serve(t,{env:aiEnv,fetcher}),lot=published(f,{...draft(),specification:'포장 600x600x900mm',description:'실측 무게 없음'}),client=await f.login(),dest=await address(client);
 const r=await client.post('/api/transport/plan',{selections:[{lotId:lot.id,quantity:2}],destinationToken:dest.token,aiConsent:true});assert.equal(r.status,200);const data=await r.json();
 const cargo=data.groups[0].items[0];assert.deepEqual(cargo.dimensions,{lengthCm:60,widthCm:60,heightCm:90,unitWeightKg:18});assert.equal(cargo.sources.lengthCm,'SPECIFICATION');assert.equal(cargo.sources.unitWeightKg,'AI_ESTIMATE');
 assert.ok(seen);assert.ok(!JSON.stringify(seen).includes('마포구'));assert.ok(!JSON.stringify(seen).includes('테스트기관'));
 assert.equal(f.db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='AI_CORE_MODEL_CALL'").get().n,1);
});
test('타인 주소 토큰·중복물품·수량초과·자기기관·비공개·삭제 보관 물품 차단',async t=>{
 const f=await serve(t),lot=published(f),client=await f.login(),other=await f.login('third@test.local'),dest=await address(client);
 const plan={selections:[{lotId:lot.id,quantity:2}],destinationToken:dest.token};
 assert.equal((await other.post('/api/transport/plan',plan)).status,409);
 assert.equal((await client.post('/api/transport/plan',{...plan,selections:[...plan.selections,...plan.selections]})).status,400);
 assert.equal((await client.post('/api/transport/plan',{...plan,selections:[{lotId:lot.id,quantity:1000}]})).status,409);
 const owner=await f.login('editor@test.local'),ownDest=await address(owner);assert.equal((await owner.post('/api/transport/plan',{...plan,destinationToken:ownDest.token})).status,409);
 f.db.prepare("UPDATE lots SET state='PAUSED' WHERE id=?").run(lot.id);assert.equal((await client.post('/api/transport/plan',plan)).status,404);
 const hidden=svc.saveLot(f.db,f.editor,draft());assert.equal((await client.post('/api/transport/plan',{...plan,selections:[{lotId:hidden,quantity:1}]})).status,404);
});
test('비공개·수량 검증은 외부 AI 호출 전 적용, 비인가·CSRF 접근 차단',async t=>{
 let calls=0;const f=await serve(t,{env:aiEnv,fetcher:async()=>{calls++;throw Error('should not call');}}),privateId=svc.saveLot(f.db,f.editor,draft()),client=await f.login(),dest=await address(client);
 const r=await client.post('/api/transport/plan',{selections:[{lotId:privateId,quantity:1}],destinationToken:dest.token,aiConsent:true});assert.equal(r.status,404);assert.equal(calls,0);
 assert.equal((await fetch(f.base+'/api/transport/status')).status,401);
 assert.equal((await fetch(f.base+'/api/transport/address',{method:'POST',headers:{Cookie:client.headers.Cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({query:'서울 강서구'})})).status,403);
});
test('다른 출발기관은 운송비를 각각 계산해 합산하고, 미확인 품목은 전체금액을 허위확정하지 않음',async t=>{
 const f=await serve(t),a=published(f),b=published({...f,editor:f.buyer,reviewer:f.buyerReviewer},{...draft(),title:'이동식 책상'}),client=await f.login('third@test.local'),dest=await address(client);
 let r=await client.post('/api/transport/plan',{selections:[{lotId:a.id,quantity:2},{lotId:b.id,quantity:2}],destinationToken:dest.token});assert.equal(r.status,200);const both=await r.json();assert.equal(both.groups.length,2);assert.equal(both.totals.estimated,both.groups.reduce((s,g)=>s+g.packing.recommended.estimated,0));
 const unknown=published(f,{...draft(),title:'특수무명설비',description:'',category:'OTHER',originalName:'특수설비'});
 r=await client.post('/api/transport/plan',{selections:[{lotId:unknown.id,quantity:1}],destinationToken:dest.token});const no=await r.json();assert.equal(no.status,'NEEDS_INFO');assert.equal(no.totals,null);assert.ok(no.groups[0].missing.length);
});
test('비동기 모델 계산 중 예약 변동 시 이전 수량의 견적을 응답하지 않음',async t=>{
 let f,lot;
 const fetcher=async(url,opts)=>{const payload=JSON.parse(opts.body),data=JSON.parse(payload.messages[1].content);const req=request(f,lot,10);svc.reserve(f.db,f.editor,req);return Response.json({model:HIVE_MODEL,choices:[{finish_reason:'stop',message:{content:JSON.stringify({items:data.items.map(i=>({id:i.id,dimensions:{lengthCm:60,widthCm:60,heightCm:90,unitWeightKg:8}}))})}}]});};
 f=await serve(t,{env:aiEnv,fetcher});lot=published(f);const client=await f.login(),dest=await address(client);
 const r=await client.post('/api/transport/plan',{selections:[{lotId:lot.id,quantity:15}],destinationToken:dest.token,aiConsent:true});assert.equal(r.status,409);assert.equal((await r.json()).code,'INSUFFICIENT_QUANTITY');
});
test('AI가 알려지지 않은 ID를 반환하면 추정 적용을 거부',async()=>{
 const lot={id:randomUUID(),title:'회의용 의자'},known=knownCargo(lot);
 await assert.rejects(()=>inferCargo({call:async()=>({items:[{id:randomUUID(),dimensions:null}]})},[{lot,known}]),/IDS/);
 assert.equal(transportPlanSchema.safeParse({selections:[{lotId:lot.id,quantity:2001}],destinationToken:randomUUID()}).success,false);
});

test('주소 토큰 만료와 잘못된 직접 좌표 주입을 거부하며 고정 API 호스트만 사용',async t=>{
 const f=await serve(t),lot=published(f),client=await f.login(),dest=await address(client);
 const p={selections:[{lotId:lot.id,quantity:1}],destinationToken:dest.token};
 assert.equal((await client.post('/api/transport/address',{query:'서울 강서구',lat:0,lng:0})).status,400);
 const real=Date.now;try{Date.now=()=>real()+31*60000;assert.equal((await client.post('/api/transport/plan',p)).status,409);}finally{Date.now=real;}
});
test('도로·모델 장애는 안전한 가정으로 전환하고, 중단·보관 물품은 견적 대상에서 제외',async t=>{
 const f=await serve(t,{env:{...exactEnv,...aiEnv},fetcher:async()=>{throw Error('synthetic sensitive upstream text');}}),lot=published(f),client=await f.login(),dest=await address(client,'서울 마포구',true);
 const p={selections:[{lotId:lot.id,quantity:1}],destinationToken:dest.token,aiConsent:true,routeConsent:true};
 let r=await client.post('/api/transport/plan',p);assert.equal(r.status,200);const result=await r.json();assert.equal(result.aiMode,'FALLBACK');assert.equal(result.groups[0].distance.source,'REGION_APPROX');assert.ok(!JSON.stringify(result).includes('sensitive'));
 f.db.prepare('INSERT INTO lot_archives VALUES(?,?,?,?,?,?,NULL,?)').run(lot.id,f.editor.org_id,f.editor.id,'PUBLISHED','test',new Date().toISOString(),randomUUID());
 r=await client.post('/api/transport/plan',p);assert.equal(r.status,404);
});
test('동일 기관·동일 상차 지점 물품은 함께 배치하되 원문 수량·상태·자산을 변경하지 않음',async t=>{
 const f=await serve(t),a=published(f),b=published(f,{...draft(),title:'다른 회의용 의자'}),client=await f.login(),dest=await address(client);
 const r=await client.post('/api/transport/plan',{selections:[{lotId:a.id,quantity:2},{lotId:b.id,quantity:3}],destinationToken:dest.token});assert.equal(r.status,200);const plan=await r.json();
 assert.equal(plan.groups.length,1);assert.equal(plan.groups[0].packing.recommended.totalQuantity,5);assert.equal(plan.groups[0].items.length,2);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM assets').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM requests').get().n,0);
});
