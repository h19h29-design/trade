import test from 'node:test';
import assert from 'node:assert/strict';
import {packVehicle,packingInputSchema,estimatePacking} from '../server/truck-packing.mjs';
import {DEFAULT_RATE_CARD} from '../server/shipping.mjs';
const box=(patch={})=>({id:'chair',name:'합성 의자',lengthCm:60,widthCm:60,heightCm:90,unitWeightKg:8,quantity:20,rotate:true,stackCount:1,stackIncrementCm:90,stackingConfirmed:false,...patch});
function invariants(packed,items,v){
 assert.equal(packed.feasible,true);const counts=new Map();
 for(const load of packed.loads){assert.ok(load.weightKg<=v.payloadKg+1e-7);let wt=0,count=0;
  for(const p of load.placements){assert.ok(p.x>=0&&p.y>=0&&p.z===0);assert.ok(p.x+p.lengthCm<=v.lengthCm+1e-7);assert.ok(p.y+p.widthCm<=v.widthCm+1e-7);assert.ok(p.heightCm<=v.heightCm+1e-7);wt+=p.weightKg;count+=p.quantity;counts.set(p.itemId,(counts.get(p.itemId)||0)+p.quantity);}
  assert.ok(Math.abs(wt-load.weightKg)<1e-6);assert.equal(count,load.count);
  for(let i=0;i<load.placements.length;i++)for(let j=i+1;j<load.placements.length;j++){const a=load.placements[i],b=load.placements[j];assert.ok(a.x+a.lengthCm<=b.x+1e-7||b.x+b.lengthCm<=a.x+1e-7||a.y+a.widthCm<=b.y+1e-7||b.y+b.widthCm<=a.y+1e-7,'두 물품이 겹침');}
 }
 for(const i of items)assert.equal(counts.get(i.id),i.quantity);
}
test('실제 위치·높이·중량을 계산해 여러 회차에 모든 물품 배치',()=>{const items=[box()];for(const v of DEFAULT_RATE_CARD.vehicles)invariants(packVehicle(items,v),items,v);});
test('혼합 크기 50개 사례에서도 적재함 밖·중복·누락·중량초과 없음',()=>{
 let n=17;const random=()=>{n=(n*48271)%2147483647;return n/2147483647;};
 for(let k=0;k<50;k++){const items=Array.from({length:4},(_,i)=>box({id:'i'+i,lengthCm:20+Math.floor(random()*90),widthCm:20+Math.floor(random()*70),heightCm:30+Math.floor(random()*100),unitWeightKg:5+Math.floor(random()*100),quantity:1+Math.floor(random()*15)}));const v=DEFAULT_RATE_CARD.vehicles[0];invariants(packVehicle(items,v),items,v);}
});
test('회전은 90도 바닥 회전만, 너무 긴·높은·무거운 물품을 거부',()=>{
 const v={...DEFAULT_RATE_CARD.vehicles[0],lengthCm:250,widthCm:150};
 assert.equal(packVehicle([box({lengthCm:140,widthCm:240,quantity:1,rotate:false})],v).feasible,false);
 assert.equal(packVehicle([box({lengthCm:140,widthCm:240,quantity:1})],v).feasible,true);
 for(const patch of [{heightCm:161},{unitWeightKg:1001},{lengthCm:251,widthCm:151}])assert.equal(packVehicle([box({...patch,quantity:1})],v).feasible,false);
});
test('확인된 동일 물품만 쌓고 높이와 중량 한도로 기둥 수량 제한',()=>{
 const items=[box({quantity:25,heightCm:80,stackIncrementCm:30,stackCount:5,stackingConfirmed:true})];const v=DEFAULT_RATE_CARD.vehicles[0];const packed=packVehicle(items,v);
 invariants(packed,items,v);assert.ok(packed.loads.every(l=>l.placements.every(p=>p.quantity<=3)));
 assert.throws(()=>estimatePacking({items:[box({stackCount:3})],distanceKm:20}));
});
test('예시 운임 × 실제 계산 운송횟수 및 VAT, 모든 부적합 차량 명시',()=>{
 const input={items:[box()],distanceKm:20,clearanceCm:2,includeVat:true};const r=estimatePacking(input);
 assert.equal(r.binding,false);assert.equal(r.sample,true);assert.ok(r.options.length>0);
 const o=r.options.find(x=>x.vehicleId==='SMALL');assert.equal(o.breakdown.transport,o.trips*(60000+10*1000));assert.equal(o.breakdown.vat,o.breakdown.transport*.1);
 assert.equal(r.recommended.estimated,Math.min(...r.options.map(x=>x.estimated)));
 const none=estimatePacking({items:[box({lengthCm:1900,widthCm:1900,quantity:1})],distanceKm:20});assert.equal(none.options.length,0);assert.equal(none.rejected.length,3);
});
test('계산 한도·0·음수·중복ID 검증 및 대량 계획의 미리보기 절삭은 비용에 영향 없음',()=>{
 for(const patch of [{quantity:0},{heightCm:0},{lengthCm:-1},{unitWeightKg:NaN}])assert.equal(packingInputSchema.safeParse({items:[box(patch)],distanceKm:20}).success,false);
 assert.throws(()=>estimatePacking({items:[box(),box()],distanceKm:20}));
 assert.throws(()=>estimatePacking({items:[box({quantity:2001})],distanceKm:20}));
 const r=estimatePacking({items:[box({quantity:500})],distanceKm:20});assert.equal(r.recommended.totalQuantity,500);assert.ok(r.recommended.trips>8);assert.equal(r.recommended.loads.length,8);assert.equal(r.recommended.previewTruncated,true);
});
