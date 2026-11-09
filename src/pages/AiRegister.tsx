import {useEffect,useRef,useState} from 'react';
import {FileSpreadsheet,Sparkles,CheckCircle2,LockKeyhole,RefreshCw,ArrowUpRight,Pause} from 'lucide-react';
import {api,post} from '../api';
import {useResource} from '../context';
import {PageHead,Notice,Field,ErrorBox} from '../components/UI';
import DropArea from '../components/DropArea';
import ExcelImport from '../features/ExcelImport';
import type {CoreStatus} from '../features/ai-core/types';
interface Source {registeredCount?:number;id:string;name:string;inputFormat?:string;conversion?:{state:string;method?:string;message?:string;summary?:{rows:number;totalQuantity:number}}}
interface Receipt {lotIds:string[];lotCount:number;totalQuantity:number;rows:number;reused:boolean;warnings:string[]}
interface Item {id:string;title?:string;state:string;appliedFields:string[];notes:string[];reused?:boolean}
interface Batch {items:Item[];nextCursor:number;done:boolean;total:number}
const LABEL:Record<string,string>={CATALOG_MATCHED:'조달번호 일치',AI_EXTRACTED:'AI 원문 보완',REVIEW_CANDIDATES:'후보 선택 필요',SOURCE_ONLY:'원본으로 등록',SKIPPED:'변경된 초안 보존',RETRY:'다시 확인 필요'};
export default function AiRegister({resumeId}:{resumeId?:string}){
 const {data:status}=useResource<CoreStatus>('/ai-core/status');
 const [source,setSource]=useState<Source|null>(null),[receipt,setReceipt]=useState<Receipt|null>(null),[items,setItems]=useState<Item[]>([]),[busy,setBusy]=useState(false),[stage,setStage]=useState('파일을 올려 주세요'),[error,setError]=useState(''),[consent,setConsent]=useState(false),[department,setDepartment]=useState(''),[cursor,setCursor]=useState(0),[total,setTotal]=useState(0),[manual,setManual]=useState(false),[finished,setFinished]=useState(false);
 const lock=useRef(false),stop=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
 useEffect(()=>{if(!resumeId)return;const ctl=new AbortController();api<Source>('/ai-core/register/'+resumeId+'/status',{signal:ctl.signal}).then(setSource).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>ctl.abort();},[resumeId]);
 async function enrich(id:string,from=0){
  let at=from;setStage('조달정보·AI로 빈 항목 보완 중');
  for(let i=0;i<2000&&!stop.current&&mounted.current;i++){
   const r=await post<Batch>('/ai-core/register/'+id+'/enrich',{cursor:at,useAi:true,consent});
   if(!mounted.current)return;
   setItems(old=>{const all=new Map(old.map(x=>[x.id,x]));r.items.forEach(x=>all.set(x.id,x));return [...all.values()];});
   setTotal(r.total);setCursor(r.nextCursor);at=r.nextCursor;
   if(r.done){setFinished(true);setStage('자동 등록 완료 · 현물·증빙 확인 필요');return;}
  }
  setStage('일시 중단 · 저장한 초안은 유지됩니다');
 }
 async function run(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;stop.current=false;setBusy(true);setError('');try{await fn();}catch(e){if(mounted.current){setError(e instanceof Error?e.message:'처리하지 못했습니다. 저장된 원본과 초안은 보존됩니다.');setStage('처리 확인 필요 · 저장된 자료 보존');}}finally{lock.current=false;if(mounted.current)setBusy(false);}}
 async function start(s:Source){
  setStage('원본 열·수량 검증 후 초안 저장');
  try{const r=await post<Receipt>('/ai-core/register/'+s.id+'/start',{department,groupIdentical:true});setReceipt(r);setTotal(r.lotCount);setCursor(0);setManual(false);if(!stop.current)await enrich(s.id,0);}
  catch(e){setManual(true);throw e;}
 }
 function upload(file:File){void run(async()=>{
  if(!/\.(xlsx|xls|ozd)$/i.test(file.name)||file.size>8388608)throw new Error('8MB 이하 OZD·XLSX·XLS 파일을 선택하세요.');
  setStage('원본 보관·물품 표 분석');setFinished(false);setItems([]);setReceipt(null);setCursor(0);setTotal(0);setManual(false);
  const data=new FormData();data.set('file',file);
  const s=await api<Source>('/imports/documents',{method:'POST',body:data});setSource(s);
  if(s.conversion?.state==='WAITING'){setStage('원본 보관 · 지원 양식 확인 필요');setError(s.conversion.message||'이 파일은 자동 해석하지 못했습니다.');setManual(true);return;}
  if(!stop.current)await start(s);
 });}
 return <div className="ai-core-page ai-registration-page"><PageHead title="AI 물품등록" description="OZD·엑셀을 올리면 원본을 읽고, 제품정보를 보완해 비공개 물품 초안까지 만듭니다."/>
 <div className="ai-register-intro"><div className="ai-register-symbol"><FileSpreadsheet size={35}/></div><div><h2>파일 하나로, 반복 입력은 줄이고</h2><p>표 읽기 → 물품별 초안 저장 → 조달청 정보 조회 → AI 원문 보완을 순서대로 진행합니다.</p></div><span><LockKeyhole size={16}/>우리 기관만 확인</span></div>
 <div className="ai-register-settings"><Field label="기본 보관 부서" help="파일의 부서가 비어 있을 때만 사용합니다."><input value={department} onChange={e=>setDepartment(e.target.value)} maxLength={100} disabled={busy} placeholder="예: 행정실"/></Field><label className="check"><input type="checkbox" checked={consent} disabled={busy||!status?.aiConfigured} onChange={e=>setConsent(e.target.checked)}/>품명·규격 등 필요한 제품정보를 외부 AI로 전송해 빈 항목을 보완합니다.</label><p className="fineprint">{status?.aiConfigured?'원문에 있는 제조사·모델 문자열만 자동 입력하며 새 수량·상태를 추정하지 않습니다.':'AI 미연결이어도 파일 등록은 가능합니다. AI가 분석했다고 표시하지 않습니다.'} {status?.providers.procurement.configured?'조달청 키 연결 확인':'조달청 미연결: 원본 초안 저장 후 나중에 재조회할 수 있습니다.'}</p></div>
 <DropArea accept=".ozd,.xlsx,.xls" testId="ai-document-upload" title="OZD 또는 엑셀을 끌어다 놓으세요" description="파일을 올리면 자동으로 비공개 초안을 저장합니다 · 8MB 이하 · 최대 2,000행" buttonLabel={busy?'등록 처리 중…':'파일 올리고 자동 등록'} disabled={busy} onFiles={files=>upload(files[0])}/>
 <Notice>이 기능의 ‘등록 완료’는 <strong>비공개 초안 저장</strong>입니다. 실제 물품 상태·사진·불용결정 증빙을 확인하고 다른 검토자가 승인해야 타 기관에 공개됩니다. 원본의 폐품 표기·취득정보·수량은 그대로 보존합니다.</Notice>
 {source?<section className="ai-import-status" aria-live="polite"><header><div><span>{source.inputFormat||'문서'}</span><h2>{source.name}</h2><p>{stage}</p></div>{busy?<button type="button" className="button secondary compact" onClick={()=>{stop.current=true;setStage('현재 물품 처리 후 중단합니다');}}><Pause size={16}/>일시 중단</button>:null}</header>
 {total>0?<><progress value={cursor} max={total}/><p>정보 보완 {cursor} / {total}묶음 · 초안 {receipt?.lotCount||total}묶음 저장{finished?' 완료':''}</p></>:null}
 {source.conversion?.method==='NATIVE_OZP3_DEMAND'?<p className="fineprint">OZD 내부 표 직접 변환 · {source.conversion.summary?.rows}행 / {source.conversion.summary?.totalQuantity}개 <a href={'/api/imports/'+source.id+'/export.xlsx'}>변환 엑셀 받기</a></p>:null}
 {!busy?<div className="actions">{!receipt&&!items.length?<button className="button primary" onClick={()=>void run(()=>source.registeredCount?enrich(source.id,0):start(source))}>{source.registeredCount?'저장한 초안 보완 계속':'자동 등록 다시 확인'}</button>:<button className="button primary" onClick={()=>void run(()=>enrich(source.id,finished?0:cursor))}><RefreshCw size={17}/>{finished?'연결·누락 정보 다시 확인':'남은 정보 보완 계속'}</button>}<a className="button secondary" href="#/work">전체 초안 확인</a><a className="text-button" href={'/api/imports/'+source.id+'/original'}>원본 받기</a><button className="text-button" onClick={()=>setManual(!manual)}>열·사진 직접 확인</button></div>:null}
 </section>:null}
 {error?<ErrorBox message={error}/>:null}
 {receipt?.warnings.length?<details className="ai-evidence"><summary>원본 검증 안내 {receipt.warnings.length}건</summary>{receipt.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>:null}
 {items.length?<section className="ai-import-results"><h2>물품별 등록 결과</h2>{items.map(item=><article className="ai-import-row" key={item.id}><CheckCircle2 size={22}/><div><h3>{item.title||'등록된 물품'}</h3><span>{LABEL[item.state]||item.state} {item.reused?'· 기존 결과 보존':''}</span><details><summary>정보 출처·확인 사항</summary>{item.notes.map((n,i)=><p key={i}>{n}</p>)}<p>원본·현물 상태·게시승인은 자동 변경하지 않았습니다.</p></details></div><a className="button secondary compact" href={'#/lots/'+item.id+'/edit'}>현물·증빙 확인 <ArrowUpRight size={16}/></a></article>)}</section>:null}
 {source&&manual&&!busy?<section className="ai-manual-recovery"><h2>원본 열·사진을 확인하며 이어가기</h2><ExcelImport resumeId={source.id} onDone={()=>{setStage('수동 검증 초안 저장 완료 · 정보 보완을 계속할 수 있습니다');}}/><button className="button secondary" onClick={()=>void run(()=>enrich(source.id,0))}><Sparkles size={17}/>저장한 초안 정보 보완</button></section>:null}
 <p className="fineprint">사진 자동 연결은 현물·개인정보 확인을 거쳐야 합니다. 품명으로만 찾은 조달 후보는 잘못된 코드 등록을 막기 위해 담당자 선택으로 남깁니다. 이동하거나 새로고침해도 저장된 원본과 초안은 업로드 이력에서 찾을 수 있습니다.</p>
 </div>;
}
