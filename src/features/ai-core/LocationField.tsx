import {useState} from 'react';
import {MapPin,Search,X} from 'lucide-react';
import {post} from '../../api';
import {Field,Notice} from '../../components/UI';
import type {Location} from './types';
export default function LocationField({label,value,onChange,configured,disabled=false}:{label:string;value?:Location|null;onChange:(v:Location|null)=>void;configured:boolean;disabled?:boolean}){
 const [query,setQuery]=useState(value?.label||''),[consent,setConsent]=useState(false),[candidates,setCandidates]=useState<Location[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function lookup(){if(busy||disabled)return;setBusy(true);setError('');try{const result=await post<{candidates:Location[]}>('/shipping/geocode',{query,consent});setCandidates(result.candidates);if(!result.candidates.length)setError('주소 후보가 없습니다. 도로명 주소로 입력해 주세요.');}catch(e){setError(e instanceof Error?e.message:'주소를 조회하지 못했습니다.');}finally{setBusy(false);}}
 return <div className="ai-location"><Field label={label}><div className="ai-location-input"><input aria-label={label} value={query} onChange={e=>{setQuery(e.target.value);onChange(null);setCandidates([]);}} placeholder="기관의 도로명 주소" maxLength={200} disabled={disabled||busy}/><button type="button" className="button secondary compact" disabled={disabled||busy||!configured||!consent||query.trim().length<3} onClick={()=>void lookup()}><Search size={16}/>{busy?'조회 중':'주소 찾기'}</button></div></Field>
 {configured?<label className="check fineprint"><input type="checkbox" disabled={disabled||busy} checked={consent} onChange={e=>setConsent(e.target.checked)}/>입력 주소를 주소검색 서비스에 보내는 데 동의합니다.</label>:<p className="fineprint">주소 API 연결 전에는 배송비를 확정하지 않고 확인이 필요한 조건을 표시합니다.</p>}
 {error?<Notice tone="warning">{error}</Notice>:null}
 {candidates.length?<div className="ai-location-options">{candidates.map(c=><button type="button" className="button secondary" key={c.label+c.lat+c.lng} disabled={disabled} onClick={()=>{onChange(c);setQuery(c.label);setCandidates([]);}}><MapPin size={16}/>{c.label}</button>)}</div>:null}
 {value?<p className="ai-location-selected"><MapPin size={16}/>{value.label}<button type="button" className="text-button" aria-label={label+' 선택 해제'} disabled={disabled} onClick={()=>{onChange(null);setQuery('');}}><X size={15}/></button></p>:null}
 </div>;
}
