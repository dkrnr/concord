import type { ConcordAdapter, RuleProposal } from './adapter';
import type { CapabilityGrant, Conflict, Device, Event, Rule, SosEvent, WhyCard, WhyOverride } from '../domain/contracts';

const APARTMENT = 'apt_401';
const wait = (ms = 360) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const copy = <T,>(value: T): T => structuredClone(value);
const now = () => new Date().toISOString();

let devices: Device[] = [
  { id: 'dev_light_living', type: 'light', apartmentId: APARTMENT, state: { on: true, brightness: 32, room: 'living' }, lastUpdated: now() },
  { id: 'dev_curtain_living', type: 'curtain', apartmentId: APARTMENT, state: { openPercent: 18, room: 'living' }, lastUpdated: now() },
  { id: 'dev_ac_bedroom', type: 'ac', apartmentId: APARTMENT, state: { on: true, temperature: 24, room: 'bedroom' }, lastUpdated: now() },
  { id: 'dev_lock_401', type: 'lock', apartmentId: APARTMENT, state: { locked: true, room: 'entry' }, lastUpdated: now() },
  { id: 'dev_smoke_401', type: 'smoke', apartmentId: APARTMENT, state: { alarm: false, ppm: 4, room: 'kitchen' }, lastUpdated: now() },
  { id: 'dev_occ_401', type: 'occupancy', apartmentId: APARTMENT, state: { occupied: true }, lastUpdated: now() },
];

let rules: Rule[] = [
  { id: 'rule_evening', apartmentId: APARTMENT, name: 'Settle the living room after sunset', sourceSentence: 'soften the living room in the evening', trigger: { kind: 'time', at: '18:15' }, conditions: [{ field: 'value.occupied', op: 'eq', value: true }], actions: [{ deviceType: 'light', deviceId: 'dev_light_living', set: { on: true, brightness: 32 } }, { deviceType: 'curtain', deviceId: 'dev_curtain_living', set: { openPercent: 18 } }], enabled: true, createdAt: '2026-09-16T12:15:00Z' },
  { id: 'rule_smoke', apartmentId: APARTMENT, name: 'Unlock on smoke', sourceSentence: 'unlock doors on smoke alarm', trigger: { kind: 'event', eventType: 'smoke.alarm' }, conditions: [{ field: 'value.alarm', op: 'eq', value: true }], actions: [{ deviceType: 'lock', deviceId: 'all', set: { locked: false } }], enabled: true, createdAt: '2026-09-16T09:00:00Z' },
];

let whyCards: WhyCard[] = [
  { id: 'why_evening', apartmentId: APARTMENT, ruleId: 'rule_evening', action: 'Softened the living room', reason: 'You usually settle in here after sunset, and the apartment is occupied.', evidence: [{ deviceId: 'dev_light_living', field: 'state.brightness', value: 32 }, { deviceId: 'dev_curtain_living', field: 'state.openPercent', value: 18 }], timestamp: '2026-09-16T18:17:00+05:30', status: 'executed', overrideOptions: ['keep', 'not_tonight', 'never'], resolvedOverride: null },
  { id: 'why_entry', apartmentId: APARTMENT, ruleId: 'rule_arrival', action: 'Kept the entry locked', reason: 'No valid visitor passes are active and the door has stayed closed.', evidence: [{ deviceId: 'dev_lock_401', field: 'state.locked', value: true }], timestamp: '2026-09-16T18:09:00+05:30', status: 'executed', overrideOptions: ['keep', 'not_tonight', 'never'], resolvedOverride: 'keep' },
];

let grants: CapabilityGrant[] = [];
let feed: ({ kind: 'event'; data: Event } | { kind: 'why_card'; data: WhyCard } | { kind: 'sos_event'; data: SosEvent })[] = [];

const conflictFor = (rule: Rule): Conflict => ({
  id: 'conf_safety_' + rule.id,
  apartmentId: APARTMENT,
  ruleA: rule.id,
  ruleB: 'rule_smoke',
  reason: `“${rule.name}” would lock the entry while “Unlock on smoke” must release it during an alarm.`,
  resolutionOptions: [{ type: 'edit_condition', label: 'Exclude smoke-alarm state' }],
  detectedAt: now(),
});

export const mockAdapter: ConcordAdapter = {
  async fetchDevices() { await wait(180); return copy(devices); },
  async fetchRules() { await wait(180); return copy(rules); },
  async fetchGrants() { await wait(180); return copy(grants); },
  async fetchWhyCards() { await wait(180); return copy(whyCards); },
  async commandDevice({ deviceId, set }) {
    await wait(240);
    const device = devices.find((item) => item.id === deviceId);
    if (!device) throw new Error('Device is no longer available.');
    device.state = { ...device.state, ...set };
    device.lastUpdated = now();
    const event: Event = { id: 'evt_' + Date.now(), deviceId, type: `${device.type}.changed`, value: set, timestamp: device.lastUpdated, apartmentId: device.apartmentId };
    feed.push({ kind: 'event', data: event });
    return { event: copy(event), whyCards: [] };
  },
  async approveWhyCard({ whyCardId }) {
    await wait(320);
    const card = whyCards.find((item) => item.id === whyCardId);
    if (!card || card.status !== 'proposed') throw new Error('This proposal is no longer waiting.');
    const rule = rules.find((item) => item.id === card.ruleId);
    if (rule) for (const action of rule.actions) {
      for (const device of devices.filter((item) => action.deviceId === 'all' ? item.type === action.deviceType : item.id === action.deviceId)) {
        device.state = { ...device.state, ...action.set };
        device.lastUpdated = now();
      }
    }
    card.status = 'executed';
    card.timestamp = now();
    feed.push({ kind: 'why_card', data: card });
    return copy(card);
  },
  async dismissWhyCard({ whyCardId }) {
    await wait(260);
    const card = whyCards.find((item) => item.id === whyCardId);
    if (!card || card.status !== 'proposed') throw new Error('This proposal is no longer waiting.');
    card.resolvedOverride = 'not_tonight';
    feed.push({ kind: 'why_card', data: card });
    return copy(card);
  },
  async submitSentence({ sentence }): Promise<RuleProposal> {
    await wait(620);
    const lockIntent = /lock|door/i.test(sentence);
    const rule: Rule = lockIntent ? {
      id: 'draft_lock_' + Date.now(), apartmentId: APARTMENT, name: 'Lock the entry when everyone leaves', sourceSentence: sentence,
      trigger: { kind: 'event', eventType: 'occupancy.changed' }, conditions: [{ field: 'value.occupied', op: 'eq', value: false }],
      actions: [{ deviceType: 'lock', deviceId: 'all', set: { locked: true } }], enabled: true, createdAt: now(),
    } : {
      id: 'draft_sleep_' + Date.now(), apartmentId: APARTMENT, name: 'Prepare the bedroom for sleep', sourceSentence: sentence,
      trigger: { kind: 'time', at: '22:30' }, conditions: [{ field: 'value.occupied', op: 'eq', value: true }],
      actions: [{ deviceType: 'ac', deviceId: 'dev_ac_bedroom', set: { on: true, temperature: 23 } }, { deviceType: 'curtain', deviceId: 'dev_curtain_living', set: { openPercent: 0 } }], enabled: true, createdAt: now(),
    };
    return { rule, conflicts: lockIntent ? [conflictFor(rule)] : [] };
  },
  async saveRule({ rule, resolutions }) {
    await wait(520);
    const safeRule = resolutions.some((r) => r.type === 'edit_condition')
      ? { ...rule, conditions: [...rule.conditions, { field: 'devices.smoke.alarm', op: 'eq' as const, value: false }] }
      : rule;
    rules = [...rules.filter((item) => item.id !== safeRule.id), safeRule];
    return { status: 'saved' as const, rule: copy(safeRule) };
  },
  async postWhyOverride({ whyCardId, override }) {
    await wait(420);
    const index = whyCards.findIndex((card) => card.id === whyCardId);
    if (index < 0) throw new Error('This activity is no longer available.');
    const updated = { ...whyCards[index], resolvedOverride: override as WhyOverride };
    whyCards[index] = updated;
    if (override === 'never') rules = rules.map((rule) => rule.id === updated.ruleId ? { ...rule, enabled: false } : rule);
    feed.push({ kind: 'why_card', data: updated });
    return copy(updated);
  },
  async createGrant({ grant }) { await wait(500); const saved = { ...grant, id: 'grant_' + Date.now() }; grants = [saved, ...grants]; return copy(saved); },
  async triggerSos({ apartmentId }) { await wait(580); const event: SosEvent = { id: 'sos_' + Date.now(), apartmentId, triggeredBy: 'resident_maria', type: 'manual', status: 'active', escalatedTo: 'operator_desk_1', timestamp: now() }; feed.push({ kind: 'sos_event', data: event }); return copy(event); },
  async pollFeed({ cursor }) { await wait(200); const start = Number(cursor ?? 0); return { items: copy(feed.slice(start)), cursor: String(feed.length), hasMore: false, reset: cursor === undefined }; },
};
