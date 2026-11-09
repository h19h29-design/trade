/** Synthetic test provider only. Not imported by any production route. */
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../../server/db.mjs';
import {seedDemo} from '../../server/seed.mjs';
import {createApp} from '../../server/app.mjs';
export async function startAiTestServer(){
 const dir=mkdtempSync(join(tmpdir(),'trade-ai-core-browser-')),db=openDatabase(join(dir,'trade.sqlite'));await seedDemo(db,dir);
 for(const row of db.prepare("SELECT id,data FROM lots WHERE state='PUBLISHED'").all()){
  const data=JSON.parse(row.data);data.dimensions={lengthCm:50,widthCm:50,heightCm:80,unitWeightKg:8};data.dimensionsConfirmed=true;data.pickupLocation={label:'합성 출발 기관',lat:37.55,lng:126.85,confirmed:true};db.prepare('UPDATE lots SET data=? WHERE id=?').run(JSON.stringify(data),row.id);
 }
 let app;const server=createServer((req,res)=>app(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port,calls={ai:0,catalog:0,route:0};
 const env={RAG_AI_ENABLED:'true',RAG_EXTERNAL_APPROVED:'true',DEEPSEEK_API_KEY:'SYNTHETIC_TEST_ONLY',RAG_MODEL:'test-only-model',AI_CORE_DATA_APPROVED:'true',PROCUREMENT_ENABLED:'true',DATA_GO_KR_SERVICE_KEY:'SYNTHETIC_TEST_ONLY',LOCATION_ENABLED:'true',KAKAO_REST_API_KEY:'SYNTHETIC_TEST_ONLY',ROUTE_ENABLED:'true',KAKAO_MOBILITY_REST_API_KEY:'SYNTHETIC_TEST_ONLY'};
 const json=v=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}});
 const fetcher=async(target,options={})=>{
  const u=new URL(target);
  if(u.hostname==='apis.data.go.kr'){calls.catalog++;return json({response:{header:{resultCode:'00'},body:{items:[{prdctIdntNo:'00001234',krnPrdctNm:'합성 사무용 책상',mnfctCorpNm:'합성제조사',prdctClsfcNoNm:'책상',useYn:'Y'}]}}});}
  if(u.hostname==='dapi.kakao.com')return json({documents:[{address_name:'합성 배송 기관',x:'127.10',y:'37.60'}]});
  if(u.hostname==='apis-navi.kakaomobility.com'){calls.route++;return json({routes:[{result_code:0,summary:{distance:25000,duration:1200}}]});}
  if(u.hostname==='api.deepseek.com'){
   calls.ai++;const payload=JSON.parse(options.body),data=JSON.parse(payload.messages[1].content);let content;
   if(data.sources)content={items:data.sources.map(s=>({id:s.id,text:'등록된 물품 수량과 상태를 비교했습니다. 배송 조건은 제시된 근거를 확인하세요.',sourceIds:s.evidence.slice(0,2).map(e=>e.id)}))};
   else if(data.source)content={manufacturer:'',model:'',descriptionParts:[]};
   else content={terms:['의자','체어']};
   return json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
  }
  throw Error('UNEXPECTED_TEST_NETWORK');
 };
 app=createApp(db,{dataDir:dir,origin:url,demo:true,enhancements:{env,fetcher},rag:{env:{},fetcher}});
 return {url,db,calls,async close(){app.locals.closeRag?.();await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}};
}
