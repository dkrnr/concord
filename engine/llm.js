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

Examples:

Sentence: lock all doors when everyone leaves
{"name":"Lock all doors when everyone leaves","trigger":{"kind":"event","eventType":"occupancy.changed"},"conditions":[{"field":"value.occupied","op":"eq","value":false}],"actions":[{"deviceType":"lock","deviceId":"all","set":{"locked":true}}]}

Sentence: unlock the doors if there's a smoke alarm
{"name":"Unlock on smoke","trigger":{"kind":"event","eventType":"smoke.alarm"},"conditions":[{"field":"value.alarm","op":"eq","value":true}],"actions":[{"deviceType":"lock","deviceId":"all","set":{"locked":false}}]}

Sentence: cool the bedroom to 23 degrees at 10pm
{"name":"Cool bedroom at night","trigger":{"kind":"time","at":"22:00"},"conditions":[],"actions":[{"deviceType":"ac","deviceId":"dev_ac_bedroom","set":{"on":true,"temperature":23}}]}

Sentence: turn on the hallway light when there's motion
{"name":"Hallway light on motion","trigger":{"kind":"event","eventType":"motion.detected"},"conditions":[{"field":"value.room","op":"eq","value":"hallway"}],"actions":[{"deviceType":"light","deviceId":"dev_light_living","set":{"on":true,"brightness":60}}]}

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

async function callOllama(sentence, correction) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Sentence: ${sentence}` },
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

// Returns { rule: PartialRule } or { error: message }. One retry on malformed/invalid JSON.
export async function sentenceToRule(sentence) {
  const call = MODEL_PROVIDER === 'hosted' ? callHosted : callOllama;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const correction = attempt === 0 ? undefined
        : 'Your previous reply was not valid JSON matching the Rule shape. Reply with ONLY the JSON object, nothing else.';
      const raw = await call(sentence, correction);
      const parsed = extractJson(raw);
      const problem = validateRuleShape(parsed);
      if (problem) throw new Error(problem);
      return { rule: parsed };
    } catch (err) {
      if (attempt === 1) return { error: `Could not turn that into a rule: ${err.message}` };
    }
  }
  return { error: 'Could not turn that into a rule.' };
}
