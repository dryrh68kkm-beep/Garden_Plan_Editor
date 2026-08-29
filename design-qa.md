# Design QA — Showcase logo replacement

## Evidence

- Source visual truth: `/workspace/scratch/6053a9d72cb2/generated_images/logo-frame-02.png`
- Source pixels: 682 × 510 px, extracted from the user-supplied 5.06-second MP4 at approximately 2.5 seconds
- Implementation: `http://terminal.local:4173/showcase/?qa=2026082901`
- Implementation screenshot: Cloud Browser capture emitted inline during this QA run; the browser surface did not expose a filesystem export path
- Browser viewport: 1363 × 936 CSS px at 1× density
- State: Showcase home route, initial desktop state

## Full-view comparison evidence

- The supplied Rinlada artwork now replaces the previous white tree lockup in the left nursery-photo panel.
- The full tree, illustrated person, Thai shop name, telephone number, and curved tagline are visible without clipping.
- The logo plate remains centered in the photographic half and does not overlap the menu, hero copy, CTAs, or service strip.

## Focused region comparison evidence

- A separate focused crop was not needed because the complete 682 × 510 source and the rendered 409 × 306 logo plate were legible in the full-view browser capture.
- The implementation uses the exact supplied artwork frame; it does not recreate the logo with CSS, SVG, text, or placeholder shapes.

## Required fidelity surfaces

- Fonts and typography: No page typography was changed. Text inside the supplied logo remains raster artwork and preserves its original type treatment.
- Spacing and layout rhythm: The logo plate uses the source aspect ratio, a restrained 22 px radius, and centered placement within the 44% image panel.
- Colors and visual tokens: The artwork's cream, forest green, and warm brown palette remains intact and fits the existing cream/green Showcase theme.
- Image quality and asset fidelity: The poster is a dedicated 682 × 510 WebP at about 61 KB. The browser capture shows the full asset sharply with no stretching or transparency halo.
- Copy and content: Existing Showcase copy, links, routes, and CTA labels are unchanged. The supplied telephone number and tagline remain part of the logo artwork.

## Comparison history

1. The first implementation used the supplied MP4 as an autoplaying logo. The cloud browser did not reliably start playback, so the frame could not be treated as stable visual evidence.
2. An animated WebP fallback produced a P1 crop in a later animation frame. It was removed.
3. The implementation was changed to a stable WebP poster extracted from the supplied file. A stale stylesheet query initially retained the old crop behavior, so the Showcase CSS and asset URLs received a new cache version and the image was returned to intrinsic aspect-ratio sizing.
4. The final browser capture shows the complete logo with no clipping, and no page console warnings or errors.

## Browser verification

- New logo asset loaded from `../assets/brand/rinlada-showcase-logo-poster.webp?v=2026082901`.
- The primary “ชมแบบสวน” CTA opened the Garden Styles view, and “กลับหน้าแรก” returned to the Showcase home route.
- No target-page console warnings or errors were present.
- Production build completed successfully. Existing non-module script notices are unchanged repository build notices, not runtime errors from this change.

## Findings

- No actionable P0, P1, or P2 findings remain.
- P3 follow-up: add a dedicated narrow mobile cloud-browser capture if pixel-level mobile comparison becomes available; responsive width and radius rules are present in CSS.

## Implementation checklist

- [x] Supplied logo replaces the previous tree mark
- [x] Full artwork remains visible at the tested viewport
- [x] Exact supplied artwork is used as a real image asset
- [x] Cache-busting version updated
- [x] Primary navigation flow tested
- [x] Console checked
- [x] Production build completed

final result: passed
