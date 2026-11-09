import {useResource} from '../../context';
import {Notice} from '../../components/UI';
import type {Draft} from '../../types';
import type {CoreStatus} from './types';
import LocationField from './LocationField';
export default function PickupEditor({draft,onChange}:{draft:Draft;onChange:(patch:Partial<Draft>)=>void}){
 const {data:status}=useResource<CoreStatus>('/ai-core/status');
 return <div className="ai-pickup-editor"><h3>AI 배송 비교에 사용할 출발 위치</h3><p className="fineprint">공개할 물품의 기관 상차 위치만 입력하세요. 개인 주소나 보안구역 정보는 입력하지 마세요.</p>
 <LocationField label="물품 출발 기관 주소" value={draft.pickupLocation} configured={!!status?.providers.location.configured} onChange={v=>onChange({pickupLocation:v?{...v,confirmed:false}:undefined})}/>
 {draft.pickupLocation?<label className="check"><input type="checkbox" checked={draft.pickupLocation.confirmed} onChange={e=>onChange({pickupLocation:{...draft.pickupLocation!,confirmed:e.target.checked}})}/>이 위치가 실제 상차 장소이고 물품 공개 시 다른 기관에 표시되어도 됩니다.</label>:null}
 <label className="check"><input type="checkbox" checked={draft.dimensionsConfirmed===true} onChange={e=>onChange({dimensionsConfirmed:e.target.checked})}/>위 포장 크기와 개당 무게를 실제로 확인했습니다.</label>
 <Notice>크기·무게·출발 위치가 없으면 배송비를 임의로 계산하지 않습니다. 참고 크기인지 실측인지도 검색 결과에 구분합니다.</Notice>
 </div>;
}
