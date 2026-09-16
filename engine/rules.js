import { applyEventToDevices } from './reducer.js';
import { store, nextId, APARTMENT, localDateString, localTimeString, pushFeed } from './state.js';
import { SAFETY_RULE_IDS } from './seedState.js';

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function evalCondition(cond, context) {
  const actual = resolvePath(context, cond.field);
  switch (cond.op) {
    case 'eq': return actual === cond.value;
    case 'neq': return actual !== cond.value;
    case 'gt': return actual > cond.value;
    case 'lt': return actual < cond.value;
    case 'gte': return actual >= cond.value;
    case 'lte': return actual <= cond.value;
    default: return false;
  }
}

function deviceStateByType(devices) {
  const map = {};
  for (const d of devices) if (!map[d.type]) map[d.type] = d.state;
  return map;
}

function conditionsPass(rule, event) {
  const context = { value: event.value, devices: deviceStateByType(store.devices) };
  return rule.conditions.every((c) => evalCondition(c, context));
}

function isSuppressedToday(ruleId) {
  return store.notTonight.get(ruleId) === localDateString();
}

export function matchRules(event) {
  return store.rules.filter((rule) =>
    rule.enabled &&
    rule.trigger.kind === 'event' &&
    rule.trigger.eventType === event.type &&
    !isSuppressedToday(rule.id) &&
    conditionsPass(rule, event));
}

function describeReason(rule, event) {
  if (rule.id === 'rule_lock_on_leave') {
    return `Everyone left the apartment at ${localTimeString()} (occupancy sensor went to unoccupied).`;
  }
  if (rule.id === 'rule_light_on_motion') {
    return `Motion detected in the ${event.value?.room ?? 'apartment'} at ${localTimeString()}.`;
  }
  if (rule.id === 'rule_smoke') {
    return `Smoke alarm triggered at ${localTimeString()} — doors unlock immediately for safety.`;
  }
  return `Rule "${rule.name}" fired because of ${event.type} at ${localTimeString()}.`;
}

// Applies a matched rule's actions as new Events. Action-events mutate devices
// but do not re-run matching/anomaly checks (they are the engine's own doing).
export function applyRule(rule, triggerEvent) {
  const actionEvents = [];
  const evidence = [];
  for (const action of rule.actions) {
    const targets = action.deviceId === 'all'
      ? store.devices.filter((d) => d.type === action.deviceType)
      : store.devices.filter((d) => d.id === action.deviceId);
    for (const target of targets) {
      const actionEvent = {
        id: nextId('evt'),
        deviceId: target.id,
        type: `${action.deviceType}.changed`,
        value: action.set,
        timestamp: new Date().toISOString(),
        apartmentId: APARTMENT,
      };
      applyEventToDevices(actionEvent, store.devices);
      actionEvents.push(actionEvent);
      pushFeed({ kind: 'event', data: actionEvent });
      for (const [field, value] of Object.entries(action.set)) {
        evidence.push({ deviceId: target.id, field: `state.${field}`, value });
      }
    }
  }
  const whyCard = {
    id: nextId('why'),
    apartmentId: APARTMENT,
    ruleId: rule.id,
    action: rule.name,
    reason: describeReason(rule, triggerEvent),
    evidence,
    timestamp: new Date().toISOString(),
    status: 'executed',
    overrideOptions: ['keep', 'not_tonight', 'never'],
    resolvedOverride: null,
  };
  store.whyCards.push(whyCard);
  pushFeed({ kind: 'why_card', data: whyCard });
  return { actionEvents, whyCard };
}

function hasActiveGrantForUnlock(now = new Date()) {
  return store.grants.some((g) => {
    if (g.apartmentId !== APARTMENT) return false;
    if (!g.scope.includes('lock.unlock')) return false;
    const from = new Date(g.validFrom), until = new Date(g.validUntil);
    if (now < from || now > until) return false;
    if (!g.recurring) return true;
    const day = now.toLocaleDateString('en-US', { timeZone: 'Asia/Colombo', weekday: 'short' }).slice(0, 3).toLowerCase();
    return g.recurring.days.includes(day);
  });
}

// Unexpected access while the apartment is empty, with no valid grant covering it.
export function checkAnomaly(event) {
  if (event.type !== 'lock.changed' || event.value?.locked !== false) return null;
  const occupancy = store.devices.find((d) => d.type === 'occupancy');
  if (occupancy?.state?.occupied !== false) return null;
  if (hasActiveGrantForUnlock()) return null;
  const whyCard = {
    id: nextId('why'),
    apartmentId: APARTMENT,
    ruleId: 'sys_anomaly',
    action: 'Unexpected entry unlock',
    reason: `The entry door unlocked at ${localTimeString()} while the apartment is empty and no visitor pass is active.`,
    evidence: [{ deviceId: event.deviceId, field: 'state.locked', value: false }],
    timestamp: new Date().toISOString(),
    status: 'alert',
    overrideOptions: ['keep', 'not_tonight', 'never'],
    resolvedOverride: null,
  };
  store.whyCards.push(whyCard);
  pushFeed({ kind: 'why_card', data: whyCard });
  return whyCard;
}

function opposes(setA, setB) {
  return Object.keys(setA).some((key) => key in setB && setA[key] !== setB[key]);
}

function actionsOverlapAndOppose(actionsA, actionsB) {
  for (const a of actionsA) {
    for (const b of actionsB) {
      if (a.deviceType !== b.deviceType) continue;
      const sameTarget = a.deviceId === 'all' || b.deviceId === 'all' || a.deviceId === b.deviceId;
      if (sameTarget && opposes(a.set, b.set)) return true;
    }
  }
  return false;
}

const fieldSuffix = (field) => field.split('.').pop();

// True when candidate's own conditions already exclude the situation the
// existing rule fires in (e.g. candidate guards on smoke.alarm === false
// while existing rule's trigger only fires when alarm === true) -- the two
// rules can then never both apply, so the clash is resolved, not just hidden.
function guardedAgainst(candidate, existing) {
  return existing.conditions.some((existingCond) =>
    candidate.conditions.some((candCond) =>
      fieldSuffix(candCond.field) === fieldSuffix(existingCond.field) &&
      candCond.op === 'eq' && existingCond.op === 'eq' &&
      candCond.value !== existingCond.value));
}

// Compares candidate against existing enabled rules. Returns Conflict[] (per CONTRACT.md).
export function checkConflict(candidate) {
  const conflicts = [];
  for (const existing of store.rules) {
    if (existing.id === candidate.id || !existing.enabled) continue;
    if (!actionsOverlapAndOppose(candidate.actions, existing.actions)) continue;
    if (guardedAgainst(candidate, existing)) continue;
    const isSafety = SAFETY_RULE_IDS.has(existing.id);
    const resolutionOptions = isSafety
      ? [{ type: 'edit_condition', label: `Edit condition so it never overrides "${existing.name}"` }]
      : [
          { type: 'keep_a_disable_b', label: `Keep "${candidate.name}", disable "${existing.name}"` },
          { type: 'keep_b_disable_a', label: `Keep "${existing.name}", disable "${candidate.name}"` },
          { type: 'edit_condition', label: 'Edit condition to avoid the clash' },
        ];
    conflicts.push({
      id: nextId('conf'),
      apartmentId: APARTMENT,
      ruleA: candidate.id,
      ruleB: existing.id,
      reason: `"${candidate.name}" conflicts with "${existing.name}": both target the same device with opposing actions.`,
      resolutionOptions,
      detectedAt: new Date().toISOString(),
    });
  }
  return conflicts;
}

// Full pipeline for one externally-fired Event (seeded or manual).
export function fireEvent(rawEvent) {
  const event = {
    id: nextId('evt'),
    deviceId: rawEvent.deviceId,
    type: rawEvent.type,
    value: rawEvent.value,
    timestamp: new Date().toISOString(),
    apartmentId: APARTMENT,
  };
  applyEventToDevices(event, store.devices);
  pushFeed({ kind: 'event', data: event });

  const anomaly = checkAnomaly(event);
  const results = matchRules(event).map((rule) => applyRule(rule, event));

  return {
    event,
    anomaly,
    matchedRules: results.map((r) => r.whyCard.ruleId),
    generatedEvents: results.flatMap((r) => r.actionEvents),
    whyCards: [anomaly, ...results.map((r) => r.whyCard)].filter(Boolean),
  };
}
