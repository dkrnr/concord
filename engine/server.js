import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { store, reset, nextId, APARTMENT, localDateString, pushFeed } from './state.js';
import { checkConflict, fireEvent, runActions } from './rules.js';
import { SAFETY_RULE_IDS } from './seedState.js';
import { sentenceToRule } from './llm.js';
import { validateGrant, isGrantActiveAt } from './grants.js';

const FEED_BATCH_LIMIT = 100;

const PORT = process.env.PORT || 8787;
const DIST_DIR = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
};

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function adapterError(res, code, message, status = 400) {
  send(res, status, { code, message, retryable: false });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function serveApp(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const requested = resolve(DIST_DIR, relative);
  const withinDist = requested === DIST_DIR || requested.startsWith(`${DIST_DIR}${sep}`);
  const candidates = withinDist ? [requested, resolve(DIST_DIR, 'index.html')] : [resolve(DIST_DIR, 'index.html')];
  for (const candidate of candidates) {
    try {
      const body = await readFile(candidate);
      const extension = extname(candidate);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
        'Cache-Control': candidate.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      if (req.method === 'HEAD') res.end(); else res.end(body);
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'EISDIR') throw error;
    }
  }
  send(res, 503, { code: 'APP_NOT_BUILT', message: 'Run npm run build before starting the presentation server.' });
}

// --- saveRule: conflict-checks BEFORE persisting, applies chosen resolutions ---
function handleSaveRule({ rule, resolutions = [], requestId }) {
  if (requestId && store.requestCache.has(requestId)) return store.requestCache.get(requestId);

  const isDraft = rule.id?.startsWith('draft_');
  const persistedId = isDraft ? nextId('rule') : rule.id;
  const candidate = { ...rule, id: persistedId, apartmentId: APARTMENT, enabled: true, createdAt: rule.createdAt || new Date().toISOString() };

  const conflicts = checkConflict(candidate);
  if (conflicts.length > 0) {
    const unresolved = conflicts.filter((c) => !resolutions.some((r) => r.conflictId === c.id || r.type));
    // Demo-simple resolution: any resolution present is assumed to target these conflicts.
    if (resolutions.length === 0) {
      const result = { status: 'conflict', rule: candidate, conflicts };
      if (requestId) store.requestCache.set(requestId, result);
      return result;
    }
    for (const res of resolutions) {
      const conflict = conflicts.find((c) => c.id === res.conflictId) || conflicts[0];
      const safetyInvolved = SAFETY_RULE_IDS.has(conflict.ruleB);
      if (res.type === 'edit_condition') {
        // Trust caller edited candidate.conditions; recheck below.
        continue;
      }
      if (res.type === 'keep_a_disable_b') {
        if (safetyInvolved) return { status: 'conflict', rule: candidate, conflicts }; // can't disable a safety rule
        store.rules = store.rules.map((r) => (r.id === conflict.ruleB ? { ...r, enabled: false } : r));
      }
      if (res.type === 'keep_b_disable_a') {
        // candidate itself gets disabled -- still save it, just not enabled
        candidate.enabled = false;
      }
    }
    const recheck = checkConflict(candidate).filter((c) => SAFETY_RULE_IDS.has(c.ruleB) || store.rules.find((r) => r.id === c.ruleB && r.enabled));
    if (recheck.length > 0) {
      const result = { status: 'conflict', rule: candidate, conflicts: recheck };
      if (requestId) store.requestCache.set(requestId, result);
      return result;
    }
  }

  store.rules = [...store.rules.filter((r) => r.id !== candidate.id), candidate];
  const result = { status: 'saved', rule: candidate };
  if (requestId) store.requestCache.set(requestId, result);
  return result;
}

const routes = {
  async '/fetchDevices'(body) { return { status: 200, body: store.devices }; },
  async '/fetchRules'(body) { return { status: 200, body: store.rules }; },
  async '/fetchGrants'(body) {
    const apartmentId = body.apartmentId ?? APARTMENT;
    return { status: 200, body: store.grants.filter((g) => g.apartmentId === apartmentId) };
  },

  async '/saveRule'(body) {
    if (!body.rule || !body.rule.name || !body.rule.actions?.length) {
      return { status: 400, body: { code: 'VALIDATION', message: 'Rule is missing required fields.', retryable: false } };
    }
    return { status: 200, body: handleSaveRule(body) };
  },

  async '/submitSentence'(body) {
    if (!body.sentence || typeof body.sentence !== 'string') {
      return { status: 400, body: { code: 'VALIDATION', message: 'sentence is required.', retryable: false } };
    }
    const result = await sentenceToRule(body.sentence, store.devices);
    if (result.error) {
      return { status: 422, body: { code: 'NEEDS_CLARIFICATION', message: result.error, retryable: false, fieldErrors: { sentence: result.error } } };
    }
    const candidate = {
      id: nextId('draft'),
      apartmentId: APARTMENT,
      name: result.rule.name,
      sourceSentence: body.sentence,
      trigger: result.rule.trigger,
      conditions: result.rule.conditions,
      actions: result.rule.actions,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    const conflicts = checkConflict(candidate);
    return { status: 200, body: { rule: candidate, conflicts } };
  },

  async '/postWhyOverride'(body) {
    const { whyCardId, override, requestId } = body;
    if (!whyCardId || !['keep', 'not_tonight', 'never'].includes(override)) {
      return { status: 400, body: { code: 'VALIDATION', message: 'whyCardId and a valid override are required.', retryable: false } };
    }
    if (requestId && store.requestCache.has(requestId)) return { status: 200, body: store.requestCache.get(requestId) };

    const card = store.whyCards.find((c) => c.id === whyCardId);
    if (!card) return { status: 404, body: { code: 'VALIDATION', message: 'This activity is no longer available.', retryable: false } };

    if (card.resolvedOverride !== null && card.resolvedOverride !== override) {
      return { status: 409, body: { code: 'STALE_STATE', message: 'This card was already resolved differently by another client.', retryable: false } };
    }

    card.resolvedOverride = override;
    if (override === 'not_tonight') store.notTonight.set(card.ruleId, localDateString());
    if (override === 'never') store.rules = store.rules.map((r) => (r.id === card.ruleId ? { ...r, enabled: false } : r));
    pushFeed({ kind: 'why_card', data: card });

    const result = { ...card };
    if (requestId) store.requestCache.set(requestId, result);
    return { status: 200, body: result };
  },

  async '/pollFeed'(body) {
    const { cursor } = body;
    const cursorIndex = cursor === undefined ? undefined : Number(cursor);
    const cursorExpired = cursor !== undefined && (Number.isNaN(cursorIndex) || cursorIndex > store.feed.length || cursorIndex < 0);

    if (cursor === undefined || cursorExpired) {
      const unresolvedOrAlert = store.whyCards.filter((c) => c.status === 'alert' || c.resolvedOverride === null);
      const recent = store.whyCards.slice(-50);
      const cardIds = new Set();
      const items = [];
      for (const c of [...unresolvedOrAlert, ...recent]) {
        if (cardIds.has(c.id)) continue;
        cardIds.add(c.id);
        items.push({ kind: 'why_card', data: c });
      }
      for (const s of store.sosEvents.filter((s) => s.status === 'active' || s.status === 'acknowledged')) {
        items.push({ kind: 'sos_event', data: s });
      }
      return { status: 200, body: { items, cursor: String(store.feed.length), hasMore: false, reset: true } };
    }

    const slice = store.feed.slice(cursorIndex, cursorIndex + FEED_BATCH_LIMIT);
    const nextCursor = cursorIndex + slice.length;
    return { status: 200, body: { items: slice, cursor: String(nextCursor), hasMore: nextCursor < store.feed.length, reset: false } };
  },

  async '/createGrant'(body) {
    const { grant, requestId } = body;
    if (!grant) return { status: 400, body: { code: 'VALIDATION', message: 'grant is required.', retryable: false } };
    const fieldErrors = validateGrant(grant);
    if (fieldErrors) {
      return { status: 400, body: { code: 'VALIDATION', message: 'Grant has invalid or missing fields.', retryable: false, fieldErrors } };
    }
    if (requestId && store.requestCache.has(requestId)) return { status: 200, body: store.requestCache.get(requestId) };
    // Handover: honor the apartment and owner/tenant actor from the request -- never
    // force the demo apartment. Lease dates (validFrom/validUntil), and the full
    // recurring days/startTime/endTime window, are honored as given and checked
    // at use time (isGrantActiveAt), not just as an hour-duration preset.
    const saved = { ...grant, id: nextId('grant') };
    store.grants = [saved, ...store.grants];
    if (requestId) store.requestCache.set(requestId, saved);
    return { status: 200, body: saved };
  },

  async '/triggerSos'(body) {
    const { requestId } = body;
    if (requestId && store.requestCache.has(requestId)) return { status: 200, body: store.requestCache.get(requestId) };
    const sos = {
      id: nextId('sos'), apartmentId: APARTMENT, triggeredBy: 'resident_demo',
      type: 'manual', status: 'active', escalatedTo: 'operator_desk_1', timestamp: new Date().toISOString(),
    };
    store.sosEvents.push(sos);
    pushFeed({ kind: 'sos_event', data: sos });
    if (requestId) store.requestCache.set(requestId, sos);
    return { status: 200, body: sos };
  },

  // Manual device command. Devices only change state via Event (CONTRACT.md), so this
  // looks up the device, builds the same `${type}.changed` Event applyRule would emit,
  // and routes it through fireEvent -- runs the anomaly check and any matching rules too.
  async '/commandDevice'(body) {
    const { deviceId, set, requestId } = body;
    if (!deviceId || !set || typeof set !== 'object') {
      return { status: 400, body: { code: 'VALIDATION', message: 'deviceId and set are required.', retryable: false } };
    }
    if (requestId && store.requestCache.has(requestId)) return { status: 200, body: store.requestCache.get(requestId) };
    const device = store.devices.find((d) => d.id === deviceId);
    if (!device) return { status: 404, body: { code: 'VALIDATION', message: `No device ${deviceId}.`, retryable: false } };
    const result = fireEvent({ deviceId, type: `${device.type}.changed`, value: set });
    if (requestId) store.requestCache.set(requestId, result);
    return { status: 200, body: result };
  },

  // Approve/dismiss a WhyCard sitting in status:'proposed' (an action awaiting
  // confirmation before it runs -- distinct from postWhyOverride, which reacts to
  // an already-executed/alert card). Only valid on 'proposed' cards.
  async '/approveWhyCard'(body) {
    const { whyCardId, requestId } = body;
    if (!whyCardId) return { status: 400, body: { code: 'VALIDATION', message: 'whyCardId is required.', retryable: false } };
    if (requestId && store.requestCache.has(requestId)) return { status: 200, body: store.requestCache.get(requestId) };

    const card = store.whyCards.find((c) => c.id === whyCardId);
    if (!card) return { status: 404, body: { code: 'VALIDATION', message: 'This activity is no longer available.', retryable: false } };
    if (card.status !== 'proposed') {
      return { status: 409, body: { code: 'STALE_STATE', message: `Card is already ${card.status}, not proposed.`, retryable: false } };
    }

    const rule = store.rules.find((r) => r.id === card.ruleId);
    if (rule) {
      const { evidence } = runActions(rule.actions);
      card.evidence = evidence;
    }
    card.status = 'executed';
    card.timestamp = new Date().toISOString();
    pushFeed({ kind: 'why_card', data: card });

    const result = { ...card };
    if (requestId) store.requestCache.set(requestId, result);
    return { status: 200, body: result };
  },

  async '/dismissWhyCard'(body) {
    const { whyCardId, requestId } = body;
    if (!whyCardId) return { status: 400, body: { code: 'VALIDATION', message: 'whyCardId is required.', retryable: false } };
    if (requestId && store.requestCache.has(requestId)) return { status: 200, body: store.requestCache.get(requestId) };

    const card = store.whyCards.find((c) => c.id === whyCardId);
    if (!card) return { status: 404, body: { code: 'VALIDATION', message: 'This activity is no longer available.', retryable: false } };
    if (card.status !== 'proposed') {
      return { status: 409, body: { code: 'STALE_STATE', message: `Card is already ${card.status}, not proposed.`, retryable: false } };
    }

    // Dismissed proposals never ran -- no device changes, matches "no device mutation
    // on card inspection/preview" in ADAPTER.md. Suppress the rule for today only.
    card.resolvedOverride = 'not_tonight';
    store.notTonight.set(card.ruleId, localDateString());
    pushFeed({ kind: 'why_card', data: card });

    const result = { ...card };
    if (requestId) store.requestCache.set(requestId, result);
    return { status: 200, body: result };
  },

  // Notifications: projected from existing WhyCards + SosEvents, no new persisted
  // entity. 'read' state is engine-side bookkeeping keyed by the underlying id.
  async '/fetchNotifications'(body) {
    const apartmentId = body.apartmentId ?? APARTMENT;
    const fromCards = store.whyCards
      .filter((c) => c.apartmentId === apartmentId)
      .map((c) => ({
        id: c.id, apartmentId: c.apartmentId, kind: 'why_card',
        severity: c.status === 'alert' ? 'alert' : 'info',
        title: c.action, message: c.reason, timestamp: c.timestamp,
        read: store.readNotifications.has(c.id),
      }));
    const fromSos = store.sosEvents
      .filter((s) => s.apartmentId === apartmentId)
      .map((s) => ({
        id: s.id, apartmentId: s.apartmentId, kind: 'sos_event',
        severity: 'alert',
        title: s.type === 'manual' ? 'SOS triggered' : `SOS: ${s.type.replace('_', ' ')}`,
        message: `Escalated to ${s.escalatedTo}. Status: ${s.status}.`, timestamp: s.timestamp,
        read: store.readNotifications.has(s.id),
      }));
    const items = [...fromCards, ...fromSos].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return { status: 200, body: items };
  },

  async '/markNotificationRead'(body) {
    const { notificationId } = body;
    if (!notificationId) return { status: 400, body: { code: 'VALIDATION', message: 'notificationId is required.', retryable: false } };
    const exists = store.whyCards.some((c) => c.id === notificationId) || store.sosEvents.some((s) => s.id === notificationId);
    if (!exists) return { status: 404, body: { code: 'VALIDATION', message: 'No such notification.', retryable: false } };
    store.readNotifications.add(notificationId);
    return { status: 200, body: { id: notificationId, read: true } };
  },

  // Portfolio/developer overview: aggregates the explicitly seeded building
  // dataset (engine/seedPortfolio.js). Never derived from apt_401 device state.
  async '/fetchPortfolio'() {
    const units = store.portfolio;
    const fleetHealth = { healthy: 0, attention: 0, anomaly: 0 };
    let maintenanceOpen = 0, maintenanceHighPriority = 0, energyKwhToday = 0;
    const handover = { occupied: 0, vacant: 0, pending_handover: 0 };
    for (const u of units) {
      fleetHealth[u.fleetHealth]++;
      maintenanceOpen += u.maintenanceOpen;
      if (u.maintenancePriority === 'high') maintenanceHighPriority++;
      energyKwhToday += u.energyKwhToday;
      handover[u.handoverStatus]++;
    }
    const adopted = units.filter((u) => u.handoverStatus !== 'vacant').length;
    return { status: 200, body: {
      totalUnits: units.length,
      adoptionRate: Number((adopted / units.length).toFixed(2)),
      fleetHealth,
      maintenance: { open: maintenanceOpen, highPriority: maintenanceHighPriority },
      handover,
      energy: { totalKwhToday: Number(energyKwhToday.toFixed(1)), avgKwhPerUnit: Number((energyKwhToday / units.length).toFixed(2)) },
      units,
    } };
  },

  // Away-state: current occupancy/away context for an apartment. Only apt_401 has
  // simulated device telemetry in this mock; other apartments have no live devices.
  async '/fetchAwayState'(body) {
    const apartmentId = body.apartmentId ?? APARTMENT;
    if (apartmentId !== APARTMENT) {
      return { status: 404, body: { code: 'VALIDATION', message: `No live device telemetry for ${apartmentId}; only ${APARTMENT} is simulated in this mock.`, retryable: false } };
    }
    const occupancy = store.devices.find((d) => d.type === 'occupancy');
    const now = new Date();
    const activeGrants = store.grants
      .filter((g) => g.apartmentId === apartmentId && isGrantActiveAt(g, now))
      .map((g) => ({ id: g.id, actor: g.actor, role: g.role, scope: g.scope }));
    return { status: 200, body: {
      apartmentId, occupied: occupancy?.state?.occupied ?? null, since: occupancy?.lastUpdated ?? null, activeGrants,
    } };
  },

  // --- debug/testing helpers, NOT part of the ADAPTER.md surface ---
  async '/debug/reset'() { reset(); return { status: 200, body: { ok: true } }; },
  async '/debug/state'() {
    return { status: 200, body: {
      devices: store.devices, rules: store.rules, whyCards: store.whyCards,
      feed: store.feed, eventQueueRemaining: store.eventQueue.length,
    } };
  },
  async '/debug/fireNextEvent'() {
    const next = store.eventQueue.shift();
    if (!next) return { status: 200, body: { done: true, message: 'seed queue empty' } };
    return { status: 200, body: fireEvent(next) };
  },
  async '/debug/fireEvent'(body) {
    if (!body.deviceId || !body.type) return { status: 400, body: { code: 'VALIDATION', message: 'deviceId and type required.' } };
    return { status: 200, body: fireEvent(body) };
  },
  async '/debug/proposeWhyCard'(body) {
    const { ruleId } = body;
    const rule = store.rules.find((r) => r.id === ruleId);
    if (!rule) return { status: 400, body: { code: 'VALIDATION', message: `No rule ${ruleId}.` } };
    const card = {
      id: nextId('why'), apartmentId: APARTMENT, ruleId: rule.id, action: rule.name,
      reason: `Proposed: "${rule.name}" is ready to run. Approve to execute now.`,
      evidence: [], timestamp: new Date().toISOString(), status: 'proposed',
      overrideOptions: ['keep', 'not_tonight', 'never'], resolvedOverride: null,
    };
    store.whyCards.push(card);
    pushFeed({ kind: 'why_card', data: card });
    return { status: 200, body: card };
  },
  async '/debug/checkConflict'(body) {
    if (!body.rule) return { status: 400, body: { code: 'VALIDATION', message: 'rule required.' } };
    return { status: 200, body: checkConflict(body.rule) };
  },
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  const handler = routes[pathname];
  if (!handler && (req.method === 'GET' || req.method === 'HEAD')) {
    try { await serveApp(req, res, pathname); }
    catch { send(res, 500, { code: 'STATIC_ERROR', message: 'The presentation app could not be loaded.' }); }
    return;
  }
  if (!handler) { adapterError(res, 'VALIDATION', `No route ${pathname}`, 404); return; }
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const { status, body: responseBody } = await handler(body);
    send(res, status, responseBody);
  } catch (err) {
    adapterError(res, 'VALIDATION', 'Malformed JSON body.', 400);
  }
});

server.listen(PORT, () => {
  console.log(`Concord presentation server listening on http://localhost:${PORT}`);
  console.log(`Apartment: ${APARTMENT} | seed events queued: ${store.eventQueue.length}`);
});
