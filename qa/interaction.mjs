import { chromium } from '../../../node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const url = process.argv[2] || 'http://127.0.0.1:4192';
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Good evening, Maria.' }).waitFor();
assert.equal(await page.locator('canvas').count(), 1);

await page.getByRole('button', { name: 'Keep', exact: true }).click();
await page.getByText('Kept as is').first().waitFor();

await page.getByRole('button', { name: 'Scenes' }).first().click();
await page.getByLabel('Describe your scene').fill('Lock the doors when everyone leaves');
await page.getByRole('button', { name: /Make the rule/ }).click();
await page.getByRole('heading', { name: 'Safety has the right of way' }).waitFor();
await page.getByRole('button', { name: /Use safe adjustment/ }).click();
await page.getByText('Scene ready').waitFor();

await page.getByRole('button', { name: 'Access' }).first().click();
await page.getByLabel('Name or service').fill('Amaya');
await page.getByRole('button', { name: /Create pass/ }).click();
await page.getByRole('img', { name: /QR code for Amaya/ }).waitFor();
assert.match(await page.getByRole('img', { name: /QR code for Amaya/ }).getAttribute('src'), /pass-qr\.svg/);

await page.getByRole('button', { name: /Emergency/ }).first().click();
await page.getByRole('button', { name: 'Send help request now' }).click();
await page.getByRole('heading', { name: 'Help request sent' }).waitFor();
await page.getByRole('button', { name: 'Close dialog' }).click();

await page.getByRole('button', { name: 'Operator', exact: true }).click();
await page.getByRole('heading', { name: 'Good evening, front desk.' }).waitFor();
assert.equal(await page.getByText('Resident activity stays private.').count(), 1);

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
mobile.on('pageerror', (error) => errors.push(error.message));
await mobile.goto(url, { waitUntil: 'networkidle' });
assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
await mobile.getByRole('button', { name: 'Scenes' }).last().click();
await mobile.getByRole('heading', { name: 'Say how you want home to feel.' }).waitFor();
await mobile.getByRole('button', { name: 'Home' }).last().click();
await mobile.getByText('Why feed').scrollIntoViewIfNeeded();
await mobile.getByRole('heading', { name: 'What home noticed' }).waitFor();

assert.deepEqual(errors, []);
await browser.close();
console.log('PASS resident correction, conflict, pass, SOS, operator privacy, mobile navigation');
