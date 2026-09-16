import { createServer } from 'node:http';
import { store, reset, nextId, APARTMENT, localDateString, pushFeed } from './state.js';
import { checkConflict, fireEvent } from './rules.js';
import { SAFETY_RULE_IDS } from './seedState.js';
import { sentenceToRule } from './llm.js';

const FEED_BATCH_LIMIT = 100;

const PORT = process.env.PORT || 8787;

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
  async '/fetchGrants'(body) { return { status: 200, body: store.grants }; },

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
    const result = await sentenceToRule(body.sentence);
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
    if (!grant || !grant.role || !grant.actor || !grant.validFrom || !grant.validUntil) {
      return { status: 400, body: { code: 'VALIDATION', message: 'grant requires actor, role, validFrom, validUntil.', retryable: false } };
    }
    if (requestId && store.requestCache.has(requestId)) return { status: 200, body: store.requestCache.get(requestId) };
    const saved = { ...grant, id: nextId('grant'), apartmentId: APARTMENT };
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
  async '/debug/checkConflict'(body) {
    if (!body.rule) return { status: 400, body: { code: 'VALIDATION', message: 'rule required.' } };
    return { status: 200, body: checkConflict(body.rule) };
  },
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }
  const handler = routes[req.url];
  if (!handler) { adapterError(res, 'VALIDATION', `No route ${req.url}`, 404); return; }
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const { status, body: responseBody } = await handler(body);
    send(res, status, responseBody);
  } catch (err) {
    adapterError(res, 'VALIDATION', 'Malformed JSON body.', 400);
  }
});

server.listen(PORT, () => {
  console.log(`Concord engine mock listening on http://localhost:${PORT}`);
  console.log(`Apartment: ${APARTMENT} | seed events queued: ${store.eventQueue.length}`);
});
