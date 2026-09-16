import type { ConcordAdapter, RuleProposal, RuleSaveResult, FeedItem } from './adapter';
import type { CapabilityGrant, Device, Rule, SosEvent, WhyCard, WhyOverride } from '../domain/contracts';

const BASE = import.meta.env.VITE_ENGINE_URL ?? 'http://localhost:8787';

async function call<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.message || `${path} failed (${res.status})`);
    Object.assign(err, data);
    throw err;
  }
  return data as T;
}

export const httpAdapter: ConcordAdapter = {
  fetchDevices(apartmentId, signal) { return call<Device[]>('/fetchDevices', { apartmentId }, signal); },
  fetchRules(apartmentId, signal) { return call<Rule[]>('/fetchRules', { apartmentId }, signal); },
  fetchGrants(apartmentId, signal) { return call<CapabilityGrant[]>('/fetchGrants', { apartmentId }, signal); },

  // Engine has no standalone fetchWhyCards route (not part of ADAPTER.md); derive
  // the initial card set from a cursor-less pollFeed bootstrap instead.
  async fetchWhyCards(apartmentId, signal) {
    const batch = await call<{ items: FeedItem[] }>('/pollFeed', { apartmentId }, signal);
    return batch.items.filter((i) => i.kind === 'why_card').map((i) => i.data as WhyCard);
  },

  submitSentence(input, signal) { return call<RuleProposal>('/submitSentence', input, signal); },
  saveRule(input, signal) { return call<RuleSaveResult>('/saveRule', input, signal); },
  postWhyOverride(input, signal) { return call<WhyCard>('/postWhyOverride', input, signal); },
  createGrant(input, signal) { return call<CapabilityGrant>('/createGrant', input, signal); },
  triggerSos(input, signal) { return call<SosEvent>('/triggerSos', input, signal); },
  pollFeed(input, signal) { return call('/pollFeed', input, signal); },
};
