import {test,expect,type Page} from '@playwright/test';
import {makeOzd,syntheticRows} from '../fixtures/native-ozd.mjs';
async function login(page:Page){await page.goto('/');await page.getByLabel('이메일',{exact:true}).fill('staff1@demo.local');await page.getByLabel('비밀번호',{exact:true}).fill('DemoTrade!2026');await page.getByRole('button',{name:'기관 계정으로 로그인'}).click();await expect(page.getByRole('heading',{name:'AI 물품검색',exact:true})).toBeVisible();}
test('크기·수량 변경 시 적재 배치와 운송횟수·예시 가격 자동 재계산',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await login(page);await page.goto('/#/packing');
 await expect(page.getByRole('heading',{name:'트럭 적재·배송비'})).toBeVisible();await expect(page.locator('.packing-option')).toHaveCount(3);
 await expect(page.getByRole('img',{name:'트럭 적재함 위쪽 배치'})).toBeVisible();
 const old=await page.locator('.packing-total').textContent();await page.getByLabel('수량',{exact:true}).fill('80');
 await expect(page.locator('.packing-total')).not.toHaveText(old!);await expect(page.locator('.packing-option').first()).toContainText('80개');
 await page.getByRole('button',{name:'물품 추가'}).click();await expect(page.locator('.packing-item')).toHaveCount(2);
 await page.locator('.packing-item').nth(1).getByLabel('물품 이름').fill('책상');await page.locator('.packing-item').nth(1).getByLabel('가로 (cm)').fill('140');
 await expect(page.locator('.packing-option')).toHaveCount(3);await page.screenshot({path:'test-results/packing-desktop.png',fullPage:true});
 await page.locator('.packing-item').nth(1).getByLabel('높이 (cm)').fill('1900');await expect(page.getByRole('alert')).toContainText('실을 수 있는');expect(errors).toEqual([]);
});
test('담당자가 필요한 항목만 수정하고 최종 확인, 공개나 원본 상태 변경은 없음',async({page})=>{
 await login(page);await page.goto('/#/ai-register');
 const rows=syntheticRows().map(r=>({...r,THNG_NM:r.THNG_NM+' 확인수정전용',REQRE_INQIRE_SN:'711'}));
 await page.getByTestId('ai-document-upload').setInputFiles({name:'부분수정_확인.ozd',mimeType:'application/octet-stream',buffer:makeOzd({rows})});
 await expect(page.getByTestId('confirm-registration')).toBeEnabled({timeout:30000});
 const first=page.locator('.registration-card').first();await first.getByRole('button',{name:'필요한 항목 수정'}).click();
 await expect(page.getByTestId('confirm-registration')).toBeDisabled();await first.getByLabel('표시 품명').fill('검수한 가구');
 await first.getByRole('button',{name:'수정 저장'}).click();await expect(first.getByRole('heading',{name:'검수한 가구'})).toBeVisible();
 await first.locator('summary').click();await expect(first).toContainText('폐품');await page.getByTestId('confirm-registration').click();
 await expect(page.getByTestId('registration-completed')).toContainText('등록 완료');await page.getByRole('link',{name:'1번 물품·현물사진 확인'}).click();
 await expect(page.getByLabel('물품 이름 *',{exact:true})).toHaveValue('검수한 가구');
});
test('390px에서 계산 결과와 확인 등록 버튼이 화면을 넘지 않음',async({page})=>{
 await page.setViewportSize({width:390,height:844});await login(page);await page.goto('/#/packing');await expect(page.locator('.packing-option')).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();await page.screenshot({path:'test-results/packing-mobile.png',fullPage:true});
 await page.goto('/#/ai-register');await expect(page.getByTestId('ai-document-upload-dropzone')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
