import type { CapabilityGrant, Conflict, Device, Event, Rule, SosEvent, WhyCard, WhyOverride } from '../domain/contracts';

export type RuleProposal = { rule: Rule; conflicts: Conflict[] };
export type RuleSaveResult =
  | { status: 'saved'; rule: Rule }
  | { status: 'conflict'; rule: Rule; conflicts: Conflict[] };
export type FeedItem =
  | { kind: 'event'; data: Event }
  | { kind: 'why_card'; data: WhyCard }
  | { kind: 'sos_event'; data: SosEvent };
export type DeviceCommandResult = { event: Event; whyCards: WhyCard[] };

export interface ConcordAdapter {
  fetchDevices(apartmentId: string, signal?: AbortSignal): Promise<Device[]>;
  fetchRules(apartmentId: string, signal?: AbortSignal): Promise<Rule[]>;
  fetchGrants(apartmentId: string, signal?: AbortSignal): Promise<CapabilityGrant[]>;
  fetchWhyCards(apartmentId: string, signal?: AbortSignal): Promise<WhyCard[]>;
  commandDevice(input: { deviceId: string; set: Record<string, unknown>; requestId: string }, signal?: AbortSignal): Promise<DeviceCommandResult>;
  submitSentence(input: { apartmentId: string; sentence: string }, signal?: AbortSignal): Promise<RuleProposal>;
  saveRule(input: { rule: Rule; resolutions: { conflictId: string; type: string }[]; requestId: string }, signal?: AbortSignal): Promise<RuleSaveResult>;
  postWhyOverride(input: { whyCardId: string; override: WhyOverride; requestId: string }, signal?: AbortSignal): Promise<WhyCard>;
  createGrant(input: { grant: Omit<CapabilityGrant, 'id'>; requestId: string }, signal?: AbortSignal): Promise<CapabilityGrant>;
  triggerSos(input: { apartmentId: string; requestId: string }, signal?: AbortSignal): Promise<SosEvent>;
  pollFeed(input: { apartmentId: string; cursor?: string }, signal?: AbortSignal): Promise<{ items: FeedItem[]; cursor: string; hasMore: boolean; reset: boolean }>;
}
