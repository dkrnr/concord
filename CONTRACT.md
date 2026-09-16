# CONTRACT.md — Smart Living Platform Data Contract

Single source of truth. Frontend reads WhyCard/Conflict/CapabilityGrant shapes. Engine emits Event, evaluates Rule, produces WhyCard/Conflict. Both read Device.

**Simulated device layer:** all Device state changes flow through seeded event stream / mock MQTT — no real hardware, `Event` is the only channel devices talk through.

---

## Device

```json
{
  "id": "string (uuid)",
  "type": "lock | ac | light | curtain | motion | smoke | occupancy",
  "apartmentId": "string",
  "state": { "...": "type-specific, see examples" },
  "lastUpdated": "string (ISO 8601)"
}
```

Example — lock:
```json
{
  "id": "dev_lock_401",
  "type": "lock",
  "apartmentId": "apt_401",
  "state": { "locked": true },
  "lastUpdated": "2026-09-16T21:03:00Z"
}
```

Example — smoke:
```json
{
  "id": "dev_smoke_401",
  "type": "smoke",
  "apartmentId": "apt_401",
  "state": { "alarm": false, "ppm": 4 },
  "lastUpdated": "2026-09-16T21:03:00Z"
}
```

---

## Event

```json
{
  "id": "string (uuid)",
  "deviceId": "string",
  "type": "string (device-defined, e.g. 'motion.detected', 'lock.changed', 'smoke.alarm')",
  "value": "any (type-specific payload)",
  "timestamp": "string (ISO 8601)",
  "apartmentId": "string"
}
```

Example — motion:
```json
{
  "id": "evt_9021",
  "deviceId": "dev_motion_401",
  "type": "motion.detected",
  "value": { "room": "hallway" },
  "timestamp": "2026-09-16T21:04:12Z",
  "apartmentId": "apt_401"
}
```

Example — occupancy left:
```json
{
  "id": "evt_9022",
  "deviceId": "dev_occ_401",
  "type": "occupancy.changed",
  "value": { "occupied": false },
  "timestamp": "2026-09-16T21:05:00Z",
  "apartmentId": "apt_401"
}
```

---

## Rule

LLM generates this from plain sentence (e.g. "lock all doors when everyone leaves").

```json
{
  "id": "string (uuid)",
  "apartmentId": "string",
  "name": "string (plain-language label)",
  "sourceSentence": "string (original user sentence, for audit/regen)",
  "trigger": {
    "kind": "event | time",
    "eventType": "string (if kind=event)",
    "at": "string (HH:MM or cron, if kind=time)"
  },
  "conditions": [
    { "field": "string", "op": "eq | neq | gt | lt | gte | lte", "value": "any" }
  ],
  "actions": [
    { "deviceType": "string", "deviceId": "string | 'all'", "set": { "...": "any" } }
  ],
  "enabled": true,
  "createdAt": "string (ISO 8601)"
}
```

Example — "lock all doors when everyone leaves":
```json
{
  "id": "rule_1",
  "apartmentId": "apt_401",
  "name": "Lock all doors when everyone leaves",
  "sourceSentence": "lock all doors when everyone leaves",
  "trigger": { "kind": "event", "eventType": "occupancy.changed" },
  "conditions": [{ "field": "value.occupied", "op": "eq", "value": false }],
  "actions": [{ "deviceType": "lock", "deviceId": "all", "set": { "locked": true } }],
  "enabled": true,
  "createdAt": "2026-09-16T18:00:00Z"
}
```

Example — "unlock doors on smoke alarm":
```json
{
  "id": "rule_2",
  "apartmentId": "apt_401",
  "name": "Unlock on smoke",
  "sourceSentence": "unlock on smoke",
  "trigger": { "kind": "event", "eventType": "smoke.alarm" },
  "conditions": [{ "field": "value.alarm", "op": "eq", "value": true }],
  "actions": [{ "deviceType": "lock", "deviceId": "all", "set": { "locked": false } }],
  "enabled": true,
  "createdAt": "2026-09-16T18:05:00Z"
}
```

---

## WhyCard

What happened, plain-language reason built from real state, override options.

```json
{
  "id": "string (uuid)",
  "apartmentId": "string",
  "ruleId": "string",
  "action": "string (plain description of what system did/proposed)",
  "reason": "string (plain language, built from real Event/Device values)",
  "evidence": [
    { "deviceId": "string", "field": "string", "value": "any" }
  ],
  "timestamp": "string (ISO 8601)",
  "status": "proposed | executed",
  "overrideOptions": ["keep", "not_tonight", "never"],
  "resolvedOverride": "keep | not_tonight | never | null"
}
```

Example — proposed:
```json
{
  "id": "why_501",
  "apartmentId": "apt_401",
  "ruleId": "rule_1",
  "action": "Lock all doors",
  "reason": "Everyone left the apartment at 21:05 (occupancy sensor went to unoccupied).",
  "evidence": [{ "deviceId": "dev_occ_401", "field": "value.occupied", "value": false }],
  "timestamp": "2026-09-16T21:05:01Z",
  "status": "proposed",
  "overrideOptions": ["keep", "not_tonight", "never"],
  "resolvedOverride": null
}
```

Example — resolved with override:
```json
{
  "id": "why_502",
  "apartmentId": "apt_401",
  "ruleId": "rule_1",
  "action": "Lock all doors",
  "reason": "Everyone left the apartment at 22:10.",
  "evidence": [{ "deviceId": "dev_occ_401", "field": "value.occupied", "value": false }],
  "timestamp": "2026-09-16T22:10:01Z",
  "status": "executed",
  "overrideOptions": ["keep", "not_tonight", "never"],
  "resolvedOverride": "not_tonight"
}
```

`not_tonight` suppresses rule for current day only. `never` disables rule (sets `Rule.enabled = false`). `keep` confirms, no change.

**Anomalies** (door opens while unit empty, no valid grant, dog left behind, etc.) surface as WhyCard with `status: "alert"`. Frontend renders alert style on that status. No separate shape.

---

## SosEvent

Emergency signal. Manual trigger, fall detection, or anomaly escalation.

```json
{
  "id": "string (uuid)",
  "apartmentId": "string",
  "triggeredBy": "string (resident id or device id)",
  "type": "manual | fall_detected | anomaly",
  "status": "active | acknowledged | resolved",
  "escalatedTo": "string (operator or emergency contact id)",
  "timestamp": "string (ISO 8601)"
}
```

Example — manual panic button:
```json
{
  "id": "sos_1",
  "apartmentId": "apt_401",
  "triggeredBy": "resident_maria",
  "type": "manual",
  "status": "active",
  "escalatedTo": "operator_desk_1",
  "timestamp": "2026-09-16T22:40:00Z"
}
```

Example — fall detected, resolved:
```json
{
  "id": "sos_2",
  "apartmentId": "apt_401",
  "triggeredBy": "dev_motion_401",
  "type": "fall_detected",
  "status": "resolved",
  "escalatedTo": "contact_daughter",
  "timestamp": "2026-09-16T14:12:00Z"
}
```

---

## CapabilityGrant

Time-boxed access permission.

```json
{
  "id": "string (uuid)",
  "actor": "string (user id or name)",
  "apartmentId": "string",
  "role": "owner | tenant | visitor | delivery | cleaner | operator",
  "scope": ["string (e.g. 'lock.unlock', 'ac.control', 'view.events')"],
  "validFrom": "string (ISO 8601)",
  "validUntil": "string (ISO 8601)",
  "recurring": {
    "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    "startTime": "HH:MM",
    "endTime": "HH:MM"
  }
}
```

`recurring` omitted for one-off grants.

**Privacy:** operator role scope limited to `["view.device_health", "view.faults"]`. Never `view.events` or `*.control` on resident unit. Enforced in permission model, not just convention.

Example — tenant lease grant:
```json
{
  "id": "grant_701",
  "actor": "tenant_maria",
  "apartmentId": "apt_401",
  "role": "tenant",
  "scope": ["lock.unlock", "ac.control", "light.control", "curtain.control"],
  "validFrom": "2026-09-01T00:00:00Z",
  "validUntil": "2027-09-01T00:00:00Z"
}
```

Example — recurring cleaner grant:
```json
{
  "id": "grant_702",
  "actor": "cleaner_svc_9",
  "apartmentId": "apt_401",
  "role": "cleaner",
  "scope": ["lock.unlock"],
  "validFrom": "2026-09-16T00:00:00Z",
  "validUntil": "2026-12-16T00:00:00Z",
  "recurring": { "days": ["mon", "thu"], "startTime": "09:00", "endTime": "11:00" }
}
```

---

## Conflict

Returned when two rules clash.

```json
{
  "id": "string (uuid)",
  "apartmentId": "string",
  "ruleA": "string (rule id)",
  "ruleB": "string (rule id)",
  "reason": "string (plain language)",
  "resolutionOptions": [
    { "type": "keep_a_disable_b", "label": "string" },
    { "type": "keep_b_disable_a", "label": "string" },
    { "type": "add_priority", "label": "string" },
    { "type": "edit_condition", "label": "string" }
  ],
  "detectedAt": "string (ISO 8601)"
}
```

Example — lock-all vs unlock-on-smoke:
```json
{
  "id": "conf_1",
  "apartmentId": "apt_401",
  "ruleA": "rule_1",
  "ruleB": "rule_2",
  "reason": "\"Lock all doors when everyone leaves\" conflicts with \"unlock on smoke\": if smoke triggers while apartment is empty, doors would lock then need to unlock again.",
  "resolutionOptions": [
    { "type": "keep_b_disable_a", "label": "Smoke unlock always wins (recommended)" },
    { "type": "add_priority", "label": "Set smoke rule to higher priority" },
    { "type": "edit_condition", "label": "Edit lock rule to exclude smoke-alarm state" }
  ],
  "detectedAt": "2026-09-16T18:05:01Z"
}
```

Example — two conflicting AC rules:
```json
{
  "id": "conf_2",
  "apartmentId": "apt_401",
  "ruleA": "rule_10",
  "ruleB": "rule_11",
  "reason": "\"Set AC to 18C after 10pm\" conflicts with \"turn off AC when no one home\": both trigger nightly and set opposite AC states.",
  "resolutionOptions": [
    { "type": "keep_a_disable_b", "label": "Keep nightly cooling rule" },
    { "type": "keep_b_disable_a", "label": "Keep occupancy-based off rule" },
    { "type": "add_priority", "label": "Occupancy rule takes priority over schedule" }
  ],
  "detectedAt": "2026-09-16T20:00:00Z"
}
```

---

## Handover flow

Operator assigns owner/tenant to unit + sets lease dates → system emits `CapabilityGrant` with `validFrom`/`validUntil` matching lease → grant auto-expires at `validUntil`, no manual revoke needed. Re-run handover (new tenant) issues new grant; old grant stays expired, not deleted (audit trail).
