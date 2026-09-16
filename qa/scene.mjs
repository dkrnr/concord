import assert from 'node:assert/strict';
import { chromium } from '../../../node_modules/playwright/index.mjs';

const url = process.argv[2] || 'http://127.0.0.1:4192';
const browser = await chromium.launch({ headless: true });

const live = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await live.goto(url, { waitUntil: 'networkidle' });
let snapshot = await live.evaluate(() => window.__STUDIO_QA__?.snapshot?.());
assert.equal(snapshot?.renderer, 'webgl');
assert.equal(snapshot?.room, 'all');
await live.locator('.room-tabs button').filter({ hasText: 'living' }).click();
await live.waitForTimeout(650);
snapshot = await live.evaluate(() => window.__STUDIO_QA__?.snapshot?.());
assert.equal(snapshot?.room, 'living');

const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await reduced.goto(url, { waitUntil: 'networkidle' });
snapshot = await reduced.evaluate(() => window.__STUDIO_QA__?.snapshot?.());
assert.equal(snapshot?.renderer, 'webgl');
assert.equal(snapshot?.reducedMotion, true);

const fallbackUrl = new URL(url);
fallbackUrl.searchParams.set('renderer', 'fallback');
const fallback = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await fallback.goto(fallbackUrl.href, { waitUntil: 'networkidle' });
snapshot = await fallback.evaluate(() => window.__STUDIO_QA__?.snapshot?.());
assert.equal(snapshot?.renderer, 'fallback');
assert.equal(await fallback.locator('canvas').count(), 0);
assert.equal(await fallback.getByRole('img', { name: /Floor plan focused/ }).count(), 1);
await fallback.locator('.room-tabs button').filter({ hasText: 'bedroom' }).click();
snapshot = await fallback.evaluate(() => window.__STUDIO_QA__?.snapshot?.());
assert.equal(snapshot?.room, 'bedroom');
assert.equal(await fallback.getByRole('button', { name: 'Keep' }).count(), 1);

await browser.close();
console.log('PASS WebGL room focus, reduced motion, and functional SVG fallback');
