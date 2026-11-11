/** Shared, bounded normalization for ordinary and AI catalog retrieval. */
export const SYNONYMS=[['캐비넷','캐비닛'],['책꽂이','책장'],['서가','책장'],['프린트기','프린터'],['인쇄기','프린터'],['데스크탑','컴퓨터'],['데스크톱','컴퓨터'],['랩탑','노트북'],['디스플레이','모니터'],['폴딩체어','접이식의자'],['체어','의자']];
export function canonical(value){let s=String(value||'').normalize('NFKC').toLowerCase();for(const [from,to]of SYNONYMS)s=s.replaceAll(from,to);return s;}
export const compact=value=>canonical(value).replace(/[^가-힣a-z0-9]/g,'');
export function publicCatalogText(l){return [l.title,l.manufacturer,l.model,l.description,l.orgName,l.district,l.listingNo,l.catalogIdentifier,l.actualIdentificationCode,l.classificationName,l.specification,l.department,...(l.photos||[]).map(p=>p.productName||'')].filter(Boolean).join(' ');}
const stop=new Set(['찾아줘','찾아주세요','물품','필요','필요해','필요한','검색','추천','구해줘','주세요','좀','대','개','용']);
export function searchTerms(query){
 let q=canonical(String(query||'').slice(0,800));
 const exclude=[...q.matchAll(/([가-힣a-z0-9]+)\s*(?:말고|제외|빼고)/g)].map(x=>compact(x[1]));
 q=q.replace(/([가-힣a-z0-9]+)\s*(?:말고|제외|빼고)/g,' ').replace(/\d[\d,]*\s*(?:개|대|세트)(?=\s|$)/g,' ');
 const terms=(q.match(/[가-힣a-z0-9.-]+/g)||[]).map(v=>v.replace(/(으로|에서|을|를|은|는)$/,'')).filter(v=>v&&!stop.has(v));
 return {terms:terms.map(compact).filter(Boolean).slice(0,20),exclude,whole:compact(q)};
}
export function catalogMatch(l,query){
 if(!String(query).trim())return {matched:true,score:0};
 const {terms,exclude,whole}=searchTerms(query),body=compact(publicCatalogText(l));
 if(exclude.some(t=>body.includes(t)))return {matched:false,score:0};
 const matched=terms.length>0&&terms.every(t=>body.includes(t));if(!matched)return {matched:false,score:0};
 const code=[l.listingNo,l.catalogIdentifier,l.actualIdentificationCode].filter(Boolean).map(compact);
 let score=code.includes(whole)?1000:compact(l.model)===whole?800:compact(l.title)===whole?600:compact(l.title).includes(whole)?400:200;
 score+=terms.reduce((n,t)=>n+(compact(l.title).includes(t)?20:compact(l.model).includes(t)?15:2),0);
 return {matched:true,score};
}
