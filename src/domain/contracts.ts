export type DeviceType = 'lock' | 'ac' | 'light' | 'curtain' | 'motion' | 'smoke' | 'occupancy';

export interface Device {
  id: string;
  type: DeviceType;
  apartmentId: string;
  state: Record<string, unknown>;
  lastUpdated: string;
}

export interface Event {
  id: string;
  deviceId: string;
  type: string;
  value: unknown;
  timestamp: string;
  apartmentId: string;
}

export interface Condition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte';
  value: unknown;
}

export interface RuleAction {
  deviceType: string;
  deviceId: string | 'all';
  set: Record<string, unknown>;
}

export interface Rule {
  id: string;
  apartmentId: string;
  name: string;
  sourceSentence: string;
  trigger: { kind: 'event' | 'time'; eventType?: string; at?: string };
  conditions: Condition[];
  actions: RuleAction[];
  enabled: boolean;
  createdAt: string;
}

export type WhyOverride = 'keep' | 'not_tonight' | 'never';
export interface WhyCard {
  id: string;
  apartmentId: string;
  ruleId: string;
  action: string;
  reason: string;
  evidence: { deviceId: string; field: string; value: unknown }[];
  timestamp: string;
  status: 'proposed' | 'executed' | 'alert';
  overrideOptions: WhyOverride[];
  resolvedOverride: WhyOverride | null;
}

export interface SosEvent {
  id: string;
  apartmentId: string;
  triggeredBy: string;
  type: 'manual' | 'fall_detected' | 'anomaly';
  status: 'active' | 'acknowledged' | 'resolved';
  escalatedTo: string;
  timestamp: string;
}

export type GrantRole = 'owner' | 'tenant' | 'visitor' | 'delivery' | 'cleaner' | 'operator';
export interface CapabilityGrant {
  id: string;
  actor: string;
  apartmentId: string;
  role: GrantRole;
  scope: string[];
  validFrom: string;
  validUntil: string;
  recurring?: { days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[]; startTime: string; endTime: string };
}

export type ConflictResolutionType = 'keep_a_disable_b' | 'keep_b_disable_a' | 'add_priority' | 'edit_condition';
export interface Conflict {
  id: string;
  apartmentId: string;
  ruleA: string;
  ruleB: string;
  reason: string;
  resolutionOptions: { type: ConflictResolutionType; label: string }[];
  detectedAt: string;
}
