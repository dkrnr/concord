import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuleTargets, validateSentenceTargets } from './llm.js';
import { seedDevices } from './seedState.js';

const devices = seedDevices();

test('accepts supported bedroom AC and whole-home lock intents', () => {
  assert.equal(validateSentenceTargets('cool the bedroom to 23 at 10pm', devices), null);
  assert.equal(validateRuleTargets('cool the bedroom to 23 at 10pm', {
    actions: [{ deviceType: 'ac', deviceId: 'dev_ac_bedroom', set: { on: true, temperature: 23 } }],
  }, devices), null);
  assert.equal(validateSentenceTargets('lock all doors when everyone leaves', devices), null);
  assert.equal(validateRuleTargets('lock all doors when everyone leaves', {
    actions: [{ deviceType: 'lock', deviceId: 'all', set: { locked: true } }],
  }, devices), null);
});

test('rejects a named controllable target missing from the apartment', () => {
  assert.equal(
    validateSentenceTargets('dim the kitchen lights', devices),
    "I couldn't find a controllable kitchen light — choose an available device or rephrase.",
  );
  assert.equal(
    validateSentenceTargets('turn on the office light', devices),
    "I couldn't find a controllable office light — choose an available device or rephrase.",
  );
});

test('rejects vague input before model interpretation', () => {
  assert.match(validateSentenceTargets('make it nicer', devices), /specific device, room, or automation condition/);
});

test('rejects a model action redirected to another room', () => {
  assert.equal(
    validateRuleTargets('dim the kitchen lights', {
      actions: [{ deviceType: 'light', deviceId: 'dev_light_living', set: { on: true, brightness: 30 } }],
    }, devices),
    "I couldn't find a controllable kitchen light — choose an available device or rephrase.",
  );
});
