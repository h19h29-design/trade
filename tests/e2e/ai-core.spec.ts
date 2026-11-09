import {test,expect,type Page} from '@playwright/test';
import {makeOzd,syntheticRows} from '../fixtures/native-ozd.mjs';
import {demandWorkbook} from '../fixtures/v07-external-server.mjs';
import {startAiTestServer} from '../fixtures/ai-core-server.mjs';
const autoRows=syntheticRows().map(row=>({...row,THNG_NM:row.THNG_NM+' AI자동등록전용'}));
const autoOzd=()=>makeOzd({rows:autoRows});
async function signIn(page:Page,email='staff2@demo.local',url='/'){
 await page.goto(url);await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill('DemoTrade!2026');await page.getByRole('button',{name:'기관 계정으로 로그인'}).click();await expect(page.getByRole('heading',{name:'AI 물품검색',exact:true})).toBeVisible();
}
async function hash(page:Page,path:string){await page.evaluate(path=>{location.hash=path;},path);}
async function drop(page:Page,bytes:Buffer,name:string){const data=await page.evaluateHandle(({bytes,name})=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(bytes)],name,{type:'application/octet-stream'}));return d;},{bytes:Array.from(bytes),name});await page.getByTestId('ai-document-upload-dropzone').dispatchEvent('drop',{dataTransfer:data});await data.dispose();}
test('AI 중심 첫화면: 오늘 할 일 제거·상단 세 기능·근거접기·추천 장단점',async({page})=>{
 await signIn(page);await expect(page.getByRole('navigation',{name:'AI 주요 기능'}).getByRole('link')).toHaveCount(3);await expect(page.getByText('오늘 할 일',{exact:true})).toHaveCount(0);
 await page.getByLabel('찾는 물품과 사용 조건').fill('회의용 의자 20개');await page.getByRole('button',{name:'조건에 맞게 찾아줘'}).click();
 await expect(page.getByTestId('ai-result').first()).toBeVisible();await expect(page.getByTestId('ai-result').first()).toContainText('맞는 점');await expect(page.getByTestId('ai-result').first()).toContainText('배송비 확인 필요');
 await expect(page.locator('.ai-evidence[open]')).toHaveCount(0);await page.getByTestId('ai-result').first().locator('summary').click();await expect(page.locator('.ai-score-parts').first()).toBeVisible();
 await page.screenshot({path:'test-results/ai-search-desktop.png',fullPage:true});
});
test('OZD 하나 드래그로 자동등록·원본 폐품 보존·중복없음·이력 재개',async({page})=>{
 await signIn(page,'staff1@demo.local');await hash(page,'/ai-register');await expect(page.getByRole('heading',{name:'AI 물품등록',exact:true})).toBeVisible();await drop(page,autoOzd(),'합성_자동등록.ozd');
 await expect(page.getByText('자동 등록 완료 · 현물·증빙 확인 필요',{exact:true})).toBeVisible({timeout:30000});await expect(page.locator('.ai-import-row')).toHaveCount(2);await expect(page.locator('.ai-import-status')).toContainText('초안 2묶음');
 const links=await page.locator('.ai-import-row>a').evaluateAll(a=>a.map(n=>n.getAttribute('href')));
 await page.screenshot({path:'test-results/ai-registration-desktop.png',fullPage:true});
 await drop(page,autoOzd(),'합성_자동등록.ozd');await expect(page.getByText('자동 등록 완료 · 현물·증빙 확인 필요',{exact:true})).toBeVisible({timeout:30000});
 expect(await page.locator('.ai-import-row>a').evaluateAll(a=>a.map(n=>n.getAttribute('href')))).toEqual(links);
 await page.locator('.ai-import-row>a').first().click();await expect(page.getByText('비공개 작성',{exact:true})).toBeVisible();
 const path=new URL(page.url()).hash.slice(1).replace(/\/edit$/,'');const row=await (await page.request.get('/api'+path)).json();expect(row.state).toBe('DRAFT');expect(row.sourceSummary.rows[0].condition).toBe('폐품');
});
test('AI 엑셀등록도 수동확인 버튼 없이 원본 초안 생성',async({page})=>{
 await signIn(page,'staff1@demo.local');await hash(page,'/ai-register');await page.getByTestId('ai-document-upload').setInputFiles({name:'합성_자동등록.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:demandWorkbook()});
 await expect(page.getByText('자동 등록 완료 · 현물·증빙 확인 필요',{exact:true})).toBeVisible({timeout:30000});await expect(page.locator('.ai-import-row')).toHaveCount(1);await expect(page.locator('.ai-import-row')).toContainText('원본으로 등록');
});
test('AI 검색 없는물품·잘못된업로드·모바일 390px',async({page})=>{
 await page.setViewportSize({width:390,height:844});await signIn(page);await page.getByLabel('찾는 물품과 사용 조건').fill('우주선용 플라즈마 분광기');await page.getByRole('button',{name:'조건에 맞게 찾아줘'}).click();await expect(page.getByText('조건에 맞는 후보 0건',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();await page.locator('.bottom-nav').getByRole('link',{name:'AI 등록'}).click();await expect(page.getByRole('heading',{name:'AI 물품등록',exact:true})).toBeVisible();await drop(page,Buffer.from('not a file'),'잘못된파일.txt');await expect(page.getByRole('alert')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await page.screenshot({path:'test-results/ai-mobile.png',fullPage:true});
});
test('승인된 AI·주소·도로API 연계로 점수·설명·배송예상 통합 (공급자 대역)',async({page})=>{
 const server=await startAiTestServer();try{
 await signIn(page,'staff2@demo.local',server.url);await page.getByLabel('찾는 물품과 사용 조건').fill('강당 의자 10개');await page.getByLabel(/검색 문장과 공개 물품의 최소 정보/).check();
 await page.getByText('수량·지역·배송 조건 자세히 설정',{exact:true}).click();await page.getByLabel('받는 기관 배송지',{exact:true}).fill('합성기관 주소');await page.getByLabel('입력 주소를 주소검색 서비스에 보내는 데 동의합니다.').check();await page.getByRole('button',{name:'주소 찾기',exact:true}).click();await page.getByRole('button',{name:'합성 배송 기관',exact:true}).click();await page.getByLabel(/출발·도착 좌표를 경로 API/).check();
 await page.getByRole('button',{name:'조건에 맞게 찾아줘'}).click();await expect(page.getByTestId('ai-result').first()).toBeVisible({timeout:20000});await expect(page.locator('.ai-generated-summary').first()).toContainText('등록된 물품');await expect(page.locator('.ai-delivery').first()).toContainText('확정 견적 아님');await expect(page.locator('.ai-delivery').first()).toContainText('25km');expect(server.calls.ai).toBeGreaterThanOrEqual(2);expect(server.calls.route).toBeGreaterThanOrEqual(1);
 }finally{await page.goto('about:blank');await server.close();}
});
