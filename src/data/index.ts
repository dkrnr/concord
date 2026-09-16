import { httpAdapter } from './httpAdapter';
import type { ConcordAdapter } from './adapter';

// Concord always uses the live HTTP engine documented in API.md.
export const adapter: ConcordAdapter = httpAdapter;
