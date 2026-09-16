# Concord — studio direction and implementation handoff

## Status / next action — 2026-09-16

Competition UI implementation and technical QA are complete; visual acceptance remains
with the user after inspecting the local preview. User requested Astra
research/direction, then switched the main session to Sol medium for implementation.
Backend is being built alongside this UI, confirmed by user. User confirmed no route
spec exists and requested the engine implement the minimal interface in ADAPTER.md.
The required loop is fetch devices/rules/grants, sentence → Rule + Conflict, WhyCard
override, and stream/poll Events/WhyCards/SosEvents. CONTRACT.md is immutable
frontend/backend data authority. Do not block UI work waiting for API route names.
The shipped demo includes all seven requested flows: resident home/why corrections,
scene interpretation and confirmation, protected safety conflict, visitor passes, SOS,
building overview, and handover. The UI remains behind the adapter boundary while the
separate engine team implements transport and authorization.

Budget: user reported 100% weekly at project start and a deadline 17 hours away.
No reliable remaining quota or exact deadline timestamp is available. Do not equate
tool output tokens with allowance usage. Direction/research done by main session;
no children used, no image generation, no billed tools. Avoid repeating this research.

## Product thesis

**A home that takes care, and can account for it.**

Residents should see whether home needs them, understand what it did, and correct it
without programming. The differentiator is the connection between state, explanation,
correction and enforceable boundaries—not an AI chat box or a bigger device dashboard.

Design read: mobile-first resident app, Operate mode, architectural warmth with a
stateful apartment model; variance 5 / motion 4 / density 6 / art direction 8.
Operator mode increases density; it does not inherit resident private information.
Conversion for this demo means a judge can understand and complete the core journey.
No sales-uplift claims or invented customer proof.

## Chosen direction: The considerate home

An elegant, roofless architectural apartment model sits in an otherwise fast,
readable app. It is a view of device state, not a background animation. Select a
why entry and the relevant room/light/curtain becomes the focus. Pending changes
are visibly distinguished from executed changes. The explanation and correction
controls stay in HTML, close to the model, never rendered as tiny 3D text.

First viewport: Concord wordmark, apartment 401, visible Emergency action; greeting
“Good evening, Maria.”; a short truthful summary; apartment model with a room selector;
the first unresolved why entry and its three actions. No fake health score or
“Everything is safe” when a device is unavailable. No loading intro.

Desktop 1366×768: narrow labeled navigation rail, main home/model area about 56%,
activity/why column about 44%. Device glance uses a compact list beneath the model.
Mobile 390×844: 56px header, brief greeting, model about 220–250px tall, room selector,
first why entry visible within the first viewport or immediately adjoining it.
Bottom navigation: Home / Scenes / Access. Emergency remains a labeled top action,
never hidden in overflow. At 320px, allow natural scrolling rather than shrinking text.
At 1920–3440px, cap content width around 1560px and keep columns deliberate.

Visual language: warm mineral canvas, deep evergreen type/actions, pale celadon
room surfaces, restrained terracotta/wood in the model. Considered brighter route:
white/cobalt/citrus. Rejected for this direction because prominent saturated status
colors would compete with safety states; warmth must still look luminous, not beige.
One expressive serif greeting pairs with a precise sans interface; no giant slogans.
Surface radii 16–20px; controls 10–12px. Avoid nested bordered cards and glass-on-glass.
The why feed reads as a composed activity ledger; only the current decision gets a
strong surface. Preserve 18px body / 16px information floors.

## Mechanism / library candidates

1. **Selected: small real-time architectural model.** React Three Fiber / Three.js,
   orthographic framing, a few curated CC0 furniture meshes, code-authored apartment
   walls, local materials and event-driven room lighting. Greater ambition because
   several meaningful states share one physical home. Asset route: Kenney Furniture
   Kit, publicly inspected and CC0 verified; kit download/mesh inspection still owed.
   Rematerialize the selected pieces; default colorful toy-kit presentation is NOT
   the target. Architectural model photography is the material/composition analogy,
   not a claim that a specific architectural photograph was researched or licensed.
2. **Lower-risk alternate: layered SVG plan.** Same floor layout, HTML room controls,
   illuminated zones and state labels. Crisp and fast but less materially distinctive.
   Required WebGL fallback; not silently interchangeable with a failed 3D promise.
3. **Rejected: photo dashboard / generic shader.** Josh and Savant show the usability
   of rooms and scenes, but another photo widget grid does not explain Concord’s
   reasoning. ShaderGradient changes atmosphere without proving which device acted.

Reuse licensed furniture because it supplies credible silhouettes cheaply. Bespoke
work is limited to apartment geometry, composition, material treatment, state mapping
and the reason-to-room relationship; no procedural reinvention of every asset.
React + TypeScript + Vite, local CSS tokens, Base UI accessible dialogs, Motion for
interruptible panel/layout transitions, lucide-react for consistent utility icons,
qrcode for real QR encoding. Confirm compatible versions and pin in local lockfile.
No GSAP/scroll stack, no hosted scene editor, no cloud/API image generation dependency.

## Frontier scene contract (before runtime)

- Geometry: an L-shaped cutaway apartment with living/kitchen, bedroom and entry;
  approximate 10×7m footprint, thin low partitions, two rear full-height walls,
  front walls removed. Furnished enough to read as a residence, not a cube diagram.
  Scene is an illustrative demo layout, not an asserted real building floor plan.
- Camera: orthographic three-quarter view, initial position approximately (10,11,12)
  aimed at floor centre. No idle orbit, no wheel capture. Selected-room framing uses
  a small target/zoom change; all rooms remain locatable. Room labels are HTML.
- Materials/light: matte plaster, light timber, muted green upholstery, restrained
  brushed-metal details. Soft key and contact shadows, legible daylight fill even in
  evening mode. No bloom fog, sparkles or glass effects covering controls.
- Initial: executed device states match the home: living lights softened, curtains
  partly closed, entry locked. Status and evidence originate from fixtures/events.
- Interaction 1, inspect: selecting a why entry focuses its room, highlights affected
  devices and opens its evidence row. It MUST NOT change devices just by inspection.
- Interaction 2, correct: Not tonight records the override and shows “Paused until
  tomorrow”; Never disables its rule and says so; Keep confirms the routine. Current
  physical device state does not magically rewind—contract does not promise undo.
  Offer explicit device controls if the resident wants the current state changed.
- Interaction 3, compose: “Make it comfortable when I sleep” produces an editable
  When / Only if / Then rule receipt. Proposed 22:30/23°C/20% values are clearly
  suggestions requiring confirmation, never purported learned facts. Preview mode
  labels hypothetical room lighting as Preview and leaves real Device state untouched.
- Interaction 4, resolve: confirm saves a safe Rule; subsequent demo Event activates
  it, changes Device via the event stream, and produces an executed WhyCard. The room
  responds to that confirmed device state, not the save button alone.
- Safety beat: a requested lock rule conflicts with smoke unlock. Show both rules,
  cause and consequences. Safety wins; offer safe condition editing/cancel, never a
  button to override life-safety. Ordinary AC conflicts may allow either preference.
- Persistent: apartment geometry, camera orientation, navigation, Emergency action,
  resident identity and device-to-room mapping. Transforming: selected-room emphasis,
  light levels, curtains, conditional preview and associated evidence panel.
- Reverse scroll/back: native scrolling has no scene timeline. Scrolling back never
  undoes actions. Closing a detail restores whole-home framing; browser navigation
  preserves session state. Only a deliberate Reset demo restores fixtures.
- Touch/keyboard: room tabs and device list expose every scene action; no drag/orbit
  required. Canvas does not capture vertical scroll. Focus stays in active dialog,
  then returns to its trigger. No essential information exists only on hover.
- Motion: controls respond immediately; UI transitions 160–240ms; room focus/light
  transitions about 400–550ms and interruptible. No continuous idle animation.
- Reduced motion: instant room framing and state changes, no camera travel or spring;
  data/actions retained. WebGL failure/context loss: labeled SVG plan + full device
  list and explanations. Verify fallback separately from live 3D.
- Budgets: scene assets target <=1.5MB compressed, <=100k triangles, DPR <=1.5,
  demand rendering, stop offscreen/hidden work. App shell must render before models;
  same-size plan placeholder prevents layout shift. Never delay Emergency for 3D.

## Composition diff against last three catalog sites

| Axis | Honda Kaduwela V2 | SHIFT accepted direction | Apex Hybrid | Concord |
|---|---|---|---|---|
| Structure | Campaign scroll: ignition, ride, features, ownership | Continuous threshold/room passage | Two chapters over fixed product stage | Persistent app shell; home, editor, passes, building routes |
| Motion | Headlamp reveal, photo parallax, color selection | Camera passage, linework/material transformation | Scroll camera/object lerps | User/event-driven room focus and actual device-state response |
| Focal subject | Dio and photographic daily-life story | Portable boundaries becoming a room | Floating business equipment | One inhabited apartment linked to explanations and corrections |
| Type/image grammar | Bold italic campaign type and generated/official photos | Large room-scale statements and photo/linework composite | Geometric type and product objects | Small editorial greeting, readable task typography, architectural cutaway |

Novelty must still be checked in the rendered proof; this written table is not evidence
that the final result looks different. Root rules override marketing skill prescriptions:
no AIDA, random layouts, pinned scrolling, or compulsory illustrative art in utility forms.

## Screen and flow contract

1. **Home:** executed/proposed/alert distinctions, timestamp, room linkage, evidence
   expander, Keep / Not tonight / Never, result feedback. Resolved rows remain in
   history without repeat buttons. Device list has real state and unavailable state.
2. **Scenes:** useful example phrases + text field, explicit parsing state, editable
   structured receipt, validation and save confirmation. Unknown/ambiguous input
   requests clarification; mock mode must not pretend to understand arbitrary language.
3. **Conflicts:** Base UI modal on desktop, full-height sheet on mobile when necessary.
   Rule names, conditions/actions, specific overlap, permitted choices, no mutation
   until resolution. Unsaved draft survives cancel/back.
4. **Access:** Guest/Delivery/Cleaner, name, start/end, scope summary, valid dates.
   Real encoded QR for a visitor view; pending/active/expired states, readable backup
   code, local share/copy/download. Visitor sees destination/window/access scope only.
   Never imply a real lock was opened or a secure bearer token exists in mock mode.
5. **SOS:** labeled Emergency available everywhere for residents, large confirmation
   target and short cancellable countdown, with Send now for keyboard/urgent use.
   Explicit “Demo — no emergency services contacted.” Active → acknowledged → resolved
   only from adapter events. Show who was notified and when; no invented reassurance.
6. **Building:** unit grid with number, text health/attention state and specific faults;
   filters for attention/offline/anomaly, one detail panel. Non-color indicators.
   No resident routine, occupancy, movement history or private device controls.
7. **Handover:** unit → owner/tenant details + dates → review → grant issued receipt.
   Matching validFrom/validUntil, invalid-range prevention, old expired grant retained.
   Developer audience uses this building/handover presentation; no invented developer
   CapabilityGrant role or extra full dashboard.

Mock personas are explicit demo role selection, not real authentication. Keep data in
memory; reload/reset can restart the demo. Backend will own real sessions/access.
No analytics, tracking, persona cookies or localStorage introduced without consent.

## Contract edges / backend boundary

- Keep CONTRACT.md byte-for-byte. Define matching types under src/domain/contracts.ts.
  WhyCard.status must include alert because contract prose explicitly requires it.
- Scene focus, room layout, selected role and expiry presentation are view state, not
  extra fields silently injected into Device/Rule/WhyCard/CapabilityGrant.
- Rule has no safety/priority metadata. Keep mock safety classification in a separate
  policy registry keyed by rule ID. Prefer safe edit_condition resolution supported
  by existing conditions; real backend must supply/enforce safety decisions.
- Keep confirms without changing device state. Not tonight suppresses the current
  day; Never sets Rule.enabled=false. Don't reinterpret either as immediate undo.
- Use a single demo Clock with explicit timezone. Relative fixtures must stay coherent
  after date rollover. Expiry and suppression use that clock, not scattered Date.now().
- Device updates go through Event; no component directly writes mock Device state.
- Adapter responsibilities: subscribe to authorized snapshot/events, request rule
  interpretation, save/resolve rule, submit override, create grant, request device
  action, trigger/observe SOS. These are frontend method boundaries, NOT invented
  HTTP endpoints. Map actual endpoints when backend spec arrives.
- Operator permission is enforced at mock adapter reads/commands, not just hidden
  navigation. Real backend must enforce it too; a bundled mock is not a security boundary.
- Unit summaries are UI projections. Health can derive from authorized device health
  data; energy anomaly indicators need real backend data or explicitly seeded mock
  values—never infer energy consumption from an AC setpoint alone.
- UI shows pending/error/retry for async writes and waits for authoritative success.
  Surface stream reconnect/stale state. Don't announce “saved” before response.

## Implementation sequence and ownership

Main lead (Sol medium): integration, package/config, app shell, tokens, domain adapter
and all shared files. Start with these stable contracts before any parallel work.
If useful, one bounded scene implementer may exclusively own src/scene/** after
scene props and asset files exist. No full-site delegation before resident proof.

**Proof:** responsive shell + furnished home + one real why/correction path + scene
receipt + safety conflict. This reveals both visual identity and the differentiator.
Save runnable slice before refinement, capture desktop/mobile plus interaction states,
get user judgment. Do not deliver only a model with buttons or disconnected screenshots.

**Finish:** access/QR/visitor, SOS escalation simulation, building/handover, actual
backend mapping when available. Keep endpoints replaceable; no backend rewrite.

**Verification:** one batched functional/visual round, fix material findings together,
one targeted confirmation. Test 390/1366 plus narrow 320 and wide 2560/3440 overflow;
keyboard, reduced motion, WebGL fallback, invalid dates, expiry, repeated overrides,
conflict safety, operator privacy, and lost/reconnected stream. Use existing screenshot
and motion QA scripts; inspect temporal frames, not only final poses. Fresh bounded
review only after the core proof exists. Read review skills at that phase, not now.

Required evidence: qa/content-audit.md with computed text sizes/contrast and asset
loading, functional results, screenshots, temporal/reduced-motion/fallback evidence.
Utility forms/grid/feed are functional information, not marketing sections requiring
stock photos. Explain exemptions honestly. Production build/start from this directory,
PORT support, README, demo/live mode distinction. No security/pentest completion claim
for a mock UI. Follow backend-security workspace rules if real backend logic is added.

## Research / handoff artifacts

- [.tastemaker/reference-board.md](.tastemaker/reference-board.md): observed sources and limits.
- [.tastemaker/style-lock.md](.tastemaker/style-lock.md): implementation tokens/constraints.
- [PRODUCT.md](PRODUCT.md): product scope, backend confirmation and demo boundary.
- [ADAPTER.md](ADAPTER.md): concrete typed methods and engine integration semantics.
- research/ contains public reference captures and actual palette measurements.
- No customer assets, images or generated mockups required from the user to start.
  The final scene is code-authored and verified in live, reduced-motion and SVG fallback states.

## Final implementation and evidence — 2026-09-16

- React/Vite app shell with responsive resident and operator modes.
- Stateful Three.js apartment with whole-home and room focus, preview lighting,
  reduced-motion instant transitions, context-loss handling and a useful SVG plan fallback.
- Contract-shaped adapter with deterministic mock and live HTTP implementations.
  `VITE_ADAPTER=http` connects the shipping UI to the local engine described by `ADAPTER.md`.
- Real local QR SVG, explicit demo wording, no third-party assets, tracking or persistence.
- Readability floor enforced at 18px body copy and 16px controls/metadata. Measured
  contrast, C/V accounting and loading inventory are in `qa/content-audit.md`.

Evidence:

- `qa/screenshots.json` and desktop/laptop/mobile viewport captures.
- `qa/states/` for rule receipt, protected conflict, visitor pass, operator, mobile and reduced motion.
- `qa/motion/motion.json` plus temporal frames/video and forced fallback.
- `qa/interaction.mjs`, `qa/scene.mjs` and `qa/text-floor.mjs` for behavior/state assertions.

Implementation caveat: registry access stalled during install. The working site uses
matching dependencies copied from existing local workspace caches. The production build
is self-contained and passes; normalize with `npm install --legacy-peer-deps` when normal
registry access is available. Vite reports an approximately 899kB raw / 249kB gzip main
chunk because React, Three.js, Motion and icons ship together; no runtime failure was
observed. Code splitting remains a post-competition optimization.

## Live-engine checkpoint — 2026-09-17

- Scene confirmation now renders and edits the exact engine-resolved device, room,
  action and values. Conflict responses never show a saved receipt.
- Light, AC, curtain and lock controls send engine commands, refetch authoritative
  device state and drive visible lighting, curtain, climate and door changes in the
  Three.js homescape. The complete device list remains available on mobile.
- Proposed WhyCards expose Approve / Dismiss; executed and alert cards expose Keep /
  Not tonight / Never. Approving runs the engine action; dismissing does not mutate devices.
- Connection state is explicit (`live`, `reconnecting`, `stale`, `offline`) with bounded
  2/4/8/15-second poll backoff, retained snapshots, retry UI, six-second HTTP timeouts
  and visible write errors.
- Visitor grants persist through the engine, refetch after creation, render real
  grant-specific local QR codes, readable backup codes, and pending/active/expired states.

Checkpoint evidence:

- `qa/LIVE-AUDIT.md` records the pre-fix live-adapter audit.
- `qa/checkpoint-manual-mobile.png`, `qa/checkpoint-proposal-decisions.png`,
  `qa/checkpoint-connection-error.png`, and `qa/checkpoint-visitor-pass.png` record the flows.
- `qa/final/screenshots.json` covers desktop, laptop and mobile production-preview renders.
- `qa/motion-final/motion.json` covers temporal desktop/mobile captures, reduced motion,
  WebGL state reporting and the forced non-canvas fallback.
