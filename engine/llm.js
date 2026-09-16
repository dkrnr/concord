// Sentence -> Rule via local Qwen (Ollama). Config flag swaps in a hosted model later.
const MODEL_PROVIDER = process.env.MODEL_PROVIDER || 'ollama'; // 'ollama' | 'hosted'
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:4b';

const SYSTEM_PROMPT = `You convert one plain-language home-automation sentence into ONE JSON Rule object.
/no_think
Output ONLY the JSON object. No prose, no markdown fences, no explanation, no <think> tags.

Rule shape:
{
  "name": string,
  "trigger": { "kind": "event" | "time", "eventType"?: string, "at"?: "HH:MM" },
  "conditions": [{ "field": string, "op": "eq"|"neq"|"gt"|"lt"|"gte"|"lte", "value": any }],
  "actions": [{ "deviceType": "lock"|"ac"|"light"|"curtain", "deviceId": string|"all", "set": object }]
}

Valid event types: occupancy.changed (value.occupied bool), motion.detected (value.room string),
smoke.alarm (value.alarm bool), lock.changed (value.locked bool).
Condition fields read from the triggering event's value (e.g. "value.occupied") or from current
device state by type (e.g. "devices.smoke.alarm").
If the sentence is too vague to produce a concrete trigger+action, output exactly: {"error":"unclear"}
Use only devices listed in the current apartment inventory supplied with the sentence.
When the resident names a room or device, never substitute a device from another room.
If the named controllable device is unavailable, output exactly: {"error":"unavailable target"}

Examples:

Sentence: lock all doors when everyone leaves
{"name":"Lock all doors when everyone leaves","trigger":{"kind":"event","eventType":"occupancy.changed"},"conditions":[{"field":"value.occupied","op":"eq","value":false}],"actions":[{"deviceType":"lock","deviceId":"all","set":{"locked":true}}]}

Sentence: unlock the doors if there's a smoke alarm
{"name":"Unlock on smoke","trigger":{"kind":"event","eventType":"smoke.alarm"},"conditions":[{"field":"value.alarm","op":"eq","value":true}],"actions":[{"deviceType":"lock","deviceId":"all","set":{"locked":false}}]}

Sentence: cool the bedroom to 23 degrees at 10pm
{"name":"Cool bedroom at night","trigger":{"kind":"time","at":"22:00"},"conditions":[],"actions":[{"deviceType":"ac","deviceId":"dev_ac_bedroom","set":{"on":true,"temperature":23}}]}

Sentence: turn on the living room light when there's motion in the hallway
{"name":"Living room light on hallway motion","trigger":{"kind":"event","eventType":"motion.detected"},"conditions":[{"field":"value.room","op":"eq","value":"hallway"}],"actions":[{"deviceType":"light","deviceId":"dev_light_living","set":{"on":true,"brightness":60}}]}

Sentence: make my apartment nicer
{"error":"unclear"}`;

function stripFences(text) {
  return text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
}

function extractJson(text) {
  const cleaned = stripFences(text);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object found');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function validateRuleShape(obj) {
  if (!obj || typeof obj !== 'object') return 'not an object';
  if (obj.error) return `model declined: ${obj.error}`;
  if (typeof obj.name !== 'string' || !obj.name) return 'missing name';
  if (!obj.trigger || (obj.trigger.kind !== 'event' && obj.trigger.kind !== 'time')) return 'invalid trigger';
  if (obj.trigger.kind === 'event' && typeof obj.trigger.eventType !== 'string') return 'event trigger missing eventType';
  if (obj.trigger.kind === 'time' && typeof obj.trigger.at !== 'string') return 'time trigger missing at';
  if (!Array.isArray(obj.conditions)) return 'conditions must be an array';
  if (!Array.isArray(obj.actions) || obj.actions.length === 0) return 'actions must be a non-empty array';
  for (const a of obj.actions) {
    if (!a.deviceType || !a.deviceId || typeof a.set !== 'object') return 'invalid action shape';
  }
  return null;
}

async function callOllama(sentence, inventory, correction) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Current apartment inventory:\n${inventory}\n\nSentence: ${sentence}` },
  ];
  if (correction) messages.push({ role: 'user', content: correction });

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false, think: false, format: 'json' }),
  });
  if (!res.ok) throw new Error(`ollama http ${res.status}`);
  const data = await res.json();
  return data.message?.content ?? '';
}

async function callHosted() {
  throw new Error('hosted model not configured: set MODEL_PROVIDER=hosted and implement callHosted()');
}

const ROOM_ALIASES = new Map([
  ['living room', 'living'], ['living', 'living'], ['bedroom', 'bedroom'],
  ['kitchen', 'kitchen'], ['hallway', 'hallway'], ['entryway', 'entry'],
  ['entry', 'entry'], ['bathroom', 'bathroom'], ['dining room', 'dining'],
  ['balcony', 'balcony'], ['garage', 'garage'], ['office', 'office'],
  ['study', 'study'], ['den', 'den'], ['guest room', 'guest'],
  ['nursery', 'nursery'], ['laundry room', 'laundry'], ['patio', 'patio'],
]);

const TYPE_LABELS = { light: 'light', ac: 'AC', lock: 'lock', curtain: 'curtain' };

function namedRooms(sentence) {
  const normalized = sentence.toLowerCase();
  return [...ROOM_ALIASES.entries()]
    .filter(([phrase]) => new RegExp(`\\b${phrase.replace(' ', '\\s+')}\\b`, 'i').test(normalized))
    .map(([, room]) => room)
    .filter((room, index, all) => all.indexOf(room) === index);
}

function namedDeviceTypes(sentence) {
  const normalized = sentence.toLowerCase();
  const types = [];
  if (/\b(light|lights|lamp|lamps|lighting|dim|brighten)\b/.test(normalized)) types.push('light');
  if (/\b(ac|a\/c|air\s*condition(?:er|ing)?|climate|cool|cooling|temperature|heat|heating)\b/.test(normalized)) types.push('ac');
  if (/\b(lock|locks|locked|unlock|unlocks|unlocked|door|doors)\b/.test(normalized)) types.push('lock');
  if (/\b(curtain|curtains|blind|blinds|drape|drapes)\b/.test(normalized)) types.push('curtain');
  return types;
}

function clarificationFor(room, type) {
  const target = [room, TYPE_LABELS[type]].filter(Boolean).join(' ');
  return `I couldn't find a controllable ${target} — choose an available device or rephrase.`;
}

function controllableDevices(devices) {
  return devices.filter((device) => Object.hasOwn(TYPE_LABELS, device.type));
}

export function validateSentenceTargets(sentence, devices) {
  const rooms = namedRooms(sentence);
  const types = namedDeviceTypes(sentence);
  const available = controllableDevices(devices);

  if (rooms.length === 1 && types.length === 1) {
    const [room] = rooms;
    const [type] = types;
    if (!available.some((device) => device.type === type && device.state?.room === room)) {
      return clarificationFor(room, type);
    }
  }

  const hasAutomationContext = /\b(when|whenever|before|after|sleep|bedtime|leave|leaves|left|arrive|arrives|home|away|sunset|sunrise|motion|smoke|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i.test(sentence);
  if (rooms.length === 0 && types.length === 0 && !hasAutomationContext) {
    return 'I need a specific device, room, or automation condition — choose an available device or rephrase.';
  }
  return null;
}

export function validateRuleTargets(sentence, rule, devices) {
  const rooms = namedRooms(sentence);
  const types = namedDeviceTypes(sentence);
  const available = controllableDevices(devices);

  for (const action of rule.actions) {
    if (!Object.hasOwn(TYPE_LABELS, action.deviceType)) {
      return 'I couldn\'t safely match that request to a controllable device — choose an available device or rephrase.';
    }
    if (types.length > 0 && !types.includes(action.deviceType)) {
      return 'I couldn\'t safely match that request to the device you named — choose an available device or rephrase.';
    }
    if (action.deviceId !== 'all') {
      const target = available.find((device) => device.id === action.deviceId);
      if (!target || target.type !== action.deviceType) {
        return 'I couldn\'t safely match that request to an available device — choose an available device or rephrase.';
      }
      if (rooms.length > 0 && !rooms.includes(target.state?.room)) {
        return clarificationFor(rooms[0], types[0] ?? action.deviceType);
      }
    } else if (rooms.length > 0) {
      return clarificationFor(rooms[0], types[0] ?? action.deviceType);
    }
  }
  return null;
}

function inventoryForPrompt(devices) {
  const available = controllableDevices(devices);
  if (available.length === 0) return '- No controllable devices';
  return available.map((device) => `- ${device.id}: ${device.type}, room=${device.state?.room ?? 'unspecified'}`).join('\n');
}

// Returns { rule: PartialRule } or { error: message }. One retry on malformed/invalid JSON.
export async function sentenceToRule(sentence, devices) {
  const targetProblem = validateSentenceTargets(sentence, devices);
  if (targetProblem) return { error: targetProblem };

  const call = MODEL_PROVIDER === 'hosted' ? callHosted : callOllama;
  const inventory = inventoryForPrompt(devices);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const correction = attempt === 0 ? undefined
        : 'Your previous reply was not valid JSON matching the Rule shape. Reply with ONLY the JSON object, nothing else.';
      const raw = await call(sentence, inventory, correction);
      const parsed = extractJson(raw);
      const problem = validateRuleShape(parsed);
      if (problem) throw new Error(problem);
      const targetValidation = validateRuleTargets(sentence, parsed, devices);
      if (targetValidation) return { error: targetValidation };
      return { rule: parsed };
    } catch (err) {
      if (attempt === 1) return { error: `Could not turn that into a rule: ${err.message}` };
    }
  }
  return { error: 'Could not turn that into a rule.' };
}
