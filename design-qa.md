# Design QA — Rinlada split-screen redesign

## Evidence

- Source visual truth: `/workspace/scratch/6053a9d72cb2/upload/5AA1512B-673B-4103-BE04-82D38219CC08.jpeg`
- Login implementation: `/workspace/scratch/rinlada-login-implementation.jpg`
- Showcase implementation: `/workspace/scratch/rinlada-showcase-final.jpg`
- Full login comparison: `/workspace/scratch/qa-rinlada-login-full.jpg`
- Focused form comparison: `/workspace/scratch/qa-rinlada-login-form.jpg`
- Showcase theme comparison: `/workspace/scratch/qa-rinlada-showcase-theme.jpg`
- Browser viewport: 1363 × 936 CSS px
- Source pixels: 1487 × 1057; normalized to 1363 × 936 with center crop
- Implementation pixels: 1363 × 936
- Device scale/density: 1× browser capture; no density resampling needed after source normalization
- State: desktop, admin email field focused; Showcase home route at its initial state

## Full-view comparison

- Layout proportions match the selected direction: photographic nursery panel on the left and warm cream content panel on the right.
- The login form keeps the same hierarchy, field order, copy, and primary action as the source.
- The Showcase reuses the same hero image, split ratio, cream surface, forest-green typography, and restrained controls so both surfaces read as one brand.

## Focused region comparison

- Form labels, input height, focus ring, button size, and spacing were compared in the focused side-by-side image.
- The implementation uses the real Rinlada brand logo instead of reproducing the generated mock's decorative wordmark. This is an intentional brand-fidelity difference.
- The source's botanical line drawing is represented with the existing Rinlada brand icon at low opacity, avoiding a fabricated replacement asset.

## Required fidelity surfaces

- Fonts and typography: IBM Plex Sans Thai is loaded for the login and Showcase. Hierarchy, readable Thai weights, line height, and form-label contrast match the reference intent.
- Spacing and layout rhythm: 44/56 split, centered form, generous vertical whitespace, 62–64 px desktop controls, and 10 px control radii are consistent with the reference.
- Colors and tokens: warm cream, deep forest green, muted sage, and subtle warm-gray borders match the selected palette with accessible contrast.
- Image quality and assets: the nursery hero is a dedicated 1086 × 1448 WebP asset (about 228 KB), sharp at the tested viewport. Existing brand assets are used for all logos and decorative marks.
- Copy and content: admin labels and actions are unchanged. Showcase content and working routes remain intact; only the hero line breaks were balanced for the new split width.

## Comparison history

1. Initial Showcase capture found a P1 heading-wrap issue: “คุณ” was stranded on its own line.
2. The hero content width was increased and the heading was changed to intentional balanced lines: “สวนสวย / ที่อยู่กับคุณ / ในทุกวัน”.
3. The final browser capture shows stable, readable lines with no clipping or overlap.

## Browser verification

- Admin login loaded successfully and the email field focus state was visible.
- Showcase primary CTA opened the Garden Styles view.
- “กลับหน้าแรก” returned to the Showcase hero.
- The menu opened and its home action was visible.
- No target-page console warnings or errors remained. Browser-extension-only messages were excluded from the product result.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3 follow-up: a dedicated mobile browser capture can be added later if pixel-level mobile fidelity is required.

## Implementation checklist

- [x] Selected login layout implemented
- [x] Showcase theme aligned with the selected direction
- [x] Real brand assets retained
- [x] Responsive CSS included
- [x] Primary interactions tested
- [x] Production build completed

final result: passed
