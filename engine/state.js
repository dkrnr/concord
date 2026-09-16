import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { APARTMENT, BUILDING_TZ, seedDevices, seedRules } from './seedState.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawSeedEvents = JSON.parse(readFileSync(join(__dirname, 'seed-events.json'), 'utf8'));

export { APARTMENT, BUILDING_TZ };

let seq = 1;
export const nextId = (prefix) => `${prefix}_${seq++}`;

export const store = {
  devices: [],
  rules: [],
  grants: [],
  whyCards: [],
  sosEvents: [],
  feed: [], // append-only FeedItem log backing pollFeed
  eventQueue: [], // remaining seeded events, fired one at a time
  notTonight: new Map(), // ruleId -> building-local date string ('YYYY-MM-DD')
  requestCache: new Map(), // requestId -> response (idempotency)
};

export function reset() {
  seq = 1;
  store.devices = seedDevices();
  store.rules = seedRules();
  store.grants = [];
  store.whyCards = [];
  store.sosEvents = [];
  store.feed = [];
  store.eventQueue = rawSeedEvents.map((e) => ({ ...e }));
  store.notTonight = new Map();
  store.requestCache = new Map();
}

reset();

export function localDateString(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: BUILDING_TZ }); // YYYY-MM-DD
}

export function localTimeString(date = new Date()) {
  return date.toLocaleTimeString('en-GB', { timeZone: BUILDING_TZ, hour: '2-digit', minute: '2-digit' });
}

export function pushFeed(item) {
  store.feed.push(item);
}
