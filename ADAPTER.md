# Concord UI ↔ engine adapter v1

2026-09-16. Requested by the user for the engine team to implement. No HTTP route
spec exists; this defines transport-independent methods and semantics. The engine
team may map them to REST + SSE, WebSocket, or polling. UI must not guess routes.

All capitalized domain types below are the EXACT shapes in CONTRACT.md. Transport
wrappers below do not add fields to those entities. WhyCard.status includes `alert`
as explicitly required by CONTRACT.md prose. IDs are opaque strings to the UI.

## Core surface

```ts
type WhyOverride = 'keep' | 'not_tonight' | 'never';
type ConflictResolution = {
  conflictId: string;
  type: Conflict['resolutionOptions'][number]['type'];
};

type RuleProposal = {
  rule: Rule;
  conflicts: Conflict[]; // empty when safe; references resolvable existing rules
};

type RuleSaveResult =
  | { status: 'saved'; rule: Rule }
  | { status: 'conflict'; rule: Rule; conflicts: Conflict[] };

type FeedItem =
  | { kind: 'event'; data: Event }
  | { kind: 'why_card'; data: WhyCard }
  | { kind: 'sos_event'; data: SosEvent };

type FeedBatch = {
  items: FeedItem[];
  cursor: string;       // opaque checkpoint, not an entity ID or client timestamp
  hasMore: boolean;     // drain immediately when true
  reset: boolean;       // true on initial bootstrap or expired/invalid cursor
};

interface ConcordAdapter {
  fetchDevices(apartmentId: string, signal?: AbortSignal): Promise<Device[]>;
  fetchRules(apartmentId: string, signal?: AbortSignal): Promise<Rule[]>;
  fetchGrants(apartmentId: string, signal?: AbortSignal): Promise<CapabilityGrant[]>;

  // Interpretation only: never installs a rule or changes a device.
  submitSentence(input: {
    apartmentId: string;
    sentence: string;
  }, signal?: AbortSignal): Promise<RuleProposal>;

  // Explicit resident confirmation of the proposed/edited Rule.
  // Included because “preview, then confirm” requires a separate mutation boundary.
  saveRule(input: {
    rule: Rule;
    resolutions: ConflictResolution[]; // [] when no conflict resolution is needed
    requestId: string;                 // client-generated UUID, retry same ID
  }, signal?: AbortSignal): Promise<RuleSaveResult>;

  postWhyOverride(input: {
    whyCardId: string;
    override: WhyOverride;
    requestId: string;
  }, signal?: AbortSignal): Promise<WhyCard>;

  // Required baseline; an engine stream may replace polling behind this adapter.
  pollFeed(input: {
    apartmentId: string;
    cursor?: string;
  }, signal?: AbortSignal): Promise<FeedBatch>;
}
```

`Rule` in a proposal uses the normal contract shape (including id, createdAt and
enabled), but is not installed. UI labels any default time/temperature as a suggestion.
UI edits its draft before save; engine revalidates and checks conflicts at save time.
Do not trust an earlier conflict-free preview after other rules have changed.

For `edit_condition`, submit the edited rule in `saveRule.rule`. The resolution type
identifies intent; the engine checks whether the resulting conditions actually fix it.
For `add_priority`, engine owns priority storage because Rule has no priority field.
Only return that option if the engine supports it; the UI must not invent a field.
Existing ruleA/ruleB IDs must be present in fetchRules; refresh if needed. Newly
proposed rule is available in RuleProposal even though it is not yet in fetchRules.

## Feed and state synchronization

- Bootstrap: fetch devices/rules/grants, then poll with no cursor. `reset:true` returns
  current unresolved/alert WhyCards plus recent activity (latest 50 WhyCards) and
  current active/acknowledged SosEvents. It also returns a checkpoint. Refresh the
  device/rule/grant snapshots after bootstrap to close the initial-fetch race.
- Subsequent polls return newly emitted Events and newly created OR UPDATED WhyCards
  and SosEvents. Upsert cards/SOS by entity ID; status changes reuse the same ID.
  Event delivery may repeat; deduplicate Events by id. Follow returned cursor order,
  not lexicographic IDs. Do not use `timestamp` as a unique pagination key.
- At `hasMore:true`, poll immediately; otherwise default to 2-second polling. On
  retryable errors use bounded backoff (2/4/8/15s), mark data stale and retain the last
  snapshot. Stop polling on unmount; revalidate on focus. A stream implementation
  should feed the same envelopes and support the same reconnect checkpoint.
- Do not assume Event.value is a universal Device.state patch. Engine applies Events;
  UI coalesces affected-device refreshes after Event batches. Refresh rules after
  save/override and grants after grant creation. Keep a 15-second/focus snapshot
  refresh as recovery for changes made by another client; do not invent extra entity
  event types in the domain contract just to solve UI synchronization.
- Cursor expiration returns `reset:true` with a fresh bootstrap batch. Clear stale
  feed projections, refresh snapshots, then continue. A poll error never clears home.
- Poll timestamps and rule suppression follow the building timezone, agreed in engine
  configuration. For the mock, explicitly configure Asia/Colombo and one demo clock.
- No device mutation happens on card inspection, preview, or client animation.
  Simulated devices also update through Event, exactly as CONTRACT.md requires.

## Override behavior

Return the updated WhyCard only after the engine records `resolvedOverride`.
`keep` confirms without device changes. `not_tonight` suppresses that rule for the
current building-local date; `never` sets Rule.enabled=false. Neither implicitly
restores previous device state. Updated WhyCard also appears on the feed so other
clients converge. Repeated requestId is idempotent. If a card was already resolved
by another command, return its authoritative current state or a STALE_STATE error;
never silently apply two conflicting corrections.

Safety policy remains authoritative in the engine. A suppression or new automation
must not bypass immutable life-safety rules. Such rules should not be offered as
ordinary dismissible suggestions. Frontend button hiding is not enforcement.

## Errors and authorization

Adapter errors use `{ code, message, retryable, fieldErrors? }` where code is one of
`UNAUTHENTICATED | FORBIDDEN | VALIDATION | NEEDS_CLARIFICATION | STALE_STATE |
UNAVAILABLE`. `message` is safe, actionable UI copy; fieldErrors is an optional
field-path-to-message map. No guessed Rule for unsupported/ambiguous text: return
NEEDS_CLARIFICATION and preserve the resident's sentence for editing.

Server credentials/session establish identity and apartment permissions. An
apartmentId or demo role selected by a caller is NOT authorization. Operator grants
remain limited to view.device_health/view.faults. Deny resident feed/rule access to
operators, and return only permitted health/fault device fields. Never expose
occupancy, activity, private setpoints or controls through a building detail panel.
Request IDs prevent duplicate writes, not unauthorized ones.

## Small extensions needed by the other requested screens

These are separate from the core reasoning loop above. Agree them with the engine
team; the mock adapter can support them immediately without invented HTTP routes.

```ts
interface ConcordCommands {
  // For visitor passes AND owner/tenant handover. Engine generates id.
  createGrant(input: {
    grant: Omit<CapabilityGrant, 'id'>;
    requestId: string;
  }, signal?: AbortSignal): Promise<CapabilityGrant>;

  // Engine derives triggeredBy/escalatedTo from authenticated user + building policy.
  triggerSos(input: {
    apartmentId: string;
    requestId: string;
  }, signal?: AbortSignal): Promise<SosEvent>;
}
```

CreateGrant validates role/scope, lease bounds, recurrence, and issuer authorization;
access validity is enforced at use time, not by a client countdown. Handover keeps old
expired grants for audit. CapabilityGrant has no bearer token: do not claim a QR
encoding its ID alone grants secure door access. UI can encode a visitor-view URL in
demo mode; authenticated redemption/signing must be supplied by the backend team if
real access is shown. Likewise, SOS demo success never implies a real emergency call.

Direct device controls and operator energy aggregation are not part of the requested
core loop. Show device state read-only until a command API is agreed. Building mocks
may show explicitly seeded health/energy summaries; do not pretend that aggregate
energy telemetry exists in CONTRACT.md. These gaps do not block the resident proof.

## Engine acceptance examples

1. Submit a sleep sentence → Rule + [] → edit temperature → save → installed Rule;
   no device changes until a matching Event is processed.
2. Submit a conflicting lock sentence → Rule + Conflict → unsafe resolution rejected;
   safe edited condition accepted after engine revalidation.
3. Post not_tonight → WhyCard.resolvedOverride updates; trigger is suppressed for the
   correct local day; feed emits update; next day resumes if Rule.enabled remains true.
4. Post never → Rule.enabled=false; refresh and another client see the same result.
5. Reconnect with cursor → missed Events/cards/SOS updates arrive without duplicate UI.
6. Operator credentials cannot fetch resident reasons/rules/private device state even
   if they send the resident apartmentId manually.

Implementation boundaries: src/domain/contracts.ts mirrors CONTRACT.md;
src/data/adapter.ts implements these interfaces; mock and live adapters are swappable.
Components use the adapter, not fetch(), transport URLs or fixture mutation directly.
