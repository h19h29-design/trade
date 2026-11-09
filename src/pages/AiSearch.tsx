import {useEffect,useRef,useState} from 'react';
import {Search,Sparkles,Truck,ArrowUpRight,Package,CheckCircle2,TriangleAlert,X} from 'lucide-react';
import {api} from '../api';
import {useResource} from '../context';
import {Field,Notice,ErrorBox} from '../components/UI';
import LocationField from '../features/ai-core/LocationField';
import type {CoreStatus,Location,Recommendation,SearchResult} from '../features/ai-core/types';
const DISTRICTS=['강서구','양천구','마포구','강남구','강동구','강북구','관악구','광진구','구로구','금천구','노원구','도봉구','동대문구','동작구','서대문구','서초구','성동구','성북구','송파구','영등포구','용산구','은평구','종로구','중구','중랑구'];
const examples=['강서구에서 쓸 회의용 의자 20개 찾아줘','도서관에 필요한 책장 3개','업무용 모니터 5대가 필요해'];
const money=(n?:number)=>n===undefined?'미산정':n.toLocaleString('ko-KR')+'원';
function ResultCard({item,index}:{item:Recommendation;index:number}){
 const l=item.lot,d=item.delivery;
 return <article className="ai-result-card" data-testid="ai-result">
  <div className="ai-result-media">{l.photos[0]?<img src={'/api/files/'+l.photos[0].id} alt={l.title} loading="lazy"/>:l.hasCatalogImage?<><img src={'/api/lots/'+l.id+'/catalog-image'} alt={l.title+' 참고사진'} loading="lazy"/><small>조달 참고사진 · 현물 아님</small></>:<div><Package size={42}/><span>현물사진 확인 필요</span></div>}</div>
  <div className="ai-result-main"><div className="ai-result-heading"><div><span className="ai-result-rank">추천 {index+1}</span><h2><a href={'#/lots/'+l.id}>{l.title}</a></h2><p>{l.orgName} · {l.district} · 신청 가능 {l.available}개</p></div><div className="ai-score"><strong>{item.score}</strong><span>/ 100 참고점수</span></div></div>
  {item.aiExplanation?<div className="ai-generated-summary"><Sparkles size={17}/><p>{item.aiExplanation.text}</p><small>AI 비교 설명 · 등록정보 대조 필요</small></div>:null}
  <div className="ai-procon"><div><h3><CheckCircle2 size={17}/>맞는 점</h3>{item.pros.slice(0,3).map(e=><p key={e.id}>{e.text}</p>)}</div><div><h3><TriangleAlert size={17}/>확인할 점</h3>{item.cons.slice(0,4).map(e=><p key={e.id}>{e.text}</p>)}</div></div>
  <div className="ai-delivery"><Truck size={22}/><div><b>{d.status==='ESTIMATED'?money(d.low)+' ~ '+money(d.high):'배송비 확인 필요'}</b><p>{d.status==='ESTIMATED'?`${d.distanceKm}km · ${d.trips}회 · ${d.vehicle} · ${d.sample?'예시 단가':'등록 단가'} / 확정 견적 아님`:(d.missing||[]).join(' · ')}</p></div><a className="text-button" href={'#/shipping/'+l.id}>조건 상세 계산</a></div>
  <details className="ai-evidence"><summary>점수 기준·등록 근거 보기</summary><div className="ai-score-parts">{item.breakdown.map(p=><div key={p.key}><span>{p.label}</span><progress max={p.max} value={p.score}/><b>{p.score}/{p.max}</b></div>)}</div>{item.evidence.map(e=><p key={e.id}>{e.text}</p>)}{d.assumptions?.map((a,i)=><p className="fineprint" key={i}>{a}</p>)}</details>
  <div className="actions"><a href={'#/lots/'+l.id} className="button primary compact">물품 확인·신청 <ArrowUpRight size={17}/></a><span className="fineprint">신청 시 현재 수량을 다시 확인합니다.</span></div></div>
 </article>;
}
export default function AiSearch(){
 const {data:status,error:statusError}=useResource<CoreStatus>('/ai-core/status');
 const [query,setQuery]=useState(''),[quantity,setQuantity]=useState(''),[district,setDistrict]=useState(''),[budget,setBudget]=useState(''),[destination,setDestination]=useState<Location|null>(null),[consent,setConsent]=useState(false),[routeConsent,setRouteConsent]=useState(false),[partial,setPartial]=useState(true),[handling,setHandling]=useState(false),[stairs,setStairs]=useState(0),[helper,setHelper]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<SearchResult|null>(null);
 const abort=useRef<AbortController|null>(null),sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;abort.current?.abort();},[]);
 async function search(text=query){if(busy||text.trim().length<2)return;const seq=++sequence.current;const controller=new AbortController();abort.current=controller;setQuery(text);setBusy(true);setError('');setResult(null);
  try{const data=await api<SearchResult>('/ai-core/search',{method:'POST',signal:controller.signal,body:JSON.stringify({query:text,...(quantity?{quantity:Number(quantity)}:{}),...(district?{district}:{}),...(budget?{budget:Number(budget)}:{}),...(destination?{destination}:{}),routeConsent,consent,useAi:true,allowPartial:partial,handling,stairsFloors:stairs,helperHours:helper})});if(seq===sequence.current)setResult(data);}
  catch(e){if(seq===sequence.current)setError(e instanceof Error&&e.name!=='AbortError'?e.message:'검색을 중단했습니다.');}finally{if(seq===sequence.current)setBusy(false);}
 }
 function stop(){sequence.current++;abort.current?.abort();setBusy(false);setError('화면의 검색 대기를 중단했습니다. 이미 시작된 외부 요청은 서버에서 종료될 수 있습니다.');}
 return <div className="ai-core-page"><header className="ai-search-heading"><h1>AI 물품검색</h1><p>필요한 물건을 말해 주세요.<br/>우리 기관에 맞는 물품을 찾아, 상태와 운반 조건까지 비교합니다.</p></header>
 <form className="ai-search-form" onSubmit={e=>{e.preventDefault();void search();}}><label className="sr-only" htmlFor="ai-query">찾는 물품과 사용 조건</label><textarea id="ai-query" value={query} maxLength={800} onChange={e=>setQuery(e.target.value)} placeholder="예: 강서구에서 회의용 의자 20개가 필요해. 배송 조건까지 비교해 줘." rows={3} disabled={busy}/>
 <div className="ai-search-actions"><span><Sparkles size={17}/>{status?.aiConfigured?'기존 AI 연결 사용':'등록정보 기반 검색 사용 가능'}</span>{busy?<button className="button secondary" type="button" onClick={stop}><X size={16}/>중단</button>:null}<button className="button primary" disabled={busy||query.trim().length<2}><Search size={19}/>{busy?'물품 비교 중…':'조건에 맞게 찾아줘'}</button></div></form>
 <div className="ai-search-examples" aria-label="검색 예시">{examples.map(text=><button type="button" key={text} disabled={busy} onClick={()=>void search(text)}>{text}</button>)}</div>
 <div className="ai-consent"><label className="check"><input type="checkbox" checked={consent} disabled={busy||!status?.aiConfigured} onChange={e=>setConsent(e.target.checked)}/>검색 문장과 공개 물품의 최소 정보를 AI로 전송해 의도 분석·비교 설명을 받습니다.</label><small>{status?.aiConfigured?'가격·수량·추천 점수는 서버 검증 결과를 사용합니다.':'AI 설정 전에도 동의어 검색·점수·배송 조건 비교는 작동합니다. 가짜 AI 답변은 만들지 않습니다.'}</small></div>
 <details className="ai-search-options"><summary>수량·지역·배송 조건 자세히 설정</summary><div className="form-grid"><Field label="필요 수량" help="비우면 검색 문장에서 찾습니다."><input type="number" min={1} max={100000} value={quantity} disabled={busy} onChange={e=>setQuantity(e.target.value)}/></Field><Field label="선호 지역"><select value={district} disabled={busy} onChange={e=>setDistrict(e.target.value)}><option value="">문장에서 찾기 / 서울 전체</option>{DISTRICTS.map(d=><option key={d}>{d}</option>)}</select></Field><Field label="배송비 예산 (원)"><input type="number" min={1} max={10000000} value={budget} disabled={busy} onChange={e=>setBudget(e.target.value)}/></Field><Field label="추가 인력 작업시간"><input type="number" min={0} max={48} value={helper} disabled={busy} onChange={e=>setHelper(Number(e.target.value))}/></Field><Field label="계단 운반 층수"><input type="number" min={0} max={50} value={stairs} disabled={busy} onChange={e=>setStairs(Number(e.target.value))}/></Field></div>
 <label className="check"><input type="checkbox" checked={partial} disabled={busy} onChange={e=>setPartial(e.target.checked)}/>수량이 부족한 후보도 부족 수량을 밝혀서 보여주기</label><label className="check"><input type="checkbox" checked={handling} disabled={busy} onChange={e=>setHandling(e.target.checked)}/>상하차 비용 가정 포함</label>
 <LocationField label="받는 기관 배송지" configured={!!status?.providers.location.configured} value={destination} onChange={setDestination} disabled={busy}/><label className="check"><input type="checkbox" checked={routeConsent} disabled={busy||!status?.providers.route.configured} onChange={e=>setRouteConsent(e.target.checked)}/>출발·도착 좌표를 경로 API로 전송해 도로 거리를 조회합니다.</label><p className="fineprint">도로 API 미사용 시 좌표 직선거리 × 1.3 추정입니다. 크기·무게·출발 위치가 없으면 금액을 산정하지 않습니다.</p></details>
 {statusError?<Notice tone="warning">연결 상태를 확인하지 못했습니다. {statusError}</Notice>:null}{error?<ErrorBox message={error}/>:null}
 {busy?<div className="ai-search-loading" role="status"><Sparkles className="spin"/>게시된 물품과 최신 수량, 운반 조건을 확인하고 있습니다.</div>:null}
 {result?<section aria-live="polite" className="ai-search-results"><div className="ai-results-title"><h2>조건에 맞는 후보 {result.results.length}건</h2><span>{result.mode==='AI_ASSISTED_RAG'?'AI 의도 분석·근거 비교':'등록정보 기반 추천'} · 요청 {result.criteria.quantity}개</span></div>{result.notes.map((note,i)=><p className="fineprint" key={i}>{note}</p>)}{result.results.length?result.results.map((item,index)=><ResultCard key={item.lot.id} item={item} index={index}/>):<Notice>현재 공개·인계 가능한 물품에서 적절한 후보를 찾지 못했습니다. 품명이나 조건을 바꾸어 다시 검색해 주세요. 존재하지 않는 물품을 만들어 보여주지 않습니다.</Notice>}<p className="fineprint">{result.disclaimer} · {new Date(result.checkedAt).toLocaleString('ko-KR')} 기준</p></section>:<div className="ai-search-guide"><h2>필요한 조건만 알려 주세요</h2><p>용도와 수량을 먼저 비교하고, 상태·지역·배송 정보를 함께 보여드립니다. 실제 현물정보가 부족하면 무엇을 확인해야 하는지도 알려드립니다.</p><a href="#/market" className="text-button">전체 물품을 직접 둘러보기 <ArrowUpRight size={17}/></a></div>}
 </div>;
}
