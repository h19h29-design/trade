import {test,expect,type Page} from '@playwright/test';
async function login(page:Page){
 await page.goto('/');await expect(page).toHaveTitle(/쓸모잇다/);
 await page.getByLabel('이메일',{exact:true}).fill('staff1@demo.local');await page.getByLabel('비밀번호',{exact:true}).fill('DemoTrade!2026');await page.getByRole('button',{name:'기관 계정으로 로그인'}).click();
 await expect(page.getByRole('heading',{name:'AI 물품검색',exact:true})).toBeVisible();
}
async function addMonitor(page:Page){
 await page.goto('/#/market');const card=page.locator('.lot-card').filter({has:page.getByRole('heading',{name:'24인치 모니터 · 화면 확인 완료'})});await expect(card).toBeVisible();await card.getByRole('button',{name:'가져올 물품 담기'}).click();
 await page.locator('.transport-cart-link').click();await expect(page.getByRole('heading',{name:'가져올 물품·운송비',exact:true})).toBeVisible();
}
test('새 쓸모잇다 브랜드→타기관 물품 담기→수량·주소→운송비·차량 비교·근거 접기',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning'){const initialAuthProbe=m.text().includes('401')&&m.location().url.endsWith('/api/auth/me');if(!initialAuthProbe)errors.push('console: '+m.text()+' '+m.location().url);}});
 await login(page);await expect(page.locator('.sidebar .ssulmo-brand')).toHaveAttribute('aria-label','쓸모잇다');await addMonitor(page);
 await page.getByRole('spinbutton',{name:'24인치 모니터 · 화면 확인 완료 가져올 수량'}).fill('3');
 await page.getByLabel('받을 주소',{exact:true}).fill('서울 마포구');await page.getByRole('button',{name:'주소 확인',exact:true}).last().click();
 await expect(page.locator('.transport-destination .transport-location')).toContainText('대표점');
 await page.getByRole('button',{name:'예상 운송비 계산',exact:true}).click();
 await expect(page.locator('.transport-total h2')).toContainText('원',{timeout:20000});
 await expect(page.locator('.transport-result-disclaimer')).toContainText('확정 견적이 아닙니다');
 if(process.env.TRANSPORT_CAPTURE_DIR)await page.screenshot({path:process.env.TRANSPORT_CAPTURE_DIR+'/transport-desktop.png',fullPage:true,animations:'disabled'});
 const first=await page.locator('.transport-total h2').textContent();
 await expect(page.locator('.transport-result-group .transport-detail')).not.toHaveAttribute('open','');
 await page.locator('.transport-truck-options button').last().click();await expect(page.locator('.transport-total h2')).not.toHaveText(first!);
 await page.getByText('트럭 배치와 계산 근거',{exact:true}).click();await expect(page.getByRole('img',{name:'트럭 적재함 위쪽 배치'})).toBeVisible();
 await expect(page.locator('.transport-cargo-facts')).toContainText('가정');
 await page.getByRole('spinbutton',{name:'24인치 모니터 · 화면 확인 완료 가져올 수량'}).fill('4');await expect(page.locator('.transport-total')).toHaveCount(0);
 await expect(page.locator('vite-error-overlay')).toHaveCount(0);expect(errors).toEqual([]);
});
test('카카오 공식 embed 콜백 → 지역 확인, 모바일390px·누락상품 수량 차단',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning'){const initialAuthProbe=m.text().includes('401')&&m.location().url.endsWith('/api/auth/me');if(!initialAuthProbe)errors.push('console: '+m.text()+' '+m.location().url);}});
 await page.setViewportSize({width:390,height:844});
 await page.route('https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:`window.kakao={Postcode:class{constructor(options){this.options=options;}embed(el){const b=document.createElement('button');b.textContent='합성 주소 선택';b.onclick=()=>this.options.oncomplete({roadAddress:'서울특별시 마포구 월드컵로 1',address:'서울 마포구',sido:'서울',sigungu:'마포구',zonecode:'04000'});el.appendChild(b);}}};`}));
 await login(page);await addMonitor(page);
 await page.locator('.transport-destination').getByRole('button',{name:'주소 검색'}).click();await page.getByRole('button',{name:'합성 주소 선택'}).click();
 await expect(page.locator('.transport-destination .transport-location')).toContainText('월드컵로 1');
 await page.getByRole('button',{name:'예상 운송비 계산',exact:true}).click();await expect(page.locator('.transport-total')).toBeVisible({timeout:20000});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 if(process.env.TRANSPORT_CAPTURE_DIR)await page.screenshot({path:process.env.TRANSPORT_CAPTURE_DIR+'/transport-mobile.png',fullPage:true,animations:'disabled'});
 await page.getByRole('spinbutton',{name:'24인치 모니터 · 화면 확인 완료 가져올 수량'}).fill('2000');
 await expect(page.getByRole('button',{name:'예상 운송비 계산',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('수량이 부족');
 await expect(page.locator('vite-error-overlay')).toHaveCount(0);expect(errors).toEqual([]);
});
test('물품 상세에서 고른 필요수량을 운송 선택으로 이어주며 등록·예약은 자동으로 하지 않음',async({page})=>{
 await login(page);await page.goto('/#/market');const card=page.locator('.lot-card').filter({has:page.getByRole('heading',{name:'24인치 모니터 · 화면 확인 완료'})});await card.locator('.card-title').click();
 await page.getByLabel('필요 수량',{exact:true}).fill('5');await page.getByRole('button',{name:'선택 수량 운송비 보기'}).click();
 await expect(page).toHaveURL(/#\/transport$/);await expect(page.getByRole('spinbutton',{name:'24인치 모니터 · 화면 확인 완료 가져올 수량'})).toHaveValue('5');
 await expect(page.locator('.transport-destination')).toContainText('예약/결제되지 않습니다');
 await page.reload();await expect(page.getByRole('spinbutton',{name:'24인치 모니터 · 화면 확인 완료 가져올 수량'})).toHaveValue('5');
});
