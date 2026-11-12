import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,uid,now} from '../server/db.mjs';
import {addUser} from '../server/auth.mjs';
import {createApp} from '../server/app.mjs';
import {ensureDemoOperator} from '../server/demo-operator.mjs';

function setup(t){
 const dir=mkdtempSync(join(tmpdir(),'trade-operator-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const db=openDatabase(join(dir,'trade.sqlite'));
 t.after(()=>{try{db.close();}catch{}});
 const orgId=uid();
 db.prepare('INSERT INTO organizations VALUES(?,?,?,?,?,1,?,?)').run(orgId,'가상 새빛초등학교','DEMO-001','PUBLIC_SCHOOL','강서구','합성 시연기관',now());
 const demoUser=addUser(db,{orgId,name:'물품 담당자',email:'staff1@demo.local',password:'DemoTrade!2026',role:'EDITOR'});
 return {dir,db,orgId,demoUser};
}

async function serve(t,db,dir){
 const origin='http://localhost:4310',app=createApp(db,{dataDir:dir,origin,demo:true});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 return {origin,login:(email,password)=>fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})})};
}

test('운영자 환경값이 없으면 아무 계정도 바꾸지 않는다',async t=>{
 const {db,demoUser}=setup(t);
 assert.deepEqual(ensureDemoOperator(db,{}),{configured:false,created:false,disabled:0});
 assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get(demoUser).active,1);
});

test('아이디·비밀번호는 함께 설정해야 한다',async t=>{
 const {db}=setup(t);
 assert.throws(()=>ensureDemoOperator(db,{adminId:'demo-op'}),/ADMIN_PASSWORD/);
 assert.throws(()=>ensureDemoOperator(db,{adminPassword:'Secret!26'}),/ADMIN_ID/);
 assert.throws(()=>ensureDemoOperator(db,{adminId:'ab',adminPassword:'Secret!26'}),/3~80자/);
 assert.throws(()=>ensureDemoOperator(db,{adminId:'demo op',adminPassword:'Secret!26'}),/3~80자/);
 assert.throws(()=>ensureDemoOperator(db,{adminId:'demo-op',adminPassword:'123'}),/6~200자/);
});

test('환경 계정만 로그인되고 시연 기관 계정은 차단된다',async t=>{
 const {db,dir,demoUser}=setup(t);
 const first=ensureDemoOperator(db,{adminId:'demo-op',adminPassword:'Secret!26'});
 assert.equal(first.configured,true);
 assert.equal(first.created,true);
 assert.equal(first.disabled,1);
 const operator=db.prepare('SELECT * FROM users WHERE email=?').get('demo-op');
 assert.equal(operator.role,'EDITOR');
 assert.equal(operator.active,1);
 assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get(demoUser).active,0);
 const again=ensureDemoOperator(db,{adminId:'demo-op',adminPassword:'Secret!26'});
 assert.equal(again.created,false);
 assert.equal(again.disabled,0);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,3);
 const reviewer=db.prepare('SELECT role,active,org_id FROM users WHERE email=?').get('demo-op.reviewer@demo.internal');
 assert.equal(reviewer.role,'REVIEWER');
 assert.equal(reviewer.active,0);
 assert.equal(reviewer.org_id,operator.org_id);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='DEMO_OPERATOR_READY'").get().n,1);
 const {login}=await serve(t,db,dir);
 const ok=await login('demo-op','Secret!26');
 assert.equal(ok.status,200);
 const body=await ok.json();
 assert.equal(body.user.role,'EDITOR');
 assert.equal(body.user.email,'demo-op');
 assert.equal(body.user.testAccount,false);
 const blocked=await login('staff1@demo.local','DemoTrade!2026');
 assert.equal(blocked.status,401);
 const wrong=await login('demo-op','wrong-password');
 assert.equal(wrong.status,401);
});

test('이메일 형식 계정도 같은 경로로 계속 로그인할 수 있다',async t=>{
 const {db,dir}=setup(t);
 const email='operator@example.org';
 const orgId=db.prepare('SELECT org_id FROM users LIMIT 1').get().org_id;
 addUser(db,{orgId,name:'운영자',email,password:'Operator!2611',role:'EDITOR'});
 ensureDemoOperator(db,{adminId:'demo-op',adminPassword:'Secret!26'});
 const {login}=await serve(t,db,dir);
 assert.equal((await login(email,'Operator!2611')).status,200);
});
