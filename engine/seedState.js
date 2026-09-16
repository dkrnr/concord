// Seed data for apt_401. Reset restores exactly this.
export const APARTMENT = 'apt_401';
export const BUILDING_TZ = 'Asia/Colombo';

// Rule ids the engine treats as immutable life-safety rules.
// Never exposed as an extra field on Rule -- tracked server-side only.
export const SAFETY_RULE_IDS = new Set(['rule_smoke']);

export function seedDevices() {
  const now = new Date().toISOString();
  return [
    { id: 'dev_lock_401', type: 'lock', apartmentId: APARTMENT, state: { locked: true, room: 'entry' }, lastUpdated: now },
    { id: 'dev_ac_bedroom', type: 'ac', apartmentId: APARTMENT, state: { on: true, temperature: 24, room: 'bedroom' }, lastUpdated: now },
    { id: 'dev_light_living', type: 'light', apartmentId: APARTMENT, state: { on: true, brightness: 32, room: 'living' }, lastUpdated: now },
    { id: 'dev_curtain_living', type: 'curtain', apartmentId: APARTMENT, state: { openPercent: 18, room: 'living' }, lastUpdated: now },
    { id: 'dev_motion_hallway', type: 'motion', apartmentId: APARTMENT, state: { room: 'hallway' }, lastUpdated: now },
    { id: 'dev_smoke_401', type: 'smoke', apartmentId: APARTMENT, state: { alarm: false, ppm: 4, room: 'kitchen' }, lastUpdated: now },
    { id: 'dev_occ_401', type: 'occupancy', apartmentId: APARTMENT, state: { occupied: true }, lastUpdated: now },
  ];
}

export function seedRules() {
  return [
    {
      id: 'rule_lock_on_leave', apartmentId: APARTMENT, name: 'Lock all doors when everyone leaves',
      sourceSentence: 'lock all doors when everyone leaves',
      trigger: { kind: 'event', eventType: 'occupancy.changed' },
      conditions: [{ field: 'value.occupied', op: 'eq', value: false }],
      actions: [{ deviceType: 'lock', deviceId: 'all', set: { locked: true } }],
      enabled: true, createdAt: '2026-09-16T18:00:00Z',
    },
    {
      id: 'rule_light_on_motion', apartmentId: APARTMENT, name: 'Turn on hallway light on motion',
      sourceSentence: 'turn on the hallway light when there is motion in the evening',
      trigger: { kind: 'event', eventType: 'motion.detected' },
      conditions: [{ field: 'value.room', op: 'eq', value: 'hallway' }],
      actions: [{ deviceType: 'light', deviceId: 'dev_light_living', set: { on: true, brightness: 60 } }],
      enabled: true, createdAt: '2026-09-16T18:05:00Z',
    },
    {
      id: 'rule_smoke', apartmentId: APARTMENT, name: 'Unlock on smoke',
      sourceSentence: 'unlock doors on smoke alarm',
      trigger: { kind: 'event', eventType: 'smoke.alarm' },
      conditions: [{ field: 'value.alarm', op: 'eq', value: true }],
      actions: [{ deviceType: 'lock', deviceId: 'all', set: { locked: false } }],
      enabled: true, createdAt: '2026-09-16T09:00:00Z',
    },
  ];
}
