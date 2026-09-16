import { mockAdapter } from './mockAdapter';
import { httpAdapter } from './httpAdapter';
import type { ConcordAdapter } from './adapter';

// Flip with VITE_ADAPTER=http in .env (or `VITE_ADAPTER=http npm run dev`).
// Defaults to the in-browser mock so the app runs with no engine running.
export const adapter: ConcordAdapter =
  import.meta.env.VITE_ADAPTER === 'http' ? httpAdapter : mockAdapter;
