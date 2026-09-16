# Concord competition UI

Concord is a mobile-first React demo for a smart apartment platform that acts on resident patterns, explains why, accepts corrections, and keeps safety rules authoritative. It includes resident, visitor-access, operator and handover flows.

## Run

Requirements: Node.js 20+.

```bash
npm install --legacy-peer-deps
npm run dev
```

Production build and local preview:

```bash
npm run build
npm run preview -- --port ${PORT:-4192}
```

The existing workspace install was assembled from already-cached local packages after `registry.npmjs.org` timed out. A normal install should use the package versions in `package.json` when registry access is available.

## Data boundary

The UI currently imports `src/data/mockAdapter.ts`. The replaceable interface is `src/data/adapter.ts`; [ADAPTER.md](ADAPTER.md) defines semantics for the engine team, including sentence interpretation, explicit rule saving, conflicts, why-card overrides, grants, SOS, and feed polling. Swap the adapter implementation when backend routes are agreed; components should not call HTTP directly.

An optional local demo engine exists under `engine/` and starts with:

```bash
npm run engine
```

It uses `PORT` (default `8787`) and in-memory state. It is demo scaffolding, not authentication, durable storage, or a production safety system.

## Demo boundaries

- Emergency actions notify a simulated building desk; they do not contact emergency services.
- QR passes are real encoded SVGs for the demo flow, but secure server-side redemption is pending backend integration.
- Resident/operator switching is an explicit demo view, not authentication.
- No analytics, optional storage, cookies, or external assets are loaded.

## Verification

From the workspace root, run shared visual QA against a production preview:

```bash
node scripts/screenshot.mjs http://127.0.0.1:4192 sites/concord/qa
node scripts/motion-qa.mjs http://127.0.0.1:4192 sites/concord/qa/motion
```

From this directory:

```bash
node qa/interaction.mjs http://127.0.0.1:4192
node qa/scene.mjs http://127.0.0.1:4192
node qa/text-floor.mjs http://127.0.0.1:4192
```
