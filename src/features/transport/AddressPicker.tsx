import {useEffect,useRef,useState} from 'react';
import {MapPin,Search,X} from 'lucide-react';
import {post} from '../../api';
import type {AddressChoice} from './types';
type Postal={roadAddress:string;address:string;sido:string;sigungu:string;zonecode:string};
type PostalAPI={Postcode:new(options:{oncomplete:(p:Postal)=>void;onresize:(s:{height:number})=>void;width:string;height:string})=>{embed:(el:HTMLElement)=>void}};
let sdk:Promise<void>|null=null;
const root=()=>window as unknown as {kakao?:PostalAPI};
function loadPostcode(){
 if(root().kakao?.Postcode)return Promise.resolve();
 if(sdk)return sdk;
 sdk=new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src='https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';s.async=true;s.referrerPolicy='no-referrer';const t=setTimeout(()=>{s.remove();reject(Error('주소검색 연결이 지연됩니다. 주소를 직접 입력할 수 있습니다.'));},10000);s.onload=()=>{clearTimeout(t);root().kakao?.Postcode?resolve():reject(Error('주소검색 기능을 확인하지 못했습니다.'));};s.onerror=()=>{clearTimeout(t);s.remove();reject(Error('주소검색 연결이 차단됐습니다. 주소를 직접 입력하세요.'));};document.head.append(s);}).catch(e=>{sdk=null;throw e;});return sdk;
}
export default function AddressPicker({label,value,onChange,configured=false,disabled=false}:{label:string;value:AddressChoice|null;onChange:(v:AddressChoice|null)=>void;configured?:boolean;disabled?:boolean}){
 const [query,setQuery]=useState(value?.label||''),[candidates,setCandidates]=useState<AddressChoice[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false),[consent,setConsent]=useState(false);
 const box=useRef<HTMLDivElement>(null),epoch=useRef(0),consentRef=useRef(consent);consentRef.current=consent;
 useEffect(()=>()=>{epoch.current++;},[]);
 async function resolve(address:string){const turn=++epoch.current;onChange(null);setQuery(address);setCandidates([]);setError('');setBusy(true);
  try{const result=await post<{candidates:AddressChoice[];notes:string[]}>('/transport/address',{query:address,consent:consentRef.current});if(turn!==epoch.current)return;setCandidates(result.candidates);if(result.candidates.length===1)onChange(result.candidates[0]);setError(result.notes.join(' '));}catch(e){if(turn===epoch.current)setError(e instanceof Error?e.message:'주소 확인 실패');}finally{if(turn===epoch.current)setBusy(false);}}
 useEffect(()=>{if(!open||!box.current)return;let alive=true;setError('');void loadPostcode().then(()=>{if(!alive||!box.current)return;new (root().kakao!.Postcode)({oncomplete:d=>{if(!alive)return;setOpen(false);void resolve(d.roadAddress||d.address);},onresize:s=>{if(box.current)box.current.style.height=Math.min(490,s.height)+'px';},width:'100%',height:'100%'}).embed(box.current);}).catch(e=>{if(alive){setError(e.message);setOpen(false);}});return()=>{alive=false;};},[open]);
 return <div className="transport-address">
  <label>{label}<div className="transport-address-line"><input aria-label={label} value={query} disabled={disabled||busy} placeholder="도로명주소 또는 서울 ○○구" onChange={e=>{epoch.current++;setQuery(e.target.value);setCandidates([]);onChange(null);}} maxLength={200}/>
   <button type="button" className="button secondary compact" disabled={busy||disabled} onClick={()=>setOpen(true)}><Search size={16}/>주소 검색</button>
   <button type="button" className="button secondary compact" disabled={busy||disabled||query.trim().length<3} onClick={()=>void resolve(query)}>주소 확인</button></div></label>
  {configured?<label className="check fineprint"><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);onChange(null);}} disabled={disabled}/>선택한 주소를 카카오 좌표 API로 확인</label>:null}
  {open?<div className="postcode-panel" role="dialog" aria-label={label+' 검색'}><div className="postcode-title"><strong>카카오 주소검색</strong><button type="button" className="icon-button" onClick={()=>setOpen(false)} aria-label="주소검색 닫기"><X size={18}/></button></div><div ref={box} style={{height:440}}/></div>:null}
  {candidates.length>1?<div className="transport-address-candidates">{candidates.map(c=><button type="button" className="button secondary" key={c.token} onClick={()=>onChange(c)}>{c.label}</button>)}</div>:null}
  {value?<p className="transport-location"><MapPin size={15}/>{value.label}<small>{value.reference}</small></p>:<small className="fineprint">주소검색은 카카오 서비스로 열립니다. 키가 없는 환경은 지역 대표점으로 거리를 가정합니다.</small>}
  {error?<p role="status" className="transport-warning">{error}</p>:null}
 </div>;
}
