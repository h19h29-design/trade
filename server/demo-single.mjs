import {randomBytes} from 'node:crypto';
import {uid,now,must,audit,transaction} from './db.mjs';
import {addUser,passwordHash,verifyPassword,throttle} from './auth.mjs';
import {z} from 'zod';

/** Dedicated disposable demo database only. Never rewrites a user's existing accounts after setup. */
export function ensureSingleDemo(db,{adminId=process.env.ADMIN_ID,adminPassword=process.env.ADMIN_PASSWORD}={}){
 const hasId=typeof adminId==='string'&&adminId.trim().length>0;
 const hasPassword=typeof adminPassword==='string'&&adminPassword.length>0;
 must(hasId===hasPassword,'ADMIN_ID와 ADMIN_PASSWORD를 함께 설정하세요.',400,'DEMO_CREDENTIAL_CONFIG_REQUIRED');
 const demoId=hasId?adminId.trim().toLowerCase():'admin';
 const demoPassword=hasPassword?adminPassword:'1234';
 must(/^[a-zA-Z0-9._-]{3,80}$/.test(demoId),'시연 아이디는 3~80자의 영문·숫자·._-만 사용할 수 있습니다.',400,'DEMO_ADMIN_ID_INVALID');
 must(demoPassword.length>=4&&demoPassword.length<=200,'시연 비밀번호는 4~200자여야 합니다.',400,'DEMO_ADMIN_PASSWORD_INVALID');
 const existing=db.prepare('SELECT t.*,u.email,u.active FROM test_accounts t JOIN users u ON u.id=t.user_id').get();
 if(existing){
  must(existing.active,'테스트 계정이 비활성화됐습니다. 기존 설정을 확인하세요.');
  // An explicitly supplied pair may initialize an account that still has its first password.
  // Once changed in-app, subsequent restarts keep the operator's change.
  if(hasId&&existing.initial_password===1){db.prepare('UPDATE users SET email=?,password_hash=? WHERE id=?').run(demoId,passwordHash(demoPassword),existing.user_id);}
  return existing.user_id;
 }
 must(!db.prepare('SELECT 1 FROM users LIMIT 1').get(),'단일계정 시연은 새 DATA_DIR에서 시작하세요. 기존 계정·DB는 변경하지 않습니다.',409);
 return transaction(db,()=>{
  const orgId=uid();db.prepare('INSERT INTO organizations VALUES(?,?,?,?,?,1,?,?)').run(orgId,'가상 내 테스트기관','SINGLE-DEMO-001','PUBLIC_SCHOOL','강서구','합성 시연기관 · 실제 기관 아님',now());
  const user=addUser(db,{orgId,name:'테스트 담당자',email:demoId,password:randomBytes(24).toString('hex'),role:'EDITOR'});
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash(demoPassword),user);
  db.prepare('INSERT INTO test_accounts VALUES(?,1,?)').run(user,now());
  return user;
 });
}
export function assertSingleDemoDeployment(db,{origin,host,mode}){
 must(mode!=='production','단일 테스트 계정은 운영 모드에서 사용할 수 없습니다.',400);
 const first=db.prepare('SELECT initial_password FROM test_accounts').get();
 if(first?.initial_password)must(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)&&['localhost','127.0.0.1','::1'].includes(host),'초기 비밀번호 1234는 로컬 전용입니다. 로그인 후 비밀번호를 변경해야 외부 시연이 가능합니다.',400);
}
export function mountTestAccount(app,db,{singleDemo=false}={}){
 app.post('/api/auth/test-account',throttle(),(req,res)=>{
  must(singleDemo&&db.prepare('SELECT 1 FROM test_accounts WHERE user_id=?').get(req.user.id),'단일 테스트 모드에서만 변경할 수 있습니다.',403);
  const d=z.object({currentPassword:z.string().min(1).max(200),newLogin:z.string().trim().toLowerCase().min(3).max(80).regex(/^[a-z0-9][a-z0-9._-]+$/),newPassword:z.string().min(12).max(200)}).strict().parse(req.body);
  const row=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  must(verifyPassword(d.currentPassword,row.password_hash),'현재 비밀번호가 맞지 않습니다.',403);
  must(!db.prepare('SELECT 1 FROM users WHERE email=? AND id<>?').get(d.newLogin,row.id),'이미 사용 중인 아이디입니다.',409);
  transaction(db,()=>{
   db.prepare('UPDATE users SET email=?,password_hash=? WHERE id=?').run(d.newLogin,passwordHash(d.newPassword),row.id);
   db.prepare('UPDATE test_accounts SET initial_password=0 WHERE user_id=?').run(row.id);
   db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);
   audit(db,req.user,'TEST_ACCOUNT_CHANGED',row.id,{passwordChanged:true});
  });
  res.set('Set-Cookie','trade_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');res.json({ok:true,relogin:true});
 });
}
