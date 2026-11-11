import {test,expect} from '@playwright/test';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase} from '../../server/db.mjs';
import {ensureSingleDemo} from '../../server/demo-single.mjs';
import {seedAdditionalSamples} from '../../server/demo-samples.mjs';
import {createApp} from '../../server/app.mjs';

let dir:string,db:any,server:any,app:any;
const origin='http://127.0.0.1:4339';
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'trade-single-browser-'));
 db=openDatabase(join(dir,'trade.sqlite'));
 ensureSingleDemo(db);
 await seedAdditionalSamples(db,dir,{demo:true});
 app=createApp(db,{dataDir:dir,origin,demo:true,singleDemo:true});
 await new Promise(resolve=>{server=app.listen(4339,'127.0.0.1',resolve);});
});
test.afterAll(async()=>{
 if(server)await new Promise(resolve=>server.close(resolve));
 app?.locals?.closeRag?.();
 db?.close();if(dir)rmSync(dir,{recursive:true,force:true});
});
async function signIn(page:any,login='admin',password='1234'){
 await page.goto(origin);
 await page.getByLabel('아이디',{exact:true}).fill(login);
 await page.getByLabel('비밀번호',{exact:true}).fill(password);
 await page.getByRole('button',{name:'기관 계정으로 로그인'}).click();
 await expect(page.getByRole('heading',{name:'AI 물품검색',exact:true})).toBeVisible();
}
test('admin 단일 로그인 → 300건 가상검색 → 390px 모바일 검색 → 로그인정보 변경',async({page})=>{
 const pageErrors:string[]=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 await signIn(page);
 await page.goto(origin+'/#/market');
 await expect(page.locator('.result-heading h2')).toContainText('300');
 await page.getByLabel('물품 검색').fill('캐비넷');
 await expect(page.locator('.lot-card').first()).toBeVisible();
 const one=await page.locator('.result-heading h2').textContent();
 expect(one).toMatch(/[1-9]/);
 await page.getByLabel('물품 검색').fill('회의용 의자');
 await expect(page.locator('.lot-card').first()).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.goto(origin+'/#/settings');
 await expect(page.getByText('테스트 아이디·비밀번호 변경',{exact:true})).toBeVisible();
 await page.getByLabel('새 테스트 아이디').fill('testingadmin');
 await page.getByLabel('현재 테스트 비밀번호').fill('1234');
 await page.getByLabel('새 테스트 비밀번호').fill('TestingPassword!2026');
 await page.getByRole('button',{name:'계정 변경 후 다시 로그인'}).click();
 await expect(page.getByLabel('아이디',{exact:true})).toBeVisible();
 await page.getByLabel('아이디',{exact:true}).fill('admin');
 await page.getByLabel('비밀번호',{exact:true}).fill('1234');
 await page.getByRole('button',{name:'기관 계정으로 로그인'}).click();
 await expect(page.getByRole('alert')).toContainText('아이디 또는 비밀번호');
 await signIn(page,'testingadmin','TestingPassword!2026');
 expect(pageErrors).toEqual([]);
});
