import {test,expect,type Page} from '@playwright/test';

async function signIn(page:Page,email='staff1@demo.local'){
 await page.goto('/');
 await page.getByLabel('이메일',{exact:true}).fill(email);
 await page.getByLabel('비밀번호',{exact:true}).fill('DemoTrade!2026');
 await page.getByRole('button',{name:'기관 계정으로 로그인'}).click();
 await expect(page.getByRole('heading',{name:'오늘 할 일',exact:true})).toBeVisible();
}
test('새 홈: 초안 건수와 총계가 일치하고 이어서 작성은 편집 화면으로 이동',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await signIn(page);
 await page.goto('/#/new');
 await page.getByLabel('물품 이름 *',{exact:true}).fill('디자인 감사 합성 초안');
 await page.getByRole('button',{name:'비공개 초안 저장',exact:true}).click();
 await expect(page).toHaveURL(/\/edit$/);
 const editUrl=page.url();
 await page.goto('/#/home');
 await expect(page.locator('.home-task').first()).toContainText('디자인 감사 합성 초안');
 await expect(page.locator('.home-task').first().locator('strong')).toHaveText(/^[1-9]\d*건$/);
 const cards=await page.locator('.home-task strong').allTextContents();
 const count=cards.reduce((sum,part)=>sum+Number(part.replace(/\D/g,'')),0);
 await expect(page.locator('.page-heading p')).toContainText('처리할 일 '+count+'건');
 await page.locator('.home-task').first().click();
 await expect(page).toHaveURL(editUrl);
 await expect(page.getByLabel('물품 이름 *',{exact:true})).toHaveValue('디자인 감사 합성 초안');
 expect(errors).toEqual([]);
});

test('진행 표시: 물품 게시와 인계는 별도 단계이며 완료되지 않은 단계를 완료라고 표현하지 않음',async({page})=>{
 await signIn(page);
 await page.goto('/#/new');
 await page.getByLabel('물품 이름 *',{exact:true}).fill('디자인 진행 단계 검수 물품');
 await page.getByRole('button',{name:'비공개 초안 저장',exact:true}).click();
 await expect(page).toHaveURL(/\/edit$/);
 const detail=page.url().replace(/\/edit$/,'');
 await page.goto(detail);
 const progress=page.getByRole('list',{name:/물품 등록·게시 진행/});
 await expect(progress.locator('li')).toHaveCount(3);
 await expect(progress).toContainText('게시 검토');
 await expect(progress).not.toContainText('인수');
 await expect(progress.locator('[aria-current="step"]')).toContainText('등록');
});

test('신규 디자인 모바일 홈·메뉴 및 OZD 등록 링크는 390px에서 정상 표시',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await signIn(page);
 await expect(page.locator('.bottom-nav').getByRole('link',{name:'홈'})).toBeVisible();
 const groups=await page.locator('.nav-group').count();
 expect(groups).toBe(5);
 await expect(page.locator('.home-task')).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await page.locator('.bottom-nav').getByRole('link',{name:'올리기'}).click();
 await expect(page.getByRole('heading',{name:'엑셀·OZD로 물품 올리기'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
