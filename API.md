# Concord engine API

Mock backend for the smart-living demo. Base URL: `http://localhost:8787`. All
routes are `POST` with a JSON body (`{}` if no fields), except `/debug/state`
which also accepts `GET`. CORS is open (`*`). In-memory only, single simulated
apartment (`apt_401`) with real device/event telemetry; `/fetchPortfolio`
covers other apartments as seeded mock summary data only.

Shapes named `Device`, `Event`, `Rule`, `WhyCard`, `SosEvent`, `CapabilityGrant`,
`Conflict` are the exact CONTRACT.md types. Adapter-level types (`RuleProposal`,
`RuleSaveResult`, `FeedItem`, `FeedBatch`) are ADAPTER.md's.

## Errors

Non-2xx responses are `{ code, message, retryable, fieldErrors? }` where `code`
is one of `VALIDATION | NEEDS_CLARIFICATION | STALE_STATE | UNAVAILABLE`.

## Idempotency

Any endpoint that mutates state and accepts `requestId` caches its result by
that id — a retried request with the same `requestId` returns the original
response instead of re-applying the mutation.

---

## Core adapter surface (ADAPTER.md)

### POST /fetchDevices
Request: `{ apartmentId: string }`
Response: `Device[]`
```json
// request
{ "apartmentId": "apt_401" }
// response (truncated)
[{ "id": "dev_lock_401", "type": "lock", "apartmentId": "apt_401", "state": { "locked": true, "room": "entry" }, "lastUpdated": "2026-09-16T18:00:00Z" }]
```

### POST /fetchRules
Request: `{ apartmentId: string }`
Response: `Rule[]`
```json
{ "apartmentId": "apt_401" }
```

### POST /fetchGrants
Request: `{ apartmentId: string }`
Response: `CapabilityGrant[]` — filtered to the requested apartment.
```json
{ "apartmentId": "apt_401" }
```

### POST /saveRule
Conflict-checks BEFORE persisting. Applies chosen resolutions
(`edit_condition` trusts the caller already edited `rule.conditions`;
`keep_a_disable_b` / `keep_b_disable_a` disable the losing rule; a safety
rule, e.g. smoke-unlock, can never be the one disabled).

Request: `{ rule: Rule, resolutions: { conflictId: string, type: 'keep_a_disable_b'|'keep_b_disable_a'|'edit_condition' }[], requestId: string }`
Response: `RuleSaveResult` = `{ status: 'saved', rule: Rule } | { status: 'conflict', rule: Rule, conflicts: Conflict[] }`
```json
// request
{ "rule": { "id": "draft_1", "name": "Lock doors when everyone leaves", "trigger": {"kind":"event","eventType":"occupancy.changed"}, "conditions": [{"field":"value.occupied","op":"eq","value":false}], "actions": [{"deviceType":"lock","deviceId":"all","set":{"locked":true}}] },
  "resolutions": [], "requestId": "req-1" }
// response
{ "status": "conflict", "rule": { "...": "..." }, "conflicts": [{ "id": "conf_1", "ruleA": "draft_1", "ruleB": "rule_smoke", "reason": "...", "resolutionOptions": [{"type":"edit_condition","label":"..."}] }] }
```

### POST /submitSentence
Plain sentence → draft Rule via local Qwen (Ollama). Never installs anything.
Validates the sentence targets a real device/room in the current inventory;
returns `NEEDS_CLARIFICATION` if vague or the target is unavailable.

Request: `{ apartmentId: string, sentence: string }`
Response: `RuleProposal` = `{ rule: Rule, conflicts: Conflict[] }` (200) or `NEEDS_CLARIFICATION` error (422)
```json
{ "apartmentId": "apt_401", "sentence": "cool the bedroom to 22 before I sleep" }
```

### POST /postWhyOverride
Reacts to an already-executed/alert WhyCard. `keep` confirms, no change.
`not_tonight` suppresses the rule for the current building-local day.
`never` disables the rule (`Rule.enabled = false`). Idempotent by
`requestId`; `409 STALE_STATE` if the card was already resolved differently.

Request: `{ whyCardId: string, override: 'keep'|'not_tonight'|'never', requestId: string }`
Response: `WhyCard`
```json
{ "whyCardId": "why_3", "override": "not_tonight", "requestId": "req-2" }
```

### POST /pollFeed
Cursor-based feed of `Event` / `WhyCard` / `SosEvent`. No `cursor` (or an
expired one) returns `reset:true` with a bootstrap batch: unresolved/alert
WhyCards, the latest 50 WhyCards, and active/acknowledged SosEvents. Poll
again immediately when `hasMore:true`; otherwise poll every ~2s.

Request: `{ apartmentId: string, cursor?: string }`
Response: `FeedBatch` = `{ items: FeedItem[], cursor: string, hasMore: boolean, reset: boolean }`
```json
{ "apartmentId": "apt_401" }
```

### POST /createGrant
Validates all fields, including full `recurring` (days + startTime/endTime,
24h `HH:MM`) and the `validFrom`/`validUntil` lease range — not just an
hour-duration preset. `apartmentId` and `actor` are honored exactly as sent
(handover flow: operator sets both, lease dates auto-expire the grant at
`validUntil`, checked at use time). `400 VALIDATION` with `fieldErrors` on
bad ranges/format.

Request: `{ grant: Omit<CapabilityGrant,'id'>, requestId: string }`
Response: `CapabilityGrant`
```json
// request
{ "grant": { "apartmentId": "apt_401", "actor": "cleaner_svc_9", "role": "cleaner",
    "scope": ["lock.unlock"], "validFrom": "2026-09-16T00:00:00Z", "validUntil": "2026-12-16T00:00:00Z",
    "recurring": { "days": ["mon","thu"], "startTime": "09:00", "endTime": "11:00" } },
  "requestId": "grant-1" }
```

### POST /triggerSos
Request: `{ apartmentId: string, requestId: string }`
Response: `SosEvent`
```json
{ "apartmentId": "apt_401", "requestId": "sos-1" }
```

---

## New engine-only endpoints

### POST /commandDevice
Manual device command. Looks up the device, builds the same
`${deviceType}.changed` Event a rule action would emit, and routes it
through the normal event pipeline (`fireEvent`) — runs the anomaly check and
any matching rules, exactly like a real device would. Devices still only
change state via Event.

Request: `{ deviceId: string, set: Record<string, unknown>, requestId: string }`
Response: same shape as `/debug/fireEvent` — `{ event: Event, anomaly: WhyCard|null, matchedRules: string[], generatedEvents: Event[], whyCards: WhyCard[] }`
```json
{ "deviceId": "dev_light_living", "set": { "on": false }, "requestId": "cmd-1" }
```

### POST /approveWhyCard
Approves a WhyCard sitting in `status:'proposed'` (an action awaiting
confirmation before it runs — distinct from `/postWhyOverride`, which reacts
to an already-executed/alert card). Runs the rule's actions now, sets
`status:'executed'`. `409 STALE_STATE` if the card isn't `proposed`.

Request: `{ whyCardId: string, requestId: string }`
Response: `WhyCard`
```json
{ "whyCardId": "why_2", "requestId": "app-1" }
```

### POST /dismissWhyCard
Dismisses a `status:'proposed'` WhyCard. No device changes ever run; sets
`resolvedOverride:'not_tonight'` and suppresses the rule for today.

Request: `{ whyCardId: string, requestId: string }`
Response: `WhyCard`
```json
{ "whyCardId": "why_4", "requestId": "dis-1" }
```

### POST /fetchNotifications
Projects existing WhyCards + SosEvents into a notification list — no new
persisted entity. `read` is engine-side bookkeeping keyed by the underlying
WhyCard/SosEvent id. Sorted newest first.

Request: `{ apartmentId: string }`
Response: `{ id: string, apartmentId: string, kind: 'why_card'|'sos_event', severity: 'alert'|'info', title: string, message: string, timestamp: string, read: boolean }[]`
```json
{ "apartmentId": "apt_401" }
```

### POST /markNotificationRead
Request: `{ notificationId: string }`
Response: `{ id: string, read: true }`
```json
{ "notificationId": "why_3" }
```

### POST /fetchPortfolio
Building-level aggregate across multiple units. Backed entirely by explicit
seed data (`engine/seedPortfolio.js`) — energy/maintenance/health are never
derived from apt_401's live device state.

Request: `{}`
Response:
```ts
{
  totalUnits: number,
  adoptionRate: number, // fraction of units not vacant
  fleetHealth: { healthy: number, attention: number, anomaly: number },
  maintenance: { open: number, highPriority: number },
  handover: { occupied: number, vacant: number, pending_handover: number },
  energy: { totalKwhToday: number, avgKwhPerUnit: number },
  units: { apartmentId: string, unit: string, fleetHealth: string, energyKwhToday: number,
           maintenanceOpen: number, maintenancePriority: string|null, handoverStatus: string, occupants: number }[]
}
```
```json
// request
{}
```

### POST /fetchAwayState
Current occupancy/away context for an apartment, plus which grants are
active right now. Only `apt_401` has simulated device telemetry in this
mock; any other `apartmentId` returns `404 VALIDATION`.

Request: `{ apartmentId: string }`
Response: `{ apartmentId: string, occupied: boolean|null, since: string|null, activeGrants: { id: string, actor: string, role: string, scope: string[] }[] }`
```json
{ "apartmentId": "apt_401" }
```

---

## Debug/testing helpers (not part of ADAPTER.md)

### POST /debug/reset
Restores devices/rules/grants/whyCards/feed/notifications/portfolio to seed. `{}` → `{ ok: true }`.

### GET /debug/state
Full in-memory snapshot: `{ devices, rules, whyCards, feed, eventQueueRemaining }`.

### POST /debug/fireNextEvent
Pops and fires the next queued seed event (`engine/seed-events.json`).
`{}` → same response shape as `/commandDevice`, or `{ done: true }` when the queue is empty.

### POST /debug/fireEvent
Fires an arbitrary event through the same pipeline.
Request: `{ deviceId: string, type: string, value: unknown }` → same response shape as `/commandDevice`.

### POST /debug/proposeWhyCard
Manufactures a `status:'proposed'` WhyCard for a given rule, for testing `/approveWhyCard` and `/dismissWhyCard`.
Request: `{ ruleId: string }` → `WhyCard`.

### POST /debug/checkConflict
Runs the conflict checker standalone, without saving anything.
Request: `{ rule: Rule }` → `Conflict[]`.
