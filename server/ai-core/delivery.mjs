import {estimatePacking} from '../truck-packing.mjs';
import {estimateShipment,DEFAULT_RATE_CARD,rateCardSchema,distanceBetween} from '../shipping.mjs';
import {drivingRoute,providerStatus} from '../providers.mjs';
/** Missing inputs stay missing; no guessed weight, postcode or free freight. */
export async function deliveryFor(lot,criteria,{env=process.env,fetcher=fetch,destination,routeConsent=false,handling=false,helperHours=0,stairsFloors=0}={}){
 const missing=[];
 const origin=lot.pickupLocation?.confirmed?lot.pickupLocation:null;
 if(!origin)missing.push('담당자가 확인한 출발 위치');
 if(!destination)missing.push('받는 기관의 배송 위치');
 const dims=lot.dimensions;
 if(!dims||['lengthCm','widthCm','heightCm','unitWeightKg'].some(k=>!Number.isFinite(dims[k])||dims[k]<=0))missing.push('포장 크기·개당 무게');
 if(missing.length)return {status:'NEEDS_INFO',missing,binding:false,source:'MISSING_INPUT'};
 const rate=env.SHIPPING_RATE_CARD_JSON?rateCardSchema.parse(JSON.parse(env.SHIPPING_RATE_CARD_JSON)):DEFAULT_RATE_CARD;
 let route=null,routeWarning='';
 if(routeConsent&&providerStatus(env).route.configured){try{route=await drivingRoute(origin,destination,{env,fetcher:(url,options)=>fetcher(url,{...options,signal:AbortSignal.any([options.signal,AbortSignal.timeout(8000)])})});}catch{routeWarning='도로 경로 조회 실패: 직선거리 보정 추정입니다.';}}
 const distance=distanceBetween(origin,destination);
 if(!route&&distance<=.05)return {status:'NEEDS_INFO',missing:['동일·인접 위치의 실제 운반거리'],binding:false,source:'MISSING_DISTANCE'};
 const input={originLabel:origin.label||lot.orgName,destinationLabel:destination.label||'배송 위치',cargo:{...dims,quantity:Math.min(criteria.quantity,lot.available),stackCount:1,stackIncrementCm:0,stackingConfirmed:false,measurementsConfirmed:lot.dimensionsConfirmed===true},distanceMode:route?'ROAD':'COORDINATE',origin,destination,handling,helperHours,stairsFloors,tolls:0,includeVat:true,persist:false};
 const resolved=estimateShipment(input,route,rate);
 if(input.cargo.quantity>2000)return {status:'NEEDS_INFO',missing:['2,000개 이내 묶음으로 트럭 적재 계산'],binding:false};
 const packed=estimatePacking({items:[{id:lot.id||'single',name:lot.title||'물품',...dims,quantity:input.cargo.quantity,rotate:true,stackCount:1,stackIncrementCm:0,stackingConfirmed:false}],distanceKm:resolved.distanceKm,clearanceCm:2,handling,helperHours,stairsFloors,includeVat:true},rate);
 const quote={...resolved,...packed,distanceKm:resolved.distanceKm,distanceSource:resolved.distanceSource};
 if(!quote.recommended)return {status:'NEEDS_INFO',missing:['등록 차량에 적재 불가: 운송업체 별도 견적'],binding:false,source:'MANUAL_QUOTE_REQUIRED'};
 return {status:'ESTIMATED',low:quote.recommended.low,high:quote.recommended.high,estimated:quote.recommended.estimated,trips:quote.recommended.trips,vehicle:quote.recommended.vehicle,distanceKm:quote.distanceKm,distanceSource:quote.distanceSource,source:route?'KAKAO_ROAD':'COORDINATE_ASSUMPTION',sample:rate.sample,rateVersion:rate.version,rateLabel:rate.label,binding:false,quantity:input.cargo.quantity,assumptions:[...(routeWarning?[routeWarning]:[]),...quote.assumptions],missing:[]};
}
