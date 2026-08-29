# Design QA — Showcase circular logo badge

## Evidence

- Source visual truth: `/workspace/scratch/6053a9d72cb2/upload/IMG_9467.jpeg`
- Source pixels: 708 × 1536 px, iPhone browser screenshot supplied by the user
- Implementation: `http://terminal.local:4173/showcase/`
- Implementation screenshot: Cloud Browser capture emitted inline during this QA run; the browser surface did not expose a filesystem export path
- Comparison surface: one 786 × 852 px browser capture containing the supplied before image and a live 393 × 852 CSS-pixel implementation side by side
- Density normalization: the supplied screenshot was scaled to 393 × 852 for the focused visual comparison; the live implementation rendered at 393 × 852 and 1× density
- State: Showcase home route, initial mobile state

## Full-view comparison evidence

- Before: the incorrectly masked transparent asset shows cyan/grey edge artifacts, a muddy glow, and weak contrast against the detailed nursery photo.
- After: the untouched supplied logo artwork is placed inside an intentional circular ivory badge. The clean edge, restrained border, and natural shadow separate the brand from the photo without looking like a rectangular pasted card.
- The mobile hero, headline, CTAs, and the amount of above-the-fold content remain balanced.

## Focused region comparison evidence

- The tree, illustrated person, Thai shop name, telephone number, and tagline remain part of the real supplied raster logo; no logo details were rebuilt in CSS or SVG.
- The circular crop removes the corrupt transparent pixels and keeps the important center artwork fully visible.
- The earlier oval preview was changed to a true 1:1 circle, and `object-fit: cover` removed visible horizontal color bands.

## Required fidelity surfaces

- Fonts and typography: Showcase typography is unchanged. Type inside the logo remains part of the original artwork and is visibly sharper than the corrupted transparent version.
- Spacing and layout rhythm: The mobile badge is 68vw with a 290 px cap and remains centered in the hero. Desktop uses a quieter 24vw/330 px cap.
- Colors and visual tokens: The badge uses the artwork's sampled warm ivory (`#f6eae0`), a low-contrast warm border, and the existing forest-green brand palette.
- Image quality and asset fidelity: The valid 682 × 510 poster WebP replaces the damaged alpha-masked asset. The browser reports the image complete at its full natural dimensions, with no transparency halo or compression corruption.
- Copy and content: No Showcase copy, CTA, route, telephone number, or tagline was changed.

## Comparison history

1. P1: the transparent logo file contained cyan/grey masking artifacts that were visible over the garden image.
2. Fix: replaced the damaged transparent file reference with the clean poster WebP and introduced an intentional badge container.
3. P2: the first badge preview used the artwork's 4:3 ratio and read as a wide oval.
4. Fix: changed the badge to a 1:1 circle and reduced its mobile width.
5. P2: `object-fit: contain` exposed horizontal background-color bands inside the circle.
6. Fix: changed to `object-fit: cover`, preserving the central mark while removing the bands.
7. Post-fix evidence: the final side-by-side mobile capture shows a clean circular badge with no colored halo, no rectangle, and no visible banding.

## Browser verification

- Logo loaded from `../assets/brand/rinlada-showcase-logo-poster.webp?v=2026082908` at 682 × 510 px.
- The “ชมแบบสวน” CTA opened `showcaseStylesPage`.
- “กลับหน้าแรก” returned to `showcaseHomePage`.
- No target-page console warnings or errors were present.
- `npm run build` completed successfully.

## Findings

- No actionable P0, P1, or P2 findings remain.
- P3 follow-up: verify the production iPhone browser crop after GitHub Pages cache propagation.

## Implementation checklist

- [x] Remove damaged transparent asset from the Showcase
- [x] Preserve the exact supplied logo artwork
- [x] Use an intentional circular badge instead of a rectangular card
- [x] Remove transparency halo and internal color bands
- [x] Balance mobile and desktop scale
- [x] Test primary navigation
- [x] Check console
- [x] Complete production build

final result: passed
