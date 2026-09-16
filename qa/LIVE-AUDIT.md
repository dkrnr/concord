# Live HTTP audit — 2026-09-17

Audit only. No application fixes applied. Existing uncommitted vite.config.ts and .env.example preserved.

## Runtime evidence

- Engine localhost:8787 responds with seven devices, including living light at 60% and occupancy false.
- Existing frontends at 5173 and 4192 issued no engine requests and showed mock light 32%, occupancy true.
- Temporary audit frontend at 127.0.0.1:4194 started with VITE_ADAPTER=http through Vite's programmatic API, configFile:false. This avoids changing the existing Vite config, which currently contains two default exports and blocks normal restart/build.
- Browser verified HTTP-mode device list, three feed cards, access form and building screen.

## Feature findings

1. Resident dashboard: real devices and WhyCards load through HTTP. Device items only focus rooms; no manual control or command method. Device list hidden on mobile. Scene receives room/preview only, not actual device state. Counts/status captions are static; motion sensor is incorrectly labeled Away.
2. Visitor access: frontend createGrant is wired to HTTP and engine route exists. Successful grant writes were NOT tested: automatic approval review rejected live grant/rule mutations during audit-before-changes. Existing grant read/form works. All passes use the same pass-qr.svg; no grant-specific QR, backup code, pending/expired state, copy/share. Every list entry says Active.
3. Operator/developer: UI and filters render but units/health/energy are hard-coded client fixtures, not live data (including 48-residence heading). Handover uses createGrant but owner selection is ignored (always tenant); engine overwrites requested apartment with apt_401. No separate developer screen; handover is its intended flow.
4. Scene builder: live interpretation works. Browser sentence `dim the kitchen at 10pm` produced light/all/brightness:30 at 22:00, no conditions, and an ordinary lighting conflict. Receipt incorrectly displayed `Lock the entry` and `Someone is home`. Only trigger time is editable. Target room/device/value cannot be corrected. Preview is always bedroom. Conflict modal is hard-coded to smoke safety even for ordinary conflicts.
5. Save correctness: source-verified mismatch: engine returns saved OR conflict; frontend type assumes saved and callers show success unconditionally. Safe-adjustment UI sends edit_condition without actually editing conditions; HTTP engine expects caller to edit and may return conflict. This differs from mock behavior. Live save success was not tested.
6. Proposed cards: badge differs but buttons remain Keep/Not tonight/Never. Engine currently emits executed/alert; no proposal decision route or manual command route in adapter/server. These need real engine semantics, not renamed override buttons or frontend state patches.
7. Connection/errors: browser-local network block left `Demo engine live` visible. Reload with blocked engine stayed at `Preparing Apartment 401`, with Failed to fetch. Writes mostly have finally without catch; poll failures are silently retried. No stale/error/retry UI, bounded backoff, or request timeout.

## Implementation sequence after user model switch

0. Fix duplicate Vite export so HTTP-mode startup/build is reproducible; preserve existing allowed-host intent.
1. Manual controls: minimal validated engine command -> Event -> reducer -> feed path; UI shows authoritative returned/refetched state, supports all four actuators on mobile and desktop.
2. Proposal approve/dismiss: explicit engine decision semantics, safety checks and exactly-once execution; preserve executed overrides.
3. Error/connection: handle initial load, writes, feed stale/reconnect, retries and saved/conflict discriminated results. Fix false safe-adjustment success.
4. Rule receipt: render actual trigger/conditions/actions; resolve inventory targets, edit compatible device and values, disclose all-device/missing-room resolution; actual conflict-specific presentation.
5. Visitor journey: grant-specific QR/backup identifier and clock-derived pending/active/expired state. Coordinate engine apartment preservation for handover; no fabricated security redemption claim.

Browser-test HTTP after each item and commit only owned changes. Do not modify the engine-side NL prompt (separate team). No runtime changes were made during this audit. This report does not certify live writes, secure redemption, or production authorization.
