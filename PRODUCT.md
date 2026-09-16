# Concord product

<!-- impeccable:product-schema 1 -->

## Platform and stack
Mobile-first web app, designathon demo for luxury apartment buildings. React preferred
by user; remaining stack delegated. Direction chooses React/TypeScript/Vite with an
adapter boundary for the separately developed backend. Plain Node hosting required.

## Users and purpose
Residents manage less: the home notices, acts/proposes, explains and accepts correction.
Visitors receive time-limited access. Operators see permitted unit health/faults and
perform handover. Developers demonstrate the same handover/ownership proposition.

## Required scope
Rich home/why feed, natural-language rule builder with editable confirmation, conflicts,
visitor passes with QR and expiry, prominent SOS. Light building grid and handover flow.
CONTRACT.md supplies exact entity shapes and privacy rules; preserve it unchanged.
Safety rules cannot be displaced by a resident automation. Devices communicate via Event.

## Confirmed integration
User confirmed a backend is being built alongside this UI and no route spec exists.
User requested the engine team implement the adapter interface documented in ADAPTER.md:
fetch devices/rules/grants, interpret a sentence into Rule + Conflict, post a WhyCard
override, and stream/poll WhyCards/Events/SosEvents. Contract-shaped mocks use the same
interface. HTTP routing remains the engine team's choice.

## Constraints and truthfulness
No hardware or emergency-service integration in the UI demo. Clearly distinguish
simulation from live mode; no invented delivery/escalation confirmations. No real
authentication claim from a demo role selector. No additional billing or generated
image requirement. In-memory demo state, no optional tracking or persona persistence.
18px body, 16px information floor, readable contrast, keyboard and reduced-motion
support. Mobile and ultrawide behavior matter. Design-specific decisions: STUDIO.md.
