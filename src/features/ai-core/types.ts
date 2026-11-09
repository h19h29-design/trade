import type {Lot} from '../../types';
export interface Location {label:string;lat:number;lng:number}
export interface CoreStatus {aiConfigured:boolean;model:string;providers:{procurement:{configured:boolean};location:{configured:boolean};route:{configured:boolean}};scoreVersion:string;weights:Record<string,number>;corpus:string}
export interface Evidence {id:string;key:string;text:string}
export interface Recommendation {lot:Lot;score:number;breakdown:{key:string;label:string;score:number;max:number}[];pros:Evidence[];cons:Evidence[];evidence:Evidence[];sufficient:boolean;delivery:{status:string;low?:number;high?:number;distanceKm?:number;trips?:number;vehicle?:string;distanceSource?:string;sample?:boolean;missing?:string[];assumptions?:string[];rateLabel?:string;binding:false};aiExplanation:{text:string;sourceIds:string[]}|null}
export interface SearchResult {mode:string;results:Recommendation[];criteria:{quantity:number;district:string};notes:string[];checkedAt:string;scoreVersion:string;disclaimer:string;retrieval:{documents:number;scope:string}}
