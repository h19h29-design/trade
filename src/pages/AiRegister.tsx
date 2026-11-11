import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,Pencil,RefreshCw,Package} from 'lucide-react';
import {api,post} from '../api';
import {useResource} from '../context';
import {PageHead,ErrorBox} from '../components/UI';
import DropArea from '../components/DropArea';
import ExcelImport from '../features/ExcelImport';
import type {CoreStatus} from '../features/ai-core/types';
interface Source {id:string;name:string;conversion?:{state:string;message?:string;method?:string}}
type Fields={title:string;manufacturer:string;model:string;specification:string;description:string;department:string};
interface Item {key:string;quantity:number;listingNo:string;fields:Fields;originalRows:{row:number;name:string;quantity:number;condition:string;acquiredUnitPrice:string}[];enriched:boolean;notes:string[];provenance:Record<string,string>;referencePhoto:{label:string;sourceUrl:string}|null;useReferencePhoto:boolean}
interface Receipt {lotIds:string[];lotCount:number;rows:number;totalQuantity:number;scope:string}
interface Preview {id:string;name:string;version:number;state:'PREVIEW'|'COMPLETE';receipt:Receipt;total:number;quantity:number;enriched:number;items:Item[];offset:number;nextOffset:number|null}
export default function AiRegister({resumeId}:{resumeId?:string}){
 const {data:status}=useResource<CoreStatus>('/ai-core/status');
 const [source,setSource]=useState<Source|null>(null),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[phase,setPhase]=useState(''),[error,setError]=useState(''),[consent,setConsent]=useState(false),[department,setDepartment]=useState(''),[progress,setProgress]=useState(0),[manual,setManual]=useState(false),[editing,setEditing]=useState(''),[fields,setFields]=useState<Fields|null>(null);
 const lock=useRef(false),stop=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;stop.current=true;};},[]);
 async function read(id:string,offset=0){const p=await api<Preview>('/registration-preview/'+id+'?offset='+offset);if(alive.current)setPreview(p);return p;}
 async function run(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;stop.current=false;setBusy(true);setError('');try{await fn();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'처리하지 못했습니다. 원본은 보존됩니다.');}finally{lock.current=false;if(alive.current){setBusy(false);setPhase('');}}}
 async function enrich(id:string,total:number,force=false,start=0){
  if(!status?.providers.procurement.configured&&!(status?.aiConfigured&&consent)){await read(id,preview?.offset||0);return;}
  // Large official lists must remain usable without thousands of blocking network requests.
  const end=Math.min(total,start+50);
  setPhase(total>50?'제품정보 50건씩 보완 중':'제품정보 확인 중');setProgress(start);
  for(let i=start;i<end&&!stop.current&&alive.current;i++){
   const r=await post<{done:boolean;nextCursor:number}>('/registration-preview/'+id+'/enrich',{cursor:i,useAi:true,consent,force});setProgress(r.nextCursor);if(r.done)break;
  }
  if(alive.current)await read(id,preview?.offset||0);
 }
 async function prepare(s:Source){setPhase('원본 표 분석 중');const p=await post<Preview>('/registration-preview/'+s.id+'/prepare',{department});setPreview(p);setManual(false);if(p.state==='PREVIEW'&&p.total<=50)await enrich(s.id,p.total);}
 useEffect(()=>{if(!resumeId)return;void run(async()=>{
  setSource({id:resumeId,name:'저장한 파일'});
  try{await read(resumeId);}catch(e){const original=await api<Source>('/ai-core/register/'+resumeId+'/status');setSource(original);await prepare(original);}
 });},[resumeId]);
 function upload(file:File){void run(async()=>{
  if(!/\.(ozd|xlsx|xls)$/i.test(file.name)||file.size>8388608)throw Error('8MB 이하 OZD·엑셀 파일을 선택하세요.');
  setPhase('파일 분석 중');setEditing('');setPreview(null);setSource(null);setManual(false);
  const form=new FormData();form.set('file',file);const s=await api<Source>('/imports/documents',{method:'POST',body:form});setSource(s);
  if(s.conversion?.state==='WAITING'){setManual(true);throw Error(s.conversion.message||'지원 양식을 확인하세요.');}
  try{await prepare(s);}catch(e){setManual(true);throw e;}
 });}
 async function save(item:Item){if(!preview||!fields)return;await run(async()=>{
  const changed=Object.fromEntries(Object.entries(fields).filter(([k,v])=>v!==item.fields[k as keyof Fields]));
  if(Object.keys(changed).length)setPreview(await api<Preview>('/registration-preview/'+preview.id+'/items/'+item.key,{method:'PATCH',body:JSON.stringify({version:preview.version,fields:changed})}));
  setEditing('');setFields(null);
 });}
 async function selectPhoto(item:Item,checked:boolean){if(!preview)return;await run(async()=>setPreview(await api<Preview>('/registration-preview/'+preview.id+'/items/'+item.key,{method:'PATCH',body:JSON.stringify({version:preview.version,fields:{useReferencePhoto:checked}})})));}
 async function confirm(){if(!preview)return;await run(async()=>{setPhase('확인한 물품 등록 중');await post('/registration-preview/'+preview.id+'/confirm',{version:preview.version,confirmed:true});await read(preview.id);});}
 const complete=preview?.state==='COMPLETE';
 return <div className="register-flow"><PageHead title="AI 물품등록" description="파일을 올리고, 필요한 부분만 고친 뒤 등록하세요."/>
 <ol className="registration-steps" aria-label="등록 진행"><li className={!preview?'active':'done'}>1 파일 분석</li><li className={preview&&!complete?'active':complete?'done':''}>2 담당자 확인</li><li className={complete?'active':''}>3 등록 완료</li></ol>
 {!preview?<><DropArea testId="ai-document-upload" accept=".ozd,.xlsx,.xls" disabled={busy} title="OZD·엑셀 파일을 끌어다 놓으세요" description="8MB 이하 · 엑셀 최대 3,000행" buttonLabel="파일 선택" onFiles={files=>upload(files[0])}/>
 <details className="registration-settings"><summary>분석 설정</summary><label>기본 보관 부서<input value={department} maxLength={100} onChange={e=>setDepartment(e.target.value)} disabled={busy}/></label><label className="check"><input type="checkbox" disabled={busy||!status?.aiConfigured} checked={consent} onChange={e=>setConsent(e.target.checked)}/>제품정보를 외부 AI로 보내 원문 기반 보완</label><small>조달청 {status?.providers.procurement.configured?'연결됨':'미연결'} · AI {status?.aiConfigured?'연결됨':'미연결'}</small></details></>:null}
 {error?<ErrorBox message={error}/>:null}
 {busy?<div className="registration-progress" role="status"><strong>{phase||'처리 중'}</strong>{preview?<><progress value={progress} max={preview.total}/><span>{progress}/{preview.total}묶음</span><button className="text-button" type="button" onClick={()=>{stop.current=true;}}>현재 항목 후 중단</button></>:null}</div>:null}
 {preview&&!complete?<>
 <header className="registration-summary"><div><span className="status-pending">아직 등록되지 않았습니다</span><h2>분석 완료 · {preview.total}묶음 / {preview.quantity}개</h2><p>{preview.name}</p></div><button type="button" className="button secondary compact" disabled={busy||!!editing} onClick={()=>void run(()=>enrich(preview.id,preview.total,preview.enriched>=preview.total,preview.enriched>=preview.total?preview.offset:preview.enriched))}><RefreshCw size={16}/>{preview.total>50?(preview.enriched>=preview.total?'현재 40건 다시 확인':`추가 정보 보완 · ${preview.enriched}/${preview.total} (50건씩)`):'제품정보 확인'}</button></header>
 <div className="registration-cards">{preview.items.map(item=><article key={item.key} className="registration-card">
 <div className="registration-photo">{item.referencePhoto?<><img src={'/api/registration-preview/'+preview.id+'/items/'+item.key+'/reference'} alt={item.fields.title+' 제품 참고사진'}/><small>제품 참고사진 · 현물 아님</small></>:<><Package size={32}/><small>현물사진 등록 후 첨부</small></>}</div>
 <div className="registration-content"><div className="registration-item-title"><h3>{item.fields.title}</h3><strong>{item.quantity}개</strong></div><p>{item.fields.manufacturer||'제조사 미기재'} · {item.fields.model||'모델 미기재'}</p><p>{item.fields.specification||'규격 미기재'}</p>
 <div className="registration-card-actions"><button className="button secondary compact" disabled={busy} onClick={()=>{setEditing(editing===item.key?'':item.key);setFields({...item.fields});}}><Pencil size={15}/>필요한 항목 수정</button><a className="text-button" target="_blank" rel="noopener noreferrer" href={'https://www.google.com/search?tbm=isch&q='+encodeURIComponent([item.fields.title,item.fields.manufacturer,item.fields.model].filter(Boolean).join(' '))}>제품 사진 찾아보기</a></div>
 {item.referencePhoto?<label className="check"><input type="checkbox" disabled={busy} checked={item.useReferencePhoto} onChange={e=>void selectPhoto(item,e.target.checked)}/>이 참고사진 함께 연결</label>:null}
 <details className="registration-evidence"><summary>원본·정보 출처 확인</summary><p>물품목록번호 {item.listingNo||'미기재'}</p>{item.originalRows.map(r=><p key={r.row}>{r.row}행 · {r.name} · {r.quantity}개 · {r.condition||'상태 미기재'} · 취득단가 {r.acquiredUnitPrice||'미기재'}</p>)}{item.notes.map((n,i)=><p key={i}>{n}</p>)}{Object.entries(item.provenance).map(([k,v])=><small key={k}>{k}: {v} </small>)}{item.referencePhoto?<a href={item.referencePhoto.sourceUrl} target="_blank" rel="noopener noreferrer">참고사진 출처</a>:null}</details>
 {editing===item.key&&fields?<form className="registration-edit" onSubmit={e=>{e.preventDefault();void save(item);}}><div className="form-grid">{([['title','표시 품명'],['manufacturer','제조사'],['model','모델'],['specification','규격'],['department','보관 부서']] as [keyof Fields,string][]).map(([k,name])=><label key={k}>{name}<input value={fields[k]} maxLength={k==='specification'?500:k==='manufacturer'||k==='model'?200:100} onChange={e=>setFields({...fields,[k]:e.target.value})}/></label>)}<label className="wide">설명<textarea value={fields.description} maxLength={4000} onChange={e=>setFields({...fields,description:e.target.value})}/></label></div><div className="actions"><button className="button primary compact" disabled={busy}>수정 저장</button><button className="button secondary compact" type="button" onClick={()=>setEditing('')}>취소</button></div></form>:null}
 </div></article>)}</div>
 <div className="actions">{preview.offset>0?<button className="button secondary" disabled={busy||!!editing} onClick={()=>void run(async()=>{await read(preview.id,Math.max(0,preview.offset-40));})}>이전</button>:null}{preview.nextOffset!==null?<button className="button secondary" disabled={busy||!!editing} onClick={()=>void run(async()=>{await read(preview.id,preview.nextOffset!);})}>다음 40개</button>:null}</div>
 <footer className="registration-confirm"><div><strong>확인한 {preview.total}묶음을 등록할까요?</strong><small>비공개 초안으로 등록됩니다. 타 기관 공개는 기존 게시 검토를 거칩니다.</small></div><button type="button" className="button primary" disabled={busy||!!editing} data-testid="confirm-registration" onClick={()=>void confirm()}><CheckCircle2 size={18}/>확인하고 등록</button></footer>
 </>:null}
 {complete&&preview?<section className="registration-completed" data-testid="registration-completed"><CheckCircle2 size={48}/><h2>등록 완료</h2><p>{preview.receipt.lotCount}묶음 · {preview.receipt.totalQuantity}개를 비공개 초안으로 저장했습니다.</p><div className="actions">{preview.receipt.lotIds.slice(0,5).map((id,i)=><a key={id} className="button secondary" href={'#/lots/'+id+'/edit'}>{i+1}번 물품·현물사진 확인</a>)}<a className="button primary" href="#/work">등록한 물품 보기</a></div><small>불용결정·사진·상태를 확인한 뒤 게시 검토를 요청하세요.</small><button className="text-button" onClick={()=>{setPreview(null);setSource(null);setError('');}}>다른 파일 등록</button></section>:null}
 {source?<details className="registration-source"><summary>원본 파일</summary><a href={'/api/imports/'+source.id+'/original'}>원본 받기</a>{source.conversion?.method==='NATIVE_OZP3_DEMAND'?<a href={'/api/imports/'+source.id+'/export.xlsx'}>변환 엑셀 받기</a>:null}</details>:null}
 {source&&manual&&!busy?<details><summary>열을 직접 확인하며 등록</summary><ExcelImport resumeId={source.id}/></details>:null}
 </div>;
}
