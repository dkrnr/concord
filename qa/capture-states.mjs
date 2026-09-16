import { chromium } from '../../../node_modules/playwright/index.mjs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const url=process.argv[2]||'http://127.0.0.1:4192',out=path.resolve('qa/states');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const desktop=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
await desktop.goto(url,{waitUntil:'networkidle'});await desktop.screenshot({path:path.join(out,'home.png'),fullPage:false});
await desktop.getByRole('button',{name:'Scenes'}).first().click();await desktop.getByLabel('Describe your scene').fill('Make it comfortable when I sleep');await desktop.getByRole('button',{name:/Make the rule/}).click();await desktop.getByText('Concord understood').waitFor();await desktop.screenshot({path:path.join(out,'scene-receipt.png'),fullPage:false});
await desktop.getByLabel('Describe your scene').fill('Lock the doors when everyone leaves');await desktop.getByRole('button',{name:/Make the rule/}).click();await desktop.getByRole('heading',{name:'Safety has the right of way'}).waitFor();await desktop.screenshot({path:path.join(out,'safety-conflict.png'),fullPage:false});await desktop.getByRole('button',{name:'Cancel'}).click();
await desktop.getByRole('button',{name:'Access'}).first().click();await desktop.getByRole('button',{name:/Create pass/}).click();await desktop.getByRole('img',{name:/QR code/}).waitFor();await desktop.screenshot({path:path.join(out,'visitor-pass.png'),fullPage:false});
await desktop.getByRole('button',{name:'Operator',exact:true}).click();await desktop.getByRole('heading',{name:'Good evening, front desk.'}).waitFor();await desktop.screenshot({path:path.join(out,'operator.png'),fullPage:false});
const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true});await mobile.goto(url,{waitUntil:'networkidle'});await mobile.getByText('Why feed').scrollIntoViewIfNeeded();await mobile.screenshot({path:path.join(out,'mobile-why.png'),fullPage:false});
const reduced=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});await reduced.goto(url,{waitUntil:'networkidle'});await reduced.screenshot({path:path.join(out,'reduced-motion.png'),fullPage:false});
await browser.close();console.log(`Captured interaction states in ${out}`);
