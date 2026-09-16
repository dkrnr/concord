# Concord content, readability and loading audit

Audit target: production preview at `http://127.0.0.1:4192`, desktop 1440×900 and mobile 390×844. Evidence is from the final production bundle. `qa/text-floor.mjs` inspects every visible element with its own rendered text across Home, Scenes, Access and Building, plus the mobile Home viewport; it fails if any computed text size is below 16px.

## Typography evidence

| Role / selector | Desktop | Mobile | Result |
| --- | ---: | ---: | --- |
| Body and explanatory `p` | 18px | 18px | meets 18px copy floor |
| Navigation and buttons | 16px minimum | 16px minimum | meets control floor |
| Labels, metadata, `small`, `time` | 16px minimum | 16px minimum | meets information floor |
| Greeting `h1` | 65.6px | 40px | display typography retained |
| Why-card title | 20px | 20px | clear hierarchy |

Automated result: `node qa/text-floor.mjs http://127.0.0.1:4192` returns empty violation arrays for all audited routes and mobile.

## Contrast evidence

Ratios use WCAG relative luminance against the actual stable surface colors. Moving canvas content contains no text; its caption has a stable white backing.

| Foreground | Background | Use | Ratio |
| --- | --- | --- | ---: |
| `#20352F` | `#F6F4EE` | primary canvas text | 11.85:1 |
| `#58645E` | `#F6F4EE` | muted canvas text | 5.62:1 |
| `#20352F` | `#FFFFFF` | surface text | 13.03:1 |
| `#58645E` | `#FFFFFF` | muted surface text | 6.18:1 |
| `#FFFFFF` | `#275C49` | primary actions | 7.74:1 |
| `#173E30` | `#E4EEDB` | positive status | 9.93:1 |
| `#A62D38` | `#FFF4F2` | emergency action | 6.38:1 |
| `#7C4A48` | `#FFF4F2` | emergency supporting text | 6.65:1 |
| `#8D5315` | `#F8EDDD` | warning state | 5.37:1 |

All recorded information pairs exceed 4.5:1.

## Section media accounting

| Screen / section | C | V | Pairing / exemption |
| --- | ---: | ---: | --- |
| Home greeting + live-home state | 2 | 1 | furnished architectural scene directly visualizes current room/device state; passes `V >= ceil(C/2)` |
| Why feed | exempt | exempt | functional activity history and correction controls |
| Device glance | exempt | exempt | compact utility status list |
| Scene builder + rule receipt | exempt | exempt | form/editor flow; live architectural preview is additional state evidence |
| Visitor pass | exempt | exempt | form plus generated credential, not marketing content |
| Building units | exempt | exempt | operational data grid |
| Safety, SOS and handover dialogs | exempt | exempt | transactional/safety flows |

The code-authored scene changes room emphasis and preview lighting, so these are distinct explanatory states rather than one repeated decorative image.

## Asset and loading inventory

| Asset | Runtime selector / policy | Dimensions and evidence |
| --- | --- | --- |
| `manrope-400.woff2` | eager CSS `@font-face`, `font-display: swap` | local, 14,108 bytes; loaded before QA snapshots via `document.fonts.ready` |
| `manrope-600.woff2` | eager CSS `@font-face`, `font-display: swap` | local, 14,172 bytes |
| `manrope-700.woff2` | eager CSS `@font-face`, `font-display: swap` | local, 14,212 bytes |
| `editorial-serif.woff2` | eager CSS `@font-face`, `font-display: swap` | local, 26,356 bytes |
| `pass-qr.svg` | interaction-created `.qr-ticket img`; eager browser default because it is immediately visible when inserted | SVG viewBox 37×37; reserved by CSS at 195×195px, avoiding layout shift inside the already-sized ticket |
| Three.js apartment | `.home-canvas`; initialized after shell mount | canvas fills a fixed-height `.scene-wrap`, DPR capped at 1.5; no network asset requests |
| SVG fallback | `.scene-fallback`; forced with `?renderer=fallback` or WebGL failure/context loss | same scene container dimensions; room controls remain functional |

There are no below-fold raster images or CSS background images, so no lazy-load candidate exists. Shared screenshot and motion reports record no broken images or failed resources. The QR is the only `<img>` and is deliberately eager after the user creates a pass.

## Evidence links

- Static viewports: `qa/desktop-viewport.png`, `qa/laptop-viewport.png`, `qa/mobile-viewport.png`, `qa/screenshots.json`
- Interaction states: `qa/states/`
- Motion/live/reduced/fallback: `qa/motion/`, `qa/motion/motion.json`
- Functional flow: `qa/interaction.mjs`
- Scene states: `qa/scene.mjs`
