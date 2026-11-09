/** Live, authorization-filtered structured RAG. No persistent private-vector cache. */
export const SCORING_VERSION='ai-core-1.0';
export const WEIGHTS={purpose:45,quantity:20,condition:15,location:10,information:5,shipping:5};
const GROUPS=[['의자','체어','chair','chairs'],['책상','데스크','desk','desks'],['테이블','탁자','table'],['모니터','디스플레이','monitor'],['컴퓨터','pc','데스크톱','computer'],['노트북','랩탑','laptop'],['프린터','인쇄기','printer'],['책장','서가','bookcase'],['수납장','캐비닛','보관함'],['빔프로젝터','프로젝터','영사기'],['접이식','폴딩','folding'],['회의용','회의실','회사용'],['학생용','학생','교실','수업']];
export const DISTRICTS=['강서구','양천구','마포구','강남구','강동구','강북구','관악구','광진구','구로구','금천구','노원구','도봉구','동대문구','동작구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'];
const stop=new Set(['찾아줘','찾아주세요','검색','필요','필요해','필요한','원해','물건','물품','해주세요','있는','정도','쓸','추천','좋은','배송','저렴한','싼','가까운','구해줘','구하려고','찾고','싶어','서울','서울시','구합니다','개','대']);
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase();
const words=s=>(normalize(s).match(/[가-힣a-z0-9]+/g)||[]).map(x=>x.replace(/(으로|에서|까지|처럼|이랑|이나|을|를|은|는|에|로)$/,'')).filter(x=>x.length>1&&!stop.has(x)&&!/^\d+(개|대|만원|원)?$/.test(x)&&!DISTRICTS.includes(x));
const grams=s=>{const v=normalize(s).replace(/\s/g,'');return v.length<2?[v]:Array.from({length:v.length-1},(_,i)=>v.slice(i,i+2));};
export function inferCriteria(query,input={}){
 const quantity=input.quantity??Number(query.match(/(\d[\d,]*)\s*(?:개|대|벌|세트)/)?.[1]?.replaceAll(',','')||1);
 const district=input.district||DISTRICTS.find(d=>query.includes(d))||'';
 const negatives=[...query.matchAll(/([가-힣a-zA-Z0-9]+?)\s*(?:말고|제외|빼고)/g)].map(m=>m[1].toLowerCase()).filter(t=>t.length>1);
 const searchText=query.replace(/([가-힣a-zA-Z0-9]+?)\s*(?:말고|제외|빼고)/g,' ');
 const terms=[...new Set(words(searchText))].slice(0,20);
 return {quantity,district,terms,negatives,searchText,query,allowPartial:input.allowPartial!==false,budget:input.budget??null};
}
export function categoryFor(source){const s=normalize(source);if(/의자|책상|테이블|책장|수납|캐비닛|체어|탁자/.test(s))return 'FURNITURE';if(/모니터|컴퓨터|노트북|프로젝터|tv|텔레비전|프린터/.test(s))return 'ELECTRONICS';return 'OTHER';}
export function queryTerms(criteria,expanded=[]){
 const terms=new Set([...criteria.terms,...expanded.filter(t=>typeof t==='string').flatMap(words)].slice(0,28));
 for(const group of GROUPS)if(group.some(t=>normalize(criteria.searchText||criteria.query).includes(t)||terms.has(t)))group.forEach(t=>terms.add(t));
 return [...terms];
}
function content(lot){return [lot.title,lot.model,lot.manufacturer,lot.classificationName,lot.specification,lot.description,...lot.photos.map(p=>p.productName||'')].join(' ');}
/** BM25-like token score + Korean bigram coverage; keyword vocabulary is expanded, never the data. */
export function retrieve(lots,criteria,expanded=[]){
 const terms=queryTerms(criteria,expanded);if(!terms.length)return [];
 const documents=lots.map(lot=>({lot,text:normalize(content(lot)),tokens:words(content(lot))}));
 const df=new Map(terms.map(t=>[t,documents.filter(d=>d.text.includes(t)).length]));
 return documents.map(doc=>{
  const matches=terms.filter(t=>doc.text.includes(t));
  // Known noun groups are a relevance gate, not a hard requirement for descriptive synonyms.
  const anchors=GROUPS.slice(0,10).filter(g=>g.some(t=>normalize(criteria.searchText||criteria.query).includes(t)));
  const gated=!anchors.length||anchors.some(g=>g.some(t=>doc.text.includes(t)));
  const excluded=(criteria.negatives||[]).some(n=>{const synonyms=GROUPS.find(g=>g.includes(n))||[n];return synonyms.some(t=>doc.text.includes(t));});
  if(!matches.length||!gated||excluded)return null;
  const bm25=matches.reduce((n,t)=>n+Math.log(1+(documents.length+.5)/(df.get(t)+.5))*(normalize(doc.lot.title).includes(t)?2:1),0);
  const originals=criteria.terms.filter(t=>!GROUPS.some(g=>g.includes(t)));
  const core=anchors.length?anchors.filter(g=>g.some(t=>doc.text.includes(t))).length/anchors.length:matches.length/Math.max(terms.length,1);
  const extras=originals.length?originals.reduce((n,t)=>n+(doc.text.includes(t)?1:Math.min(.5,grams(t).filter(g=>doc.text.includes(g)).length/Math.max(grams(t).length,1)*.5)),0)/originals.length:1;
  const relevance=Math.min(1,.75*core+.25*extras);
  return {lot:doc.lot,relevance,bm25,matches};
 }).filter(Boolean).sort((a,b)=>b.bm25-a.bm25||b.relevance-a.relevance||a.lot.id.localeCompare(b.lot.id)).slice(0,40);
}
const rounded=n=>Math.round(n*10)/10;
export function rankCandidate(hit,criteria,delivery={status:'NEEDS_INFO',missing:['출발지·배송지·크기·무게'],binding:false}){
 const l=hit.lot,available=l.available,good=l.groups.filter(g=>g.condition==='GOOD').reduce((n,g)=>n+g.available,0);
 const enough=available>=criteria.quantity;
 const quality=Math.min(good,Math.min(available,criteria.quantity))/Math.max(1,Math.min(available,criteria.quantity));
 const fields=[Boolean(l.model||l.manufacturer),Boolean(l.specification),l.photos.length>0,Boolean(l.pickup),Boolean(l.dimensions&&Object.values(l.dimensions).every(n=>n>0))];
 const location=criteria.district?(l.district===criteria.district?10:2):5;
 const shipping=delivery.status==='ESTIMATED'?(criteria.budget?delivery.high<=criteria.budget?5:delivery.low>criteria.budget?0:2.5:4):1;
 const breakdown=[['purpose','용도 일치',45*hit.relevance],['quantity','수량 충족',20*Math.min(1,available/criteria.quantity)],['condition','등록 상태',15*(.65+.35*quality)],['location','선호 지역',location],['information','정보 충실도',fields.filter(Boolean).length],['shipping','배송 조건',shipping]].map(([key,label,value])=>({key,label,score:rounded(value),max:WEIGHTS[key]}));
 const score=rounded(breakdown.reduce((n,p)=>n+p.score,0));
 const evidence=[],pros=[],cons=[];
 const add=(key,text,side)=>{const e={id:l.id+':'+key,key,text};evidence.push(e);if(side==='pro')pros.push(e);if(side==='con')cons.push(e);};
 add('item',`${l.title} · ${l.manufacturer||'제조사 미기재'} ${l.model||''} · ${l.specification||'규격 미기재'}`);
 add('match','검색어 일치: '+hit.matches.slice(0,8).join(', '),'pro');
 add('quantity',enough?`요청 ${criteria.quantity}개 대비 신청 가능 ${available}개`:`요청 ${criteria.quantity}개보다 ${criteria.quantity-available}개 부족 (신청 가능 ${available}개)`,enough?'pro':'con');
 if(l.groups.every(g=>g.available<criteria.quantity)&&enough)add('split','한 상태 묶음만으로 요청 수량을 채우기 어려워 상태별 신청을 나누어야 합니다.','con');
 add('condition',`등록 상태 기준 양호 ${good}개 · 사용감 ${available-good}개. 현장 확인 전 품질 보장은 아닙니다.`,good>=criteria.quantity?'pro':'con');
 if(l.groups.some(g=>g.available>0&&g.inspection!=='ALL'))add('inspection','표본 검사 또는 검사 범위 미확인 물품이 포함됩니다.','con');
 add('location',`${l.district} · ${l.orgName}${criteria.district?' / 선호 지역 '+criteria.district:''}`,criteria.district&&l.district===criteria.district?'pro':undefined);
 add('pickup',l.pickup||'운반·상하차 조건 미기재',l.pickup?undefined:'con');
 if(l.needsWipe)add('wipe','저장매체 정보삭제 증빙 확인이 필요합니다.','con');
 if(!l.photos.length)add('photo',l.hasCatalogImage?'조달 참고사진만 있으며 실제 상태 사진 확인이 필요합니다.':'현물사진 확인이 필요합니다.','con');
 if(delivery.status==='ESTIMATED'){
  add('shipping',`운반 예상 ${delivery.low.toLocaleString('ko-KR')}~${delivery.high.toLocaleString('ko-KR')}원 · ${delivery.distanceKm}km · ${delivery.trips}회 · ${delivery.sample?'시연용 가정 단가':'등록 단가'} · 확정견적 아님`);
  if(criteria.budget&&delivery.low>criteria.budget)add('budget',`배송 예산 ${criteria.budget.toLocaleString('ko-KR')}원을 초과할 수 있습니다.`,'con');
  if(delivery.trips>1)add('trips',`${delivery.trips}회 운행이 필요한 적재 계산 결과입니다.`,'con');
 }else add('shipping','배송비 확인 필요: '+(delivery.missing||['운반 조건 확인']).join(', '),'con');
 add('delivery-warning','철거·설치·보험·계단·상하차 인력과 화물차 통행 제한은 별도 확인이 필요합니다.','con');
 return {lot:l,score,breakdown,pros,cons,evidence,delivery,sufficient:enough,scoreVersion:SCORING_VERSION,aiExplanation:null};
}
