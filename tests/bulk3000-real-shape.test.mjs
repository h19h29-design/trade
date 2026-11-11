import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {fixture} from './helpers.mjs';
import {parseWorkbook,parseWorkbookIsolated} from '../server/excel-parser.mjs';
import {storeImport,loadImport,previewImport,confirmImport} from '../server/excel-import.mjs';
import {preparePreview,confirmPreview} from '../server/ai-core/preview-registration.mjs';

const headers=['연번','물품고유번호\n(물품대장)','고유번호\n(스티커)','물품조직명','G2B목록번호','G2B물품분류명',
 'G2B목록명','취득일자','정리일자','최초취득금액','수량','취득금액','취득구분','내용연수','사용기간\n(2026.10.20.기준)','내용연수\n만료일'];
function workbook(n=2194){
 const rows=[['관리전환 소요조회 대상 목록'],headers];
 for(let i=0;i<n;i++){
  const repeated=i>=1902;
  const externalId='M'+String(repeated?(i-1902)%249:i).padStart(9,'0');
  const dept=repeated?'다른부서 '+Math.floor((i-1902)/249):'기획조정실 부서 '+i;
  rows.push([i+1,externalId,1000+i,dept,'56101542-22084739','접이식의자','접이식의자, 합성회사, ES708, 510×530×820mm', '20200320','20200320',85458,1,85458,'조달구입',9,'6년7개월',47197]);
 }
 rows.push(['합계',null,null,null,null,null,null,null,null,null,n,n*85458]);
 const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet(rows),'Sheet1');
 return Buffer.from(XLSX.write(w,{bookType:'xlsx',type:'buffer'}));
}
function makeBatch(f,n=2194){
 const bytes=workbook(n),parsed=parseWorkbook(bytes),wb={...parsed,inputFormat:'XLSX',conversion:{state:'READY'}};
 const batchId=storeImport(f.db,f.editor,'합성_2194양식.xlsx',bytes,wb);
 return {bytes,batchId,parsed,plan:previewImport(loadImport(f.db,f.editor,batchId),{
  sheet:'Sheet1',headerRow:parsed.sheets[0].suggestedHeader,mapping:parsed.sheets[0].mapping,groupIdentical:false,department:''})};
}
test('첨부물과 동일 머리글·합계행: 2,194개 정확히 읽고 중복 249종은 대장 연결 유보',async()=>{
 const f=fixture();
 try{
  const {batchId,parsed,plan,bytes}=makeBatch(f);
  assert.equal(parsed.sheets[0].suggestedHeader,2);
  for(const key of ['originalName','externalId','department','listingNo','classificationName','quantity','acquiredDate','acquiredPrice','stickerId','initialAcquiredAmount'])assert.ok(Number.isInteger(parsed.sheets[0].mapping[key]),key);
  assert.equal(plan.rows.length,2194);assert.equal(plan.skipped,1);assert.equal(plan.totalQuantity,2194);
  assert.equal(plan.errors.length,0,JSON.stringify(plan.errors.slice(0,4)));
  assert.ok(plan.warnings.some(w=>w.includes('반복된 자산번호'))); // distinct departments: preserve IDs, no unsafe ledger link
  assert.equal(plan.rows.filter(r=>r.assetLinkPending).length,541);
  assert.equal(plan.rows[0].externalId,'M000000000');
  assert.equal(plan.rows.at(-1).rowNumber,2196);
  const parsedIsolated=await parseWorkbookIsolated(bytes);assert.equal(parsedIsolated.sheets[0].rows.length,2197);
  const prepared=preparePreview(f.db,f.editor,batchId);
  assert.equal(prepared.total,2194);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM lots').get().n,0);
  const completed=confirmPreview(f.db,f.editor,batchId,{version:prepared.version,confirmed:true});
  assert.equal(completed.receipt.lotCount,2194);
  assert.equal(completed.receipt.totalQuantity,2194);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM lots').get().n,2194);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM assets').get().n,1653);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM imported_rows').get().n,2194);
  const snapshot=f.db.prepare('SELECT source_snapshot FROM lots LIMIT 1').get();
  assert.ok(JSON.parse(snapshot.source_snapshot).originalRows[0].externalId);
  const once=confirmPreview(f.db,f.editor,batchId,{version:prepared.version,confirmed:true});
  assert.equal(once.receipt.lotCount,2194);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM lots').get().n,2194);
 }finally{f.db.close();}
});
test('3,000개까지 지원하고 3,001개는 일부만 자르지 않고 명확히 거부',()=>{
 const f=fixture();
 try{
  const good=makeBatch(f,3000);
  assert.equal(good.plan.rows.length,3000);
  assert.equal(good.plan.errors.length,0);
  const bad=makeBatch(f,3001);
  assert.ok(bad.plan.errors.some(e=>e.messages.some(m=>m.includes('3,000'))));
 }finally{f.db.close();}
});
