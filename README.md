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

## Present from another machine

`npm run relay` builds Concord, starts the app and live in-memory engine on one origin,
then opens a free Cloudflare Quick Tunnel. Share the printed `https://…trycloudflare.com`
URL. Keep that terminal and this machine awake during the presentation; Quick Tunnel URLs
are temporary and change when restarted.

The public URL is also the API base, so commands sent from any machine update the same
state the open browser polls and renders in the 3D apartment:

```bash
PUBLIC_URL=https://example.trycloudflare.com
curl -sS "$PUBLIC_URL/commandDevice" \
  -H 'content-type: application/json' \
  --data '{"deviceId":"dev_light_living","set":{"on":false,"brightness":20},"requestId":"demo-light-1"}'
```

For local production without a tunnel, run `npm run build && npm start`. Override the
single server port with `PORT=8790 npm start`.

The existing workspace install was assembled from already-cached local packages after `registry.npmjs.org` timed out. A normal install should use the package versions in `package.json` when registry access is available.

## Data boundary

The UI always uses the live HTTP adapter in `src/data/httpAdapter.ts`. Development defaults
to `http://localhost:8787`; production defaults to the page's own origin so a relay serves
the UI and API together. `VITE_ENGINE_URL` can override either. [API.md](API.md) documents
the engine surface; components call it through `src/data/adapter.ts` and never use mocks.

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
