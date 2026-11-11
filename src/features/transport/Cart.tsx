import {createContext,useContext,useState,useMemo,type ReactNode} from 'react';
import {Truck,Check} from 'lucide-react';
import {useApp,go} from '../../context';
import type {Lot} from '../../types';
import type {CartEntry} from './types';
const Cart=createContext<{items:CartEntry[];setItems:(next:CartEntry[])=>void}>({items:[],setItems:()=>{}});
export function TransportCartProvider({userId,children}:{userId:string;children:ReactNode}){
 const key='ssulmo.transport.v1:'+userId;
 const [items,set]=useState<CartEntry[]>(()=>{try{const data=JSON.parse(sessionStorage.getItem(key)||'[]');return Array.isArray(data)?data.filter((x:CartEntry)=>typeof x.lotId==='string'&&/^[a-f0-9-]{36}$/i.test(x.lotId)&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=2000&&Number.isInteger(x.version)).slice(0,12):[];}catch{return [];}});
 const value=useMemo(()=>({items,setItems:(next:CartEntry[])=>{set(next);try{sessionStorage.setItem(key,JSON.stringify(next));}catch{/* Storage denial still allows this tab's calculation. */}}}),[items,key]);
 return <Cart.Provider value={value}>{children}</Cart.Provider>;
}
export const useTransportCart=()=>useContext(Cart);
export function TransportButton({lot,quantity=1,open=false}:{lot:Lot;quantity?:number;open?:boolean}){
 const cart=useTransportCart(),{notify}=useApp();const exists=cart.items.some(x=>x.lotId===lot.id);
 if(lot.own||lot.state!=='PUBLISHED'||lot.available<1)return null;
 return <button type="button" className="button secondary compact transport-add" onClick={()=>{
  const q=Math.max(1,Math.min(Number.isFinite(quantity)?Math.floor(quantity):1,lot.available,2000));
  const others=cart.items.filter(x=>x.lotId!==lot.id);
  if(others.length>=12||others.reduce((n,x)=>n+x.quantity,0)+q>2000){notify('한 번에 12종·2,000개까지 담을 수 있습니다.',true);return;}
  cart.setItems([...others,{lotId:lot.id,quantity:q,version:lot.version}]);
  if(open)go('/transport');else notify('가져올 물품에 담았습니다. 상단 운송비 계산에서 수량과 주소를 선택하세요.');
 }}>{exists?<Check size={16}/>:<Truck size={16}/>} {open?'선택 수량 운송비 보기':exists?'담은 물품 · 다시 담기':'가져올 물품 담기'}</button>;
}
