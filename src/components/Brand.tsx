import './brand-polish.css';
/** Readable live text: the connector between 잇 and 다 is decorative, not part of the official name. */
export default function Brand({tagline=false}:{tagline?:boolean}){
 return <span className="ssulmo-brand" aria-label="쓸모잇다"><span className="ssulmo-word" aria-hidden="true"><span>쓸모</span><b>잇</b><i className="ssulmo-join"/><b>다</b></span>{tagline?<small>쓰임과 쓰임을 잇—다</small>:null}</span>;
}
