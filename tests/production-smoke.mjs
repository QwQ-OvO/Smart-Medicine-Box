import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3001';
assert.equal((await fetch(base+'/api/v1/health')).status,200);
assert.equal((await fetch(base+'/api/v1/unknown')).status,404);
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/record');
 await page.getByRole('button',{name:'直接手工填写'}).click();
 await page.getByLabel('药名',{exact:true}).fill('构建验证');
 await page.getByLabel('具体位置').fill('测试抽屉');
 await page.getByRole('button',{name:'继续核对'}).click();
 await page.getByRole('button',{name:'确认并保存'}).click();
 await page.waitForURL('**/clue/**');await page.reload();
 await page.getByRole('heading',{name:'测试抽屉'}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('Production smoke passed: health, API 404, SPA deep-link, save, reload, no page errors.');
}finally{await browser.close();}
