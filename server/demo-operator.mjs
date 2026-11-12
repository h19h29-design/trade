import {uid,now,must,transaction,audit} from './db.mjs';
import {passwordHash} from './auth.mjs';

export const DEMO_ACCOUNT_DOMAIN='@demo.local';
const ID_PATTERN=/^[a-zA-Z0-9._-]{3,80}$/;

/**
 * Demo deployments only: provision the operator account from the server environment and
 * stop the seeded demo institutions from logging in. Ownership rows stay untouched so the
 * published demo catalogue keeps its creators, files and audit trail.
 */
export function ensureDemoOperator(db,{adminId=process.env.ADMIN_ID,adminPassword=process.env.ADMIN_PASSWORD}={}){
 const id=typeof adminId==='string'?adminId.trim().toLowerCase():'';
 const password=typeof adminPassword==='string'?adminPassword:'';
 if(!id&&!password)return {configured:false,created:false,disabled:0};
 must(id&&password,'ADMIN_ID와 ADMIN_PASSWORD를 함께 설정하세요.',400,'DEMO_OPERATOR_CONFIG_REQUIRED');
 must(ID_PATTERN.test(id),'시연 운영자 아이디는 3~80자의 영문·숫자·._-만 사용합니다.',400,'DEMO_OPERATOR_ID_INVALID');
 must(password.length>=6&&password.length<=200,'시연 운영자 비밀번호는 6~200자입니다.',400,'DEMO_OPERATOR_PASSWORD_INVALID');
 return transaction(db,()=>{
  let user=db.prepare('SELECT id,org_id FROM users WHERE email=?').get(id),created=false;
  if(!user){
   const orgId=uid(),userId=uid();
   db.prepare('INSERT INTO organizations VALUES(?,?,?,?,?,1,?,?)').run(orgId,'시연 운영기관','DEMO-OP-001','PUBLIC_SCHOOL','강서구','시연 운영 계정 전용 가상 기관 · 실제 기관 아님',now());
   db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,1,?)').run(userId,orgId,'시연 운영자',id,passwordHash(password),'EDITOR',now());
   user={id:userId,org_id:orgId};created=true;
  }
  db.prepare('UPDATE users SET active=1 WHERE id=?').run(user.id);
  const disabled=db.prepare('UPDATE users SET active=0 WHERE email LIKE ? AND email<>? AND active=1').run('%'+DEMO_ACCOUNT_DOMAIN,id).changes;
  if(created||disabled)audit(db,{org_id:user.org_id,id:user.id},'DEMO_OPERATOR_READY',user.id,{created,seededDemoDisabled:disabled,credentialsFromEnvironment:true});
  return {configured:true,created,disabled,email:id};
 });
}
