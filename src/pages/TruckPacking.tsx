import {useEffect,useRef,useState} from 'react';
import {Truck,Plus,Trash2} from 'lucide-react';
import {api} from '../api';
import {useResource} from '../context';
import {PageHead,ErrorBox,Loading} from '../components/UI';
import type {Lot} from '../types';
import PackingDiagram,{type Load,type Vehicle} from '../features/packing/PackingDiagram';
interface Cargo {id:string;name:string;lengthCm:number;widthCm:number;heightCm:number;unitWeightKg:number;quantity:number;rotate:boolean;stackCount:number;stackIncrementCm:number;stackingConfirmed:boolean}
interface Option {vehicleId:string;vehicle:string;vehicleSize:Vehicle;trips:number;estimated:number;low:number;high:number;loads:Load[];totalWeightKg:number;totalQuantity:number;previewTruncated:boolean;breakdown:{transport:number;handling:number;helpers:number;stairs:number;vat:number}}
interface Result {status:string;sample:boolean;binding:false;rateLabel:string;options:Option[];recommended:Option|null;rejected:{vehicleId:string;vehicle:string;reasons:string[]}[];assumptions:string[]}
const blank=(index=1):Cargo=>({id:crypto.randomUUID(),name:'물품 '+index,lengthCm:60,widthCm:60,heightCm:90,unitWeightKg:8,quantity:20,rotate:true,stackCount:1,stackIncrementCm:90,stackingConfirmed:false});
const won=(n:number)=>n.toLocaleString('ko-KR')+'원';
function Planner({lot}:{lot?:Lot}){
 const [items,setItems]=useState<Cargo[]>(()=>lot?[{...blank(),name:lot.title,...{lengthCm:0,widthCm:0,heightCm:0,unitWeightKg:0},...lot.dimensions,quantity:Math.max(1,Math.min(2000,lot.available||lot.data?.actualCount||1))}]:[blank()]);
 const [distance,setDistance]=useState(20),[gap,setGap]=useState(2),[handling,setHandling]=useState(false),[helper,setHelper]=useState(0),[stairs,setStairs]=useState(0),[result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(''),[trip,setTrip]=useState(0);
 const seq=useRef(0);
 useEffect(()=>{const token=++seq.current,ctl=new AbortController();setBusy(true);setError('');setResult(null);
  const timer=setTimeout(async()=>{try{
   if(!items.length||items.some(i=>[i.lengthCm,i.widthCm,i.heightCm,i.unitWeightKg,i.quantity].some(n=>!Number.isFinite(n)||n<=0))||distance<=0)throw Error('가로·세로·높이·무게·수량과 거리를 입력하세요.');
   const r=await api<Result>('/shipping/packing',{method:'POST',signal:ctl.signal,body:JSON.stringify({items,distanceKm:distance,clearanceCm:gap,handling,helperHours:helper,stairsFloors:stairs,includeVat:true})});
   if(token===seq.current){setResult(r);setSelected(s=>r.options.some(o=>o.vehicleId===s)?s:r.recommended?.vehicleId||'');setTrip(0);}
  }catch(e){if(token===seq.current&&!ctl.signal.aborted)setError(e instanceof Error?e.message:'계산하지 못했습니다.');}finally{if(token===seq.current)setBusy(false);}},500);
  return()=>{clearTimeout(timer);ctl.abort();};
 },[items,distance,gap,handling,helper,stairs]);
 const chosen=result?.options.find(o=>o.vehicleId===selected)||result?.recommended;
 const update=(index:number,patch:Partial<Cargo>)=>setItems(old=>old.map((i,n)=>n===index?{...i,...patch}:i));
 return <><PageHead title="트럭 적재·배송비" description="물품 크기를 넣으면 배치·운송횟수·예상 비용을 자동 계산합니다." back={lot?'/lots/'+lot.id:'/ai-search'}/>
 <p className="packing-notice">{lot?'등록된 규격을 확인해 주세요.':'첫 행은 의자 크기 예시입니다. 실제 포장 크기로 바꿔 주세요.'} 운임·차량규격은 예시이며 확정 견적이 아닙니다.</p>
 <section className="packing-inputs"><div className="section-header"><h2>보낼 물품</h2><button type="button" className="button secondary compact" disabled={items.length>=12} onClick={()=>setItems([...items,{...blank(items.length+1),quantity:1}])}><Plus size={16}/>물품 추가</button></div>
 {items.map((i,index)=><div className="packing-item" key={i.id}><div className="packing-item-top"><label>물품 이름<input value={i.name} maxLength={100} onChange={e=>update(index,{name:e.target.value})}/></label>{items.length>1?<button className="text-button" aria-label={i.name+' 삭제'} onClick={()=>setItems(items.filter((_,n)=>n!==index))}><Trash2 size={17}/></button>:null}</div>
 <div className="packing-dimensions">{([['lengthCm','가로 (cm)'],['widthCm','세로 (cm)'],['heightCm','높이 (cm)'],['unitWeightKg','개당 무게 (kg)'],['quantity','수량']] as const).map(([k,label])=><label key={k}>{label}<input type="number" min={k==='unitWeightKg'?.1:1} max={k==='unitWeightKg'?10000:2000} step={k==='quantity'?1:.1} value={i[k]} onChange={e=>update(index,{[k]:Number(e.target.value)})}/></label>)}</div>
 <details><summary>회전·쌓기 설정</summary><label className="check"><input type="checkbox" checked={i.rotate} onChange={e=>update(index,{rotate:e.target.checked})}/>바닥에서 90도 회전 가능 (기울이지 않음)</label><label className="check"><input type="checkbox" checked={i.stackingConfirmed} onChange={e=>update(index,{stackingConfirmed:e.target.checked,stackCount:e.target.checked?2:1,stackIncrementCm:Math.min(i.stackIncrementCm,i.heightCm)})}/>같은 물품을 쌓아도 안전함을 확인했습니다.</label>{i.stackingConfirmed?<div className="form-grid"><label>한 기둥 최대 개수<input type="number" min={1} max={30} value={i.stackCount} onChange={e=>update(index,{stackCount:Number(e.target.value)})}/></label><label>한 개 추가 시 높이 (cm)<input type="number" min={.1} max={i.heightCm} step={.1} value={i.stackIncrementCm} onChange={e=>update(index,{stackIncrementCm:Number(e.target.value)})}/></label></div>:null}</details></div>)}
 <div className="packing-route"><label>편도 거리 (km)<input type="number" min={1} max={2000} value={distance} onChange={e=>setDistance(Number(e.target.value))}/></label><label>물품 사이 여유 (cm)<input type="number" min={0} max={20} value={gap} onChange={e=>setGap(Number(e.target.value))}/></label><label className="check"><input type="checkbox" checked={handling} onChange={e=>setHandling(e.target.checked)}/>상하차 비용 포함</label></div>
 <details><summary>추가 인력·계단 비용</summary><div className="form-grid"><label>인력 작업시간<input type="number" min={0} max={48} value={helper} onChange={e=>setHelper(Number(e.target.value))}/></label><label>계단 운반 층수<input type="number" min={0} max={50} value={stairs} onChange={e=>setStairs(Number(e.target.value))}/></label></div></details></section>
 {error?<ErrorBox message={error}/>:null}{busy?<p role="status">트럭에 배치하는 중…</p>:null}
 {result?<section className="packing-results"><h2>차량별 비교</h2><div className="packing-options">{result.options.map(o=><button key={o.vehicleId} className={'packing-option '+(chosen?.vehicleId===o.vehicleId?'selected':'')} onClick={()=>{setSelected(o.vehicleId);setTrip(0);}}><Truck size={25}/><strong>{o.vehicle}</strong><span>{o.trips}회 운송 · {o.totalQuantity}개</span><b>{won(o.estimated)}</b><small>{o.vehicleSize.lengthCm}×{o.vehicleSize.widthCm}×{o.vehicleSize.heightCm}cm / {o.vehicleSize.payloadKg}kg</small>{result.recommended?.vehicleId===o.vehicleId?<em>계산상 최저 예시 비용</em>:null}</button>)}</div>
 {!result.options.length?<p role="alert">이 물품을 실을 수 있는 예시 차량이 없습니다. 규격 또는 전문 운송을 확인하세요.</p>:null}
 {chosen?<><div className="packing-total"><strong>예상 {won(chosen.low)} ~ {won(chosen.high)}</strong><small>부가세 포함 · 예시 운임 · 편도 {chosen.trips}회</small></div><div className="packing-trip-picker">{chosen.loads.map((l,n)=><button key={n} className={'button compact '+(trip===n?'primary':'secondary')} onClick={()=>setTrip(n)}>{l.trip}회차 ({l.count}개)</button>)}</div>{chosen.loads[trip]?<PackingDiagram load={chosen.loads[trip]} vehicle={chosen.vehicleSize}/>:null}{chosen.previewTruncated?<small>첫 8회차를 그렸습니다. 비용은 전체 {chosen.trips}회차 기준입니다.</small>:null}<details><summary>비용·계산 가정 보기</summary><p>기본·거리 운임 {won(chosen.breakdown.transport)} / 상하차 {won(chosen.breakdown.handling)} / 인력 {won(chosen.breakdown.helpers)} / 계단 {won(chosen.breakdown.stairs)} / 부가세 {won(chosen.breakdown.vat)}</p>{result.assumptions.map((a,i)=><p key={i}>{a}</p>)}</details></>:null}
 {result.rejected.length?<details><summary>적재가 어려운 차량 {result.rejected.length}종</summary>{result.rejected.map(r=><p key={r.vehicleId}>{r.vehicle}: {r.reasons.join(' ')}</p>)}</details>:null}</section>:null}</>;
}
function WithLot({id}:{id:string}){const {data,error,loading,reload}=useResource<Lot>('/lots/'+id);if(loading)return <Loading/>;if(error||!data)return <ErrorBox message={error} retry={reload}/>;return <Planner key={data.id} lot={data}/>;}
export default function TruckPacking({id}:{id?:string}){return id?<WithLot id={id}/>:<Planner/>;}
