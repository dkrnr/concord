import { BUILDING_TZ } from './seedState.js';

const VALID_ROLES = new Set(['owner', 'tenant', 'visitor', 'delivery', 'cleaner', 'operator']);
const VALID_DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Field-level validation for CapabilityGrant at creation time. Returns a
// fieldErrors map (adapter Error shape) or null when the grant is valid.
export function validateGrant(grant) {
  const errors = {};
  if (!grant.apartmentId) errors.apartmentId = 'apartmentId is required.';
  if (!grant.actor) errors.actor = 'actor is required.';
  if (!grant.role || !VALID_ROLES.has(grant.role)) errors.role = `role must be one of ${[...VALID_ROLES].join(', ')}.`;
  if (!Array.isArray(grant.scope) || grant.scope.length === 0) errors.scope = 'scope must be a non-empty array of scope strings.';

  const from = new Date(grant.validFrom);
  const until = new Date(grant.validUntil);
  if (!grant.validFrom || Number.isNaN(from.getTime())) errors.validFrom = 'validFrom must be a valid ISO datetime.';
  if (!grant.validUntil || Number.isNaN(until.getTime())) errors.validUntil = 'validUntil must be a valid ISO datetime.';
  if (!errors.validFrom && !errors.validUntil && from >= until) errors.validUntil = 'validUntil must be after validFrom.';

  if (grant.recurring) {
    const r = grant.recurring;
    if (!Array.isArray(r.days) || r.days.length === 0 || r.days.some((d) => !VALID_DAYS.has(d))) {
      errors['recurring.days'] = 'recurring.days must be a non-empty array using mon,tue,wed,thu,fri,sat,sun.';
    }
    if (!TIME_RE.test(r.startTime ?? '')) errors['recurring.startTime'] = 'recurring.startTime must be 24h "HH:MM".';
    if (!TIME_RE.test(r.endTime ?? '')) errors['recurring.endTime'] = 'recurring.endTime must be 24h "HH:MM".';
  }

  return Object.keys(errors).length ? errors : null;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Use-time check: is this grant valid right now, honoring the full lease window
// AND (when present) the recurring days + startTime/endTime window. Overnight
// windows (startTime > endTime, e.g. 22:00-06:00) wrap past midnight.
export function isGrantActiveAt(grant, now = new Date()) {
  const from = new Date(grant.validFrom);
  const until = new Date(grant.validUntil);
  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) return false;
  if (now < from || now > until) return false;
  if (!grant.recurring) return true;

  const day = now.toLocaleDateString('en-US', { timeZone: BUILDING_TZ, weekday: 'short' }).slice(0, 3).toLowerCase();
  if (!grant.recurring.days.includes(day)) return false;

  const localHHMM = now.toLocaleTimeString('en-GB', { timeZone: BUILDING_TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  const nowMin = timeToMinutes(localHHMM);
  const startMin = timeToMinutes(grant.recurring.startTime);
  const endMin = timeToMinutes(grant.recurring.endTime);
  return startMin <= endMin ? (nowMin >= startMin && nowMin < endMin) : (nowMin >= startMin || nowMin < endMin);
}

export function grantHasScope(grant, scope) {
  return grant.scope.includes(scope);
}
