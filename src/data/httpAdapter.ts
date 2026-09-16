import type { ConcordAdapter, RuleProposal, RuleSaveResult, DeviceCommandResult, FeedItem } from './adapter';
import type { CapabilityGrant, Device, NotificationItem, Portfolio, Rule, SosEvent, WhyCard, WhyOverride } from '../domain/contracts';

const BASE = import.meta.env.VITE_ENGINE_URL ?? 'http://localhost:8787';

async function call<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(6000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: requestSignal,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    const err = new Error('The home engine is unavailable. Check the connection and try again.');
    Object.assign(err, { code: 'UNAVAILABLE', retryable: true, cause });
    throw err;
  }
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
  commandDevice(input, signal) { return call<DeviceCommandResult>('/commandDevice', input, signal); },
  approveWhyCard(input, signal) { return call<WhyCard>('/approveWhyCard', input, signal); },
  dismissWhyCard(input, signal) { return call<WhyCard>('/dismissWhyCard', input, signal); },

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
  fetchNotifications(apartmentId, signal) { return call<NotificationItem[]>('/fetchNotifications', { apartmentId }, signal); },
  markNotificationRead(notificationId, signal) { return call('/markNotificationRead', { notificationId }, signal); },
  fetchPortfolio(signal) { return call<Portfolio>('/fetchPortfolio', {}, signal); },
};
