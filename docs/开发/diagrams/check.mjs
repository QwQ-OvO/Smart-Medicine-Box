// Render SVGs with the repository's Playwright; check text bounds and local links.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url));
const output=resolve(dir,'../../../artifacts/product-diagrams');
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {
 for(const name of ['01-product-overview','02-system-data-flow','03-search-decisions','04-recording-swimlane']){
  const page=await browser.newPage({viewport:{width:1440,height:1500},deviceScaleFactor:1});
  await page.goto(pathToFileURL(resolve(dir,name+'.svg')).href);
  await page.evaluate(()=>document.fonts.ready);
  const issues=await page.evaluate(()=>{
   if(document.querySelector('parsererror'))return ['SVG XML parse error'];
   const root=document.documentElement, vb=root.viewBox.baseVal;
   // Edge labels may span lanes; square lane backgrounds are not text containers.
   const rectangles=[...document.querySelectorAll('rect')].filter(r=>Number(r.getAttribute('rx'))>0).map(r=>r.getBBox());
   return [...document.querySelectorAll('text')].flatMap(t=>{
    const b=t.getBBox(),x=Number(t.getAttribute('x')),y=Number(t.getAttribute('y'));
    const containers=rectangles.filter(r=>x>=r.x+10&&x<r.x+r.width-10&&y>r.y+10&&y<r.y+r.height-10).sort((a,b)=>a.width*a.height-b.width*b.height);
    const c=containers[0];
    return b.x<0||b.y<0||b.x+b.width>vb.width||b.y+b.height>vb.height||c&&(b.x+b.width>c.x+c.width-6||b.y+b.height>c.y+c.height-4)?[{text:t.textContent,bounds:{x:b.x,y:b.y,w:b.width,h:b.height},container:c?{x:c.x,y:c.y,w:c.width,h:c.height}:null}]:[];
   });
  });
  await page.locator('svg').screenshot({path:resolve(output,name+'.png')});
  results.push({name,issues});await page.close();
 }
 const md=resolve(dir,'../当前产品图解.md');
 const links=[...readFileSync(md,'utf8').matchAll(/\]\(([^)]+)\)/g)].map(m=>m[1]);
 results.push({brokenLinks:links.filter(l=>!existsSync(resolve(dirname(md),l)))});
 writeFileSync(resolve(output,'checks.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.issues?.length||r.brokenLinks?.length))process.exitCode=1;
} finally {await browser.close();}
