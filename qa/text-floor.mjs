import { chromium } from '../../../node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.argv[2] || 'http://127.0.0.1:4192', { waitUntil: 'networkidle' });

async function scan(label) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const ownText = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim());
      return ownText && rect.width && rect.height && style.visibility !== 'hidden' && parseFloat(style.fontSize) < 16;
    })
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      className: typeof element.className === 'string' ? element.className.split(' ').slice(0, 2).join('.') : '',
      text: [...element.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent?.trim()).join(' ').slice(0, 55),
      px: getComputedStyle(element).fontSize,
    })));
  console.log(label, JSON.stringify(bad, null, 2));
  if (bad.length) process.exitCode = 1;
}

await scan('home');
await page.getByRole('button', { name: 'Scenes' }).first().click();
await page.getByRole('heading', { name: 'Say how you want home to feel.' }).waitFor();
await scan('scenes');
await page.getByRole('button', { name: 'Access' }).first().click();
await page.getByRole('heading', { name: 'A key that knows when to leave.' }).waitFor();
await scan('access');
await page.getByRole('button', { name: 'Operator', exact: true }).click();
await page.getByRole('heading', { name: 'Good evening, front desk.' }).waitFor();
await scan('operator');

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mobile.goto(process.argv[2] || 'http://127.0.0.1:4192', { waitUntil: 'networkidle' });
const mobileBad = await mobile.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const ownText = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim());
    return ownText && rect.width && rect.height && style.visibility !== 'hidden' && parseFloat(style.fontSize) < 16;
  }).map((element) => ({ text: element.textContent?.trim().slice(0, 55), px: getComputedStyle(element).fontSize })));
console.log('mobile', JSON.stringify(mobileBad, null, 2));
if (mobileBad.length) process.exitCode = 1;
await browser.close();
