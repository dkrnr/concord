# Concord — next-session handoff

Saved 2026-09-17. Read root STUDIO.md and SESSION-ARCHIVE-2026-09-17.md for user intent;
this competition checkpoint does not replace the studio's creative quality bar.

## Current scope and implementation

Mobile-first luxury apartment app: resident dashboard/3D home, why feed, scene builder,
safety conflict, visitor grants, SOS; light operator view and handover. Exact entities
are in CONTRACT.md; integration semantics in ADAPTER.md and src/data/adapter.ts.
Backend is being developed alongside the UI. Live HTTP mode is VITE_ADAPTER=http;
engine default is http://localhost:8787. The HTTP engine still simulates devices.

Judge-feedback work was implemented in the requested order and committed separately:

- ec2a052: Vite duplicate export/build repair.
- 37ca505: actual returned scene targets/actions editable; conflicts never show saved.
- 10b5f08: event-backed manual light/AC/curtain/lock controls, mobile list, scene props.
- f120cfe: proposed Approve/Dismiss versus executed Keep/Not tonight/Never.
- 72b28fa: offline startup, stale/reconnecting/retry, visible resident write errors.
- 84ed66e: persisted grants, locally encoded per-grant QR, backup code, lifecycle states.
- 9eb9bc3: final production QA evidence and documentation.

Do not modify the hard-coded operator grid or handover owner-selection without a new
request. Dark mode, languages, profiles, notifications, recurring access and system
maintenance banners were excluded. Backend contributor's uncommitted engine/server.js
changes remain: apartment-filtered fetchGrants and honoring apartmentId on createGrant.
Preserve these; inspect git diff before editing/staging. They were present during tests.

## Running and evidence

Inside sites/concord: npm run engine; VITE_ADAPTER=http npm run build;
npm run preview -- --port 5173. Preview and engine were left running, but must be checked
again after session/laptop restarts. One frontend adapter only; avoid stale mock servers.
Engine was reset after QA: 7 devices, 3 rules, 0 WhyCards. Empty feed after reset is expected.

qa/LIVE-AUDIT.md is the pre-fix audit. qa/final/ contains production screenshots;
qa/motion-final/ contains temporal, reduced-motion and forced-fallback captures.
qa/checkpoint-*.png records functional flows. Live Playwright tests checked command POSTs
and engine state, proposal approval/dismissal, failed writes/offline recovery and grant
persistence/statuses. Tests were run against the built preview as well as dev.
Temporary scripts used: /tmp/concord-{controls,proposals,connection,visitor}-test.mjs;
they may disappear. Screenshots/reports are committed. Main build passes with a large
~919 kB raw / 256 kB gzip bundle warning. Registry install stalled; QR encoder was
vendored from local qrcode-terminal and converted to ESM, with license retained.

## Evidence limits and honest continuation

Previous assistant reported “100% complete.” Interpret this as the bounded checkpoint
report, not production certification or user creative acceptance. No completed pentest
is recorded. Capture scripts do not themselves establish aesthetic quality, physical
mobile GPU performance or every interactive motion state. Scene QA asserted normalized
props; it did not quantitatively verify each material's visible change.

Known details to keep honest if relevant to the next brief:

- QR/backup code identify a demo grant; secure redemption is explicitly pending. The
  payload points to /visitor-pass/<id>, but a dedicated visitor/redemption page was not
  implemented in this checkpoint. Do not claim a working unlock journey from scanning.
- Proposal-decision endpoints exist; automatic high-stakes classification and safety
  enforcement remain engine responsibilities and were not comprehensively verified.
- Connection code has timeout/backoff and retry; full ADAPTER.md convergence semantics
  (15-second snapshots, bootstrap race, reset projection clearing, idempotent retry IDs)
  were not all completed/tested. Poll cancellation and overlapping focus polls warrant
  inspection if synchronization changes are requested.
- Some dashboard copy/counts are static. Operator data is deliberately hard-coded.
- SOS/handover error handling and proposal stale-state backend edge cases were not part
  of the demonstrated four final tests. Avoid assuming coverage from the global pass.
- Six-second HTTP timeout also applies to sentence interpretation; slow local model
  responses may require a separate timeout. Engine NLP quality is separate from showing
  the returned rule truthfully.

## Next action

Read the next user's request, inspect the current diff, and continue the existing app.
Do not repeat reference research or rebuild the site unless the new scope calls for it.
Keep progress concise, save meaningful checkpoints and distinguish verified behavior
from unfinished integration. No fresh implementation is requested by this handoff.
