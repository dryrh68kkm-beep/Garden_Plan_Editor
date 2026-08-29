# Design QA — Blended Showcase logo

## Evidence

- Source visual truth: `/workspace/scratch/6053a9d72cb2/upload/IMG_9434.jpeg`
- Source pixels: 707 × 1536 px, iPhone browser screenshot supplied by the user
- Implementation: `http://terminal.local:4173/showcase/?qa=2026082902`
- Implementation screenshot: Cloud Browser capture emitted inline during this QA run; the browser surface did not expose a filesystem export path
- Browser viewport: 1363 × 936 CSS px at 1× density
- State: Showcase home route, initial desktop state; responsive rules reviewed against the supplied mobile screenshot

## Full-view comparison evidence

- The source screenshot shows a cream rounded rectangle and card shadow that make the logo look pasted over the nursery photo.
- The implementation removes the rectangle, border, radius, and card shadow. The logo artwork now sits directly on the nursery image with transparent negative space.
- A soft outline and natural drop shadow preserve legibility without recreating a background card.

## Focused region comparison evidence

- The logo region was inspected at full browser scale. The tree, illustrated person, shop name, telephone number, and tagline remain intact.
- The new 682 × 510 transparent PNG uses the exact supplied brand artwork. No logo details were rebuilt with CSS, SVG, or text.

## Required fidelity surfaces

- Fonts and typography: Page typography is unchanged. Type inside the logo remains part of the supplied artwork.
- Spacing and layout rhythm: Desktop placement remains centered in the image panel. Mobile width increases from 70–72vw to 78–82vw because removal of the card allows more natural scale without heavy visual mass.
- Colors and visual tokens: The original green, brown, and sage palette is preserved and now shares the nursery background instead of sitting on a separate cream surface.
- Image quality and asset fidelity: The cream background was removed by alpha masking while the original 682 × 510 logo details were retained. A 4 px warm outline and restrained dark shadow improve contrast.
- Copy and content: No Showcase copy, CTA, route, telephone number, or tagline was changed.

## Comparison history

1. P1 source issue: the cream rounded rectangle read as a pasted card on both the mobile screenshot and previous production capture.
2. The logo background was converted to transparency, and the card border, radius, background, and box shadow were removed.
3. P2 first preview: dark logo details lost contrast against foliage. A warm 4 px outline plus a restrained natural shadow was added.
4. Final browser capture shows the logo integrated into the garden image with the brand name and illustration still visible.

## Browser verification

- Transparent asset loaded from `../assets/brand/rinlada-showcase-logo-transparent.png?v=2026082902`.
- Primary “ชมแบบสวน” CTA opened the Garden Styles view.
- “กลับหน้าแรก” returned to the Showcase home route.
- No target-page console warnings or errors were present.
- `npm run build` completed successfully.

## Findings

- No actionable P0, P1, or P2 findings remain.
- P3 follow-up: verify exact iPhone safe-area framing on the production URL after GitHub Pages deployment.

## Implementation checklist

- [x] Remove cream rectangle
- [x] Remove card border, radius, and heavy shadow
- [x] Preserve exact logo artwork
- [x] Add transparent background
- [x] Improve contrast without adding a card
- [x] Increase responsive mobile scale
- [x] Test primary navigation
- [x] Check console
- [x] Complete production build

final result: passed
