/** Rough planning reference points, not geocodes, government data or dispatch locations. */
const SEOUL={강서구:[37.551,126.850],양천구:[37.517,126.867],마포구:[37.566,126.901],강남구:[37.517,127.047],강동구:[37.530,127.124],강북구:[37.640,127.026],관악구:[37.478,126.952],광진구:[37.539,127.082],구로구:[37.496,126.888],금천구:[37.457,126.896],노원구:[37.654,127.057],도봉구:[37.669,127.047],동대문구:[37.574,127.040],동작구:[37.512,126.939],서대문구:[37.579,126.937],서초구:[37.484,127.032],성동구:[37.563,127.037],성북구:[37.589,127.017],송파구:[37.515,127.106],영등포구:[37.526,126.896],용산구:[37.532,126.991],은평구:[37.603,126.929],종로구:[37.574,126.979],중구:[37.564,126.998],중랑구:[37.606,127.093]};
const CITIES={부산:[35.180,129.076],대구:[35.871,128.601],인천:[37.456,126.705],광주광역시:[35.160,126.853],대전:[36.350,127.385],울산:[35.540,129.311],세종:[36.480,127.289],수원:[37.264,127.029],성남:[37.420,127.127],고양:[37.658,126.832],부천:[37.504,126.766],용인:[37.241,127.178],안양:[37.394,126.957],김포:[37.615,126.716],파주:[37.760,126.780],남양주:[37.636,127.217]};
export function approximateRegion(address,{seoulDistrict=false}={}){
 const value=String(address||'').normalize('NFKC').trim().slice(0,200);
 const district=Object.keys(SEOUL).find(d=>new RegExp('(?:^|\\s)'+d+'(?:\\s|$)').test(value));
 if(district&&(/^서울(?:특별시|시)?(?:\s|$)/.test(value)||seoulDistrict&&value===district)){
  const [lat,lng]=SEOUL[district];return {label:value,lat,lng,precision:'DISTRICT_APPROX',reference:'서울 '+district+' 대표점(추정)'};
 }
 for(const [city,[lat,lng]] of Object.entries(CITIES))if(new RegExp('(?:^|\\s)'+city+'(?:광역시|특별자치시|시)?(?:\\s|$)').test(value))return {label:value,lat,lng,precision:'CITY_APPROX',reference:city+' 시내 대표점(추정)'};
 return null;
}
