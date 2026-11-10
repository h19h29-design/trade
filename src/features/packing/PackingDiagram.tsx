export interface Placement {itemId:string;name:string;x:number;y:number;z:number;lengthCm:number;widthCm:number;heightCm:number;quantity:number;weightKg:number;rotated:boolean}
export interface Load {trip:number;count:number;weightKg:number;floorUsePct:number;placements:Placement[];positionsTruncated:boolean}
export interface Vehicle {id:string;name:string;lengthCm:number;widthCm:number;heightCm:number;payloadKg:number}
export default function PackingDiagram({load,vehicle}:{load:Load;vehicle:Vehicle}){
 const keys=[...new Set(load.placements.map(p=>p.itemId))];const shade=(p:Placement)=>'pack-colour-'+keys.indexOf(p.itemId)%6;
 const pad=20,L=vehicle.lengthCm,W=vehicle.widthCm,H=vehicle.heightCm;
 return <div className="packing-diagram"><div className="packing-diagram-title"><strong>{load.trip}회차 · {load.count}개</strong><span>{load.weightKg.toLocaleString()} / {vehicle.payloadKg.toLocaleString()}kg · 바닥 {load.floorUsePct}%</span></div>
 <figure><figcaption>위에서 본 적재함 · {L} × {W}cm</figcaption><svg role="img" aria-label="트럭 적재함 위쪽 배치" viewBox={[-pad,-pad,L+2*pad,W+2*pad].join(' ')}><rect className="truck-outline" width={L} height={W}/>{load.placements.map((p,i)=><g key={i}><rect className={shade(p)} x={p.x} y={p.y} width={p.lengthCm} height={p.widthCm}/><title>{p.name} {p.quantity}개 · {p.lengthCm}×{p.widthCm}×{p.heightCm}cm · {p.weightKg}kg</title>{p.lengthCm>25&&p.widthCm>25?<text x={p.x+p.lengthCm/2} y={p.y+p.widthCm/2} dominantBaseline="middle" textAnchor="middle" fontSize={Math.min(16,p.widthCm/4)}>{p.quantity}개</text>:null}</g>)}</svg></figure>
 <figure><figcaption>옆에서 본 높이 · 최대 {H}cm (겹치는 칸은 투영 표시)</figcaption><svg role="img" aria-label="트럭 적재함 높이 확인" viewBox={[-pad,-pad,L+2*pad,H+2*pad].join(' ')}><rect className="truck-outline" width={L} height={H}/>{load.placements.map((p,i)=><rect key={i} className={shade(p)+' side-box'} x={p.x} y={H-p.heightCm} width={p.lengthCm} height={p.heightCm}/>)}</svg></figure>
 <div className="packing-legend">{keys.map((k,i)=><span key={k}><i className={'pack-colour-'+i%6}/>{load.placements.find(p=>p.itemId===k)?.name}</span>)}</div>{load.positionsTruncated?<small>그림은 첫 200칸만 표시합니다. 수량·운임은 전체 물품을 계산했습니다.</small>:null}</div>;
}
