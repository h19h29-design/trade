import {useState} from 'react';
import {useApp} from '../context';
import {post} from '../api';
import {Section,Field,ErrorBox} from '../components/UI';
export default function TestAccountSettings(){
 const {user,logout}=useApp();const [login,setLogin]=useState(user.email),[old,setOld]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 if(!user.testAccount)return null;
 return <Section title="테스트 아이디·비밀번호 변경"><form onSubmit={e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');void post('/auth/test-account',{newLogin:login,currentPassword:old,newPassword:password}).then(()=>logout()).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>
 <div className="form-grid"><Field label="새 테스트 아이디"><input value={login} onChange={e=>setLogin(e.target.value)} minLength={3} maxLength={80} required autoComplete="username"/></Field>
 <Field label="현재 테스트 비밀번호"><input type="password" value={old} onChange={e=>setOld(e.target.value)} required autoComplete="current-password"/></Field>
 <Field label="새 테스트 비밀번호" help="12자 이상. 변경 후 모든 세션이 종료됩니다."><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} maxLength={200} required autoComplete="new-password"/></Field></div>
 {error?<ErrorBox message={error}/>:null}<button className="button primary" disabled={busy}>계정 변경 후 다시 로그인</button>
 </form></Section>;
}
